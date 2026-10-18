# Wasel: Mobile-Retail Codebase Audit & Gap Analysis

**Date:** 2026-10-18 · **Scope:** `src/`, `supabase/migrations/`, `supabase/functions/`, generated types in `src/integrations/supabase/types.ts` (treated as the live schema)

---

## 1. Executive Summary

Wasel is a multi-tenant SaaS (Vite + React + TypeScript + shadcn/ui on Supabase Postgres/Auth/Edge Functions) with a wide surface area: POS, inventory, repairs, branches and transfers, suppliers and purchase orders, stocktakes, online storefront, wholesale B2B, loyalty, marketing, HR and platform admin.

**Breadth is good, but transactional depth is not.** The data model already separates serialized devices (`devices`, one row per IMEI) from bulk SKUs (`accessories`, `repair_parts`), which is the right foundation. But every business-critical write (POS checkout, online order placement, parts consumption, transfers, PO receiving) runs as a **sequence of separate client-side Supabase calls with no transaction, no row locking and no server-side validation**. For a shop selling unique, high-value IMEI units, this is the biggest risk.

| Area | Readiness | One-line verdict |
|---|---|---|
| Inventory & device tracking | 🟡 55% | IMEI per unit exists; condition, specs, grading, photos and history are thin |
| POS | 🟠 40% | Works for the happy path; totals/VAT bug, no split tender, no returns, no trade-in |
| E-commerce sync | 🔴 20% | Storefront reads live stock but **never reserves or sells devices**; double-selling is possible |
| Repairs | 🟡 60% | Good status lifecycle and parts deduction; not atomic, one enum bug, no device/customer FK |
| Customers & warranty | 🔴 25% | Customers linked by phone string only; no sales-warranty model at all |

**Bottom line:** fine for a demo or pilot. Before handling real money and real IMEIs at volume, it needs a **transactional core**: Postgres RPCs for checkout and ordering, a reservation model, an IMEI ledger, and a customer foreign key.

---

## 2. Implemented Features (done and reasonably structured)

### Inventory & devices
- **Per-unit serialized table** `devices` with `imei`, `imei2` (dual-SIM), `model`, `brand`, `color`, `storage`, `condition`, `category`, `cost`, `price`, `supplier_id`, `purchase_id`, `branch_id`.
- **IMEI uniqueness per tenant:** `UNIQUE(merchant_id, imei)`.
- **Device lifecycle enum** `device_status`: `available | reserved | sold | transferred | repair`.
- **Bulk SKU stock** in `accessories` (with `min_quantity` for low-stock alerts) and a separate `repair_parts` table with `compatible_models`.
- **Supplier → PO → receive flow** creates device rows with IMEI on receipt (`src/hooks/useSuppliers.ts:288`).
- **Inter-branch transfers** for devices and accessories (`stock_transfers`, `stock_transfer_items`, `useTransfers.ts`).
- **Stocktake** across device, accessory and repair-part types (`useStocktake.ts`, `StocktakePage.tsx`).
- **Barcode label printing** for IMEI and SKU via JsBarcode (`LabelsPage.tsx`).

### POS
- **Scanner-first input:** a keyboard-wedge scanner field auto-focuses and submits on Enter (`ScannerSection.tsx`).
- **IMEI lookup** checks both `imei` and `imei2` and only returns `available` units (`usePOSInventory.ts:63`).
- **Branch-scoped POS grid**, coupons, quick cash tender and change calculation, cashier sales history, auto-print.
- **ZATCA Phase-1 QR** (TLV base64: seller, VAT number, timestamp, total, VAT) on receipts (`InvoiceDialog.tsx:47`); thermal printer service.
- **Merchant legal fields** (`cr_number`, `vat_number`, `vat_enabled`) and a public RPC `get_public_merchant_legal`.
- **Daily closings** (Z-report style) per branch.

