// Screenshots of one screen for a visual check. Read-only: writes are blocked.
// SHOT=device-dialog opens «إضافة جهاز» on /products as a demo owner.
import { chromium } from 'playwright';
const SITE = process.env.SITE || 'https://wasel-alpha.vercel.app';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
});
const session = await r.json();
const browser = await chromium.launch();
for (const [label, viewport] of [['desktop', { width: 1920, height: 1080 }], ['mobile', { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ locale: 'ar', viewport });
  await context.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/**`, route => {
    const m = route.request().method();
    const u = route.request().url();
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(m) && !u.includes('/rpc/') && !u.includes('/auth/v1/')) {
      return route.fulfill({ status: 403, body: '{}' });
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(`${SITE}/products?tab=inventory`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^إضافة$/ }).first().click();
  await page.getByRole('menuitem', { name: /إضافة جهاز/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shot-${label}.png` });
  await context.close();
}
await browser.close();
