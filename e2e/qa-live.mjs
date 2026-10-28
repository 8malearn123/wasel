// One-off live QA from the customer's side: every demo account, every page,
// real journeys with test data tagged QA1028 (see qa-core.mjs write guard).
import fs from 'fs';
import { SITE, SUPA, ANON, TAG, PW, launch, newSession, step, rec, shot, finish, bodyText, overflowX, created, track } from './qa-core.mjs';

const ACC = {
  distributor: 'demo-distributor@wasil.demo', admin: 'demo-admin@wasil.demo', cashier: 'demo-cashier@wasil.demo',
  employee: 'demo-employee@wasil.demo', enterprise: 'demo-enterprise@wasil.demo', basic: 'demo-basic@wasil.demo',
};
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = k => !ONLY.length || ONLY.includes(k);
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- API reads (verification only; GET) ----------
const tokens = {};
async function token(email) {
  if (tokens[email]) return tokens[email];
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  const j = await r.json(); tokens[email] = j; return j;
}
async function api(email, q) {
  const t = (await token(email)).access_token;
  const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${t}` } });
  const x = await r.text(); try { return JSON.parse(x); } catch { return x; }
}

// ---------- UI helpers ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function settle(page, max = 15000) {
  const t0 = Date.now();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  while (Date.now() - t0 < max) {
    const busy = await page.locator('text=/جارٍ التحميل|جاري التحميل/').count().catch(() => 0);
    const spin = await page.locator('.animate-spin').count().catch(() => 0);
    if (!busy && !spin) break;
    await sleep(300);
  }
  await sleep(400);
  return Date.now() - t0;
}
async function toast(page, timeout = 8000) {
  const t = page.locator('[data-sonner-toast], [role="status"], li[role="status"]').last();
  await t.waitFor({ timeout }).catch(() => {});
  const txt = (await page.locator('[data-sonner-toast], ol[role] li, [role="status"]').allInnerTexts().catch(() => [])).join(' | ');
  return txt.replace(/\s+/g, ' ').trim();
}
async function clearToasts(page) { await page.evaluate(() => document.querySelectorAll('[data-sonner-toast]').forEach(e => e.remove())).catch(() => {}); }
const dialog = page => page.locator('[role="dialog"]').last();
const fill = async (loc, v) => { await loc.click({ timeout: 5000 }); await loc.fill(String(v)); };
function luhnImei(body14) { let s = 0; for (let i = 0; i < 14; i++) { let d = +body14[i]; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } s += d; } return body14 + ((10 - (s % 10)) % 10); }
const IMEI1 = luhnImei('00' + '1028' + String(Date.now()).slice(-8));
const IMEI2 = luhnImei('00' + '1028' + String(Date.now() + 7).slice(-8));
const RUN = String(Date.now()).slice(-5);
const SKU = `QA1028-${RUN}`;

// every test sale carries a test customer name, so the write guard lets it through
async function setCustomer(page, name = `${TAG} زبون نقطة البيع`) {
  await page.getByRole('button', { name: /^عميل|عميل$/ }).first().click().catch(() => {});
  const d = page.locator('[role="dialog"]').last();
  if (!(await d.isVisible().catch(() => false))) return false;
  await fill(page.getByPlaceholder('اسم العميل'), name);
  await d.getByRole('button', { name: 'تم' }).click();
  await sleep(300);
  return true;
}

async function login(s, email) {
  const { page } = s;
  await page.addInitScript(() => { try { localStorage.setItem('language', 'ar'); } catch {} });
  await page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.getByRole('tab', { name: 'دخول بالإيميل' }).click();
  await fill(page.locator('#email'), email);
  await fill(page.locator('#password'), PW);
  const t0 = Date.now();
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 });
  await settle(page);
  return Date.now() - t0;
}
async function logout(s) {
  const { page } = s;
  await page.locator('header button:has(svg.lucide-user)').last().click({ timeout: 8000 });
  await page.getByRole('menuitem', { name: /تسجيل الخروج|Sign Out/ }).click();
  await page.waitForURL(u => u.pathname.startsWith('/auth'), { timeout: 15000 });
}
async function open(s, path) {
  const t0 = Date.now();
  await s.page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' });
  const waited = await settle(s.page);
  return { ms: Date.now() - t0, waited };
}
async function pageState(s) {
  const t = await bodyText(s.page);
  return {
    url: new URL(s.page.url()).pathname + new URL(s.page.url()).search,
    h1: (await s.page.locator('header h1, main h1, h1').first().innerText().catch(() => '')).trim(),
    denied: /لا تملك صلاحية|ليست لديك صلاحية|غير متاحة في باقتك|غير متاحة لحساب الكاشير/.test(t),
    crashed: /صار خطأ في عرض هذه الصفحة/.test(t),
    loadError: /تعذّر تحميل/.test(t),
    empty: t.length < 300,
    nan: /NaN|undefined|Invalid Date|\[object Object\]/.test(t),
    text: t,
  };
}

// ---------- 0. pages per role ----------
const PAGES = ['/', '/pos', '/pos?tab=history', '/products?tab=inventory', '/products?tab=stocktake', '/products?tab=transfers',
  '/products?tab=suppliers', '/products?tab=labels', '/sales?tab=orders', '/sales?tab=repairs', '/sales?tab=closings',
  '/sales?tab=store', '/sales?tab=seo', '/sales?tab=customers', '/sales?tab=marketing', '/sales?tab=wholesale', '/shipping',
  '/reports', '/reports?tab=table-sales', '/team?tab=employees', '/team?tab=attendance', '/team?tab=devices', '/team?tab=payroll',
  '/team?tab=users', '/ai-insights', '/subscription', '/settings?tab=general', '/settings?tab=notifications', '/settings?tab=policy',
  '/organization?tab=branches', '/organization?tab=support'];

async function pagesFor(s, list = PAGES) {
  const matrix = [];
  for (const p of list) {
    await step(s, 'pages', p, async () => {
      const o = await open(s, p);
      const st = await pageState(s);
      const ov = await overflowX(s.page);
      matrix.push({ p, to: st.url, h1: st.h1, denied: st.denied });
      const issues = [];
      if (st.crashed) issues.push('ErrorBoundary');
      if (st.loadError) issues.push('load error shown');
      if (st.nan) issues.push('NaN/undefined in text');
      if (ov > 4) issues.push(`horizontal overflow ${ov}px`);
      if (o.waited > 12000) issues.push(`still loading after ${o.waited}ms`);
      const where = st.url !== p ? `→ ${st.url}` : '';
      const d = `${where} h1="${st.h1}" ${st.denied ? 'DENIED-MSG' : ''} load=${o.ms}ms ${issues.join(', ')}`;
      return { status: issues.length ? 'FAIL' : 'PASS', detail: d };
    });
  }
  return matrix;
}

// ---------- 1. login page & auth edge cases ----------
async function authTests(browser) {
  const s = await newSession(browser, 'visitor-auth', { allow: { fn: u => /login-by-code/.test(u) } });
  const { page } = s;
  await page.addInitScript(() => { try { localStorage.setItem('language', 'ar'); } catch {} });
  await step(s, 'auth', 'login page shows demo accounts and a public cashier code', async () => {
    await open(s, '/auth');
    const t = await bodyText(page);
    const code = (t.match(/\b\d{5}\b/) || [])[0];
    return { status: code ? 'NOTE' : 'PASS', detail: code ? `the login page shows a working cashier login code (${code}) and the demo password to anyone` : 'no code shown' };
  });
  await step(s, 'auth', 'unauthenticated /pos redirects to login', async () => {
    await open(s, '/pos');
    const u = new URL(page.url());
    if (!u.pathname.startsWith('/auth')) throw new Error(`stayed on ${u.pathname}`);
    return `→ ${u.pathname}${u.search}`;
  });
  await step(s, 'auth', 'empty email + password shows validation', async () => {
    await open(s, '/auth');
    await page.getByRole('tab', { name: 'دخول بالإيميل' }).click();
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await sleep(800);
    const t = await bodyText(page);
    const msg = (t.match(/Invalid email address|البريد[^.]{0,40}|Password must[^.]*/) || [])[0];
    return { status: msg ? 'PASS' : 'FAIL', detail: msg ? `message: ${msg}` : 'no message (native validation popup or nothing)' };
  });
  await step(s, 'auth', 'wrong password is refused with a clear message', async () => {
    await fill(page.locator('#email'), ACC.distributor);
    await fill(page.locator('#password'), 'wrong-pass-123');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await sleep(2500);
    const t = await bodyText(page);
    if (!/غير صحيحة|Invalid login/.test(t)) throw new Error('no error message');
    if (!new URL(page.url()).pathname.startsWith('/auth')) throw new Error('logged in with a wrong password!');
    return 'message: ' + (t.match(/[^.]{0,30}غير صحيحة/) || ['?'])[0];
  });
  await step(s, 'auth', 'login code: too short is refused client-side', async () => {
    await open(s, '/auth');
    await page.getByRole('tab', { name: 'دخول بالكود' }).click();
    await page.locator('input').first().click();
    await page.keyboard.type('12');
    await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await sleep(800);
    const t = await bodyText(page);
    return { status: /5 أرقام/.test(t) ? 'PASS' : 'FAIL', detail: (t.match(/أدخل كود[^)]*\)/) || ['no message'])[0] };
  });
  await step(s, 'auth', 'login code: a wrong code is refused', async () => {
    await open(s, '/auth');
    await page.getByRole('tab', { name: 'دخول بالكود' }).click();
    await page.locator('input').first().click();
    await page.keyboard.type('00000');
    await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await sleep(3000);
    const t = await bodyText(page);
    const ok = new URL(page.url()).pathname.startsWith('/auth') && /غير صحيح|خطأ/.test(t);
    return { status: ok ? 'PASS' : 'FAIL', detail: (t.match(/كود الدخول غير صحيح|حدث خطأ[^.]*/) || [new URL(page.url()).pathname])[0] };
  });
  await step(s, 'auth', 'demo cashier quick button logs in by code and lands on the till', async () => {
    await open(s, '/auth');
    await page.getByRole('button', { name: /كاشير تجريبي/ }).click();
    await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 });
    await settle(page);
    return `→ ${new URL(page.url()).pathname}`;
  });
  await step(s, 'auth', 'session survives a reload', async () => {
    await page.reload(); await settle(page);
    if (new URL(page.url()).pathname.startsWith('/auth')) throw new Error('logged out by reload');
    return new URL(page.url()).pathname;
  });
  await step(s, 'auth', 'logout returns to login and protects pages again', async () => {
    await logout(s);
    await open(s, '/sales?tab=orders');
    if (!new URL(page.url()).pathname.startsWith('/auth')) throw new Error(`after logout /sales opened: ${page.url()}`);
    return 'ok';
  });
  await s.ctx.close();
}

// ---------- 2. owner journeys (Max demo) ----------
async function ownerJourneys(browser) {
  const s = await newSession(browser, 'owner-max', {
    allow: {
      fn: (u, b) => /award-loyalty/.test(u) && (b.includes(TAG) || [...created].some(i => b.includes(i))),
      rpc: (t, b) => false,
    },
  });
  const { page } = s;
  const E = ACC.distributor;
  const mid = (await api(E, `merchant_users?user_id=eq.${(await token(E)).user.id}&select=merchant_id`))[0].merchant_id;
  await step(s, 'login', 'email login (owner, Max)', async () => `${await login(s, E)}ms`);
  const before = {};
  await step(s, 'dashboard', 'dashboard figures before the test sale', async () => {
    await open(s, '/');
    before.text = (await bodyText(page)).slice(0, 600);
    return before.text.slice(0, 250);
  });

  // -- inventory: add accessory
  const ACC_NAME = `${TAG} سماعة اختبار ${RUN}`;
  await step(s, 'inventory', 'add accessory (test)', async () => {
    await open(s, '/products?tab=inventory');
    await page.getByRole('button', { name: /^إضافة$|^Add$/ }).first().click();
    await page.getByRole('menuitem', { name: /إضافة إكسسوار/ }).click();
    const d = dialog(page);
    await fill(d.locator('#sku'), SKU);
    await fill(d.locator('#name'), ACC_NAME);
    if (await d.locator('#category').count()) await fill(d.locator('#category'), 'QA');
    await fill(d.locator('#quantity'), 5);
    await fill(d.locator('#cost'), 50);
    await fill(d.locator('#price'), 115);
    await clearToasts(page);
    await d.getByRole('button', { name: /إضافة إكسسوار/ }).click();
    const t = await toast(page);
    await sleep(1500);
    const row = (await api(E, `accessories?merchant_id=eq.${mid}&sku=eq.${SKU}&select=id,quantity,price`))[0];
    if (!row) throw new Error(`not saved; toast: ${t}`);
    track('row', row.id);
    return `toast: ${t}; saved qty=${row.quantity} price=${row.price}`;
  });
  await step(s, 'inventory', 'empty accessory form cannot be submitted', async () => {
    await page.getByRole('button', { name: /^إضافة$|^Add$/ }).first().click();
    await page.getByRole('menuitem', { name: /إضافة إكسسوار/ }).click();
    const d = dialog(page);
    await d.getByRole('button', { name: /إضافة إكسسوار/ }).click();
    await sleep(700);
    const stillOpen = await d.isVisible();
    const msg = await d.locator('input:invalid').first().evaluate(e => e.validationMessage).catch(() => '');
    await page.keyboard.press('Escape');
    return { status: stillOpen ? 'PASS' : 'FAIL', detail: `dialog stays open; browser message: ${msg || '-'} (no Arabic message of the app's own)` };
  });
  await step(s, 'inventory', 'negative price accessory is refused', async () => {
    await page.getByRole('button', { name: /^إضافة$|^Add$/ }).first().click();
    await page.getByRole('menuitem', { name: /إضافة إكسسوار/ }).click();
    const d = dialog(page);
    await fill(d.locator('#sku'), `${SKU}-NEG`);
    await fill(d.locator('#name'), `${TAG} سعر سالب`);
    if (await d.locator('#category').count()) await fill(d.locator('#category'), 'QA');
    await fill(d.locator('#quantity'), -3);
    await fill(d.locator('#cost'), -10);
    await fill(d.locator('#price'), -20);
    await clearToasts(page);
    await d.getByRole('button', { name: /إضافة إكسسوار/ }).click();
    const t = await toast(page, 5000);
    await sleep(1500);
    const row = (await api(E, `accessories?merchant_id=eq.${mid}&sku=eq.${SKU}-NEG&select=id,quantity,price,cost`))[0];
    if (row) track('row', row.id);
    if (await d.isVisible().catch(() => false)) await page.keyboard.press('Escape');
    return { status: row ? 'FAIL' : 'PASS', detail: row ? `SAVED with quantity ${row.quantity}, cost ${row.cost}, price ${row.price}; toast: ${t}` : `refused; toast: ${t}` };
  });
  // -- add device + duplicate IMEI
  const DEV_MODEL = `${TAG} جهاز اختبار ${RUN}`;
  for (const [label, imei, expectSaved] of [['add device (test IMEI)', IMEI1, true], ['same IMEI again is refused', IMEI1, false], ['second test device', IMEI2, true]]) {
    await step(s, 'inventory', label, async () => {
      await open(s, '/products?tab=inventory');
      await page.getByRole('button', { name: /^إضافة$|^Add$/ }).first().click();
      await page.getByRole('menuitem', { name: /إضافة جهاز/ }).click();
      const d = dialog(page);
      await fill(d.locator('#imei'), imei);
      await fill(d.locator('#model'), DEV_MODEL);
      await d.locator('#brand').fill('QA');
      await fill(d.locator('#cost'), 1000);
      await fill(d.locator('#price'), 1150);
      await clearToasts(page);
      await d.getByRole('button', { name: /إضافة جهاز/ }).click();
      const t = await toast(page);
      await sleep(1500);
      const rows = await api(E, `devices?merchant_id=eq.${mid}&imei=eq.${imei}&select=id,status,price`);
      rows.forEach(r => track('row', r.id));
      if (await d.isVisible().catch(() => false)) await page.keyboard.press('Escape');
      const n = rows.length;
      const ok = expectSaved ? n >= 1 : n === 1;
      return { status: ok ? 'PASS' : 'FAIL', detail: `rows with this IMEI: ${n}; toast: ${t}` };
    });
  }
  await step(s, 'inventory', 'search by IMEI and by SKU finds the test items', async () => {
    await open(s, '/products?tab=inventory');
    const q = page.getByPlaceholder(/ابحث في المخزون/);
    await fill(q, IMEI1); await sleep(1200);
    const a = (await bodyText(page)).includes(DEV_MODEL);
    await page.getByRole('button', { name: /^الإكسسوارات/ }).first().click().catch(() => {});
    await fill(q, SKU); await sleep(1200);
    const b = (await bodyText(page)).includes(ACC_NAME);
    return { status: a && b ? 'PASS' : 'FAIL', detail: `device by IMEI: ${a}; accessory by SKU: ${b}` };
  });
  await step(s, 'inventory', 'edit accessory price to 120', async () => {
    const row = page.locator('tr, [role="row"], div.rounded-lg').filter({ hasText: ACC_NAME }).last();
    await row.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first().click();
    await page.getByRole('menuitem', { name: 'تعديل' }).click();
    const d = dialog(page);
    await fill(d.locator('#price'), 120);
    await clearToasts(page);
    await d.getByRole('button', { name: /حفظ التعديلات/ }).click();
    const t = await toast(page);
    await sleep(1200);
    const r = (await api(E, `accessories?merchant_id=eq.${mid}&sku=eq.${SKU}&select=price`))[0];
    return { status: Number(r?.price) === 120 ? 'PASS' : 'FAIL', detail: `saved price ${r?.price}; toast ${t}` };
  });

  // -- POS sale: 2 × accessory, customer named like a formula (CSV test), cash
  let invoice = null;
  await step(s, 'pos', 'sell 2 × test accessory for cash, invoice shown', async () => {
    await open(s, '/pos');
    const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await fill(scan, SKU); await scan.press('Enter'); await sleep(1500);
    await page.locator('button:has(svg.lucide-plus)').first().click(); await sleep(400);
    await page.getByRole('button', { name: /^عميل|عميل$/ }).first().click().catch(() => {});
    if (await dialog(page).isVisible().catch(() => false)) {
      await fill(page.getByPlaceholder('اسم العميل'), `=1+1 ${TAG}`);
      await fill(page.getByPlaceholder('05xxxxxxxx'), '0500001028');
      await dialog(page).getByRole('button', { name: 'تم' }).click();
    }
    const cart = await bodyText(page);
    await page.getByRole('button', { name: /إتمام البيع/ }).click();
    const d = dialog(page);
    await d.getByRole('button', { name: /كاش/ }).first().click();
    const due = await d.innerText();
    const amt = d.locator('input[type="number"]').first();
    if (await amt.count()) await fill(amt, 300);
    await clearToasts(page);
    const t0 = Date.now();
    await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click();
    const t = await toast(page, 15000);
    const ms = Date.now() - t0;
    invoice = (t.match(/INV-[\d-]+/) || [])[0];
    const inv = await bodyText(page);
    const total = (inv.match(/الإجمالي \(شامل الضريبة\)\s*([\d,.]+)/) || [])[1];
    const vat = (inv.match(/الضريبة[^\d]{0,30}([\d,.]+)/) || [])[1];
    await page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
    const sale = invoice && (await api(E, `sales?merchant_id=eq.${mid}&invoice_number=eq.${invoice}&select=id,total_amount,subtotal,tax_amount,customer_name`))[0];
    if (sale) track('row', sale.id);
    const acc = (await api(E, `accessories?merchant_id=eq.${mid}&sku=eq.${SKU}&select=quantity`))[0];
    const okTotals = sale && Number(sale.total_amount) === 240 && Math.abs(Number(sale.tax_amount) - 31.3) < 0.02;
    return { status: sale && okTotals && acc?.quantity === 3 ? 'PASS' : 'FAIL',
      detail: `toast "${t}" in ${ms}ms; invoice ${invoice}; saved total ${sale?.total_amount} vat ${sale?.tax_amount} (expected 240 / 31.30); stock now ${acc?.quantity} (expected 3); due shown: ${(due.match(/المبلغ المستحق[^\d]*([\d,.]+)/) || [])[1]}; invoice view total ${total}` };
  });
  await step(s, 'pos', 'the new invoice appears in sales history and search finds it', async () => {
    await open(s, '/pos?tab=history');
    await fill(page.getByPlaceholder(/ابحث برقم الفاتورة/), invoice || TAG); await sleep(1500);
    const t = await bodyText(page);
    return { status: invoice && t.includes(invoice) ? 'PASS' : 'FAIL', detail: invoice ? `found: ${t.includes(invoice)}` : 'no invoice number from the sale' };
  });
  await step(s, 'pos', 'pressing confirm twice makes one invoice (device)', async () => {
    await open(s, '/pos');
    const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await fill(scan, IMEI2); await scan.press('Enter'); await sleep(1500);
    await setCustomer(page);
    await page.getByRole('button', { name: /إتمام البيع/ }).click();
    const d = dialog(page);
    await d.getByRole('button', { name: /كاش/ }).first().click();
    const amt = d.locator('input[type="number"]').first();
    if (await amt.count()) await fill(amt, 2000);
    const btn = d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ });
    await Promise.all([btn.click().catch(() => {}), btn.click({ delay: 30 }).catch(() => {}), btn.dblclick().catch(() => {})]);
    await sleep(6000);
    await page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
    const dev = (await api(E, `devices?imei=eq.${IMEI2}&select=id,status`))[0];
    const lines = dev ? await api(E, `sale_items?device_id=eq.${dev.id}&select=sale_id`) : [];
    lines.forEach(l => track('row', l.sale_id));
    return { status: lines.length === 1 ? 'PASS' : 'FAIL', detail: `invoices with the device: ${lines.length}; device status ${dev?.status}` };
  });
  await step(s, 'pos', 'scanning a sold device again is refused', async () => {
    await open(s, '/pos');
    const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await clearToasts(page);
    await fill(scan, IMEI2); await scan.press('Enter');
    const t = await toast(page, 5000);
    const cart = await bodyText(page);
    const inCart = cart.includes(DEV_MODEL) && !/السلة فارغة/.test(cart);
    return { status: inCart ? 'FAIL' : 'PASS', detail: `toast: ${t}; in cart: ${inCart}` };
  });
  await step(s, 'pos', 'losing the connection while paying', async () => {
    await open(s, '/pos');
    const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await fill(scan, SKU); await scan.press('Enter'); await sleep(1500);
    await setCustomer(page);
    await page.getByRole('button', { name: /إتمام البيع/ }).click();
    const d = dialog(page);
    await d.getByRole('button', { name: /كاش/ }).first().click();
    const amt = d.locator('input[type="number"]').first();
    if (await amt.count()) await fill(amt, 200);
    const n0 = (await api(E, `sales?merchant_id=eq.${mid}&created_at=gte.${TODAY}&select=id`)).length;
    await s.ctx.setOffline(true);
    await clearToasts(page);
    await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click().catch(() => {});
    const t = await toast(page, 8000);
    await sleep(2000);
    const stillBusy = /جارٍ إتمام البيع/.test(await bodyText(page));
    await s.ctx.setOffline(false);
    await sleep(3000);
    const n1 = (await api(E, `sales?merchant_id=eq.${mid}&created_at=gte.${TODAY}&select=id`)).length;
    await page.keyboard.press('Escape').catch(() => {});
    return { status: n1 === n0 && t ? 'PASS' : 'FAIL', detail: `message: "${t || 'none'}"; button stuck busy: ${stillBusy}; invoices made: ${n1 - n0}` };
  });

  // -- coupons
  const CODE = `QA${RUN}`;
  await step(s, 'marketing', 'create a 10% coupon limited to 1 use', async () => {
    await open(s, '/sales?tab=marketing');
    await page.getByRole('button', { name: 'إضافة كوبون' }).first().click();
    const d = dialog(page);
    const inputs = d.locator('input:not([type="datetime-local"]):not([role="switch"])');
    await fill(d.getByPlaceholder('SAVE20'), CODE);
    await fill(inputs.nth(1), `${TAG} كوبون`);
    const nums = d.locator('input[type="number"]');
    await fill(nums.nth(0), 10);
    if (await nums.count() > 3) await fill(nums.nth(3), 1);
    await d.getByRole('button', { name: 'حفظ' }).click();
    await sleep(2000);
    const c = (await api(E, `coupons?merchant_id=eq.${mid}&code=eq.${CODE}&select=id,max_uses,used_count,discount_value`))[0];
    if (c) track('row', c.id);
    return { status: c ? 'PASS' : 'FAIL', detail: c ? `saved max_uses=${c.max_uses} used=${c.used_count}` : 'not saved' };
  });
  await step(s, 'marketing', 'a 120% coupon is refused', async () => {
    await page.getByRole('button', { name: 'إضافة كوبون' }).first().click();
    const d = dialog(page);
    await fill(d.getByPlaceholder('SAVE20'), `${CODE}X`);
    await fill(d.locator('input:not([type="datetime-local"]):not([role="switch"])').nth(1), `${TAG} كوبون 120`);
    await fill(d.locator('input[type="number"]').nth(0), 120);
    await d.getByRole('button', { name: 'حفظ' }).click();
    await sleep(2000);
    const c = (await api(E, `coupons?merchant_id=eq.${mid}&code=eq.${CODE}X&select=id,discount_value`))[0];
    if (c) track('row', c.id);
    if (await d.isVisible().catch(() => false)) await page.keyboard.press('Escape');
    return { status: c ? 'FAIL' : 'PASS', detail: c ? `saved with ${c.discount_value}%` : 'refused' };
  });
  for (const [label, expectOk] of [['apply the coupon in a sale', true], ['the same 1-use coupon a second time is refused', false]]) {
    await step(s, 'pos', label, async () => {
      await open(s, '/pos');
      const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
      await fill(scan, SKU); await scan.press('Enter'); await sleep(1500);
      await setCustomer(page);
    await page.getByRole('button', { name: /إتمام البيع/ }).click();
      const d = dialog(page);
      await fill(d.getByPlaceholder('رمز الكوبون'), CODE);
      await d.getByRole('button', { name: 'تطبيق' }).click();
      await sleep(2000);
      const txt = await d.innerText();
      const applied = /حصلت على خصم/.test(txt);
      let inv = null;
      if (applied && expectOk) {
        await d.getByRole('button', { name: /كاش/ }).first().click();
        const amt = d.locator('input[type="number"]').last();
        if (await amt.count()) await fill(amt, 200);
        await clearToasts(page);
        await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click();
        const t = await toast(page, 15000);
        inv = (t.match(/INV-[\d-]+/) || [])[0];
        await page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
        const sale = inv && (await api(E, `sales?invoice_number=eq.${inv}&select=id,total_amount,discount_amount`))[0];
        if (sale) track('row', sale.id);
        return { status: sale && Number(sale.discount_amount) === 12 ? 'PASS' : 'FAIL', detail: `invoice ${inv}; total ${sale?.total_amount} discount ${sale?.discount_amount} (expected 108 / 12)` };
      }
      await page.keyboard.press('Escape');
      const msg = (txt.match(/كوبون غير صالح|الكوبون نفد|الكوبون منتهي|الحد الأدنى[^\n]*|خطأ في التحقق/) || ['-'])[0];
      return { status: applied === expectOk ? 'PASS' : 'FAIL', detail: `applied: ${applied}; message: ${msg}` };
    });
  }
  await step(s, 'marketing', 'coupon use count after one sale', async () => {
    const c = (await api(E, `coupons?code=eq.${CODE}&select=used_count,max_uses`))[0];
    return { status: c?.used_count === 1 ? 'PASS' : 'FAIL', detail: `used_count=${c?.used_count} (applied twice, sold once; expected 1)` };
  });

  // -- customers
  const CUST = `${TAG} عميل ${RUN}`;
  await step(s, 'customers', 'add a customer', async () => {
    await open(s, '/sales?tab=customers');
    await page.getByRole('button', { name: /إضافة عميل/ }).first().click();
    const d = dialog(page);
    const inputs = d.locator('input');
    await fill(inputs.nth(0), CUST);
    await fill(inputs.nth(1), '0500001028');
    await clearToasts(page);
    await d.getByRole('button', { name: 'حفظ' }).click();
    const t = await toast(page);
    await sleep(1500);
    const c = (await api(E, `customers?merchant_id=eq.${mid}&name=eq.${encodeURIComponent(CUST)}&select=id,total_spent`))[0];
    if (c) track('row', c.id);
    return { status: c ? 'PASS' : 'FAIL', detail: `toast ${t}` };
  });
  await step(s, 'customers', 'empty customer name is refused with a message', async () => {
    await page.getByRole('button', { name: /إضافة عميل/ }).first().click();
    const d = dialog(page);
    await clearToasts(page);
    await d.getByRole('button', { name: 'حفظ' }).click();
    const t = await toast(page, 2500);
    const open_ = await d.isVisible().catch(() => false);
    if (open_) await page.keyboard.press('Escape');
    return { status: t ? 'PASS' : 'FAIL', detail: t ? `message: ${t}` : 'nothing happens, no message' };
  });
  await step(s, 'customers', 'search finds the customer; open, edit email', async () => {
    await fill(page.getByPlaceholder(/بحث بالاسم أو الهاتف/), RUN); await sleep(1500);
    await page.getByText(CUST).first().click();
    await settle(page);
    await page.getByRole('button', { name: 'تعديل' }).first().click();
    const email = page.locator('input[type="email"], input').filter({ hasText: '' });
    const all = page.locator('[role="dialog"] input, main input');
    const n = await all.count();
    await fill(all.nth(Math.min(2, n - 1)), `qa${RUN}@example.test`);
    await clearToasts(page);
    await page.getByRole('button', { name: 'حفظ' }).first().click();
    const t = await toast(page);
    return `url ${new URL(page.url()).pathname}; toast ${t}`;
  });
  await step(s, 'customers', 'delete a customer', async () => ({ status: 'NOTE', detail: 'no delete control anywhere in the UI (customers can only be added/edited)' }));

  // -- suppliers
  const SUP = `${TAG} مورد ${RUN}`;
  await step(s, 'suppliers', 'add, edit and remove a supplier', async () => {
    await open(s, '/products?tab=suppliers');
    await page.getByRole('button', { name: /إضافة مورد|أضف أول مورد/ }).first().click();
    let d = dialog(page);
    await fill(d.locator('input').nth(0), SUP);
    await clearToasts(page);
    await d.getByRole('button', { name: /^إضافة$/ }).click();
    const t1 = await toast(page);
    await sleep(1500);
    const row = (await api(E, `suppliers?merchant_id=eq.${mid}&name=eq.${encodeURIComponent(SUP)}&select=id`))[0];
    if (!row) throw new Error(`not saved: ${t1}`);
    track('row', row.id);
    await fill(page.getByPlaceholder(/بحث عن مورد/), RUN); await sleep(1000);
    const card = page.locator('div').filter({ hasText: SUP }).last();
    await page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first().click();
    await page.getByRole('menuitem', { name: 'تعديل' }).click();
    d = dialog(page);
    await fill(d.locator('input').nth(2), '0500001029');
    await clearToasts(page);
    await d.getByRole('button', { name: 'حفظ' }).click();
    const t2 = await toast(page);
    await sleep(1000);
    await page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first().click();
    await clearToasts(page);
    await page.getByRole('menuitem', { name: 'حذف' }).click();
    const t3 = await toast(page);
    await sleep(1000);
    const after = (await api(E, `suppliers?id=eq.${row.id}&select=phone,is_active`))[0];
    return { status: after?.phone === '0500001029' && after?.is_active === false ? 'PASS' : 'FAIL', detail: `added "${t1}", edited "${t2}" phone=${after?.phone}, removed "${t3}" active=${after?.is_active} (no confirmation before removing)` };
  });

  // -- repairs
  await step(s, 'repairs', 'create a repair order, move it on, cancel it', async () => {
    await open(s, '/sales?tab=repairs');
    await page.getByRole('button', { name: /طلب إصلاح جديد|إنشاء أول طلب/ }).first().click();
    const d = dialog(page);
    await fill(d.getByPlaceholder(/ابحث باسم العميل أو رقم جواله/), CUST);
    await fill(d.getByPlaceholder('05xxxxxxxx'), '0500001028');
    await d.getByRole('tab', { name: 'الإصلاح' }).click();
    await fill(d.getByPlaceholder(/وصف تفصيلي للمشكلة/), `${TAG} شاشة مكسورة (اختبار)`);
    await clearToasts(page);
    await d.getByRole('button', { name: 'إنشاء طلب الإصلاح' }).click();
    const t = await toast(page);
    await sleep(1500);
    const r = (await api(E, `repair_orders?merchant_id=eq.${mid}&customer_name=eq.${encodeURIComponent(CUST)}&select=id,repair_number,status`))[0];
    if (!r) throw new Error(`not saved: ${t}`);
    track('row', r.id);
    await fill(page.getByPlaceholder(/ابحث باسم العميل، رقم الطلب/), r.repair_number); await sleep(1200);
    await page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first().click();
    await page.getByRole('menuitem', { name: /نقل إلى/ }).first().click();
    await sleep(1500);
    const mid1 = (await api(E, `repair_orders?id=eq.${r.id}&select=status`))[0]?.status;
    await page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first().click();
    await page.getByRole('menuitem', { name: 'إلغاء الطلب' }).click();
    await sleep(1500);
    const end = (await api(E, `repair_orders?id=eq.${r.id}&select=status`))[0]?.status;
    return { status: end === 'cancelled' ? 'PASS' : 'FAIL', detail: `${r.repair_number}: ${r.status} → ${mid1} → ${end} (cancel has no confirmation)` };
  });

  // -- online store as a visitor (separate browser, nothing shared)
  let orderNo = null;
  const v = await newSession(browser, 'visitor-store', { allow: { fn: (u, b) => /award-loyalty/.test(u) && (b.includes(TAG) || [...created].some(i => b.includes(i))) } });
  await v.page.addInitScript(() => { try { localStorage.setItem('language', 'ar'); } catch {} });
  await step(v, 'store', 'visitor finds the test accessory and adds it to the cart', async () => {
    await open(v, '/store/alanam-max/products');
    await fill(v.page.getByPlaceholder('ابحث عن منتج...'), RUN); await sleep(1500);
    const t = await bodyText(v.page);
    if (!t.includes(RUN)) return { status: 'FAIL', detail: 'the new accessory is not listed in the store (search by name)' };
    await v.page.getByRole('button', { name: 'أضف للسلة' }).first().click();
    return `toast: ${await toast(v.page)}`;
  });
  await step(v, 'store', 'checkout without details or address is refused with messages', async () => {
    await open(v, '/store/alanam-max/checkout');
    const btn = v.page.getByRole('button', { name: 'إتمام الطلب' });
    await clearToasts(v.page);
    await btn.click().catch(() => {});
    const t = await toast(v.page, 4000);
    return { status: t ? 'PASS' : 'FAIL', detail: `message: ${t || 'none'}` };
  });
  await step(v, 'store', 'invalid phone and address are refused', async () => {
    const box = v.page.locator('section, div').filter({ hasText: 'بياناتك' }).last();
    const inputs = v.page.locator('main input');
    await fill(inputs.nth(0), `${TAG} زائر`);
    await fill(v.page.getByPlaceholder('05XXXXXXXX'), '12');
    await v.page.getByRole('button', { name: 'حفظ', exact: true }).first().click();
    await sleep(800);
    const m1 = /اكتب رقم جوال صحيح/.test(await bodyText(v.page));
    await fill(v.page.getByPlaceholder('05XXXXXXXX'), '0500001028');
    await v.page.getByRole('button', { name: 'حفظ', exact: true }).first().click();
    await sleep(800);
    await v.page.getByRole('button', { name: /إضافة عنوان التوصيل/ }).click();
    const d = dialog(v.page);
    await fill(d.getByPlaceholder('1234'), '12');
    await d.getByRole('button', { name: 'حفظ العنوان' }).click();
    await sleep(800);
    const m2 = /المدينة مطلوبة|رقم المبنى 4 أرقام/.test(await d.innerText());
    return { status: m1 && m2 ? 'PASS' : 'FAIL', detail: `phone message: ${m1}; address messages: ${m2}` };
  });
  await step(v, 'store', 'place a cash-on-delivery order (test)', async () => {
    const d = dialog(v.page);
    const ins = d.locator('input');
    await fill(ins.nth(0), 'الرياض');
    await fill(ins.nth(1), 'حي اختبار');
    await fill(ins.nth(2), `شارع ${TAG}`);
    await fill(d.getByPlaceholder('1234'), '1028');
    await d.getByRole('button', { name: 'حفظ العنوان' }).click();
    await sleep(1000);
    const t = await bodyText(v.page);
    const total = (t.match(/الإجمالي\s*([\d,.]+)/) || [])[1];
    const vat = (t.match(/ضريبة القيمة المضافة \(15%\)\s*([\d,.]+)/) || [])[1];
    const ship = (t.match(/الشحن\s*([\d,.]+|مجاني)/) || [])[1];
    await clearToasts(v.page);
    await v.page.getByRole('button', { name: 'إتمام الطلب' }).click();
    await v.page.waitForURL(/thank-you/, { timeout: 20000 }).catch(() => {});
    await settle(v.page);
    orderNo = decodeURIComponent((v.page.url().match(/thank-you\/([^/?]+)/) || [])[1] || '');
    const tt = await toast(v.page, 3000);
    const o = orderNo && (await api(E, `online_orders?order_number=eq.${orderNo}&select=id,subtotal,tax_amount,shipping_cost,total_amount,status`))[0];
    if (o) track('row', o.id);
    // the shelf price (VAT included) is 120: the right total is 120 + delivery
    const right = o && Math.abs(Number(o.total_amount) - (120 + Number(o.shipping_cost || 0))) < 0.01;
    return { status: o ? (right ? 'PASS' : 'FAIL') : 'FAIL',
      detail: o ? `order ${orderNo}: subtotal ${o.subtotal} + VAT ${o.tax_amount} + delivery ${o.shipping_cost} = ${o.total_amount} (shelf price 120 «شامل الضريبة»; checkout showed VAT ${vat}, total ${total}, delivery ${ship})` : `no order saved; url ${v.page.url()}; ${tt}` };
  });
  await step(v, 'store', 'track the order with its number and phone', async () => {
    if (!orderNo) return { status: 'BLOCKED', detail: 'no order number' };
    await open(v, '/store/alanam-max/track');
    await fill(v.page.getByPlaceholder('ORD-...'), orderNo);
    await fill(v.page.locator('input[maxlength="4"]'), '1028');
    await v.page.getByRole('button', { name: 'بحث' }).click();
    await sleep(2500);
    const t = await bodyText(v.page);
    return { status: /بانتظار التأكيد|مؤكّد/.test(t) ? 'PASS' : 'FAIL', detail: (t.match(/الطلب غير موجود|بيانات التحقق غير صحيحة|بانتظار التأكيد|مؤكّد/) || ['?'])[0] };
  });
  await step(v, 'store', 'my orders lists it (this browser)', async () => {
    await open(v, '/store/alanam-max/my-orders');
    const t = await bodyText(v.page);
    return { status: orderNo && t.includes(orderNo) ? 'PASS' : 'FAIL', detail: t.match(/\d+ طلب/)?.[0] || '' };
  });
  await step(v, 'store', 'unknown store slug', async () => {
    await open(v, '/store/no-such-store-qa');
    return { status: /المتجر غير موجود/.test(await bodyText(v.page)) ? 'PASS' : 'FAIL', detail: '' };
  });
  await v.ctx.close();

  // -- owner handles the order
  await step(s, 'orders', 'owner finds the store order, confirms and ships it with a test tracking number', async () => {
    if (!orderNo) return { status: 'BLOCKED', detail: 'no order' };
    await open(s, '/sales?tab=orders');
    await fill(page.getByPlaceholder(/ابحث بالرقم أو الاسم أو الهاتف/), orderNo); await sleep(1500);
    if (!(await bodyText(page)).includes(orderNo)) throw new Error('order not listed');
    const more = () => page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first();
    await more().click(); await page.getByRole('menuitem', { name: 'تأكيد الطلب' }).click(); await sleep(1500);
    await more().click(); await page.getByRole('menuitem', { name: 'إضافة تتبع الشحن' }).click();
    const d = dialog(page);
    await fill(d.locator('input').last(), `QA1028TRK${RUN}`);
    await d.getByRole('button', { name: 'حفظ وشحن' }).click(); await sleep(2000);
    const o = (await api(E, `online_orders?order_number=eq.${orderNo}&select=status,tracking_number,shipping_provider`))[0];
    const acc = (await api(E, `accessories?sku=eq.${SKU}&select=quantity`))[0];
    return { status: o?.status === 'shipped' ? 'PASS' : 'FAIL', detail: `status ${o?.status}, tracking ${o?.tracking_number}; accessory stock after shipping ${acc?.quantity} (an online order should take stock)` };
  });
  await step(s, 'shipping', 'the shipment shows on the shipping page', async () => {
    await open(s, '/shipping');
    const t = await bodyText(page);
    return { status: orderNo && t.includes(orderNo) ? 'PASS' : 'FAIL', detail: '' };
  });
  await step(s, 'orders', 'cancel the test order', async () => {
    if (!orderNo) return { status: 'BLOCKED', detail: 'no order' };
    await open(s, '/sales?tab=orders');
    await fill(page.getByPlaceholder(/ابحث بالرقم أو الاسم أو الهاتف/), orderNo); await sleep(1500);
    await page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first().click();
    const item = page.getByRole('menuitem', { name: 'إلغاء الطلب' });
    if (!(await item.count())) { await page.keyboard.press('Escape'); return { status: 'NOTE', detail: 'a shipped order cannot be cancelled from the menu' }; }
    await item.click(); await sleep(1500);
    const o = (await api(E, `online_orders?order_number=eq.${orderNo}&select=status`))[0];
    return { status: o?.status === 'cancelled' ? 'PASS' : 'FAIL', detail: `status ${o?.status} (no confirmation)` };
  });

  // -- transfers: a pending transfer of the test device, then cancel it
  await step(s, 'transfers', 'create a transfer of the test device and cancel it', async () => {
    await open(s, '/products?tab=transfers');
    await page.getByRole('button', { name: /تحويل جديد|أنشئ أول تحويل/ }).first().click();
    const d = dialog(page);
    const combos = d.getByRole('combobox');
    await combos.nth(0).click(); const opts = page.getByRole('option'); const nOpt = await opts.count();
    if (nOpt < 2) { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); return { status: 'BLOCKED', detail: 'the shop has fewer than two branches' }; }
    await opts.nth(0).click();
    await combos.nth(1).click(); await page.getByRole('option').nth(1).click();
    const scan = d.getByPlaceholder(/امسح الباركود أو اكتب IMEI/);
    await fill(scan, IMEI1); await scan.press('Enter'); await sleep(1000);
    await fill(d.getByPlaceholder('ملاحظات اختيارية...'), `${TAG} تحويل اختبار`);
    await clearToasts(page);
    await d.getByRole('button', { name: 'إنشاء التحويل' }).click();
    const t = await toast(page);
    await sleep(1500);
    const dev = (await api(E, `devices?imei=eq.${IMEI1}&select=id,status`))[0];
    const line = (await api(E, `stock_transfer_items?device_id=eq.${dev.id}&select=transfer_id`))[0];
    if (line) track('row', line.transfer_id);
    await open(s, '/products?tab=transfers');
    const cancel = page.locator('[title="إلغاء التحويل"]').first();
    if (await cancel.count()) { await cancel.click(); await sleep(1500); }
    const tr = line && (await api(E, `stock_transfers?id=eq.${line.transfer_id}&select=status,transfer_number`))[0];
    const after = (await api(E, `devices?id=eq.${dev.id}&select=status`))[0];
    return { status: after?.status === 'available' ? 'PASS' : 'FAIL', detail: `"${t}"; device while pending: ${dev.status}; transfer ${tr?.transfer_number} → ${tr?.status}; device after cancel: ${after?.status} (expected available)` };
  });

  // -- reports & CSV
  await step(s, 'reports', 'sales table report finds today\'s test invoice; CSV export', async () => {
    await open(s, '/reports?tab=table-sales');
    if (await page.locator('#from-sales').count()) { await page.locator('#from-sales').fill(TODAY); await page.locator('#to-sales').fill(TODAY); }
    await fill(page.locator('#search-sales'), invoice || TAG); await sleep(2000);
    const t = await bodyText(page);
    const found = invoice && t.includes(invoice);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.getByRole('button', { name: 'CSV', exact: true }).click().catch(() => {})]);
    let csv = '';
    if (dl) { const p = await dl.path(); csv = fs.readFileSync(p, 'utf8'); }
    const formula = /(^|[,;\n"])=1\+1/.test(csv);
    return { status: found && dl && !formula ? 'PASS' : 'FAIL', detail: `invoice in report: ${found}; CSV downloaded: ${!!dl}; a customer named «=1+1…» is written as a live formula: ${formula}; branch column: ${(csv.split('\n')[0] || '').slice(0, 160)}` };
  });
  await step(s, 'dashboard', 'dashboard after the test sales', async () => {
    await open(s, '/');
    const t = (await bodyText(page)).slice(0, 600);
    return { status: 'NOTE', detail: `before: ${before.text?.slice(0, 160)} | after: ${t.slice(0, 160)}` };
  });

  // -- settings, users: look, never save
  await step(s, 'settings', 'settings page opens; leaving with unsaved changes', async () => {
    await open(s, '/settings?tab=general');
    const name = page.locator('main input').first();
    const was = await name.inputValue().catch(() => '');
    await name.fill(was + ' تعديل غير محفوظ').catch(() => {});
    let warned = false;
    page.once('dialog', async d => { warned = true; await d.dismiss(); });
    await page.locator('nav').getByText('نقطة البيع').first().click().catch(() => page.goto(`${SITE}/pos`));
    await sleep(1500);
    return { status: 'NOTE', detail: `no save pressed; warning about unsaved changes when leaving: ${warned}` };
  });
  await step(s, 'users', 'users list; login code dialog shows the code', async () => {
    await open(s, '/team?tab=users');
    const t = await bodyText(page);
    const n = (t.match(/إجمالي المستخدمين\s*(\d+)/) || [])[1];
    await page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').nth(1).click();
    await page.getByRole('menuitem', { name: 'تعيين كود دخول جديد' }).click();
    await sleep(1000);
    const code = await dialog(page).locator('p.font-mono').first().innerText().catch(() => '');
    await dialog(page).getByRole('button', { name: 'إلغاء' }).click();
    return { status: 'NOTE', detail: `users: ${n}; current code shown to the owner: ${code ? 'yes' : 'no'} (nothing saved)` };
  });
  await step(s, 'closings', 'daily closing screen (not closed)', async () => {
    await open(s, '/sales?tab=closings');
    const t = await bodyText(page);
    return { status: 'NOTE', detail: `${(t.match(/الكاش المعدود فعلياً|تم الإغلاق|لا توجد مبيعات في هذا اليوم/) || ['?'])[0]} — the day was NOT closed (it would close the demo shop's real day)` };
  });

  // -- delete the test invoice from history: stock returns?
  await step(s, 'pos', 'delete the test invoice from history; stock comes back', async () => {
    if (!invoice) return { status: 'BLOCKED', detail: 'no invoice' };
    const q0 = (await api(E, `accessories?sku=eq.${SKU}&select=quantity`))[0]?.quantity;
    await open(s, '/pos?tab=history');
    await fill(page.getByPlaceholder(/ابحث برقم الفاتورة/), invoice); await sleep(1500);
    await page.getByRole('button', { name: 'حذف', exact: true }).first().click();
    await clearToasts(page);
    await page.getByRole('alertdialog').getByRole('button', { name: 'حذف' }).click();
    const t = await toast(page);
    await sleep(2000);
    const q1 = (await api(E, `accessories?sku=eq.${SKU}&select=quantity`))[0]?.quantity;
    const gone = !(await api(E, `sales?invoice_number=eq.${invoice}&select=id`)).length;
    return { status: gone && q1 === q0 + 2 ? 'PASS' : 'FAIL', detail: `"${t}"; invoice gone: ${gone}; stock ${q0} → ${q1} (expected +2)` };
  });
  await s.ctx.close();
  return { mid, SKU, ACC_NAME };
}

