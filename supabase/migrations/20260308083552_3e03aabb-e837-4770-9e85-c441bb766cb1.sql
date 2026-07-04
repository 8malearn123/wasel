-- Create repair status enum
CREATE TYPE public.repair_status AS ENUM (
  'received',
  'diagnosing', 
  'waiting_parts',
  'in_progress',
  'completed',
  'delivered',
  'cancelled'
);

-- Create repair_orders table
CREATE TABLE public.repair_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  branch_id UUID REFERENCES public.branches(id),
  repair_number TEXT NOT NULL,
  
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Device info
  device_type TEXT NOT NULL,
  device_brand TEXT,
  device_model TEXT,
  device_imei TEXT,
  device_color TEXT,
  
  -- Repair details
  issue_description TEXT NOT NULL,
  diagnosis_notes TEXT,
  status repair_status NOT NULL DEFAULT 'received',
  priority TEXT DEFAULT 'normal',
  
  -- Costs
  estimated_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  parts_cost NUMERIC DEFAULT 0,
  
  -- Payment
  paid_amount NUMERIC DEFAULT 0,
  payment_status public.payment_status DEFAULT 'unpaid',
  
  -- Dates
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  estimated_completion TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  assigned_to UUID,
  created_by UUID,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view repair orders"
ON public.repair_orders FOR SELECT
TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Users can manage repair orders"
ON public.repair_orders FOR ALL
TO authenticated
USING (merchant_id = get_user_merchant_id());

-- Updated at trigger
CREATE TRIGGER set_repair_orders_updated_at
  BEFORE UPDATE ON public.repair_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Generate repair number function
CREATE OR REPLACE FUNCTION public.generate_repair_number(_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    _count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO _count FROM public.repair_orders WHERE merchant_id = _merchant_id;
    RETURN 'RPR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_count::TEXT, 4, '0');
END;
$$;