// One-off VERIFICATION run on the live site and database — READ-ONLY.
// No row is written: in the browser every non-GET REST/functions call is aborted
// (the invoice number is answered locally); API checks use GET and read-only RPCs.
// The one login-by-code call is signed out at once if it returns a session.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'https://wasel-alpha.vercel.app';
const ANON = process.env.ANON;
const PW = 'demo1234';
const READ_RPCS = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin',
  'get_public_merchant_legal', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/\s+/g, ' ').slice(0, 1200)}`);
const tokens = {};
async function tok(email) {
  if (tokens[email]) return tokens[email];
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  return (tokens[email] = await r.json());
}
async function api(email, path, init = {}) {
  const t = email ? (await tok(email)).access_token : ANON;
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { apikey: ANON, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt.slice(0, 200); }
  return { s: r.status, j, range: r.headers.get('content-range') };
}
const rpc = (email, fn, body = {}) => api(email, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) });
async function step(name, fn) { try { out(name, await fn()); } catch (e) { out(name, 'ERROR ' + e.message.slice(0, 300)); } }

const E = { cashier: 'demo-cashier@wasil.demo', employee: 'demo-employee@wasil.demo', owner: 'demo-distributor@wasil.demo',
  admin: 'demo-admin@wasil.demo', lite: 'demo-basic@wasil.demo', pro: 'demo-enterprise@wasil.demo' };

// ---------- API checks ----------
for (const who of ['cashier', 'employee']) {
  await step(`1.api.${who}`, async () => {
    const me = (await tok(E[who])).user?.id;
    const all = await api(E[who], 'sales?select=id,sold_by,total_amount&limit=1000');
    const others = Array.isArray(all.j) ? all.j.filter(s => s.sold_by !== me) : all.j;
    const items = await api(E[who], 'sale_items?select=id,cost_at_sale&limit=1000');
    const sup = await api(E[who], 'suppliers?select=id,name,phone&limit=100');
    const po = await api(E[who], 'purchase_orders?select=id,total_amount&limit=100');
    return { salesReadable: Array.isArray(all.j) ? all.j.length : all, ofThemNotMine: Array.isArray(others) ? others.length : others,
      othersRevenue: Array.isArray(others) ? others.reduce((a, s) => a + Number(s.total_amount), 0) : null,
      saleItemsWithCost: Array.isArray(items.j) ? items.j.filter(i => i.cost_at_sale != null).length : items,
      suppliersReadable: Array.isArray(sup.j) ? sup.j.length : sup, purchaseOrdersReadable: Array.isArray(po.j) ? po.j.length : po };
  });
}
await step('2.login-by-code.70035', async () => {
  const res = [];
  for (const code of ['70035', ' 70035 ']) {
    const r = await fetch(`${SUPA}/functions/v1/login-by-code`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const j = await r.json().catch(() => ({}));
    const at = j.session?.access_token;
    let signedOut = null, userCheck = null;
    if (at) {
      userCheck = (await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${at}` } })).status;
      signedOut = (await fetch(`${SUPA}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${at}` } })).status;
    }
    res.push({ code: JSON.stringify(code), http: r.status, gotSession: !!at, error: j.error || null, tokenValidUser: userCheck, signedOutStatus: signedOut });
  }
  return res;
});
await step('2.merchant_users-code-lookup-as-anon', async () => { const r = await api(null, 'merchant_users?select=id&login_code=eq.70035'); return { http: r.s, rows: Array.isArray(r.j) ? r.j.length : r.j }; });
for (const who of Object.keys(E)) {
  await step(`3.rpc.${who}`, async () => {
    const p = await rpc(E[who], 'my_permissions'); const s = await rpc(E[who], 'get_subscription_state');
    return { my_permissions: p.s === 200 ? { http: 200, count: p.j.length, sample: p.j.slice(0, 6) } : { http: p.s, code: p.j?.code },
      get_subscription_state: s.s === 200 ? { http: 200, plan: s.j.plan, status: s.j.effective_status ?? s.j.status } : { http: s.s, code: s.j?.code } };
  });
}
await step('4.api.lite', async () => {
  const me = await api(E.lite, 'merchant_users?select=merchant_id&limit=1');
  const mid = me.j?.[0]?.merchant_id;
  const br = await api(E.lite, `branches?select=id,name,is_active&merchant_id=eq.${mid}`);
  const sub = await api(E.lite, `subscriptions?select=plan,max_branches,plan_id&merchant_id=eq.${mid}`);
  const plan = sub.j?.[0]?.plan_id ? await api(E.lite, `plans?select=name,branch_limit,has_wholesale&id=eq.${sub.j[0].plan_id}`) : null;
  const buy = await rpc(E.lite, 'can_buy_wholesale'); const supply = await rpc(E.lite, 'can_supply_wholesale');
  const branchFn = await rpc(E.lite, 'enforce_branch_limit');
  return { activeBranches: Array.isArray(br.j) ? br.j.filter(b => b.is_active !== false).length : br.j, subscription: sub.j, plan: plan?.j,
    can_buy_wholesale: { http: buy.s, v: buy.j?.code || buy.j }, can_supply_wholesale: { http: supply.s, v: supply.j?.code || supply.j },
    marketVisible: (await api(E.lite, 'wholesale_listings?select=id&is_active=eq.true&limit=50')).j?.length };
});
await step('5.data', async () => {
  const ipo = await api(E.owner, 'devices?select=id,model,price,status&model=eq.ipo');
  const junk = await api(E.owner, 'accessories?select=id,name,price,quantity&id=eq.dd8cb3ae-c51f-4196-a4de-b1d3b0aa03d6');
  const lst = await api(E.owner, 'wholesale_listings?select=id,wholesale_price,min_quantity,is_active&id=in.(828cbf4e-bb2a-4b7e-b13c-01ce89039f2d,020b04c6-3314-42c7-ab1d-9b72d17f5a69)');
  const market = await api(E.pro, 'wholesale_listings?select=id,wholesale_price,min_quantity&is_active=eq.true&wholesale_price=lte.10');
  const neg = await api(E.owner, 'accessories?select=id&or=(price.lt.0,cost.lt.0,quantity.lt.0)');
  return { ipo: ipo.j, junkAccessory: junk.j, listings: lst.j, cheapListingsVisibleToBuyer: market.j, storedNegativeAccessories: neg.j };
});
await step('7.shipping-carriers', async () => {
  const t = (await tok(E.owner)).access_token;
  const r = await fetch(`${SUPA}/functions/v1/shipping-carriers`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }) });
  return { http: r.status, body: (await r.text()).slice(0, 300) };
});

