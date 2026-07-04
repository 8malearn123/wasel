
ALTER TABLE public.merchants 
  ADD COLUMN IF NOT EXISTS cr_number text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS vat_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS show_cr_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_vat_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_vat_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS additional_banners jsonb NOT NULL DEFAULT '[]'::jsonb;
