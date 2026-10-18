# Phase 0 & 1: Transactional Core

This change set implements Phase 0 and Phase 1 of
[`mobile-retail-gap-analysis.md`](./mobile-retail-gap-analysis.md).

## What changed

### Database (`supabase/migrations/`)

| File | Purpose |
|---|---|
| `20261018100000_phase0_enum_values.sql` | `payment_method` gains `mada`, `apple_pay`, `stc_pay`, `store_credit`, `trade_in`. `repair_status` gains `ready` and `warranty_expired` (D8). These live in their own file because Postgres can't use a new enum value in the transaction that adds it. |
| `20261018100100_phase0_vat_invoices_customers.sql` | D1 VAT data fix (with backup table and daily-closing correction). `invoice_sequences` and `next_document_number()` (D7). `UNIQUE(merchant_id, invoice_number)` and `UNIQUE(merchant_id, order_number)`. `customer_id` FK on `sales` and `repair_orders`, backfilled by phone. `sale_payments` (split tender). Snapshot columns on `sale_items`. |
| `20261018100200_phase1_device_ledger_reservations.sql` | `device_events` IMEI ledger, written by a trigger on `devices`, with a backfill. Reservation columns on `devices` and `online_orders`. `store_settings.reservation_ttl_minutes` (default 30). |
| `20261018100300_phase1_transactional_core.sql` | `pos_checkout()`, `place_online_order()`, `track_public_order()`, `release_expired_reservations()`, the order-status → stock trigger, removal of the anonymous INSERT policies (D6), and the pg_cron schedule. |

**Pricing convention (system-wide):** every shelf price and shipping fee is VAT-inclusive.

- POS sale:
  - `total = Σ price × qty − discount`
  - `tax = round(total × 15/115, 2)`
  - `subtotal = total − tax`
- Web order:
  - `subtotal = Σ item prices` (gross)
  - `total = subtotal + shipping`
  - `tax` = the VAT contained in `total`
- Merchants with `vat_enabled = false` get `tax = 0`.

### Frontend

- `useSales.createSale` makes a single `pos_checkout` RPC call. The invoice shows the server's totals, the split-tender lines, and the sale timestamp in the ZATCA QR.
- `CartPanel` adds Mada, Apple Pay and STC Pay, plus a split-payment editor ("مختلط") that must add up to the total.
- `usePOSInventory` scopes IMEI and SKU lookups to the current branch (D10).
- `useOnlineStore.placeOrder` calls `place_online_order`. `trackPublicOrder(slug, order, phone)` calls `track_public_order`.
- The storefront cart, checkout and order pages show VAT-inclusive totals.
- Daily closings and the dashboard summary bucket revenue from `sale_payments`, with legacy sales falling back to the header method.
- Shared helpers live in `src/lib/payments.ts` and `src/lib/vat.ts`, with unit tests in `src/test/payments-vat.test.ts`.

## How the core behaves

- **No double selling.**
  - Both RPCs lock the devices (`SELECT … FOR UPDATE`, ordered by id) and require `status = 'available'`.
  - A web order moves devices to `reserved` for `reservation_ttl_minutes`, and the POS refuses reserved units.
- **Atomic.** Any error (unit already sold, insufficient stock, tenders ≠ total, wrong branch) raises, and the whole sale or order rolls back.
- **Server pricing.** Client prices are never read. Accessory stock is decremented with `UPDATE … WHERE quantity >= n`.
- **Order lifecycle drives stock.** This works whatever page or user changes the status:

  | Order status | Stock effect |
  |---|---|
  | `pending` | devices reserved, with TTL |
  | `confirmed` / `processing` / `shipped` / `delivered` | devices sold |
  | `cancelled` / `refunded` | devices available, accessories restocked |
  | re-opened after cancellation | stock taken again, or the change fails if a unit was sold meanwhile |

- **Reservation expiry.**
  - pg_cron calls `release_expired_reservations()` every minute.
  - Each merchant's next checkout or web order also releases expired holds, so expiry works without cron.
- **Invoice numbers.**
  - POS invoices: `INV-B1-000001`, sequential per branch.
  - Web orders: `ORD-000001`, sequential per merchant.
  - Numbers come from a row-locked counter, so a rolled-back sale also rolls back its number.
