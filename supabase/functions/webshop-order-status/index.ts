import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Returns the minimal order state the success page needs. Lives in an edge
// function (service role) because product_orders is not exposed to the anon
// key, and we only ever surface non-sensitive status fields here.
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
    const { session_id } = await req.json()
    if (!session_id) return json({ error: 'Missing session_id' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: order } = await supabase
      .from('product_orders')
      .select('id, status, total_cents, currency')
      .eq('stripe_checkout_session_id', session_id)
      .maybeSingle()

    if (!order) return json({ error: 'Order not found' }, 404)

    return json({
      id: order.id,
      status: order.status,
      total_cents: order.total_cents,
      currency: order.currency,
    })
  } catch (e) {
    console.error('Webshop order-status error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
