-- =====================================================================
-- Phase 0 · Enum values
-- ---------------------------------------------------------------------
-- New enum values live in their own migration: Postgres does not allow a
-- value added with ALTER TYPE ... ADD VALUE to be *used* inside the same
-- transaction, and the following migrations reference these values.
-- =====================================================================

-- Payment methods used by the POS tender lines (sale_payments).
-- 'store_credit' and 'trade_in' are reserved for the upcoming store-credit
-- and trade-in modules; pos_checkout rejects them until those exist.
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'mada';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'apple_pay';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'stc_pay';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'store_credit';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'trade_in';

-- D8: the app already writes 'warranty_expired' (useRepairs.ts), which
-- failed because the value did not exist. 'ready' = ready for pickup.
ALTER TYPE public.repair_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'completed';
ALTER TYPE public.repair_status ADD VALUE IF NOT EXISTS 'warranty_expired';
