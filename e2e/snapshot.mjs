// One-off, READ ONLY (GET only): full snapshot of the demo shops' product and
// stock data and every record that refers to it — the backup and the input for
// the clean-up plan. Printed gzip+base64 between markers; nothing is written.
import { gzipSync } from 'zlib';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const login = async email => (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) })).json();
async function all(s, q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    const j = await r.json();
    if (!Array.isArray(j)) return { error: j, status: r.status };
    out.push(...j);
    if (j.length < 1000) return out;
  }
}
const SHOP_TABLES = ['branches', 'devices', 'accessories', 'repair_parts', 'merchant_categories', 'suppliers', 'customers', 'sales', 'purchase_orders', 'stock_transfers', 'stocktakes', 'wholesale_listings', 'online_orders', 'repair_orders', 'campaigns', 'coupons', 'daily_closings', 'loyalty_transactions', 'store_categories'];
const snap = { taken_at: new Date().toISOString(), shops: {} };
for (const who of ['demo-distributor', 'demo-enterprise', 'demo-basic']) {
  const s = await login(`${who}@wasil.demo`);
  const mu = await all(s, `merchant_users?select=merchant_id,role&user_id=eq.${s.user.id}`);
  const mid = mu[0].merchant_id;
  const shop = { account: who, merchant_id: mid, merchant: (await all(s, `merchants?id=eq.${mid}&select=id,name`))[0] };
  for (const t of SHOP_TABLES) shop[t] = await all(s, `${t}?merchant_id=eq.${mid}&select=*`);
  const ids = (t) => (Array.isArray(shop[t]) ? shop[t].map(r => r.id) : []);
  const child = async (t, col, parents) => {
    const rows = [];
    for (let i = 0; i < parents.length; i += 80) { const r = await all(s, `${t}?${col}=in.(${parents.slice(i, i + 80).join(',')})&select=*`); if (Array.isArray(r)) rows.push(...r); else return r; }
    return rows;
  };
  shop.sale_items = await child('sale_items', 'sale_id', ids('sales'));
  shop.purchase_order_items = await child('purchase_order_items', 'purchase_order_id', ids('purchase_orders'));
  shop.stock_transfer_items = await child('stock_transfer_items', 'transfer_id', ids('stock_transfers'));
  shop.stocktake_items = await child('stocktake_items', 'stocktake_id', ids('stocktakes'));
  shop.online_order_items = await child('online_order_items', 'order_id', ids('online_orders'));
  shop.repair_order_parts = await child('repair_order_parts', 'repair_order_id', ids('repair_orders'));
  shop.wholesale_orders = await all(s, `wholesale_orders?or=(supplier_merchant_id.eq.${mid},buyer_merchant_id.eq.${mid})&select=*`);
  shop.wholesale_order_items = await child('wholesale_order_items', 'order_id', Array.isArray(shop.wholesale_orders) ? shop.wholesale_orders.map(r => r.id) : []);
  snap.shops[who] = shop;
  console.log(`COUNT ${who} ${mid} ${Object.entries(shop).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}=${v.length}`).join(' ')} errors=${Object.entries(shop).filter(([, v]) => v && v.error).map(([k, v]) => `${k}:${JSON.stringify(v.error).slice(0, 80)}`).join(';')}`);
}
const b64 = gzipSync(Buffer.from(JSON.stringify(snap))).toString('base64');
console.log('SNAP-BEGIN');
for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
console.log('SNAP-END');