// ---------- 3. cashier ----------
async function cashierJourneys(browser) {
  const s = await newSession(browser, 'cashier');
  const { page } = s;
  const E = ACC.cashier;
  await step(s, 'login', 'email login (cashier)', async () => `${await login(s, E)}ms → ${new URL(page.url()).pathname}`);
  let inv = null;
  await step(s, 'pos', 'cashier sells the test accessory', async () => {
    await open(s, '/pos');
    const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await fill(scan, SKU); await scan.press('Enter'); await sleep(1500);
    await setCustomer(page);
    await page.getByRole('button', { name: /إتمام البيع/ }).click();
    const d = dialog(page);
    await d.getByRole('button', { name: /كاش/ }).first().click();
    const amt = d.locator('input[type="number"]').first();
    if (await amt.count()) await fill(amt, 200);
    await clearToasts(page);
    await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click();
    const t = await toast(page, 15000);
    inv = (t.match(/INV-[\d-]+/) || [])[0];
    await page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
    const sale = inv && (await api(E, `sales?invoice_number=eq.${inv}&select=id,total_amount`))[0];
    if (sale) track('row', sale.id);
    return { status: sale ? 'PASS' : 'FAIL', detail: `"${t}"` };
  });
  await step(s, 'pos', 'cashier history shows only their own sales', async () => {
    await open(s, '/pos?tab=history');
    const shown = (await bodyText(page)).match(/INV-[\d-]+/g) || [];
    const me = (await token(E)).user.id;
    const mine = await api(E, `sales?sold_by=eq.${me}&select=invoice_number`);
    const mineSet = new Set(mine.map(x => x.invoice_number));
    const others = shown.filter(x => !mineSet.has(x));
    return { status: others.length ? 'FAIL' : 'PASS', detail: `${shown.length} invoices shown, ${others.length} not the cashier's` };
  });
  await step(s, 'pos', 'cashier edits their own test invoice to a 100% discount', async () => {
    if (!inv) return { status: 'BLOCKED', detail: 'no invoice' };
    await fill(page.getByPlaceholder(/ابحث برقم الفاتورة/), inv); await sleep(1500);
    const edit = page.getByRole('button', { name: 'تعديل', exact: true }).first();
    if (await edit.isDisabled()) return { status: 'PASS', detail: 'edit disabled (printed)' };
    await edit.click();
    const d = dialog(page);
    const disc = d.locator('input[type="number"]').first();
    await fill(disc, 120);
    await d.getByRole('button', { name: 'حفظ' }).click(); await sleep(2000);
    const sale = (await api(E, `sales?invoice_number=eq.${inv}&select=total_amount,discount_amount`))[0];
    const del = await page.getByRole('button', { name: 'حذف', exact: true }).count();
    return { status: Number(sale?.discount_amount) > 0 ? 'FAIL' : 'PASS', detail: `after edit: discount ${sale?.discount_amount}, total ${sale?.total_amount} — a cashier can rewrite a paid invoice; delete button shown to cashier: ${del > 0}` };
  });
  for (const p of ['/', '/reports', '/settings?tab=general', '/team?tab=users', '/subscription', '/products?tab=transfers', '/sales?tab=store', '/sales?tab=wholesale', '/products?tab=stocktake']) {
    await step(s, 'access', `cashier opens ${p} by URL`, async () => {
      await open(s, p);
      const st = await pageState(s);
      const allowed = st.url.startsWith('/pos') || st.denied;
      return { status: allowed ? 'PASS' : 'FAIL', detail: `→ ${st.url} h1="${st.h1}" ${st.denied ? 'denied message' : 'content shown'}` };
    });
  }
  await step(s, 'logout', 'cashier logs out', async () => { await logout(s); return 'ok'; });
  await s.ctx.close();
  return inv;
}

