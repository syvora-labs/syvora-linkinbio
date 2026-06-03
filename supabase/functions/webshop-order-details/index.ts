import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Returns full order details for the order-details page, looked up by the
// (unguessable) order UUID. product_orders / product_order_items are not
// exposed to the anon key, so this runs with the service role and returns only
// buyer-safe fields (no mandator_id, no Stripe ids, no internal admin notes).
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
    const { order_id } = await req.json()
    if (!order_id) return json({ error: 'Missing order_id' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: order } = await supabase
      .from('product_orders')
      .select('id, mandator_id, buyer_email, status, total_cents, currency, tracking_number')
      .eq('id', order_id)
      .maybeSingle()

    if (!order) return json({ error: 'Order not found' }, 404)

    const { data: items } = await supabase
      .from('product_order_items')
      .select('product_id, product_title_snapshot, size_snapshot, unit_price_cents, quantity, currency')
      .eq('order_id', order_id)

    const lineItems = items ?? []

    // Attach each product's primary image id (lowest sort_order). We return the
    // id, not a signed URL — the page resolves it in the browser via the same
    // path the storefront uses, which avoids a server-to-server signing call.
    const productIds = [...new Set(lineItems.map(i => i.product_id).filter(Boolean))] as string[]
    const primaryImageByProduct: Record<string, string> = {}
    if (productIds.length) {
      const { data: imgs } = await supabase
        .from('product_images')
        .select('id, product_id, sort_order')
        .eq('mandator_id', order.mandator_id)
        .in('product_id', productIds)
        .order('sort_order', { ascending: true })
      for (const img of (imgs ?? []) as { id: string; product_id: string }[]) {
        if (!(img.product_id in primaryImageByProduct)) primaryImageByProduct[img.product_id] = img.id
      }
    }

    return json({
      order: {
        id: order.id,
        buyer_email: order.buyer_email,
        status: order.status,
        total_cents: order.total_cents,
        currency: order.currency,
        tracking_number: order.tracking_number,
        items: lineItems.map(i => ({
          product_title: i.product_title_snapshot,
          size: i.size_snapshot,
          quantity: i.quantity,
          unit_price_cents: i.unit_price_cents,
          currency: i.currency,
          image_id: primaryImageByProduct[i.product_id] ?? null,
        })),
      },
    })
  } catch (e) {
    console.error('Webshop order-details error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
