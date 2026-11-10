// One-off READ-ONLY screenshots of the design refresh. Every write is aborted in the browser.
import { chromium } from 'playwright';
const SITE = 'http://localhost:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const READ = /\/rpc\/(my_permissions|get_subscription_state|get_user_merchant_id|is_platform_admin|has_permission|wholesale_parties|wholesale_listing_items)/;
const PAGES = (process.env.PAGES || '/,/pos,/products?tab=inventory,/sales?tab=customers,/reports?tab=sales,/subscription,/team?tab=users').split(',');
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
async function run(label, email, viewport, pages) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'ar-SA', timezoneId: 'Asia/Riyadh' });
  await ctx.addInitScript(() => { try { localStorage.setItem('language', 'ar'); } catch {} });
  await ctx.route(/supabase\.co\//, r => { const q = r.request(); if (!/\/(rest|functions|storage)\/v1\//.test(q.url()) || ['GET', 'HEAD', 'OPTIONS'].includes(q.method()) || READ.test(q.url())) return r.continue(); return r.abort('blockedbyclient'); });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${label}: ${e.message.slice(0, 160)}`));
  await p.goto(`${SITE}/auth`); await sleep(2500);
  await p.getByRole('tab', { name: /دخول بالإيميل/ }).click(); await p.locator('#email').fill(email); await p.locator('#password').fill('demo1234');
  await p.getByRole('button', { name: /تسجيل الدخول/ }).click(); await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {}); await sleep(5000);
  for (const path of pages) {
    await p.goto(`${SITE}${path}`); await sleep(8000);
    const name = `${label}-${path.replace(/[^a-z0-9]+/gi, '_')}`.replace(/_+$/, '');
    await p.screenshot({ path: `shot-${name}.png`, fullPage: false });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`R|${name}|overflow=${over}`);
  }
  await ctx.close();
}
await run('owner', 'demo-distributor@wasil.demo', { width: 1440, height: 900 }, PAGES);
await run('mobile', 'demo-distributor@wasil.demo', { width: 390, height: 844 }, ['/', '/products?tab=inventory']);
await run('cashier', 'demo-cashier@wasil.demo', { width: 1440, height: 900 }, ['/pos']);
await run('lite', 'demo-basic@wasil.demo', { width: 1440, height: 900 }, ['/']);
console.log('R|errors|' + JSON.stringify(errors));
await browser.close();
