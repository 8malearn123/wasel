#!/usr/bin/env bash
# Backup of the live database, consistent to one instant, proved restorable.
#
#   SRC_URL=<read-only login>  TARGET_URL=<empty scratch database, superuser>
#   OUT=<directory>  bash .github/scripts/db-backup.sh
#
# 1. checks the source login cannot write (db-readonly-guard.sh)
# 2. opens one read-only REPEATABLE READ transaction on the source and
#    exports its snapshot: every dump and every count below sees the database
#    as it was at that instant, whatever the shops do meanwhile
# 3. dumps schema and data of public + the migration history (and auth /
#    storage records when the login may read them) with pg_dump --snapshot
# 4. fingerprints every dumped table in that snapshot: row count + md5 of the
#    rows
# 5. restores the dump into TARGET_URL and fingerprints it the same way
# 6. VERIFIED only if both fingerprint lists are byte-identical
# The dump files stay in OUT (plain text; the workflow encrypts and deletes
# them). Nothing is ever written to the source.
set -euo pipefail

: "${SRC_URL:?}" "${TARGET_URL:?}" "${OUT:?}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=900000'

bash "$HERE/db-readonly-guard.sh" "$SRC_URL"

src() { psql "$SRC_URL" -XqAt -v ON_ERROR_STOP=1 "$@"; }

# --- 2. hold a snapshot --------------------------------------------------------
coproc HOLD { psql "$SRC_URL" -XqAt -v ON_ERROR_STOP=1; }
hold_pid=$HOLD_PID
release() { { echo "ROLLBACK;"; echo "\\q"; } >&"${HOLD[1]}" 2>/dev/null || true; wait "$hold_pid" 2>/dev/null || true; }
trap release EXIT
echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;" >&"${HOLD[1]}"
echo "SELECT pg_export_snapshot();" >&"${HOLD[1]}"
read -r -t 60 SNAP <&"${HOLD[0]}" || { echo "::error::could not export a snapshot (is this the session pooler, port 5432?)"; exit 1; }
taken_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Snapshot $SNAP held from $taken_at"

in_snapshot() {  # run SQL in the held snapshot from another session
  psql "$SRC_URL" -XqAt -v ON_ERROR_STOP=1 "$@" <<SQL
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT '$SNAP';
\\i $HERE/db-fingerprints.sql
COMMIT;
SQL
}

# --- 3. dump -----------------------------------------------------------------------
schemas="public,supabase_migrations"
extra_tables=()
for t in auth.users auth.identities storage.buckets storage.objects; do
  if [ "$(src -c "select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname || '.' || c.relname = '$t' and has_schema_privilege(n.oid, 'USAGE') and has_table_privilege(c.oid, 'SELECT'))")" = "t" ]; then
    extra_tables+=("$t")
  fi
done
echo "Schemas dumped in full: $schemas"
echo "Auth/storage tables dumped (data only): ${extra_tables[*]:-none — the login may not read them}"

