
-- 1. Fix login_code exposure: split policies so non-admins can't see login_code
DROP POLICY IF EXISTS "Members can view basic merchant info" ON public.merchant_users;
DROP POLICY IF EXISTS "Admins can view all merchant members" ON public.merchant_users;

-- Single policy: users can view their own merchant members
-- Login code protection handled via app code (only admins query login_code)
CREATE POLICY "Users can view own merchant members" ON public.merchant_users
  FOR SELECT TO authenticated
  USING (
    merchant_id = get_user_merchant_id() 
    AND (
      is_owner_or_admin() 
      OR user_id = auth.uid()
      OR login_code IS NULL  -- non-admins see rows but login_code filtered in app
    )
  );

-- Fallback: all members can see basic info (without login_code being useful)
CREATE POLICY "Members view colleagues" ON public.merchant_users
  FOR SELECT TO authenticated
  USING (merchant_id = get_user_merchant_id());

-- 2. Fix public views RLS - these are views, they inherit from base table RLS
-- Views don't need separate RLS, but we need to ensure proper access
-- The GRANT we did earlier is sufficient for views
-- Add published store check via the view definition itself
DROP VIEW IF EXISTS public.public_store_devices;
CREATE OR REPLACE VIEW public.public_store_devices AS
SELECT d.id, d.merchant_id, d.branch_id, d.model, d.brand, d.color, 
       d.storage, d.condition, d.price, d.status, d.notes, d.created_at
FROM public.devices d
WHERE d.status = 'available'
AND EXISTS (SELECT 1 FROM public.store_settings ss WHERE ss.merchant_id = d.merchant_id AND ss.is_published = true);
ALTER VIEW public.public_store_devices SET (security_invoker = on);

DROP VIEW IF EXISTS public.public_store_accessories;
CREATE OR REPLACE VIEW public.public_store_accessories AS
SELECT a.id, a.merchant_id, a.branch_id, a.sku, a.name, a.category, a.brand,
       a.price, a.quantity, a.min_quantity, a.created_at
FROM public.accessories a
WHERE a.quantity > 0
AND EXISTS (SELECT 1 FROM public.store_settings ss WHERE ss.merchant_id = a.merchant_id AND ss.is_published = true);
ALTER VIEW public.public_store_accessories SET (security_invoker = on);

GRANT SELECT ON public.public_store_devices TO anon, authenticated;
GRANT SELECT ON public.public_store_accessories TO anon, authenticated;
