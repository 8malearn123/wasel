# Rollout plan — pending migrations (needs the owner's approval)

Nothing in this plan has been run against production. Each step names who runs
it and what has to be true before the next one.

## What is pending

Production has none of the migrations from `20261004090000` on. In filename
order, on branch `claude/fix-qa-findings`:

| # | File | Fixes |
|---|------|-------|
| 1–16 | `20261004090000` … `20261027090100` | subscriptions on the server, RLS holes, login-code throttle, product checks, RBAC + **`my_permissions()`**, **`get_subscription_state()`**, custom roles, wholesale plan, `wholesale_parties()`, device sold once, branch limit on add |
| 17 | `20261029090000_invoice_numbers_unique` | invoice numbers from a locked counter, no duplicates |
| 18 | `20261029090100_paid_invoice_guard` | only owner/admin change a paid invoice's money or delete it |
| 19 | `20261029090200_storefront_views_readable` | storefront product views readable by visitors |
| 20 | `20261029090300_cashier_data_limits` | cashier: own invoices only, no suppliers/purchases/wholesale; `day_sales_summary()` |
| 21 | `20261029090400_login_code_revoke` | turning a member off clears their code and signs them out |
| 22 | `20261029090500_plan_limits` | no downgrade below the active branches; wholesale buying needs the plan |
| 23 | `20261029090600_non_negative_amounts` | no negative price/cost/quantity on the remaining tables (NOT VALID) |

PR #119 (`claude/sweet-knuth-u4nbzm`) carries one more,
`20261019120000_secure_login_codes_and_storefront_orders`; it sorts between
#11 and #12 and is independent of these.

## 0 · Before anything (read only, owner or Claude with access)

1. Backup: Supabase → Database → Backups, confirm a backup from today; or run
   the backup/restore check of PR #120 once its secrets are set.
2. `docs/ops/negative-values-report.sql` → expect 0 rows for devices,
   accessories and repair_parts (migration #4 validates them on apply and
   would stop on a bad row). Any row: decide it first.
3. `SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('wholesale_listings','wholesale_orders');`
   → keep the output; #11 replaces their write policies.

## 1 · Staging first

A staging project (PR #120 describes it) gets a copy of the production schema,
then every file above in order. Pass criteria — all must hold:

- every file applies with no `ERROR`
- `select public.my_permissions()` and `select public.get_subscription_state()`
  answer for owner, admin, cashier and a custom role (not 404, not another
  shop's data)
- the regression suite (`e2e/`) passes against a build pointed at staging:
  cashier `/reports` redirects, the cashier sees only their own invoices
  through the API, Lite cannot open wholesale, closing the day shows the
  branch totals for a cashier

The same checks were run on a local Postgres 16 with Supabase's roles (see the
report); staging repeats them on the real schema.

## 2 · Production (owner approves, then runs)

Supabase CLI: `npx supabase link --project-ref ynwddyxzypbcftlevuam && npx supabase db push`,
or the SQL editor file by file in order. A quiet hour, the till not in use.

Right after:

```sql
select count(*) from public.permissions;                -- > 0
select public.get_subscription_state();                 -- as a shop user, via the app
select conname, convalidated from pg_constraint where conname like '%amounts_valid';
```

Then the live regression run (read-only) and one test sale on a demo shop.

## 3 · If something goes wrong

- A file fails: it runs in one transaction, nothing of it stays; fix and rerun
  (all files are re-runnable).
- A file applied but the app misbehaves: the app still works without these
  objects (it falls back when a function is missing), so the quickest undo is
  to drop what the file added — for #20–#23:
  ```sql
  -- #20
  drop policy if exists "Cashiers read own sales" on public.sales;
  drop policy if exists "Cashiers write own sales" on public.sales;
  drop policy if exists "Cashiers delete own sales" on public.sales;
  drop trigger if exists sales_sold_by_cashier on public.sales;
  drop policy if exists "Cashiers read own sale lines" on public.sale_items;
  drop policy if exists "Cashiers add lines to own sales" on public.sale_items;
  drop policy if exists "Cashiers change lines of own sales" on public.sale_items;
  drop policy if exists "Cashiers remove lines of own sales" on public.sale_items;
  -- and "Not for cashiers <table>" on the eight buying-side tables
  -- #21
  drop trigger if exists merchant_users_off_clears_code on public.merchant_users;
  drop trigger if exists merchant_users_off_signs_out on public.merchant_users;
  -- #22
  drop trigger if exists subscriptions_guard_branch_limit on public.subscriptions;
  -- and re-create can_buy_wholesale() from 20261005120000
  -- #23
  alter table public.<table> drop constraint <name>;   -- per constraint
  ```
- Restoring the backup is the last resort: it also drops sales made since.

## 4 · After

- Revoke code 70035: `docs/ops/revoke-login-code.sql` (owner, SQL editor).
- Test-data cleanup: `docs/ops/test-data-cleanup-proposal.sql` (after approval).
- `shops_over_branch_limit()` (platform admin) lists shops already over their
  branch limit, e.g. the Lite demo (2 of 1); the shop decides which to switch off.
- Deploy `shipping-carriers` and set its secrets when a carrier contract exists.
