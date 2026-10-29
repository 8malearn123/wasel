-- Invoice numbers are unique and never reused.
--
-- generate_invoice_number() returned «count of the shop's invoices + 1». A
-- deleted invoice lowers the count, so the next sale got a number already on
-- another invoice (live: INV-20261028-0046 on two invoices, 103.5 and 115 SAR;
-- INV-20261028-0047 the day before). Two tills asking at the same moment got
-- the same number too, and nothing in the database refused the duplicate.
--
-- Now each shop has a counter that only moves forward, taken under a row lock
-- (two simultaneous sales wait for each other and get different numbers). It
-- starts above every number the shop has already used, so no existing number
-- is handed out again. A number taken by a sale that is then abandoned is
-- skipped, not reused. The number format is unchanged.
--
-- Existing invoices — including the duplicates already there — are not
-- touched: the uniqueness index covers invoices created from now on, and a
-- trigger refuses any new invoice whose number an existing one already has.

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  merchant_id uuid PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  last_value  bigint NOT NULL
);
-- Only the numbering function (SECURITY DEFINER) reads or writes it
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_counters FROM PUBLIC, anon, authenticated;

-- The highest running number a shop has used: its invoice count, or the
-- largest «INV-YYYYMMDD-NNNN» suffix, whichever is greater
CREATE OR REPLACE FUNCTION public.invoice_number_floor(_merchant_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    (SELECT count(*) FROM public.sales WHERE merchant_id = _merchant_id),
    COALESCE((SELECT max((substring(invoice_number FROM '^INV-[0-9]{8}-([0-9]{1,12})$'))::bigint)
                FROM public.sales WHERE merchant_id = _merchant_id), 0)
  )
$$;
REVOKE ALL ON FUNCTION public.invoice_number_floor(uuid) FROM PUBLIC, anon, authenticated;

INSERT INTO public.invoice_counters (merchant_id, last_value)
SELECT m.id, public.invoice_number_floor(m.id) FROM public.merchants m
ON CONFLICT (merchant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_invoice_number(_merchant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n bigint;
BEGIN
  -- a signed-in member numbers their own shop's invoices only
  IF auth.uid() IS NOT NULL
     AND _merchant_id IS DISTINCT FROM public.get_user_merchant_id()
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'لا يمكن إصدار رقم فاتورة لمتجر آخر' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.invoice_counters (merchant_id, last_value)
  VALUES (_merchant_id, public.invoice_number_floor(_merchant_id))
  ON CONFLICT (merchant_id) DO NOTHING;

  UPDATE public.invoice_counters
     SET last_value = last_value + 1
   WHERE merchant_id = _merchant_id
  RETURNING last_value INTO _n;

  RETURN 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(_n::text, 4, '0');
END;
$$;
-- visitors had EXECUTE on it; only signed-in members number invoices
REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO authenticated;

-- No new invoice may carry a number another invoice of the shop already has
-- (old ones included). The index below settles two inserts racing each other.
CREATE OR REPLACE FUNCTION public.refuse_duplicate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sales
              WHERE merchant_id = NEW.merchant_id
                AND invoice_number = NEW.invoice_number
                AND id <> NEW.id) THEN
    RAISE EXCEPTION 'رقم الفاتورة % مستخدم من قبل، فلم يُحفظ البيع. أعد المحاولة.', NEW.invoice_number
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refuse_duplicate_invoice_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sales_unique_invoice_number ON public.sales;
CREATE TRIGGER sales_unique_invoice_number
  BEFORE INSERT OR UPDATE OF invoice_number, merchant_id ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.refuse_duplicate_invoice_number();

-- Invoices from now on: unique per shop, enforced by the index itself
CREATE UNIQUE INDEX IF NOT EXISTS sales_invoice_number_unique_from_20261030
  ON public.sales (merchant_id, invoice_number)
  WHERE created_at >= '2026-10-30 00:00:00+00';
