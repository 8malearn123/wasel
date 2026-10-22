// One-off: the header's account button for each role demo account (read-only)
import { chromium } from 'playwright';
const SITE = process.env.SITE;
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const browser = await chromium.launch();
for (const email of ['demo-distributor@wasil.demo', 'demo-admin@wasil.demo', 'demo-cashier@wasil.demo', 'demo-employee@wasil.demo']) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  const session = await r.json();
  const context = await browser.newContext({ locale: 'ar', viewport: { width: 1600, height: 900 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/**`, route => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(route.request().method())
    && !route.request().url().includes('/rpc/') && !route.request().url().includes('/auth/v1/')
    ? route.fulfill({ status: 403, body: '{}' }) : route.continue());
  const page = await context.newPage();
  await page.goto(`${SITE}/organization?tab=support`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const label = email.split('@')[0];
  const jpg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 700, height: 80 } });
  console.log(`SHOT-BEGIN ${label}`);
  const b64 = jpg.toString('base64');
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
  console.log(`SHOT-END ${label}`);
  await context.close();
}
await browser.close();