// ---------- 4. other roles: login, pages, one task each ----------
async function rolePages(browser, key, { mobile = false, list } = {}) {
  const s = await newSession(browser, `${key}${mobile ? '-390' : ''}`, { mobile });
  await step(s, 'login', `email login (${key})`, async () => `${await login(s, ACC[key])}ms → ${new URL(s.page.url()).pathname}`);
  if (mobile) {
    await step(s, 'mobile', 'menu button opens navigation and a link works', async () => {
      await open(s, '/');
      await s.page.getByRole('button', { name: /القائمة|Menu/ }).first().click();
      await sleep(600);
      await s.page.getByRole('link', { name: /الطلبات والمبيعات|نقطة البيع/ }).first().click();
      await settle(s.page);
      return `→ ${new URL(s.page.url()).pathname}`;
    });
  }
  const m = await pagesFor(s, list);
  await s.ctx.close();
  return m;
}

async function employeeTask(browser) {
  const s = await newSession(browser, 'employee');
  const E = ACC.employee;
  await step(s, 'login', 'email login (employee)', async () => `${await login(s, E)}ms → ${new URL(s.page.url()).pathname}`);
  await step(s, 'inventory', 'employee adds a test accessory', async () => {
    await open(s, '/products?tab=inventory');
    const add = s.page.getByRole('button', { name: /^إضافة$|^Add$/ });
    if (!(await add.count())) return { status: 'NOTE', detail: 'no add button for this role' };
    await add.first().click();
    await s.page.getByRole('menuitem', { name: /إضافة إكسسوار/ }).click();
    const d = dialog(s.page);
    await fill(d.locator('#sku'), `${SKU}-EMP`);
    await fill(d.locator('#name'), `${TAG} إكسسوار الموظف`);
    if (await d.locator('#category').count()) await fill(d.locator('#category'), 'QA');
    await fill(d.locator('#quantity'), 1); await fill(d.locator('#cost'), 1); await fill(d.locator('#price'), 2);
    await clearToasts(s.page);
    await d.getByRole('button', { name: /إضافة إكسسوار/ }).click();
    const t = await toast(s.page);
    await sleep(1500);
    const row = (await api(ACC.distributor, `accessories?sku=eq.${SKU}-EMP&select=id`))[0];
    if (row) track('row', row.id);
    return `saved: ${!!row}; "${t}"`;
  });
  await pagesFor(s);
  await s.ctx.close();
}

