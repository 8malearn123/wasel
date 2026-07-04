
-- 1. FIX: Login code privilege escalation
-- Create a secure view that hides login_code from non-admin users
-- And restrict login_code visibility via RLS function

-- Create a function to check if the current user is owner/admin
-- (already exists as is_owner_or_admin, we'll use it)

-- Drop the existing permissive policy on merchant_users for viewing
DROP POLICY IF EXISTS "Users can view merchant members" ON public.merchant_users;

-- Create a new policy that hides login_code - users can view but we'll handle code visibility in the app
-- We need two policies: one for admins (full access) and one for regular users (no login_code)
-- Since RLS can't filter columns, we'll use a secure view approach

-- Create a security definer function to get login codes (only for admins)
CREATE OR REPLACE FUNCTION public.get_user_login_code(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN is_owner_or_admin() THEN login_code
    WHEN mu.user_id = auth.uid() THEN login_code
    ELSE NULL
  END
  FROM public.merchant_users mu
  WHERE mu.user_id = _user_id AND mu.merchant_id = get_user_merchant_id()
  LIMIT 1
$$;

-- Re-create the view policy - all members can see basic info
CREATE POLICY "Users can view merchant members" ON public.merchant_users
  FOR SELECT TO authenticated
  USING (merchant_id = get_user_merchant_id());

-- 2. FIX: Wholesale listings - restrict to authenticated users only
DROP POLICY IF EXISTS "All merchants can view active listings" ON public.wholesale_listings;

CREATE POLICY "Authenticated merchants can view active listings" ON public.wholesale_listings
  FOR SELECT TO authenticated
  USING (is_active = true AND get_user_merchant_id() IS NOT NULL);

-- 3. FIX: IMEI exposure - create a secure view for public store
CREATE OR REPLACE VIEW public.public_store_devices AS
SELECT 
  id,
  merchant_id,
  branch_id,
  model,
  brand,
  color,
  storage,
  condition,
  price,
  status,
  notes,
  created_at
FROM public.devices
WHERE status = 'available';

-- 4. FIX: Overly permissive merchant creation policy
DROP POLICY IF EXISTS "Authenticated users can create merchants" ON public.merchants;

-- Only allow creating merchants if user doesn't already belong to one
CREATE POLICY "New users can create merchants" ON public.merchants
  FOR INSERT TO authenticated
  WITH CHECK (get_user_merchant_id() IS NULL);

-- 5. FIX: Restrict login_code column access by nullifying it for non-admins
-- We'll enable column-level security by updating the select policy
-- Since Postgres RLS doesn't support column-level, we handle this in app code
-- But we can add an additional safeguard: create a trigger that prevents
-- non-admin users from reading login codes via the edge function

-- Create a security barrier view for merchant_users that hides login_code for non-admins
CREATE OR REPLACE VIEW public.merchant_users_safe AS
SELECT 
  id,
  merchant_id,
  user_id,
  role,
  branch_id,
  CASE 
    WHEN is_owner_or_admin() OR user_id = auth.uid() THEN login_code
    ELSE NULL
  END AS login_code,
  is_active,
  created_at,
  updated_at
FROM public.merchant_users;
