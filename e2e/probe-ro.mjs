// One-off READ-ONLY probe (GET requests only). Removed after the run.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const out = (k, v) => console.log(`T|${k}|${typeof v === 'string' ? v : JSON.stringify(v)}`);
async function signIn(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  const j = await r.json(); return { token: j.access_token, uid: j.user?.id };
}
async function get(token, path) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch { return { s: r.status, j: t.slice(0, 300) }; }
}
const accts = ['demo-employee', 'demo-cashier', 'demo-basic', 'demo-enterprise', 'demo-distributor', 'demo-admin'];
for (const a of accts) {
  const { token, uid } = await signIn(`${a}@wasil.demo`);
  if (!token) { out(`${a}.login`, 'FAILED'); continue; }
  const me = await get(token, `merchant_users?select=id,merchant_id,role,is_active,branch_id&user_id=eq.${uid}`);
  out(`${a}.member`, me.j);
  const mid = me.j?.[0]?.merchant_id;
  const merch = await get(token, `merchants?select=id,name&id=eq.${mid}`); out(`${a}.merchant`, merch.j);
  if (a === 'demo-employee' || a === 'demo-cashier') {
    const cfg = await get(token, `activity_logs?select=created_at,new_data&merchant_id=eq.${mid}&entity_type=eq.custom_roles&order=created_at.desc&limit=1`);
    const nd = cfg.j?.[0]?.new_data;
    out(`${a}.customRolesConfig.status`, cfg.s);
    if (nd) {
      const myRoleId = nd.assignments?.[me.j[0].id];
      out(`${a}.assignedRole`, (nd.roles || []).find(r => r.id === myRoleId) || 'none');
      out(`${a}.systemRolesChanged`, nd.systemRoles || {});
    } else out(`${a}.customRolesConfig`, cfg.j);
  }
  if (a === 'demo-basic') {
    out('lite.branches', (await get(token, `branches?select=id,name,is_active,is_main,created_at&merchant_id=eq.${mid}&order=created_at`)).j);
    out('lite.subscription', (await get(token, `subscriptions?select=status,plan,plan_id,created_at,updated_at&merchant_id=eq.${mid}`)).j);
    out('lite.wholesale_listings_own', (await get(token, `wholesale_listings?select=id&merchant_id=eq.${mid}`)).j);
  }
  if (a === 'demo-basic' || a === 'demo-enterprise' || a === 'demo-distributor') {
    out(`${a}.plans`, (await get(token, `plans?select=id,name,name_ar,max_branches,has_wholesale&order=name`)).j);
  }
  if (a === 'demo-distributor' || a === 'demo-admin' || a === 'demo-enterprise') {
    out(`${a}.ipo_devices`, (await get(token, `devices?select=id,merchant_id,brand,model,price,cost,status,created_at&or=(model.ilike.*ipo*,brand.ilike.*ipo*)`)).j);
    out(`${a}.ipo_accessories`, (await get(token, `accessories?select=id,merchant_id,name,sku,price,cost,quantity,created_at&name.ilike.*ipo*`)).j);
    out(`${a}.ipo_accessories2`, (await get(token, `accessories?select=id,merchant_id,name,sku,price,cost,quantity,created_at&name=ilike.*ipo*`)).j);
    out(`${a}.big_accessories`, (await get(token, `accessories?select=id,merchant_id,name,price,cost,quantity&order=quantity.desc&limit=5`)).j);
    out(`${a}.cheap_listings`, (await get(token, `wholesale_listings?select=id,merchant_id,item_type,device_id,accessory_id,wholesale_price,min_quantity,is_active,created_at,notes&wholesale_price=lte.10`)).j);
    out(`${a}.negative`, {
      acc: (await get(token, `accessories?select=id,name,price,cost,quantity&or=(price.lt.0,cost.lt.0,quantity.lt.0)`)).j,
      dev: (await get(token, `devices?select=id,model,price,cost&or=(price.lt.0,cost.lt.0)`)).j,
    });
  }
}
