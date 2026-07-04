
-- Create wholesale_credit_transactions table for credit/consignment tracking
CREATE TABLE IF NOT EXISTS public.wholesale_credit_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    buyer_merchant_id UUID NOT NULL REFERENCES public.merchants(id),
    order_id UUID REFERENCES public.wholesale_orders(id),
    transaction_type TEXT NOT NULL DEFAULT 'credit',
    credit_type TEXT NOT NULL DEFAULT 'invoice',
    amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    remaining_amount NUMERIC NOT NULL DEFAULT 0,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'unpaid',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wholesale_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can manage credit" ON public.wholesale_credit_transactions FOR ALL USING (supplier_merchant_id = get_user_merchant_id());
CREATE POLICY "Buyers can view their credit" ON public.wholesale_credit_transactions FOR SELECT USING (buyer_merchant_id = get_user_merchant_id());
CREATE POLICY "Buyers can update their credit" ON public.wholesale_credit_transactions FOR UPDATE USING (buyer_merchant_id = get_user_merchant_id());
