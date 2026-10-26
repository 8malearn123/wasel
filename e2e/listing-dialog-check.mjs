// One-off, read only: the Max demo opens «إضافة منتج للبيع بالجملة» on the LIVE
// site and tries the product type and the product pickers. Nothing is saved:
// every write is blocked.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const SITE = process.env.SITE || 'https://wasel-alpha.vercel.app';
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
})).json();
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: w, height: h }, hasTouch: w < 500 });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/rest/v1/**`, route =>
    ['GET', 'HEAD'].includes(route.request().method()) || route.request().url().includes('/rpc/') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const shot = async (label) => { const b = await page.screenshot({ type: 'jpeg', quality: 70 }); console.log(`SHOT-BEGIN ${label}-${w}`); console.log(b.toString('base64')); console.log('SHOT-END'); };
  const step = async (label, fn) => { try { await fn(); console.log(`OK   ${w} ${label}`); } catch (e) { console.log(`FAIL ${w} ${label}: ${e.message.split('\n')[0]}`); await shot(label.replace(/\W+/g, '-')); } };

  await page.goto(`${SITE}/sales?tab=wholesale&sub=listings`); await page.waitForTimeout(9000);
  await step('open add dialog', async () => { await page.getByRole('button', { name: 'إضافة منتج' }).first().click({ timeout: 5000 }); await page.getByRole('dialog').waitFor({ timeout: 5000 }); });
  const dialog = page.getByRole('dialog');
  console.log(`TEXT ${w} dialog: ${(await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ')}`);
  // the product type
  await step('open the type list', async () => { await dialog.getByRole('combobox').first().click({ timeout: 5000 }); await page.getByRole('option', { name: 'إكسسوار' }).waitFor({ timeout: 5000 }); });
  await step('pick إكسسوار', async () => { await page.getByRole('option', { name: 'إكسسوار' }).click({ timeout: 5000 }); });
  console.log(`TEXT ${w} after type: ${(await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}`);
  // the product, for accessories
  await step('open the product list', async () => { await dialog.getByRole('combobox').nth(1).click({ timeout: 5000 }); await page.getByRole('option').first().waitFor({ timeout: 5000 }); });
  console.log(`TEXT ${w} options: ${(await page.getByRole('option').allInnerTexts().catch(() => [])).slice(0, 8).join(' | ')}`);
  await step('pick the first product', async () => { await page.getByRole('option').first().click({ timeout: 5000 }); });
  console.log(`TEXT ${w} after product: ${(await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 260)}`);
  // back to devices
  await step('switch the type back to جهاز', async () => { await dialog.getByRole('combobox').first().click({ timeout: 5000 }); await page.getByRole('option', { name: 'جهاز' }).click({ timeout: 5000 }); });
  await step('open the device list', async () => { await dialog.getByRole('combobox').nth(1).click({ timeout: 5000 }); await page.getByRole('option').first().waitFor({ timeout: 5000 }); });
  console.log(`TEXT ${w} device options: ${(await page.getByRole('option').allInnerTexts().catch(() => [])).join(' | ')}`);
  await step('pick a device', async () => { await page.getByRole('option').first().click({ timeout: 5000 }); });
  console.log(`TEXT ${w} after device: ${(await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 260)}`);
  await shot('final');
  console.log(`ERRORS ${w}: ${JSON.stringify(errors.slice(0, 5))}`);
  await context.close();
}
await browser.close();
