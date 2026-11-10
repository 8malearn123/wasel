-- Read-only preflight for the pending migrations, run against the live
-- database through the read-only role (db-check.yml). Every statement is a
-- SELECT. Customer data is never printed: only shop ids and names, counts and
-- the subscription fields a migration would change.
--
-- psql -v demo="'6245ba37-…','e2cffaf5-…','25d29b66-…'" -f db-preflight.sql
\set ON_ERROR_STOP on
\pset footer on
SET default_transaction_read_only = on;
SET TimeZone = 'UTC';

\echo '## Server'
SELECT current_setting('server_version') AS server_version, current_user AS login;
SELECT extname, extversion FROM pg_extension ORDER BY 1;

\echo '## Shops (demo = one of the three demo shops)'
SELECT count(*) AS shops,
       count(*) FILTER (WHERE id IN (:demo)) AS demo_shops,
       count(*) FILTER (WHERE id NOT IN (:demo)) AS other_shops
  FROM public.merchants;

-- ---------------------------------------------------------------------------
\echo '## 20261004090000 secure_subscriptions — a unique index on subscriptions.merchant_id fails if a shop has two rows'
SELECT s.merchant_id, (s.merchant_id IN (:demo)) AS demo, count(*) AS rows
  FROM public.subscriptions s GROUP BY 1, 2 HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
\echo '## 20261004090100 rls_hardening — storefront views: columns they read from devices/accessories'
\echo '##   (the migration leaves anon only these: devices id,merchant_id,branch_id,model,brand,color,storage,condition,price,status,notes,created_at;'
\echo '##    accessories id,merchant_id,branch_id,sku,name,category,brand,price,quantity,min_quantity,created_at)'
SELECT v.relname AS view, coalesce((
         SELECT option_value FROM pg_options_to_table(v.reloptions) WHERE option_name = 'security_invoker'), 'false') AS security_invoker,
       t.relname AS reads_table, a.attname AS column,
       NOT (
         (t.relname = 'devices' AND a.attname = ANY (ARRAY['id','merchant_id','branch_id','model','brand','color','storage','condition','price','status','notes','created_at']))
      OR (t.relname = 'accessories' AND a.attname = ANY (ARRAY['id','merchant_id','branch_id','sku','name','category','brand','price','quantity','min_quantity','created_at']))
       ) AS not_granted_after
  FROM pg_rewrite r
  JOIN pg_class v ON v.oid = r.ev_class
  JOIN pg_depend d ON d.objid = r.oid AND d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass AND d.refobjsubid > 0
  JOIN pg_class t ON t.oid = d.refobjid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
 WHERE v.relname IN ('public_store_devices', 'public_store_accessories')
   AND t.relname IN ('devices', 'accessories')
 GROUP BY 1, 2, 3, 4 ORDER BY 1, 3, 4;

\echo '## 20261004090100 rls_hardening — who may read online_orders (the new order-items policy for visitors reads it)'
SELECT policyname, cmd, roles, qual FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('online_orders', 'online_order_items') ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
\echo '## 20261004100000 product_foundation — rows the new CHECK constraints refuse (the whole migration fails if any)'
SELECT 'devices' AS tbl, merchant_id, (merchant_id IN (:demo)) AS demo,
       count(*) FILTER (WHERE price < 0 OR cost < 0) AS negative_price_or_cost,
       count(*) FILTER (WHERE btrim(coalesce(model, '')) = '') AS blank_name,
       0::bigint AS negative_quantity, 0::bigint AS bad_status
  FROM public.devices GROUP BY 2, 3
HAVING count(*) FILTER (WHERE price < 0 OR cost < 0 OR btrim(coalesce(model, '')) = '') > 0
UNION ALL
SELECT 'accessories', merchant_id, (merchant_id IN (:demo)),
       count(*) FILTER (WHERE price < 0 OR cost < 0),
       count(*) FILTER (WHERE btrim(coalesce(name, '')) = ''),
       count(*) FILTER (WHERE quantity < 0),
       count(*) FILTER (WHERE to_jsonb(a) ->> 'status' IS NOT NULL AND to_jsonb(a) ->> 'status' NOT IN ('draft', 'active', 'archived'))
  FROM public.accessories a GROUP BY 2, 3
HAVING count(*) FILTER (WHERE price < 0 OR cost < 0 OR btrim(coalesce(name, '')) = '' OR quantity < 0
         OR (to_jsonb(a) ->> 'status' IS NOT NULL AND to_jsonb(a) ->> 'status' NOT IN ('draft', 'active', 'archived'))) > 0
UNION ALL
SELECT 'repair_parts', merchant_id, (merchant_id IN (:demo)),
       count(*) FILTER (WHERE price < 0 OR cost < 0),
       count(*) FILTER (WHERE btrim(coalesce(name, '')) = ''),
       count(*) FILTER (WHERE quantity < 0),
       count(*) FILTER (WHERE to_jsonb(r) ->> 'status' IS NOT NULL AND to_jsonb(r) ->> 'status' NOT IN ('draft', 'active', 'archived'))
  FROM public.repair_parts r GROUP BY 2, 3
HAVING count(*) FILTER (WHERE price < 0 OR cost < 0 OR btrim(coalesce(name, '')) = '' OR quantity < 0
         OR (to_jsonb(r) ->> 'status' IS NOT NULL AND to_jsonb(r) ->> 'status' NOT IN ('draft', 'active', 'archived'))) > 0;

