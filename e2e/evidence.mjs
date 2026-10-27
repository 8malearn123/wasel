// One-off, READ ONLY (GET requests only): evidence for the eight remaining
// issues. Prints JSON lines; nothing is written anywhere.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const login = async email => (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) })).json();
const S = { dist: await login('demo-distributor@wasil.demo'), pro: await login('demo-enterprise@wasil.demo'), lite: await login('demo-basic@wasil.demo') };
const get = async (s, q) => { const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}` } }); const t = await r.text(); try { return JSON.parse(t); } catch { return { status: r.status, text: t.slice(0, 200) }; } };
const P = (tag, v) => console.log(`EV ${tag} ${JSON.stringify(v)}`);

// 1. which functions PostgREST exposes (its OpenAPI document lists every callable function)
const spec = await (await fetch(`${SUPA}/rest/v1/`, { headers: { apikey: ANON, Authorization: `Bearer ${S.dist.access_token}` } })).json();
const rpcs = Object.keys(spec.paths || {}).filter(p => p.startsWith('/rpc/')).map(p => p.slice(5)).sort();
P('rpc.count', rpcs.length);
P('rpc.wanted', Object.fromEntries(['my_permissions', 'get_subscription_state', 'wholesale_parties', 'wholesale_listing_items', 'has_permission', 'demo_switch_plan', 'generate_invoice_number', 'get_user_merchant_id', 'activate_subscription_code', 'redeem_activation_code'].map(f => [f, rpcs.includes(f)])));
P('rpc.all', rpcs);
P('tables', Object.keys(spec.definitions || {}).sort());

// 2. flagged rows and everything that refers to them (distributor shop)
const MID = '6245ba37-9e68-4e5e-9e68-46ffee192fb4';
const IPO = '3611ca02-30a9-43de-baa5-580bad6a735e', ACC = 'dd8cb3ae-c51f-4196-a4de-b1d3b0aa03d6';
P('ipo', await get(S.dist, `devices?id=eq.${IPO}&select=*`));
P('acc', await get(S.dist, `accessories?id=eq.${ACC}&select=*`));
for (const [k, col, id] of [['ipo', 'device_id', IPO], ['acc', 'accessory_id', ACC]]) {
  for (const t of ['sale_items', 'online_order_items', 'purchase_order_items', 'stock_transfer_items', 'wholesale_listings']) P(`${k}.ref.${t}`, await get(S.dist, `${t}?${col}=eq.${id}&select=*`));
  P(`${k}.ref.stocktake_items`, await get(S.dist, `stocktake_items?item_id=eq.${id}&select=*`));
  P(`${k}.ref.activity_logs`, await get(S.dist, `activity_logs?entity_id=eq.${id}&select=*`));
}
const tr = await get(S.dist, `stock_transfer_items?device_id=eq.${IPO}&select=transfer_id`);
for (const x of Array.isArray(tr) ? tr : []) { P('ipo.transfer', await get(S.dist, `stock_transfers?id=eq.${x.transfer_id}&select=*`)); P('ipo.transfer.items', await get(S.dist, `stock_transfer_items?transfer_id=eq.${x.transfer_id}&select=*`)); }
const listings = await get(S.dist, `wholesale_listings?merchant_id=eq.${MID}&select=*&order=created_at`);
P('listings', listings);
for (const l of Array.isArray(listings) ? listings : []) {
  P(`listing.${l.id}.orders`, await get(S.dist, `wholesale_order_items?listing_id=eq.${l.id}&select=*`));
  P(`listing.${l.id}.logs`, await get(S.dist, `activity_logs?entity_id=eq.${l.id}&select=*`));
}
P('logs.wholesale', await get(S.dist, `activity_logs?merchant_id=eq.${MID}&or=(entity_type.ilike.*wholesale*,action.ilike.*wholesale*,action.ilike.*listing*)&select=*&order=created_at.desc&limit=20`));
P('logs.oct26-27', await get(S.dist, `activity_logs?merchant_id=eq.${MID}&created_at=gte.2026-10-25&select=action,entity_type,entity_id,user_id,created_at&order=created_at.desc&limit=40`));
P('members.dist', await get(S.dist, `merchant_users?merchant_id=eq.${MID}&select=user_id,role,is_active`));

// 3. stock value inputs
const devs = await get(S.dist, `devices?merchant_id=eq.${MID}&select=id,model,status,price,cost`);
const accs = await get(S.dist, `accessories?merchant_id=eq.${MID}&select=id,name,price,cost,quantity`);
P('stock.devices', devs); P('stock.accessories', accs);

// 4. Lite branches and subscription
for (const [k, s] of [['lite', S.lite], ['pro', S.pro]]) {
  const mu = await get(s, `merchant_users?user_id=eq.${s.user.id}&select=merchant_id,role`);
  const mid = mu?.[0]?.merchant_id;
  P(`${k}.subscription`, await get(s, `subscriptions?merchant_id=eq.${mid}&select=*`));
  P(`${k}.branches`, await get(s, `branches?merchant_id=eq.${mid}&select=*&order=created_at`));
  P(`${k}.branch_requests`, await get(s, `branch_requests?merchant_id=eq.${mid}&select=*`));
  const br = await get(s, `branches?merchant_id=eq.${mid}&select=id`);
  for (const b of Array.isArray(br) ? br : []) {
    P(`${k}.branch.${b.id}.use`, { devices: (await get(s, `devices?branch_id=eq.${b.id}&select=id`)).length, accessories: (await get(s, `accessories?branch_id=eq.${b.id}&select=id`)).length, sales: (await get(s, `sales?branch_id=eq.${b.id}&select=id`)).length });
  }
}
P('plans', await get(S.dist, `plans?select=*`));

// 5. the iPhone 15 Pro Max on two invoices
const dup = await get(S.dist, `devices?merchant_id=eq.${MID}&model=ilike.*15 Pro Max*&select=*`);
P('dup.devices', dup);
for (const d of Array.isArray(dup) ? dup : []) {
  const items = await get(S.dist, `sale_items?device_id=eq.${d.id}&select=*`);
  P(`dup.${d.id}.items`, items);
  for (const it of Array.isArray(items) ? items : []) {
    P(`dup.sale.${it.sale_id}`, await get(S.dist, `sales?id=eq.${it.sale_id}&select=*`));
    P(`dup.sale.${it.sale_id}.lines`, await get(S.dist, `sale_items?sale_id=eq.${it.sale_id}&select=*`));
    P(`dup.sale.${it.sale_id}.logs`, await get(S.dist, `activity_logs?entity_id=eq.${it.sale_id}&select=*`));
  }
  P(`dup.${d.id}.logs`, await get(S.dist, `activity_logs?entity_id=eq.${d.id}&select=*`));
}
P('returns.tables', Object.keys(spec.definitions || {}).filter(t => /return|refund/i.test(t)));
