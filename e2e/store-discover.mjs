// One-off: what the public store views return for each published store
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const anon = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const get = async (path, headers = anon) => {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { ...headers, Prefer: 'count=exact' } });
  const body = await r.text();
  return `${r.status} range=${r.headers.get('content-range')} ${body.slice(0, 300)}`;
};
const stores = JSON.parse((await (await fetch(`${SUPA}/rest/v1/store_settings?select=slug,merchant_id&is_published=eq.true`, { headers: anon })).text()));
for (const s of stores) {
  console.log(`== ${s.slug}`);
  console.log(' devices view    :', await get(`public_store_devices?select=id,model,status&merchant_id=eq.${s.merchant_id}&limit=2`));
  console.log(' accessories view:', await get(`public_store_accessories?select=id,name&merchant_id=eq.${s.merchant_id}&limit=2`));
}
// the Max shop's own stock, as its owner sees it
const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
});
const owner = await r.json();
const oh = { apikey: ANON, Authorization: `Bearer ${owner.access_token}` };
const M = '6245ba37-9e68-4e5e-9e68-46ffee192fb4';
console.log('MAX devices (owner) :', await get(`devices?select=id,model,status,show_in_store&merchant_id=eq.${M}&limit=3`, oh));
console.log('MAX devices available:', await get(`devices?select=id&merchant_id=eq.${M}&status=eq.available&limit=1`, oh));
console.log('MAX accessories      :', await get(`accessories?select=id,name,quantity&merchant_id=eq.${M}&limit=3`, oh));
