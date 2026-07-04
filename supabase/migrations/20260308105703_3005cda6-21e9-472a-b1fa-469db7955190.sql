
-- Coupons table
CREATE TABLE public.coupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC NOT NULL DEFAULT 0,
    min_order_amount NUMERIC DEFAULT 0,
    max_discount_amount NUMERIC DEFAULT NULL,
    max_uses INTEGER DEFAULT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'devices', 'accessories')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(merchant_id, code)
);

-- Campaigns table
CREATE TABLE public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT NOT NULL DEFAULT 'discount' CHECK (campaign_type IN ('discount', 'bundle', 'flash_sale', 'buy_x_get_y')),
    discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC DEFAULT 0,
    buy_quantity INTEGER DEFAULT NULL,
    get_quantity INTEGER DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Coupons RLS
CREATE POLICY "Users can view coupons" ON public.coupons FOR SELECT USING (merchant_id = get_user_merchant_id());
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (merchant_id = get_user_merchant_id() AND is_owner_or_admin());

-- Campaigns RLS
CREATE POLICY "Users can view campaigns" ON public.campaigns FOR SELECT USING (merchant_id = get_user_merchant_id());
CREATE POLICY "Admins can manage campaigns" ON public.campaigns FOR ALL USING (merchant_id = get_user_merchant_id() AND is_owner_or_admin());

-- Updated_at triggers
CREATE TRIGGER handle_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER handle_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
