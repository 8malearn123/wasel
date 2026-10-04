-- =============================================================================
-- Phase 1 · Permission-gated writes on the product tables
--
-- A NOTE ON WHAT IS **NOT** GATED HERE, AND WHY
-- --------------------------------------------
-- Selling a phone is an UPDATE of devices.status, and a cashier must be able to
-- do it. RLS cannot restrict an UPDATE to particular columns, so gating UPDATE
-- on products.update would stop the till taking money — the one thing the
-- system exists to do.
--
-- So INSERT and DELETE are gated (neither happens during a sale) and UPDATE
-- keeps the merchant-scoped policy it has today. Closing that last gap means
-- moving the sale's stock write into a SECURITY DEFINER function so the
-- cashier never needs direct UPDATE at all; that is a change to the selling
-- path and belongs with the phase that touches it, not here.
-- =============================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['devices', 'accessories', 'repair_parts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Create %s with permission" ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY "Create %s with permission"
        ON public.%I FOR INSERT TO authenticated
        WITH CHECK (merchant_id = public.get_user_merchant_id()
                    AND public.has_permission('products.create'))
    $p$, t, t);

    EXECUTE format('DROP POLICY IF EXISTS "Delete %s with permission" ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY "Delete %s with permission"
        ON public.%I FOR DELETE TO authenticated
        USING (merchant_id = public.get_user_merchant_id()
               AND public.has_permission('products.delete'))
    $p$, t, t);
  END LOOP;
END $$;

-- The existing "Users can manage ..." policies are FOR ALL, and policies are
-- OR-ed: leaving them in place would make the two above decorative. They are
-- replaced by SELECT + UPDATE policies carrying exactly what they carried
-- before, so reading and selling are untouched and only INSERT and DELETE
-- narrow.
DROP POLICY IF EXISTS "Users can manage devices" ON public.devices;
DROP POLICY IF EXISTS "Users can read devices" ON public.devices;
CREATE POLICY "Users can read devices"
  ON public.devices FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id());
DROP POLICY IF EXISTS "Users can update devices" ON public.devices;
CREATE POLICY "Users can update devices"
  ON public.devices FOR UPDATE TO authenticated
  USING (merchant_id = public.get_user_merchant_id())
  WITH CHECK (merchant_id = public.get_user_merchant_id());

DROP POLICY IF EXISTS "Users can manage accessories" ON public.accessories;
DROP POLICY IF EXISTS "Users can read accessories" ON public.accessories;
CREATE POLICY "Users can read accessories"
  ON public.accessories FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id());
DROP POLICY IF EXISTS "Users can update accessories" ON public.accessories;
CREATE POLICY "Users can update accessories"
  ON public.accessories FOR UPDATE TO authenticated
  USING (merchant_id = public.get_user_merchant_id())
  WITH CHECK (merchant_id = public.get_user_merchant_id());

DROP POLICY IF EXISTS "Users can manage repair parts" ON public.repair_parts;
DROP POLICY IF EXISTS "Users can read repair parts" ON public.repair_parts;
CREATE POLICY "Users can read repair parts"
  ON public.repair_parts FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id());
DROP POLICY IF EXISTS "Users can update repair parts" ON public.repair_parts;
CREATE POLICY "Users can update repair parts"
  ON public.repair_parts FOR UPDATE TO authenticated
  USING (merchant_id = public.get_user_merchant_id())
  WITH CHECK (merchant_id = public.get_user_merchant_id());
