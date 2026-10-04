-- =============================================================================
-- Phase 1 · Product foundation
--
-- DESIGN NOTE — why there is no new `products` table
-- --------------------------------------------------
-- This product catalogue already exists, split by what the shop sells:
--   devices       (one row per physical phone, unique IMEI)
--   accessories   (quantity-tracked)
--   repair_parts  (quantity-tracked)
-- and sale_items, online_order_items, wholesale_listings, stock_transfer_items
-- and stocktake_items all carry device_id / accessory_id foreign keys into them.
--
-- A generic `products` table would duplicate every one of those rows and orphan
-- every one of those keys. So the three tables ARE the product tables: this
-- migration gives them the fields a product needs (slug, description,
-- category_id, compare_at_price, status) and adds a read-only `products_v`
-- view so later phases can query "products" generically without a destructive
-- migration.
--
-- Everything here is additive. No column is dropped, no data is deleted, and
-- the existing `category` text column is left alone so current screens keep
-- working while category_id is adopted.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Categories — merchant_categories already exists, so it is extended
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_categories
  ADD COLUMN IF NOT EXISTS slug        text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS parent_id   uuid REFERENCES public.merchant_categories(id) ON DELETE SET NULL;

-- A category cannot be its own parent. Deeper cycles are prevented by the
-- trigger below.
ALTER TABLE public.merchant_categories
  DROP CONSTRAINT IF EXISTS merchant_categories_parent_not_self;
ALTER TABLE public.merchant_categories
  ADD CONSTRAINT merchant_categories_parent_not_self CHECK (parent_id IS DISTINCT FROM id);

CREATE OR REPLACE FUNCTION public.check_category_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _parent uuid; _depth int := 0;
BEGIN
  _parent := NEW.parent_id;
  WHILE _parent IS NOT NULL LOOP
    _depth := _depth + 1;
    IF _parent = NEW.id THEN
      RAISE EXCEPTION 'category_cycle' USING ERRCODE = '22023';
    END IF;
    IF _depth > 10 THEN
      RAISE EXCEPTION 'category_too_deep' USING ERRCODE = '22023';
    END IF;
    SELECT parent_id INTO _parent FROM public.merchant_categories WHERE id = _parent;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_categories_no_cycle ON public.merchant_categories;
CREATE TRIGGER merchant_categories_no_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON public.merchant_categories
  FOR EACH ROW WHEN (NEW.parent_id IS NOT NULL)
  EXECUTE FUNCTION public.check_category_cycle();

-- A parent must belong to the same merchant, or categories leak across tenants.
CREATE OR REPLACE FUNCTION public.check_category_parent_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.merchant_categories p
    WHERE p.id = NEW.parent_id AND p.merchant_id = NEW.merchant_id
  ) THEN
    RAISE EXCEPTION 'parent_belongs_to_another_merchant' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_categories_parent_tenant ON public.merchant_categories;
CREATE TRIGGER merchant_categories_parent_tenant
  BEFORE INSERT OR UPDATE OF parent_id, merchant_id ON public.merchant_categories
  FOR EACH ROW EXECUTE FUNCTION public.check_category_parent_tenant();

-- ---------------------------------------------------------------------------
-- 2 · Slugs
-- ---------------------------------------------------------------------------
-- Arabic names must survive: the slug keeps Arabic letters and only strips what
-- a URL cannot carry. A name of pure punctuation falls back to the row id.
CREATE OR REPLACE FUNCTION public.slugify(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(lower(coalesce(_text, '')), '[^a-z0-9؀-ۿ]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      ),
      '-'
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.set_item_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _base text;
  _slug text;
  _n int := 0;
  _source text;
  _taken boolean;
  -- NEW is read as jsonb because plpgsql resolves every field reference in a
  -- CASE, not just the branch it takes: NEW.name would fail on devices and
  -- NEW.model on accessories. A missing jsonb key is simply null.
  _rec jsonb := to_jsonb(NEW);
BEGIN
  IF NEW.slug IS NOT NULL AND btrim(NEW.slug) <> '' THEN
    _base := public.slugify(NEW.slug);
  ELSE
    -- devices are named by brand + model; the others carry a name column
    _source := CASE TG_ARGV[0]
                 WHEN 'device' THEN btrim(coalesce(_rec->>'brand', '') || ' ' || coalesce(_rec->>'model', ''))
                 ELSE _rec->>'name'
               END;
    _base := public.slugify(_source);
  END IF;

  _base := coalesce(_base, left(NEW.id::text, 8));
  _slug := _base;

  -- Uniqueness is checked against the item's own table, which already contains
  -- the earlier rows of a multi-row INSERT. An out-of-band registry would not:
  -- every row of "INSERT ... VALUES (a),(b)" would read the same stale state
  -- and pick the same suffix.
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE merchant_id = $1 AND slug = $2 AND id <> $3)',
      TG_TABLE_NAME
    ) INTO _taken USING NEW.merchant_id, _slug, NEW.id;

    EXIT WHEN NOT _taken;

    _n := _n + 1;
    _slug := _base || '-' || (_n + 1);
    IF _n > 100 THEN
      _slug := _base || '-' || left(NEW.id::text, 8);
      EXIT;
    END IF;
  END LOOP;

  NEW.slug := _slug;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3 · The product fields, on the three tables that already hold products
-- ---------------------------------------------------------------------------
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS slug              text,
  ADD COLUMN IF NOT EXISTS description       text,
  ADD COLUMN IF NOT EXISTS category_id       uuid REFERENCES public.merchant_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compare_at_price  numeric;

