#!/usr/bin/env bash
# Proves a database connection cannot write before anything reads through it.
#
#   bash .github/scripts/db-readonly-guard.sh "$DB_URL"
#
# Exits non-zero — and the workflow stops — if the login:
#   - is a superuser, or may create roles, databases or replicate
#   - is a member of any other role (it could SET ROLE to it)
#   - holds INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on any table or
#     view, or INSERT/UPDATE on any column, outside the system catalogs
#   - may call nextval() (USAGE/UPDATE) on any sequence
#   - may CREATE in any schema or in the database
#   - succeeds at any of the write attempts below. Each attempt matches no row
#     (WHERE false) or is rolled back, so even a wrongly privileged login
#     changes nothing; they run WITHOUT the read-only session setting, so they
#     prove the missing privilege itself, not just the setting.
# Then it prints the SECURITY DEFINER functions PUBLIC may execute (the one
# path grants cannot close; see supabase/manual/readonly_role.sql).
set -uo pipefail

URL="${1:?usage: db-readonly-guard.sh <connection url>}"
fail=0
q() { psql "$URL" -XqAt -v ON_ERROR_STOP=1 -c "$1"; }
bad() { echo "::error::$1"; fail=1; }

who=$(q "select current_user") || { echo "::error::cannot connect"; exit 1; }
echo "Connected as: $who"

attrs=$(q "select rolsuper, rolcreaterole, rolcreatedb, rolreplication from pg_roles where rolname = current_user")
[ "$attrs" = "f|f|f|f" ] || bad "role attributes super|createrole|createdb|replication = $attrs (all must be f)"

members=$(q "select coalesce(string_agg(b.rolname, ', '), '') from pg_auth_members m join pg_roles b on b.oid = m.roleid join pg_roles r on r.oid = m.member where r.rolname = current_user")
[ -z "$members" ] || bad "member of: $members (must be none)"

writable=$(q "
  select coalesce(string_agg(format('%s.%s:%s', n.nspname, c.relname, p), ', '), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
   where c.relkind in ('r','p','v','m','f')
     and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%' and n.nspname not like 'pg_temp%'
     and has_table_privilege(c.oid, p)")
[ -z "$writable" ] || bad "table privileges that write: ${writable:0:2000}"

colwrite=$(q "
  select coalesce(string_agg(format('%s.%s:%s', n.nspname, c.relname, p), ', '), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['INSERT','UPDATE']) p
   where c.relkind in ('r','p','v','m','f')
     and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%'
     and has_any_column_privilege(c.oid, p)")
[ -z "$colwrite" ] || bad "column privileges that write: ${colwrite:0:2000}"

seqs=$(q "
  select coalesce(string_agg(format('%s.%s:%s', n.nspname, c.relname, p), ', '), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['USAGE','UPDATE']) p
   where c.relkind = 'S' and n.nspname not in ('pg_catalog','information_schema')
     and has_sequence_privilege(c.oid, p)")
[ -z "$seqs" ] || bad "sequence privileges that write: ${seqs:0:2000}"

schemas=$(q "
  select coalesce(string_agg(nspname, ', '), '') from pg_namespace
   where nspname not like 'pg_temp%' and nspname not like 'pg_toast_temp%'
     and has_schema_privilege(oid, 'CREATE')")
[ -z "$schemas" ] || bad "may create objects in schemas: $schemas"

[ "$(q "select has_database_privilege(current_database(), 'CREATE')")" = "f" ] || bad "may create schemas in the database"

# Write attempts — none may succeed. Plain session (no read-only default from
# PGOPTIONS here; the role's own default is switched off for the attempt).
try_write() {
  local label="$1" sql="$2" out
  if out=$(PGOPTIONS='' psql "$URL" -Xq -v ON_ERROR_STOP=1 -v VERBOSITY=verbose 2>&1 <<SQL
\\set VERBOSITY verbose
SET default_transaction_read_only = off;
BEGIN READ WRITE;
$sql;
ROLLBACK;
SQL
); then
    bad "write attempt succeeded: $label"
  elif echo "$out" | grep -qE 'ERROR: +42501'; then
    echo "refused for lack of privilege, as expected — $label"
  else
    # refused, but not for the reason under test: the check proves nothing
    bad "write attempt failed for another reason, privilege not proven — $label: $(echo "$out" | grep -E 'ERROR' | head -1)"
  fi
}
first_table=$(q "select format('%I.%I', schemaname, tablename) from pg_tables where schemaname = 'public' order by tablename limit 1")
if [ -n "$first_table" ]; then
  col=$(q "select quote_ident(attname) from pg_attribute where attrelid = '$first_table'::regclass and attnum > 0 and not attisdropped and attgenerated = '' order by attnum limit 1")
  try_write "UPDATE $first_table (no row matches)" "UPDATE $first_table SET $col = $col WHERE false"
  try_write "DELETE FROM $first_table (no row matches)" "DELETE FROM $first_table WHERE false"
  try_write "INSERT INTO $first_table (no row inserted)" "INSERT INTO $first_table ($col) SELECT $col FROM $first_table WHERE false"
fi
try_write "CREATE TABLE in public (rolled back)" "CREATE TABLE public.ci_guard_probe_must_fail (x int)"
try_write "CREATE SCHEMA (rolled back)" "CREATE SCHEMA ci_guard_probe_must_fail"
try_write "CREATE ROLE (rolled back)" "CREATE ROLE ci_guard_probe_must_fail"

# The read-only default must be on for the sessions the workflows use
[ "$(PGOPTIONS='' q "show default_transaction_read_only")" = "on" ] \
  || echo "::warning::the role's sessions are not read-only by default (ALTER ROLE … SET default_transaction_read_only = on); the workflows set it themselves"

echo "SECURITY DEFINER functions PUBLIC may execute (run with their owner's rights for any caller, the anon key included):"
q "
  select format('  %s.%s(%s) owner=%s', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_userbyid(p.proowner))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef and n.nspname = 'public'
     and has_function_privilege('public', p.oid, 'EXECUTE')
   order by 1" || true

rls=$(q "select rolbypassrls from pg_roles where rolname = current_user")
[ "$rls" = "t" ] && echo "RLS: bypassed (reads every shop's rows)" \
  || echo "::warning::RLS is not bypassed: tables with row level security read as empty — a backup through this login would be incomplete"

if [ "$fail" -ne 0 ]; then
  echo "::error::This connection can write. Nothing was read. Use the read-only role from supabase/manual/readonly_role.sql."
  exit 1
fi
echo "OK: this connection cannot write."
