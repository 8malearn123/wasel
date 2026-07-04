-- Add warranty period column
ALTER TABLE public.repair_orders 
ADD COLUMN warranty_days INTEGER DEFAULT 0,
ADD COLUMN warranty_ends_at TIMESTAMP WITH TIME ZONE;

-- Update generate_repair_number to use a unique sequential format per merchant
CREATE OR REPLACE FUNCTION public.generate_repair_number(_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    _count INTEGER;
    _prefix TEXT;
BEGIN
    SELECT COUNT(*) + 1 INTO _count FROM public.repair_orders WHERE merchant_id = _merchant_id;
    _prefix := 'RPR';
    RETURN _prefix || '-' || LPAD(_count::TEXT, 5, '0');
END;
$$;