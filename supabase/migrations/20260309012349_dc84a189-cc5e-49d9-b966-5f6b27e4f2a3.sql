
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_printed boolean NOT NULL DEFAULT false;
