
CREATE OR REPLACE FUNCTION public.get_public_merchant_legal(_slug text)
RETURNS TABLE(name text, cr_number text, vat_number text, vat_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.name, m.cr_number, m.vat_number, m.vat_enabled
  FROM public.merchants m
  JOIN public.store_settings s ON s.merchant_id = m.id
  WHERE s.slug = _slug AND s.is_published = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_merchant_legal(text) TO anon, authenticated;
