-- =====================================================================
-- Phase 1 · IMEI ledger (device_events) and reservation columns
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Reservation columns
-- ---------------------------------------------------------------------
-- devices.online_order_id: the online order currently holding the unit
-- (status 'reserved') or the one that sold it (status 'sold').
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS reserved_until  timestamptz,
    ADD COLUMN IF NOT EXISTS online_order_id uuid REFERENCES public.online_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS devices_reserved_until_idx
    ON public.devices (reserved_until) WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS devices_online_order_id_idx
    ON public.devices (online_order_id) WHERE online_order_id IS NOT NULL;

-- online_orders.stock_state tracks what the order holds:
--   none      legacy order, never touched stock
--   reserved  devices reserved / accessories deducted, awaiting confirmation
--   committed confirmed: devices sold
--   released  cancelled / refunded / expired: stock returned
ALTER TABLE public.online_orders
    ADD COLUMN IF NOT EXISTS stock_state text NOT NULL DEFAULT 'none'
        CHECK (stock_state IN ('none', 'reserved', 'committed', 'released')),
    ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS online_orders_reservation_expiry_idx
    ON public.online_orders (reservation_expires_at)
    WHERE status = 'pending' AND stock_state = 'reserved';

-- How long an unconfirmed web order holds stock. 30 min by default; shops
-- that wait for bank transfers can raise it (e.g. 1440 = 24 h).
ALTER TABLE public.store_settings
    ADD COLUMN IF NOT EXISTS reservation_ttl_minutes integer NOT NULL DEFAULT 30
        CHECK (reservation_ttl_minutes BETWEEN 5 AND 10080);


