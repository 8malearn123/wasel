// One-off, read only: every reported issue, re-checked on the live site.
// Writes are blocked. Each line: CHECK <id> <PASS|FAIL|INFO> <evidence>.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'https://wasel-alpha.vercel.app';
const ANON = process.env.ANON;
const login = async email => (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234' }) })).json();
const S = {};
for (const w of ['distributor', 'enterprise', 'basic', 'cashier', 'employee']) S[w] = await login(`demo-${w}@wasil.demo`);
const out = (id, ok, ev) => console.log(`CHECK ${id} ${ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL'} ${ev}`);

// 5. RPCs
for (const fn of ['my_permissions', 'get_subscription_state', 'wholesale_parties']) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${S.distributor.access_token}`, 'Content-Type': 'application/json' }, body: '{}' });
  out(`rpc-${fn}`, r.status !== 404, `HTTP ${r.status}`);
}
const html = await (await fetch(SITE)).text();
out('deploy', null, `bundle ${(html.match(/assets\/index-[^"]+\.js/) || ['?'])[0]}`);

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
async function open(who, path, { w = 1440, lang = 'ar' } = {}) {
  const context = await browser.newContext({ locale: lang, viewport: { width: w, height: w > 500 ? 900 : 844 } });
  await context.addInitScript(([k, v, l]) => { localStorage.setItem(k, v); localStorage.setItem('language', l); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(S[who]), lang]);
  await context.route(`${SUPA}/rest/v1/**`, r => ['GET', 'HEAD'].includes(r.request().method()) || r.request().url().includes('/rpc/') ? r.continue() : r.abort());
  const page = await context.newPage();
  const toasts = new Set(); const fails = [];
  await page.exposeFunction('__toast', t => toasts.add(t));
  await page.addInitScript(() => new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => window.__toast?.(el.innerText.replace(/\s+/g, ' ').trim()))).observe(document, { childList: true, subtree: true }));
  page.on('response', r => { if (r.status() === 404 && r.url().includes('/rpc/')) fails.push(r.url().split('/rpc/')[1]); });
  await page.goto(`${SITE}${path}`); await page.waitForTimeout(8000);
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  return { page, context, text, toasts, fails };
}
const num = s => Number(String(s).replace(/,/g, ''));

// excerpts for the numbers and plans, read by a person
for (const [who, path, keys] of [
  ['distributor', '/', ['في المخزون', 'قيمة المخزون', 'مباع', 'المبيعات']],
  ['distributor', '/products?tab=inventory', ['كل الأجهزة', 'قيمة المخزون', 'في المخزون']],
  ['distributor', '/reports', ['حالة الأجهزة', 'قيمة المخزون', 'عدد الفواتير']],
  ['enterprise', '/subscription', ['باقة', 'الفروع', 'المستخدمين']],
  ['basic', '/subscription', ['باقة', 'الفروع', 'المستخدمين']],
  ['enterprise', '/organization?tab=branches', ['فرع', '/']],
]) {
  const x = await open(who, path);
  for (const k of keys) { let i = -1, n = 0; while ((i = x.text.indexOf(k, i + 1)) >= 0 && n++ < 3) console.log(`EXCERPT ${who} ${path} [${k}] …${x.text.slice(Math.max(0, i - 70), i + 90)}…`); }
  await x.context.close();
}
await browser.close();
