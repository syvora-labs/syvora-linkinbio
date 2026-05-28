import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ResolveState = 'ready' | 'claims_paused' | 'not_recognised'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { qr_token } = await req.json()
    const token = typeof qr_token === 'string' ? qr_token.trim().toLowerCase() : ''

    if (!UUID_RE.test(token)) {
      return json({ state: 'not_recognised' satisfies ResolveState })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, status, phase_id, event_id')
      .eq('qr_token', token)
      .maybeSingle()

    if (ticketError) {
      console.error('Ticket lookup error:', ticketError)
      return json({ error: 'internal_error' }, 500)
    }

    if (!ticket || ticket.status !== 'unclaimed') {
      return json({ state: 'not_recognised' satisfies ResolveState })
    }

    const { data: phase } = await supabase
      .from('ticket_phases')
      .select('name, is_free, is_active')
      .eq('id', ticket.phase_id)
      .maybeSingle()

    if (!phase || phase.is_free !== true) {
      return json({ state: 'not_recognised' satisfies ResolveState })
    }

    const { data: event } = await supabase
      .from('events')
      .select('title, location, event_date')
      .eq('id', ticket.event_id)
      .maybeSingle()

    if (!event) {
      return json({ state: 'not_recognised' satisfies ResolveState })
    }

    if (phase.is_active !== true) {
      return json({
        state: 'claims_paused' satisfies ResolveState,
        ticket: {
          phase_name: phase.name,
          event_title: event.title,
          event_location: event.location,
          event_date: event.event_date,
        },
      })
    }

    return json({
      state: 'ready' satisfies ResolveState,
      ticket: {
        phase_name: phase.name,
        event_title: event.title,
        event_location: event.location,
        event_date: event.event_date,
      },
    })
  } catch (e) {
    console.error('Resolve handler error:', e)
    return json({ error: 'internal_error' }, 500)
  }
})
