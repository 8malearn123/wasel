// One-off live check of a build of claude/frontend-regression-fixes, READ-ONLY:
// every non-GET REST/functions request is aborted or answered inside the browser.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const PW = 'demo1234';
const READ_RPCS = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin',
  'get_public_merchant_legal', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/\s+/g, ' ').slice(0, 1000)}`);
async function step(name, fn) { try { out(name, await fn()); } catch (e) { out(name, 'ERROR ' + e.message.slice(0, 200)); } }
const E = { cashier: 'demo-cashier@wasil.demo', owner: 'demo-distributor@wasil.demo', lite: 'demo-basic@wasil.demo' };
const browser = await chromium.launch({ channel: 'chrome' });

async function ctxPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  const s = { page, ctx, reqs: [], mode: null };
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
    if (s.mode) { try { if (await s.mode(route, req, u, m)) return; } catch { return; } }
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    s.reqs.push(`${m} ${decodeURIComponent(u.replace(SUPA, '')).slice(0, 200)}`);
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (fn && READ_RPCS.has(fn)) return route.continue();
    return route.abort('blockedbyclient');
  });
  return s;
}
async function login(s, email) {
  await s.page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await s.page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await s.page.locator('#email').fill(email); await s.page.locator('#password').fill(PW);
  await s.page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
}
const text = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
const toasts = p => p.evaluate(() => window.__t.join(' | ')).catch(() => '');
async function open(s, path) {
  await s.page.evaluate(() => { window.__t = []; }).catch(() => {});
  await s.page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const u = new URL(s.page.url()); return { url: u.pathname + u.search, text: await text(s.page), toasts: await toasts(s.page) };
}

// 2 · sign-in: connection failure while signing in
await step('2.login.network-failure', async () => {
  const s = await ctxPage();
  s.mode = async (route, req, u) => { if (/\/auth\/v1\/token/.test(u)) { await route.abort('internetdisconnected'); return true; } };
  await login(s, E.owner); await sleep(3000);
  const t = await text(s.page); await s.ctx.close();
  return { arabic: (t.match(/(تعذّر الاتصال بالخادم[^.]*\.)/) || ['—'])[0], english: /Failed to fetch/.test(t) };
});
await step('2.login.validation', async () => {
  const s = await ctxPage();
  await s.page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await s.page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await s.page.locator('#email').fill('not-an-email'); await s.page.locator('#password').fill('123');
  await s.page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click(); await sleep(1500);
  const t = await text(s.page); await s.ctx.close();
  return { message: (t.match(/(البريد الإلكتروني غير صحيح|كلمة المرور 6 أحرف على الأقل|Invalid email address|Password must be)/) || ['—'])[0] };
});
// 2 · the account's data cannot be read after sign-in → retry screen, then retry works
await step('2.member-data-failure-and-retry', async () => {
  const s = await ctxPage();
  let fail = true;
  s.mode = async (route, req, u, m) => { if (fail && m === 'GET' && /\/rest\/v1\/merchant_users\?/.test(u)) { await route.abort('internetdisconnected'); return true; } };
  await login(s, E.owner); await sleep(5000);
  const shown = await text(s.page);
  const screen = { message: (shown.match(/تعذّر تحميل بيانات حسابك[^.]*\./) || ['—'])[0], retryButton: await s.page.getByRole('button', { name: 'إعادة المحاولة' }).count() };
  fail = false;
  await s.page.getByRole('button', { name: 'إعادة المحاولة' }).click().catch(() => {}); await sleep(5000);
  const after = new URL(s.page.url()).pathname; const afterText = await text(s.page);
  await s.ctx.close();
  return { screen, afterRetry: { url: after, dashboardShown: /أجهزة في المخزون|مبيعات اليوم/.test(afterText), stillError: /تعذّر تحميل بيانات حسابك/.test(afterText) } };
});

// 1, 4 · regression of the earlier fixes
const c = await ctxPage(); await login(c, E.cashier); await sleep(4000);
await step('1.cashier./reports', async () => { const r = await open(c, '/reports'); return { url: r.url, toast: r.toasts }; });
await step('1.cashier.history', async () => { const r = await open(c, '/pos?tab=history'); return { deleteButtons: await c.page.getByRole('button', { name: 'حذف', exact: true }).count() }; });
await c.ctx.close();
const b = await ctxPage(); await login(b, E.lite); await sleep(4000);
await step('4.lite.wholesale', async () => { const r = await open(b, '/sales?tab=wholesale'); return { url: r.url, toast: r.toasts }; });
await step('4.lite.branches-over-limit', async () => { const r = await open(b, '/settings?tab=branches'); return { url: r.url, notice: (r.text.match(/عدد الفروع النشطة أكبر[^.]*\.[^.]*\./) || r.text.match(/تم الوصول للحد الأقصى[^.]*/) || ['—'])[0] }; });
await b.ctx.close();

// 5 · entry checks: a negative quantity never leaves the browser
const o = await ctxPage(); await login(o, E.owner); await sleep(4000);
await step('5.accessory-negative', async () => {
  await open(o, '/products?tab=inventory&sub=accessories');
  await o.page.getByRole('button', { name: /^إضافة$/ }).first().click(); await sleep(600);
  await o.page.getByRole('menuitem', { name: /إضافة إكسسوار/ }).click(); await sleep(800);
  const d = o.page.getByRole('dialog');
  await d.locator('#sku').fill('QA-NEG-1'); await d.locator('#name').fill('QA negative');
  await d.locator('#quantity').fill('-3'); await d.locator('#cost').fill('-10'); await d.locator('#price').fill('-20');
  await o.page.evaluate(() => { window.__t = []; }); o.reqs.length = 0;
  await d.locator('button[type="submit"]').click(); await sleep(2000);
  const native = await d.locator('#quantity').evaluate(el => el.validationMessage).catch(() => '');
  return { postsSent: o.reqs.filter(x => /^POST \/rest\/v1\/accessories/.test(x)).length, toast: await toasts(o.page), browserBlocked: native || null, dialogStillOpen: await d.isVisible() };
});
// 6 · shipping: a failed save keeps the dialog
await step('6.ship-failure-keeps-dialog', async () => {
  await o.page.keyboard.press('Escape').catch(() => {});
  await open(o, '/shipping');
  const btn = o.page.getByRole('button', { name: 'شحن الطلب' }).first();
  if (!(await btn.count())) return { skipped: 'no order waiting to ship' };
  await btn.click(); await sleep(800);
  const d = o.page.getByRole('dialog');
  const num = d.locator('input').last(); await num.fill('QA123456');
  o.mode = async (route, req, u, m) => { if (m !== 'GET' && /online_orders/.test(u)) { await route.abort('internetdisconnected'); return true; } };
  await o.page.evaluate(() => { window.__t = []; });
  await d.getByRole('button', { name: /شحن|تأكيد/ }).last().click(); await sleep(2500);
  o.mode = null;
  return { toast: await toasts(o.page), dialogStillOpen: await d.isVisible(), numberKept: await num.inputValue().catch(() => null) };
});
await o.ctx.close();
await browser.close();
