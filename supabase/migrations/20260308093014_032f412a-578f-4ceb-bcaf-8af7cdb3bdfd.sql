
-- Fix overly permissive policies on online_order_items
DROP POLICY IF EXISTS "Anyone can create order items" ON public.online_order_items;
DROP POLICY IF EXISTS "Authenticated can create order items" ON public.online_order_items;

CREATE POLICY "Anyone can create order items"
ON public.online_order_items FOR INSERT TO anon
WITH CHECK (EXISTS (
  SELECT 1 FROM public.online_orders o
  JOIN public.store_settings ss ON ss.merchant_id = o.merchant_id
  WHERE o.id = online_order_items.order_id AND ss.is_published = true
));

CREATE POLICY "Authenticated can create order items"
ON public.online_order_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.online_orders o
  JOIN public.store_settings ss ON ss.merchant_id = o.merchant_id
  WHERE o.id = online_order_items.order_id AND ss.is_published = true
) OR EXISTS (
  SELECT 1 FROM public.online_orders o
  WHERE o.id = online_order_items.order_id AND o.merchant_id = get_user_merchant_id()
));
