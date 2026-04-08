import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      event_id, items, buyer_name, buyer_email,
      buyer_birthdate, buyer_country, buyer_zipcode, buyer_city,
      service_fee_cents, success_url, cancel_url,
    } = await req.json()

    if (!event_id || !items?.length || !buyer_name || !buyer_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch the event to get the mandator_id
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, mandator_id')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch the mandator's Stripe key
    const { data: mandator, error: mandatorError } = await supabase
      .from('mandators')
      .select('stripe_secret_key')
      .eq('id', event.mandator_id)
      .single()

    if (mandatorError || !mandator?.stripe_secret_key) {
      return new Response(
        JSON.stringify({ error: 'Payment is not configured for this event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stripe = new Stripe(mandator.stripe_secret_key, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Fetch and validate each selected phase
    const phaseIds = items.map((i: { phaseId: string }) => i.phaseId)
    const { data: phases, error: phasesError } = await supabase
      .from('ticket_phases')
      .select('id, name, description, price_cents, currency, quantity, is_active')
      .in('id', phaseIds)
      .eq('event_id', event_id)
      .eq('is_active', true)

    if (phasesError || !phases?.length) {
      return new Response(
        JSON.stringify({ error: 'Invalid ticket selection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const phaseMap = new Map(phases.map(p => [p.id, p]))

    // Validate availability and calculate total
    let totalCents = 0
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    const ticketRows: { phase_id: string; quantity: number }[] = []

    for (const item of items) {
      const phase = phaseMap.get(item.phaseId)
      if (!phase) {
        return new Response(
          JSON.stringify({ error: `Ticket phase not found: ${item.phaseId}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Check availability
      const { data: soldCount } = await supabase.rpc('get_phase_sold_count', {
        p_phase_id: phase.id,
      })
      const remaining = phase.quantity - (soldCount ?? 0)

      if (item.quantity > remaining) {
        return new Response(
          JSON.stringify({ error: `Not enough tickets available for "${phase.name}". ${remaining} remaining.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      totalCents += phase.price_cents * item.quantity

      lineItems.push({
        price_data: {
          currency: phase.currency,
          product_data: {
            name: phase.name,
            ...(phase.description ? { description: phase.description } : {}),
          },
          unit_amount: phase.price_cents,
        },
        quantity: item.quantity,
      })

      ticketRows.push({ phase_id: phase.id, quantity: item.quantity })
    }

    // Calculate total ticket count for service fees
    const totalTicketCount = ticketRows.reduce((sum, r) => sum + r.quantity, 0)
    const serviceFee = (service_fee_cents ?? 150) * totalTicketCount
    totalCents += serviceFee

    // Add service fee as a line item
    if (serviceFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'chf',
          product_data: {
            name: 'Service fee',
          },
          unit_amount: service_fee_cents ?? 150,
        },
        quantity: totalTicketCount,
      })
    }

    // Create the pending order
    const { data: order, error: orderError } = await supabase
      .from('ticket_orders')
      .insert({
        mandator_id: event.mandator_id,
        event_id: event_id,
        buyer_name,
        buyer_email,
        buyer_birthdate: buyer_birthdate || null,
        buyer_country: buyer_country || null,
        buyer_zipcode: buyer_zipcode || null,
        buyer_city: buyer_city || null,
        status: 'pending',
        total_cents: totalCents,
        currency: 'chf',
      })
      .select('id')
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create individual ticket records
    const tickets = []
    for (const row of ticketRows) {
      for (let i = 0; i < row.quantity; i++) {
        tickets.push({
          order_id: order.id,
          phase_id: row.phase_id,
          event_id: event_id,
          mandator_id: event.mandator_id,
          status: 'valid',
        })
      }
    }

    const { error: ticketsError } = await supabase.from('tickets').insert(tickets)

    if (ticketsError) {
      // Clean up the order if ticket creation fails
      await supabase.from('ticket_orders').delete().eq('id', order.id)
      return new Response(
        JSON.stringify({ error: 'Failed to reserve tickets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: buyer_email,
      line_items: lineItems,
      metadata: {
        order_id: order.id,
        event_id: event_id,
        mandator_id: event.mandator_id,
        buyer_birthdate: buyer_birthdate ?? '',
        buyer_country: buyer_country ?? '',
        buyer_zipcode: buyer_zipcode ?? '',
        buyer_city: buyer_city ?? '',
      },
      success_url: `${success_url}&order_id=${order.id}`,
      cancel_url: cancel_url,
    })

    // Update order with Stripe session ID
    await supabase
      .from('ticket_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id)

    return new Response(
      JSON.stringify({ checkout_url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('Checkout error:', e)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
