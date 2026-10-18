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

## Tests

`supabase/tests/db/shifts.test.ts` (19 tests) covers opening rules, selling without a shift, the
full shift with the expected-cash formula and blind count, approval permissions, movements,
direct-table access, multi-tenant isolation and both close/sale races.

## Not done yet

- Cash refunds don't exist in the system yet; when returns are built they must count as cash out
  of the shift.
- The daily closing page (`/daily-closings`) still works on its own. It can later become a sum of
  the day's approved shifts.
- No printed shift report yet; the report is shown on screen.
