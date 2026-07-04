
-- Repair parts inventory table
CREATE TABLE public.repair_parts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES public.merchants(id),
    branch_id uuid REFERENCES public.branches(id),
    name text NOT NULL,
    sku text NOT NULL,
    category text,
    brand text,
    cost numeric NOT NULL DEFAULT 0,
    price numeric NOT NULL DEFAULT 0,
    quantity integer NOT NULL DEFAULT 0,
    min_quantity integer DEFAULT 5,
    compatible_models text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Repair order parts junction table (parts used in a repair)
CREATE TABLE public.repair_order_parts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
    repair_part_id uuid NOT NULL REFERENCES public.repair_parts(id),
    quantity integer NOT NULL DEFAULT 1,
    unit_cost numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.repair_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_parts ENABLE ROW LEVEL SECURITY;

-- RLS policies for repair_parts
CREATE POLICY "Users can view repair parts"
ON public.repair_parts FOR SELECT TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Users can manage repair parts"
ON public.repair_parts FOR ALL TO authenticated
USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Platform admins can view all repair_parts"
ON public.repair_parts FOR SELECT TO authenticated
USING (is_platform_admin());

-- RLS policies for repair_order_parts
CREATE POLICY "Users can view repair order parts"
ON public.repair_order_parts FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM repair_orders ro 
    WHERE ro.id = repair_order_parts.repair_order_id 
    AND ro.merchant_id = get_user_merchant_id()
));

CREATE POLICY "Users can manage repair order parts"
ON public.repair_order_parts FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM repair_orders ro 
    WHERE ro.id = repair_order_parts.repair_order_id 
    AND ro.merchant_id = get_user_merchant_id()
));

-- Updated_at trigger for repair_parts
CREATE TRIGGER update_repair_parts_updated_at
    BEFORE UPDATE ON public.repair_parts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
