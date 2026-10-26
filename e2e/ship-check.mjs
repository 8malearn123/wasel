// One-off. 1) Does the live column take a carrier id? An update that matches
// no row (id of zeros), so nothing changes. 2) The shipping page and the store
// orders on this branch with live data; writes are captured, not sent.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }) })).json();
const H = { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
for (const v of ['naqel', 'other']) {
  const r = await fetch(`${SUPA}/rest/v1/online_orders?id=eq.00000000-0000-0000-0000-000000000000`, { method: 'PATCH', headers: H, body: JSON.stringify({ shipping_provider: v }) });
  console.log(`TEXT enum probe shipping_provider='${v}' → HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
}
const spec = await (await fetch(`${SUPA}/rest/v1/`, { headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}` } })).json();
console.log(`TEXT column type online_orders.shipping_provider: ${JSON.stringify(spec?.definitions?.online_orders?.properties?.shipping_provider)}`);
const orders = await (await fetch(`${SUPA}/rest/v1/online_orders?select=order_number,status,shipping_provider,tracking_number,shipping_city&order=created_at.desc&limit=50`, { headers: H })).json();
console.log(`TEXT live orders: ${orders.length} → ${JSON.stringify(orders.slice(0, 8))}`);
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const w of [1440, 390]) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: w, height: w > 500 ? 900 : 844 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  await context.route(`${SUPA}/rest/v1/**`, async r => {
    const m = r.request().method();
    if (['GET', 'HEAD'].includes(m) || r.request().url().includes('/rpc/')) return r.continue();
    console.log(`TEXT ${w} WRITE captured ${m} ${r.request().url().split('/rest/v1/')[1].slice(0, 60)} ${r.request().postData()}`);
    return r.fulfill({ status: 204, body: '' });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const shot = async l => { const b = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: w < 500 }); console.log(`SHOT-BEGIN ${l}-${w}`); console.log(b.toString('base64')); console.log('SHOT-END'); };
  const step = async (n, f) => { try { await f(); console.log(`OK   ${w} ${n}`); } catch (e) { console.log(`FAIL ${w} ${n}: ${e.message.split('\n')[0]}`); } };
  const text = async () => (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ');

  await page.goto(`${'http://localhost:4173'}/shipping`); await page.waitForTimeout(8000);
  console.log(`TEXT ${w} shipping: ${(await text()).slice(0, 900)}`);
  await shot('shipping');
  for (const tab of ['في الطريق', 'تم التسليم', 'بانتظار الشحن']) {
    await step(`stage ${tab}`, async () => { await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click({ timeout: 4000 }); await page.waitForTimeout(400); });
  }
  await step('ship dialog', async () => {
    await page.getByRole('button', { name: 'شحن الطلب' }).first().click({ timeout: 4000 });
    const d = page.getByRole('dialog');
    await d.getByRole('combobox').click(); await page.getByRole('option', { name: /ناقل/ }).click();
    await d.locator('input').fill('NQ77001');
    await shot('ship-dialog');
    await d.getByRole('button', { name: 'تأكيد الشحن' }).click(); await page.waitForTimeout(1500);
  });
  await step('waybill', async () => {
    const [pop] = await Promise.all([page.waitForEvent('popup', { timeout: 6000 }), page.getByRole('button', { name: 'طباعة البوليصة' }).first().click()]);
    await pop.waitForLoadState(); await pop.waitForTimeout(500);
    console.log(`TEXT ${w} waybill: ${(await pop.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)} | barcode=${await pop.locator('svg rect, svg path').count()}`);
    const b = await pop.screenshot({ type: 'jpeg', quality: 70 }); console.log(`SHOT-BEGIN waybill-${w}`); console.log(b.toString('base64')); console.log('SHOT-END');
    await pop.close();
  });
  await step('carriers tab', async () => { await page.getByRole('button', { name: 'شركات الشحن', exact: true }).click(); await page.waitForTimeout(800); console.log(`TEXT ${w} carriers: ${(await text()).slice(0, 500)}`); });
  await step('insights tab', async () => { await page.getByRole('button', { name: 'تحليلات الشحن' }).click(); await page.waitForTimeout(800); console.log(`TEXT ${w} insights: ${(await text()).slice(0, 500)}`); await shot('insights'); });
  await page.goto(`${'http://localhost:4173'}/sales?tab=orders`); await page.waitForTimeout(7000);
  const nums = (await text()).match(/ORD-[\w-]+/g) || [];
  console.log(`TEXT ${w} store orders numbers: ${JSON.stringify(nums.slice(0, 6))} short-only=${/(^|\s)-\d{3}(\s|$)/.test(await text())}`);
  await shot('orders');
  console.log(`TEXT ${w} overflow=${await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)} ERRORS ${JSON.stringify(errors.slice(0, 4))}`);
  await context.close();
}
await browser.close();
