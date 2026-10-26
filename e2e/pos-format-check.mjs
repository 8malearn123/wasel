// One-off, read only: the distributor demo adds the screenshot's two items to
// the till's cart on the live site and reads the totals. Writes are blocked.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: process.env.ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
})).json();
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const lang of ['en', 'ar']) {
  const context = await browser.newContext({ locale: lang, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v, l]) => { localStorage.setItem(k, v); localStorage.setItem('language', l); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session), lang]);
  await context.route(`${SUPA}/rest/v1/**`, r => ['GET', 'HEAD'].includes(r.request().method()) || r.request().url().includes('/rpc/') ? r.continue() : r.abort());
  const page = await context.newPage();
  const res = await page.goto(`${process.env.SITE}/pos`); await page.waitForTimeout(9000);
  const html = await (await fetch(`${process.env.SITE}/`)).text();
  console.log(`TEXT ${lang} bundle: ${(html.match(/assets\/index-[^"]+\.js/) || ['?'])[0]} status ${res?.status()}`);
  for (const name of ['Xiaomi 14', '20000']) {
    try { await page.getByText(name, { exact: false }).first().click({ timeout: 6000 }); await page.waitForTimeout(800); console.log(`OK   ${lang} add ${name}`); }
    catch (e) { console.log(`FAIL ${lang} add ${name}: ${e.message.split('\n')[0]}`); }
  }
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const i = body.search(/Subtotal|المجموع الفرعي/);
  console.log(`TEXT ${lang} totals: ${i < 0 ? 'NOT FOUND' : body.slice(i, i + 260)}`);
  console.log(`TEXT ${lang} 3-decimals: ${JSON.stringify(body.match(/\d[\d,]*\.\d{3}\b/g) || [])}`);
  const b = await page.screenshot({ type: 'jpeg', quality: 72 }); console.log(`SHOT-BEGIN pos-${lang}`); console.log(b.toString('base64')); console.log('SHOT-END');
  await context.close();
}
await browser.close();
