// One-off: the wholesale market with this branch's code, on live data.
// 1. The supplier (Max demo) opens its wholesale page: the app writes the
//    product description into its own listings whose notes are empty — the
//    only write allowed here.
// 2. The buyer (Pro demo) opens the market and the order dialog, read only,
//    and changes the quantity to see the total follow.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const signIn = async (email) => (await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234' }),
})).json());

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
async function open(session, allowListingNotes) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/rest/v1/**`, route => {
    const req = route.request();
    if (['GET', 'HEAD'].includes(req.method()) || req.url().includes('/rpc/')) return route.continue();
    if (allowListingNotes && req.method() === 'PATCH' && req.url().includes('/wholesale_listings') && Object.keys(JSON.parse(req.postData() || '{}')).join() === 'notes') {
      console.log(`WRITE notes on ${req.url().split('id=eq.')[1]}`);
      return route.continue();
    }
    return route.abort();
  });
  return context.newPage();
}

const supplier = await signIn('demo-distributor@wasil.demo');
let page = await open(supplier, true);
await page.goto(`${process.env.SITE}/sales?tab=wholesale`); await page.waitForTimeout(9000);
const H = { apikey: ANON, Authorization: `Bearer ${supplier.access_token}` };
console.log(`SUPPLIER listings now ${await (await fetch(`${SUPA}/rest/v1/wholesale_listings?select=id,is_active,wholesale_price,min_quantity,notes`, { headers: H })).text()}`);

const buyer = await signIn('demo-enterprise@wasil.demo');
page = await open(buyer, false);
await page.goto(`${process.env.SITE}/sales?tab=wholesale`); await page.waitForTimeout(9000);
console.log(`SCREEN market: ${(await page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' '))).slice(0, 700)}`);
let shot = await page.screenshot({ type: 'jpeg', quality: 72 });
console.log('SHOT-BEGIN market'); console.log(shot.toString('base64')); console.log('SHOT-END');
await page.locator('table button').first().click(); await page.waitForTimeout(1500);
const dialog = page.locator('[role=dialog]');
console.log(`SCREEN dialog qty=min: ${(await dialog.innerText()).replace(/\s+/g, ' ')}`);
await dialog.getByRole('button', { name: 'زيادة' }).click();
await dialog.getByRole('button', { name: 'زيادة' }).click();
await page.waitForTimeout(400);
console.log(`SCREEN dialog qty+2: ${(await dialog.innerText()).replace(/\s+/g, ' ')}`);
shot = await page.screenshot({ type: 'jpeg', quality: 72 });
console.log('SHOT-BEGIN dialog'); console.log(shot.toString('base64')); console.log('SHOT-END');
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
shot = await page.screenshot({ type: 'jpeg', quality: 72 });
console.log(`SCREEN phone overflow=${await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)}`);
console.log('SHOT-BEGIN dialog-phone'); console.log(shot.toString('base64')); console.log('SHOT-END');
await browser.close();
