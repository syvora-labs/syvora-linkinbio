import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, session_id } = await req.json()

    if (!order_id && !session_id) {
      return new Response(
        JSON.stringify({ error: 'order_id or session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch the order by ID or Stripe session ID
    let query = supabase
      .from('ticket_orders')
      .select('id, buyer_name, buyer_email, status, total_cents, currency, created_at, event_id')

    if (order_id) {
      query = query.eq('id', order_id)
    } else {
      query = query.eq('stripe_checkout_session_id', session_id)
    }

    const { data: order, error: orderError } = await query.single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Only show tickets for paid orders
    if (order.status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'Order is not confirmed', status: order.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch event details
    const { data: event } = await supabase
      .from('events')
      .select('title, artwork_url, location, event_date')
      .eq('id', order.event_id)
      .single()

    // Fetch tickets with their phase names
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, qr_token, status, checked_in_at, phase_id')
      .eq('order_id', order.id)

    // Fetch phase names for the tickets
    const phaseIds = [...new Set((tickets ?? []).map(t => t.phase_id))]
    const { data: phases } = await supabase
      .from('ticket_phases')
      .select('id, name')
      .in('id', phaseIds)

    const phaseMap = new Map((phases ?? []).map(p => [p.id, p.name]))

    const enrichedTickets = (tickets ?? []).map(t => ({
      id: t.id,
      qr_token: t.qr_token,
      status: t.status,
      checked_in_at: t.checked_in_at,
      phase_name: phaseMap.get(t.phase_id) ?? 'Ticket',
    }))

    return new Response(
      JSON.stringify({
        order: {
          id: order.id,
          buyer_name: order.buyer_name,
          status: order.status,
          total_cents: order.total_cents,
          currency: order.currency,
          created_at: order.created_at,
        },
        event,
        tickets: enrichedTickets,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('Get order tickets error:', e)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
