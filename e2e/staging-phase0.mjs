// Phase-0 scenarios against wasel-staging ONLY (never production): run after
// staging is built and again after each rehearsal step, and compare.
//
//   STAGING_API_URL, STAGING_ANON_KEY, STAGING_SERVICE_ROLE_KEY, STAGING_TEST_PASSWORD
//   node e2e/staging-phase0.mjs
//
// Each scenario prints RESULT <id> <PASS|FAIL|INFO> <what> — <observed>.
// PASS/FAIL compare with what the system SHOULD do; INFO records behaviour that
// a later phase changes. Rows it makes carry «STAGING-TEST» and live in staging.
const API = process.env.STAGING_API_URL?.replace(/\/$/, '');
const ANON = process.env.STAGING_ANON_KEY;
const SERVICE = process.env.STAGING_SERVICE_ROLE_KEY;
const PW = process.env.STAGING_TEST_PASSWORD;
if (!API || !ANON || !SERVICE || !PW) throw new Error('staging settings missing');
if (API.includes('ynwddyxzypbcftlevuam')) throw new Error('refusing: this is production');

const DIST = '6245ba37-9e68-4e5e-9e68-46ffee192fb4';
const BASIC = '25d29b66-3383-4af5-9cd7-dfa1608419e1';
const results = [];
const R = (id, ok, what, seen) => {
  const v = ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL';
  results.push({ id, v });
  console.log(`RESULT ${id} ${v} ${what} — ${typeof seen === 'string' ? seen : JSON.stringify(seen)}`.slice(0, 900));
};

async function call(method, path, { token, body, prefer, key = ANON } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = text; try { data = text ? JSON.parse(text) : null; } catch { /* text */ }
  return { status: r.status, data };
}
const rest = (m, p, o) => call(m, `/rest/v1/${p}`, o);
const rpc = (fn, body, o = {}) => call('POST', `/rest/v1/rpc/${fn}`, { ...o, body });
const short = r => `HTTP ${r.status} ${typeof r.data === 'string' ? r.data.slice(0, 160) : JSON.stringify(r.data)?.slice(0, 200)}`;

async function login(email) {
  const r = await call('POST', '/auth/v1/token?grant_type=password', { body: { email, password: PW } });
  if (!r.data?.access_token) throw new Error(`login failed for ${email}: ${short(r)}`);
  return { token: r.data.access_token, id: r.data.user.id };
}
// staging accounts by shop and role, from staging's own Auth (service key: staging only)
const users = (await call('GET', '/auth/v1/admin/users?per_page=1000', { key: SERVICE })).data.users;
const svc = { key: SERVICE };
const members = (await rest('GET', 'merchant_users?select=user_id,merchant_id,role', svc)).data;
const pick = (shop, role) => {
  const m = members.find(x => x.merchant_id === shop && x.role === role);
  return m && users.find(u => u.id === m.user_id)?.email;
};
const owner = await login(pick(DIST, 'owner'));
const cashierEmail = pick(DIST, 'cashier');
const cashier = cashierEmail ? await login(cashierEmail) : null;
const basicOwner = await login(pick(BASIC, 'owner'));

// ---- storefront as a visitor ------------------------------------------------------
{
  const d = await rest('GET', `public_store_devices?merchant_id=eq.${DIST}&select=id,model,price&limit=5`);
  R('S1a', d.status === 200 && Array.isArray(d.data) && d.data.length > 0, 'visitor sees the store devices', short(d));
  const a = await rest('GET', `public_store_accessories?merchant_id=eq.${DIST}&select=id,name,price,quantity&limit=5`);
  R('S1b', a.status === 200 && Array.isArray(a.data) && a.data.length > 0, 'visitor sees the store accessories', short(a));
  const s = await rest('GET', 'store_settings?slug=eq.alanam-max&select=merchant_id,is_published');
  R('S1c', s.status === 200 && s.data?.length === 1, 'visitor reads the published store settings', short(s));
  for (const t of ['online_orders', 'merchant_users', 'sales', 'customers']) {
    const r = await rest('GET', `${t}?select=id&limit=1`);
    R(`S1-${t}`, r.status !== 200 || r.data.length === 0, `visitor reads no ${t}`, short(r));
  }
}