// ---------- 5. other plans: one sale each, then clean ----------
async function planSale(browser, key) {
  const s = await newSession(browser, `${key}-sale`);
  const { page } = s;
  const E = ACC[key];
  const mid = (await api(E, `merchant_users?user_id=eq.${(await token(E)).user.id}&select=merchant_id`))[0].merchant_id;
  const sku = `${SKU}-${key.slice(0, 3).toUpperCase()}`;
  await step(s, 'login', `email login (${key})`, async () => `${await login(s, E)}ms`);
  await step(s, 'inventory', 'add a test accessory', async () => {
    await open(s, '/products?tab=inventory');
    await page.getByRole('button', { name: /^إضافة$|^Add$/ }).first().click();
    await page.getByRole('menuitem', { name: /إضافة إكسسوار/ }).click();
    const d = dialog(page);
    await fill(d.locator('#sku'), sku); await fill(d.locator('#name'), `${TAG} ${key}`);
    if (await d.locator('#category').count()) await fill(d.locator('#category'), 'QA');
    await fill(d.locator('#quantity'), 2); await fill(d.locator('#cost'), 10); await fill(d.locator('#price'), 23);
    await d.getByRole('button', { name: /إضافة إكسسوار/ }).click(); await sleep(2000);
    const row = (await api(E, `accessories?merchant_id=eq.${mid}&sku=eq.${sku}&select=id`))[0];
    if (row) track('row', row.id);
    return { status: row ? 'PASS' : 'FAIL', detail: '' };
  });
  let inv = null;
  await step(s, 'pos', 'sell it by card', async () => {
    await open(s, '/pos');
    const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await fill(scan, sku); await scan.press('Enter'); await sleep(1500);
    await setCustomer(page);
    await page.getByRole('button', { name: /إتمام البيع/ }).click();
    const d = dialog(page);
    await d.getByRole('button', { name: /مدى والبطاقات/ }).first().click();
    await clearToasts(page);
    await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click();
    const t = await toast(page, 15000);
    inv = (t.match(/INV-[\d-]+/) || [])[0];
    await page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
    const sale = inv && (await api(E, `sales?invoice_number=eq.${inv}&select=id,total_amount,tax_amount,payment_method`))[0];
    if (sale) track('row', sale.id);
    return { status: sale && Number(sale.total_amount) === 23 ? 'PASS' : 'FAIL', detail: `"${t}"; total ${sale?.total_amount} vat ${sale?.tax_amount} method ${sale?.payment_method}` };
  });
  await step(s, 'pos', 'delete that invoice (owner)', async () => {
    if (!inv) return { status: 'BLOCKED', detail: 'no invoice' };
    await open(s, '/pos?tab=history');
    await fill(page.getByPlaceholder(/ابحث برقم الفاتورة/), inv); await sleep(1500);
    await page.getByRole('button', { name: 'حذف', exact: true }).first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'حذف' }).click(); await sleep(2000);
    return { status: (await api(E, `sales?invoice_number=eq.${inv}&select=id`)).length ? 'FAIL' : 'PASS', detail: '' };
  });
  await step(s, 'inventory', 'delete the test accessory', async () => {
    await open(s, '/products?tab=inventory');
    await page.getByRole('button', { name: /^الإكسسوارات/ }).first().click().catch(() => {});
    await fill(page.getByPlaceholder(/ابحث في المخزون/), sku); await sleep(1200);
    await page.locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)').first().click();
    await page.getByRole('menuitem', { name: 'حذف' }).click(); await sleep(2000);
    return { status: (await api(E, `accessories?sku=eq.${sku}&select=id`)).length ? 'FAIL' : 'PASS', detail: 'deleted with no confirmation' };
  });
  await s.ctx.close();
}


