# Database tests

Integration tests for the migrations and the transactional-core RPCs
(`pos_checkout`, `place_online_order`, `track_public_order`,
`release_expired_reservations`). They run against a real Postgres, not mocks.

## Running

You need a **throwaway** Postgres 15+ and a superuser connection. The suite
creates and drops its own `wasel_test_*` databases, and refuses
`*.supabase.co` hosts.

```sh
docker run -d --name wasel-test-pg -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:16
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres npm run test:db
```

`npm test` (unit tests) does not need a database. CI runs this suite through
`.github/workflows/db-tests.yml` whenever `supabase/**` changes.

## How it works

1. **Global setup** (`db/global-setup.ts`) builds a template database:
   - `support/supabase_stubs.sql`: stand-ins for Supabase's `anon` /
     `authenticated` roles, the `auth` schema and `auth.uid()`.
   - Every file in `supabase/migrations`, in filename order, each in its own
     transaction (as `supabase db push` does).
   - `support/legacy_seed.sql`, inserted right before the first `20261018*`
     migration, so the Phase 0 data fixes and backfills run on realistic old
     rows (including a sale inflated by the old VAT bug).
   - `support/wholesale_stub.sql`, applied before `20260309011255…`, which
     needs tables that were never committed as migrations (schema drift).
     Delete it once those migrations exist.
2. **Each test** gets its own clone (`CREATE DATABASE … TEMPLATE`, a few
   hundred ms), dropped afterwards, so tests are fully isolated, including
   committed data in the concurrency tests.
3. Tests call functions the way PostgREST does: one transaction per request,
   `SET LOCAL ROLE anon|authenticated`, and the user id in
   `request.jwt.claim.sub` (`db().as(user(OWNER)).rpc(...)`). Superuser
   access (`db().sql(...)`) is only used to arrange state and to assert.
4. Errors are asserted on their stable `HINT` code
   (`DEVICE_UNAVAILABLE`, `PAYMENT_MISMATCH`, …) or SQLSTATE.

| File | Covers |
|---|---|
| `db/migrations.test.ts` | D1 VAT fix + daily-closing correction, de-duplicated numbers, backfills, enums, dropped policies, immutable ledger |
| `db/pos-checkout.test.ts` | Split tender, VAT, numbering, customers, every refusal (with rollback checks), authorization |
| `db/online-orders.test.ts` | Server pricing, holds, TTL, refusals, RLS, tracking, status → stock lifecycle, expiry (cron and lazy) |
| `db/shifts.test.ts` | Open/close shift rules, selling needs a shift, expected cash and blind count, manager approval, movements, races between closing and selling |
| `db/concurrency.test.ts` | Two tills / POS vs web racing for one IMEI, rollback hand-over, 30 parallel invoices, last-unit race |

Fixture IDs live in `db/fixtures.ts`. Keep them in sync with `support/legacy_seed.sql`.
