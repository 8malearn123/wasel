
CREATE TABLE public.daily_closings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  closing_date date NOT NULL DEFAULT CURRENT_DATE,
  cash_sales numeric NOT NULL DEFAULT 0,
  card_sales numeric NOT NULL DEFAULT 0,
  bank_transfer_sales numeric NOT NULL DEFAULT 0,
  total_sales numeric NOT NULL DEFAULT 0,
  total_tax numeric NOT NULL DEFAULT 0,
  total_discount numeric NOT NULL DEFAULT 0,
  transactions_count integer NOT NULL DEFAULT 0,
  devices_sold integer NOT NULL DEFAULT 0,
  accessories_sold integer NOT NULL DEFAULT 0,
  cash_counted numeric DEFAULT NULL,
  cash_difference numeric DEFAULT NULL,
  notes text DEFAULT NULL,
  closed_by uuid DEFAULT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(branch_id, closing_date)
);

ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own closings" ON public.daily_closings
  FOR SELECT USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Users can create closings" ON public.daily_closings
  FOR INSERT WITH CHECK (merchant_id = get_user_merchant_id());

CREATE POLICY "Users can update own closings" ON public.daily_closings
  FOR UPDATE USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Platform admins view all closings" ON public.daily_closings
  FOR SELECT USING (is_platform_admin());
