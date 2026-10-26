#!/usr/bin/env bash
# Calls the functions the app needs, as the site does (anon key + a signed-in
# demo owner), and prints the HTTP status of each: 404 = not in the database.
# --expect-present fails the run if any is still 404.
set -euo pipefail
ANON=$(grep -E '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2- | tr -d '"')
TOKEN=$(curl -sS "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"email":"demo-enterprise@wasil.demo","password":"demo1234"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
missing=0
for fn in my_permissions get_subscription_state; do
  code=$(curl -sS -o body.json -w '%{http_code}' -X POST "$SUPABASE_URL/rest/v1/rpc/$fn" \
    -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')
  echo "$fn → HTTP $code $(head -c 200 body.json)"
  [ "$code" = 404 ] && missing=1
done
rm -f body.json
if [ "${1:-}" = --expect-present ] && [ $missing = 1 ]; then echo "::error::a function is still 404"; exit 1; fi
