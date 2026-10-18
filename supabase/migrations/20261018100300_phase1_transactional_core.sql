-- =====================================================================
-- Phase 1 · Transactional core
-- ---------------------------------------------------------------------
--   pos_checkout()                 atomic POS sale            (D2, D3, D4, D10)
--   place_online_order()           atomic web order + hold    (D5, D6)
--   sync_online_order_stock()      order status -> stock      (D5)
--   release_expired_reservations() TTL release (cron + lazy)
--   track_public_order()           server-side order lookup   (D9)
--
-- Lock order, the same in every function, so concurrent calls can't
-- deadlock: online_orders rows -> devices (ORDER BY id) -> accessories (ORDER BY id).
--
-- Errors are raised with Arabic messages (shown as-is by the UI) and a
-- stable machine code in HINT.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Online order status -> stock synchronisation
-- ---------------------------------------------------------------------
-- Runs for every status change whatever its source (back-office page,
-- platform admin, cron), so stock can't drift from order state.
--   pending                                   devices reserved (TTL)
--   confirmed / processing / shipped / delivered  devices sold
--   cancelled / refunded                      devices available again, accessories restocked
-- Re-opening a cancelled order takes the stock again, or fails if a unit
-- has been sold elsewhere in the meantime.
CREATE OR REPLACE FUNCTION public.sync_online_order_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _firm    boolean := NEW.status IN ('confirmed', 'processing', 'shipped', 'delivered');
    _expires timestamptz;
    _imei    text;
    _item    record;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR OLD.stock_state = 'none' THEN
        RETURN NEW;                                    -- legacy orders never held stock
    END IF;

    -- Cancelled / refunded: give everything back ------------------------
    IF NEW.status IN ('cancelled', 'refunded') THEN
        IF OLD.stock_state IN ('reserved', 'committed') THEN
            PERFORM public.set_device_event_context(
                CASE WHEN OLD.stock_state = 'reserved' THEN 'reservation_released' ELSE 'returned' END,
                'online_orders', NEW.id);
            UPDATE public.devices
            SET status = 'available', reserved_until = NULL, online_order_id = NULL, updated_at = now()
            WHERE online_order_id = NEW.id AND status IN ('reserved', 'sold');
            PERFORM public.set_device_event_context(NULL, NULL, NULL);

            UPDATE public.accessories a
            SET quantity = a.quantity + i.qty, updated_at = now()
            FROM (SELECT accessory_id, SUM(quantity) AS qty
                  FROM public.online_order_items
                  WHERE order_id = NEW.id AND accessory_id IS NOT NULL
                  GROUP BY accessory_id) i
            WHERE a.id = i.accessory_id;

            NEW.stock_state := 'released';
            NEW.reservation_expires_at := NULL;
        END IF;
        RETURN NEW;
    END IF;

    -- Active status --------------------------------------------------------
    IF OLD.stock_state = 'released' THEN
        -- Re-opening: every unit must still be free.
        PERFORM 1 FROM public.devices
        WHERE id IN (SELECT device_id FROM public.online_order_items
                     WHERE order_id = NEW.id AND device_id IS NOT NULL)
        ORDER BY id FOR UPDATE;

        SELECT d.imei INTO _imei
        FROM public.online_order_items i
        JOIN public.devices d ON d.id = i.device_id
        WHERE i.order_id = NEW.id AND d.status <> 'available'
        LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'لا يمكن إعادة فتح الطلب: الجهاز % لم يعد متاحاً', _imei
                USING HINT = 'DEVICE_UNAVAILABLE';
        END IF;

        FOR _item IN
            SELECT accessory_id, SUM(quantity) AS qty
            FROM public.online_order_items
            WHERE order_id = NEW.id AND accessory_id IS NOT NULL
            GROUP BY accessory_id ORDER BY accessory_id
        LOOP
            UPDATE public.accessories
            SET quantity = quantity - _item.qty, updated_at = now()
            WHERE id = _item.accessory_id AND quantity >= _item.qty;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'لا يمكن إعادة فتح الطلب: الكمية غير كافية'
                    USING HINT = 'INSUFFICIENT_STOCK';
            END IF;
        END LOOP;
    END IF;

    -- Move devices only when the held state actually changes.
    IF OLD.stock_state = 'released'
       OR (_firm AND OLD.stock_state = 'reserved')
       OR (NOT _firm AND OLD.stock_state = 'committed') THEN

        IF NOT _firm THEN
            SELECT now() + make_interval(mins => COALESCE(reservation_ttl_minutes, 30))
            INTO _expires
            FROM public.store_settings WHERE merchant_id = NEW.merchant_id;
            _expires := COALESCE(_expires, now() + interval '30 minutes');
        END IF;

        PERFORM public.set_device_event_context(
            CASE WHEN _firm THEN 'sold' ELSE 'reserved' END, 'online_orders', NEW.id);
        UPDATE public.devices
        SET status          = CASE WHEN _firm THEN 'sold' ELSE 'reserved' END::public.device_status,
            reserved_until  = _expires,
            online_order_id = NEW.id,
            updated_at      = now()
        WHERE id IN (SELECT device_id FROM public.online_order_items
                     WHERE order_id = NEW.id AND device_id IS NOT NULL)
          AND (online_order_id = NEW.id OR (OLD.stock_state = 'released' AND status = 'available'));
        PERFORM public.set_device_event_context(NULL, NULL, NULL);

        NEW.stock_state := CASE WHEN _firm THEN 'committed' ELSE 'reserved' END;
        NEW.reservation_expires_at := _expires;
    END IF;

    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_online_order_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS online_orders_sync_stock ON public.online_orders;