### E-commerce
- A themed public storefront (`/store/:slug`) with categories, product detail, cart, favourites, checkout, order tracking and SEO.
- **Restricted public views** `public_store_devices` and `public_store_accessories` hide cost, supplier and **IMEI** from anonymous users. This is correct and important.
- Online order back-office with statuses, Aramex/SMSA tracking, payment status and merchant payouts.

### Repairs
- **Full status enum:** `received → diagnosing → waiting_parts → in_progress → completed → delivered | cancelled`. This maps directly to the requested lifecycle.
- Device IMEI, brand, model and colour captured on the ticket; estimate vs. actual cost; deposits (`paid_amount`); priority; technician assignment.
- **Parts consumption:** `repair_order_parts` links to `repair_parts`, deducts stock and checks for insufficient quantity (`useRepairParts.ts:112`).
- **Repair warranty:** `warranty_days` and `warranty_ends_at` are computed on delivery; there's a repair invoice dialog and a parts-usage report.

### Customers & platform
- Customer profiles with loyalty points, tiers and a `loyalty_transactions` ledger; an `award-loyalty` edge function for online orders.
- Multi-tenant RLS with `get_user_merchant_id()` and role helpers (`owner`, `admin`, `branch_manager`, `cashier`, `inventory_manager`).
- Activity logs, plans and subscriptions, plan enforcement, Arabic/English i18n, an MCP server, and an accounting API edge function.

---

## 3. Missing / Incomplete Features (mobile-retail gaps)

Severity: 🔴 Critical (money or stock integrity) · 🟠 High (core mobile-retail feature) · 🟡 Medium

### 3.1 Correctness defects found during the audit (fix first)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| D1 | 🔴 | **POS VAT/total mismatch.** The cart and printed invoice treat prices as **VAT-inclusive** (`tax = total − total/1.15`). The saved sale treats them as **VAT-exclusive** (`tax = subtotal × 0.15; total = subtotal + tax − discount`). For a 1,150 SAR phone, the customer pays and the receipt says **1,150**, but `sales.total_amount` stores **1,322.50**. Reports, daily closings and the accounting API all inherit the inflated figure. | `CartPanel.tsx:66` vs `useSales.ts:63-65` |
| D2 | 🔴 | **Checkout is not atomic.** The sale header, each `sale_item`, each device status flip and each accessory decrement are separate HTTP calls. Errors on items are ignored. A dropped connection mid-loop leaves a paid sale with unsold devices, or the reverse. | `useSales.ts:98-131` |
| D3 | 🔴 | **Device double-sell race.** The device is set to `sold` with `.eq('id', …)` only, with no `AND status='available'` guard. Two tills (or POS plus the web store) can both sell the same IMEI. | `useSales.ts:113` |
| D4 | 🔴 | **Accessory stock is read-then-written** (`quantity − n` computed in the browser). Concurrent sales lose updates, and `Math.max(0, …)` silently hides overselling. | `useSales.ts:118-129` |
| D5 | 🔴 | **Online orders never touch inventory.** `placeOrder` inserts the order and items but never reserves or sells the device or decrements accessories. Status changes in `updateOrderStatus` don't either. A used iPhone ordered online stays `available` in the POS. | `useOnlineStore.ts:535-589`, `:431` |
| D6 | 🔴 | **Online prices are trusted from the browser.** `unit_price` and totals come from the client. The `online_order_items` anon INSERT policy is `WITH CHECK (true)`, so anyone can insert items at any price into any order. | migration `20260308092959…sql:135` |
| D7 | 🟠 | **Invoice numbers can collide.** `generate_invoice_number` uses `COUNT(*)+1` with a date prefix. It isn't concurrency-safe, there's no `UNIQUE(merchant_id, invoice_number)`, and the counter isn't sequential per day or branch (a ZATCA expectation). | migration `20260201110215…sql:496` |
| D8 | 🟠 | **Repair status `warranty_expired` isn't in the DB enum.** `useRepairs` writes it back to the DB, so that update fails every time the list loads. | `useRepairs.ts:6,95` vs enum `repair_status` |
| D9 | 🟠 | **Guest checkout and order tracking depend on an anon SELECT that isn't in migrations.** `insert(...).select()` and `trackPublicOrder` need anon to read `online_orders`. Either they fail for guests, or a policy was added out-of-band that exposes **all** orders' PII (phone-last-4 is checked *client-side* after fetching the row). This should become a `SECURITY DEFINER` RPC. | `useOnlineStore.ts:556,595` |
| D10 | 🟡 | The POS IMEI lookup is merchant-wide, not branch-scoped, so a cashier can scan and sell a device that belongs to another branch. | `usePOSInventory.ts:63` |
| D11 | 🟡 | Parts deduction in repairs is also read-then-write and non-atomic (same pattern as D4). | `useRepairParts.ts:112-145` |

