import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { sendConfirmationEmail } from '../_shared/send-confirmation-email.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Parse the event body to extract session ID and find the order/mandator
    // We need the webhook secret to verify, which is per-mandator
    const rawEvent = JSON.parse(body)
    const sessionId = rawEvent.data?.object?.id
    const eventType = rawEvent.type

    if (!sessionId) {
      return new Response('Missing session ID in event', { status: 400 })
    }

    // Look up the order to find the mandator
    const { data: order } = await supabase
      .from('ticket_orders')
      .select('id, mandator_id')
      .eq('stripe_checkout_session_id', sessionId)
      .single()

    if (!order) {
      // Could be an event for a different product — ignore gracefully
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch the mandator's webhook secret and stripe key
    const { data: mandator } = await supabase
      .from('mandators')
      .select('stripe_secret_key, stripe_webhook_secret')
      .eq('id', order.mandator_id)
      .single()

    if (!mandator?.stripe_webhook_secret || !mandator?.stripe_secret_key) {
      console.error('Mandator missing Stripe configuration:', order.mandator_id)
      return new Response('Stripe not configured', { status: 500 })
    }

    // Verify the webhook signature
    const stripe = new Stripe(mandator.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        mandator.stripe_webhook_secret,
        undefined,
        cryptoProvider,
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    // Determine the site URL for email links
    const origin = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'https://eclipseboundaries.com'

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        await supabase
          .from('ticket_orders')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq('id', order.id)

        // Send confirmation email
        await sendConfirmationEmail(supabase, order.id, origin)

        break
      }

      case 'checkout.session.expired': {
        // Mark order as expired and cancel tickets
        await supabase
          .from('ticket_orders')
          .update({ status: 'expired' })
          .eq('id', order.id)

        await supabase
          .from('tickets')
          .update({ status: 'cancelled' })
          .eq('order_id', order.id)

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = charge.payment_intent as string

        if (paymentIntentId) {
          const { data: refundOrder } = await supabase
            .from('ticket_orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single()

          if (refundOrder) {
            await supabase
              .from('ticket_orders')
              .update({
                status: 'refunded',
                refunded_at: new Date().toISOString(),
              })
              .eq('id', refundOrder.id)

            await supabase
              .from('tickets')
              .update({ status: 'cancelled' })
              .eq('order_id', refundOrder.id)
          }
        }

        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Webhook error:', e)
    return new Response('Webhook handler error', { status: 500 })
  }
})