-- ---------------------------------------------------------------------
-- 2. device_events: append-only lifecycle of every IMEI
-- ---------------------------------------------------------------------
-- Rows are written only by the trigger below, so every path (POS, web
-- orders, transfers, PO receiving, manual edits) is captured. There is no
-- FK on device_id on purpose: history must outlive a deleted device row,
-- and the IMEI is snapshotted for that reason.
CREATE TABLE IF NOT EXISTS public.device_events (
    id          bigserial PRIMARY KEY,
    device_id   uuid NOT NULL,
    merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    imei        text,
    event       text NOT NULL,     -- received, sold, reserved, reservation_released, returned,
                                   -- transfer_out, transfer_in, branch_changed, repair_in, repair_out, ...
    from_status text,
    to_status   text,
    from_branch uuid,
    to_branch   uuid,
    ref_table   text,              -- sales, online_orders, stock_transfers, purchase_orders, ...
    ref_id      uuid,
    actor       uuid,              -- auth.uid() (NULL for anonymous web orders / cron)
    metadata    jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_events_device_idx   ON public.device_events (device_id, created_at);
CREATE INDEX IF NOT EXISTS device_events_merchant_idx ON public.device_events (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS device_events_imei_idx     ON public.device_events (merchant_id, imei);
CREATE INDEX IF NOT EXISTS device_events_ref_idx      ON public.device_events (ref_table, ref_id);

ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;

-- Read-only: no INSERT/UPDATE/DELETE policies, so the ledger is immutable
-- from the API.
CREATE POLICY "Merchants view their device events" ON public.device_events
    FOR SELECT TO authenticated
    USING (merchant_id = get_user_merchant_id());

CREATE POLICY "Platform admins view device events" ON public.device_events
    FOR SELECT TO authenticated
    USING (is_platform_admin());

-- RPCs describe the business reason for the next device changes through
-- transaction-local settings, which the trigger reads.
CREATE OR REPLACE FUNCTION public.set_device_event_context(
    _event     text,
    _ref_table text,
    _ref_id    uuid
) RETURNS void
LANGUAGE sql
AS $$
    SELECT set_config('wasel.device_event',     COALESCE(_event, ''),        true),
           set_config('wasel.device_ref_table', COALESCE(_ref_table, ''),    true),
           set_config('wasel.device_ref_id',    COALESCE(_ref_id::text, ''), true);
$$;
REVOKE ALL ON FUNCTION public.set_device_event_context(text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_device_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _ctx_event text := NULLIF(current_setting('wasel.device_event', true), '');
    _ref_table text := NULLIF(current_setting('wasel.device_ref_table', true), '');
    _ref_id    uuid := NULLIF(current_setting('wasel.device_ref_id', true), '')::uuid;
    _event     text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        _event := COALESCE(_ctx_event, 'received');
        IF _ref_table IS NULL AND NEW.purchase_id IS NOT NULL THEN
            _ref_table := 'purchase_orders';
            _ref_id := NEW.purchase_id;
        END IF;
        INSERT INTO public.device_events
            (device_id, merchant_id, imei, event, to_status, to_branch, ref_table, ref_id, actor)
        VALUES (NEW.id, NEW.merchant_id, NEW.imei, _event, NEW.status::text, NEW.branch_id,
                _ref_table, _ref_id, auth.uid());
        RETURN NEW;
    END IF;

    IF NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.branch_id IS NOT DISTINCT FROM OLD.branch_id THEN
        RETURN NEW;                       -- price/notes edits are not lifecycle events
    END IF;

    _event := COALESCE(_ctx_event, CASE
        WHEN NEW.status = 'sold'        AND OLD.status <> 'sold'        THEN 'sold'
        WHEN NEW.status = 'reserved'    AND OLD.status <> 'reserved'    THEN 'reserved'
        WHEN NEW.status = 'repair'      AND OLD.status <> 'repair'      THEN 'repair_in'
        WHEN NEW.status = 'transferred' AND OLD.status <> 'transferred' THEN 'transfer_out'
        WHEN NEW.status = 'available' AND OLD.status = 'reserved'    THEN 'reservation_released'
        WHEN NEW.status = 'available' AND OLD.status = 'sold'        THEN 'returned'
        WHEN NEW.status = 'available' AND OLD.status = 'repair'      THEN 'repair_out'
        WHEN NEW.status = 'available' AND OLD.status = 'transferred' THEN 'transfer_in'
        WHEN NEW.branch_id IS DISTINCT FROM OLD.branch_id            THEN 'branch_changed'
        ELSE 'status_changed'
    END);

    INSERT INTO public.device_events
        (device_id, merchant_id, imei, event, from_status, to_status, from_branch, to_branch,
         ref_table, ref_id, actor)
    VALUES (NEW.id, NEW.merchant_id, NEW.imei, _event, OLD.status::text, NEW.status::text,
            OLD.branch_id, NEW.branch_id, _ref_table, _ref_id, auth.uid());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS devices_log_event ON public.devices;
CREATE TRIGGER devices_log_event
    AFTER INSERT OR UPDATE OF status, branch_id ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.log_device_event();

-- Baseline history for devices that existed before the ledger.
INSERT INTO public.device_events
    (device_id, merchant_id, imei, event, to_status, to_branch, ref_table, ref_id, metadata, created_at)
SELECT d.id, d.merchant_id, d.imei, 'received', 'available', d.branch_id,
       CASE WHEN d.purchase_id IS NOT NULL THEN 'purchase_orders' END, d.purchase_id,
       '{"backfill": true}'::jsonb, d.created_at
FROM public.devices d
WHERE NOT EXISTS (SELECT 1 FROM public.device_events e WHERE e.device_id = d.id);

INSERT INTO public.device_events
    (device_id, merchant_id, imei, event, from_status, to_status, to_branch,
     ref_table, ref_id, actor, metadata, created_at)
SELECT d.id, d.merchant_id, d.imei, 'sold', 'available', 'sold', s.branch_id,
       'sales', s.id, s.sold_by, '{"backfill": true}'::jsonb, s.sale_date
FROM public.sale_items si
JOIN public.sales s   ON s.id = si.sale_id
JOIN public.devices d ON d.id = si.device_id
WHERE NOT EXISTS (SELECT 1 FROM public.device_events e
                  WHERE e.device_id = d.id AND e.event = 'sold' AND e.ref_id = s.id);
