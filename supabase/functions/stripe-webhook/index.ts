import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

async function sendConfirmationEmail(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  siteUrl: string,
) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured, skipping email')
    return
  }

  // Fetch order with buyer details
  const { data: order } = await supabase
    .from('ticket_orders')
    .select('id, buyer_name, buyer_email, total_cents, currency, event_id')
    .eq('id', orderId)
    .single()

  if (!order) return

  // Fetch event details
  const { data: event } = await supabase
    .from('events')
    .select('title, location, event_date')
    .eq('id', order.event_id)
    .single()

  if (!event) return

  // Fetch tickets with phase names
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, qr_token, phase_id')
    .eq('order_id', orderId)

  const phaseIds = [...new Set((tickets ?? []).map(t => t.phase_id))]
  const { data: phases } = await supabase
    .from('ticket_phases')
    .select('id, name')
    .in('id', phaseIds)

  const phaseMap = new Map((phases ?? []).map(p => [p.id, p.name]))

  const ticketCount = tickets?.length ?? 0
  const totalFormatted = `CHF ${(order.total_cents / 100).toFixed(2)}`
  const eventDate = new Date(event.event_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const viewTicketsUrl = `${siteUrl}/tickets/order/${order.id}`

  const ticketListHtml = (tickets ?? []).map(t => {
    const phaseName = phaseMap.get(t.phase_id) ?? 'Ticket'
    return `<tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee; font-family: sans-serif; font-size: 14px; color: #333;">${phaseName}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee; font-family: sans-serif; font-size: 14px; color: #999; font-variant-numeric: tabular-nums;">${t.qr_token.substring(0, 8)}...</td>
    </tr>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6C5CE7, #9684E8); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-family: sans-serif; font-size: 20px; font-weight: 800; color: white; letter-spacing: 3px; text-transform: uppercase;">ECLIPSE BOUNDARIES</h1>
            </td>
          </tr>

          <!-- Confirmation -->
          <tr>
            <td style="padding: 32px 24px 16px; text-align: center;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: #1a1a1a; color: white; font-size: 24px; line-height: 48px; margin: 0 auto 16px;">&#10003;</div>
              <h2 style="margin: 0 0 8px; font-family: sans-serif; font-size: 22px; color: #1a1a1a;">Payment Confirmed</h2>
              <p style="margin: 0; font-family: sans-serif; font-size: 14px; color: #777;">Thank you for your purchase, ${order.buyer_name}!</p>
            </td>
          </tr>

          <!-- Event Details -->
          <tr>
            <td style="padding: 16px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; border-radius: 8px; padding: 16px;">
                <tr>
                  <td style="padding: 16px;">
                    <h3 style="margin: 0 0 8px; font-family: sans-serif; font-size: 16px; color: #1a1a1a;">${event.title}</h3>
                    <p style="margin: 0 0 4px; font-family: sans-serif; font-size: 13px; color: #555;">${event.location}</p>
                    <p style="margin: 0; font-family: sans-serif; font-size: 13px; color: #555;">${eventDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tickets -->
          <tr>
            <td style="padding: 16px 24px;">
              <h3 style="margin: 0 0 12px; font-family: sans-serif; font-size: 14px; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">Your Tickets (${ticketCount})</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${ticketListHtml}
              </table>
            </td>
          </tr>

          <!-- Total -->
          <tr>
            <td style="padding: 8px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 16px; font-family: sans-serif; font-size: 14px; color: #333; font-weight: bold;">Total</td>
                  <td style="padding: 12px 16px; font-family: sans-serif; font-size: 14px; color: #333; font-weight: bold; text-align: right;">${totalFormatted}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 24px 32px; text-align: center;">
              <a href="${viewTicketsUrl}" style="display: inline-block; padding: 14px 32px; background: #1a1a1a; color: white; text-decoration: none; font-family: sans-serif; font-size: 14px; font-weight: 600; border-radius: 8px;">VIEW TICKETS &amp; QR CODES</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background: #fafafa; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; font-family: sans-serif; font-size: 12px; color: #999;">Please present your QR code at the door for entry.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'tickets@eclipseboundaries.com'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `ECLIPSE BOUNDARIES <${fromEmail}>`,
      to: [order.buyer_email],
      subject: `Your tickets for ${event.title}`,
      html,
    }),
  })

  if (res.ok) {
    await supabase
      .from('ticket_orders')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', orderId)
    console.log('Confirmation email sent to', order.buyer_email)
  } else {
    const errBody = await res.text()
    console.error('Failed to send confirmation email:', res.status, errBody)
  }
}

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
