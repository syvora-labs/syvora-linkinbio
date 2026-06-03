import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { sendOrderConfirmationEmail } from '../_shared/send-order-confirmation-email.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

type CartItem = { product_id: string; variant_id: string; quantity: number }

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

    // We need the per-mandator webhook secret to verify, so first peek at the
    // raw payload to find the session id, then the order, then the mandator.
    const rawEvent = JSON.parse(body)
    const sessionId = rawEvent.data?.object?.id

    if (!sessionId) {
      return new Response('Missing session ID in event', { status: 400 })
    }

    const { data: order } = await supabase
      .from('product_orders')
      .select('id, mandator_id, status')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()

    if (!order) {
      // Event for some other product (e.g. ticket sales) — ignore gracefully.
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // The Stripe API key is shared with the ticket flow (same Stripe account),
    // so it lives on the mandator row. The webhook signing secret, however, is
    // unique per registered Stripe endpoint — the webshop endpoint is separate
    // from the ticket endpoint, so it has its OWN secret, stored as a dedicated
    // function secret rather than the shared mandators.stripe_webhook_secret.
    const { data: mandator } = await supabase
      .from('mandators')
      .select('stripe_secret_key')
      .eq('id', order.mandator_id)
      .single()

    const webhookSecret = Deno.env.get('WEBSHOP_STRIPE_WEBHOOK_SECRET')

    if (!webhookSecret || !mandator?.stripe_secret_key) {
      console.error('Webshop Stripe configuration missing for mandator:', order.mandator_id)
      return new Response('Stripe not configured', { status: 500 })
    }

    const stripe = new Stripe(mandator.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        cryptoProvider,
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    if (event.type !== 'checkout.session.completed') {
      // Refunds, cancellations and fulfilment are handled by the ERP admin.
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const session = event.data.object as Stripe.Checkout.Session

    // ─── Idempotency ───────────────────────────────────────────────────
    // Stripe retries on any non-2xx, so this handler must be re-entrant.
    if (order.status === 'paid' || order.status === 'fulfilled') {
      return new Response('already processed', { status: 200 })
    }

    const cartJson = session.metadata?.cart
    if (!cartJson) return new Response('missing cart metadata', { status: 400 })
    const cart = JSON.parse(cartJson) as CartItem[]

    // ─── Fetch snapshots ───────────────────────────────────────────────
    const productIds = [...new Set(cart.map(i => i.product_id))]
    const variantIds = cart.map(i => i.variant_id)
    const [productsRes, variantsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, title, price_cents, currency')
        .eq('mandator_id', order.mandator_id)
        .in('id', productIds),
      supabase
        .from('product_variants')
        .select('id, size')
        .eq('mandator_id', order.mandator_id)
        .in('id', variantIds),
    ])
    const products = Object.fromEntries((productsRes.data ?? []).map(p => [p.id, p]))
    const variants = Object.fromEntries((variantsRes.data ?? []).map(v => [v.id, v]))

    // ─── Atomically decrement stock ────────────────────────────────────
    const stockResult = await supabase.rpc('webshop_decrement_stock_for_order', {
      p_decrements: cart.map(c => ({ variant_id: c.variant_id, qty: c.quantity })),
    })

    if (stockResult.error) {
      // CHECK (stock >= 0) tripped — someone bought the last unit between
      // checkout creation and webhook delivery. Refund and mark the order.
      console.error('Stock decrement failed, refunding order', order.id, stockResult.error)
      await supabase
        .from('product_orders')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('id', order.id)
      if (session.payment_intent) {
        await stripe.refunds.create({ payment_intent: session.payment_intent as string })
      }
      return new Response('out of stock — refunded', { status: 200 })
    }

    // ─── Insert line items with snapshots ──────────────────────────────
    const lineRows = cart.map(item => {
      const product = products[item.product_id]
      const variant = variants[item.variant_id]
      return {
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        mandator_id: order.mandator_id,
        product_title_snapshot: product?.title ?? 'Unknown product',
        size_snapshot: variant?.size ?? '',
        unit_price_cents: product?.price_cents ?? 0,
        quantity: item.quantity,
        currency: product?.currency ?? 'chf',
      }
    })
    await supabase.from('product_order_items').insert(lineRows)

    // ─── Mark paid ─────────────────────────────────────────────────────
    await supabase
      .from('product_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent as string | null,
      })
      .eq('id', order.id)

    // ─── Send confirmation email ───────────────────────────────────────
    // Best-effort: a failed send is logged inside the helper but must not fail
    // the webhook (that would trigger a Stripe retry and re-process the order).
    const shopUrl = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'https://eclipseboundaries.ch'
    await sendOrderConfirmationEmail(supabase, order.id, shopUrl)

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Webshop webhook error:', e)
    return new Response('Webhook handler error', { status: 500 })
  }
})
