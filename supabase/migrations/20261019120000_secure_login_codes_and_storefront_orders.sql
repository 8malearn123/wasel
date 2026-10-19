-- =============================================================================
-- Security review · two holes found in the RLS audit
--
-- 1 · Any member of a merchant could read every colleague's login code
-- 2 · A storefront visitor set their own order's status, payment and prices
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1 · Login codes
--
-- "Users can view own merchant members" hid rows that carry a login code from
-- non-admins, but "Members view colleagues" was added beside it with only the
-- merchant check — and policies are OR'd, so the second one let any member,
-- a cashier included, `select login_code` for the whole team and sign in as a
-- branch manager or admin with it.
--
-- Hiding a column is not something a row policy can do, so the column itself
-- is taken out of the read grant. Codes are read through
-- get_user_login_code(), which already answers only an owner/admin (any code
-- in their merchant) or the user themselves. Writing a code is unchanged:
-- the UPDATE grant and the admin-only policy stay as they were.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.merchant_users FROM anon, authenticated;
GRANT SELECT (id, merchant_id, user_id, role, branch_id, is_active, created_at, updated_at)
  ON public.merchant_users TO authenticated;

-- With the column gone from the grant the two read policies say the same
-- thing; keep the plain one so nothing depends on login_code being readable.
DROP POLICY IF EXISTS "Users can view own merchant members" ON public.merchant_users;

-- The "safe" view selected login_code through a CASE, which a security-invoker
-- view can no longer do. Nothing reads it, so it is rebuilt without the column.
DROP VIEW IF EXISTS public.merchant_users_safe;
CREATE VIEW public.merchant_users_safe
  WITH (security_invoker = on) AS
  SELECT id, merchant_id, user_id, role, branch_id, is_active, created_at, updated_at
    FROM public.merchant_users;
GRANT SELECT ON public.merchant_users_safe TO authenticated;

