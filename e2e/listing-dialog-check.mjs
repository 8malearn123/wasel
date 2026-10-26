// One-off, read only: the Pro demo (a wholesale buyer) opens the order dialog
// with this branch's code on live data and uses the product picker.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-enterprise@wasil.demo', password: 'demo1234' }),
})).json();
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: w, height: h }, hasTouch: w < 500 });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/rest/v1/**`, route =>
    ['GET', 'HEAD'].includes(route.request().method()) || route.request().url().includes('/rpc/') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const shot = async (label) => { const b = await page.screenshot({ type: 'jpeg', quality: 72 }); console.log(`SHOT-BEGIN ${label}-${w}`); console.log(b.toString('base64')); console.log('SHOT-END'); };
  const step = async (label, fn) => { try { await fn(); console.log(`OK   ${w} ${label}`); } catch (e) { console.log(`FAIL ${w} ${label}: ${e.message.split('\n')[0]}`); } };
  const order = () => page.getByRole('dialog', { name: 'طلب شراء بالجملة' });

  await page.goto(`${process.env.SITE}/sales?tab=wholesale`); await page.waitForTimeout(9000);
  await step('open the order dialog', async () => { await page.locator('table button').first().click({ timeout: 5000 }); await order().waitFor({ timeout: 5000 }); });
  await step('open the product picker', async () => { await order().getByRole('combobox').first().click({ timeout: 5000 }); await page.getByRole('option').first().waitFor({ timeout: 5000 }); });
  console.log(`TEXT ${w} picker options: ${(await page.getByRole('option').allInnerTexts().catch(() => [])).join(' | ')}`);
  await shot('picker');
  await step('pick a product', async () => { await page.getByRole('option').first().click({ timeout: 5000 }); });
  await step('quantity to 4', async () => { await order().locator('input[type=number]').fill('4'); });
  await page.waitForTimeout(400);
  console.log(`TEXT ${w} dialog: ${(await order().innerText().catch(e => 'ERR ' + e.message)).replace(/\s+/g, ' ')}`);
  console.log(`TEXT ${w} overflow=${await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)}`);
  await shot('dialog');
  console.log(`ERRORS ${w}: ${JSON.stringify(errors.slice(0, 5))}`);
  await context.close();
}
await browser.close();
