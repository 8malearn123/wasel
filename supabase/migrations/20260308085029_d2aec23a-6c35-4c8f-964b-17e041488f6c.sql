
-- Platform admins can view all devices
CREATE POLICY "Platform admins can view all devices"
ON public.devices FOR SELECT TO authenticated
USING (is_platform_admin());

-- Platform admins can view all accessories
CREATE POLICY "Platform admins can view all accessories"
ON public.accessories FOR SELECT TO authenticated
USING (is_platform_admin());

-- Platform admins can view all sales
CREATE POLICY "Platform admins can view all sales"
ON public.sales FOR SELECT TO authenticated
USING (is_platform_admin());

-- Platform admins can view all sale_items
CREATE POLICY "Platform admins can view all sale_items"
ON public.sale_items FOR SELECT TO authenticated
USING (is_platform_admin());

-- Platform admins can view all repair_orders
CREATE POLICY "Platform admins can view all repair_orders"
ON public.repair_orders FOR SELECT TO authenticated
USING (is_platform_admin());

-- Platform admins can view all profiles
CREATE POLICY "Platform admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_platform_admin());

-- Platform admins can view all suppliers
CREATE POLICY "Platform admins can view all suppliers"
ON public.suppliers FOR SELECT TO authenticated
USING (is_platform_admin());

-- Platform admins can view all activity_logs
CREATE POLICY "Platform admins can view all activity_logs"
ON public.activity_logs FOR SELECT TO authenticated
USING (is_platform_admin());
