-- =============================================================================
-- Phase 1 · Product media
--
-- The audit's first finding: products had no image column at all. Photos were
-- static files committed under public/products/<IMEI>.jpg, so a merchant could
-- not add one, the storefront had nothing for og:image, and Product schema had
-- no image. This is the table and the bucket that fix it.
--
-- One table covers all three item kinds and both media types. There is no
-- separate table per image role: "primary" is a flag, order is a column.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.product_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  -- polymorphic: a real FK is impossible across three tables, so a trigger
  -- checks the target exists and belongs to the same merchant
  item_type    text NOT NULL CHECK (item_type IN ('device', 'accessory', 'repair_part')),
  item_id      uuid NOT NULL,
  -- 'model_3d' is listed so Phase 9 does not need a migration to store a GLB;
  -- nothing in Phase 1 writes or reads it
  media_type   text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'model_3d')),
  storage_path text NOT NULL,
  public_url   text NOT NULL,
  thumb_url    text,
  alt_text     text,
  sort_order   integer NOT NULL DEFAULT 0,
  is_primary   boolean NOT NULL DEFAULT false,
  width        integer,
  height       integer,
  bytes        integer,
  mime         text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_media_item_idx
  ON public.product_media (item_type, item_id, sort_order);
CREATE INDEX IF NOT EXISTS product_media_merchant_idx
  ON public.product_media (merchant_id);

-- At most one primary per item, enforced by the database rather than by hoping
-- the client sends the right pair of updates.
CREATE UNIQUE INDEX IF NOT EXISTS product_media_one_primary
  ON public.product_media (item_type, item_id)
  WHERE is_primary;

DROP TRIGGER IF EXISTS product_media_updated_at ON public.product_media;
CREATE TRIGGER product_media_updated_at
  BEFORE UPDATE ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- The polymorphic key is checked, not trusted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_product_media_target()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _owner uuid;
BEGIN
  SELECT CASE NEW.item_type
           WHEN 'device'      THEN (SELECT merchant_id FROM public.devices      WHERE id = NEW.item_id)
           WHEN 'accessory'   THEN (SELECT merchant_id FROM public.accessories  WHERE id = NEW.item_id)
           WHEN 'repair_part' THEN (SELECT merchant_id FROM public.repair_parts WHERE id = NEW.item_id)
         END
    INTO _owner;

  IF _owner IS NULL THEN
    RAISE EXCEPTION 'item_not_found' USING ERRCODE = '23503';
  END IF;
  IF _owner <> NEW.merchant_id THEN
    RAISE EXCEPTION 'item_belongs_to_another_merchant' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_media_target_check ON public.product_media;
CREATE TRIGGER product_media_target_check
  BEFORE INSERT OR UPDATE OF item_type, item_id, merchant_id ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.check_product_media_target();

-- The first image of an item becomes its primary; deleting the primary
-- promotes the next one, so an item is never left with photos but no cover.
CREATE OR REPLACE FUNCTION public.maintain_primary_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_media
      WHERE item_type = NEW.item_type AND item_id = NEW.item_id
        AND is_primary AND id <> NEW.id
    ) THEN
      UPDATE public.product_media SET is_primary = true WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    UPDATE public.product_media
       SET is_primary = true
     WHERE id = (
       SELECT id FROM public.product_media
        WHERE item_type = OLD.item_type AND item_id = OLD.item_id
        ORDER BY sort_order, created_at
        LIMIT 1
     );
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS product_media_primary_after ON public.product_media;
CREATE TRIGGER product_media_primary_after
  AFTER INSERT OR DELETE ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.maintain_primary_media();

-- Setting a new primary clears the old one in the same statement, so the
-- partial unique index above never trips the caller.
CREATE OR REPLACE FUNCTION public.clear_other_primary_media()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.product_media
       SET is_primary = false
     WHERE item_type = NEW.item_type AND item_id = NEW.item_id
       AND id <> NEW.id AND is_primary;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_media_clear_primary ON public.product_media;
CREATE TRIGGER product_media_clear_primary
  BEFORE UPDATE OF is_primary ON public.product_media
  FOR EACH ROW WHEN (NEW.is_primary AND NOT OLD.is_primary)
  EXECUTE FUNCTION public.clear_other_primary_media();

-- ---------------------------------------------------------------------------
-- RLS — read follows the product, write follows the permission
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants read their product media" ON public.product_media;
CREATE POLICY "Merchants read their product media"
  ON public.product_media FOR SELECT TO authenticated
  USING (merchant_id = public.get_user_merchant_id());

-- A visitor may see the media of an item a published store is already showing
-- them, and nothing else.
DROP POLICY IF EXISTS "Public read media of published store items" ON public.product_media;
CREATE POLICY "Public read media of published store items"
  ON public.product_media FOR SELECT TO anon
  USING (
    EXISTS (SELECT 1 FROM public.store_settings ss
             WHERE ss.merchant_id = product_media.merchant_id AND ss.is_published)
    AND (
      (item_type = 'device' AND EXISTS (
        SELECT 1 FROM public.devices d WHERE d.id = product_media.item_id AND d.status = 'available'))
      OR (item_type = 'accessory' AND EXISTS (
        SELECT 1 FROM public.accessories a WHERE a.id = product_media.item_id AND a.quantity > 0))
    )
  );

-- The write policies are added by the RBAC migration, which defines
-- has_permission(). Until then product_media has no write policy, so it is
-- closed — the safe direction if the migrations are applied out of order.

-- ---------------------------------------------------------------------------
-- Storage — a bucket of its own, public to read, permissioned to write
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media', 'product-media', true,
  10485760,  -- 10 MB; the client downscales before upload, this is the backstop
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'model/gltf-binary', 'model/gltf+json']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Objects live at <merchant_id>/<item_type>/<item_id>/<file>, so the first path
-- segment is the tenant and every write policy pins it to the caller's merchant.
DROP POLICY IF EXISTS "Public read product-media" ON storage.objects;
CREATE POLICY "Public read product-media"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Permitted users upload product-media" ON storage.objects;
DROP POLICY IF EXISTS "Permitted users update product-media" ON storage.objects;
DROP POLICY IF EXISTS "Permitted users delete product-media" ON storage.objects;
-- created by the RBAC migration, which defines has_permission()