const accessory = (await rest('GET', `accessories?merchant_id=eq.${DIST}&quantity=gt.2&select=id,name,price,quantity&limit=1`, svc)).data?.[0];

// ---- an order as the storefront on main places it (direct inserts) ----------------
async function directOrder(as, label) {
  const unit = Number(accessory.price);
  const order = await rest('POST', 'online_orders', {
    token: as?.token, prefer: 'return=representation',
    body: {
      merchant_id: DIST, order_number: `STAGING-TEST-${Date.now()}`, customer_name: 'STAGING-TEST', customer_phone: '0500000000',
      shipping_address: 'STAGING-TEST', shipping_city: 'Riyadh', shipping_cost: 0, payment_method: 'cod',
      subtotal: unit, tax_amount: 0, total_amount: unit, notes: 'STAGING-TEST',
    },
  });
  if (order.status >= 300) return R(`${label}`, null, 'order header (main flow)', short(order));
  const id = order.data?.[0]?.id;
  const items = await rest('POST', 'online_order_items', {
    token: as?.token, body: [{ order_id: id, accessory_id: accessory.id, item_name: accessory.name, quantity: 1, unit_price: unit }],
  });
  R(`${label}`, null, 'order header + lines (main flow)', `header ${order.status}, lines ${short(items)}`);
}
// ---- the same order through place_online_order (PR #119) -------------------------
async function rpcOrder(as, label) {
  const r = await rpc('place_online_order', {
    _merchant_id: DIST,
    _customer: { customer_name: 'STAGING-TEST', customer_phone: '0500000000', shipping_address: 'STAGING-TEST', shipping_city: 'Riyadh', payment_method: 'cod' },
    _items: [{ accessory_id: accessory.id, quantity: 1, unit_price: 1 }],
  }, { token: as?.token });
  if (r.status === 404) return R(label, null, 'place_online_order', 'not installed (PR #119 migration not applied)');
  const price = Number(accessory.price);
  const total = Number(r.data?.total_amount);
  const shipping = Number(r.data?.shipping_cost ?? 0);
  // VAT is inside the shelf price: the total is price + delivery, never price × 1.15
  R(label, r.status < 300 && Math.abs(total - (price + shipping)) < 0.01,
    `place_online_order total = shelf price ${price} + delivery (VAT included)`, short(r));
}
if (accessory) {
  await directOrder(null, 'S2a-visitor');
  await rpcOrder(null, 'S2b-visitor');
  if (cashier) { await directOrder(cashier, 'S2c-cashier'); await rpcOrder(cashier, 'S2d-cashier'); }
} else R('S2', false, 'an accessory with stock in the demo shop', 'none found');

// ---- a device sold twice -------------------------------------------------------------
if (cashier) {
  const branch = (await rest('GET', `branches?merchant_id=eq.${DIST}&is_active=eq.true&select=id&limit=1`, svc)).data?.[0]?.id;
  const device = (await rest('GET', `devices?merchant_id=eq.${DIST}&status=eq.available&select=id,price,cost&limit=1`, svc)).data?.[0];
  if (device) {
    const sell = async n => {
      const sale = await rest('POST', 'sales', {
        token: cashier.token, prefer: 'return=representation',
        body: { merchant_id: DIST, branch_id: branch, invoice_number: `STAGING-TEST-${Date.now()}-${n}`, subtotal: device.price, tax_amount: 0,
                discount_amount: 0, total_amount: device.price, payment_method: 'cash', payment_status: 'paid', sold_by: cashier.id, notes: 'STAGING-TEST' },
      });
      if (sale.status >= 300) return { sale };
      const line = await rest('POST', 'sale_items', { token: cashier.token, body: [{ sale_id: sale.data[0].id, device_id: device.id, quantity: 1, unit_price: device.price, cost_at_sale: device.cost }] });
      return { sale, line };
    };
    const first = await sell(1);
    R('S3a', first.line?.status < 300, 'cashier sells an available device', `sale ${first.sale.status}, line ${first.line ? short(first.line) : '-'}`);
    await rest('PATCH', `devices?id=eq.${device.id}`, { token: cashier.token, body: { status: 'sold' } });
    const second = await sell(2);
    R('S3b', !(second.line?.status < 300), 'the same device cannot be sold again', `sale ${second.sale.status}, line ${second.line ? short(second.line) : '-'}`);
    const edit = await rest('PATCH', `sales?id=eq.${first.sale.data[0].id}`, { token: cashier.token, prefer: 'return=representation', body: { discount_amount: device.price } });
    R('S3c', null, 'cashier sets a 100% discount on an invoice (issue 7, phase 1)', short(edit));
  } else R('S3', false, 'an available device in the demo shop', 'none found');
}

