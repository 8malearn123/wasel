// One-off: which published stores exist, and which belongs to the Max demo shop
import { chromium } from 'playwright';
const SITE = process.env.SITE;
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
});
const owner = await r.json();
const h = { apikey: ANON, Authorization: `Bearer ${owner.access_token}` };
const [m] = await (await fetch(`${SUPA}/rest/v1/merchant_users?select=merchant_id&user_id=eq.${owner.user.id}`, { headers: h })).json();
console.log('MAX merchant', m.merchant_id);
const mine = await (await fetch(`${SUPA}/rest/v1/store_settings?select=slug,store_name,is_published&merchant_id=eq.${m.merchant_id}`, { headers: h })).json();
console.log('MAX store', JSON.stringify(mine));
const pub = await (await fetch(`${SUPA}/rest/v1/store_settings?select=slug,store_name,merchant_id&is_published=eq.true`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })).json();
console.log('PUBLISHED', JSON.stringify(pub));
const browser = await chromium.launch();
for (const s of [...mine, ...pub].map(x => x.slug).filter((v, i, a) => v && a.indexOf(v) === i)) {
  const page = await browser.newPage();
  await page.goto(`${SITE}/store/${s}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  const products = await page.locator('a[href*="/device/"], a[href*="/accessory/"]').count();
  console.log(`STORE ${s}: ${products} product links`);
  await page.close();
}
await browser.close();