CREATE TRIGGER online_orders_sync_stock
    BEFORE UPDATE OF status ON public.online_orders
    FOR EACH ROW EXECUTE FUNCTION public.sync_online_order_stock();


-- ---------------------------------------------------------------------
-- 2. release_expired_reservations()
-- ---------------------------------------------------------------------
-- Cancels pending web orders whose hold expired; the trigger above returns
-- the stock. Called every minute by pg_cron (below), and lazily at the start
-- of pos_checkout / place_online_order so expiry works without cron.
CREATE OR REPLACE FUNCTION public.release_expired_reservations(_merchant_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _cancelled integer;
BEGIN
    WITH expired AS (
        UPDATE public.online_orders
        SET status = 'cancelled',
            notes  = CONCAT_WS(E'\n', NULLIF(notes, ''), 'أُلغي تلقائياً: انتهت مهلة حجز المخزون')
        WHERE status = 'pending'
          AND stock_state = 'reserved'
          AND reservation_expires_at < now()
          AND (_merchant_id IS NULL OR merchant_id = _merchant_id)
        RETURNING 1
    )
    SELECT COUNT(*) INTO _cancelled FROM expired;

    -- Safety net: expired holds whose order no longer holds them.
    PERFORM public.set_device_event_context('reservation_released', NULL, NULL);
    UPDATE public.devices d
    SET status = 'available', reserved_until = NULL, online_order_id = NULL, updated_at = now()
    WHERE d.status = 'reserved'
      AND d.reserved_until < now()
      AND (_merchant_id IS NULL OR d.merchant_id = _merchant_id)
      AND NOT EXISTS (SELECT 1 FROM public.online_orders o
                      WHERE o.id = d.online_order_id
                        AND o.status = 'pending' AND o.stock_state = 'reserved');
    PERFORM public.set_device_event_context(NULL, NULL, NULL);

    RETURN _cancelled;
END;
$$;
REVOKE ALL ON FUNCTION public.release_expired_reservations(uuid) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. pos_checkout()
-- ---------------------------------------------------------------------
-- _items    : [{ "type": "device", "id": "<uuid>" },
--              { "type": "accessory", "id": "<uuid>", "quantity": 2 }]
-- _payments : [{ "method": "cash", "amount": 500 },
--              { "method": "mada", "amount": 650, "reference": "123456" }]
--             The sum must equal the invoice total. Cash change is handled at
--             the till: send the amount applied, not the cash tendered.
-- _discount : invoice-level discount, VAT-inclusive, 0 .. gross.
-- Customer  : _customer_id, or a phone (matched by phone_key, created if new).
-- _client_ref: optional id the till generates per checkout attempt. A repeat
--             with the same id returns the existing sale instead of selling
--             again: a response lost to a dropped connection can be retried,
--             online or from the offline queue, without a double sale.
--
-- Prices and costs always come from the database; client prices are never
-- read. Any failure raises, and the whole sale rolls back.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_ref uuid UNIQUE;

CREATE OR REPLACE FUNCTION public.pos_checkout(
    _branch_id      uuid,
    _items          jsonb,
    _payments       jsonb,
    _discount       numeric DEFAULT 0,
    _customer_id    uuid    DEFAULT NULL,
    _customer_name  text    DEFAULT NULL,
    _customer_phone text    DEFAULT NULL,
    _notes          text    DEFAULT NULL,
    _client_ref     uuid    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_vat_rate CONSTANT numeric := 0.15;
    _uid           uuid := auth.uid();
    _done          record;
    _merchant_id   uuid;
    _role          public.user_role;
    _user_branch   uuid;
    _vat_enabled   boolean;
    _device_ids    uuid[] := '{}';
    _acc_ids       uuid[] := '{}';
    _acc_qtys      integer[] := '{}';
    _bad           record;
    _acc           record;
    _gross         numeric := 0;
    _discount_amt  numeric;
    _total         numeric;
    _tax           numeric;
    _subtotal      numeric;
    _ratio         numeric;
    _pay           record;
    _pay_total     numeric := 0;
    _methods       text[] := '{}';
    _header_method public.payment_method;
    _cust_id       uuid;
    _cust_name     text;
    _cust_phone    text;
    _invoice       text;
    _sale_id       uuid;
    _sale_date     timestamptz;
BEGIN
    -- 1. Caller, branch, VAT setting -----------------------------------------
    IF _uid IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول' USING ERRCODE = '42501', HINT = 'NOT_AUTHENTICATED';
    END IF;

    SELECT mu.merchant_id, mu.role, mu.branch_id
    INTO _merchant_id, _role, _user_branch
    FROM public.merchant_users mu
    WHERE mu.user_id = _uid AND mu.is_active
    ORDER BY mu.created_at
    LIMIT 1;                                       -- same rule as get_user_merchant_id()

    IF _merchant_id IS NULL THEN
        RAISE EXCEPTION 'لا تملك صلاحية البيع' USING ERRCODE = '42501', HINT = 'NOT_AUTHORIZED';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branches
                   WHERE id = _branch_id AND merchant_id = _merchant_id AND COALESCE(is_active, true)) THEN
        RAISE EXCEPTION 'الفرع غير صالح' USING HINT = 'INVALID_BRANCH';
    END IF;

    IF _role = 'cashier' AND _user_branch IS NOT NULL AND _user_branch <> _branch_id THEN
        RAISE EXCEPTION 'لا يمكنك البيع من فرع آخر' USING ERRCODE = '42501', HINT = 'WRONG_BRANCH';
    END IF;

    SELECT COALESCE(vat_enabled, true) INTO _vat_enabled FROM public.merchants WHERE id = _merchant_id;

    -- Retry of a checkout that already went through: return it, sell nothing.
    IF _client_ref IS NOT NULL THEN
        SELECT * INTO _done FROM public.sales WHERE client_ref = _client_ref AND merchant_id = _merchant_id;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'sale_id', _done.id, 'invoice_number', _done.invoice_number, 'sale_date', _done.sale_date,
                'subtotal', _done.subtotal, 'tax_amount', _done.tax_amount,
                'discount_amount', _done.discount_amount, 'total_amount', _done.total_amount,
                'payment_method', _done.payment_method, 'customer_id', _done.customer_id,
                'vat_enabled', _vat_enabled, 'replayed', true);
        END IF;
    END IF;

    -- 2. Cart shape --------------------------------------------------------
    IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
        RAISE EXCEPTION 'السلة فارغة' USING HINT = 'EMPTY_CART';
    END IF;
    IF jsonb_array_length(_items) > 200 THEN
        RAISE EXCEPTION 'عدد العناصر كبير جداً' USING HINT = 'CART_TOO_LARGE';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(_items) e
               WHERE COALESCE(e->>'type', '') NOT IN ('device', 'accessory')
                  OR NULLIF(e->>'id', '') IS NULL) THEN
        RAISE EXCEPTION 'عنصر غير صالح في السلة' USING HINT = 'INVALID_ITEM';
    END IF;

    -- Expired web holds become sellable before we look at the devices.
    PERFORM public.release_expired_reservations(_merchant_id);

    -- 3. Devices: lock, then verify each unit is free at this branch -----
    SELECT COALESCE(array_agg((e->>'id')::uuid), '{}')
    INTO _device_ids
    FROM jsonb_array_elements(_items) e
    WHERE e->>'type' = 'device';

    IF cardinality(_device_ids) <> (SELECT COUNT(DISTINCT x) FROM unnest(_device_ids) x) THEN
        RAISE EXCEPTION 'الجهاز مكرر في السلة' USING HINT = 'DUPLICATE_DEVICE';
    END IF;

    PERFORM 1 FROM public.devices WHERE id = ANY(_device_ids) ORDER BY id FOR UPDATE;

    SELECT x AS id, d.imei, d.status, d.merchant_id
    INTO _bad
    FROM unnest(_device_ids) x
    LEFT JOIN public.devices d ON d.id = x
    WHERE d.id IS NULL
       OR d.merchant_id IS DISTINCT FROM _merchant_id
       OR d.status <> 'available'
       OR d.branch_id IS DISTINCT FROM _branch_id
    LIMIT 1;

    IF FOUND THEN
        IF _bad.imei IS NULL OR _bad.merchant_id IS DISTINCT FROM _merchant_id THEN
            RAISE EXCEPTION 'الجهاز غير موجود' USING HINT = 'DEVICE_NOT_FOUND';
        ELSIF _bad.status <> 'available' THEN
            RAISE EXCEPTION 'الجهاز % غير متاح للبيع (الحالة: %)', _bad.imei, _bad.status
                USING HINT = 'DEVICE_UNAVAILABLE';
        ELSE
            RAISE EXCEPTION 'الجهاز % تابع لفرع آخر', _bad.imei USING HINT = 'DEVICE_OTHER_BRANCH';
        END IF;
    END IF;

    SELECT COALESCE(SUM(price), 0) INTO _gross FROM public.devices WHERE id = ANY(_device_ids);

    -- 4. Accessories: one atomic conditional decrement per SKU -----------
    FOR _acc IN
        SELECT (e->>'id')::uuid AS id,
               SUM(COALESCE((e->>'quantity')::integer, 1)) AS qty
        FROM jsonb_array_elements(_items) e
        WHERE e->>'type' = 'accessory'
        GROUP BY 1
        ORDER BY 1
    LOOP
        IF _acc.qty IS NULL OR _acc.qty <= 0 THEN
            RAISE EXCEPTION 'كمية غير صالحة' USING HINT = 'INVALID_QUANTITY';
        END IF;

        UPDATE public.accessories
        SET quantity = quantity - _acc.qty, updated_at = now()
        WHERE id = _acc.id
          AND merchant_id = _merchant_id
          AND (branch_id = _branch_id OR branch_id IS NULL)
          AND quantity >= _acc.qty;

        IF NOT FOUND THEN
            SELECT name, quantity, branch_id INTO _bad
            FROM public.accessories WHERE id = _acc.id AND merchant_id = _merchant_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'المنتج غير موجود' USING HINT = 'ACCESSORY_NOT_FOUND';
            ELSIF _bad.branch_id IS NOT NULL AND _bad.branch_id <> _branch_id THEN
                RAISE EXCEPTION 'المنتج % تابع لفرع آخر', _bad.name USING HINT = 'ACCESSORY_OTHER_BRANCH';
            ELSE
                RAISE EXCEPTION 'الكمية غير كافية من % (المتوفر: %، المطلوب: %)', _bad.name, _bad.quantity, _acc.qty
                    USING HINT = 'INSUFFICIENT_STOCK';
            END IF;
        END IF;

        _acc_ids  := _acc_ids  || _acc.id;
        _acc_qtys := _acc_qtys || _acc.qty::integer;
    END LOOP;

    SELECT _gross + COALESCE(SUM(a.price * q.qty), 0)
    INTO _gross
    FROM unnest(_acc_ids, _acc_qtys) AS q(id, qty)
    JOIN public.accessories a ON a.id = q.id;

    -- 5. Totals (VAT-inclusive) --------------------------------------------
    _discount_amt := ROUND(COALESCE(_discount, 0), 2);
    IF _discount_amt < 0 OR _discount_amt > _gross THEN
        RAISE EXCEPTION 'قيمة الخصم غير صالحة' USING HINT = 'INVALID_DISCOUNT';
    END IF;

    _total    := ROUND(_gross - _discount_amt, 2);
    _tax      := CASE WHEN _vat_enabled THEN ROUND(_total * c_vat_rate / (1 + c_vat_rate), 2) ELSE 0 END;
    _subtotal := _total - _tax;
    _ratio    := CASE WHEN _gross > 0 THEN _discount_amt / _gross ELSE 0 END;

    -- 6. Tender lines ----------------------------------------------------------
    IF _payments IS NULL OR jsonb_typeof(_payments) <> 'array' THEN
        _payments := '[]'::jsonb;
    END IF;

    FOR _pay IN
        SELECT e->>'method' AS method, ROUND((e->>'amount')::numeric, 2) AS amount
        FROM jsonb_array_elements(_payments) e
    LOOP
        IF _pay.method IN ('store_credit', 'trade_in') THEN
            RAISE EXCEPTION 'طريقة الدفع غير مفعلة بعد' USING HINT = 'PAYMENT_METHOD_NOT_ENABLED';
        ELSIF _pay.method IS NULL
              OR _pay.method NOT IN ('cash', 'card', 'mada', 'apple_pay', 'stc_pay', 'bank_transfer') THEN
            RAISE EXCEPTION 'طريقة دفع غير صالحة' USING HINT = 'INVALID_PAYMENT_METHOD';
        ELSIF _pay.amount IS NULL OR _pay.amount <= 0 THEN
            RAISE EXCEPTION 'مبلغ دفع غير صالح' USING HINT = 'INVALID_PAYMENT_AMOUNT';
        END IF;
        _pay_total := _pay_total + _pay.amount;
        IF NOT (_pay.method = ANY(_methods)) THEN
            _methods := _methods || _pay.method;
        END IF;
    END LOOP;

    IF _total > 0 AND cardinality(_methods) = 0 THEN
        RAISE EXCEPTION 'حدد طريقة الدفع' USING HINT = 'PAYMENT_REQUIRED';
    END IF;
    IF _pay_total <> _total THEN
        RAISE EXCEPTION 'مجموع المدفوعات (%) لا يساوي إجمالي الفاتورة (%)', _pay_total, _total
            USING HINT = 'PAYMENT_MISMATCH';
    END IF;

    _header_method := CASE
        WHEN cardinality(_methods) = 0 THEN 'cash'
        WHEN cardinality(_methods) = 1 THEN _methods[1]::public.payment_method
        ELSE 'mixed'
    END;

    -- 7. Customer ----------------------------------------------------------------
    IF _customer_id IS NOT NULL THEN
        SELECT id, name, phone INTO _cust_id, _cust_name, _cust_phone
        FROM public.customers WHERE id = _customer_id AND merchant_id = _merchant_id;
        IF _cust_id IS NULL THEN
            RAISE EXCEPTION 'العميل غير موجود' USING HINT = 'CUSTOMER_NOT_FOUND';
        END IF;
    ELSIF public.phone_key(_customer_phone) IS NOT NULL THEN
        SELECT id, name, phone INTO _cust_id, _cust_name, _cust_phone
        FROM public.customers
        WHERE merchant_id = _merchant_id AND public.phone_key(phone) = public.phone_key(_customer_phone)
        ORDER BY created_at
        LIMIT 1;

        IF _cust_id IS NULL THEN
            INSERT INTO public.customers (merchant_id, name, phone)
            VALUES (_merchant_id,
                    COALESCE(NULLIF(TRIM(_customer_name), ''), TRIM(_customer_phone)),
                    TRIM(_customer_phone))
            RETURNING id, name, phone INTO _cust_id, _cust_name, _cust_phone;
        END IF;
    END IF;

    -- 8. Header ------------------------------------------------------------------
    -- sync_offline_sale() replays a sale made offline under the number already printed
    -- for the customer (OFF-T1-000001); it passes it through a transaction-local setting.
    -- API requests can't set it, and every other sale takes the branch's next number.
    _invoice := COALESCE(NULLIF(current_setting('wasel.offline_invoice', true), ''),
                         public.next_document_number(_merchant_id, 'sales_invoice', _branch_id));

    INSERT INTO public.sales (
        merchant_id, branch_id, invoice_number, customer_id, customer_name, customer_phone,
        subtotal, tax_amount, discount_amount, total_amount,
        payment_method, payment_status, notes, sold_by, client_ref
    ) VALUES (
        _merchant_id, _branch_id, _invoice, _cust_id,
        COALESCE(NULLIF(TRIM(_customer_name), ''), _cust_name),
        COALESCE(NULLIF(TRIM(_customer_phone), ''), _cust_phone),
        _subtotal, _tax, _discount_amt, _total,
        _header_method, 'paid', NULLIF(TRIM(_notes), ''), _uid, _client_ref
    )
    RETURNING id, sale_date INTO _sale_id, _sale_date;

    -- 9. Lines with snapshots. The invoice discount is spread across lines
    --    pro rata. The header totals are authoritative: per-line rounding
    --    may differ from them by a few halalas.
    INSERT INTO public.sale_items (
        sale_id, device_id, quantity, unit_price, cost_at_sale,
        item_name, imei_snapshot, line_discount, vat_amount, line_total
    )
    SELECT _sale_id, d.id, 1, d.price, d.cost,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.brand, d.model, d.storage, d.color)), ''), d.model),
           d.imei,
           ld.disc,
           CASE WHEN _vat_enabled THEN ROUND((d.price - ld.disc) * c_vat_rate / (1 + c_vat_rate), 2) ELSE 0 END,
           d.price - ld.disc
    FROM public.devices d
    CROSS JOIN LATERAL (SELECT ROUND(d.price * _ratio, 2) AS disc) ld
    WHERE d.id = ANY(_device_ids);

    INSERT INTO public.sale_items (
        sale_id, accessory_id, quantity, unit_price, cost_at_sale,
        item_name, sku_snapshot, line_discount, vat_amount, line_total
    )
    SELECT _sale_id, a.id, q.qty, a.price, a.cost,
           a.name, a.sku,
           ld.disc,
           CASE WHEN _vat_enabled THEN ROUND((a.price * q.qty - ld.disc) * c_vat_rate / (1 + c_vat_rate), 2) ELSE 0 END,
           a.price * q.qty - ld.disc
    FROM unnest(_acc_ids, _acc_qtys) AS q(id, qty)
    JOIN public.accessories a ON a.id = q.id
    CROSS JOIN LATERAL (SELECT ROUND(a.price * q.qty * _ratio, 2) AS disc) ld;

    -- 10. Devices -> sold (the ledger trigger records ref = this sale) -------
    PERFORM public.set_device_event_context('sold', 'sales', _sale_id);
    UPDATE public.devices
    SET status = 'sold', reserved_until = NULL, online_order_id = NULL, updated_at = now()
    WHERE id = ANY(_device_ids);
    PERFORM public.set_device_event_context(NULL, NULL, NULL);

    -- 11. Tender lines ---------------------------------------------------------
    INSERT INTO public.sale_payments (sale_id, method, amount, reference)
    SELECT _sale_id, (e->>'method')::public.payment_method,
           ROUND((e->>'amount')::numeric, 2), NULLIF(TRIM(e->>'reference'), '')
    FROM jsonb_array_elements(_payments) e;

    -- 12. Customer stats -------------------------------------------------------
    IF _cust_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_spent = total_spent + _total,
            total_purchases = total_purchases + 1,
            updated_at = now()
        WHERE id = _cust_id;
    END IF;

    RETURN jsonb_build_object(
        'sale_id',         _sale_id,
        'invoice_number',  _invoice,
        'sale_date',       _sale_date,
        'subtotal',        _subtotal,
        'tax_amount',      _tax,
        'discount_amount', _discount_amt,
        'total_amount',    _total,
        'payment_method',  _header_method,
        'customer_id',     _cust_id,
        'vat_enabled',     _vat_enabled
    );
