// One-off READ-ONLY final check of claude/frontend-regression-fixes. Every write is aborted in the browser.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const PW = 'demo1234';
const READ = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 900)}`);
async function step(n, f) { try { out(n, await f()); } catch (e) { out(n, 'ERROR ' + e.message.slice(0, 200)); } }
const browser = await chromium.launch({ channel: 'chrome' });
async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage(); const s = { page, ctx, posts: [], offline: false, errors: [] };
  page.on('pageerror', e => s.errors.push(e.message.slice(0, 120)));
  await page.addInitScript(() => { window.__t = []; const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__t.push(el.innerText.replace(/\s+/g, ' ').trim()), 60); })).observe(document, { childList: true, subtree: true }); });
  await page.route(/supabase\.co\//, async route => {
    const r = route.request(); const m = r.method(); const u = r.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || (fn && READ.has(fn))) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-1"' });
    s.posts.push(`${m} ${u.replace(SUPA, '').split('?')[0]}`);
    return route.abort(s.offline ? 'internetdisconnected' : 'blockedbyclient');
  });
  await page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await page.getByRole('tab', { name: /دخول بالإيميل/ }).click();
  await page.locator('#email').fill(email); await page.locator('#password').fill(PW);
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {}); await sleep(3500);
  return s;
}
const toasts = p => p.evaluate(() => window.__t.join(' | '));
const go = async (s, p, w = 5000) => { await s.page.evaluate(() => { window.__t = []; }).catch(() => {}); await s.page.goto(`${SITE}${p}`, { waitUntil: 'domcontentloaded' }); await sleep(w); return new URL(s.page.url()).pathname + new URL(s.page.url()).search; };

const o = await session('demo-distributor@wasil.demo');
await step('edit-accessory-dialog', async () => {
  await go(o, '/products?tab=inventory&sub=accessories', 6000);
  await o.page.locator('table button:has(svg.lucide-ellipsis), table button:has(svg.lucide-more-horizontal)').first().click(); await sleep(700);
  const menu = await o.page.getByRole('menuitem').allInnerTexts();
  await o.page.getByRole('menuitem', { name: /تعديل/ }).first().click(); await sleep(1200);
  const d = o.page.getByRole('dialog');
  const filled = { sku: await d.locator('#sku').inputValue(), name: await d.locator('#name').inputValue(), price: await d.locator('#price').inputValue() };
  await d.locator('#price').fill('-5');
  await o.page.evaluate(() => { window.__t = []; }); o.posts.length = 0;
  await d.locator('button[type="submit"]').click(); await sleep(2000);
  const afterNeg = { toast: await toasts(o.page), dialogOpen: await d.isVisible(), priceKept: await d.locator('#price').inputValue().catch(() => null), writes: o.posts.length };
  await d.locator('#price').fill(filled.price || '1');
  await o.page.evaluate(() => { window.__t = []; });
  await d.locator('button[type="submit"]').click(); await sleep(2500);
  const afterBlocked = { toast: await toasts(o.page), dialogOpen: await d.isVisible(), writes: o.posts.slice(-2) };
  return { menu, filled, afterNeg, afterBlocked };
});
await step('owner-dashboard', async () => ({ url: await go(o, '/'), kpi: /أجهزة في المخزون/.test(await o.page.locator('body').innerText()), errors: o.errors }));
await o.ctx.close();

const c = await session('demo-cashier@wasil.demo');
await step('cashier-reports', async () => ({ url: await go(c, '/reports'), toast: await toasts(c.page) }));
await step('cashier-offline-sale', async () => {
  await go(c, '/pos', 5000);
  const scan = c.page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
  await scan.click(); await scan.fill('ACC-004'); await scan.press('Enter'); await sleep(1500);
  await c.page.locator('button:has(svg.lucide-plus)').first().click().catch(() => {}); await sleep(500);
  c.offline = true; await c.page.evaluate(() => { window.__t = []; });
  await c.page.getByRole('button', { name: /إتمام البيع/ }).click();
  const d = c.page.getByRole('dialog'); await d.getByRole('button', { name: /كاش/ }).first().click().catch(() => {});
  const b = d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ });
  await Promise.all([b.click(), b.click({ delay: 30 }).catch(() => {})]); await sleep(3500);
  return { toast: await toasts(c.page), salePosts: c.posts.filter(x => /\/sales$/.test(x)).length };
});
await c.ctx.close();
const l = await session('demo-basic@wasil.demo');
await step('lite-wholesale', async () => ({ url: await go(l, '/sales?tab=wholesale'), toast: await toasts(l.page) }));
await l.ctx.close();
const e = await session('demo-employee@wasil.demo');
await step('employee', async () => ({ url: await go(e, '/'), noShop: /حسابك غير مرتبط بمتجر نشط/.test(await e.page.locator('body').innerText()) }));
await e.ctx.close();
await browser.close();