### 3.2 Inventory & device tracking

| Gap | Sev | Notes |
|---|---|---|
| No **IMEI ledger or history** | 🔴 | There's no `device_events` table, so you can't answer "where has IMEI X been?" (received → transferred → sold → returned → repaired). This is essential for theft and police enquiries, warranty, and fraud. |
| `condition` is free text, defaulted to `'new'`, and **not exposed in the inventory form** | 🟠 | Needs an enum (`new`, `open_box`, `used`, `refurbished`, `cpo`) plus a **grade** (A/B/C/D). |
| No used-device attributes | 🟠 | Missing: battery health %, cosmetic notes, functional checklist, iCloud/FRP lock status, carrier lock, box/accessories included, original purchase date. |
| No **product master / variant model** | 🟠 | `model`, `storage` and `color` are free text on each unit, so "iPhone 15 Pro 256GB Black" can't be grouped. That blocks catalogue pages, reorder points, price lists and storefront variant pickers. |
| No **IMEI validation** | 🟡 | No Luhn check or 15-digit format check on IMEI, and no TAC → model lookup. |
| No **blacklist / stolen check** | 🟡 | No hook for a GSMA/CEIR check at intake (important for trade-ins). |
| No `branch_id NOT NULL` on devices | 🟡 | A unit with no branch can't be sold or counted correctly. |
| Images are **static files** at `/public/products/<IMEI>.jpg` | 🟠 | There's no upload, storage bucket, multiple photos or per-unit gallery. Merchants can't add photos in production. |
| No serial-number support for non-phones | 🟡 | Laptops and cameras are stored as devices with fake "IMEIs" (e.g. `SN-MBA13-4501`). A generic `serial_number` plus `identifier_type` is needed. |

### 3.3 Trade-in / buyback: **not implemented at all**
There's no table, page or hook. Missing:
- An intake form: seller ID (national ID/Iqama, which local regulation requires for second-hand phone purchases), IMEI, blacklist check, condition checklist, grading, photos, offered vs. agreed price, and signature.
- Conversion of an accepted trade-in into a `devices` row (`condition='used'`, `cost=agreed price`, source `trade_in`).
- Payout options: cash out, store credit, or **apply as a tender** on a new sale.
- Refurbishment workflow: an internal repair ticket against the traded-in unit, with parts cost rolled into the device cost.

### 3.4 POS

