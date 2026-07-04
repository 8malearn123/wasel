
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS has_loyalty boolean NOT NULL DEFAULT false;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_currency numeric NOT NULL DEFAULT 1;

UPDATE public.plans
  SET has_loyalty = true
  WHERE name_ar IN ('باقة ب','باقة ج','باقة الموزع');
