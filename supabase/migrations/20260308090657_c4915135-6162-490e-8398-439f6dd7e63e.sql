
-- Stocktake status enum
CREATE TYPE public.stocktake_status AS ENUM ('draft', 'in_progress', 'completed', 'cancelled');

-- Stocktake item type enum
CREATE TYPE public.stocktake_item_type AS ENUM ('device', 'accessory', 'repair_part');

-- Stocktakes table
CREATE TABLE public.stocktakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id),
    stocktake_number TEXT NOT NULL,
    status stocktake_status NOT NULL DEFAULT 'draft',
    item_types stocktake_item_type[] NOT NULL DEFAULT '{device,accessory,repair_part}',
    notes TEXT,
    created_by UUID,
    completed_by UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    total_items INTEGER DEFAULT 0,
    counted_items INTEGER DEFAULT 0,
    discrepancy_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stocktake items table
CREATE TABLE public.stocktake_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stocktake_id UUID NOT NULL REFERENCES public.stocktakes(id) ON DELETE CASCADE,
    item_type stocktake_item_type NOT NULL,
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    item_sku TEXT,
    system_quantity INTEGER NOT NULL DEFAULT 0,
    counted_quantity INTEGER,
    discrepancy INTEGER GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - system_quantity) STORED,
    notes TEXT,
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocktake_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for stocktakes
CREATE POLICY "Users can view stocktakes" ON public.stocktakes
    FOR SELECT TO authenticated
    USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Users can manage stocktakes" ON public.stocktakes
    FOR ALL TO authenticated
    USING (merchant_id = get_user_merchant_id());

-- RLS policies for stocktake_items
CREATE POLICY "Users can view stocktake items" ON public.stocktake_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.stocktakes s
        WHERE s.id = stocktake_items.stocktake_id
        AND s.merchant_id = get_user_merchant_id()
    ));

CREATE POLICY "Users can manage stocktake items" ON public.stocktake_items
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.stocktakes s
        WHERE s.id = stocktake_items.stocktake_id
        AND s.merchant_id = get_user_merchant_id()
    ));

-- Updated_at trigger
CREATE TRIGGER set_stocktakes_updated_at
    BEFORE UPDATE ON public.stocktakes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Generate stocktake number function
CREATE OR REPLACE FUNCTION public.generate_stocktake_number(_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO _count FROM public.stocktakes WHERE merchant_id = _merchant_id;
    RETURN 'STK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(_count::TEXT, 4, '0');
END;
$$;
