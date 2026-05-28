ALTER TABLE ticket_orders
  ADD COLUMN agb_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN ticket_orders.agb_accepted_at IS
  'Timestamp when the buyer accepted the AGB at checkout. NULL for orders created before this feature shipped.';
