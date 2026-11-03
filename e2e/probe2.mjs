// One-off READ-ONLY probe: what the demo cashier's role says today. GET only.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo-cashier@wasil.demo', password: 'demo1234' }) });
const { access_token: t, user } = await r.json();
const get = async p => (await fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: ANON, Authorization: `Bearer ${t}` } })).json();
const me = await get(`merchant_users?select=id,merchant_id,role,is_active&user_id=eq.${user.id}`);
console.log('R|member|' + JSON.stringify(me));
const cfg = await get(`activity_logs?select=created_at,new_data&merchant_id=eq.${me[0].merchant_id}&entity_type=eq.custom_roles&order=created_at.desc&limit=1`);
const nd = cfg[0]?.new_data || {};
console.log('R|savedAt|' + cfg[0]?.created_at);
console.log('R|systemRoles.cashier|' + JSON.stringify(nd.systemRoles?.cashier ?? null));
console.log('R|assignment|' + JSON.stringify(nd.assignments?.[me[0].id] ?? null));
console.log('R|roles|' + JSON.stringify((nd.roles || []).map(x => ({ id: x.id, name: x.name, permissions: x.permissions }))));
