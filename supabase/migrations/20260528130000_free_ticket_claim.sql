-- ─────────────────────────────────────────────────────────────────────────────
-- Free-ticket claim flow.
--
-- Adds:
--   1. An anon SELECT policy on `tickets` so the public claim page can
--      resolve a qr_token. The policy only matches unclaimed tickets that
--      belong to a free, active phase — the row falls out the moment the
--      claim commits, so a third party who later picks up the paper cannot
--      fish for buyer PII.
--   2. The claim_free_ticket() RPC. Runs inside a single transaction with a
--      FOR UPDATE row lock on the ticket so two concurrent submissions for
--      the same qr_token produce exactly one order. Returns the created
--      order_id (+ ticket_id and event_id) on success; raises
--      ticket_not_found / ticket_already_claimed / ticket_not_claimable /
--      claims_paused for the four failure modes the public site maps to UI
--      states.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Public can read unclaimed free tickets"
    ON public.tickets FOR SELECT TO anon
    USING (
        status = 'unclaimed'
        AND EXISTS (
            SELECT 1 FROM public.ticket_phases p
            WHERE p.id = tickets.phase_id
              AND p.is_free = true
              AND p.is_active = true
        )
    );

CREATE OR REPLACE FUNCTION public.claim_free_ticket(
    p_qr_token        UUID,
    p_buyer_name      TEXT,
    p_buyer_email     TEXT,
    p_buyer_birthdate DATE,
    p_buyer_country   TEXT,
    p_buyer_zipcode   TEXT,
    p_buyer_city      TEXT
)
RETURNS TABLE (
    ticket_id UUID,
    order_id  UUID,
    event_id  UUID
) AS $$
DECLARE
    v_ticket   public.tickets%ROWTYPE;
    v_phase    public.ticket_phases%ROWTYPE;
    v_order_id UUID;
BEGIN
    SELECT * INTO v_ticket
    FROM public.tickets
    WHERE qr_token = p_qr_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_ticket.status <> 'unclaimed' THEN
        RAISE EXCEPTION 'ticket_already_claimed' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_phase
    FROM public.ticket_phases
    WHERE id = v_ticket.phase_id;

    IF NOT FOUND OR v_phase.is_free IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'ticket_not_claimable' USING ERRCODE = 'P0001';
    END IF;

    IF v_phase.is_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'claims_paused' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.ticket_orders (
        mandator_id, event_id,
        buyer_name, buyer_email, buyer_birthdate, buyer_country, buyer_zipcode, buyer_city,
        status, total_cents, currency, paid_at
    )
    VALUES (
        v_ticket.mandator_id, v_ticket.event_id,
        p_buyer_name, p_buyer_email, p_buyer_birthdate, p_buyer_country, p_buyer_zipcode, p_buyer_city,
        'paid', 0, 'chf', NOW()
    )
    RETURNING id INTO v_order_id;

    UPDATE public.tickets
       SET order_id = v_order_id,
           status   = 'valid'
     WHERE id = v_ticket.id;

    RETURN QUERY SELECT v_ticket.id, v_order_id, v_ticket.event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.claim_free_ticket FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_ticket TO service_role;
