-- Record a confirmed payment as a customer visit.
-- Previously payment confirmation only bumped total_spent (via
-- add_customer_total_spent), so visit_count / last_visit_at were never updated.
-- That left visit_count stuck at 0, breaking retention analytics, the Canvas IA
-- "returning customers" metric, and the AI no-show risk heuristic.
--
-- Atomic single-statement update (same pattern as 022_atomic_increments.sql) to
-- avoid read-then-write races.
CREATE OR REPLACE FUNCTION add_customer_revenue_and_visit(p_customer_id uuid, p_amount bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE customers
  SET total_spent  = COALESCE(total_spent, 0) + p_amount,
      visit_count  = COALESCE(visit_count, 0) + 1,
      last_visit_at = now()
  WHERE id = p_customer_id;
$$;
