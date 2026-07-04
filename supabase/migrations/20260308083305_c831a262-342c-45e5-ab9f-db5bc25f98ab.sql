-- Allow merchant members to view profiles of other users in the same merchant
CREATE POLICY "Merchant members can view colleague profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT mu.user_id FROM public.merchant_users mu 
    WHERE mu.merchant_id = get_user_merchant_id() AND mu.is_active = true
  )
);