- **Errors.** Messages are in Arabic and shown as-is in the UI. A stable code is in `HINT` (e.g. `DEVICE_UNAVAILABLE`, `PAYMENT_MISMATCH`).

## Applying the migrations

> **Order matters.** Apply the migrations, then deploy the frontend right away. Between the two steps the old storefront can't place orders, because direct inserts are now blocked.

1. **Back up first:** `supabase db dump --linked -f backup-before-phase1.sql` (or take a dashboard backup).
2. **Local / staging:**
   ```sh
   supabase start
   supabase db reset          # rebuilds local DB from all migrations
   # or, on an existing local DB:
   supabase migration up
   ```
3. **Production:**
   ```sh
   supabase link --project-ref <project-ref>
   supabase db push            # applies the four 20261018* files, each in its own transaction
   ```
   Without the CLI, paste the four files into the SQL editor **one at a time, in filename order**.
4. **pg_cron.** If the last migration printed `pg_cron not scheduled`, enable *pg_cron* under Database → Extensions, then run:
   ```sql
   SELECT cron.schedule('wasel-release-expired-reservations', '* * * * *',
                        'SELECT public.release_expired_reservations();');
   ```
5. **Types (optional).** `src/integrations/supabase/types.ts` was patched by hand to match. To regenerate it:
   `supabase gen types typescript --linked > src/integrations/supabase/types.ts`
6. Deploy the frontend.

### Verify after applying

```sql
-- Sales corrected by the D1 fix (old vs new values are kept here)
SELECT count(*), sum(old_total - new_total) AS removed_inflation FROM public._vat_fix_sales_backup;
-- Every legacy single-method sale has a tender line
SELECT count(*) FROM sales s WHERE payment_method <> 'mixed'
  AND NOT EXISTS (SELECT 1 FROM sale_payments p WHERE p.sale_id = s.id);   -- expect 0
-- Invoice numbers renamed by the dedupe step (suffix -D2, -D3 ...)
SELECT invoice_number FROM sales WHERE invoice_number ~ '-D[0-9]+$';
-- Cron job
SELECT jobname, schedule FROM cron.job;
```

## How this was tested

All migrations, old and new, were applied in order to a clean Postgres 16 with Supabase role and `auth` stubs. Legacy data was seeded before the new migrations ran. Checks covered:

- **D1:** an inflated 1,322.50 sale became 1,150, and the daily closing's cash difference went from −89.75 to +100.
- **Duplicates and backfills:** duplicate invoice and order numbers were suffixed, customer and payment backfills ran, and the ledger backfill ran.
- **`pos_checkout`:** split tender, re-selling a sold IMEI, payment mismatch (rollback verified), insufficient stock, another branch's device, a cashier selling from a foreign branch, a cross-tenant caller, anon access, and customer auto-create.
- **Web orders:** server pricing, the POS refusing reserved units, anon blocked from direct reads and inserts, tracking with right and wrong phone and store, and TTL expiry.
- **Order lifecycle:** confirm → sold, cancel → restock, re-open, re-open after a POS sale (refused), and the per-phone hoarding cap.
- **Concurrency:**
  - Two parallel checkouts of one IMEI: one succeeds, the other gets `DEVICE_UNAVAILABLE`.
  - 30 parallel sales: 30 unique, gap-free invoice numbers and exact stock.

## Known limits / follow-ups

- `store_credit` and `trade_in` exist in the enum, but `pos_checkout` rejects them until those modules exist.
- Coupons are still validated and counted client-side (`CouponApply`). `pos_checkout` only checks `0 ≤ discount ≤ gross`, so coupon redemption should move server-side next.
- Per-line VAT and discount are spread pro rata. The header totals are authoritative and may differ from the line sum by a few halalas.
- `track_public_order` accepts the last 4 digits of the phone, as the UI does today. Order numbers are sequential, so add rate limiting (e.g. an edge function) or require the full phone.
- Legacy `mixed` sales have no recorded split, so reports keep the 50/50 approximation for them.
- Unrelated issue spotted during testing: migrations `20260506214517…` and `20260506220551…` hard-code a demo password for a real e-mail address. Rotate that password and remove the secret from history.
