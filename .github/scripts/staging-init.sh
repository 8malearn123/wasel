#!/usr/bin/env bash
# Build wasel-staging: production's schema, the three demo shops' rows (with
# personal data replaced, see staging_copy_plan.py), its own sign-in accounts.
#
#   PROD_RO_URL      read-only login to production (never writes; guarded)
#   STAGING_DB_URL   postgres login to the staging project
#   STAGING_API_URL  https://<staging-ref>.supabase.co
#   STAGING_SERVICE_ROLE_KEY, STAGING_TEST_PASSWORD
#   DEMO_IDS         the three demo shop ids, comma separated
#   RESET=1          allowed to empty a staging that was built before
#
# Refuses to run unless the staging URLs name a project other than
# production's, and the staging database is either empty or marked
# 'wasel-staging' by an earlier run.
set -euo pipefail
: "${PROD_RO_URL:?}" "${STAGING_DB_URL:?}" "${STAGING_API_URL:?}" "${STAGING_SERVICE_ROLE_KEY:?}" "${STAGING_TEST_PASSWORD:?}" "${DEMO_IDS:?}"
PROD_REF=ynwddyxzypbcftlevuam
HERE="$(cd "$(dirname "$0")" && pwd)"
W="${WORKDIR:-$(mktemp -d)}"; mkdir -p "$W"

# --- guards ------------------------------------------------------------------------
case "$STAGING_DB_URL$STAGING_API_URL" in *"$PROD_REF"*) echo "::error::the staging settings point at production ($PROD_REF)"; exit 1;; esac
prod() { PGOPTIONS='-c default_transaction_read_only=on' psql "$PROD_RO_URL" -XqAt -v ON_ERROR_STOP=1 "$@"; }
stg()  { psql "$STAGING_DB_URL" -XqAt -v ON_ERROR_STOP=1 "$@"; }
bash "$HERE/db-readonly-guard.sh" "$PROD_RO_URL"
marker=$(stg -c "select coalesce(shobj_description(oid, 'pg_database'), '') from pg_database where datname = current_database()")
tables_now=$(stg -c "select count(*) from pg_tables where schemaname = 'public'")
if [ "$marker" = "wasel-staging" ]; then
  [ "${RESET:-0}" = 1 ] || { echo "::error::staging was built before; run with reset to rebuild it"; exit 1; }
elif [ "$tables_now" != 0 ]; then
  echo "::error::the staging database has $tables_now tables in public and no wasel-staging mark: not a staging project this workflow built. Nothing done."; exit 1
fi
stg -c "select 1" >/dev/null
[ "$(stg -c "select count(*) from pg_namespace where nspname = 'auth'")" = 1 ] || { echo "::error::staging is not a Supabase project (no auth schema)"; exit 1; }

api() {  # staging Auth admin API
  curl -sS -X "$1" "$STAGING_API_URL/auth/v1/admin/$2" -H "apikey: $STAGING_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $STAGING_SERVICE_ROLE_KEY" -H 'Content-Type: application/json' ${3:+--data "$3"}
}

# --- reset (staging only) ------------------------------------------------------------
if [ "$marker" = "wasel-staging" ]; then
  echo "Reset: emptying staging"
  stg -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON SCHEMA public TO postgres; DROP SCHEMA IF EXISTS supabase_migrations CASCADE;"
  for id in $(api GET 'users?per_page=1000' | python3 -c 'import json,sys; print("\n".join(u["id"] for u in json.load(sys.stdin).get("users", [])))'); do
    api DELETE "users/$id" >/dev/null
  done
fi

# --- schema --------------------------------------------------------------------------
echo "Schema: production public + migration history"
pg_dump "$PROD_RO_URL" -n public --schema-only --no-owner -f "$W/schema.sql"
pg_dump "$PROD_RO_URL" -n supabase_migrations --no-owner -f "$W/history.sql"
prod -c "select extname || '|' || n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where extname <> 'plpgsql'" > "$W/ext.txt"
while IFS='|' read -r ext nsp; do
  stg -c "CREATE EXTENSION IF NOT EXISTS \"$ext\" SCHEMA \"$nsp\"" >/dev/null 2>&1 || echo "::warning::extension $ext could not be enabled in staging"
