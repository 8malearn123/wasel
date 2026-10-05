-- =============================================================================
-- Wholesale · PRO buys, MAX supplies — enforced on the server
--
-- Until now the whole wholesale area sat behind one plan flag in the UI, and
-- the database had no plan check at all: any merchant who called the REST API
-- directly could insert a wholesale_listing and start supplying, whatever they
-- were paying for. Hiding the page was the only control.
--
-- This splits the two capabilities and puts the supply half behind the plan,
-- in the database:
--
--   BUY     — place a wholesale order, see the marketplace. Any subscriber.
--   SUPPLY  — list stock, accept incoming orders, hold credit against a buyer.
--             Requires plans.has_wholesale on the merchant's current plan.
--
-- ⚠️ READ THIS BEFORE APPLYING
-- The wholesale_listings and wholesale_orders tables were created outside this
-- repository, so their existing policies are not in version control and their
-- names are unknown here. PostgreSQL ORs policies together: a permissive
-- policy left in place would make everything below decorative. So the DO block
-- drops the existing INSERT/ALL policies on those two tables by introspection
-- and rebuilds them.
--
-- It does NOT touch SELECT policies, so nothing becomes invisible, and it
-- deletes no data. If you have customised a write policy there, note its
-- definition first:
--     SELECT policyname, cmd, qual, with_check FROM pg_policies
--      WHERE tablename IN ('wholesale_listings','wholesale_orders');
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · May this merchant supply?
-- ---------------------------------------------------------------------------
-- Reads the plans row, so adding a plan that supplies is a column edit rather
-- than a code change. A merchant with no subscription, an expired one, or a
-- plan row that cannot be found gets false — the safe answer.
CREATE OR REPLACE FUNCTION public.can_supply_wholesale()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.merchant_id = public.get_user_merchant_id()
      AND s.status IN ('trial', 'active')
      AND p.has_wholesale = true
  )
$$;

REVOKE ALL ON FUNCTION public.can_supply_wholesale() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_supply_wholesale() TO authenticated;

-- Buying needs a live subscription and nothing more.
CREATE OR REPLACE FUNCTION public.can_buy_wholesale()
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
  )
$$;

REVOKE ALL ON FUNCTION public.can_buy_wholesale() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_buy_wholesale() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2 · Clear the write policies we cannot see, then rebuild them
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('wholesale_listings', 'wholesale_orders')
       -- 'w' = INSERT, 'a' = ALL, 'u' = UPDATE, 'd' = DELETE; SELECT ('r') is left alone
       AND cmd <> 'SELECT'
  LOOP
    RAISE NOTICE 'dropping write policy % on %', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3 · Listings — only a supplying plan may create or change them
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supplying merchants create listings" ON public.wholesale_listings;
CREATE POLICY "Supplying merchants create listings"
  ON public.wholesale_listings FOR INSERT TO authenticated
  WITH CHECK (merchant_id = public.get_user_merchant_id()
              AND public.can_supply_wholesale());

DROP POLICY IF EXISTS "Supplying merchants update their listings" ON public.wholesale_listings;
CREATE POLICY "Supplying merchants update their listings"
  ON public.wholesale_listings FOR UPDATE TO authenticated
  USING (merchant_id = public.get_user_merchant_id()
         AND public.can_supply_wholesale())
  WITH CHECK (merchant_id = public.get_user_merchant_id()
         AND public.can_supply_wholesale());

-- Deleting is allowed without the plan check: a merchant whose plan was
-- downgraded must still be able to withdraw stock they already listed.
DROP POLICY IF EXISTS "Merchants delete their listings" ON public.wholesale_listings;
CREATE POLICY "Merchants delete their listings"
  ON public.wholesale_listings FOR DELETE TO authenticated
  USING (merchant_id = public.get_user_merchant_id());

-- The policy dropped above was FOR ALL, so it was also what let a merchant see
-- their own listings. The surviving marketplace policy only shows ACTIVE ones,
-- which would hide a merchant's own hidden stock from them. This restores it.
DROP POLICY IF EXISTS "Merchants read their own listings" ON public.wholesale_listings;
CREATE POLICY "Merchants read their own listings"
  ON public.wholesale_listings FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id());

-- ---------------------------------------------------------------------------
-- 4 · Orders — the buyer places them, the supplier moves them along
-- ---------------------------------------------------------------------------
-- Both sides of a deal read it. Without this the FOR ALL policy dropped above
-- would take SELECT with it, and the orders screens would come back empty —
-- and an UPDATE with a WHERE clause would match nothing either.
DROP POLICY IF EXISTS "Both parties read their orders" ON public.wholesale_orders;
CREATE POLICY "Both parties read their orders"
  ON public.wholesale_orders FOR SELECT TO authenticated
  USING (supplier_merchant_id = public.get_user_merchant_id()
         OR buyer_merchant_id = public.get_user_merchant_id());

DROP POLICY IF EXISTS "Buyers place wholesale orders" ON public.wholesale_orders;
CREATE POLICY "Buyers place wholesale orders"
  ON public.wholesale_orders FOR INSERT TO authenticated
  WITH CHECK (buyer_merchant_id = public.get_user_merchant_id()
              AND public.can_buy_wholesale()
              -- and never to yourself
              AND supplier_merchant_id <> public.get_user_merchant_id());

-- Advancing an order (approve, ship, deliver) is the supplier's side of the
-- deal, so it needs the supplying plan.
DROP POLICY IF EXISTS "Suppliers advance their orders" ON public.wholesale_orders;
CREATE POLICY "Suppliers advance their orders"
  ON public.wholesale_orders FOR UPDATE TO authenticated
  USING (supplier_merchant_id = public.get_user_merchant_id()
         AND public.can_supply_wholesale())
  WITH CHECK (supplier_merchant_id = public.get_user_merchant_id()
         AND public.can_supply_wholesale());

-- A buyer may cancel their own order while it is still pending.
DROP POLICY IF EXISTS "Buyers cancel their pending orders" ON public.wholesale_orders;
CREATE POLICY "Buyers cancel their pending orders"
  ON public.wholesale_orders FOR UPDATE TO authenticated
  USING (buyer_merchant_id = public.get_user_merchant_id() AND status = 'pending')
  WITH CHECK (buyer_merchant_id = public.get_user_merchant_id());

-- ---------------------------------------------------------------------------
-- 5 · Credit is extended by the supplier, so it follows the same rule
-- ---------------------------------------------------------------------------
-- 20261004090100_rls_hardening.sql already removed the buyer's write and
-- pinned the supplier's WITH CHECK. This adds the plan test on top.
DROP POLICY IF EXISTS "Suppliers can manage credit" ON public.wholesale_credit_transactions;
CREATE POLICY "Suppliers can manage credit"
  ON public.wholesale_credit_transactions FOR ALL TO authenticated
  USING (supplier_merchant_id = public.get_user_merchant_id())
  WITH CHECK (supplier_merchant_id = public.get_user_merchant_id()
              AND public.can_supply_wholesale());

CREATE INDEX IF NOT EXISTS wholesale_listings_merchant_idx
  ON public.wholesale_listings (merchant_id, is_active);