\echo '## 20261004100000 product_foundation — products whose updated_at the slug backfill will touch'
SELECT (SELECT count(*) FROM public.devices) AS devices,
       (SELECT count(*) FROM public.accessories) AS accessories,
       (SELECT count(*) FROM public.repair_parts) AS repair_parts;

-- ---------------------------------------------------------------------------
\echo '## 20261004100200 rbac — one role row per member, from the current role'
SELECT role, count(*) AS members, count(*) FILTER (WHERE merchant_id IN (:demo)) AS in_demo_shops
  FROM public.merchant_users GROUP BY 1 ORDER BY 1;

-- ---------------------------------------------------------------------------
\echo '## 20261005120000 wholesale_supply_requires_plan — shops with active listings that could no longer list or edit them'
SELECT l.merchant_id, (l.merchant_id IN (:demo)) AS demo, m.name AS shop, count(*) AS active_listings,
       s.status AS subscription_status, p.name AS plan, p.has_wholesale
  FROM public.wholesale_listings l
  LEFT JOIN public.merchants m ON m.id = l.merchant_id
  LEFT JOIN public.subscriptions s ON s.merchant_id = l.merchant_id
  LEFT JOIN public.plans p ON p.id = s.plan_id
 WHERE l.is_active
   AND NOT coalesce(s.status IN ('trial', 'active') AND p.has_wholesale, false)
 GROUP BY 1, 2, 3, 5, 6, 7 ORDER BY 2, 3;

-- ---------------------------------------------------------------------------
\echo '## 20261023100000 subscription_plan_consistency — step 1: plan_id filled from the plan text'
SELECT s.merchant_id, (s.merchant_id IN (:demo)) AS demo, m.name AS shop, s.status,
       s.plan AS plan_text, s.plan_id AS plan_id_now, p.id AS plan_id_after,
       (SELECT count(*) FROM public.plans p2 WHERE p2.name = s.plan) AS plans_with_that_name
  FROM public.subscriptions s
  JOIN public.plans p ON p.name = s.plan
  LEFT JOIN public.merchants m ON m.id = s.merchant_id
 WHERE s.plan_id IS NULL AND s.plan <> 'trial'
 ORDER BY 2, 3;

\echo '## 20261023100000 subscription_plan_consistency — step 2: plan text and limits aligned with plan_id (never lowered)'
WITH a AS (
  SELECT s.*, coalesce(s.plan_id, (SELECT p.id FROM public.plans p WHERE p.name = s.plan AND s.plan <> 'trial' LIMIT 1)) AS pid
    FROM public.subscriptions s
)
SELECT a.merchant_id, (a.merchant_id IN (:demo)) AS demo, m.name AS shop, a.status,
       a.plan AS plan_text_now, p.name AS plan_text_after,
       a.max_branches AS branches_now, greatest(coalesce(a.max_branches, 0), p.branch_limit) AS branches_after,
       a.max_users AS users_now, greatest(coalesce(a.max_users, 0), p.user_limit) AS users_after
  FROM a
  JOIN public.plans p ON p.id = a.pid
  LEFT JOIN public.merchants m ON m.id = a.merchant_id
 WHERE a.plan <> 'trial'
   AND (a.plan IS DISTINCT FROM p.name
        OR coalesce(a.max_branches, 0) < p.branch_limit
        OR coalesce(a.max_users, 0) < p.user_limit)
 ORDER BY 2, 3;

\echo '## 20261023100000 — subscriptions it leaves alone because plan text is trial/NULL or plan_id points nowhere'
SELECT count(*) FILTER (WHERE s.plan = 'trial') AS trial_text,
       count(*) FILTER (WHERE s.plan IS NULL) AS no_plan_text,
       count(*) FILTER (WHERE s.plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.plans p WHERE p.id = s.plan_id)) AS plan_id_without_plan
  FROM public.subscriptions s;

-- ---------------------------------------------------------------------------
\echo '## 20261027090100 branch_limit — shops already over their branch limit (kept; they cannot add more)'
SELECT b.merchant_id, (b.merchant_id IN (:demo)) AS demo, m.name AS shop,
       count(*) FILTER (WHERE b.is_active) AS active_branches,
       greatest(coalesce(s.max_branches, 0), coalesce(p.branch_limit, 0)) AS limit_after
  FROM public.branches b
  LEFT JOIN public.merchants m ON m.id = b.merchant_id
  LEFT JOIN public.subscriptions s ON s.merchant_id = b.merchant_id
  LEFT JOIN public.plans p ON p.id = s.plan_id
 GROUP BY 1, 2, 3, 5
HAVING count(*) FILTER (WHERE b.is_active) > greatest(coalesce(s.max_branches, 0), coalesce(p.branch_limit, 0))
 ORDER BY 2, 3;

\echo '## 20261027090000 sale_device_once — devices on more than one invoice today (left as they are)'
SELECT si.device_id, d.merchant_id, (d.merchant_id IN (:demo)) AS demo, count(DISTINCT si.sale_id) AS invoices
  FROM public.sale_items si JOIN public.devices d ON d.id = si.device_id
 GROUP BY 1, 2, 3 HAVING count(DISTINCT si.sale_id) > 1;
