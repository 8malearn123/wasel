// One-off READ-ONLY closing run. Every write is aborted in the browser before it leaves.
// Lines tagged LIVE use real data only; lines tagged MOCK replace one server answer in the browser.
import { chromium } from 'playwright';
const SITE = 'http://localhost:4173';
const PW = 'demo1234';
const READ = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 3000)}`);
async function step(n, f) { try { out(n, await f()); } catch (e) { out(n, 'ERROR ' + e.message.split('\n')[0].slice(0, 200)); } }
const browser = await chromium.launch({ channel: 'chrome' });
const isObjAccept = req => /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');

async function newSession({ mobile = false, mock = null } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar-SA' } : { viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const s = { ctx, errors: [], blocked: [], status: [], mock };
  await ctx.addInitScript(() => { window.__t = []; const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__t.push(el.innerText.replace(/\s+/g, ' ').trim()), 60); })).observe(document, { childList: true, subtree: true }); try { localStorage.setItem('language', 'ar'); } catch {} });
  await ctx.route(/supabase\.co\//, async route => {
    const r = route.request(); const m = r.method(); const u = r.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    if (s.mock && await s.mock(route, r)) return;
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || (fn && READ.has(fn))) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-1"' });
    s.blocked.push(`${m} ${u.split('/v1/')[1].split('?')[0]}`);
    return route.abort('blockedbyclient');
  });
  s.page = await ctx.newPage();
  s.page.on('pageerror', e => s.errors.push(e.message.slice(0, 140)));
  s.page.on('response', r => { if (r.status() >= 400 && /supabase\.co/.test(r.url())) s.status.push(`${r.status()} ${r.url().split('/v1/')[1]?.split('?')[0]}`); });
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
const toasts = p => p.evaluate(() => window.__t.join(' | ')).catch(() => '');
const clearToasts = p => p.evaluate(() => { window.__t = []; }).catch(() => {});
async function visit(p, path, w = 5000) {
  await clearToasts(p);
  await p.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(w);
  const u = new URL(p.url());
  return { landed: u.pathname + u.search, toast: (await toasts(p)).slice(0, 160) };
}
const bodyText = p => p.locator('body').innerText().then(t => t.replace(/\s+/g, ' ')).catch(() => '');
const menuOf = p => p.evaluate(() => [...document.querySelectorAll('aside a[href]')].map(a => a.getAttribute('href')));
const ADMIN = ['/admin', '/admin/companies', '/admin/plans', '/admin/branch-requests', '/admin/payouts', '/admin/reports', '/admin/activity', '/admin/tickets'];
const ADMIN_TITLES = { '/admin': 'نظرة عامة', '/admin/companies': 'الشركات', '/admin/plans': 'الباقات', '/admin/branch-requests': 'طلبات الفروع', '/admin/payouts': 'المدفوعات', '/admin/reports': 'التقارير', '/admin/activity': 'سجل النشاط', '/admin/tickets': 'تذاكر الدعم' };

async function openFirstEdit(p) {
  await p.locator('main tbody tr').first().locator('button:has(svg.lucide-ellipsis), button:has(svg.lucide-more-horizontal)').first().click(); await sleep(700);
  await p.getByRole('menuitem', { name: /تعديل/ }).first().click();
}

await step('MOCK-WRITE|pos-sale', async () => {
  const s = await newSession(); await login(s, 'demo-enterprise@wasil.demo'); const p = s.page;
  await visit(p, '/pos', 7000); const r = {};
  try {
    await p.locator('main button:has-text("ر.س")').first().click(); await sleep(1200);
    r.cartBefore = (await bodyText(p)).match(/الإجمالي[^ر]{0,30}ر\.س/)?.[0];
    await p.getByRole('button', { name: 'إتمام البيع' }).click(); await sleep(1500);
    const confirm = p.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ });
    await confirm.waitFor({ timeout: 10000 });
    await p.locator('[role="dialog"]').last().getByText('كاش', { exact: true }).click(); await sleep(500);
    r.payDialog = (await p.locator('[role="dialog"]').last().innerText()).replace(/\s+/g, ' ').slice(0, 80);
    r.confirmEnabled = await confirm.isEnabled();
    await clearToasts(p); await confirm.click(); await sleep(7000);
    r.toast = await toasts(p);
    r.dialogStillOpen = await p.locator('[role="dialog"]').count() > 0;
    r.cartAfter = (await bodyText(p)).match(/الإجمالي[^ر]{0,30}ر\.س/)?.[0];
    r.receiptShown = /تمت عملية البيع|طباعة الفاتورة/.test(await bodyText(p));
  } catch (e) { r.err = e.message.slice(0, 160); }
  r.blocked = s.blocked; await s.ctx.close(); return r;
});
await browser.close();
