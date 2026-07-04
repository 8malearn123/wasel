
-- Create merchant_categories table
CREATE TABLE public.merchant_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  type TEXT NOT NULL DEFAULT 'all' CHECK (type IN ('all', 'device', 'accessory')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, name)
);

-- Enable RLS
ALTER TABLE public.merchant_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view categories" ON public.merchant_categories
  FOR SELECT TO authenticated
  USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Admins can manage categories" ON public.merchant_categories
  FOR ALL TO authenticated
  USING (merchant_id = get_user_merchant_id() AND is_owner_or_admin())
  WITH CHECK (merchant_id = get_user_merchant_id() AND is_owner_or_admin());

-- Add category column to devices table
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS category TEXT;
