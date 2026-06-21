import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Flat shipping rates by destination zone, in cents. This is the authoritative
// charge AND the allow-list of destinations we ship to — it MUST stay in sync
// with src/lib/shop/shipping.ts, which only *displays* the same figures on the
// cart page.
const CH_RATE_CENTS = 700
const EU_RATE_CENTS = 1500
const SHIPPING_RATE_BY_COUNTRY: Record<string, number> = {
  CH: CH_RATE_CENTS,
  DE: EU_RATE_CENTS,
  AT: EU_RATE_CENTS,
  FR: EU_RATE_CENTS,
  IT: EU_RATE_CENTS,
}

type CartItem = { product_id: string; variant_id: string; quantity: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { mandator_id, buyer, shipping_address, items, agb_accepted_at, success_url, cancel_url } = await req.json()

    if (!mandator_id || !buyer?.name || !buyer?.email || !Array.isArray(items) || items.length === 0) {
      return json({ error: 'Missing required fields' }, 400)
    }
    if (!shipping_address?.line1 || !shipping_address?.postal_code || !shipping_address?.city || !shipping_address?.country) {
      return json({ error: 'A complete shipping address is required.' }, 400)
    }

    // AGB acceptance is mandatory and must be recent (within the last hour) to
    // prevent a stale tab from replaying an old timestamp.
    const acceptedAt = typeof agb_accepted_at === 'string' ? new Date(agb_accepted_at) : null
    if (
      !acceptedAt || isNaN(acceptedAt.getTime())
      || Date.now() - acceptedAt.getTime() > 60 * 60 * 1000
      || acceptedAt.getTime() > Date.now() + 60 * 1000
    ) {
      return json({ error: 'Please confirm that you accept the AGB and the Datenschutzerklärung.' }, 400)
    }

    const cart = items as CartItem[]
    if (cart.some(i => !i.product_id || !i.variant_id || !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      return json({ error: 'Invalid cart.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Look up the mandator's Stripe key.
    const { data: mandator, error: mandatorError } = await supabase
      .from('mandators')
      .select('stripe_secret_key')
      .eq('id', mandator_id)
      .single()

    if (mandatorError || !mandator?.stripe_secret_key) {
      return json({ error: 'Payment is not configured for this shop.' }, 400)
    }

    const stripe = new Stripe(mandator.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Re-validate prices, publish state and stock server-side — never trust the
    // browser. All rows are scoped to this mandator.
    const variantIds = cart.map(i => i.variant_id)
    const productIds = [...new Set(cart.map(i => i.product_id))]

    const [variantsRes, productsRes] = await Promise.all([
      supabase
        .from('product_variants')
        .select('id, product_id, size, stock, is_active')
        .eq('mandator_id', mandator_id)
        .in('id', variantIds),
      supabase
        .from('products')
        .select('id, title, price_cents, currency, is_published, shipping_fee_cents')
        .eq('mandator_id', mandator_id)
        .in('id', productIds),
    ])

    const variants = variantsRes.data ?? []
    const products = Object.fromEntries((productsRes.data ?? []).map(p => [p.id, p]))

    // Flat zone shipping rate for the destination. A per-product custom fee
    // (products.shipping_fee_cents) overrides this for that product.
    const zoneShippingCents = SHIPPING_RATE_BY_COUNTRY[shipping_address.country]

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let totalCents = 0
    let currency = 'chf'
    // The order is one shipment, so we charge the single highest applicable
    // shipping fee across its items (custom fee if set, else the zone rate).
    let shippingCents: number | null = null

    for (const item of cart) {
      const variant = variants.find(v => v.id === item.variant_id && v.product_id === item.product_id)
      const product = products[item.product_id]

      if (!variant || !product || !product.is_published || !variant.is_active) {
        return json({ error: 'An item in your cart is no longer available.' }, 400)
      }
      // null stock = unlimited / made-to-order; only finite stock is checked.
      if (variant.stock !== null && variant.stock < item.quantity) {
        return json({ error: `Insufficient stock for ${product.title} (${variant.size}).` }, 400)
      }

      // A custom per-product fee applies regardless of zone; otherwise the
      // item falls back to the zone rate. If neither exists we don't ship it.
      const itemShipping = product.shipping_fee_cents != null
        ? product.shipping_fee_cents
        : zoneShippingCents
      if (itemShipping === undefined) {
        return json({ error: 'We do not ship to the selected country.' }, 400)
      }
      if (shippingCents === null || itemShipping > shippingCents) {
        shippingCents = itemShipping
      }

      totalCents += product.price_cents * item.quantity
      currency = product.currency

      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: product.currency,
          unit_amount: product.price_cents,
          // No VAT is charged (turnover below the CHF 100k registration
          // threshold), so the price is simply the final amount.
          product_data: {
            name: `${product.title} — ${variant.size}`,
            metadata: { product_id: product.id, variant_id: variant.id },
          },
        },
      })
    }

    // Add shipping as its own line item. The figure is computed server-side
    // (custom per-product fees override the zone rate) — the browser's figure
    // is never trusted. shippingCents is non-null here because the cart is
    // guaranteed non-empty and every item resolved a fee in the loop above.
    if (shippingCents === null) {
      return json({ error: 'We do not ship to the selected country.' }, 400)
    }
    totalCents += shippingCents
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: shippingCents,
        product_data: { name: 'Shipping' },
      },
    })

    // Create the pending order so we have a stable id for Stripe metadata.
    const { data: order, error: orderError } = await supabase
      .from('product_orders')
      .insert({
        mandator_id,
        buyer_name: buyer.name,
        buyer_email: buyer.email,
        shipping_address,
        agb_accepted_at: acceptedAt.toISOString(),
        status: 'pending',
        total_cents: totalCents,
        currency,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      return json({ error: 'Failed to create order.' }, 500)
    }

    // The webhook reads order_id + cart from metadata to insert line items and
    // decrement stock without trusting client input. Stripe caps each metadata
    // value at 500 chars — a compact cart (id+id+qty) keeps ~10 items in range.
    const cartMeta = JSON.stringify(cart)
    if (cartMeta.length > 500) {
      await supabase.from('product_orders').delete().eq('id', order.id)
      return json({ error: 'Your cart is too large. Please reduce the number of items.' }, 400)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: buyer.email,
      line_items: lineItems,
      success_url,
      cancel_url,
      metadata: {
        order_id: order.id,
        mandator_id,
        cart: cartMeta,
      },
      // We collect the shipping address ourselves (it's the basis for the
      // shipping charge and is stored on the order), so we don't ask Stripe to
      // collect it again — that would risk a country mismatch with what we
      // already charged for shipping.
    })

    await supabase
      .from('product_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id)

    return json({ checkout_url: session.url })
  } catch (e) {
    console.error('Webshop checkout error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