// ---------- browser checks ----------
const browser = await chromium.launch({ channel: 'chrome' });
async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  const s = { page, ctx, blocked: [], reqs: [], mode: null, offline: false };
  await page.addInitScript(() => {
    window.__t = []; const seen = new WeakSet();
    new MutationObserver(() => document.querySelectorAll('[data-sonner-toast], li[role="status"]').forEach(el => {
      if (seen.has(el)) return; seen.add(el);
      setTimeout(() => window.__t.push((el.innerText || '').replace(/\s+/g, ' ').trim()), 60);
    })).observe(document, { childList: true, subtree: true });
    try { localStorage.setItem('language', 'ar'); } catch {}
  });
  await page.route(/supabase\.co\//, async route => {
    const req = route.request(); const m = req.method(); const u = req.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    s.reqs.push(`${m} ${decodeURIComponent(u.replace(SUPA, '')).slice(0, 300)}`);
    if (s.mode) { try { if (await s.mode(route, req, u, m)) return; } catch { return; } }
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (fn && READ_RPCS.has(fn)) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-0001"' });
    s.blocked.push(`${m} ${u.replace(SUPA, '').split('?')[0]}`);
    return route.abort(s.offline ? 'internetdisconnected' : 'blockedbyclient');
  });
  await page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await page.locator('#email').fill(email); await page.locator('#password').fill(PW);
  await page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }); await sleep(3000);
  return s;
}
const text = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
async function open(s, path) {
  await s.page.evaluate(() => { window.__t = []; }).catch(() => {});
  await s.page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const u = new URL(s.page.url()); return { url: u.pathname + u.search, text: await text(s.page), toasts: await s.page.evaluate(() => window.__t.join(' | ')).catch(() => '') };
}

