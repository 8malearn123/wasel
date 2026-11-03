// One-off READ-ONLY full E2E of claude/frontend-regression-fixes against the live data.
// Every non-GET request is aborted in the browser (read-only RPCs pass; the invoice number is answered locally).
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const PW = 'demo1234';
const READ = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 2500)}`);
async function step(n, f) { try { out(n, await f()); } catch (e) { out(n, 'ERROR ' + e.message.split('\n')[0].slice(0, 200)); } }
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
const PAGES = ['/', '/ai-insights', '/subscription', ...Object.entries(LEAVES).flatMap(([p, ls]) => ls.map(l => `${p}?tab=${l}`))];
const browser = await chromium.launch({ channel: 'chrome' });

function wire(ctx, s) {
  ctx.on('page', p => attach(p, s));
}
async function attach(page, s) {
  page.on('pageerror', e => s.errors.push(e.message.slice(0, 140)));
  page.on('request', r => { const u = r.url(); const m = u.match(/merchant_id=eq\.([0-9a-f-]{36})/); if (m) s.merchantIds.add(m[1]); });
  await page.addInitScript(() => { window.__t = []; const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__t.push(el.innerText.replace(/\s+/g, ' ').trim()), 60); })).observe(document, { childList: true, subtree: true }); try { localStorage.setItem('language', 'ar'); } catch {} });
  await page.route(/supabase\.co\//, async route => {
    const r = route.request(); const m = r.method(); const u = r.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || (fn && READ.has(fn))) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-1"' });
    s.blocked.push(`${m} ${u.replace(SUPA, '').split('?')[0]}`);
    return route.abort('blockedbyclient');
  });
}
async function newSession(mobile = false) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar-SA' } : { viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const s = { ctx, errors: [], blocked: [], merchantIds: new Set() };
  wire(ctx, s);
  s.page = await ctx.newPage(); await sleep(100);
  return s;
}
async function login(s, email) {
  const p = s.page;
  await p.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await p.locator('#email').fill(email); await p.locator('#password').fill(PW);
  await p.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {}); await sleep(4000);
}
const reasonOf = t => /غير متاحة في باقتك/.test(t) ? 'PLAN' : /ليست لديك صلاحية/.test(t) ? 'PERM' : /لحساب الكاشير/.test(t) ? 'CASHIER' : '';
async function visit(page, path, w = 4500) {
  await page.evaluate(() => { window.__t = []; }).catch(() => {});
  await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(w);
  const u = new URL(page.url()); const t = await page.evaluate(() => window.__t.join(' | ')).catch(() => '');
  return { landed: u.pathname + u.search, reason: reasonOf(t), toast: t.slice(0, 120) };
}
const outcome = (p, r) => r.landed === p ? (r.reason ? `OPEN+${r.reason}` : 'OPEN') : `→${r.landed}${r.reason ? ' [' + r.reason + ']' : ''}`;
const bodyText = page => page.locator('body').innerText().then(t => t.replace(/\s+/g, ' ')).catch(() => '');

// ---- targeted re-test after e94d18c (plan leaks: dashboard/bell/search) and 2fb493d (per-shop storage) ----
async function tablesDuring(s, fn) {
  const t = new Set(); const h = r => { const m = r.url().match(/\/rest\/v1\/([a-z_]+)/); if (m) t.add(m[1]); };
  s.page.on('request', h); await fn(); s.page.off('request', h); return [...t].sort();
}
async function planLeak(label, email) {
  const s = await newSession(); const p = s.page;
  await login(s, email);
  const dashTables = await tablesDuring(s, async () => { await visit(p, '/', 9000); });
  const dash = await bodyText(p);
  const cards = ['أجهزة في المخزون', 'طلبات صيانة مفتوحة', 'مستحقات الموردين', 'أوامر شراء غير مدفوعة', 'تحويلات', 'تحويل معلق'].filter(c => dash.includes(c));
  let bell = '';
  const bellTables = await tablesDuring(s, async () => {
    try { await p.locator('header button:has(svg.lucide-bell)').first().click(); await sleep(2500); bell = (await p.locator('[role="menu"], [data-radix-popper-content-wrapper]').allInnerTexts()).join(' ').replace(/\s+/g, ' ').slice(0, 300); await p.keyboard.press('Escape'); } catch { bell = 'n/a'; }
  });
  let searchText = '';
  const searchTables = await tablesDuring(s, async () => {
    try { const box = p.getByPlaceholder(/ابحث/).first(); await box.click(); await box.fill('سام'); await sleep(17000); searchText = (await p.locator('body').innerText()).replace(/\s+/g, ' ').match(/(عملاء|العملاء|صيانة|أجهزة|منتجات)[^|]{0,60}/g)?.slice(0, 6) || []; await box.fill(''); await p.keyboard.press('Escape'); } catch (e) { searchText = 'n/a ' + e.message.slice(0, 80); }
  });
  out(`${label}|leak`, { cards, bell, dashTables, bellTables, searchTables, searchText, errors: s.errors.slice(0, 3), blocked: s.blocked.length });
  await s.ctx.close();
}

for (const [l, e] of [['Lite', 'demo-basic@wasil.demo'], ['Max', 'demo-distributor@wasil.demo']]) await step(`${l}|run`, async () => { await planLeak(l, e); return 'done'; });

await browser.close();