done < "$W/ext.txt"
for r in $(grep -ohE '\b(TO|FROM) [a-z_][a-z0-9_]*' "$W/schema.sql" | awk '{print $2}' | grep -vx public | sort -u); do
  stg -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$r') THEN CREATE ROLE \"$r\" NOLOGIN; END IF; END \$\$" >/dev/null
done
sed -E '/^CREATE SCHEMA public;$/d' "$W/schema.sql" > "$W/schema.restore.sql"
stg --single-transaction -f "$W/schema.restore.sql" >/dev/null
stg --single-transaction -f "$W/history.sql" >/dev/null
echo "Applied migrations recorded in staging: $(stg -c 'select count(*) from supabase_migrations.schema_migrations')"

# --- what to copy ------------------------------------------------------------------
prod -c "
select json_build_object('tables', json_agg(json_build_object(
  'name', c.relname,
  'columns', (select json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
                                                'notnull', a.attnotnull, 'generated', a.attgenerated <> '') order by a.attnum)
                from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
  'fks', coalesce((select json_agg(json_build_object(
                     'cols', (select json_agg(a.attname order by k.ord) from unnest(f.conkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = f.conrelid and a.attnum = k.n),
                     'ref_schema', rn.nspname, 'ref_table', rc.relname,
                     'ref_cols', (select json_agg(a.attname order by k.ord) from unnest(f.confkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = f.confrelid and a.attnum = k.n)))
                   from pg_constraint f join pg_class rc on rc.oid = f.confrelid join pg_namespace rn on rn.oid = rc.relnamespace
                  where f.conrelid = c.oid and f.contype = 'f'), '[]'::json))))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p')" > "$W/catalog.json"
python3 "$HERE/staging_copy_plan.py" "$W/catalog.json" "$DEMO_IDS" > "$W/plan.json"
python3 - "$W/plan.json" <<'PY'
import json, sys
for e in json.load(open(sys.argv[1])):
    print(f"  {e['table']:32} {e['rule']:9} {e.get('via') or e.get('reason') or ''}")
PY

# --- sign-in accounts for the demo shops' members ---------------------------------
demo_sql=$(echo "$DEMO_IDS" | sed -E "s/([0-9a-f-]{36})/'\1'/g")
email_join="NULL::text"
if [ "$(prod -c "select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'auth' and c.relname = 'users' and has_schema_privilege(n.oid, 'USAGE') and has_table_privilege(c.oid, 'SELECT'))")" = t ]; then
  email_join="(select u.email from auth.users u where u.id = mu.user_id and u.email like '%@wasil.demo')"
fi
prod -F $'\t' -c "
  select mu.user_id, mu.merchant_id, mu.role,
         coalesce($email_join,
           case when mu.role = 'owner' then
             case mu.merchant_id when '$(echo "$DEMO_IDS" | cut -d, -f1)' then 'demo-distributor@wasil.demo'
                                 when '$(echo "$DEMO_IDS" | cut -d, -f2)' then 'demo-enterprise@wasil.demo'
                                 when '$(echo "$DEMO_IDS" | cut -d, -f3)' then 'demo-basic@wasil.demo' end
           end,
           'staging-' || left(mu.merchant_id::text, 4) || '-' || mu.role || '-' || left(mu.id::text, 4) || '@wasil.demo')
    from public.merchant_users mu where mu.merchant_id in ($demo_sql) and mu.user_id is not null order by 2, 3" > "$W/members.tsv"
