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
    const { event_id } = await req.json()

    if (!event_id) {
      return new Response(
        JSON.stringify({ error: 'event_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now = new Date().toISOString()

    // Fetch active phases for this event that are within their sale window
    const { data: phases, error } = await supabase
      .from('ticket_phases')
      .select('id, name, description, price_cents, currency, quantity, sale_start, sale_end')
      .eq('event_id', event_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch ticket phases' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Filter by sale window and enrich with sold count
    const enrichedPhases = []

    for (const phase of phases ?? []) {
      // Check sale window
      if (phase.sale_start && new Date(phase.sale_start) > new Date(now)) continue
      if (phase.sale_end && new Date(phase.sale_end) < new Date(now)) continue

      // Get sold count via the database function
      const { data: soldCount } = await supabase.rpc('get_phase_sold_count', {
        p_phase_id: phase.id,
      })

      const sold = soldCount ?? 0
      const remaining = phase.quantity - sold

      enrichedPhases.push({
        id: phase.id,
        name: phase.name,
        description: phase.description,
        price_cents: phase.price_cents,
        currency: phase.currency,
        quantity: phase.quantity,
        sold_count: sold,
        remaining,
        sale_start: phase.sale_start,
        sale_end: phase.sale_end,
      })
    }

    return new Response(
      JSON.stringify({ phases: enrichedPhases }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