// ---------- cleanup: delete every row this run created (by id; ids are random uuids) ----------
async function cleanup() {
  const ids = [...created];
  const owners = [ACC.distributor, ACC.enterprise, ACC.basic];
  const children = [['sale_items', 'sale_id'], ['online_order_items', 'order_id'], ['stock_transfer_items', 'transfer_id'],
    ['loyalty_transactions', 'customer_id'], ['loyalty_transactions', 'sale_id'], ['stocktake_items', 'stocktake_id'], ['repair_order_parts', 'repair_order_id']];
  const tables = ['sales', 'online_orders', 'stock_transfers', 'stocktakes', 'repair_orders', 'coupons', 'customers', 'suppliers', 'devices', 'accessories'];
  const del = async (email, q) => {
    const t = (await token(email)).access_token;
    const r = await fetch(`${SUPA}/rest/v1/${q}`, { method: 'DELETE', headers: { apikey: ANON, Authorization: `Bearer ${t}`, Prefer: 'return=representation' } });
    const x = await r.text(); let j = []; try { j = JSON.parse(x); } catch { /* */ }
    return { status: r.status, n: Array.isArray(j) ? j.length : 0, err: r.status >= 300 ? x.slice(0, 120) : '' };
  };
  const done = {}; const failed = [];
  for (const id of ids) for (const e of owners) for (const [t, c] of children) {
    const r = await del(e, `${t}?${c}=eq.${id}`); if (r.n) done[t] = (done[t] || 0) + r.n;
  }
  const left = [];
  for (const id of ids) {
    let gone = false;
    for (const e of owners) for (const t of tables) {
      if (gone) break;
      const r = await del(e, `${t}?id=eq.${id}`);
      if (r.n) { done[t] = (done[t] || 0) + r.n; gone = true; }
      else if (r.err && !/PGRST|42703|22P02/.test(r.err)) failed.push(`${t}:${r.err}`);
    }
    if (!gone) left.push(id);
  }
  // what is still there, by table (could not be deleted by the shop owner)
  const remains = [];
  for (const id of left) for (const e of owners) for (const t of tables) {
    const x = await api(e, `${t}?id=eq.${id}&select=id`);
    if (Array.isArray(x) && x.length) remains.push(`${t}:${id}`);
  }
  console.log(`CLEANUP deleted ${JSON.stringify(done)} remaining ${JSON.stringify([...new Set(remains)])} errors ${JSON.stringify([...new Set(failed)].slice(0, 5))}`);
  // tagged rows anywhere in the three shops, whatever made them
  for (const e of owners) for (const [t, col] of [['accessories', 'name'], ['devices', 'model'], ['customers', 'name'], ['suppliers', 'name'], ['coupons', 'name'], ['repair_orders', 'customer_name'], ['sales', 'customer_name'], ['online_orders', 'customer_name']]) {
    const x = await api(e, `${t}?${col}=ilike.*${TAG}*&select=id`);
    if (Array.isArray(x) && x.length) console.log(`LEFTOVER ${e} ${t} ${x.length} ${x.map(r => r.id).join(',')}`);
  }
}

