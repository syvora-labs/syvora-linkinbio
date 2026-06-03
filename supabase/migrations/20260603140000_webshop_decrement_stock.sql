-- Atomically decrement variant stock for a paid webshop order.
--
-- product_variants.stock has CHECK (stock IS NULL OR stock >= 0). A naive
-- `UPDATE ... SET stock = stock - N` trips the check under contention when two
-- webhooks race for the last unit. This locks each involved row with
-- SELECT ... FOR UPDATE (in deterministic id order to avoid deadlocks),
-- skips NULL (unlimited / made-to-order) stock, and raises a typed error on
-- insufficient stock so the webhook handler can refund and bail.

CREATE OR REPLACE FUNCTION public.webshop_decrement_stock_for_order(
    p_decrements JSONB  -- [{"variant_id": "...", "qty": 2}, ...]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    decrement RECORD;
    current_stock INTEGER;
BEGIN
    FOR decrement IN
        SELECT
            (elem->>'variant_id')::UUID AS variant_id,
            (elem->>'qty')::INTEGER AS qty
        FROM jsonb_array_elements(p_decrements) AS elem
        ORDER BY (elem->>'variant_id')::UUID
    LOOP
        SELECT stock INTO current_stock
        FROM public.product_variants
        WHERE id = decrement.variant_id
        FOR UPDATE;

        -- NULL stock = unlimited / made-to-order, no decrement needed.
        IF current_stock IS NULL THEN
            CONTINUE;
        END IF;

        IF current_stock < decrement.qty THEN
            RAISE EXCEPTION 'Insufficient stock for variant %', decrement.variant_id
                USING ERRCODE = 'check_violation';
        END IF;

        UPDATE public.product_variants
        SET stock = current_stock - decrement.qty
        WHERE id = decrement.variant_id;
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.webshop_decrement_stock_for_order(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.webshop_decrement_stock_for_order(JSONB) TO service_role;
