// One-off, READ ONLY: why do my_permissions / get_subscription_state /
// wholesale_parties answer 404? Probes one table per pending migration (GET)
// and calls read-only functions; prints status and error code.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const s = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }) })).json();
const H = { apikey: ANON, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
const show = async (tag, r) => { const t = await r.text(); let code = ''; try { const j = JSON.parse(t); code = j.code ? `${j.code} ${j.message}`.slice(0, 160) : `rows=${Array.isArray(j) ? j.length : typeof j}`; } catch { code = t.slice(0, 80); } console.log(`EV ${tag} HTTP ${r.status} ${code}`); };
for (const [mig, table] of [
  ['20261004090000 secure_subscriptions', 'subscription_events'],
  ['20261004090200 login_code_rate_limit', 'login_code_attempts'],
  ['20261004100100 product_media', 'product_media'],
  ['20261004100200 rbac', 'roles'],
  ['20261004100200 rbac', 'permissions'],
  ['20261004100300 employees', 'employees'],
  ['20261004100300 employees', 'products_v'],
  ['existing (control)', 'devices'],
]) await show(`table ${table} [${mig}]`, await fetch(`${SUPA}/rest/v1/${table}?select=*&limit=1`, { headers: H }));
// read-only functions, called the way the app calls them
for (const [fn, body] of [
  ['get_user_merchant_id', {}], ['is_platform_admin', {}],
  ['my_permissions', {}], ['get_subscription_state', {}],
  ['wholesale_parties', { _merchant_ids: ['6245ba37-9e68-4e5e-9e68-46ffee192fb4'] }], ['wholesale_listing_items', { _listing_ids: [] }],
  ['has_permission', { _user_id: s.user.id, _permission: 'pos.access' }],
  ['merchant_subscription_active', { _merchant_id: '6245ba37-9e68-4e5e-9e68-46ffee192fb4' }],
  ['can_supply_wholesale', { _merchant_id: '6245ba37-9e68-4e5e-9e68-46ffee192fb4' }],
]) await show(`rpc ${fn}`, await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) }));
// the S22 listing's order and who placed it
await show('order 22573c7e', await fetch(`${SUPA}/rest/v1/wholesale_orders?id=eq.22573c7e-dbb3-402f-9a1c-3fe56bfc8151&select=*`, { headers: H }));
const o = await (await fetch(`${SUPA}/rest/v1/wholesale_orders?id=in.(22573c7e-dbb3-402f-9a1c-3fe56bfc8151,29267bd1-081e-477e-bbaa-06c592cc7b00)&select=*`, { headers: H })).json();
console.log(`EV orders ${JSON.stringify(o)}`);
