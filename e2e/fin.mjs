// One-off READ-ONLY financial accuracy check. Raw data is read through the API
// (paged, read only) and every figure recomputed here, in Riyadh time; the app's
// report screens are then read with the browser in Riyadh time and compared.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const ANON = process.env.ANON;
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 3800)}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = x => Math.round(x * 100) / 100;
const TZ = 'Asia/Riyadh';
const dayKSA = iso => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const monthKSA = iso => dayKSA(iso).slice(0, 7);
const dayUTC = iso => new Date(iso).toISOString().slice(0, 10);

async function token(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  return (await r.json()).access_token;
}
async function all(path, t) {
  const rows = []; let from = 0; const size = 500;
  for (;;) {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${t}`, Range: `${from}-${from + size - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact' } });
    const page = await r.json(); if (!Array.isArray(page)) throw new Error(JSON.stringify(page).slice(0, 200));
    rows.push(...page); const total = Number((r.headers.get('content-range') || '').split('/')[1]);
    if (page.length < size || rows.length >= total) return { rows, total };
    from += size;
  }
}

const browser = await chromium.launch({ channel: 'chrome' });
for (const [label, email] of [['Max', 'demo-distributor@wasil.demo'], ['Pro', 'demo-enterprise@wasil.demo']]) {
  const t = await token(email);
  const me = await (await fetch(`${SUPA}/rest/v1/merchant_users?select=merchant_id&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${t}` } })).json();
  const M = me[0].merchant_id;
  const { rows: sales, total: salesTotal } = await all(`sales?select=*,items:sale_items(*)&merchant_id=eq.${M}&order=sale_date.desc`, t);
  const { rows: devices } = await all(`devices?select=id,status,price,cost,branch_id&merchant_id=eq.${M}`, t);
  const { rows: accessories } = await all(`accessories?select=id,quantity,price,cost,branch_id&merchant_id=eq.${M}`, t);
  const { rows: branches } = await all(`branches?select=id,name&merchant_id=eq.${M}&is_active=eq.true`, t);
  const { rows: closings } = await all(`daily_closings?select=*&merchant_id=eq.${M}&order=closing_date.desc`, t).catch(() => ({ rows: [] }));
  const { rows: pos } = await all(`purchase_orders?select=id,total_amount,paid_amount,payment_status,status,supplier_id&merchant_id=eq.${M}`, t).catch(() => ({ rows: [] }));

  // ── integrity of each invoice
  const issues = { totalMismatch: [], itemsVsSubtotal: [], missingCost: 0, zeroCostLines: 0, negative: [], nullItems: 0 };
  for (const s of sales) {
    const calc = r2(Number(s.subtotal) - Number(s.discount_amount || 0) + Number(s.tax_amount || 0));
    if (Math.abs(calc - Number(s.total_amount)) > 0.05) issues.totalMismatch.push(`${s.invoice_number}: ${s.subtotal}-${s.discount_amount}+${s.tax_amount}=${calc} vs ${s.total_amount}`);
    const items = s.items || []; if (!items.length) issues.nullItems++;
    const lines = r2(items.reduce((a, i) => a + Number(i.unit_price) * Number(i.quantity || 1), 0));
    if (items.length && Math.abs(lines - Number(s.subtotal)) > 0.05) issues.itemsVsSubtotal.push(`${s.invoice_number}: lines ${lines} vs subtotal ${s.subtotal}`);
    for (const i of items) { if (i.cost_at_sale === null || i.cost_at_sale === undefined) issues.missingCost++; else if (Number(i.cost_at_sale) === 0) issues.zeroCostLines++; }
    if (Number(s.total_amount) < 0) issues.negative.push(s.invoice_number);
  }
  const cost = s => (s.items || []).reduce((a, i) => a + Number(i.cost_at_sale || 0) * Number(i.quantity || 1), 0);
  const agg = list => {
    const gross = r2(list.reduce((a, s) => a + Number(s.total_amount), 0));
    const vat = r2(list.reduce((a, s) => a + Number(s.tax_amount || 0), 0));
    const disc = r2(list.reduce((a, s) => a + Number(s.discount_amount || 0), 0));
    const c = r2(list.reduce((a, s) => a + cost(s), 0));
    return { count: list.length, grossInclVat: gross, vat, discounts: disc, netExVat: r2(gross - vat), cost: c, profitAsAppComputes: r2(gross - c), profitCorrect: r2(gross - vat - c) };
  };
  const now = new Date(); const todayK = dayKSA(now.toISOString()); const monthK = todayK.slice(0, 7);
  const prevMonthK = (() => { const [y, m] = monthK.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 15)); return d.toISOString().slice(0, 7); })();
  const byMonth = {}; for (const s of sales) (byMonth[monthKSA(s.sale_date)] ??= []).push(s);
  const monthly = Object.fromEntries(Object.entries(byMonth).sort().map(([k, v]) => [k, agg(v)]));
  // the app's last-month window ends at 00:00 of the last day (new Date(y, m, 0))
  const lastDayOfPrev = (() => { const [y, m] = monthK.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10); })();
  const onLastDay = sales.filter(s => dayKSA(s.sale_date) === lastDayOfPrev);
  // KSA day vs UTC day: the daily chart buckets by UTC
  const shiftedDay = sales.filter(s => dayKSA(s.sale_date) !== dayUTC(s.sale_date)).map(s => `${s.invoice_number} ${s.sale_date} → KSA ${dayKSA(s.sale_date)} / chart ${dayUTC(s.sale_date)}`);
  const byBranch = Object.fromEntries(branches.map(b => [b.name, agg(sales.filter(s => s.branch_id === b.id))]));
  const orphanBranch = sales.filter(s => !branches.some(b => b.id === s.branch_id)).length;
  const byMethod = {}; for (const s of sales) (byMethod[s.payment_method] ??= []).push(s);
  const byStatus = {}; for (const s of sales) (byStatus[s.payment_status] ??= []).push(s);
  const stocked = devices.filter(d => d.status !== 'sold');
  const inv = { devicesInStock: stocked.length, forSale: devices.filter(d => d.status === 'available').length, deviceRetail: r2(stocked.reduce((a, d) => a + Number(d.price || 0), 0)), deviceCost: r2(stocked.reduce((a, d) => a + Number(d.cost || 0), 0)), accessoryRetail: r2(accessories.reduce((a, x) => a + Number(x.price || 0) * Number(x.quantity || 0), 0)), accessoryCost: r2(accessories.reduce((a, x) => a + Number(x.cost || 0) * Number(x.quantity || 0), 0)) };
  inv.retailValue = r2(inv.deviceRetail + inv.accessoryRetail);
  const top = [...devices].sort((a, b) => Number(b.price) - Number(a.price)).slice(0, 3).map(d => `${d.status}:${d.price}`);
  const topAcc = [...accessories].sort((a, b) => Number(b.price) * Number(b.quantity) - Number(a.price) * Number(a.quantity)).slice(0, 3).map(a => `${a.price}×${a.quantity}`);
  const supplierDue = r2(pos.filter(p => p.payment_status !== 'paid').reduce((a, p) => a + Number(p.total_amount || 0) - Number(p.paid_amount || 0), 0));

  out(`${label}|raw`, { merchant: M, salesTotalOnServer: salesTotal, salesRead: sales.length, over1000: salesTotal > 1000, all: agg(sales), today: agg(sales.filter(s => dayKSA(s.sale_date) === todayK)), thisMonth: agg(byMonth[monthK] || []), prevMonth: agg(byMonth[prevMonthK] || []), lastDayOfPrevMonth: { day: lastDayOfPrev, invoices: onLastDay.length, total: r2(onLastDay.reduce((a, s) => a + Number(s.total_amount), 0)) } });
  out(`${label}|monthly`, monthly);
  out(`${label}|branches`, { byBranch, salesWithoutActiveBranch: orphanBranch });
  out(`${label}|methods`, Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, agg(v).grossInclVat])));
  out(`${label}|paymentStatus`, Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, `${v.length} / ${agg(v).grossInclVat}`])));
  out(`${label}|inventory`, { ...inv, topDevicePrices: top, topAccessoryValues: topAcc });
  out(`${label}|integrity`, { ...issues, totalMismatch: issues.totalMismatch.slice(0, 6), itemsVsSubtotal: issues.itemsVsSubtotal.slice(0, 6), totalMismatchCount: issues.totalMismatch.length, itemsVsSubtotalCount: issues.itemsVsSubtotal.length });
  out(`${label}|dayShift`, { count: shiftedDay.length, examples: shiftedDay.slice(0, 4) });
  out(`${label}|suppliers`, { purchaseOrders: pos.length, dueComputed: supplierDue });
  out(`${label}|closings`, closings.slice(0, 4).map(c => Object.fromEntries(Object.entries(c).filter(([k]) => /date|total|expected|actual|cash|card|difference|sales/i.test(k)))));

  // ── what the app shows (browser in Riyadh time, read-only)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA', timezoneId: TZ });
  await ctx.addInitScript(() => { try { localStorage.setItem('language', 'ar'); } catch {} });
  await ctx.route(/supabase\.co\//, route => { const r = route.request(); if (!/\/(rest|functions|storage)\/v1\//.test(r.url()) || ['GET', 'HEAD', 'OPTIONS'].includes(r.method()) || /\/rpc\/(my_permissions|get_subscription_state|get_user_merchant_id|is_platform_admin|has_permission)/.test(r.url())) return route.continue(); return route.abort('blockedbyclient'); });
  const p = await ctx.newPage();
  await p.goto(`${SITE}/auth`); await sleep(2000);
  await p.getByRole('tab', { name: /دخول بالإيميل/ }).click(); await p.locator('#email').fill(email); await p.locator('#password').fill('demo1234');
  await p.getByRole('button', { name: /تسجيل الدخول/ }).click(); await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {}); await sleep(4000);
  const cardsOf = () => p.evaluate(() => [...document.querySelectorAll('main [class*="rounded"]')].filter(e => e.children.length < 8 && /ر\.س|٪|%/.test(e.innerText) && e.innerText.length < 160).map(e => e.innerText.replace(/\s+/g, ' ')).slice(0, 12));
  await p.goto(`${SITE}/`); await sleep(9000);
  out(`${label}|app:dashboard`, await cardsOf());
  await p.goto(`${SITE}/reports?tab=sales`); await sleep(9000);
  out(`${label}|app:sales`, await cardsOf());
  await p.goto(`${SITE}/reports?tab=table-sales`); await sleep(9000);
  const period = await p.locator('main button, main [role="combobox"]').allInnerTexts();
  out(`${label}|app:table-sales`, { stats: await cardsOf(), controls: period.map(x => x.trim()).filter(Boolean).slice(0, 10), rowsInfo: (await p.locator('main').innerText()).match(/(\d+)\s*(من|of)\s*(\d+)|عرض[^\n]{0,40}/g)?.slice(0, 3) });
  // try «all time» if the table has a period control
  const allBtn = p.locator('main button, [role="option"]').filter({ hasText: /كل الفترات|الكل|كل الوقت/ }).first();
  if (await allBtn.count()) { await allBtn.click().catch(() => {}); await sleep(2500); out(`${label}|app:table-sales(all)`, await cardsOf()); }
  await p.goto(`${SITE}/reports?tab=employees`); await sleep(8000);
  out(`${label}|app:employees`, (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 700));
  await p.goto(`${SITE}/reports?tab=inventory`); await sleep(8000);
  out(`${label}|app:inventory`, await cardsOf());
  await p.goto(`${SITE}/sales?tab=closings`); await sleep(8000);
  out(`${label}|app:closings`, (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  await ctx.close();
}
await browser.close();
// re-run after 00fb089
