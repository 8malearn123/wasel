// One-off: the dashboard as the Max owner, for a visual check (read-only)
import { chromium } from 'playwright';
const SITE = process.env.SITE;
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
});
const session = await r.json();
const browser = await chromium.launch();
for (const [label, width, height] of [['desktop', 1600, 1150], ['mobile', 390, 1600]]) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width, height } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/**`, route => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(route.request().method())
    && !route.request().url().includes('/rpc/') && !route.request().url().includes('/auth/v1/')
    ? route.fulfill({ status: 403, body: '{}' }) : route.continue());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  if (errors.length) console.log('ERRORS', errors.join(' | '));
  const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
  console.log(`SHOT-BEGIN ${label}`);
  const b64 = jpg.toString('base64');
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
  console.log(`SHOT-END ${label}`);
  await context.close();
}
await browser.close();
