# Cash shifts (الورديات ودرج الكاش)

Migration: `supabase/migrations/20261018100400_cash_shifts.sql`. Apply it after the Phase 0/1
migrations, in the same `supabase db push`, then deploy the frontend.

## Rules (agreed with the shop owner)

| Decision | Choice |
|---|---|
| Shift scope | **Per branch**: one open shift per branch, shared by all its tills |
| Selling | Not possible without an open shift (enforced by a trigger on `sales`, so every insert path is covered) |
| Opening | Opening cash in the drawer is entered |
| During the shift | Cash in / cash out / expense, each with a reason and who did it |
| Closing | The **counted total** is entered (no denominations) |
| Expected cash | opening + cash sales + cash in − cash out − expenses |
| Approval | **Every** close needs a manager (owner, admin or branch manager), whatever the difference |
| Blind count | Cashiers don't see the expected amount or the difference until the shift is approved |

Shift statuses: `open` → `pending_approval` (counted, waiting for a manager) → `closed` (approved).
A new shift can be opened while the previous one waits for approval, so selling isn't blocked.

## Where it appears

- **POS** (`/pos`): without an open shift, the POS shows an "open shift" panel. With one, a bar
  above the POS shows the shift with **حركة نقدية** (cash movement) and **إغلاق الوردية** (close shift).
  After closing, managers see the report with the difference and can approve on the spot.
  Cashiers see a "sent for approval" message.
- **Shifts page** (`/shifts`, sidebar → العمليات اليومية → الورديات, managers only): history with
  filters; **مراجعة** opens the report and the approve button (with optional notes).

## Server API

| RPC | Who | Purpose |
|---|---|---|
| `open_shift(_branch_id, _opening_cash, _notes?)` | staff of the branch | Opens the branch's shift |
| `current_shift(_branch_id)` | staff of the branch | Open shift report, or `null` |
| `record_cash_movement(_shift_id, _type, _amount, _reason)` | staff of the branch | `cash_in` / `cash_out` / `expense` |
| `close_shift(_shift_id, _counted_cash, _notes?)` | staff of the branch | Snapshot of totals, then `pending_approval` |
| `approve_shift(_shift_id, _notes?)` | managers | `pending_approval` → `closed` |
| `shift_report(_shift_id)` | staff | X/Z report: cash breakdown, sales by method, movements |
| `list_shifts(_status?, _limit?)` | staff | History; cashiers and branch managers bound to a branch see only it |

The tables `cash_shifts` and `cash_movements` have no API policies: all access goes through these
functions, which is what keeps the count blind. Errors carry a code in `HINT`
(`NO_OPEN_SHIFT`, `SHIFT_ALREADY_OPEN`, `MANAGER_REQUIRED`, ...).

**Concurrency.** A sale takes a share lock on its shift, and closing takes an exclusive lock. A
close therefore waits for sales in progress and includes them, and a sale arriving during a close is
refused with `NO_OPEN_SHIFT`.

## Printing the shift report (X / Z)

`src/services/shiftReportPrint.ts` builds the report as receipt-width HTML (80 mm or 58 mm, taken
from the POS printer settings) and prints it through a hidden iframe, so it isn't blocked as a pop-up.

- **X report:** from the shift bar in the POS (**تقرير X**), with fresh figures while the shift is open.
- **Z report:** from the close dialog (**طباعة التقرير**). It also prints automatically after closing
  when auto-print is on in the printer settings (the same switch as for invoices).
- **Reprint:** any shift can be reprinted from the shifts page (**طباعة**).
- **Content:** header, opened and closed times and who did it, the drawer breakdown, expected,
  counted, shortage or surplus, sales by payment method, every movement with its reason, approval
  status, and cashier and manager signature lines.
- **Blind count on paper:** the report uses `shift_report()`, so a cashier's printout has no
  expected amount or difference until the shift is approved.

**Printer path.** The report always goes through the browser's print on the till's installed
printer ("system" printer type). Direct-IP printing (the Epson/Star options in the printer settings)
does not work today, for invoices either, for three reasons found while building this:

1. The XML it sends is invalid: attributes are written as `\"…\"`, and text is not XML-escaped.
2. Epson ePOS text mode has no Arabic shaping.
3. Browsers block an HTTPS page from calling `http://<printer-ip>` (mixed content).

For silent printing on a dedicated till, set the thermal printer as the default printer and run
Chrome with `--kiosk-printing`.

## Daily closing = sum of the day's shifts

Migration: `supabase/migrations/20261018100500_daily_closing_from_shifts.sql`.

- **Business day.** A shift belongs to the day it was **opened**, in Asia/Riyadh time (stored in
  `cash_shifts.business_date`), even if it runs past midnight. The old page split days at midnight
  UTC, which is 03:00 in KSA.
- **`daily_summary(_branch_id, _date)`** sums the branch's shifts for that day:
  - opening cash, cash sales, cash in, cash out, expenses, expected, counted and difference;
  - the shifts list;
  - sales totals, VAT and discounts, revenue per payment method, and devices and accessories sold;
  - the sold lines for the charts and tables.

  Sales of the day that belong to no shift (imports, data from before shifts) are included in the
  sales figures but not in the drawer reconciliation. The same blind-count rule applies to cashiers.
- **`close_day(_branch_id, _date, _notes?)`** is for managers only. It requires at least one shift,
  none still open and none awaiting approval. It writes the `daily_closings` row from the shifts
  (`source = 'shifts'`).
- **After the close:** no new shift can open on that day (`DAY_CLOSED`), and the day can't be closed
  twice (`DAY_ALREADY_CLOSED`).
- **No more client-side writes.** `daily_closings` is no longer writable from the client: the
  INSERT/UPDATE policies were dropped. Closings made by the old page stay as they are
  (`source = 'manual'`).
- **The page (`/daily-closings`)** keeps its charts and tables, now fed by `daily_summary`. The manual
  "cash counted" form is replaced by the day's shifts with the drawer reconciliation. The **إغلاق
  اليوم** button appears only when the server allows it; otherwise the page explains why (a shift is
  still open, a shift awaits approval, or the user is not a manager).

## Tests

`supabase/tests/db/shifts.test.ts` (19 tests) covers opening rules, selling without a shift, the
full shift with the expected-cash formula and blind count, approval permissions, movements,
direct-table access, multi-tenant isolation and both close/sale races.
`supabase/tests/db/daily-closing.test.ts` (14 tests) covers summing two shifts, the written closing
row, every refusal, blind count, day boundaries (branch, business day, Riyadh vs UTC), sales outside
shifts, and that clients can no longer write closings.

## Not done yet

- Cash refunds don't exist in the system yet; when returns are built they must count as cash out
  of the shift.
