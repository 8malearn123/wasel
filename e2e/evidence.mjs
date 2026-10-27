// One-off, READ ONLY: every place that could refer to the two records proposed
// for deletion, including ones outside the product tables. GET only.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const login = async email => (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) })).json();
const T = [
  ['demo-distributor', 'accessories', 'dd8cb3ae-c51f-4196-a4de-b1d3b0aa03d6', 'accessory_id', 'ارلغبغ'],
  ['demo-basic', 'devices', null, 'device_id', '1111'],
];
for (const [who, table, knownId, col, code] of T) {
  const s = await login(`${who}@wasil.demo`);
  const get = async q => { const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}` } }); return [r.status, await r.json()]; };
  const mid = (await get(`merchant_users?select=merchant_id&user_id=eq.${s.user.id}`))[1][0].merchant_id;
  const id = knownId || (await get(`devices?merchant_id=eq.${mid}&imei=eq.1111&select=id`))[1][0]?.id;
  const [, row] = await get(`${table}?id=eq.${id}&select=*`);
  console.log(`EV ${who} ${table} ${id} row=${JSON.stringify(row)}`);
  const checks = [
    ['sale_items', `${col}=eq.${id}`], ['online_order_items', `${col}=eq.${id}`], ['purchase_order_items', `${col}=eq.${id}`],
    ['stock_transfer_items', `${col}=eq.${id}`], ['wholesale_listings', `${col}=eq.${id}`], ['stocktake_items', `item_id=eq.${id}`],
    ['activity_logs', `entity_id=eq.${id}`], ['activity_logs', `merchant_id=eq.${mid}&new_data::text=ilike.*${id}*`],
    ['store_settings', `merchant_id=eq.${mid}&featured_product_ids::text=ilike.*${id}*`],
    ['coupons', `merchant_id=eq.${mid}&applies_to=ilike.*${id}*`],
    ['store_pages', `merchant_id=eq.${mid}&content=ilike.*${id}*`],
    ['repair_orders', `merchant_id=eq.${mid}&device_imei=eq.${code}`],
    ['stocktake_items', `item_sku=eq.${encodeURIComponent(code)}`],
  ];
  for (const [t, q] of checks) { const [st, j] = await get(`${t}?${q}&select=id`); console.log(`EV ${who}   ${t} ?${q.slice(0, 60)} → HTTP ${st} ${Array.isArray(j) ? j.length + ' rows' : JSON.stringify(j).slice(0, 120)}`); }
}
