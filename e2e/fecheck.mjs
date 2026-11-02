// One-off live check of a build of claude/frontend-regression-fixes, READ-ONLY:
// every non-GET REST/functions request is aborted or answered inside the browser.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const ANON = process.env.ANON;
const PW = 'demo1234';
const READ_RPCS = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin',
  'get_public_merchant_legal', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/\s+/g, ' ').slice(0, 1200)}`);
async function step(name, fn) { try { out(name, await fn()); } catch (e) { out(name, 'ERROR ' + e.message.slice(0, 300)); } }
const E = { cashier: 'demo-cashier@wasil.demo', employee: 'demo-employee@wasil.demo', owner: 'demo-distributor@wasil.demo', lite: 'demo-basic@wasil.demo' };
async function apiToken(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  return r.json();
}
const browser = await chromium.launch({ channel: 'chrome' });
async function session(email, preMode = null) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  const s = { page, ctx, reqs: [], mode: preMode, writeMode: 'abort' };
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
    s.reqs.push(`${m} ${decodeURIComponent(u.replace(SUPA, '')).slice(0, 300)}`);
    if (s.mode) { try { if (await s.mode(route, req, u, m)) return; } catch { return; } }
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (fn && READ_RPCS.has(fn)) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-0001"' });
    if (/\/rest\/v1\/sales/.test(u) && m === 'POST') {
      if (s.writeMode === 'server') { await sleep(800); return route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"PGRST500","message":"Internal Server Error"}' }); }
      if (s.writeMode === 'invalid') return route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"23514","message":"new row for relation \\"sales\\" violates check constraint"}' });
      if (s.writeMode === 'offline') { await sleep(800); return route.abort('internetdisconnected'); }
    }
    return route.abort('blockedbyclient');
  });
  await page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await page.locator('#email').fill(email); await page.locator('#password').fill(PW);
  await page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }); await sleep(3500);
  return s;
}
const text = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
const toasts = p => p.evaluate(() => window.__t.join(' | ')).catch(() => '');
async function open(s, path) {
  await s.page.evaluate(() => { window.__t = []; }).catch(() => {});
  await s.page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const u = new URL(s.page.url()); return { url: u.pathname + u.search, text: await text(s.page), toasts: await toasts(s.page) };
}

// ---- 1, 6 · cashier
const c = await session(E.cashier);
await step('1.cashier./reports', async () => { const r = await open(c, '/reports'); return { url: r.url, toast: r.toasts, totalsShown: /إجمالي المبيعات/.test(r.text) }; });
await step('1.cashier.history', async () => {
  c.reqs.length = 0; const r = await open(c, '/pos?tab=history');
  return { url: r.url, deleteButtons: await c.page.getByRole('button', { name: 'حذف', exact: true }).count(),
    salesRequests: c.reqs.filter(x => /\/rest\/v1\/sales\?/.test(x)).map(x => (x.match(/sold_by=[^&]*/) || ['NO sold_by'])[0]) };
});
await step('1.cashier.search', async () => {
  await open(c, '/pos'); c.reqs.length = 0;
  const box = c.page.getByPlaceholder(/ابحث عن أجهزة/).first();
  await box.click(); await box.fill('INV'); await sleep(3000);
  return { salesSearch: c.reqs.filter(x => /\/rest\/v1\/sales\?/.test(x)).map(x => (x.match(/sold_by=[^&]*/) || ['NO sold_by'])[0]) };
});
// ---- 9 · sale errors (cart kept, double press, messages)
async function trySale(mode, double = false) {
  c.writeMode = mode;
  await c.page.evaluate(() => { window.__t = []; });
  const before = c.reqs.filter(x => /^POST \/rest\/v1\/sales/.test(x)).length;
  await c.page.getByRole('button', { name: /إتمام البيع/ }).click({ timeout: 8000 });
  const d = c.page.getByRole('dialog');
  await d.getByRole('button', { name: /كاش/ }).first().click().catch(() => {});
  const amt = d.locator('input[type="number"]').last(); if (await amt.count()) await amt.fill('300');
  const btn = d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ });
  if (double) await Promise.all([btn.click(), btn.click({ delay: 30 }).catch(() => {}), btn.click({ delay: 60 }).catch(() => {})]);
  else await btn.click();
  await sleep(3500);
  const t = await toasts(c.page);
  const posts = c.reqs.filter(x => /^POST \/rest\/v1\/sales/.test(x)).length - before;
  await c.page.keyboard.press('Escape').catch(() => {}); await sleep(600);
  const cartKept = /السلة الحالية/.test(await text(c.page)) && !/السلة فارغة/.test(await text(c.page));
  return { message: t, salePosts: posts, successShown: /تمت عملية البيع/.test(t), cartKept };
}
await step('9.setup-cart', async () => {
  c.reqs.length = 0; await open(c, '/pos');
  const scan = c.page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
  await scan.click(); await scan.fill('ACC-004'); await scan.press('Enter'); await sleep(1500);
  await c.page.locator('button:has(svg.lucide-plus)').first().click().catch(() => {}); await sleep(600);
  return { cart: ((await text(c.page)).match(/السلة الحالية.{0,120}/) || [''])[0] };
});
await step('9.offline+double-press', () => trySale('offline', true));
await step('9.server-error', () => trySale('server'));
await step('9.invalid-data', () => trySale('invalid'));
await c.ctx.close();

// ---- 1, 6 · employee
const e = await session(E.employee);
await step('1.employee./reports', async () => { const r = await open(e, '/reports'); return { url: r.url, toast: r.toasts, totalsShown: /إجمالي المبيعات/.test(r.text) }; });
await step('6.employee./settings', async () => { const r = await open(e, '/settings?tab=general'); return { url: r.url, toast: r.toasts }; });
await e.ctx.close();

// ---- 4, 6 · Lite wholesale
const b = await session(E.lite);
await step('4.lite.menu', async () => { await open(b, '/sales'); return { wholesaleInMenu: await b.page.getByText('بيع الجملة', { exact: true }).count() }; });
await step('4.lite.direct-link', async () => { const r = await open(b, '/sales?tab=wholesale'); return { url: r.url, toast: r.toasts, wholesaleShown: /السوق، منتجاتك|سوق الجملة/.test(r.text) }; });
await step('4.lite.old-link', async () => { const r = await open(b, '/wholesale'); return { url: r.url, toast: r.toasts }; });
await b.ctx.close();

// ---- 3 · permissions / subscription failures
await step('3.owner-404-notice', async () => { const o = await session(E.owner); const t = await toasts(o.page); await o.ctx.close(); return { toastsAfterLogin: t }; });
await step('3.custom-role-server-failure', async () => {
  const s = await session(E.employee, async (route, req, u) => { if (/rpc\/(my_permissions|get_subscription_state)/.test(u)) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"PGRST500","message":"Internal Server Error"}' }); return true; } });
  const t1 = await toasts(s.page); const r = await open(s, '/sales?tab=orders');
  await s.ctx.close(); return { toastsAfterLogin: t1, ordersPage: { url: r.url, toast: r.toasts } };
});

// ---- 7 · shipping page (manual) and a refused save
await step('7.shipping-page', async () => {
  const o = await session(E.owner); const r = await open(o, '/shipping');
  let saveMsg = null;
  try {
    await o.page.getByRole('button', { name: 'شركات الشحن' }).click(); await sleep(1500);
    o.mode = async (route, req, u, m) => { if (m !== 'GET' && /store_pages/.test(u)) { await route.abort('internetdisconnected'); return true; } };
    await o.page.evaluate(() => { window.__t = []; });
    await o.page.getByRole('button', { name: /حفظ شركات الشحن/ }).click({ timeout: 5000 }); await sleep(2500);
    saveMsg = await toasts(o.page);
  } catch (err) { saveMsg = 'n/a ' + err.message.slice(0, 80); }
  await o.ctx.close();
  return { url: r.url, tabs: /الشحنات.*شركات الشحن/.test(r.text), offlineSaveMessage: saveMsg };
});
await browser.close();
