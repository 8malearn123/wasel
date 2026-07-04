
-- Enums for online store
CREATE TYPE public.online_order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE public.shipping_provider AS ENUM ('aramex', 'smsa', 'other');
CREATE TYPE public.payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Store settings per merchant
CREATE TABLE public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  store_name TEXT,
  description TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  banner_url TEXT,
  logo_url TEXT,
  is_published BOOLEAN DEFAULT false,
  shipping_cost NUMERIC DEFAULT 25,
  free_shipping_threshold NUMERIC DEFAULT 500,
  whatsapp_number TEXT,
  instagram_url TEXT,
  twitter_url TEXT,
  return_policy TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage store settings"
ON public.store_settings FOR ALL TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Public view published stores"
ON public.store_settings FOR SELECT TO anon
USING (is_published = true);

CREATE POLICY "Authenticated view published stores"
ON public.store_settings FOR SELECT TO authenticated
USING (is_published = true);

CREATE POLICY "Platform admins view all store settings"
ON public.store_settings FOR SELECT TO authenticated
USING (is_platform_admin());

-- Store categories
CREATE TABLE public.store_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage categories"
ON public.store_categories FOR ALL TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Public view active categories"
ON public.store_categories FOR SELECT TO anon
USING (is_active = true AND EXISTS (
  SELECT 1 FROM public.store_settings ss WHERE ss.merchant_id = store_categories.merchant_id AND ss.is_published = true
));

-- Online orders
CREATE TABLE public.online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) NOT NULL,
  order_number TEXT NOT NULL,
  status public.online_order_status DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_provider public.shipping_provider,
  tracking_number TEXT,
  shipping_cost NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'bank_transfer',
  payment_status public.payment_status DEFAULT 'unpaid',
  payment_reference TEXT,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  payout_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can place orders"
ON public.online_orders FOR INSERT TO anon
WITH CHECK (EXISTS (
  SELECT 1 FROM public.store_settings WHERE merchant_id = online_orders.merchant_id AND is_published = true
));

CREATE POLICY "Authenticated can place orders"
ON public.online_orders FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.store_settings WHERE merchant_id = online_orders.merchant_id AND is_published = true
));

CREATE POLICY "Merchants manage their orders"
ON public.online_orders FOR ALL TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Platform admins view all online orders"
ON public.online_orders FOR SELECT TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins update online orders"
ON public.online_orders FOR UPDATE TO authenticated
USING (is_platform_admin());

-- Online order items
CREATE TABLE public.online_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.online_orders(id) ON DELETE CASCADE NOT NULL,
  device_id UUID REFERENCES public.devices(id),
  accessory_id UUID REFERENCES public.accessories(id),
  item_name TEXT NOT NULL,
  item_image TEXT,
  quantity INT DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create order items"
ON public.online_order_items FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Authenticated can create order items"
ON public.online_order_items FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Merchants view their order items"
ON public.online_order_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.online_orders o WHERE o.id = online_order_items.order_id AND o.merchant_id = get_user_merchant_id()
));

CREATE POLICY "Platform admins view all order items"
ON public.online_order_items FOR SELECT TO authenticated
USING (is_platform_admin());

-- Merchant payouts
CREATE TABLE public.merchant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status public.payout_status DEFAULT 'pending',
  bank_name TEXT,
  iban TEXT,
  reference_number TEXT,
  notes TEXT,
  period_from TIMESTAMPTZ,
  period_to TIMESTAMPTZ,
  orders_count INT DEFAULT 0,
  platform_fee NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.merchant_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view their payouts"
ON public.merchant_payouts FOR SELECT TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Platform admins manage payouts"
ON public.merchant_payouts FOR ALL TO authenticated
USING (is_platform_admin());

-- Add bank info to merchants
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_percentage NUMERIC DEFAULT 5;

-- Public access to devices for published stores
CREATE POLICY "Public view store devices"
ON public.devices FOR SELECT TO anon
USING (
  status = 'available' AND
  EXISTS (SELECT 1 FROM public.store_settings ss WHERE ss.merchant_id = devices.merchant_id AND ss.is_published = true)
);

-- Public access to accessories for published stores
CREATE POLICY "Public view store accessories"
ON public.accessories FOR SELECT TO anon
USING (
  quantity > 0 AND
  EXISTS (SELECT 1 FROM public.store_settings ss WHERE ss.merchant_id = accessories.merchant_id AND ss.is_published = true)
);

-- Generate online order number
CREATE OR REPLACE FUNCTION public.generate_online_order_number(_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO _count FROM public.online_orders WHERE merchant_id = _merchant_id;
  RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_count::TEXT, 4, '0');
END;
$$;

-- Triggers
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_online_orders_updated_at BEFORE UPDATE ON public.online_orders
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_merchant_payouts_updated_at BEFORE UPDATE ON public.merchant_payouts
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
