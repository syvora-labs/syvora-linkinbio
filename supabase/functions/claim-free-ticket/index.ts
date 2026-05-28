import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendConfirmationEmail } from '../_shared/send-confirmation-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Stable strings the public site maps to UI states.
type ClaimError =
  | 'ticket_not_found'
  | 'ticket_already_claimed'
  | 'ticket_not_claimable'
  | 'claims_paused'
  | 'invalid_input'
  | 'internal_error'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fail(code: ClaimError, status = 400) {
  return json({ error: code }, status)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      qr_token,
      buyer_name,
      buyer_email,
      buyer_birthdate,
      buyer_country,
      buyer_zipcode,
      buyer_city,
    } = await req.json()

    const token = typeof qr_token === 'string' ? qr_token.trim() : ''
    const name = typeof buyer_name === 'string' ? buyer_name.trim() : ''
    const email = typeof buyer_email === 'string' ? buyer_email.trim().toLowerCase() : ''
    const birthdate = typeof buyer_birthdate === 'string' ? buyer_birthdate.trim() : ''
    const country = typeof buyer_country === 'string' ? buyer_country.trim() : ''
    const zipcode = typeof buyer_zipcode === 'string' ? buyer_zipcode.trim() : ''
    const city = typeof buyer_city === 'string' ? buyer_city.trim() : ''

    if (
      !UUID_RE.test(token)
      || !name
      || !EMAIL_RE.test(email)
      || !ISO_DATE_RE.test(birthdate)
      || !country
      || !zipcode
      || !city
    ) {
      return fail('invalid_input')
    }

    // Reject obviously bogus birthdates (out-of-range or future).
    const bd = new Date(birthdate)
    const now = new Date()
    if (
      isNaN(bd.getTime())
      || bd.getUTCFullYear() < 1900
      || bd.getTime() > now.getTime()
    ) {
      return fail('invalid_input')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await supabase.rpc('claim_free_ticket', {
      p_qr_token: token,
      p_buyer_name: name,
      p_buyer_email: email,
      p_buyer_birthdate: birthdate,
      p_buyer_country: country,
      p_buyer_zipcode: zipcode,
      p_buyer_city: city,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('ticket_already_claimed')) return fail('ticket_already_claimed', 409)
      if (msg.includes('ticket_not_found')) return fail('ticket_not_found', 404)
      if (msg.includes('ticket_not_claimable')) return fail('ticket_not_claimable', 404)
      if (msg.includes('claims_paused')) return fail('claims_paused', 409)
      // Log only the token prefix; never log full tokens at INFO.
      console.error('claim_free_ticket RPC error:', token.substring(0, 8), error)
      return fail('internal_error', 500)
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.order_id) {
      console.error('claim_free_ticket returned no row for token prefix:', token.substring(0, 8))
      return fail('internal_error', 500)
    }

    // Send the confirmation email. Failure here MUST NOT fail the claim —
    // the ticket is already valid, and the paper QR still scans at the door.
    const origin = req.headers.get('origin')
      || Deno.env.get('SITE_URL')
      || 'https://eclipseboundaries.ch'

    try {
      await sendConfirmationEmail(supabase, row.order_id, origin)
    } catch (e) {
      console.error('Confirmation email failed for order', row.order_id, e)
    }

    return json({
      order_id: row.order_id,
      ticket_id: row.ticket_id,
      event_id: row.event_id,
    })
  } catch (e) {
    console.error('Claim handler error:', e)
    return fail('internal_error', 500)
  }
})