-- Only a signed-in user has anything to ask it
REVOKE ALL ON FUNCTION public.get_user_login_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_login_code(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2 · Storefront orders
--
-- Checkout inserted online_orders and online_order_items straight from the
-- browser, and the policies only checked that the store was published. So a
-- visitor chose status, payment_status, subtotal/tax/total and every line's
-- unit_price: an order could arrive already "paid", for any amount, and
-- award-loyalty then credited points on that invented total.
--
-- Checkout now goes through place_online_order(): it prices every line from
-- the merchant's own devices/accessories, applies the store's shipping rule
-- and 15% VAT, and always writes the order as pending/unpaid. The direct
-- public insert policies are removed, so this function is the only way in.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_online_order(
  _merchant_id uuid,
  _customer jsonb,
  _items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store          public.store_settings%ROWTYPE;
  _dev            public.devices%ROWTYPE;
  _acc            public.accessories%ROWTYPE;
  _item           jsonb;
  _lines          jsonb := '[]'::jsonb;
  _seen_devices   uuid[] := ARRAY[]::uuid[];
  _qty            integer;
  _price          numeric;
  _name           text;
  _subtotal       numeric := 0;
  _shipping       numeric;
  _tax            numeric;
  _total          numeric;
  _order_id       uuid;
  _order_number   text;
  _customer_name  text := btrim(coalesce(_customer->>'customer_name', ''));
  _customer_phone text := btrim(coalesce(_customer->>'customer_phone', ''));
  _customer_email text := nullif(btrim(coalesce(_customer->>'customer_email', '')), '');
  _address        text := btrim(coalesce(_customer->>'shipping_address', ''));
  _city           text := btrim(coalesce(_customer->>'shipping_city', ''));
  _payment        text := coalesce(nullif(btrim(_customer->>'payment_method'), ''), 'bank_transfer');
BEGIN
  SELECT * INTO _store
    FROM public.store_settings
   WHERE merchant_id = _merchant_id AND is_published = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_available';
  END IF;

  IF _customer_name = '' OR length(_customer_name) > 120
     OR length(regexp_replace(_customer_phone, '\D', '', 'g')) NOT BETWEEN 7 AND 15
     OR _address = '' OR length(_address) > 500
     OR _city = '' OR length(_city) > 120
     OR length(coalesce(_customer_email, '')) > 200 THEN
    RAISE EXCEPTION 'invalid_customer';
  END IF;

  IF _payment NOT IN ('bank_transfer', 'cod', 'apple_pay') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;

  IF jsonb_typeof(_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_items) = 0
     OR jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    IF nullif(_item->>'device_id', '') IS NOT NULL THEN
      -- A device is one physical unit: quantity 1, and only once per order
      SELECT * INTO _dev
        FROM public.devices
       WHERE id = (_item->>'device_id')::uuid
         AND merchant_id = _merchant_id
         AND status = 'available';
      IF NOT FOUND OR _dev.id = ANY(_seen_devices) THEN
        RAISE EXCEPTION 'item_unavailable';
      END IF;
      _seen_devices := _seen_devices || _dev.id;
      _qty   := 1;
      _price := _dev.price;
      _name  := btrim(concat_ws(' ', _dev.brand, _dev.model, _dev.storage));
      _lines := _lines || jsonb_build_object(
        'device_id', _dev.id, 'accessory_id', NULL,
        'item_name', _name, 'quantity', _qty, 'unit_price', _price);

    ELSIF nullif(_item->>'accessory_id', '') IS NOT NULL THEN
      _qty := greatest(1, least(coalesce((_item->>'quantity')::integer, 1), 99));
      SELECT * INTO _acc
        FROM public.accessories
       WHERE id = (_item->>'accessory_id')::uuid
         AND merchant_id = _merchant_id
         AND coalesce(status, 'active') = 'active'
         AND quantity >= _qty;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'item_unavailable';
      END IF;
      _price := _acc.price;
      _name  := _acc.name;
      _lines := _lines || jsonb_build_object(
        'device_id', NULL, 'accessory_id', _acc.id,
        'item_name', _name, 'quantity', _qty, 'unit_price', _price);

    ELSE
      RAISE EXCEPTION 'invalid_items';
    END IF;

    _subtotal := _subtotal + _price * _qty;
  END LOOP;

  -- The same rule the checkout page shows the customer
  _shipping := CASE
    WHEN coalesce(_store.free_shipping_threshold, 0) > 0
         AND _subtotal >= _store.free_shipping_threshold THEN 0
    ELSE coalesce(_store.shipping_cost, 0)
  END;
  _tax   := round(_subtotal * 0.15, 2);
  _total := _subtotal + _tax + _shipping;

  _order_number := public.generate_online_order_number(_merchant_id);

  INSERT INTO public.online_orders (
    merchant_id, order_number, status, payment_status,
    customer_name, customer_phone, customer_email,
    shipping_address, shipping_city, shipping_cost, payment_method,
    subtotal, tax_amount, discount_amount, total_amount
  ) VALUES (
    _merchant_id, _order_number, 'pending', 'unpaid',
    _customer_name, _customer_phone, _customer_email,
    _address, _city, _shipping, _payment,
    _subtotal, _tax, 0, _total
  )
  RETURNING id INTO _order_id;

  INSERT INTO public.online_order_items (order_id, device_id, accessory_id, item_name, quantity, unit_price)
  SELECT _order_id,
         nullif(l->>'device_id', '')::uuid,
         nullif(l->>'accessory_id', '')::uuid,
         l->>'item_name',
         (l->>'quantity')::integer,
         (l->>'unit_price')::numeric
    FROM jsonb_array_elements(_lines) AS l;

  RETURN jsonb_build_object(
    'order_number',  _order_number,
    'subtotal',      _subtotal,
    'tax_amount',    _tax,
    'shipping_cost', _shipping,
    'total_amount',  _total,
    'items',         _lines
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_online_order(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_online_order(uuid, jsonb, jsonb) TO anon, authenticated;

-- The browser no longer writes orders for a store it does not own
DROP POLICY IF EXISTS "Anyone can place orders" ON public.online_orders;
DROP POLICY IF EXISTS "Authenticated can place orders" ON public.online_orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.online_order_items;
DROP POLICY IF EXISTS "Authenticated can create order items" ON public.online_order_items;

-- A merchant still adds lines to its own orders ("Merchants manage their
-- orders" already covers the order rows themselves)
DROP POLICY IF EXISTS "Merchants add items to their orders" ON public.online_order_items;
CREATE POLICY "Merchants add items to their orders"
  ON public.online_order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.online_orders o
     WHERE o.id = online_order_items.order_id
       AND o.merchant_id = public.get_user_merchant_id()
  ));


-- ---------------------------------------------------------------------------
-- Order tracking for the public page
--
-- The tracking page read online_orders as a visitor and compared the phone in
-- the browser — which needs a public read of every order, phone and address
-- included. This answers one order, and only when the last four digits match.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_online_order(_order_number text, _phone_last4 text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.online_orders%ROWTYPE;
BEGIN
  IF coalesce(btrim(_order_number), '') = '' OR _phone_last4 !~ '^\d{4}$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _order FROM public.online_orders WHERE order_number = btrim(_order_number);
  IF NOT FOUND OR right(regexp_replace(_order.customer_phone, '\D', '', 'g'), 4) <> _phone_last4 THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', _order.id, 'order_number', _order.order_number, 'status', _order.status,
      'payment_status', _order.payment_status, 'payment_method', _order.payment_method,
      'customer_name', _order.customer_name, 'shipping_city', _order.shipping_city,
      'shipping_provider', _order.shipping_provider, 'tracking_number', _order.tracking_number,
      'subtotal', _order.subtotal, 'tax_amount', _order.tax_amount,
      'shipping_cost', _order.shipping_cost, 'total_amount', _order.total_amount,
      'created_at', _order.created_at, 'updated_at', _order.updated_at),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'item_name', i.item_name, 'item_image', i.item_image,
               'quantity', i.quantity, 'unit_price', i.unit_price) ORDER BY i.created_at)
        FROM public.online_order_items i WHERE i.order_id = _order.id), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.track_online_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_online_order(text, text) TO anon, authenticated;