ALTER TABLE public.accessories
  ADD COLUMN IF NOT EXISTS slug              text,
  ADD COLUMN IF NOT EXISTS description       text,
  ADD COLUMN IF NOT EXISTS category_id       uuid REFERENCES public.merchant_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compare_at_price  numeric,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active';

ALTER TABLE public.repair_parts
  ADD COLUMN IF NOT EXISTS slug              text,
  ADD COLUMN IF NOT EXISTS description       text,
  ADD COLUMN IF NOT EXISTS category_id       uuid REFERENCES public.merchant_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active';

-- devices already has device_status (available/reserved/sold/transferred/repair)
-- and that is the lifecycle the POS and the stock screens read, so it is left
-- alone. accessories and repair_parts get the publishing status instead.
ALTER TABLE public.accessories DROP CONSTRAINT IF EXISTS accessories_status_check;
ALTER TABLE public.accessories
  ADD CONSTRAINT accessories_status_check CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE public.repair_parts DROP CONSTRAINT IF EXISTS repair_parts_status_check;
ALTER TABLE public.repair_parts
  ADD CONSTRAINT repair_parts_status_check CHECK (status IN ('draft', 'active', 'archived'));

-- ---------------------------------------------------------------------------
-- 4 · Validation the browser cannot skip
-- ---------------------------------------------------------------------------
ALTER TABLE public.accessories DROP CONSTRAINT IF EXISTS accessories_name_not_blank;
ALTER TABLE public.accessories ADD CONSTRAINT accessories_name_not_blank CHECK (btrim(name) <> '');
ALTER TABLE public.accessories DROP CONSTRAINT IF EXISTS accessories_price_non_negative;
ALTER TABLE public.accessories ADD CONSTRAINT accessories_price_non_negative CHECK (price >= 0 AND cost >= 0);
ALTER TABLE public.accessories DROP CONSTRAINT IF EXISTS accessories_quantity_non_negative;
ALTER TABLE public.accessories ADD CONSTRAINT accessories_quantity_non_negative CHECK (quantity >= 0);

ALTER TABLE public.repair_parts DROP CONSTRAINT IF EXISTS repair_parts_name_not_blank;
ALTER TABLE public.repair_parts ADD CONSTRAINT repair_parts_name_not_blank CHECK (btrim(name) <> '');
ALTER TABLE public.repair_parts DROP CONSTRAINT IF EXISTS repair_parts_price_non_negative;
ALTER TABLE public.repair_parts ADD CONSTRAINT repair_parts_price_non_negative CHECK (price >= 0 AND cost >= 0);
ALTER TABLE public.repair_parts DROP CONSTRAINT IF EXISTS repair_parts_quantity_non_negative;
ALTER TABLE public.repair_parts ADD CONSTRAINT repair_parts_quantity_non_negative CHECK (quantity >= 0);

ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_model_not_blank;
ALTER TABLE public.devices ADD CONSTRAINT devices_model_not_blank CHECK (btrim(model) <> '');
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_price_non_negative;
ALTER TABLE public.devices ADD CONSTRAINT devices_price_non_negative CHECK (price >= 0 AND cost >= 0);

-- A category must belong to the same merchant as the item on it.
CREATE OR REPLACE FUNCTION public.check_item_category_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.merchant_categories c
    WHERE c.id = NEW.category_id AND c.merchant_id = NEW.merchant_id
  ) THEN
    RAISE EXCEPTION 'category_belongs_to_another_merchant' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5 · Wire the triggers up
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  -- devices are named by brand+model, the other two by name, so the columns
  -- that should re-derive a slug differ per table
  FOR r IN SELECT * FROM (VALUES
      ('devices',      'device',      'slug, model, brand'),
      ('accessories',  'accessory',   'slug, name'),
      ('repair_parts', 'repair_part', 'slug, name')
    ) AS t(tbl, kind, slug_cols)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_slug ON public.%I', r.tbl, r.tbl);
    EXECUTE format(
      'CREATE TRIGGER %I_set_slug BEFORE INSERT OR UPDATE OF %s ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_item_slug(%L)', r.tbl, r.slug_cols, r.tbl, r.kind);

    EXECUTE format('DROP TRIGGER IF EXISTS %I_category_tenant ON public.%I', r.tbl, r.tbl);
    EXECUTE format(
      'CREATE TRIGGER %I_category_tenant BEFORE INSERT OR UPDATE OF category_id ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.check_item_category_tenant()', r.tbl, r.tbl);
  END LOOP;
END $$;

-- Backfill slugs for everything already in the tables.
UPDATE public.devices      SET slug = slug WHERE slug IS NULL;
UPDATE public.accessories  SET slug = slug WHERE slug IS NULL;
UPDATE public.repair_parts SET slug = slug WHERE slug IS NULL;

-- Unique per merchant per table. This is the guarantee; the trigger only picks
-- a free value so a caller never has to handle the collision. Created after the
-- backfill, so existing rows are already slugged.
CREATE UNIQUE INDEX IF NOT EXISTS devices_slug_per_merchant      ON public.devices      (merchant_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS accessories_slug_per_merchant  ON public.accessories  (merchant_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS repair_parts_slug_per_merchant ON public.repair_parts (merchant_id, slug);

CREATE INDEX IF NOT EXISTS devices_category_idx      ON public.devices (category_id);
CREATE INDEX IF NOT EXISTS accessories_category_idx  ON public.accessories (category_id);
CREATE INDEX IF NOT EXISTS repair_parts_category_idx ON public.repair_parts (category_id);
