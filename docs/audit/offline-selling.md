# Offline selling (البيع بدون إنترنت)

Migration: `supabase/migrations/20261018100600_offline_sales.sql`. It also relies on the
`client_ref` idempotency key added to `pos_checkout()` in `20261018100300_…`.

## What the cashier sees

- **Offline banner.** When the connection drops, a banner appears: "غير متصل بالإنترنت — البيع بدون
  إنترنت مفعّل". The till keeps selling from the branch stock saved on the device, but:
  - cash, or a standalone card terminal (mada or card), or a split between them;
  - no coupons or discounts;
  - an open shift is required (the one already open on this till).
- **Receipt.** Each sale gets a number from this till's own series, e.g. `OFF-T1-000001`, and is
  printed as usual. That number is the one kept on the server; the branch's `INV-B1-…` series is
  never used by offline sales.
- **Sync.** When the connection is back, the queued sales sync automatically: on reconnect, every
  minute while any are waiting, or with **مزامنة الآن**. The banner shows how many are waiting.
- **Shift close.** A shift can't be closed while offline sales are still waiting to sync.
- **Lost response.** If the connection drops in the middle of a normal sale, the cart stays. Pressing
  **إتمام البيع** again saves it offline under the same attempt id. If the first attempt did reach
  the server, the sync recognises it and nothing is sold twice.

## How it works

| Piece | Where |
|---|---|
| Till registration (T1, T2 ... per merchant, once per device and branch, while online) | `register_terminal()`, `terminal_state()`; stored in `localStorage` as `pos_terminal_<branch>` |
| Offline counter | Taken and saved **before** the sale is queued, so a number is never reused. On reconnect it resumes after the highest number the server holds for the till |
| Branch stock on the device | Saved after every successful POS load (`pos_stock_<branch>`); offline searches and sales use it, and sold units leave it immediately |
| Queue | IndexedDB (`wasel-offline` → `sales`), which survives a crash or closed tab |
| Sync | `sync_offline_sale()` replays each sale through `pos_checkout()`, so every check runs again: unit free, stock, price, open shift. The printed `OFF-` number and the offline sale time are kept |
| Idempotency | `sales.client_ref` (one id per checkout attempt). Replays return the existing result |
| Refusals | Stored in `offline_sale_conflicts` with the full payload and reason. Managers see them at the top of **الورديات**, settle them (refund, manual sale, ...) and record how (`resolve_offline_conflict()`) |
| Connectivity | Browser online/offline events, plus a probe every 15 s while offline, because Wi-Fi can be up while the internet is down. Any request failing for lack of connection switches the till to offline |

## Limits of this version

- **Reloading the page while offline is not supported.** The app itself isn't cached on the device
  (no service worker yet), so a reload during an outage can't open the POS. Queued sales are safe in
  IndexedDB and sync on the next online load. The banner warns not to reload.
- **A till must have been online once** in that branch to be registered. Until then it can't sell offline.
- **One series per device per branch.** Two browser tabs on the same device share the counter. Use
  one POS tab per till.
- **Refused sales are settled by hand.** If a unit was sold elsewhere during the outage, or a price
  changed, the customer already has the goods and an `OFF-` receipt, and a manager decides what to do.
- **ZATCA.** Offline invoices carry the same simplified-invoice QR as online ones. Phase-2 reporting
  for them happens at sync time, with the original sale time.

## Tests

- `supabase/tests/db/offline-sales.test.ts` (16): terminals, sync keeping the `OFF-` number and time,
  no use of the `INV-` series, idempotent replays, a lost online response followed by an offline
  replay, every conflict type with stock untouched, manager resolution, and server-side restrictions.
- `src/test/offline-sales.test.ts` (12): building the sale and its restrictions, stock updates, the
  number series, and the sync loop (order, network drop, other errors).