// ---- subscriptions, plans, permissions ----------------------------------------------
{
  const sub = (await rest('GET', `subscriptions?merchant_id=eq.${DIST}&select=id,max_branches,plan`, { token: owner.token })).data?.[0];
  const p = await rest('PATCH', `subscriptions?merchant_id=eq.${DIST}`, { token: owner.token, prefer: 'return=representation', body: { max_branches: (sub?.max_branches ?? 0) + 7 } });
  R('S4a', p.status >= 300 || (Array.isArray(p.data) && p.data.length === 0), 'owner cannot raise their own limits', short(p));
  if (p.status < 300 && p.data?.length) await rest('PATCH', `subscriptions?merchant_id=eq.${DIST}`, { ...svc, body: { max_branches: sub.max_branches } });

  const stranger = users.find(u => !u.email.endsWith('@wasil.demo'));
  let strangerLogin = stranger && await login(stranger.email).catch(() => null);
  if (!strangerLogin) {
    await call('POST', '/auth/v1/admin/users', { key: SERVICE, body: { email: 'not-demo@wasel-staging.test', password: PW, email_confirm: true } });
    strangerLogin = await login('not-demo@wasel-staging.test');
  }
  const d = await rpc('demo_switch_plan', { _plan_name: sub?.plan || 'Distributor' }, { token: strangerLogin.token });
  R('S4b', d.status >= 400 && /demo/i.test(JSON.stringify(d.data)), 'a non-demo account cannot call demo_switch_plan', short(d));

  for (const [who, t] of [['owner', owner], ['cashier', cashier]]) {
    if (!t) continue;
    const m = await rpc('my_permissions', {}, { token: t.token });
    R(`S5-${who}`, m.status === 200, `my_permissions answers for the ${who}`, short(m));
  }
  const g = await rpc('get_subscription_state', {}, { token: owner.token });
  R('S5-subscription', g.status === 200, 'get_subscription_state answers', short(g));
  const w = await rpc('wholesale_parties', {}, { token: owner.token });
  R('S5-wholesale', w.status !== 404, 'wholesale_parties is installed', short(w));

  const branches = (await rest('GET', `branches?merchant_id=eq.${BASIC}&is_active=eq.true&select=id`, svc)).data?.length;
  const b = await rest('POST', 'branches', { token: basicOwner.token, prefer: 'return=representation', body: { merchant_id: BASIC, name: 'STAGING-TEST فرع زائد' } });
  R('S6', b.status >= 300, `Lite shop (${branches} active branches) cannot add a branch over its limit`, short(b));
  if (b.status < 300) await rest('DELETE', `branches?id=eq.${b.data[0].id}`, svc);
}

// ---- login codes ---------------------------------------------------------------------------
if (cashier) {
  const r = await rest('GET', `merchant_users?merchant_id=eq.${DIST}&select=user_id,login_code`, { token: cashier.token });
  const visible = Array.isArray(r.data) ? r.data.filter(x => x.user_id !== cashier.id && x.login_code).length : 0;
  R('S7', null, 'cashier sees colleagues\' login codes (issue 1, phase 1)', `${visible} visible — ${short(r).slice(0, 60)}`);
}

const fails = results.filter(r => r.v === 'FAIL').length;
console.log(`SUMMARY pass=${results.filter(r => r.v === 'PASS').length} fail=${fails} info=${results.filter(r => r.v === 'INFO').length}`);
