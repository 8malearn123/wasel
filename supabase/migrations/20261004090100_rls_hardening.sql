-- =============================================================================
-- Phase 0 · Security — RLS holes found while reviewing the multi-tenant policies
--
-- Reviewed: merchants, merchant_users, subscriptions, sales, sale_items,
-- devices, accessories, repair_parts, customers, online_orders,
-- online_order_items, wholesale_* . Tenant scoping via get_user_merchant_id()
-- was correct almost everywhere; the three cases below were not, and only
-- those are changed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · A buyer could write off their own debt
--
-- "Buyers can update their credit" was FOR UPDATE USING (buyer_merchant_id =
-- get_user_merchant_id()) with no WITH CHECK. The merchant who OWES the money
-- could set paid_amount, remaining_amount and status on their own row — mark a
-- debt paid without paying it — and, with no WITH CHECK, could also move the
-- row onto another merchant by rewriting buyer_merchant_id.
--
-- Collecting a payment is the supplier's action, and the UI only ever offers it
-- to the supplier ("تحصيل" appears on مديونيات لي), so dropping the buyer's
-- write changes no screen. The buyer keeps full read access.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Buyers can update their credit" ON public.wholesale_credit_transactions;

-- "Buyers can view their credit" (SELECT) and "Suppliers can manage credit"
-- (ALL) stay exactly as they were.

-- Stop the supplier moving a row to a different pair of merchants mid-update.
DROP POLICY IF EXISTS "Suppliers can manage credit" ON public.wholesale_credit_transactions;
CREATE POLICY "Suppliers can manage credit"
  ON public.wholesale_credit_transactions FOR ALL TO authenticated
  USING (supplier_merchant_id = public.get_user_merchant_id())
  WITH CHECK (supplier_merchant_id = public.get_user_merchant_id());

-- ---------------------------------------------------------------------------
-- 2 · Anyone could attach items to anyone's order
--
-- "Anyone can create order items" was WITH CHECK (true): an anonymous visitor
-- could insert rows pointing at ANY order id, including another merchant's, and
-- so alter what that merchant believes was ordered.
--
-- The replacement keeps public checkout working — it just requires the order to
-- exist and to belong to a published store.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can create order items" ON public.online_order_items;
CREATE POLICY "Anyone can create order items"
  ON public.online_order_items FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.online_orders o
    JOIN public.store_settings ss ON ss.merchant_id = o.merchant_id
    WHERE o.id = online_order_items.order_id
      AND ss.is_published = true
  ));

DROP POLICY IF EXISTS "Authenticated can create order items" ON public.online_order_items;
CREATE POLICY "Authenticated can create order items"
  ON public.online_order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.online_orders o
    JOIN public.store_settings ss ON ss.merchant_id = o.merchant_id
    WHERE o.id = online_order_items.order_id
      AND ss.is_published = true
  ));

-- ---------------------------------------------------------------------------
-- 3 · Purchase cost was readable by the public
--
-- Published stores need anonymous visitors to read their products, and RLS is
-- row-level: "Public view store devices" let anon SELECT the whole row,
-- cost and supplier included. Anyone could read a shop's margins with one
-- request.
--
-- The storefront reads the public_store_devices / public_store_accessories
-- views, which never select these columns, so removing the column privilege
-- closes the leak without touching the row policies or the storefront.
-- ---------------------------------------------------------------------------
-- Column privileges are additive in Postgres: while a role holds table-wide
-- SELECT, "REVOKE SELECT (cost)" changes nothing. The table grant has to go
-- first, and the allowed columns are then granted back by name — exactly the
-- columns the two storefront views read, no more.
REVOKE SELECT ON public.devices FROM anon;
GRANT SELECT (
  id, merchant_id, branch_id, model, brand, color, storage,
  condition, price, status, notes, created_at
) ON public.devices TO anon;

REVOKE SELECT ON public.accessories FROM anon;
GRANT SELECT (
  id, merchant_id, branch_id, sku, name, category, brand,
  price, quantity, min_quantity, created_at
) ON public.accessories TO anon;

-- ---------------------------------------------------------------------------
-- 4 · Reference helper, not yet wired in
--
-- Locking an expired merchant out of writing is currently decided in the
-- browser. Enforcing it in the database means adding this check to the write
-- policies of every transactional table, which is a change big enough to
-- deserve its own migration and its own test pass, so the helper is defined
-- here and applied in a later phase.
--
--   e.g. ALTER POLICY "Users can manage sales" ON public.sales
--        USING (merchant_id = public.get_user_merchant_id())
--        WITH CHECK (merchant_id = public.get_user_merchant_id()
--                    AND public.merchant_subscription_active());
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merchant_subscription_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.merchant_id = public.get_user_merchant_id()
      AND s.status IN ('trial', 'active')
      AND COALESCE(
            CASE WHEN s.status = 'trial' THEN s.trial_ends_at ELSE s.subscription_ends_at END,
            now() + interval '100 years'
          ) > now()
  )
$$;

REVOKE ALL ON FUNCTION public.merchant_subscription_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_subscription_active() TO authenticated;
