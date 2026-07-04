-- Phase 1: Store templates, pages, and assets

-- 1. Add new columns to store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS theme_id text DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'cairo',
  ADD COLUMN IF NOT EXISTS hero_title text,
  ADD COLUMN IF NOT EXISTS hero_subtitle text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS featured_section_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured_product_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS currency_symbol text DEFAULT 'ر.س',
  ADD COLUMN IF NOT EXISTS announcement_bar_text text,
  ADD COLUMN IF NOT EXISTS announcement_bar_enabled boolean DEFAULT false;

-- 2. Create store_pages table for custom pages (about, terms, return, faq, ...)
CREATE TABLE IF NOT EXISTS public.store_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  content text,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, slug)
);

ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;

-- Merchants manage their own pages
CREATE POLICY "Merchants manage their store pages"
  ON public.store_pages FOR ALL
  TO authenticated
  USING (merchant_id = get_user_merchant_id())
  WITH CHECK (merchant_id = get_user_merchant_id());

-- Public can view published pages of published stores
CREATE POLICY "Public view published store pages"
  ON public.store_pages FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.store_settings ss
      WHERE ss.merchant_id = store_pages.merchant_id AND ss.is_published = true
    )
  );

-- Platform admins view all
CREATE POLICY "Platform admins view all store pages"
  ON public.store_pages FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- updated_at trigger
DROP TRIGGER IF EXISTS set_store_pages_updated_at ON public.store_pages;
CREATE TRIGGER set_store_pages_updated_at
  BEFORE UPDATE ON public.store_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Storage bucket for store assets (logos, banners, hero images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, merchant-scoped write (folder = merchant_id)
CREATE POLICY "Public read store-assets"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'store-assets');

CREATE POLICY "Merchants upload to their folder in store-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] = get_user_merchant_id()::text
  );

CREATE POLICY "Merchants update their folder in store-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] = get_user_merchant_id()::text
  );

CREATE POLICY "Merchants delete from their folder in store-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] = get_user_merchant_id()::text
  );