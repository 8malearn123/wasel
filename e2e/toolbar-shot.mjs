// One-off: the inventory toolbar, as the Max owner (read-only)
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
for (const [label, width] of [['desktop', 1600], ['mobile', 390]]) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width, height: 900 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/**`, route => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(route.request().method())
    && !route.request().url().includes('/rpc/') && !route.request().url().includes('/auth/v1/')
    ? route.fulfill({ status: 403, body: '{}' }) : route.continue());
  const page = await context.newPage();
  await page.goto(`${SITE}/products?tab=inventory`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const box = await page.getByPlaceholder('ابحث في المخزون...').evaluate(el => {
    const bar = el.closest('.border-b'); const b = bar.getBoundingClientRect();
    return { x: 0, y: Math.max(0, b.top - 10), width: window.innerWidth, height: b.height + 20 };
  });
  const jpg = await page.screenshot({ type: 'jpeg', quality: 95, clip: box });
  console.log(`SHOT-BEGIN ${label}`);
  const b64 = jpg.toString('base64');
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
  console.log(`SHOT-END ${label}`);
  await context.close();
}
await browser.close();

// Store categories, as the demo admin: add one through the screen, read what
// the screen says, then remove it again
{
  const r2 = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo-admin@wasil.demo', password: 'demo1234' }),
  });
  const admin = await r2.json();
  const browser2 = await chromium.launch();
  const context = await browser2.newContext({ locale: 'ar', viewport: { width: 1600, height: 900 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(admin)]);
  const page = await context.newPage();
  const net = [];
  page.on('response', async res => {
    if (res.url().includes('store_categories') && res.request().method() !== 'GET') {
      net.push(`${res.request().method()} ${res.status()} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }
  });
  await page.goto(`${SITE}/sales?tab=store&sub=categories`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  const name = 'تصنيف تجريبي e2e';
  const button = page.getByRole('button', { name: /إضافة/ }).last();
  console.log('add button disabled before typing:', await button.isDisabled());
  await page.getByPlaceholder('اسم التصنيف الجديد...').fill(name);
  console.log('add button disabled after typing:', await button.isDisabled());
  await button.click();
  await page.waitForTimeout(2500);
  const toasts = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  console.log('toasts:', JSON.stringify(toasts));
  console.log('network:', JSON.stringify(net));
  const listed = await page.getByText(name).count();
  console.log('listed after add:', listed);
  const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
  console.log('SHOT-BEGIN categories');
  const b64 = jpg.toString('base64');
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
  console.log('SHOT-END categories');
  // clean up: the test category goes again
  const h = { apikey: ANON, Authorization: `Bearer ${admin.access_token}` };
  const del = await fetch(`${SUPA}/rest/v1/store_categories?name=eq.${encodeURIComponent(name)}`, { method: 'DELETE', headers: h });
  console.log('cleanup delete:', del.status);
  await browser2.close();
}