END;
$$;
REVOKE ALL ON FUNCTION public.pos_checkout(uuid, jsonb, jsonb, numeric, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_checkout(uuid, jsonb, jsonb, numeric, uuid, text, text, text, uuid) TO authenticated;


-- ---------------------------------------------------------------------
-- 4. place_online_order()   (callable by anonymous shoppers)
-- ---------------------------------------------------------------------
-- _items : [{ "device_id": "<uuid>" }, { "accessory_id": "<uuid>", "quantity": 2 }]
-- Prices come from the database; any price sent by the browser is ignored.
-- Devices move to 'reserved' for store_settings.reservation_ttl_minutes, and
-- accessories are deducted at once (restocked if the order is cancelled or
-- expires).
--
-- Order totals (all VAT-inclusive):
--   subtotal      = Σ item prices
--   shipping_cost = store shipping (0 above the free-shipping threshold)
--   total_amount  = subtotal + shipping_cost
--   tax_amount    = VAT contained in total_amount
CREATE OR REPLACE FUNCTION public.place_online_order(
    _slug             text,
    _customer_name    text,
    _customer_phone   text,
    _shipping_address text,
    _shipping_city    text,
    _payment_method   text,
    _items            jsonb,
    _customer_email   text DEFAULT NULL,
    _notes            text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c_vat_rate CONSTANT numeric := 0.15;
    c_max_pending_per_phone CONSTANT integer := 3;
    _store        record;
    _merchant_id  uuid;
    _vat_enabled  boolean;
    _device_ids   uuid[] := '{}';
    _acc_ids      uuid[] := '{}';
    _acc_qtys     integer[] := '{}';
    _bad          record;
    _acc          record;
    _gross        numeric := 0;
    _shipping     numeric;
    _total        numeric;
    _tax          numeric;
    _expires      timestamptz;
    _order_id     uuid;
    _order_number text;
BEGIN
    -- 1. Store and inputs -----------------------------------------------------
    SELECT merchant_id, shipping_cost, free_shipping_threshold, reservation_ttl_minutes
    INTO _store
    FROM public.store_settings
    WHERE slug = _slug AND is_published = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'المتجر غير موجود' USING HINT = 'STORE_NOT_FOUND';
    END IF;
    _merchant_id := _store.merchant_id;

    IF NULLIF(TRIM(_customer_name), '') IS NULL OR public.phone_key(_customer_phone) IS NULL THEN
        RAISE EXCEPTION 'عبّئ الاسم ورقم الجوال' USING HINT = 'CUSTOMER_REQUIRED';
    END IF;
    IF NULLIF(TRIM(_shipping_address), '') IS NULL OR NULLIF(TRIM(_shipping_city), '') IS NULL THEN
        RAISE EXCEPTION 'عبّئ العنوان والمدينة' USING HINT = 'ADDRESS_REQUIRED';
    END IF;
    IF length(_customer_name) > 200 OR length(_customer_phone) > 30
       OR length(_shipping_address) > 1000 OR length(_shipping_city) > 120
       OR length(COALESCE(_customer_email, '')) > 254 OR length(COALESCE(_notes, '')) > 2000 THEN
        RAISE EXCEPTION 'البيانات المدخلة طويلة جداً' USING HINT = 'INPUT_TOO_LONG';
    END IF;
    IF COALESCE(_payment_method, '') NOT IN ('bank_transfer', 'cod', 'apple_pay', 'mada', 'card') THEN
        RAISE EXCEPTION 'طريقة دفع غير صالحة' USING HINT = 'INVALID_PAYMENT_METHOD';
    END IF;
    IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
        RAISE EXCEPTION 'السلة فارغة' USING HINT = 'EMPTY_CART';
    END IF;
    IF jsonb_array_length(_items) > 50 THEN
        RAISE EXCEPTION 'عدد العناصر كبير جداً' USING HINT = 'CART_TOO_LARGE';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(_items) e
               WHERE (NULLIF(e->>'device_id', '') IS NULL) = (NULLIF(e->>'accessory_id', '') IS NULL)) THEN
        RAISE EXCEPTION 'عنصر غير صالح في السلة' USING HINT = 'INVALID_ITEM';
    END IF;

    -- Anyone can call this, so cap the stock a single phone can hold.
    IF (SELECT COUNT(*) FROM public.online_orders
        WHERE merchant_id = _merchant_id
          AND status = 'pending' AND stock_state = 'reserved'
          AND public.phone_key(customer_phone) = public.phone_key(_customer_phone)) >= c_max_pending_per_phone THEN
        RAISE EXCEPTION 'لديك طلبات معلّقة بانتظار التأكيد، حاول لاحقاً' USING HINT = 'TOO_MANY_PENDING_ORDERS';
    END IF;

    SELECT COALESCE(vat_enabled, true) INTO _vat_enabled FROM public.merchants WHERE id = _merchant_id;

    PERFORM public.release_expired_reservations(_merchant_id);

    -- 2. Devices: lock and verify -----------------------------------------
    SELECT COALESCE(array_agg((e->>'device_id')::uuid), '{}')
    INTO _device_ids
    FROM jsonb_array_elements(_items) e
    WHERE NULLIF(e->>'device_id', '') IS NOT NULL;

    IF cardinality(_device_ids) <> (SELECT COUNT(DISTINCT x) FROM unnest(_device_ids) x) THEN
        RAISE EXCEPTION 'الجهاز مكرر في السلة' USING HINT = 'DUPLICATE_DEVICE';
    END IF;

    PERFORM 1 FROM public.devices WHERE id = ANY(_device_ids) ORDER BY id FOR UPDATE;

    SELECT x AS id, d.model, d.status
    INTO _bad
    FROM unnest(_device_ids) x
    LEFT JOIN public.devices d ON d.id = x AND d.merchant_id = _merchant_id
    WHERE d.id IS NULL OR d.status <> 'available'
    LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'عذراً، الجهاز % لم يعد متوفراً', COALESCE(_bad.model, '')
            USING HINT = 'DEVICE_UNAVAILABLE';
    END IF;

    SELECT COALESCE(SUM(price), 0) INTO _gross FROM public.devices WHERE id = ANY(_device_ids);

    -- 3. Accessories: atomic conditional decrement --------------------------
    FOR _acc IN
        SELECT (e->>'accessory_id')::uuid AS id,
               SUM(COALESCE((e->>'quantity')::integer, 1)) AS qty
        FROM jsonb_array_elements(_items) e
        WHERE NULLIF(e->>'accessory_id', '') IS NOT NULL
        GROUP BY 1
        ORDER BY 1
    LOOP
        IF _acc.qty IS NULL OR _acc.qty <= 0 OR _acc.qty > 100 THEN
            RAISE EXCEPTION 'كمية غير صالحة' USING HINT = 'INVALID_QUANTITY';
        END IF;

        UPDATE public.accessories
        SET quantity = quantity - _acc.qty, updated_at = now()
        WHERE id = _acc.id AND merchant_id = _merchant_id AND quantity >= _acc.qty;

        IF NOT FOUND THEN
            SELECT name, quantity INTO _bad
            FROM public.accessories WHERE id = _acc.id AND merchant_id = _merchant_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'المنتج غير موجود' USING HINT = 'ACCESSORY_NOT_FOUND';
            END IF;
            RAISE EXCEPTION 'الكمية المتوفرة من % هي % فقط', _bad.name, _bad.quantity
                USING HINT = 'INSUFFICIENT_STOCK';
        END IF;

        _acc_ids  := _acc_ids  || _acc.id;
        _acc_qtys := _acc_qtys || _acc.qty::integer;
    END LOOP;

    SELECT _gross + COALESCE(SUM(a.price * q.qty), 0)
    INTO _gross
    FROM unnest(_acc_ids, _acc_qtys) AS q(id, qty)
    JOIN public.accessories a ON a.id = q.id;

    -- 4. Totals --------------------------------------------------------------
    _shipping := CASE
        WHEN COALESCE(_store.free_shipping_threshold, 0) > 0 AND _gross >= _store.free_shipping_threshold THEN 0
        ELSE COALESCE(_store.shipping_cost, 0)
    END;
    _total   := ROUND(_gross + _shipping, 2);
    _tax     := CASE WHEN _vat_enabled THEN ROUND(_total * c_vat_rate / (1 + c_vat_rate), 2) ELSE 0 END;
    _expires := now() + make_interval(mins => COALESCE(_store.reservation_ttl_minutes, 30));

    -- 5. Order + lines -------------------------------------------------------
    _order_number := public.next_document_number(_merchant_id, 'online_order', NULL);

    INSERT INTO public.online_orders (
        merchant_id, order_number, status,
        customer_name, customer_phone, customer_email,
        shipping_address, shipping_city, shipping_cost,
        payment_method, payment_status,
        subtotal, tax_amount, discount_amount, total_amount, notes,
        stock_state, reservation_expires_at
    ) VALUES (
        _merchant_id, _order_number, 'pending',
        TRIM(_customer_name), TRIM(_customer_phone), NULLIF(TRIM(_customer_email), ''),
        TRIM(_shipping_address), TRIM(_shipping_city), _shipping,
        _payment_method, 'unpaid',
        _gross, _tax, 0, _total, NULLIF(TRIM(_notes), ''),
        'reserved', _expires
    )
    RETURNING id INTO _order_id;

    INSERT INTO public.online_order_items (order_id, device_id, item_name, quantity, unit_price)
    SELECT _order_id, d.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.brand, d.model, d.storage, d.color)), ''), d.model),
           1, d.price
    FROM public.devices d
    WHERE d.id = ANY(_device_ids);

    INSERT INTO public.online_order_items (order_id, accessory_id, item_name, quantity, unit_price)
    SELECT _order_id, a.id, a.name, q.qty, a.price
    FROM unnest(_acc_ids, _acc_qtys) AS q(id, qty)
    JOIN public.accessories a ON a.id = q.id;

    -- 6. Hold the devices ---------------------------------------------------
    PERFORM public.set_device_event_context('reserved', 'online_orders', _order_id);
    UPDATE public.devices
    SET status = 'reserved', reserved_until = _expires, online_order_id = _order_id, updated_at = now()
    WHERE id = ANY(_device_ids);
    PERFORM public.set_device_event_context(NULL, NULL, NULL);

    RETURN jsonb_build_object(
        'order_number',           _order_number,
        'subtotal',               _gross,
        'tax_amount',             _tax,
        'shipping_cost',          _shipping,
        'discount_amount',        0,
        'total_amount',           _total,
        'reservation_expires_at', _expires,
        'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                         'item_name', item_name, 'quantity', quantity, 'unit_price', unit_price,
                         'device_id', device_id, 'accessory_id', accessory_id)), '[]'::jsonb)
                  FROM public.online_order_items WHERE order_id = _order_id)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.place_online_order(text, text, text, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_online_order(text, text, text, text, text, text, jsonb, text, text) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. track_public_order()   (callable by anonymous shoppers)
-- ---------------------------------------------------------------------
-- Checks the phone server-side and returns only what the tracking page
-- needs (no address, phone or email). "Not found" and "wrong phone" return
-- the same NULL, so order numbers can't be enumerated.
CREATE OR REPLACE FUNCTION public.track_public_order(
    _slug         text,
    _order_number text,
    _phone        text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _given  text := regexp_replace(translate(COALESCE(_phone, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[^0-9]', '', 'g');
    _stored text;
    _o      public.online_orders%ROWTYPE;
BEGIN
    IF length(_given) < 4 THEN
        RETURN NULL;
    END IF;

    SELECT o.* INTO _o
    FROM public.online_orders o
    JOIN public.store_settings s ON s.merchant_id = o.merchant_id
    WHERE s.slug = _slug AND o.order_number = TRIM(_order_number);
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    _stored := regexp_replace(translate(COALESCE(_o.customer_phone, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[^0-9]', '', 'g');
    -- 4-8 digits: must equal the end of the stored number. A full number in
    -- any format (05..., 9665..., +966 5...) compares on the last 9 digits.
    IF length(_given) >= 9 THEN
        IF right(_stored, 9) <> right(_given, 9) THEN
            RETURN NULL;
        END IF;
    ELSIF right(_stored, length(_given)) <> _given THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'order', jsonb_build_object(
            'order_number',      _o.order_number,
            'status',            _o.status,
            'payment_status',    _o.payment_status,
            'payment_method',    _o.payment_method,
            'shipping_provider', _o.shipping_provider,
            'tracking_number',   _o.tracking_number,
            'shipping_city',     _o.shipping_city,
            'shipping_cost',     _o.shipping_cost,
            'subtotal',          _o.subtotal,
            'tax_amount',        _o.tax_amount,
            'discount_amount',   _o.discount_amount,
            'total_amount',      _o.total_amount,
            'customer_name',     _o.customer_name,
            'created_at',        _o.created_at,
            'updated_at',        _o.updated_at
        ),
        'items', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                         'id', i.id, 'item_name', i.item_name, 'item_image', i.item_image,
                         'quantity', i.quantity, 'unit_price', i.unit_price)
                         ORDER BY i.created_at), '[]'::jsonb)
                  FROM public.online_order_items i WHERE i.order_id = _o.id)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.track_public_order(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_public_order(text, text, text) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. D6 · Close the direct-insert holes
-- ---------------------------------------------------------------------
-- Shoppers now go through place_online_order(). Merchants keep full access
-- through "Merchants manage their orders".
DROP POLICY IF EXISTS "Anyone can place orders"              ON public.online_orders;
DROP POLICY IF EXISTS "Authenticated can place orders"       ON public.online_orders;
DROP POLICY IF EXISTS "Anyone can create order items"        ON public.online_order_items;
DROP POLICY IF EXISTS "Authenticated can create order items" ON public.online_order_items;


-- ---------------------------------------------------------------------
-- 7. Schedule the reservation sweeper (pg_cron), when available
-- ---------------------------------------------------------------------
-- Without pg_cron, expiry still happens lazily on the next checkout or web
-- order of that merchant.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        PERFORM cron.schedule(
            'wasel-release-expired-reservations',
            '* * * * *',
            'SELECT public.release_expired_reservations();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not scheduled (%). Enable pg_cron and run: SELECT cron.schedule(''wasel-release-expired-reservations'', ''* * * * *'', ''SELECT public.release_expired_reservations();'');', SQLERRM;
END;
$$;