// ---------- run ----------
const browser = await launch();
const matrices = {};
try {
  if (want('auth')) await authTests(browser);
  if (want('owner')) await ownerJourneys(browser);
  if (want('cashier')) await cashierJourneys(browser);
  if (want('employee')) await employeeTask(browser);
  if (want('plans')) { await planSale(browser, 'enterprise'); await planSale(browser, 'basic'); }
  if (want('pages')) for (const k of ['distributor', 'admin', 'cashier', 'enterprise', 'basic']) matrices[k] = await rolePages(browser, k);
  if (want('mobile')) {
    matrices['distributor-390'] = await rolePages(browser, 'distributor', { mobile: true });
    matrices['cashier-390'] = await rolePages(browser, 'cashier', { mobile: true, list: ['/pos', '/pos?tab=history', '/sales?tab=closings', '/sales?tab=repairs'] });
  }
  if (want('mobile')) {
    const v = await newSession(browser, 'visitor-390', { mobile: true });
    await v.page.addInitScript(() => { try { localStorage.setItem('language', 'ar'); } catch {} });
    for (const p of ['/store/alanam-max', '/store/alanam-max/products', '/store/alanam-max/cart', '/store/alanam-max/checkout', '/store/alanam-max/track']) {
      await step(v, 'store-mobile', p, async () => {
        await open(v, p);
        const ov = await overflowX(v.page);
        return { status: ov > 4 ? 'FAIL' : 'PASS', detail: `overflow ${ov}px` };
      });
    }
    await v.ctx.close();
  }
} finally {
  if (process.env.NO_CLEANUP !== '1') await cleanup().catch(e => console.log('CLEANUP error ' + e.message));
  fs.writeFileSync('matrices.json', JSON.stringify(matrices, null, 1));
  finish();
  await browser.close();
}