: > "$W/users.tsv"
while IFS=$'\t' read -r old_id shop role email; do
  body=$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "password": sys.argv[2], "email_confirm": True}))' "$email" "$STAGING_TEST_PASSWORD")
  new_id=$(api POST users "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or "")')
  [ -n "$new_id" ] || { echo "::error::could not create the staging account $email"; exit 1; }
  printf '%s\t%s\t%s\t%s\t%s\n' "$old_id" "$new_id" "$email" "$shop" "$role" >> "$W/users.tsv"
done < "$W/members.tsv"
echo "Staging accounts (all share the STAGING_TEST_PASSWORD secret):"
cut -f3-5 "$W/users.tsv" | sed 's/^/  /'

# --- copy rows -------------------------------------------------------------------------
python3 - "$W/plan.json" > "$W/copy.tsv" <<'PY'
import json, sys
for e in json.load(open(sys.argv[1])):
    if 'select' in e:
        print('\t'.join([e['table'], ','.join(e['columns']), e['select'], e['count']]))
PY
: > "$W/counts.prod.txt"
while IFS=$'\t' read -r table cols select count_sql; do
  n=$(prod -c "$count_sql")
  echo "$table|$n" >> "$W/counts.prod.txt"
  [ "$n" = 0 ] && continue
  prod -c "\\copy ($select) TO STDOUT" \
    | PGOPTIONS='-c session_replication_role=replica' psql "$STAGING_DB_URL" -Xq -v ON_ERROR_STOP=1 -c "\\copy public.$table ($cols) FROM STDIN"
done < "$W/copy.tsv"

# --- remap sign-in ids, then check every foreign key -------------------------------------
{
  echo "SET session_replication_role = replica;"
  echo "CREATE TEMP TABLE m (old uuid PRIMARY KEY, new uuid NOT NULL, shop uuid, role text);"
  while IFS=$'\t' read -r old new email shop role; do echo "INSERT INTO m VALUES ('$old', '$new', '$shop', '$role') ON CONFLICT DO NOTHING;"; done < "$W/users.tsv"
  python3 - "$W/plan.json" <<'PY'
import json, sys
for e in json.load(open(sys.argv[1])):
    t = e['table']
    for c in e.get('user_columns', []):
        n = c['name']
        print(f"UPDATE public.{t} t SET {n} = m.new FROM m WHERE t.{n} = m.old;")
        # an account that is not one of the demo shops' members
        if not c['notnull']:
            print(f"UPDATE public.{t} SET {n} = NULL WHERE {n} IS NOT NULL AND {n} NOT IN (SELECT new FROM m);")
        elif 'merchant_id' in e['columns']:
            print(f"UPDATE public.{t} t SET {n} = o.new FROM m o WHERE o.shop = t.merchant_id AND o.role = 'owner' AND t.{n} NOT IN (SELECT new FROM m);")
        else:
            print(f"DELETE FROM public.{t} WHERE {n} NOT IN (SELECT new FROM m);")
PY
} > "$W/remap.sql"
stg --single-transaction -f "$W/remap.sql" >/dev/null

stg -c "
select format('DELETE FROM %I.%I c WHERE %I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I.%I p WHERE p.%I = c.%I)',
              n.nspname, c.relname, a.attname, rn.nspname, rc.relname, ra.attname, a.attname)
  from pg_constraint f
  join pg_class c on c.oid = f.conrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_class rc on rc.oid = f.confrelid join pg_namespace rn on rn.oid = rc.relnamespace
  join pg_attribute a on a.attrelid = f.conrelid and a.attnum = f.conkey[1]
  join pg_attribute ra on ra.attrelid = f.confrelid and ra.attnum = f.confkey[1]
 where f.contype = 'f' and n.nspname = 'public' and array_length(f.conkey, 1) = 1" > "$W/orphans.sql"
for pass in 1 2 3; do
  removed=0
  while read -r stmt; do
    r=$(psql "$STAGING_DB_URL" -XqAt -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica" -c "WITH d AS ($stmt RETURNING 1) SELECT count(*) FROM d" 2>/dev/null || echo 0)
    if [ "${r:-0}" != 0 ]; then echo "  pass $pass: removed $r rows that pointed at rows not copied — ${stmt:12:60}"; removed=$((removed + r)); fi
  done < "$W/orphans.sql"
  [ "$removed" = 0 ] && break
done

# --- compare, mark, reload ---------------------------------------------------------------
fails=0
while IFS='|' read -r table n; do
  s=$(stg -c "select count(*) from public.$table")
  [ "$s" = "$n" ] && echo "  $table: $s" || { echo "::warning::$table: production demo rows $n, staging $s"; fails=1; }
done < "$W/counts.prod.txt"
stg -c "DO \$\$ BEGIN EXECUTE format('COMMENT ON DATABASE %I IS %L', current_database(), 'wasel-staging'); END \$\$" -c "NOTIFY pgrst, 'reload schema'"
cp "$W/users.tsv" "${USERS_OUT:-/dev/null}" 2>/dev/null || true
echo "Staging built. Rows differing from production's demo rows: $([ $fails = 0 ] && echo none || echo 'see warnings')"
