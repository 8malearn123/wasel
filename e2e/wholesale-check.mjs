// One-off, read only: what a wholesale buyer (the Pro demo) can read about the
// listings it sees — the joins, the new functions, and public store data.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const signIn = async (email) => (await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234' }),
})).json());
const s = await signIn('demo-enterprise@wasil.demo');
const H = { apikey: ANON, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
const get = async (p) => { const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: H }); return { status: r.status, body: (await r.text()).slice(0, 700) }; };
const rpc = async (fn) => { const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: '{}' }); return { status: r.status, body: (await r.text()).slice(0, 400) }; };
const [mu] = JSON.parse((await get(`merchant_users?select=merchant_id&user_id=eq.${s.user.id}`)).body);
const listings = JSON.parse((await get(`wholesale_listings?select=*,device:devices(id,model,brand),accessory:accessories(id,name),merchant:merchants(id,name)&is_active=eq.true&merchant_id=neq.${mu.merchant_id}`)).body);
console.log(`LISTINGS seen by the buyer: ${listings.length}`);
for (const l of listings) console.log(`LISTING ${JSON.stringify(l)}`);
const sup = listings[0]?.merchant_id;
console.log('RPC wholesale_parties', JSON.stringify(await rpc('wholesale_parties')));
console.log('RPC wholesale_listing_items', JSON.stringify(await rpc('wholesale_listing_items')));
if (sup) {
  console.log('merchants row', JSON.stringify(await get(`merchants?select=id,name&id=eq.${sup}`)));
  console.log('store_settings row', JSON.stringify(await get(`store_settings?select=store_name,slug,is_published&merchant_id=eq.${sup}`)));
  const l = listings[0];
  if (l.accessory_id) console.log('public_store_accessories', JSON.stringify(await get(`public_store_accessories?select=id,name&id=eq.${l.accessory_id}`)));
  if (l.device_id) console.log('public_store_devices', JSON.stringify(await get(`public_store_devices?select=id,model&id=eq.${l.device_id}`)));
}
// the supplier's own view of the same listings
const sp = await signIn('demo-distributor@wasil.demo');
const r = await fetch(`${SUPA}/rest/v1/wholesale_listings?select=id,item_type,wholesale_price,min_quantity,is_active,notes,device:devices(model,brand),accessory:accessories(name,sku,price)`, { headers: { apikey: ANON, Authorization: `Bearer ${sp.access_token}` } });
console.log(`SUPPLIER own listings ${(await r.text()).slice(0, 1200)}`);
