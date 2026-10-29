// One-off: re-test the fixed QA findings on a build of this branch (SITE =
// local preview) against the live database, demo shops only, test data tagged
// QA1028 (write guard in qa-core.mjs), then clean up. Also checks the live
// site and the old public code 70035.
import { SITE, SUPA, ANON, TAG, PW, launch, newSession, step, rec, finish, bodyText, created, track } from './qa-core.mjs';

const LIVE = 'https://wasel-alpha.vercel.app';
const OWNER = 'demo-distributor@wasil.demo', CASHIER = 'demo-cashier@wasil.demo';
const RUN = String(Date.now()).slice(-5);
const SKU = `QA1028-${RUN}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tokens = {};
async function token(email) {
  if (tokens[email]) return tokens[email];
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  return (tokens[email] = await r.json());
}
async function api(email, q, init = {}) {
  const t = (await token(email)).access_token;
  const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { apikey: ANON, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } });
  const x = await r.text(); let j; try { j = JSON.parse(x); } catch { j = x; }
  return init.method ? { status: r.status, body: j } : j;
}
async function settle(page, max = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    if (!(await page.locator('text=/جارٍ التحميل|جاري التحميل/').count()) && !(await page.locator('.animate-spin').count())) break;
    await sleep(300);
  }
  await sleep(500);
}
async function open(s, path) { await s.page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }); await settle(s.page); }
const dialog = page => page.locator('[role="dialog"], [role="alertdialog"]').last();
const fill = async (loc, v) => { await loc.click({ timeout: 8000 }); await loc.fill(String(v)); };
async function toast(page, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const got = await page.evaluate(() => (window.__qaToasts || []).filter(x => x.at >= (window.__qaMark || 0)).map(x => x.text)).catch(() => []);
    if (got.length) { await sleep(300); return (await page.evaluate(() => (window.__qaToasts || []).filter(x => x.at >= (window.__qaMark || 0)).map(x => x.text))).join(' | '); }
    await sleep(250);
  }
  return '';
}
const mark = page => page.evaluate(() => { window.__qaMark = Date.now(); }).catch(() => {});
async function login(s, email) {
  await s.page.addInitScript(() => { try { localStorage.setItem('language', 'ar'); } catch {} });
  await s.page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await settle(s.page);
  await s.page.getByRole('tab', { name: 'دخول بالإيميل' }).click();
  await fill(s.page.locator('#email'), email); await fill(s.page.locator('#password'), PW);
  await s.page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await s.page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }); await settle(s.page);
}
async function setCustomer(page) {
  await page.getByRole('button', { name: /^عميل|عميل$/ }).first().click().catch(() => {});
  if (await dialog(page).isVisible().catch(() => false)) {
    await fill(page.getByPlaceholder('اسم العميل'), `${TAG} زبون`);
    await dialog(page).getByRole('button', { name: 'تم' }).click(); await sleep(300);
  }
}
async function startSale(page, query) {
  const scan = page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
  await fill(scan, query); await scan.press('Enter'); await sleep(1500);
  await setCustomer(page);
  await page.getByRole('button', { name: /إتمام البيع/ }).click();
  const d = dialog(page);
  await d.getByRole('button', { name: /كاش/ }).first().click();
  const amt = d.locator('input[type="number"]').last();
  if (await amt.count()) await fill(amt, 500);
  return d;
}
const taggedSalesSince = async (email, since) => api(email, `sales?customer_name=ilike.*${TAG}*&created_at=gte.${since}&select=id,invoice_number,total_amount,sold_by&order=created_at.desc`);

const browser = await launch();
try {
  // ---------- 1. the old public code ----------
  const pub = await newSession(browser, 'public');
  await step(pub, 'login-code', 'code 70035 no longer signs in (server)', async () => {
    const r = await fetch(`${SUPA}/functions/v1/login-by-code`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '70035' }) });
    const b = await r.text();
    const session = /access_token/.test(b);
    return { status: session ? 'FAIL' : 'PASS', detail: `HTTP ${r.status} ${b.slice(0, 120)}` };
  });
  for (const site of [LIVE, SITE]) {
    await step(pub, 'login-code', `login page shows no login code (${site === LIVE ? 'live site' : 'this build'})`, async () => {
      await pub.page.goto(`${site}/auth`, { waitUntil: 'domcontentloaded' }); await settle(pub.page);
      const t = await bodyText(pub.page);
      const code = t.match(/\b\d{5}\b/);
      return { status: code || /كاشير تجريبي/.test(t) ? 'FAIL' : 'PASS', detail: code ? `found ${code[0]}` : 'no 5-digit code, no «كاشير تجريبي» button' };
    });
  }
  await step(pub, 'login-code', 'entering 70035 on the login page is refused', async () => {
    await pub.page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await settle(pub.page);
    await pub.page.getByRole('tab', { name: 'دخول بالكود' }).click();
    await pub.page.locator('input').first().click(); await pub.page.keyboard.type('70035');
    await pub.page.getByRole('button', { name: 'دخول', exact: true }).click(); await sleep(3500);
    const stayed = new URL(pub.page.url()).pathname.startsWith('/auth');
    return { status: stayed ? 'PASS' : 'FAIL', detail: `${new URL(pub.page.url()).pathname} — ${(await bodyText(pub.page)).match(/كود الدخول غير صحيح|حدث خطأ[^.]*/)?.[0] || ''}` };
  });
  await pub.ctx.close();

  // ---------- 2. owner: edit price, supplier confirm, till failures ----------
  const o = await newSession(browser, 'owner', { allow: { rpc: () => false } });
  const mid = (await api(OWNER, `merchant_users?user_id=eq.${(await token(OWNER)).user.id}&select=merchant_id`))[0].merchant_id;
  await step(o, 'login', 'owner signs in on this build', async () => { await login(o, OWNER); return o.page.url(); });
  const NAME = `${TAG} سماعة ${RUN}`;
  await step(o, 'inventory', 'add a test accessory (qty 5, price 115)', async () => {
    await open(o, '/products?tab=inventory');
    await o.page.getByRole('button', { name: /^إضافة$/ }).first().click();
    await o.page.getByRole('menuitem', { name: /إضافة إكسسوار/ }).click();
    const d = dialog(o.page);
    await fill(d.locator('#sku'), SKU); await fill(d.locator('#name'), NAME);
    if (await d.locator('#category').count()) await fill(d.locator('#category'), 'QA');
    await fill(d.locator('#quantity'), 5); await fill(d.locator('#cost'), 50); await fill(d.locator('#price'), 115);
    await mark(o.page); await d.locator('button[type="submit"]').last().click();
    const t = await toast(o.page); await sleep(1200);
    const row = (await api(OWNER, `accessories?merchant_id=eq.${mid}&sku=eq.${SKU}&select=id,price`))[0];
    if (row) track('accessories', row.id);
    return { status: row ? 'PASS' : 'FAIL', detail: `toast «${t}»` };
  });
  const openEdit = async () => {
    await open(o, '/products?tab=inventory&sub=accessories');
    await fill(o.page.getByPlaceholder(/ابحث في المخزون/), SKU); await sleep(1200);
    await o.page.locator('main button:has(svg.lucide-more-horizontal), main button:has(svg.lucide-ellipsis)').first().click();
    await o.page.getByRole('menuitem', { name: 'تعديل' }).click(); await sleep(500);
    return dialog(o.page);
  };
  await step(o, 'inventory', 'edit dialog opens filled with the accessory', async () => {
    const d = await openEdit();
    const v = { sku: await d.locator('#sku').inputValue(), name: await d.locator('#name').inputValue(), price: await d.locator('#price').inputValue(), qty: await d.locator('#quantity').inputValue() };
    await o.page.keyboard.press('Escape');
    return { status: v.sku === SKU && v.price === '115' && v.qty === '5' ? 'PASS' : 'FAIL', detail: JSON.stringify(v) };
  });
  await step(o, 'inventory', 'a failed save says why and keeps the dialog; nothing changes', async () => {
    const d = await openEdit();
    await fill(d.locator('#price'), 999);
    await o.page.route(/\/rest\/v1\/accessories\?/, r => r.request().method() === 'PATCH' ? r.abort('internetdisconnected') : r.fallback());
    await mark(o.page); await d.locator('button[type="submit"]').last().click();
    const t = await toast(o.page); await sleep(800);
    const stillOpen = await d.isVisible().catch(() => false);
    await o.page.unroute(/\/rest\/v1\/accessories\?/);
    await o.page.keyboard.press('Escape');
    const p = (await api(OWNER, `accessories?sku=eq.${SKU}&select=price`))[0]?.price;
    return { status: /تعذّر الاتصال بالخادم/.test(t) && !/TypeError/.test(t) && stillOpen && Number(p) === 115 ? 'PASS' : 'FAIL', detail: `toast «${t}»; dialog open: ${stillOpen}; saved price ${p}` };
  });
  await step(o, 'inventory', 'edit price to 120: saved, confirmed, still 120 after reload', async () => {
    const d = await openEdit();
    await fill(d.locator('#price'), 120);
    await mark(o.page); await d.locator('button[type="submit"]').last().click();
    const t = await toast(o.page); await sleep(1200);
    const p = (await api(OWNER, `accessories?sku=eq.${SKU}&select=price`))[0]?.price;
    await o.page.reload(); await settle(o.page);
    const d2 = await openEdit(); const shown = await d2.locator('#price').inputValue(); await o.page.keyboard.press('Escape');
    return { status: Number(p) === 120 && shown === '120' && /تم حفظ تعديلات الإكسسوار/.test(t) ? 'PASS' : 'FAIL', detail: `toast «${t}»; saved ${p}; shown after reload ${shown}` };
  });

  const SUP = `${TAG} مورد ${RUN}`;
  await step(o, 'suppliers', 'removing a supplier asks first; cancel keeps it, confirm removes it', async () => {
    await open(o, '/products?tab=suppliers');
    await o.page.getByRole('button', { name: /إضافة مورد|أضف أول مورد/ }).first().click();
    await fill(dialog(o.page).locator('input').nth(0), SUP);
    await dialog(o.page).getByRole('button', { name: /^إضافة$/ }).click(); await sleep(1500);
    const row = (await api(OWNER, `suppliers?merchant_id=eq.${mid}&name=eq.${encodeURIComponent(SUP)}&select=id`))[0];
    if (!row) throw new Error('supplier not added');
    track('suppliers', row.id);
    await fill(o.page.getByPlaceholder(/بحث عن مورد/), RUN); await sleep(1000);
    const menu = () => o.page.locator('main button:has(svg.lucide-more-horizontal), main button:has(svg.lucide-ellipsis)').first();
    await menu().click(); await o.page.getByRole('menuitem', { name: 'حذف' }).click(); await sleep(600);
    const ask = await o.page.getByRole('alertdialog').innerText().catch(() => '');
    await o.page.getByRole('alertdialog').getByRole('button', { name: 'إلغاء' }).click(); await sleep(1000);
    const a1 = (await api(OWNER, `suppliers?id=eq.${row.id}&select=is_active`))[0]?.is_active;
    await menu().click(); await o.page.getByRole('menuitem', { name: 'حذف' }).click(); await sleep(600);
    await o.page.getByRole('alertdialog').getByRole('button', { name: 'إزالة المورد' }).click(); await sleep(1500);
    const a2 = (await api(OWNER, `suppliers?id=eq.${row.id}&select=is_active`))[0]?.is_active;
    return { status: ask && a1 === true && a2 === false ? 'PASS' : 'FAIL', detail: `asked: «${ask.replace(/\s+/g, ' ').slice(0, 140)}»; after cancel active=${a1}; after confirm active=${a2}` };
  });

  await step(o, 'pos', 'a normal sale still works: invoice shown, time', async () => {
    const since = new Date(Date.now() - 5000).toISOString();
    await open(o, '/pos'); const d = await startSale(o.page, SKU);
    await mark(o.page); const t0 = Date.now();
    await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click();
    const t = await toast(o.page, 15000); const ms = Date.now() - t0; await sleep(1500);
    const shown = /فاتورة ضريبية مبسطة/.test(await bodyText(o.page));
    await o.page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
    const made = await taggedSalesSince(OWNER, since); made.forEach(x => track('sales', x.id));
    return { status: made.length === 1 && shown && ms < 2500 ? 'PASS' : 'FAIL', detail: `«${t}» in ${ms}ms; invoice view shown: ${shown}; invoices made: ${made.length} ${made[0]?.invoice_number || ''}` };
  });
  await step(o, 'pos', 'connection lost while paying: Arabic message, no invoice', async () => {
    const since = new Date(Date.now() - 2000).toISOString();
    await open(o, '/pos'); const d = await startSale(o.page, SKU);
    o.offline = true; await o.ctx.setOffline(true);
    await mark(o.page); await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click().catch(() => {});
    const t = await toast(o.page, 8000);
    const busy = /جارٍ إتمام البيع/.test(await bodyText(o.page));
    o.offline = false; await o.ctx.setOffline(false); await sleep(2000);
    await o.page.keyboard.press('Escape').catch(() => {});
    const made = await taggedSalesSince(OWNER, since); made.forEach(x => track('sales', x.id));
    return { status: t && !/TypeError|Failed to fetch/.test(t) && /الاتصال/.test(t) && !made.length && !busy ? 'PASS' : 'FAIL', detail: `«${t}»; stuck: ${busy}; invoices made: ${made.length}` };
  });
  await step(o, 'pos', 'no invoice number from the server: the sale stops with a message', async () => {
    const since = new Date(Date.now() - 2000).toISOString();
    await open(o, '/pos'); const d = await startSale(o.page, SKU);
    await o.page.route(/\/rpc\/generate_invoice_number/, r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'simulated' }) }));
    await mark(o.page); await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click();
    const t = await toast(o.page, 8000); await sleep(1500);
    await o.page.unroute(/\/rpc\/generate_invoice_number/);
    await o.page.keyboard.press('Escape').catch(() => {});
    const made = await taggedSalesSince(OWNER, since); made.forEach(x => track('sales', x.id));
    return { status: /تعذّر إصدار رقم للفاتورة/.test(t) && !made.length ? 'PASS' : 'FAIL', detail: `«${t}»; invoices made: ${made.length} ${made.map(x => x.invoice_number).join(',')}` };
  });
  await o.ctx.close();

  // ---------- 3. cashier ----------
  const c = await newSession(browser, 'cashier');
  const me = (await token(CASHIER)).user.id;
  await step(c, 'login', 'cashier signs in on this build', async () => { await login(c, CASHIER); return new URL(c.page.url()).pathname; });
  const mu = (await api(CASHIER, `merchant_users?user_id=eq.${me}&select=role`))[0];
  rec('cashier', 'role', 'how the shop has the cashier role', 'NOTE', `merchant_users.role=${mu?.role}`);
  let saleId = null;
  await step(c, 'pos', 'cashier sells the test accessory', async () => {
    const since = new Date(Date.now() - 5000).toISOString();
    await open(c, '/pos'); const d = await startSale(c.page, SKU);
    await mark(c.page); await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click();
    const t = await toast(c.page, 15000); await sleep(1500);
    await c.page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click().catch(() => {});
    const made = await taggedSalesSince(CASHIER, since); made.forEach(x => track('sales', x.id));
    saleId = made[0]?.id;
    return { status: made.length === 1 ? 'PASS' : 'FAIL', detail: `«${t}»` };
  });
  await step(c, 'pos', 'history shows only the cashier\'s own invoices, no delete button', async () => {
    await open(c, '/pos?tab=history');
    const shown = [...new Set((await bodyText(c.page)).match(/INV-[\d-]+/g) || [])];
    const mine = new Set((await api(OWNER, `sales?sold_by=eq.${me}&select=invoice_number`)).map(x => x.invoice_number));
    const others = shown.filter(x => !mine.has(x));
    const del = await c.page.getByRole('button', { name: 'حذف', exact: true }).count();
    return { status: !others.length && !del ? 'PASS' : 'FAIL', detail: `${shown.length} shown, ${others.length} by others; delete buttons: ${del}` };
  });
  await step(c, 'pos', 'edit dialog: discount and payment locked, name still editable', async () => {
    const inv = (await api(OWNER, `sales?id=eq.${saleId}&select=invoice_number,total_amount`))[0];
    await fill(c.page.getByPlaceholder(/ابحث برقم الفاتورة/), inv.invoice_number); await sleep(1200);
    await c.page.getByRole('button', { name: 'تعديل', exact: true }).first().click();
    const d = dialog(c.page);
    const discDisabled = await d.locator('input[type="number"]').first().isDisabled();
    const payDisabled = await d.getByRole('combobox').first().isDisabled().catch(() => null);
    await fill(d.locator('input').first(), `${TAG} زبون معدّل`);
    await mark(c.page); await d.getByRole('button', { name: 'حفظ' }).click(); const t = await toast(c.page); await sleep(1200);
    const after = (await api(OWNER, `sales?id=eq.${saleId}&select=customer_name,total_amount,discount_amount`))[0];
    return { status: discDisabled && payDisabled && after.customer_name.includes('معدّل') && Number(after.total_amount) === Number(inv.total_amount) ? 'PASS' : 'FAIL',
      detail: `discount locked ${discDisabled}, payment locked ${payDisabled}; «${t}»; after: ${JSON.stringify(after)}` };
  });
  await step(c, 'server', 'cashier sets a 100% discount through the API (server-side rule)', async () => {
    const before = (await api(OWNER, `sales?id=eq.${saleId}&select=total_amount`))[0];
    const r = await api(CASHIER, `sales?id=eq.${saleId}`, { method: 'PATCH', body: JSON.stringify({ discount_amount: before.total_amount, total_amount: 0, subtotal: 0, tax_amount: 0 }) });
    const after = (await api(OWNER, `sales?id=eq.${saleId}&select=total_amount`))[0];
    if (Number(after.total_amount) !== Number(before.total_amount)) {
      // put the test invoice back as it was sold (owner), then report
      await api(OWNER, `sales?id=eq.${saleId}`, { method: 'PATCH', body: JSON.stringify({ discount_amount: 0, total_amount: before.total_amount, subtotal: +(before.total_amount / 1.15).toFixed(2), tax_amount: +(before.total_amount - before.total_amount / 1.15).toFixed(2) }) });
      return { status: 'FAIL', detail: `the database still accepts it (HTTP ${r.status}, total → ${after.total_amount}); closed by migration 20261029090100, not applied yet` };
    }
    return { status: 'PASS', detail: `refused: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}` };
  });
  for (const p of ['/reports', '/', '/settings?tab=general']) {
    await step(c, 'access', `cashier opening ${p} is moved to the till`, async () => {
      await open(c, p); const u = new URL(c.page.url()).pathname;
      return { status: u.startsWith('/pos') ? 'PASS' : 'FAIL', detail: `→ ${u}` };
    });
  }
  await c.ctx.close();

  // ---------- 4. storefront as a visitor ----------
  const v = await newSession(browser, 'visitor');
  await step(v, 'store', 'visitor sees products in the store', async () => {
    const pd = await fetch(`${SUPA}/rest/v1/public_store_devices?merchant_id=eq.${mid}&select=id`, { headers: { apikey: ANON } }).then(r => r.json());
    const pa = await fetch(`${SUPA}/rest/v1/public_store_accessories?merchant_id=eq.${mid}&select=id`, { headers: { apikey: ANON } }).then(r => r.json());
    await v.page.goto(`${SITE}/store/alanam-max/products`, { waitUntil: 'domcontentloaded' }); await settle(v.page);
    const n = (await bodyText(v.page)).match(/(\d+) منتج/)?.[1];
    return { status: Number(n) > 0 ? 'PASS' : 'FAIL', detail: `page shows ${n} products; public views give ${pd.length} devices, ${pa.length} accessories (fixed by migration 20261029090200, not applied yet)` };
  });
  await v.ctx.close();
} finally {
  // cleanup: every row this run made, by id (owner)
  const done = {};
  for (const id of created) {
    for (const [t, col] of [['sale_items', 'sale_id']]) await api(OWNER, `${t}?${col}=eq.${id}`, { method: 'DELETE' });
    for (const t of ['sales', 'suppliers', 'accessories']) {
      const r = await api(OWNER, `${t}?id=eq.${id}`, { method: 'DELETE' });
      if (Array.isArray(r.body) && r.body.length) done[t] = (done[t] || 0) + r.body.length;
    }
  }
  for (const [t, col] of [['accessories', 'name'], ['suppliers', 'name'], ['sales', 'customer_name']]) {
    const x = await api(OWNER, `${t}?${col}=ilike.*${TAG}*&select=id`);
    if (Array.isArray(x) && x.length) console.log(`LEFTOVER ${t} ${x.map(r => r.id).join(',')}`);
  }
  console.log(`CLEANUP deleted ${JSON.stringify(done)}`);
  finish();
  await browser.close();
}
