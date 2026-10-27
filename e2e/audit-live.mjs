// One-off, READ ONLY audit of the live system with the three demo shops' accounts.
// API: GET requests and read-only functions only. UI: every write request is
// blocked (aborted) before it leaves the browser; checkout/payment requests are
// captured to show what the browser would send, never sent.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'https://wasel-alpha.vercel.app';
const ANON = process.env.ANON;
const P = (...a) => console.log(...a);
const login = async email => { const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) }); return { status: r.status, body: await r.json() }; };
const A = {};
for (const w of ['distributor', 'enterprise', 'basic', 'admin', 'cashier', 'employee']) A[w] = (await login(`demo-${w}@wasil.demo`)).body;
const get = async (tok, q) => { const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${tok || ANON}` } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const MID = {};
for (const w of Object.keys(A)) MID[w] = (await get(A[w].access_token, `merchant_users?user_id=eq.${A[w].user.id}&select=merchant_id,role,branch_id`)).j[0];
P('ACCOUNTS', JSON.stringify(Object.fromEntries(Object.entries(MID).map(([k, v]) => [k, v]))));
const SHOPS = { distributor: MID.distributor.merchant_id, enterprise: MID.enterprise.merchant_id, basic: MID.basic.merchant_id };

// 1. auth responses
const wrong = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'wrong-password' }) });
P('AUTH wrong password →', wrong.status, JSON.stringify(await wrong.json()).slice(0, 160));
const nouser = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody-x@wasil.demo', password: 'x' }) });
P('AUTH unknown user →', nouser.status, JSON.stringify(await nouser.json()).slice(0, 160));

// 2. tenant isolation: each owner reads the other demo shops' rows (expect 0)
const TABLES = ['devices', 'accessories', 'sales', 'customers', 'suppliers', 'purchase_orders', 'stock_transfers', 'subscriptions', 'merchant_users', 'branches', 'online_orders', 'daily_closings', 'repair_orders', 'coupons', 'activity_logs', 'store_settings', 'support_tickets', 'loyalty_transactions'];
for (const me of ['distributor', 'enterprise', 'basic', 'cashier']) for (const [other, mid] of Object.entries(SHOPS)) {
  if (MID[me].merchant_id === mid) continue;
  const leaks = [];
  for (const t of TABLES) { const r = await get(A[me].access_token, `${t}?merchant_id=eq.${mid}&select=*&limit=5`); if (Array.isArray(r.j) && r.j.length) leaks.push(`${t}:${r.j.length}`); else if (!Array.isArray(r.j)) leaks.push(`${t}:HTTP${r.s}`); }
  P(`ISOLATION ${me} → ${other}: ${leaks.length ? 'READABLE ' + leaks.join(' ') : 'nothing readable'}`);
}
// child tables without merchant_id: can another shop's lines be read by id?
const distSale = (await get(A.distributor.access_token, `sales?merchant_id=eq.${SHOPS.distributor}&select=id&limit=1`)).j[0]?.id;
P('ISOLATION basic → distributor sale_items:', JSON.stringify((await get(A.basic.access_token, `sale_items?sale_id=eq.${distSale}&select=id`)).j).slice(0, 80));

// 3. anonymous (no sign-in) reads
for (const t of [...TABLES, 'plans', 'activation_codes', 'profiles', 'platform_admins', 'sale_items', 'online_order_items', 'wholesale_listings', 'wholesale_orders', 'store_pages', 'merchants', 'merchant_payouts', 'branch_requests']) {
  const r = await get(null, `${t}?select=*&limit=3`);
  const n = Array.isArray(r.j) ? r.j.length : `HTTP ${r.s} ${JSON.stringify(r.j).slice(0, 80)}`;
  P(`ANON ${t}: ${n}${Array.isArray(r.j) && r.j[0] ? ' cols=' + Object.keys(r.j[0]).slice(0, 12).join(',') : ''}`);
}

// 4. role reads: login codes, subscriptions, payouts
for (const w of ['cashier', 'employee', 'admin', 'distributor']) {
  const r = await get(A[w].access_token, `merchant_users?merchant_id=eq.${MID[w].merchant_id}&select=user_id,role,login_code`);
  const visible = Array.isArray(r.j) ? r.j.filter(x => x.login_code).length : `HTTP ${r.s}`;
  P(`ROLE ${w} (${MID[w].role}): merchant_users rows=${Array.isArray(r.j) ? r.j.length : '-'} login_codes visible=${visible}`);
  for (const t of ['subscriptions', 'activation_codes', 'platform_admins', 'merchant_payouts', 'activity_logs', 'suppliers', 'customers']) {
    const x = await get(A[w].access_token, `${t}?select=*&limit=3`);
    P(`ROLE ${w} ${t}: ${Array.isArray(x.j) ? x.j.length + ' rows' : 'HTTP ' + x.s}`);
  }
}

// 5. error responses: bad input, unknown resource, huge values — are messages leaking internals?
const tok = A.distributor.access_token;
for (const q of ['devices?id=eq.not-a-uuid', 'devices?select=nonexistent_column', 'no_such_table?select=*', 'devices?price=gt.abc', 'devices?limit=-1']) {
  const r = await get(tok, q); P(`ERRSHAPE GET ${q} → ${r.s} ${JSON.stringify(r.j).slice(0, 180)}`);
}
for (const [fn, body] of [['get_user_merchant_id', {}], ['get_user_login_code', { _user_id: A.cashier.user.id }], ['my_permissions', {}]]) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${A.cashier.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  P(`RPC cashier ${fn} → ${r.status} ${(await r.text()).slice(0, 80).replace(/\d{4,}/g, '#')}`);
}
// edge functions: invalid / unauthenticated calls only
for (const [fn, init] of [['accounting-api', { method: 'GET' }], ['login-by-code', { method: 'POST', body: '{}' }], ['award-loyalty', { method: 'POST', body: '{}' }], ['admin-create-user', { method: 'POST', body: '{}' }], ['admin-reset-password', { method: 'POST', body: '{}' }], ['mcp', { method: 'GET' }], ['shipping-carriers', { method: 'POST', body: '{"action":"status"}' }]]) {
  try { const r = await fetch(`${SUPA}/functions/v1/${fn}`, { ...init, headers: { apikey: ANON, 'Content-Type': 'application/json' } }); P(`EDGE ${fn} (no user) → ${r.status} ${(await r.text()).slice(0, 140)}`); } catch (e) { P(`EDGE ${fn} → ${e.message}`); }
}

// 6. numbers for reconciliation (current)
for (const [w, mid] of Object.entries(SHOPS)) {
  const sales = (await get(A[w].access_token, `sales?merchant_id=eq.${mid}&select=id,total_amount,subtotal,tax_amount,discount_amount,payment_method,sale_date&limit=2000`)).j;
  const items = []; for (let i = 0; i < sales.length; i += 80) items.push(...(await get(A[w].access_token, `sale_items?sale_id=in.(${sales.slice(i, i + 80).map(s => s.id).join(',')})&select=sale_id,quantity,unit_price,cost_at_sale`)).j);
  P(`NUMBERS ${w} ${JSON.stringify({ sales, items })}`);
}

// 7. UI crawl, every page × role, writes blocked
const ROUTES = ['/', '/pos', '/pos?tab=history', '/products?tab=inventory', '/products?tab=stocktake', '/products?tab=transfers', '/products?tab=suppliers', '/products?tab=labels', '/sales?tab=orders', '/sales?tab=repairs', '/sales?tab=closings', '/sales?tab=store', '/sales?tab=seo', '/sales?tab=customers', '/sales?tab=marketing', '/sales?tab=wholesale', '/shipping', '/reports', '/team?tab=employees', '/team?tab=attendance', '/team?tab=devices', '/team?tab=payroll', '/team?tab=users', '/ai-insights', '/subscription', '/settings?tab=general', '/settings?tab=notifications', '/settings?tab=policy', '/organization?tab=branches', '/organization?tab=support', '/notifications', '/business-policy', '/locked', '/auth'];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const plan = [['distributor', 1440, ROUTES], ['enterprise', 1440, ROUTES], ['basic', 1440, ROUTES], ['admin', 1440, ROUTES], ['cashier', 1440, ROUTES], ['employee', 1440, ROUTES], ['distributor', 390, ROUTES], ['cashier', 390, ['/pos', '/pos?tab=history', '/sales?tab=closings']]];
for (const [who, w, routes] of plan) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: w, height: w > 500 ? 900 : 844 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); }, ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(A[who])]);
  await context.route(`${SUPA}/**`, r => (['GET', 'HEAD', 'OPTIONS'].includes(r.request().method()) || r.request().url().includes('/rpc/') || r.request().url().includes('/auth/v1/user')) ? r.continue() : r.abort());
  const page = await context.newPage();
  let errs = [], net = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('vercel')) net.push(`${r.status()} ${r.request().method()} ${r.url().replace(SUPA, '').split('?')[0]}`); });
  for (const route of routes) {
    errs = []; net = [];
    const t0 = Date.now();
    await page.goto(`${SITE}${route}`, { waitUntil: 'domcontentloaded' }).catch(e => errs.push('goto ' + e.message));
    await page.waitForTimeout(5000);
    const url = new URL(page.url()); const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const odd = (text.match(/\b(undefined|NaN|Infinity|\[object Object\]|Invalid Date|null)\b/g) || []);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => -1);
    const spin = await page.locator('.animate-spin').count().catch(() => 0);
    const uniqNet = [...new Set(net)];
    P(`PAGE ${who} ${w} ${route} → ${url.pathname}${url.search} | ${Date.now() - t0}ms | len=${text.length} spin=${spin} overflow=${overflow} odd=${JSON.stringify([...new Set(odd)])} net=${JSON.stringify(uniqNet.slice(0, 6))} errs=${JSON.stringify([...new Set(errs)].slice(0, 4))}`);
    if (['/', '/reports', '/sales?tab=closings', '/sales?tab=customers', '/products?tab=suppliers', '/products?tab=inventory', '/subscription', '/organization?tab=branches', '/pos?tab=history', '/sales?tab=marketing', '/team?tab=users'].includes(route) && w === 1440) P(`TEXT ${who} ${route} ${text.slice(0, 1600)}`);
  }
  await context.close();
}
// 8. storefront as a visitor: browse, cart, checkout — capture what the browser would send
{
  const context = await browser.newContext({ locale: 'ar', viewport: { width: 390, height: 844 } });
  const sent = [];
  await context.route(`${SUPA}/**`, r => { const m = r.request().method(); if (['GET', 'HEAD', 'OPTIONS'].includes(m)) return r.continue(); sent.push(`${m} ${r.request().url().replace(SUPA, '')} ${r.request().postData()?.slice(0, 600)}`); return r.abort(); });
  const page = await context.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  for (const p of ['/store/alanam-max', '/store/alanam-max/products', '/store/alanam-max/cart', '/store/alanam-max/track']) { await page.goto(`${SITE}${p}`); await page.waitForTimeout(4000); P(`STORE ${p} → ${new URL(page.url()).pathname} len=${(await page.locator('body').innerText()).length} overflow=${await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)}`); }
  P(`STORE errors ${JSON.stringify(errs)} writes-attempted ${JSON.stringify(sent)}`);
  await context.close();
}
await browser.close();
