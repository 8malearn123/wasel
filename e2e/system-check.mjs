// One-off, read only: the translation and SEO fixes on this branch's build, live data.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const ANON = process.env.ANON;
const s = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }) })).json();
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const [lang, path, want, bad] of [
  ['ar', '/sales?tab=seo', /عنوان|SEO|محركات/, /JSON object requested/],
  ['ar', '/team?tab=payroll', /مدير النظام|دور مخصص/, /(^|\s)(admin|custom)(\s|$)/],
  ['ar', '/products?tab=labels', /ر\.س/, /\d SAR/],
  ['ar', '/sales?tab=marketing', /ر\.س/, /\d SAR/],
  ['en', '/products?tab=stocktake', /items|discrepancies/, /(^|\s)(عنصر|تباين)(\s|$)/],
  ['en', '/organization?tab=support', /Open:|All:/, /مفتوحة:|الكل:/],
  ['en', '/sales?tab=orders', /SMSA Express|Aramex/, /سمسا إكسبريس|أرامكس/],
  ['en', '/products?tab=inventory', /Black|Gray|Blue/, /(^|\s)(أسود|رمادي|أزرق)(\s|$)/],
]) {
  const context = await browser.newContext({ locale: lang, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v, l]) => { localStorage.setItem(k, v); localStorage.setItem('language', l); }, ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(s), lang]);
  await context.route(`${SUPA}/rest/v1/**`, r => ['GET', 'HEAD'].includes(r.request().method()) || r.request().url().includes('/rpc/') ? r.continue() : r.abort());
  const page = await context.newPage();
  await page.goto(`${SITE}${path}`); await page.waitForTimeout(6000);
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const ok = want.test(text) && !bad.test(text);
  console.log(`CHECK ${lang} ${path} ${ok ? 'PASS' : 'FAIL'} want=${(text.match(want) || ['-'])[0]} bad=${(text.match(bad) || ['-'])[0]}`);
  await context.close();
}
await browser.close();
