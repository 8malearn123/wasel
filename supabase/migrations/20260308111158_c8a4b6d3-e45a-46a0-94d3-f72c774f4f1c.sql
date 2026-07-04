
-- Create customers table
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    total_spent NUMERIC NOT NULL DEFAULT 0,
    total_purchases INTEGER NOT NULL DEFAULT 0,
    loyalty_tier TEXT NOT NULL DEFAULT 'bronze',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create loyalty_transactions table
CREATE TABLE public.loyalty_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    points INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'earn',
    description TEXT,
    sale_id UUID REFERENCES public.sales(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS for customers
CREATE POLICY "Users can view customers" ON public.customers FOR SELECT USING (merchant_id = get_user_merchant_id());
CREATE POLICY "Users can manage customers" ON public.customers FOR ALL USING (merchant_id = get_user_merchant_id());
CREATE POLICY "Platform admins can view all customers" ON public.customers FOR SELECT USING (is_platform_admin());

-- RLS for loyalty_transactions
CREATE POLICY "Users can view loyalty transactions" ON public.loyalty_transactions FOR SELECT USING (merchant_id = get_user_merchant_id());
CREATE POLICY "Users can manage loyalty transactions" ON public.loyalty_transactions FOR ALL USING (merchant_id = get_user_merchant_id());
