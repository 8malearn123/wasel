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
// The artifact store is not reachable from every reviewer's machine, so each
// shot is also printed into the job log, as a small JPEG in base64
async function logShot(page, label) {
  const jpg = await page.screenshot({ type: 'jpeg', quality: 45 });
  console.log(`SHOT-BEGIN ${label}`);
  for (let i = 0; i < jpg.toString('base64').length; i += 4000) console.log(jpg.toString('base64').slice(i, i + 4000));
  console.log(`SHOT-END ${label}`);
}

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
  try {
    const add = page.locator('button', { hasText: 'إضافة' }).filter({ hasNotText: 'مستخدم' }).first();
    await add.waitFor({ timeout: 20000 });
    await add.click();
    await page.getByRole('menuitem', { name: /إضافة جهاز/ }).click();
    await page.waitForTimeout(800);
  } catch (e) {
    console.log(`[${label}] ${e.message.split('\n')[0]} — at ${page.url()}`);
  }
  await page.screenshot({ path: `shot-${label}.png` });
  await logShot(page, label);
  // a short laptop screen, where the old dialog ran off the bottom
  if (label === 'desktop') {
    await page.setViewportSize({ width: 1366, height: 680 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'shot-laptop.png' });
    await logShot(page, 'laptop');
  }
  await context.close();
}
await browser.close();
