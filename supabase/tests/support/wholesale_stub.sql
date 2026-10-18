-- =====================================================================
-- TEST ONLY: the wholesale_* tables exist in production but their CREATE
-- statements were never committed to supabase/migrations (schema drift).
-- Migration 20260309011255 depends on them, so the runner applies this
-- stub right before it. Delete this file once the real migration exists.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.wholesale_listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES public.merchants(id),
    device_id uuid, accessory_id uuid,
    item_type text NOT NULL DEFAULT 'device',
    wholesale_price numeric NOT NULL DEFAULT 0,
    min_quantity int NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wholesale_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL,
    supplier_merchant_id uuid NOT NULL REFERENCES public.merchants(id),
    buyer_merchant_id uuid NOT NULL REFERENCES public.merchants(id),
    status text NOT NULL DEFAULT 'pending',
    total_amount numeric NOT NULL DEFAULT 0,
    notes text, created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wholesale_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.wholesale_orders(id),
    listing_id uuid NOT NULL REFERENCES public.wholesale_listings(id),
    quantity int NOT NULL DEFAULT 1,
    unit_price numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