for (const who of ['cashier', 'employee']) {
  const c = await session(E[who]);
  await step(`1.ui.${who}./reports`, async () => { const r = await open(c, '/reports'); return { url: r.url, toast: r.toasts, totalsShown: /إجمالي المبيعات/.test(r.text), excerpt: (r.text.match(/إجمالي المبيعات.{0,80}/) || [''])[0] }; });
  await step(`1.ui.${who}.history`, async () => { const r = await open(c, '/pos?tab=history'); return { url: r.url, deleteButtons: await c.page.getByRole('button', { name: 'حذف', exact: true }).count() }; });
  if (who === 'cashier') {
    await step('9.offline-sale', async () => {
      await open(c, '/pos');
      const scan = c.page.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
      await scan.click(); await scan.fill('ACC-004'); await scan.press('Enter'); await sleep(1500);
      await c.page.locator('button:has(svg.lucide-plus)').first().click().catch(() => {}); await sleep(500);
      const before = (await api(E.owner, `sales?select=id&created_at=gte.${new Date(Date.now() - 60000).toISOString()}`)).j;
      const tries = [];
      for (let i = 0; i < 2; i++) {
        await c.page.evaluate(() => { window.__t = []; }); c.offline = true;
        await c.page.getByRole('button', { name: /إتمام البيع/ }).click({ timeout: 8000 });
        const d = c.page.getByRole('dialog');
        await d.getByRole('button', { name: /كاش/ }).first().click().catch(() => {});
        const amt = d.locator('input[type="number"]').last(); if (await amt.count()) await amt.fill('300');
        await d.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }).click({ timeout: 8000 });
        await sleep(4000); tries.push(await c.page.evaluate(() => window.__t.join(' | ')));
        await c.page.keyboard.press('Escape').catch(() => {}); await sleep(500);
      }
      c.offline = false;
      const after = (await api(E.owner, `sales?select=id&created_at=gte.${new Date(Date.now() - 120000).toISOString()}`)).j;
      return { messages: tries, salesCreatedInWindow: Array.isArray(after) ? after.length : after, before: Array.isArray(before) ? before.length : before, writesStoppedInBrowser: c.blocked.filter(x => /sales|sale_items/.test(x)) };
    });
  }
  if (who === 'employee') {
    await step('6.employee.settings', async () => { const r = await open(c, '/settings?tab=general'); return { url: r.url, toast: r.toasts }; });
  }
  await c.ctx.close();
}
const b = await session(E.lite);
await step('4.ui.lite.wholesale', async () => { const r = await open(b, '/sales?tab=wholesale'); return { url: r.url, toast: r.toasts, wholesaleShown: /السوق، منتجاتك|سوق الجملة/.test(r.text), menuItem: await b.page.getByText('بيع الجملة', { exact: true }).count() }; });
await step('4.ui.lite.branches', async () => { const r = await open(b, '/settings?tab=branches'); return { url: r.url, excerpt: (r.text.match(/(\d+\s*\/\s*\d+|الفروع).{0,160}/) || [''])[0] }; });
await step('6.ui.lite./reports', async () => { const r = await open(b, '/reports'); return { url: r.url, toast: r.toasts }; });
await b.ctx.close();

const o = await session(E.owner);
await step('7.ui.manual-shipping', async () => { const r = await open(o, '/shipping'); return { url: r.url, toast: r.toasts, excerpt: r.text.slice(0, 300) }; });
const KPI = /\/rest\/v1\/(sales|devices|accessories|sale_items|repair_orders|online_orders|customers)\?/;
const kpi = () => o.page.evaluate(() => ({ loading: document.querySelectorAll('[role="status"][aria-label="جارٍ التحميل"]').length,
  failed: (document.body.innerText.match(/تعذّر تحميل القيمة/g) || []).length, ellipsis: /…/.test(document.querySelector('main')?.innerText || '') }));
await step('8.kpi.loading-then-data', async () => {
  o.mode = async (route, req, u, m) => { if (m === 'GET' && KPI.test(u)) { await sleep(3000); await route.continue().catch(() => {}); return true; } };
  await o.page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
  const during = await kpi(); let after = null, waited = 0;
  for (; waited < 40; waited++) { await sleep(1000); after = await kpi(); if (after.loading === 0) break; }
  o.mode = null; return { during, after, secondsUntilData: 2 + waited + 1, sample: ((await text(o.page)).match(/أجهزة في المخزون.{0,40}/) || [''])[0] };
});
await step('8.kpi.failure', async () => {
  o.mode = async (route, req, u, m) => { if (m === 'GET' && KPI.test(u)) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"qa"}' }); return true; } };
  await o.page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' }); await sleep(8000);
  const r = await kpi(); const banner = /تعذّر تحميل بيانات لوحة التحكم/.test(await text(o.page)); o.mode = null; return { ...r, banner };
});
await o.ctx.close();
await browser.close();
