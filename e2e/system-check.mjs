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

// 1-2. counts and stock value: dashboard / products / reports
{
  const d = await open('distributor', '/'); const p = await open('distributor', '/products?tab=inventory'); const r = await open('distributor', '/reports');
  const grab = (t, re) => (t.match(re) || [])[1];
  const dash = { stock: grab(d.text, /([\d,]+)\s*(?:جهاز(?:اً)?)?\s*في المخزون/), value: grab(d.text, /قيمة المخزون\D{0,30}([\d,]{4,})/) };
  const prod = { header: grab(p.text, /(كل الأجهزة · [^ا]{0,80}مباع)/), value: grab(p.text, /قيمة المخزون\D{0,30}([\d,]{4,})/) };
  const rep = { status: grab(r.text, /حالة الأجهزة\D{0,40}?([\d,]+)\s*أجهزة/), value: grab(r.text, /قيمة المخزون\D{0,30}([\d,]{4,})/) };
  out('counts', null, `dashboard ${JSON.stringify(dash)} | products ${JSON.stringify(prod)} | reports ${JSON.stringify(rep)}`);
  out('stock-value-same', !!(prod.value && rep.value && prod.value === rep.value), `products ${prod.value} reports ${rep.value} dashboard ${dash.value}`);
  out('rpc-404-in-browser', d.fails.length === 0, `404 rpc calls on dashboard: ${JSON.stringify([...new Set(d.fails)])}`);
  out('kpi-no-ellipsis', !/(^|\s)…(\s|$)/.test(d.text), `dashboard ellipsis placeholders: ${(d.text.match(/(^|\s)…(\s|$)/g) || []).length}`);
  for (const x of [d, p, r]) await x.context.close();
}
// 3. plans
for (const [who, want] of [['enterprise', /برو|Pro/], ['basic', /لايت|Lite|أساسي|Basic/]]) {
  const s = await open(who, '/subscription');
  const plan = (s.text.match(/باقة\s+\S+/) || [''])[0]; const br = (s.text.match(/(\d+)\s*\/\s*(\d+)\s*(?:فروع|فرع)/) || s.text.match(/الفروع\D{0,15}(\d+)\s*\/\s*(\d+)/) || []);
  out(`plan-${who}`, want.test(s.text), `${plan} branches ${br[1] ?? '?'}/${br[2] ?? '?'}`);
  await s.context.close();
}
{ const r = await open('enterprise', '/reports'); out('pro-has-reports', !r.page.url().includes('/subscription'), r.page.url()); await r.context.close(); }
{ const r = await open('basic', '/reports'); out('lite-no-reports-with-message', r.page.url().includes('/subscription') && [...r.toasts].some(t => /باقتك/.test(t)), `${r.page.url()} | ${[...r.toasts].join(' / ')}`); await r.context.close(); }
// 4. wholesale details for a buyer
{
  const w = await open('enterprise', '/sales?tab=wholesale');
  const row = (w.text.match(/منتجات متاحة من موزعين(.{0,250})/) || [, ''])[1];
  out('wholesale-names', !/(^|\s)—(\s|$)/.test(row) && /متجر|Apple|iPhone/.test(row), row.slice(0, 200));
  await w.context.close();
}
// 6. POS numbers + phone layout
for (const w of [1440, 390]) {
  const p = await open('distributor', '/pos', { w });
  const prices = (p.text.match(/[\d,]+(?:\.\d+)?\s*ر\.س/g) || []).slice(0, 6);
  out(`pos-format-${w}`, !/\d\.\d{3}\b/.test(p.text) && !/\.00\s*ر\.س/.test(p.text), `prices ${JSON.stringify(prices)}`);
  if (w < 500) out('pos-phone-products-visible', /الأجهزة \(\d+\)/.test(p.text), (p.text.match(/الأجهزة \(\d+\)/) || ['no product grid'])[0]);
  await p.context.close();
}
// 9. redirects
for (const [who, path] of [['employee', '/subscription'], ['cashier', '/shipping']]) {
  const r = await open(who, path);
  out(`denied-${who}${path}`, !r.page.url().endsWith(path) && r.toasts.size > 0, `${new URL(r.page.url()).pathname} | ${[...r.toasts].join(' / ')}`);
  await r.context.close();
}
// 10-11. order numbers, shipping page
{
  const o = await open('distributor', '/sales?tab=orders');
  const nums = o.text.match(/ON-DEMO-\d+/g) || [];
  out('order-numbers-full', nums.length > 0 && !/(^|\s)-0\d\d(\s|$)/.test(o.text), JSON.stringify([...new Set(nums)]));
  await o.context.close();
  const s = await open('distributor', '/shipping');
  out('shipping-real', /بانتظار الشحن/.test(s.text) && /ON-DEMO/.test(s.text) && !/بيانات تجريبية|mock/i.test(s.text), (s.text.match(/بانتظار الشحن \d+ في الطريق \d+ تم التسليم \d+/) || ['?'])[0]);
  await s.context.close();
}
// 7. invoice labels in the sales history (an existing invoice)
{
  const h = await open('distributor', '/pos?tab=history');
  out('invoice-history-open', null, (h.text.match(/سجل المبيعات.{0,200}/) || [''])[0].slice(0, 200));
  await h.context.close();
}
// 14. Camera
{ const p = await open('distributor', '/pos'); out('camera-arabic', /كاميرا/.test(p.text) && !/\bCamera\b/.test(p.text), (p.text.match(/كاميرا|Camera/g) || []).join(',')); await p.context.close(); }
await browser.close();