pg_dump "$SRC_URL" --snapshot="$SNAP" -n public -n supabase_migrations --schema-only --no-owner -f "$OUT/schema.sql"
pg_dump "$SRC_URL" --snapshot="$SNAP" -n public -n supabase_migrations --data-only --no-owner -f "$OUT/data.sql"
if [ ${#extra_tables[@]} -gt 0 ]; then
  pg_dump "$SRC_URL" --snapshot="$SNAP" $(printf ' -t %s' "${extra_tables[@]}") --data-only --no-owner -f "$OUT/auth-storage-data.sql"
fi
src -c "select extname || '|' || extversion || '|' || n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1" > "$OUT/extensions.txt"
src -c "select current_setting('server_version')" > "$OUT/server_version.txt"

# --- 4. fingerprints of the source, in the snapshot --------------------------------
fp_tables=$(IFS=,; echo "${extra_tables[*]:-}")
in_snapshot -v schemas="$schemas" -v tables= > "$OUT/fingerprints.source.txt"
if [ -n "$fp_tables" ]; then
  in_snapshot -v schemas="auth,storage" -v tables="$fp_tables" >> "$OUT/fingerprints.source.txt"
fi
release; trap - EXIT
echo "Source: $(wc -l < "$OUT/fingerprints.source.txt") tables, $(awk -F'|' '{s+=$2} END {print s}' "$OUT/fingerprints.source.txt") rows"

# --- 5. restore into the scratch database -----------------------------------------
tgt() { PGOPTIONS='' psql "$TARGET_URL" -Xq -v ON_ERROR_STOP=1 "$@"; }
# extensions the schema may need (each in its own schema, as on the source)
while IFS='|' read -r ext ver nsp; do
  [ "$ext" = plpgsql ] && continue
  tgt -c "CREATE SCHEMA IF NOT EXISTS \"$nsp\"; CREATE EXTENSION IF NOT EXISTS \"$ext\" SCHEMA \"$nsp\"" >/dev/null 2>&1 \
    || echo "::warning::extension $ext not available in the scratch database"
done < "$OUT/extensions.txt"
# roles named in grants must exist for the grants to restore
for r in $(grep -ohE '\b(TO|FROM) [a-z_][a-z0-9_]*' "$OUT/schema.sql" | awk '{print $2}' | grep -vx public | sort -u); do
  tgt -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$r') THEN CREATE ROLE \"$r\" NOLOGIN; END IF; END \$\$" >/dev/null
done
tgt -c "DROP SCHEMA IF EXISTS supabase_migrations CASCADE"
# public exists in every database; the dump's own CREATE SCHEMA public is dropped
sed -E '/^CREATE SCHEMA public;$/d' "$OUT/schema.sql" > "$OUT/schema.restore.sql"
tgt --single-transaction -f "$OUT/schema.restore.sql" >/dev/null
# rows go in as they were: triggers and foreign-key triggers do not fire
PGOPTIONS='-c session_replication_role=replica' psql "$TARGET_URL" -Xq -v ON_ERROR_STOP=1 --single-transaction -f "$OUT/data.sql" >/dev/null
if [ -f "$OUT/auth-storage-data.sql" ]; then
  # the scratch database's own auth/storage tables receive the rows
  PGOPTIONS='-c session_replication_role=replica' psql "$TARGET_URL" -Xq -v ON_ERROR_STOP=1 --single-transaction -f "$OUT/auth-storage-data.sql" >/dev/null
fi

# --- 6. compare --------------------------------------------------------------------
PGOPTIONS='' psql "$TARGET_URL" -XqAt -v ON_ERROR_STOP=1 -v schemas="$schemas" -v tables= -f "$HERE/db-fingerprints.sql" > "$OUT/fingerprints.restored.txt"
if [ -n "$fp_tables" ]; then
  PGOPTIONS='' psql "$TARGET_URL" -XqAt -v ON_ERROR_STOP=1 -v schemas="auth,storage" -v tables="$fp_tables" -f "$HERE/db-fingerprints.sql" >> "$OUT/fingerprints.restored.txt"
fi

{
  echo "taken_at=$taken_at"
  echo "server_version=$(cat "$OUT/server_version.txt")"
  echo "snapshot=$SNAP"
  echo "schemas=$schemas"
  echo "auth_storage_tables=${fp_tables:-none}"
  echo "tables=$(wc -l < "$OUT/fingerprints.source.txt")"
  echo "rows=$(awk -F'|' '{s+=$2} END {print s}' "$OUT/fingerprints.source.txt")"
} > "$OUT/manifest.txt"

if diff -u "$OUT/fingerprints.source.txt" "$OUT/fingerprints.restored.txt" > "$OUT/fingerprints.diff"; then
  echo "verified=yes" >> "$OUT/manifest.txt"
  echo "VERIFIED: the restored copy matches the source table by table (counts and row fingerprints)."
else
  echo "verified=no" >> "$OUT/manifest.txt"
  echo "::error::NOT VERIFIED — tables differ after restore (names and counts only):"
  grep -E '^[-+][^-+]' "$OUT/fingerprints.diff" | cut -d'|' -f1,2 | head -50
  exit 2
fi
