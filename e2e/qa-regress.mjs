// One-off regression check of 16 reported issues on the LIVE site (main),
// demo accounts only. Read-only except one tagged test sale on the Max demo
// shop (its own test accessory), deleted at the end. Prints R| lines and
// T| text excerpts for the report.
import { SITE, SUPA, ANON, TAG, PW, launch, newSession, step, rec, finish, bodyText, created, track } from './qa-core.mjs';

const ACC = { owner: 'demo-distributor@wasil.demo', admin: 'demo-admin@wasil.demo', cashier: 'demo-cashier@wasil.demo',
  employee: 'demo-employee@wasil.demo', pro: 'demo-enterprise@wasil.demo', lite: 'demo-basic@wasil.demo' };
const RUN = String(Date.now()).slice(-5);
const SKU = `QA1028-${RUN}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = (k, s) => console.log(`T|${k}|${String(s).replace(/\s+/g, ' ').slice(0, 900)}`);
const tokens = {};
async function token(email) {
  if (tokens[email]) return tokens[email];
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  return (tokens[email] = await r.json());
}
async function api(email, q, init = {}) {
  const t = email ? (await token(email)).access_token : ANON;
  const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { apikey: ANON, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=representation,count=exact', ...(init.headers || {}) } });
  const x = await r.text(); let j; try { j = JSON.parse(x); } catch { j = x; }
  return { status: r.status, body: j, count: r.headers.get('content-range')?.split('/')[1] };
}
async function settle(page, max = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    if (!(await page.locator('text=/جارٍ التحميل|جاري التحميل/').count()) && !(await page.locator('.animate-spin').count())) break;
    await sleep(300);
  }
  await sleep(800);
}
const dialog = page => page.locator('[role="dialog"]').last();
const fill = async (loc, v) => { await loc.click({ timeout: 8000 }); await loc.fill(String(v)); };
async function toasts(page, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const got = await page.evaluate(() => (window.__qaToasts || []).filter(x => x.at >= (window.__qaMark || 0)).map(x => x.text)).catch(() => []);
    if (got.length) { await sleep(300); return (await page.evaluate(() => (window.__qaToasts || []).filter(x => x.at >= (window.__qaMark || 0)).map(x => x.text))).join(' | '); }
    await sleep(200);
  }
  return '';
}
const mark = page => page.evaluate(() => { window.__qaMark = Date.now(); }).catch(() => {});
async function login(s, email, lang = 'ar') {
  await s.page.addInitScript(l => { try { localStorage.setItem('language', l); } catch {} }, lang);
  await s.page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await settle(s.page);
  await s.page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await fill(s.page.locator('#email'), email); await fill(s.page.locator('#password'), PW);
  await s.page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await s.page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }); await settle(s.page);
}
async function open(s, p) { await mark(s.page); await s.page.goto(`${SITE}${p}`, { waitUntil: 'domcontentloaded' }); await settle(s.page); return { url: new URL(s.page.url()).pathname + new URL(s.page.url()).search, text: await bodyText(s.page) }; }
async function rpc(email, fn) {
  const t = (await token(email)).access_token;
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: '{}' });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}

const browser = await launch();
const midOf = async e => (await api(e, `merchant_users?user_id=eq.${(await token(e)).user.id}&select=merchant_id,role`)).body[0];
const M = {}; for (const k of Object.keys(ACC)) M[k] = await midOf(ACC[k]);
T('accounts', JSON.stringify(M));
try {
  // ---------- 1. cashier and reports ----------
  const c = await newSession(browser, 'cashier');
  await step(c, 'I1', 'cashier signs in', async () => { await login(c, ACC.cashier); return new URL(c.page.url()).pathname; });
  await step(c, 'I1', 'cashier opens /reports by URL', async () => {
    const r = await open(c, '/reports');
    const t = await toasts(c.page, 2500);
    const shown = !r.url.startsWith('/pos') && /التقارير والتحليلات/.test(r.text);
    T('I1-cashier-reports', `${r.url} toast:${t} ${r.text.slice(0, 400)}`);
    return { status: shown ? 'FAIL' : 'PASS', detail: `→ ${r.url}; ${shown ? 'reports page shown' : 'not shown'}; toast «${t}»` };
  });
  await step(c, 'I1', 'cashier reads all invoices and totals through the API', async () => {
    const me = (await token(ACC.cashier)).user.id;
    const all = await api(ACC.cashier, `sales?merchant_id=eq.${M.cashier.merchant_id}&select=id,total_amount,sold_by`);
    const rows = Array.isArray(all.body) ? all.body : [];
    const others = rows.filter(r => r.sold_by !== me).length;
    const sum = rows.reduce((a, r) => a + Number(r.total_amount), 0);
    const items = await api(ACC.cashier, `sale_items?select=id,cost_at_sale&limit=5`);
    const sup = await api(ACC.cashier, `suppliers?select=id,balance&limit=3`);
    return { status: others ? 'FAIL' : 'PASS', detail: `HTTP ${all.status}: ${rows.length} invoices readable, ${others} by other users, total ${sum.toFixed(2)}; sale_items with cost readable: ${Array.isArray(items.body) ? items.body.length : items.status}; suppliers: ${Array.isArray(sup.body) ? sup.body.length : sup.status}` };
  });
  await step(c, 'I1', 'cashier sales history shows only own invoices', async () => {
    const r = await open(c, '/pos?tab=history');
    const me = (await token(ACC.cashier)).user.id;
    const own = new Set(((await api(ACC.cashier, `sales?sold_by=eq.${me}&select=invoice_number`)).body || []).map(x => x.invoice_number));
    // only the invoice cards (the «الفواتير فقط» view), not activity lines
    await c.page.getByRole('combobox').nth(2).click().catch(() => {}); await c.page.getByRole('option', { name: 'الفواتير فقط' }).click().catch(() => {}); await sleep(800);
    const shown = [...new Set((await bodyText(c.page)).match(/INV-[\d-]+/g) || [])];
    const others = shown.filter(x => !own.has(x));
    const del = await c.page.getByRole('button', { name: 'حذف', exact: true }).count();
    return { status: others.length || del ? 'FAIL' : 'PASS', detail: `${shown.length} invoices shown, ${others.length} not the cashier's; delete buttons ${del}` };
  });
  const ownerTok = await token(ACC.owner);
  T('I1-roles', `cashier role in DB: ${M.cashier.role}; employee role in DB: ${M.employee.role}`);
  await c.ctx.close();

  // ---------- 7. RPCs ----------
  const s0 = await newSession(browser, 'api');
  for (const k of ['owner', 'admin', 'cashier', 'pro', 'lite']) {
    await step(s0, 'I7', `RPCs for ${k}`, async () => {
      const a = await rpc(ACC[k], 'my_permissions'); const b = await rpc(ACC[k], 'get_subscription_state');
      return { status: a.status === 200 && b.status === 200 ? 'PASS' : 'FAIL', detail: `my_permissions ${a.status} ${a.status !== 200 ? a.body.slice(0, 60) : ''}; get_subscription_state ${b.status}` };
    });
  }

  // ---------- 5. the old code 70035 (one request; the token is not used) ----------
  await step(s0, 'I5', 'login code 70035', async () => {
    const r = await fetch(`${SUPA}/functions/v1/login-by-code`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '70035' }) });
    const b = await r.text();
    return { status: /access_token/.test(b) ? 'FAIL' : 'PASS', detail: `HTTP ${r.status} ${/access_token/.test(b) ? 'session issued (token not used)' : b.slice(0, 100)}` };
  });

  // ---------- 4. plans ----------
  for (const k of ['lite', 'pro', 'owner']) {
    await step(s0, 'I4', `plan data for ${k}`, async () => {
      const sub = (await api(ACC[k], `subscriptions?select=plan,plan_id,status,max_branches,max_users,subscription_ends_at`)).body[0];
      const plan = sub?.plan_id ? (await api(ACC[k], `plans?id=eq.${sub.plan_id}&select=name,name_ar,branch_limit,advanced_reports,has_wholesale`)).body[0] : null;
      const br = (await api(ACC[k], `branches?is_active=eq.true&select=id`)).body;
      T(`I4-${k}`, JSON.stringify({ sub, plan, activeBranches: br?.length }));
      return { status: 'NOTE', detail: `text plan «${sub?.plan}», plan_id → «${plan?.name}»; branches ${br?.length}/${Math.max(sub?.max_branches || 0, plan?.branch_limit || 0)}; reports ${plan?.advanced_reports}; wholesale ${plan?.has_wholesale}` };
    });
  }
  await s0.ctx.close();

  // ---------- owner (Max): counts, values, POS, invoice, KPI ----------
  const o = await newSession(browser, 'owner', { allow: {} });
  const mid = M.owner.merchant_id;
  await step(o, 'login', 'owner signs in', async () => { await login(o, ACC.owner); return 'ok'; });
  // 14 KPI while loading, then loaded
  await step(o, 'I14', 'dashboard KPI cards while loading and after', async () => {
    await o.page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' });
    await sleep(400); const early = await bodyText(o.page);
    const skeleton = await o.page.locator('.animate-pulse').count();
    await settle(o.page); const late = await bodyText(o.page);
    T('I14-early', early.slice(0, 500)); T('I2-dashboard', late.slice(0, 1200));
    return { status: /…/.test(late) ? 'FAIL' : 'PASS', detail: `«…» while loading: ${/…/.test(early)}; placeholder bars: ${skeleton}; «…» after load: ${/…/.test(late)}` };
  });
  await step(o, 'I14', 'dashboard when its queries fail', async () => {
    await o.page.route(/\/rest\/v1\/(sales|devices|accessories)\?/, r => r.request().method() === 'GET' ? r.fulfill({ status: 500, body: '{"message":"x"}' }) : r.fallback());
    await o.page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' }); await settle(o.page);
    const t = await bodyText(o.page);
    await o.page.unroute(/\/rest\/v1\/(sales|devices|accessories)\?/);
    const err = /تعذّر تحميل القيمة|تعذّر تحميل/.test(t);
    return { status: err ? 'PASS' : 'FAIL', detail: `error state shown: ${err}; zeros shown instead: ${/\b0 ر\.س|^0$/.test(t)}` };
  });
  // 2/3 counts and values
  await step(o, 'I2', 'device counts: products page, reports, database', async () => {
    const p = await open(o, '/products?tab=inventory'); T('I2-products', p.text.slice(0, 1500));
    const r = await open(o, '/reports'); T('I2-reports', r.text.slice(0, 2500));
    const dev = (await api(ACC.owner, `devices?merchant_id=eq.${mid}&select=status,price`)).body;
    const by = dev.reduce((a, d) => (a[d.status] = (a[d.status] || 0) + 1, a), {});
    const acc = (await api(ACC.owner, `accessories?merchant_id=eq.${mid}&select=price,cost,quantity`)).body;
    const unsoldVal = dev.filter(d => d.status !== 'sold').reduce((a, d) => a + Number(d.price), 0);
    const accVal = acc.reduce((a, x) => a + Number(x.price) * Number(x.quantity), 0);
    T('I2-db', JSON.stringify({ total: dev.length, by, unsoldDevicesValue: unsoldVal, accessoriesValue: accVal, stockValue: unsoldVal + accVal }));
    return { status: 'NOTE', detail: `DB: ${dev.length} devices ${JSON.stringify(by)}; stock value (unsold devices + accessories, at price) ${(unsoldVal + accVal).toFixed(0)}` };
  });
  // 8 POS formatting, 16 translation
  await step(o, 'I8', 'POS number formats', async () => {
    const r = await open(o, '/pos');
    const bad3 = r.text.match(/\d+\.\d{3}\b/g) || []; const dot00 = r.text.match(/\d\.00\b/g) || [];
    T('I8-pos', r.text.slice(0, 700));
    return { status: bad3.length || dot00.length ? 'FAIL' : 'PASS', detail: `three-decimal amounts: ${bad3.slice(0, 3).join(',') || 'none'}; «.00»: ${dot00.slice(0, 3).join(',') || 'none'}` };
  });
  await step(o, 'I16', 'Camera button in Arabic', async () => {
    const t = await bodyText(o.page);
    return { status: /\bCamera\b/.test(t) ? 'FAIL' : (/كاميرا/.test(t) ? 'PASS' : 'FAIL'), detail: `«كاميرا» ${/كاميرا/.test(t)}; «Camera» ${/\bCamera\b/.test(t)}` };
  });
  // test accessory + sale: 8 cart formats, 9 invoice, 10 timing, double tap
  await step(o, 'setup', 'test accessory for the sale', async () => {
    const r = await api(ACC.owner, 'accessories', { method: 'POST', body: JSON.stringify({ merchant_id: mid, sku: SKU, name: `${TAG} إكسسوار ${RUN}`, cost: 50.5, price: 115.5, quantity: 3, min_quantity: 0 }) });
    const id = r.body?.[0]?.id; if (id) track('accessories', id);
    return { status: id ? 'PASS' : 'FAIL', detail: `HTTP ${r.status}` };
  });
  let inv = null;
  await step(o, 'I10', 'sale: time to result, invoice view, one invoice on a double tap', async () => {
    await open(o, '/pos');
    const scan = o.page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await fill(scan, SKU); await scan.press('Enter'); await sleep(1500);
    await o.page.locator('button:has(svg.lucide-plus)').first().click(); await sleep(400);
    T('I8-cart', (await bodyText(o.page)).match(/السلة الحالية.{0,500}/)?.[0] || '');
    await o.page.getByRole('button', { name: /^عميل|عميل$/ }).first().click().catch(() => {});
    if (await dialog(o.page).isVisible().catch(() => false)) { await fill(o.page.getByPlaceholder('اسم العميل'), `${TAG} زبون`); await dialog(o.page).getByRole('button', { name: 'تم' }).click(); }
    await o.page.getByRole('button', { name: /إتمام البيع/ }).click();
    const d = dialog(o.page);
    T('I8-pay', (await d.innerText()).slice(0, 500));
    await d.getByRole('button', { name: /كاش/ }).first().click();
    const amt = d.locator('input[type="number"]').last(); if (await amt.count()) await fill(amt, 300);
    const since = new Date(Date.now() - 3000).toISOString();
    await mark(o.page); const t0 = Date.now();
    const btn = d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ });
    let busySeen = false;
    const watch = (async () => { for (let i = 0; i < 40; i++) { if (/جارٍ إتمام البيع|جارٍ المعالجة/.test(await bodyText(o.page))) busySeen = true; await sleep(100); } })();
    await Promise.all([btn.click(), btn.click({ delay: 20 }).catch(() => {})]);
    const t = await toasts(o.page, 15000); const ms = Date.now() - t0; await watch;
    await sleep(1200);
    const view = await bodyText(o.page);
    T('I9-invoice', view.match(/الفاتورة.{0,1200}/)?.[0] || view.slice(0, 1200));
    const made = (await api(ACC.owner, `sales?customer_name=ilike.*${TAG}*&created_at=gte.${since}&select=id,invoice_number,total_amount,subtotal,tax_amount`)).body;
    made.forEach(x => track('sales', x.id)); inv = made[0];
    await o.page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
    return { status: made.length === 1 && ms < 2000 ? 'PASS' : 'FAIL', detail: `«${t}» after ${ms}ms (busy label seen: ${busySeen}); invoices made by two taps: ${made.length}; saved ${JSON.stringify(made[0] || {})}` };
  });
  await step(o, 'I9', 'invoice labels, date and direction', async () => {
    const v = await bodyText(o.page);
    const t = (await o.page.locator('body').innerText()).replace(/\s+/g, ' ');
    const label = /المجموع الفرعي \(غير شامل الضريبة\)/.test(t + v) || /المجموع الفرعي/.test(t + v);
    return { status: 'NOTE', detail: 'see T|I9-invoice' };
  });
  await step(o, 'I9', 'invoice date format in history', async () => {
    const r = await open(o, '/pos?tab=history');
    const dates = (r.text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || []).slice(0, 5);
    const invalid = dates.filter(d => { const [a, b] = d.split('/').map(Number); return a > 31 || b > 12; });
    T('I9-history', r.text.slice(0, 500));
    return { status: invalid.length ? 'FAIL' : 'PASS', detail: `dates seen ${dates.join(', ') || '(written as «28 أكتوبر»)'}; invalid ${invalid.join(',') || 'none'}` };
  });
  // 12 order numbers, 13 shipping
  await step(o, 'I12', 'online order numbers in the list', async () => {
    const r = await open(o, '/sales?tab=orders');
    const full = r.text.match(/\b(?:ON|ORD)-[A-Z0-9-]{6,}\b/g) || [];
    const cut = r.text.match(/(?:^|\s)-\d{3}(?:\s|$)/g) || [];
    T('I12-orders', r.text.slice(0, 800));
    return { status: cut.length ? 'FAIL' : (full.length ? 'PASS' : 'NOTE'), detail: `full numbers: ${full.slice(0, 3).join(', ') || 'none listed'}; truncated «-001»: ${cut.length}` };
  });
  await step(o, 'I13', 'shipping page and carrier API', async () => {
    const r = await open(o, '/shipping'); T('I13-shipping', r.text.slice(0, 1200));
    const f = await fetch(`${SUPA}/functions/v1/shipping-carriers`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ownerTok.access_token}`, 'Content-Type': 'application/json' }, body: '{"action":"status"}' });
    return { status: 'NOTE', detail: `carrier API function: HTTP ${f.status} ${(await f.text()).slice(0, 80)}` };
  });
  // 15 test data
  await step(o, 'I15', 'implausible prices in the demo data', async () => {
    const big = (await api(ACC.owner, `devices?price=gt.1000000&select=model,price,merchant_id`)).body;
    const ipo = (await api(ACC.owner, `devices?model=ilike.ipo&select=model,price`)).body;
    const wl = (await api(ACC.pro, `wholesale_listings?is_active=eq.true&wholesale_price=lt.10&select=wholesale_price,min_quantity,merchant_id`)).body;
    T('I15', JSON.stringify({ big, ipo, cheapListings: wl }));
    const neg = await api(ACC.owner, 'accessories', { method: 'POST', body: JSON.stringify({ merchant_id: mid, sku: `${SKU}-NEG`, name: `${TAG} سالب`, cost: -1, price: -5, quantity: -2 }) });
    const nid = neg.body?.[0]?.id; if (nid) track('accessories', nid);
    return { status: big.length || ipo.length || wl.length || nid ? 'FAIL' : 'PASS', detail: `devices > 1,000,000 SAR: ${big.length}; «ipo»: ${ipo.length}; active listings under 10 SAR: ${wl.length}; negative price/quantity accepted by the database: ${!!nid} (HTTP ${neg.status})` };
  });
  await o.ctx.close();

  // ---------- 6. wholesale as the Pro shop (buyer) ----------
  const p = await newSession(browser, 'pro');
  await step(p, 'login', 'Pro owner signs in', async () => { await login(p, ACC.pro); return 'ok'; });
  await step(p, 'I4', 'Pro: subscription page and reports', async () => {
    const s = await open(p, '/subscription'); T('I4-pro-subscription', s.text.slice(0, 900));
    const r = await open(p, '/reports'); const ok = /التقارير والتحليلات/.test(r.text) && !r.url.startsWith('/subscription');
    return { status: ok && !/باقة لايت/.test(s.text) ? 'PASS' : 'FAIL', detail: `subscription page says «${(s.text.match(/باقة (لايت|برو|ماكس|[^\s]+)/) || [''])[0]}»; branches «${(s.text.match(/\d+\s*\/\s*\d+/) || [''])[0]}»; reports open: ${ok}` };
  });
  await step(p, 'I6', 'wholesale market: supplier and product shown', async () => {
    const r = await open(p, '/sales?tab=wholesale'); T('I6-market', r.text.slice(0, 1500));
    const dash = (r.text.match(/—/g) || []).length;
    const orderBtn = p.page.getByRole('button', { name: /^اطلب/ }).first();
    let dlg = '';
    if (await orderBtn.count()) { await orderBtn.click(); await sleep(1000); dlg = await dialog(p.page).innerText().catch(() => ''); T('I6-dialog', dlg.slice(0, 700)); await p.page.keyboard.press('Escape'); }
    const parties = await rpc(ACC.pro, 'wholesale_parties');
    return { status: /من:\s*—/.test(dlg) ? 'FAIL' : 'NOTE', detail: `«—» on the page: ${dash}; dialog «من: —»: ${/من:\s*—/.test(dlg)}; wholesale_parties ${parties.status}` };
  });
  await p.ctx.close();

  // ---------- 4/11 Lite ----------
  const l = await newSession(browser, 'lite');
  await step(l, 'login', 'Lite owner signs in', async () => { await login(l, ACC.lite); return 'ok'; });
  await step(l, 'I4', 'Lite: subscription page, reports and wholesale', async () => {
    const s = await open(l, '/subscription'); T('I4-lite-subscription', s.text.slice(0, 900));
    const r = await open(l, '/reports'); const t = await toasts(l.page, 2500);
    const w = await open(l, '/sales?tab=wholesale');
    T('I11-lite', `${r.url} toast «${t}» | wholesale ${w.url} ${w.text.slice(0, 200)}`);
    return { status: r.url.startsWith('/subscription') && t ? 'PASS' : 'FAIL', detail: `reports → ${r.url} with message «${t}»; wholesale page → ${w.url} ${/لا تملك صلاحية|غير متاحة/.test(w.text) ? '(denied)' : '(content shown)'}` };
  });
  await l.ctx.close();

  // ---------- 11. employee and admin ----------
  const e = await newSession(browser, 'employee');
  await step(e, 'login', 'employee signs in', async () => { await login(e, ACC.employee); return new URL(e.page.url()).pathname; });
  await step(e, 'I11', 'employee opens a page outside the role', async () => {
    const r = await open(e, '/settings?tab=general'); const t = await toasts(e.page, 2500);
    return { status: t || /لا تملك صلاحية|ليست لديك صلاحية/.test(r.text) ? 'PASS' : 'FAIL', detail: `→ ${r.url}; message «${t}»` };
  });
  await step(e, 'I1', 'employee opens /reports', async () => { const r = await open(e, '/reports'); return { status: 'NOTE', detail: `→ ${r.url} ${/التقارير والتحليلات/.test(r.text) && !/لا تملك/.test(r.text) ? 'reports shown' : 'not shown'}` }; });
  await e.ctx.close();
  const a = await newSession(browser, 'admin');
  await step(a, 'login', 'admin signs in', async () => { await login(a, ACC.admin); return new URL(a.page.url()).pathname; });
  for (const pth of ['/', '/reports', '/products?tab=inventory', '/team?tab=users', '/subscription']) await step(a, 'regress', `admin opens ${pth}`, async () => { const r = await open(a, pth); return { status: /صار خطأ في عرض هذه الصفحة/.test(r.text) ? 'FAIL' : 'PASS', detail: `→ ${r.url}` }; });
  await a.ctx.close();

  // ---------- 16. English UI ----------
  const en = await newSession(browser, 'owner-en');
  await step(en, 'I16', 'English UI: POS camera label', async () => { await login(en, ACC.owner, 'en'); const r = await open(en, '/pos'); return { status: /Camera/.test(r.text) ? 'PASS' : 'FAIL', detail: `«Camera» ${/Camera/.test(r.text)}; Arabic left: ${(r.text.match(/[؀-ۿ]+/g) || []).slice(0, 6).join(' ')}` }; });
  await en.ctx.close();
} finally {
  const done = {};
  for (const id of created) {
    await api(ACC.owner, `sale_items?sale_id=eq.${id}`, { method: 'DELETE' });
    for (const t of ['sales', 'accessories']) { const r = await api(ACC.owner, `${t}?id=eq.${id}`, { method: 'DELETE' }); if (Array.isArray(r.body) && r.body.length) done[t] = (done[t] || 0) + r.body.length; }
  }
  for (const [t, col] of [['accessories', 'name'], ['sales', 'customer_name']]) {
    const x = (await api(ACC.owner, `${t}?${col}=ilike.*${TAG}*&select=id`)).body;
    if (Array.isArray(x) && x.length) console.log(`LEFTOVER ${t} ${x.map(r => r.id).join(',')}`);
  }
  console.log(`CLEANUP deleted ${JSON.stringify(done)}`);
  finish(); await browser.close();
}
