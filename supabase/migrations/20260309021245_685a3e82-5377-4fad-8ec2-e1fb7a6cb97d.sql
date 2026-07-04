
-- Fix security definer views by converting to security invoker
ALTER VIEW public.public_store_devices SET (security_invoker = on);
ALTER VIEW public.merchant_users_safe SET (security_invoker = on);
