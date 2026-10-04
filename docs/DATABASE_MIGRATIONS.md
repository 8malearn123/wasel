# Applying the pending migrations

Eight migrations are committed but **not yet applied** to Supabase. The app is
written to survive that — see *What still works without them* below — but
several features stay off until they run.

Run them **in filename order**. Each one is re-runnable: running it twice is
harmless, so a half-finished attempt can simply be repeated.

| # | File | What it does |
|---|------|--------------|
| 1 | `20261004090000_secure_subscriptions.sql` | Activation codes, trial on the server clock, merchants can no longer write their own subscription |
| 2 | `20261004090100_rls_hardening.sql` | Four RLS holes: debt write-off, order items, public cost |
| 3 | `20261004090200_login_code_rate_limit.sql` | Throttles the 5-digit login-code endpoint |
| 4 | `20261004100000_product_foundation.sql` | Slugs, categories, product fields, validation |
| 5 | `20261004100100_product_media.sql` | `product_media` + the `product-media` bucket |
| 6 | `20261004100200_rbac.sql` | Roles, permissions, `has_permission()` |
| 7 | `20261004100300_employees.sql` | `employees` + the `products_v` view |
| 8 | `20261004100400_product_write_permissions.sql` | Product INSERT/DELETE need a permission |

## Option A — Supabase SQL Editor (no tooling)

For each file in order: open it on GitHub, press **Raw**, select all, copy, paste
into **Supabase → SQL Editor → New query**, and **Run**.

```
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004090000_secure_subscriptions.sql
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004090100_rls_hardening.sql
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004090200_login_code_rate_limit.sql
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004100000_product_foundation.sql
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004100100_product_media.sql
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004100200_rbac.sql
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004100300_employees.sql
https://github.com/8malearn123/wasel/raw/main/supabase/migrations/20261004100400_product_write_permissions.sql
```

`NOTICE: ... does not exist, skipping` is expected — every `DROP ... IF EXISTS`
prints it on a first run. Only `ERROR` matters.

## Option B — Supabase CLI (one command)

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` applies every file under `supabase/migrations/` that the project has
not recorded, in order. This is the better option if you can install it: there
is no copying, and the project remembers what ran.

## After they run

1. **Issue an activation code.** The old `ACTIVATE-30` path is gone, so until a
   code exists nobody can activate. In the SQL Editor:
   ```sql
   SELECT public.create_activation_code('WASEL-XXXX-YYYY', 365, NULL, 1, NULL, 'first code');
   ```
   Keep the string you passed in — only its hash is stored, and it cannot be
   recovered.

2. **Check the bucket.** Migration 5 creates `product-media`; confirm it under
   **Storage**.

3. **Deploy the two edge functions** that changed in Phase 0:
   ```bash
   npx supabase functions deploy login-by-code
   npx supabase functions deploy award-loyalty
   ```

4. **Move the environment variables.** Put `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PUBLISHABLE_KEY` into Vercel →
   Settings → Environment Variables, **then** `git rm --cached .env`. In that
   order: untracking the file first would break the build.

## Verifying what is applied

Run this in the SQL Editor at any time. Every row should read `yes` once all
eight have been applied.

```sql
SELECT 'activation_codes table'     AS object,
       to_regclass('public.activation_codes') IS NOT NULL AS applied
UNION ALL SELECT 'product_media table',
       to_regclass('public.product_media') IS NOT NULL
UNION ALL SELECT 'employees table',
       to_regclass('public.employees') IS NOT NULL
UNION ALL SELECT 'roles table',
       to_regclass('public.roles') IS NOT NULL
UNION ALL SELECT 'products_v view',
       to_regclass('public.products_v') IS NOT NULL
UNION ALL SELECT 'has_permission()',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_permission')
UNION ALL SELECT 'my_permissions()',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'my_permissions')
UNION ALL SELECT 'redeem_activation_code()',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'redeem_activation_code')
UNION ALL SELECT 'product-media bucket',
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-media');
```

## What still works without them

The app does not depend on the migrations to run. Where a function or table is
missing it degrades to what the database actually permits:

| Area | Without the migrations |
|------|------------------------|
| Permissions | `my_permissions()` is absent, so the UI falls back to the `merchant_users.role` map — the same answer the old policies give. The catalogue screens work normally. |
| Plan features | Resolved from the `plans` columns, which already exist, so nothing changes. |
| Product photos | `product_media` is absent, so the manager shows an empty state and `ProductThumb` uses the committed `public/products/<IMEI>.jpg` files as before. |
| Employees | The page and its sidebar entry stay hidden; nothing else references the table. |
| Subscription status | `get_subscription_state()` is absent, so dates are read from the row as they were before Phase 0. |
| **Activation codes** | **Broken.** The old browser-side check was the vulnerability and is gone; the server-side replacement needs migration 1. This is the one regression of not applying them. |
