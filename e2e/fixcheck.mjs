// One-off live check (READ-ONLY): a build of claude/fix-qa-findings (F) and the live site (L),
// both on the production database. Every write leaves the browser only as an abort:
// non-GET REST calls are blocked, except read-only RPCs; the invoice number is answered
// locally. Removed after the run.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const SITES = { F: 'http://localhost:4173', L: 'https://wasel-alpha.vercel.app' };
const PW = 'demo1234';
const READ_RPCS = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin',
  'get_public_merchant_legal', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission',
  'day_sales_summary']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/\s+/g, ' ').slice(0, 900)}`);
const browser = await chromium.launch({ channel: 'chrome' });

async function session(site, email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  const s = { page, ctx, blocked: [], reqs: [], mode: null };
  await page.addInitScript(() => {
    window.__t = []; const seen = new WeakSet();
    new MutationObserver(() => document.querySelectorAll('[data-sonner-toast], li[role="status"]').forEach(el => {
      if (seen.has(el)) return; seen.add(el);
      setTimeout(() => window.__t.push((el.innerText || '').replace(/\s+/g, ' ').trim()), 60);
    })).observe(document, { childList: true, subtree: true });
    try { localStorage.setItem('language', 'ar'); } catch {}
  });
  await page.route(/supabase\.co\//, async route => {
    const req = route.request(); const m = req.method(); const u = req.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    s.reqs.push(`${m} ${u.replace(SUPA, '').slice(0, 160)}`);
    const rpc = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (s.mode) { const r = await s.mode(route, req, u, m); if (r !== undefined) return; }
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (rpc && READ_RPCS.has(rpc)) return route.continue();
    if (rpc === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-0001"' });
    s.blocked.push(`${m} ${u.replace(SUPA, '').split('?')[0]}`);
    return route.abort(s.offlineWrites ? 'internetdisconnected' : 'blockedbyclient');
  });
  await page.goto(`${site}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await page.locator('#email').fill(email); await page.locator('#password').fill(PW);
  await page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }); await sleep(3000);
  return s;
}
const text = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
const toasts = page => page.evaluate(() => window.__t.join(' | ')).catch(() => '');
async function open(s, site, path) {
  await s.page.evaluate(() => { window.__t = []; }).catch(() => {});
  await s.page.goto(`${site}${path}`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const u = new URL(s.page.url()); return { url: u.pathname + u.search, text: await text(s.page), toasts: await toasts(s.page) };
}
async function step(name, fn) { try { out(name, await fn()); } catch (e) { out(name, 'ERROR ' + e.message.slice(0, 300)); } }

for (const k of ['F', 'L']) {
  const site = SITES[k];
  // 1 · cashier and /reports, history
  const c = await session(site, 'demo-cashier@wasil.demo');
  await step(`${k}.cashier./reports`, async () => { const r = await open(c, site, '/reports'); return { url: r.url, toasts: r.toasts, reportsShown: /إجمالي المبيعات|التقارير والتحليلات/.test(r.text) }; });
  await step(`${k}.cashier./reports?tab=table-sales`, async () => { const r = await open(c, site, '/reports?tab=table-sales'); return { url: r.url, toasts: r.toasts }; });
  await step(`${k}.cashier.history-request`, async () => {
    c.reqs.length = 0; const r = await open(c, site, '/pos?tab=history');
    const q = c.reqs.filter(x => /\/rest\/v1\/sales\?/.test(x)).map(x => x.slice(0, 160));
    return { url: r.url, salesRequests: q, deleteButtons: await c.page.getByRole('button', { name: 'حذف', exact: true }).count() };
  });
  // 2 · offline sale (writes are aborted as a dropped connection; nothing reaches the server)
  await step(`${k}.cashier.offline-sale`, async () => {
    await open(c, site, '/pos');
    const scan = c.page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await scan.click(); await scan.fill('ACC-004'); await scan.press('Enter'); await sleep(1500);
    await c.page.locator('button:has(svg.lucide-plus)').first().click().catch(() => {}); await sleep(500);
    const tries = [];
    for (let i = 0; i < 2; i++) {
      await c.page.evaluate(() => { window.__t = []; });
      c.offlineWrites = true;
      await c.page.getByRole('button', { name: /إتمام البيع/ }).click({ timeout: 8000 });
      const d = c.page.getByRole('dialog');
      await d.getByRole('button', { name: /كاش/ }).first().click().catch(() => {});
      const amt = d.locator('input[type="number"]').last(); if (await amt.count()) await amt.fill('300');
      await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click({ timeout: 8000 });
      await sleep(4000);
      tries.push(await toasts(c.page));
      await c.page.keyboard.press('Escape').catch(() => {}); await sleep(500);
    }
    c.offlineWrites = false;
    return { tries, blockedWrites: c.blocked.slice(-6) };
  });
  // 3 · closing the day as the cashier (reads the day; nothing is closed)
  await step(`${k}.cashier.closings`, async () => {
    c.reqs.length = 0; const r = await open(c, site, '/sales?tab=closings');
    return { url: r.url, toasts: r.toasts, rpc: c.reqs.filter(x => /day_sales_summary|\/sales\?/.test(x)).map(x => x.slice(0, 90)), excerpt: r.text.slice(0, 400) };
  });
  await c.ctx.close();

  // 4 · Lite and wholesale
  const b = await session(site, 'demo-basic@wasil.demo');
  await step(`${k}.lite.wholesale`, async () => { const r = await open(b, site, '/sales?tab=wholesale'); return { url: r.url, toasts: r.toasts, wholesaleShown: /سوق الجملة|السوق، منتجاتك/.test(r.text) }; });
  await step(`${k}.lite.menu-wholesale`, async () => ({ menuHasWholesale: (await b.page.getByRole('link', { name: /بيع الجملة/ }).count()) + (await b.page.getByText('بيع الجملة', { exact: true }).count()) }));
  await b.ctx.close();

  // 5 · employee and reports
  const e = await session(site, 'demo-employee@wasil.demo');
  await step(`${k}.employee./reports`, async () => { const r = await open(e, site, '/reports'); return { url: r.url, toasts: r.toasts, leaves: (r.text.match(/(تفاصيل المبيعات|المبيعات|المخزون|الأجهزة|الموردون|العملاء)/g) || []).slice(0, 8) }; });
  await e.ctx.close();

  // 6 · KPI cards: slow, failing, empty (distributor owner, dashboard)
  const o = await session(site, 'demo-distributor@wasil.demo');
  const KPI_TABLES = /\/rest\/v1\/(sales|devices|accessories|sale_items|repair_orders|online_orders|customers)\?/;
  const kpi = async () => o.page.evaluate(() => ({
    loading: document.querySelectorAll('[role="status"][aria-label="جارٍ التحميل"]').length,
    failed: (document.body.innerText.match(/تعذّر تحميل القيمة/g) || []).length,
    ellipsis: /…/.test(document.querySelector('main')?.innerText || ''),
  }));
  await step(`${k}.kpi.slow`, async () => {
    o.mode = async (route, req, u, m) => { if (m === 'GET' && KPI_TABLES.test(u)) { await sleep(6000); return route.continue(); } };
    await o.page.goto(`${site}/`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
    const during = await kpi(); await sleep(9000); const after = await kpi();
    o.mode = null; return { during, after };
  });
  await step(`${k}.kpi.fail`, async () => {
    o.mode = async (route, req, u, m) => { if (m === 'GET' && KPI_TABLES.test(u)) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"qa"}' }); };
    await o.page.goto(`${site}/`, { waitUntil: 'domcontentloaded' }); await sleep(7000);
    const r = await kpi(); const banner = /تعذّر تحميل بيانات لوحة التحكم/.test(await text(o.page));
    o.mode = null; return { ...r, banner };
  });
  await step(`${k}.kpi.empty`, async () => {
    o.mode = async (route, req, u, m) => { if ((m === 'GET' || m === 'HEAD') && KPI_TABLES.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' }); };
    await o.page.goto(`${site}/`, { waitUntil: 'domcontentloaded' }); await sleep(7000);
    const r = await kpi(); const t = await text(o.page);
    o.mode = null; return { ...r, excerpt: (t.match(/(مبيعات اليوم|إجمالي).{0,300}/) || [''])[0] };
  });
  await o.ctx.close();
}
await browser.close();
