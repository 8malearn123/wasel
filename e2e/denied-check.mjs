// One-off, read only: each demo account opens a page its plan or role does not
// allow; prints where it ends up and the message shown, on the live site and
// on this branch. Writes are blocked.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const login = async email => (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234' }) })).json();
const CASES = [
  ['demo-basic', '/reports'],
  ['demo-basic', '/sales?tab=wholesale'],
  ['demo-basic', '/marketing'],
  ['demo-cashier', '/reports'],
  ['demo-cashier', '/shipping'],
  ['demo-cashier', '/subscription'],
  ['demo-employee', '/subscription'],
  ['demo-employee', '/settings'],
];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const sessions = {};
for (const [site, base] of [['live', 'https://wasel-alpha.vercel.app'], ['branch', 'http://localhost:4173']]) {
  for (const [who, path] of CASES) {
    sessions[who] ??= await login(`${who}@wasil.demo`);
    const context = await browser.newContext({ locale: 'ar', viewport: { width: 1280, height: 800 } });
    await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
      ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(sessions[who])]);
    await context.route(`${SUPA}/rest/v1/**`, r => ['GET', 'HEAD'].includes(r.request().method()) || r.request().url().includes('/rpc/') ? r.continue() : r.abort());
    const page = await context.newPage();
    const toasts = new Set();
    await page.exposeFunction('__toast', t => toasts.add(t));
    await page.addInitScript(() => new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => window.__toast?.(el.innerText.replace(/\s+/g, ' ').trim()))).observe(document, { childList: true, subtree: true }));
    await page.goto(`${base}${path}`); await page.waitForTimeout(7000);
    const url = new URL(page.url()); const end = url.pathname + url.search;
    const moved = end !== path;
    const shown = [...toasts].filter(t => !/تمت|Added/.test(t));
    const inPlace = (await page.locator('body').innerText()).match(/ليست لديك صلاحية[^\n]*|غير متاحة في باقتك[^\n]*|ترقية الباقة|تتطلب باقة[^\n]*/)?.[0];
    const verdict = !moved ? (inPlace ? 'stays, explains in page' : 'stays') : shown.length ? 'moved WITH message' : 'moved SILENTLY';
    console.log(`TEXT ${site} | ${who} ${path} → ${end} | ${verdict} | ${shown.join(' / ') || inPlace || '-'}`);
    await context.close();
  }
}
await browser.close();
