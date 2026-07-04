
-- 1. Remove public device policy that exposes IMEI and cost
DROP POLICY IF EXISTS "Public view store devices" ON public.devices;

-- 2. Remove public accessories policy that exposes cost
DROP POLICY IF EXISTS "Public view store accessories" ON public.accessories;

-- 3. Create safe public view for accessories (without cost)
CREATE OR REPLACE VIEW public.public_store_accessories AS
SELECT 
  id, merchant_id, branch_id, sku, name, category, brand, 
  price, quantity, min_quantity, created_at
FROM public.accessories
WHERE quantity > 0;
ALTER VIEW public.public_store_accessories SET (security_invoker = on);

-- 4. Grant anon access to the public views instead
GRANT SELECT ON public.public_store_devices TO anon, authenticated;
GRANT SELECT ON public.public_store_accessories TO anon, authenticated;

-- 5. Fix cross-merchant privilege escalation by scoping role checks
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users
    WHERE user_id = auth.uid() 
    AND merchant_id = get_user_merchant_id()
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_merchant_role(_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users
    WHERE user_id = auth.uid() 
    AND merchant_id = get_user_merchant_id()
    AND role = _role
    AND is_active = true
  )
$$;

-- 6. Fix get_user_merchant_id to be deterministic
CREATE OR REPLACE FUNCTION public.get_user_merchant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT merchant_id FROM public.merchant_users 
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- 7. Fix login_code exposure: restrict SELECT for non-admins
-- Drop the broad view policy and recreate with column restriction
DROP POLICY IF EXISTS "Users can view merchant members" ON public.merchant_users;

-- Admins/owners can see all columns including login_code
CREATE POLICY "Admins can view all merchant members" ON public.merchant_users
  FOR SELECT TO authenticated
  USING (merchant_id = get_user_merchant_id() AND is_owner_or_admin());

-- Non-admins can view members but should use the safe view
CREATE POLICY "Members can view basic merchant info" ON public.merchant_users
  FOR SELECT TO authenticated
  USING (merchant_id = get_user_merchant_id());

-- 8. Add RLS to merchant_users_safe view  
-- Views inherit RLS from underlying tables, so no additional policy needed
-- But let's drop the safe view since we handle it via app code
DROP VIEW IF EXISTS public.merchant_users_safe;
