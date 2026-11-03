// One-off READ-ONLY crawl of a build of claude/frontend-regression-fixes against the live data.
// Every non-GET REST/functions/storage request is aborted inside the browser (read-only RPCs pass).
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const ANON = process.env.ANON;
const PW = 'demo1234';
const READ_RPCS = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin',
  'get_public_merchant_legal', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission',
  'get_store_by_slug', 'track_online_order']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/\s+/g, ' ').slice(0, 900)}`);

const LEAVES = {
  '/products': ['inventory', 'stocktake', 'transfers', 'suppliers', 'labels'],
  '/sales': ['orders', 'repairs', 'closings', 'store', 'seo', 'customers', 'marketing', 'wholesale'],
  '/team': ['employees', 'attendance', 'devices', 'payroll', 'users'],
  '/settings': ['general', 'notifications', 'policy'],
  '/organization': ['branches', 'support'],
  '/reports': ['sales', 'table-sales', 'inventory', 'table-devices', 'table-accessories', 'parts', 'deadstock', 'employees', 'table-suppliers', 'table-customers'],
  '/pos': ['pos', 'history'],
  '/shipping': ['shipments', 'carriers', 'insights'],
};
const MAIN = ['/', '/subscription', '/ai-insights', '/locked', '/no-such-page'];
const LEGACY = ['/inventory', '/stocktake', '/transfers', '/suppliers', '/purchases', '/labels', '/online-orders', '/repairs', '/daily-closings',
  '/online-store', '/store-seo', '/customers', '/marketing', '/wholesale', '/employees', '/attendance', '/devices', '/hr', '/users',
  '/notifications', '/business-policy', '/branches', '/support'];
const allPages = () => [...MAIN, ...Object.entries(LEAVES).flatMap(([p, ls]) => ls.map(l => `${p}?tab=${l}`))];

const browser = await chromium.launch({ channel: 'chrome' });
async function session(email, { mobile = false } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar-SA' }
    : { viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  const s = { page, ctx, console: [], net: [], blocked: [] };
  page.on('console', m => { if (m.type() === 'error') s.console.push(m.text().replace(/\s+/g, ' ').slice(0, 160)); });
  page.on('pageerror', e => s.console.push('PAGEERROR ' + e.message.slice(0, 160)));
  page.on('response', r => { const u = r.url(); if (u.includes('supabase.co') && r.status() >= 400) s.net.push(`${r.status()} ${r.request().method()} ${u.replace(SUPA, '').split('?')[0]}`); });
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
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (fn && READ_RPCS.has(fn)) return route.continue();
    s.blocked.push(`${m} ${u.replace(SUPA, '').split('?')[0]}`);
    return route.abort('blockedbyclient');
  });
  if (email) {
    await page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
    await page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
    await page.locator('#email').fill(email); await page.locator('#password').fill(PW);
    await page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
    await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {});
    await sleep(3000);
  }
  return s;
}
const TECH = /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|TypeError|Failed to fetch|violates|PGRST|row-level security|duplicate key|null value/;
async function visit(s, role, path, { wait = 6000 } = {}) {
  s.console.length = 0; s.net.length = 0; s.blocked.length = 0;
  await s.page.evaluate(() => { window.__t = []; }).catch(() => {});
  const t0 = Date.now();
  await s.page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(wait);
  const r = await s.page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const spinners = [...document.querySelectorAll('.animate-spin, [role="status"][aria-label="جارٍ التحميل"]')].filter(e => e.getBoundingClientRect().width > 0).length;
    return {
      url: location.pathname + location.search,
      textLen: (main.innerText || '').trim().length,
      spinners,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      text: (document.body.innerText || '').replace(/\s+/g, ' '),
      buttons: [...document.querySelectorAll('main button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 40),
    };
  }).catch(e => ({ url: 'ERR', textLen: 0, spinners: 0, overflowX: 0, text: e.message, buttons: [] }));
  const tech = (r.text.match(TECH) || [])[0] || null;
  const english = (r.text.match(/\b(Error|Loading\.\.\.|No data|Something went wrong|Submit|Cancel|Save|Delete|Edit)\b/) || [])[0] || null;
  out(`${role}|${path}`, {
    url: r.url, ms: Date.now() - t0, empty: r.textLen < 30, stuckSpinners: r.spinners, overflowX: r.overflowX > 2 ? r.overflowX : 0,
    toasts: await s.page.evaluate(() => window.__t.join(' | ')).catch(() => ''),
    console: [...new Set(s.console)].slice(0, 4), net: [...new Set(s.net)].slice(0, 5), blockedWrites: [...new Set(s.blocked)].slice(0, 3),
    tech, english, actions: r.buttons.filter(b => /إضافة|حذف|تعديل|حفظ|إنشاء|تصدير|طباعة|جديد|استيراد|إغلاق اليوم|ترقية|طلب/.test(b)).slice(0, 14),
  });
}


// ---- focused re-checks of this round's fixes
async function textOf(s, path, wait = 7000) {
  await s.page.evaluate(() => { window.__t = []; }).catch(() => {});
  await s.page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(wait);
  return { url: new URL(s.page.url()).pathname + new URL(s.page.url()).search, text: (await s.page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '), toasts: await s.page.evaluate(() => window.__t.join(' | ')).catch(() => '') };
}
{
  const e = await session('demo-employee@wasil.demo');
  for (const p of ['/', '/reports', '/organization?tab=support']) {
    const r = await textOf(e, p);
    out(`FOCUS|employee ${p}`, { url: r.url, noShopScreen: /حسابك غير مرتبط بمتجر نشط/.test(r.text), toasts: r.toasts, spinners: await e.page.locator('.animate-spin').count() });
  }
  await e.ctx.close();
  const c = await session('demo-cashier@wasil.demo');
  for (const p of ['/sales?tab=closings', '/sales?tab=repairs', '/products?tab=suppliers', '/products?tab=inventory']) {
    const r = await textOf(c, p);
    out(`FOCUS|cashier ${p}`, { url: r.url, toasts: r.toasts, closingShown: /إجمالي مبيعات اليوم/.test(r.text), repairsShown: /طلبات الصيانة|طلب صيانة/.test(r.text), deniedInPlace: /ليست لديك صلاحية|غير متاح/.test(r.text) });
  }
  await c.ctx.close();
  const a = await session('demo-admin@wasil.demo');
  { const r = await textOf(a, '/team?tab=users'); out('FOCUS|admin users', { url: r.url, addUser: /إضافة مستخدم جديد/.test(r.text) }); }
  await a.ctx.close();
  const o = await session('demo-distributor@wasil.demo');
  { const r = await textOf(o, '/team?tab=payroll'); out('FOCUS|owner payroll', { localNotice: /محفوظة على هذا الجهاز فقط/.test(r.text) }); }
  { const r = await textOf(o, '/products?tab=inventory&sub=accessories');
    await o.page.locator('table button:has(svg.lucide-more-horizontal)').first().click().catch(() => {}); await sleep(800);
    const items = await o.page.getByRole('menuitem').allInnerTexts().catch(() => []);
    out('FOCUS|owner accessory menu', { items }); }
  await o.ctx.close();
}

const ROLES = [
  ['owner', 'demo-distributor@wasil.demo', allPages().concat(LEGACY)],
  ['admin', 'demo-admin@wasil.demo', allPages()],
  ['cashier', 'demo-cashier@wasil.demo', allPages()],
  ['employee', 'demo-employee@wasil.demo', ['/', '/pos', '/products?tab=inventory', '/sales?tab=orders', '/sales?tab=customers', '/sales?tab=repairs', '/reports', '/settings?tab=general', '/team?tab=users', '/organization?tab=support']],
  ['lite', 'demo-basic@wasil.demo', allPages()],
  ['pro', 'demo-enterprise@wasil.demo', ['/', '/sales?tab=wholesale', '/reports', '/organization?tab=branches', '/sales?tab=store', '/subscription']],
];
for (const [role, email, pages] of ROLES) {
  const s = await session(email);
  for (const p of pages) await visit(s, role, p);
  await s.ctx.close();
}
// owner on a phone: every main page
{
  const s = await session('demo-distributor@wasil.demo', { mobile: true });
  for (const p of allPages()) await visit(s, 'owner-mobile', p, { wait: 5000 });
  await s.ctx.close();
}
// public store and visitor pages
{
  const r = await fetch(`${SUPA}/rest/v1/store_settings?select=slug&is_published=eq.true&limit=3`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const slugs = (await r.json()).map(x => x.slug);
  out('store.slugs', slugs);
  const s = await session(null);
  for (const p of ['/', '/auth', '/admin/login', '/no-such-page']) await visit(s, 'visitor', p, { wait: 4000 });
  for (const slug of slugs.slice(0, 2)) for (const sub of ['', '/products', '/cart', '/checkout', '/favorites', '/track', '/my-orders', '/no-page'])
    await visit(s, 'visitor', `/store/${slug}${sub}`, { wait: 5000 });
  await s.ctx.close();
  const m = await session(null, { mobile: true });
  for (const slug of slugs.slice(0, 1)) for (const sub of ['', '/products', '/cart', '/checkout']) await visit(m, 'visitor-mobile', `/store/${slug}${sub}`, { wait: 5000 });
  await m.ctx.close();
}
await browser.close();

// rerun after the permissions-race and no-shop fixes