| Gap | Sev |
|---|---|
| **Split / multi-tender** payments. `mixed` is only an enum label, and there's no `sale_payments` table storing Cash 500 + Mada 650 + Apple Pay 0. | 🔴 |
| No **Mada / Apple Pay / STC Pay / Tabby / Tamara** methods. Enum is `cash, card, bank_transfer, mixed`. | 🟠 |
| No **returns / refunds / exchanges** (credit notes). A returned IMEI can't be put back to `available`. | 🔴 |
| No **trade-in credit as tender**. | 🟠 |
| `sales` has **no `customer_id`**, only free-text name and phone. | 🟠 |
| `sale_items` lacks a **snapshot** of IMEI, model and name, plus per-line VAT, discount and warranty, so history breaks if a device row is edited or deleted (`ON DELETE SET NULL`). | 🟠 |
| No per-line discount, price override with manager approval, or hold/park cart. | 🟡 |
| No **ZATCA Phase-2** support: UBL 2.1 XML, invoice hash chain (PIH), ICV counter, cryptographic stamp, CSID onboarding, simplified vs. standard (B2B with buyer VAT) invoices, credit/debit notes, and clearance/reporting API. The QR also uses the **print time**, not the sale's `sale_date`, and falls back to a dummy VAT number `000000000000000`. | 🔴 for KSA compliance |
| Invoice config (VAT number, header) lives in **local browser state** of `InvoiceDialog`, not the DB, so it isn't consistent across devices. | 🟡 |
| No camera-based scanning (the UI says "Camera scanning mode active" but no decoder library is installed). | 🟡 |
| No offline mode or queue for network outages. | 🟡 |
| No cash drawer sessions or shift float (daily closings exist but aren't tied to tender breakdown). | 🟡 |

### 3.5 E-commerce & inventory sync

| Gap | Sev |
|---|---|
| **No reservation on order** (`available → reserved` with a TTL) and no `reserved → sold` on confirmation or `→ available` on cancel. See D5. | 🔴 |
| **No server-side pricing or availability check** at checkout. See D6. | 🔴 |
| No **online payment gateway** (Moyasar, HyperPay, Tap). Payment is bank transfer or COD, marked manually. | 🟠 |
| No **realtime** subscription (Supabase Realtime unused), so POS and storefront lists go stale. | 🟡 |
| Serialized vs. standard listing isn't modelled. The storefront lists **each device row as a product**, so ten identical new iPhones show as ten cards. Used units need a "unit listing" page (photos, grade, battery). New units need a "variant listing" with aggregated stock. | 🟠 |
| No per-device "publish online" flag or channel allocation, so a store can't keep demo or reserved units offline. | 🟡 |
| Online orders aren't linked to `customers` and don't generate a VAT invoice. | 🟠 |

### 3.6 Repairs & service

| Gap | Sev |
|---|---|
| No `customer_id` or `device_id` FK, so a repair isn't linked to a unit you sold (in-warranty repair detection is impossible). | 🟠 |
| No intake checklist (screen, camera, Face ID, water damage), photos, passcode/pattern capture, or accessories left with the device. | 🟡 |
| No status-history table (who moved it, when). No SMS/WhatsApp notifications on status change. | 🟡 |
| Parts aren't **reserved** at diagnosis; they're only deducted on use. No returning unused parts, no parts serials (e.g. original screens). | 🟡 |
| No labour vs. parts line items with VAT, and no repair invoice in the `sales` series (separate numbering, so it misses accounting and ZATCA). | 🟠 |
| `compatible_models` is free text, so you can't filter parts by device model. | 🟡 |

### 3.7 Customers & warranty

| Gap | Sev |
|---|---|
| **No sales warranty model.** There's no `warranty_type` (manufacturer vs. shop vs. extended), start date or end date per sold IMEI. | 🔴 |
| No **warranty lookup by IMEI** ("scan IMEI → who bought it, when, which invoice, warranty status"). | 🟠 |
| Customer ↔ purchases are joined by **phone-string equality** (`CustomerDetailPage.tsx:82`). This breaks on formatting differences, shared phones and number changes. | 🟠 |
| No national ID/Iqama, which is needed for trade-ins and B2B VAT invoices (buyer VAT number and CR). | 🟡 |
| No warranty claims/RMA flow (send to brand service centre, replacement IMEI swap). | 🟡 |
| `customers.total_spent` and `total_purchases` aren't updated by POS sales, only by loyalty paths. | 🟡 |

### 3.8 Engineering hygiene
- **Tests:** only a placeholder test (`src/test/example.test.ts`), with zero coverage on money paths.
- **Schema drift:** the generated types include `wholesale_*` tables and views that aren't in `supabase/migrations/`. The repo can't rebuild the DB from scratch.
- Heavy use of `as any` around Supabase calls hides type errors (e.g. D8 would have been caught).
- Inventory deletes use `ON DELETE SET NULL` on `sale_items.device_id`. Sold devices should be **non-deletable** (soft delete plus an RLS/trigger guard).

---

## 4. Data Model Evaluation: Is It Ready for IMEI-Level Tracking?

**Verdict: the foundation is right (one row per unit, unique IMEI per tenant). The schema is not yet sufficient for traceability, warranty, trade-ins or channel-safe selling.**

### What's good
- `devices` is a true serialized-unit table. `imei` + `imei2` + `UNIQUE(merchant_id, imei)`.
- Movement tables (`sale_items`, `stock_transfer_items`, `purchase_order_items`, `online_order_items`, `stocktake_items`) all carry `device_id` separately from `accessory_id`.
- A status enum already includes `reserved`, though nothing uses it yet.

### What's structurally missing

```text
                ┌─────────────────┐
                │ product_models  │  brand, model, storage, color, base_price, images
                └────────┬────────┘
                         │ 1..n
┌──────────────┐   ┌─────▼──────┐   ┌────────────────┐
│ trade_ins    │──►│  devices   │◄──│ device_events  │  (append-only IMEI ledger)
└──────────────┘   │ +model_id  │   └────────────────┘
                   │ +grade     │
                   │ +battery   │   ┌────────────────┐
                   │ +source    │◄──│ device_media   │  (storage bucket photos)
                   │ +reserved_*│   └────────────────┘
                   └─────┬──────┘
                         │
┌──────────┐   ┌─────────▼─────┐   ┌───────────────┐   ┌────────────────┐
│customers │◄──│    sales      │──►│ sale_payments │   │  warranties    │
└──────────┘   │ +customer_id  │   └───────────────┘   │ device_id      │
      ▲        │ +type (sale/  │                       │ sale_item_id   │
      │        │  return)      │──►sale_items ────────►│ type, starts,  │
      │        └───────────────┘   +imei_snapshot      │ ends           │
      │                            +vat, +warranty     └────────────────┘
      └──── repair_orders (+customer_id, +device_id)
```

### Recommended schema changes (minimum viable)

```sql
-- 1. Enums
CREATE TYPE device_condition AS ENUM ('new','open_box','used','refurbished','cpo');
CREATE TYPE device_source    AS ENUM ('purchase','trade_in','transfer_in','return');
ALTER TYPE payment_method ADD VALUE 'mada';
ALTER TYPE payment_method ADD VALUE 'apple_pay';
ALTER TYPE payment_method ADD VALUE 'stc_pay';
ALTER TYPE payment_method ADD VALUE 'store_credit';
ALTER TYPE payment_method ADD VALUE 'trade_in';

-- 2. Product master
CREATE TABLE product_models (
  id uuid PK, merchant_id uuid NOT NULL, brand text, model text NOT NULL,
  storage text, color text, category text, default_price numeric,
  manufacturer_warranty_months int DEFAULT 12, image_urls text[],
  UNIQUE (merchant_id, brand, model, storage, color)
);

-- 3. Devices: make it unit-grade
ALTER TABLE devices
  ADD COLUMN model_id uuid REFERENCES product_models(id),
  ADD COLUMN condition_v device_condition NOT NULL DEFAULT 'new',
  ADD COLUMN grade text CHECK (grade IN ('A','B','C','D')),
  ADD COLUMN battery_health smallint CHECK (battery_health BETWEEN 0 AND 100),
  ADD COLUMN source device_source NOT NULL DEFAULT 'purchase',
  ADD COLUMN serial_number text,
  ADD COLUMN is_online boolean NOT NULL DEFAULT true,
  ADD COLUMN reserved_until timestamptz,
  ADD COLUMN reserved_by_order uuid,
  ADD COLUMN sold_sale_id uuid;
-- + CHECK (imei ~ '^\d{15}$') for phones, Luhn check in a trigger

-- 4. Append-only ledger
CREATE TABLE device_events (
  id bigserial PK, device_id uuid NOT NULL, merchant_id uuid NOT NULL,
  event text NOT NULL,          -- received, transferred, reserved, sold, returned, repair_in, ...
  from_branch uuid, to_branch uuid, ref_table text, ref_id uuid,
  actor uuid, created_at timestamptz DEFAULT now()
);

-- 5. Sales: customer FK, tender lines, line snapshots, returns
ALTER TABLE sales ADD COLUMN customer_id uuid REFERENCES customers(id),
                  ADD COLUMN kind text NOT NULL DEFAULT 'sale',   -- 'sale' | 'return'
                  ADD COLUMN original_sale_id uuid REFERENCES sales(id),
                  ADD COLUMN icv bigint, ADD COLUMN previous_hash text, ADD COLUMN invoice_hash text;
ALTER TABLE sales ADD CONSTRAINT sales_invoice_unique UNIQUE (merchant_id, invoice_number);
CREATE TABLE sale_payments (id uuid PK, sale_id uuid NOT NULL, method payment_method NOT NULL,
                            amount numeric NOT NULL, reference text, trade_in_id uuid);
ALTER TABLE sale_items ADD COLUMN imei_snapshot text, ADD COLUMN item_name text,
                       ADD COLUMN vat_amount numeric, ADD COLUMN line_discount numeric DEFAULT 0;

-- 6. Warranty
CREATE TABLE warranties (
  id uuid PK, merchant_id uuid, device_id uuid, sale_item_id uuid, customer_id uuid,
  type text CHECK (type IN ('manufacturer','shop','extended')),
  starts_at date, ends_at date, terms text
);

-- 7. Trade-ins
CREATE TABLE trade_ins (
  id uuid PK, merchant_id uuid, branch_id uuid, customer_id uuid NOT NULL,
  seller_national_id text NOT NULL, imei text NOT NULL, model_id uuid,
  checklist jsonb, grade text, battery_health smallint, icloud_locked boolean,
  blacklist_checked_at timestamptz, offered_price numeric, agreed_price numeric,
  status text,  -- evaluating, accepted, rejected, paid, converted
  payout_method text, device_id uuid, sale_id uuid, created_by uuid, created_at timestamptz
);

-- 8. Repairs linkage
ALTER TABLE repair_orders ADD COLUMN customer_id uuid REFERENCES customers(id),
                          ADD COLUMN device_id uuid REFERENCES devices(id),
                          ADD COLUMN is_warranty_claim boolean DEFAULT false;
ALTER TYPE repair_status ADD VALUE 'ready';  -- distinct "ready for pickup"
CREATE TABLE repair_status_history (...);
```

### The transactional core (most important change)
Move every stock-affecting write into **`SECURITY DEFINER` Postgres functions** called via `supabase.rpc`:

```sql
-- pos_checkout(_branch, _customer, _lines jsonb, _payments jsonb, _discount)
--   * SELECT … FROM devices WHERE id = ANY(...) AND status='available' AND branch_id=_branch FOR UPDATE
--   * if count mismatch → RAISE 'device no longer available'
--   * UPDATE accessories SET quantity = quantity - n WHERE id=… AND quantity >= n  (check ROW_COUNT)
--   * compute VAT server-side from DB prices; validate SUM(payments) = total
--   * insert sales, sale_items (snapshots), sale_payments, warranties, device_events
--   * allocate invoice number from a per-merchant sequence row (UPDATE … RETURNING)
--   all in one transaction

-- place_online_order(_slug, _customer, _lines jsonb)   -- anon-callable
--   * re-price from DB, lock + set devices reserved (reserved_until = now()+30 min)
-- confirm_online_order / cancel_online_order / pg_cron job to release expired reservations
```

With this in place, D1–D7 and D11 collapse into one well-tested code path, and the POS and the storefront can no longer sell the same IMEI.

---

## 5. Recommended Priority Roadmap

### Phase 0: Stop the bleeding (1 week)
1. Fix the **VAT/total mismatch** (D1). Choose VAT-inclusive pricing (the KSA retail norm) and compute it identically everywhere. Add a data-fix migration for existing `sales` rows.
2. Add `UNIQUE(merchant_id, invoice_number)` and replace the `COUNT(*)+1` numbering with a locked counter table (D7).
3. Remove `warranty_expired` writes or add it to the enum (D8).
4. Replace the anon order SELECT/tracking with an RPC that verifies the phone **server-side** (D9). Lock down the `online_order_items` anon insert (D6).
5. Scope POS IMEI lookup to the current branch (D10).

### Phase 1: Transactional core (2–3 weeks) 🔴
6. Build the `pos_checkout` RPC with row locks, server pricing and atomic stock moves (D2–D4).
7. Build `place_online_order`, `confirm_order` and `cancel_order` RPCs with **device reservation and TTL release** via `pg_cron` (D5). Enable Supabase Realtime on `devices` and `accessories` for live POS/store availability.
8. Add the **`device_events` ledger**, written by triggers on `devices` status/branch changes.
9. Add `sale_payments` (**split tender**) plus the `mada`, `apple_pay`, `stc_pay` and `store_credit` methods, and update the cart UI to a tender-lines dialog.
10. Add a `sales.customer_id` FK, auto-create or attach the customer at checkout, and line snapshots on `sale_items`.
11. Write integration tests (Vitest against a local Supabase) for checkout, double-sell and reservation expiry.

### Phase 2: Mobile-retail essentials (3–4 weeks) 🟠
12. **Returns and exchanges** (credit-note sales with `kind='return'`) that restore the IMEI to `available` or `repair`.
13. **Warranties:** auto-create manufacturer and shop warranties on sale, and add an **IMEI lookup page** showing owner, invoice, warranty status and repair history.
14. **Trade-in module:** intake → checklist → grade → offer → accept → device created → payout as cash, store credit, or **tender on a new sale**. Capture seller ID.
15. **Condition and grade enums, battery health and the used-device spec sheet.** Expose them in the inventory form and storefront.
16. **Device media** via a Supabase Storage bucket (`device-media/{merchant}/{device}/…`), multi-photo upload, and a storefront gallery.
17. **Product master (`product_models`)** with storefront variant grouping for new stock and per-unit listings for used stock.

### Phase 3: Compliance and payments (3–5 weeks, can run in parallel with Phase 2)
18. **ZATCA Phase-2 (Fatoora):** UBL XML, ICV, PIH hash chain, signing, CSID onboarding, and the reporting API for simplified invoices and clearance for B2B. Store invoice config in the DB, not the browser. Use `sale_date` in the QR.
19. **Payment gateway** for the storefront (Moyasar/HyperPay/Tap: Mada, Apple Pay), plus a BNPL option (Tabby/Tamara). Wire webhook → `confirm_order` RPC.
20. Unify repair invoices into the main invoice series so they're VAT/ZATCA compliant.

### Phase 4: Service excellence and scale
21. Repairs: `customer_id`/`device_id` FKs, auto-flag in-warranty repairs, intake checklist and photos, status history, and WhatsApp/SMS notifications on status change.
22. Parts reservation at diagnosis, structured compatibility (`part ↔ product_model`), and serialized high-value parts.
23. IMEI Luhn validation, TAC lookup, and a stolen/blacklist check integration at trade-in and repair intake.
24. Camera scanning (ZXing/BarcodeDetector), parked carts, manager-approval price overrides, offline queue.
25. Commit the missing `wholesale_*` migrations, remove `as any` casts, and set up CI with typecheck and tests on every PR.

---

### Appendix: Key file references
- POS checkout: `src/hooks/useSales.ts:52`, `src/pages/POSPage.tsx:166`, `src/components/pos/CartPanel.tsx:63`
- Invoice/QR: `src/components/pos/InvoiceDialog.tsx:47`
- Storefront order: `src/hooks/useOnlineStore.ts:535`
- Repairs: `src/hooks/useRepairs.ts`, `src/hooks/useRepairParts.ts:112`
- Core schema: `supabase/migrations/20260201110215_…sql`, online store: `20260308092959_…sql`, repairs: `20260308083552_…sql`
- Live schema (generated): `src/integrations/supabase/types.ts`
