-- A device is sold once — decided by the database, not by the browser.
--
-- The till checks a device's status before it makes an invoice, but that check
-- runs in the browser: two tills (or a direct API call) could still put the
-- same device on two invoices. The demo shop's iPhone 15 Pro Max is on two
-- (DEMO-T001 and INV-20261021-0040), from before the till's check existed.
--
-- A sale line for a device now takes the device in the same statement: it is
-- marked sold only if it is still available and belongs to the sale's shop,
-- otherwise the line is refused. Two lines for one device cannot both pass,
-- whatever the timing. The till's own «mark as sold» afterwards is a no-op.
--
-- Nothing existing is read or changed: the check runs on new sale lines only,
-- so the old duplicate stays as it is until the owner decides about it.

CREATE OR REPLACE FUNCTION public.take_device_for_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant uuid;
BEGIN
  IF NEW.device_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT merchant_id INTO _merchant FROM public.sales WHERE id = NEW.sale_id;

  UPDATE public.devices
     SET status = 'sold', updated_at = now()
   WHERE id = NEW.device_id
     AND merchant_id = _merchant
     AND status = 'available';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجهاز غير متاح للبيع (مباع أو محجوز أو قيد التحويل)'
      USING ERRCODE = 'P0001', HINT = 'device_not_available';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.take_device_for_sale() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sale_items_take_device ON public.sale_items;
CREATE TRIGGER sale_items_take_device
  BEFORE INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.take_device_for_sale();
