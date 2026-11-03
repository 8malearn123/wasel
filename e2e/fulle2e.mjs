// One-off READ-ONLY full E2E of claude/frontend-regression-fixes against the live data.
// Every non-GET request is aborted in the browser (read-only RPCs pass; the invoice number is answered locally).
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const PW = 'demo1234';
const READ = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 2500)}`);
async function step(n, f) { try { out(n, await f()); } catch (e) { out(n, 'ERROR ' + e.message.split('\n')[0].slice(0, 200)); } }
const LEAVES = {
  '/products': ['inventory', 'stocktake', 'transfers', 'suppliers', 'labels'],
  '/sales': ['orders', 'repairs', 'closings', 'store', 'seo', 'customers', 'marketing', 'wholesale'],
  '/team': ['employees', 'attendance', 'devices', 'payroll', 'users'],
  '/settings': ['general', 'notifications', 'policy'],
  '/organization': ['branches', 'support'],
  '/reports': ['sales', 'table-sales', 'inventory', 'table-devices', 'table-accessories', 'parts', 'deadstock', 'employees', 'table-suppliers', 'table-customers'],
  '/pos': ['pos', 'history'],
  '/shipping': ['shipments', 'carriers', 'insights'],
};
const PAGES = ['/', '/ai-insights', '/subscription', ...Object.entries(LEAVES).flatMap(([p, ls]) => ls.map(l => `${p}?tab=${l}`))];
const browser = await chromium.launch({ channel: 'chrome' });

function wire(ctx, s) {
  ctx.on('page', p => attach(p, s));
}
async function attach(page, s) {
  page.on('pageerror', e => s.errors.push(e.message.slice(0, 140)));
  page.on('request', r => { const u = r.url(); const m = u.match(/merchant_id=eq\.([0-9a-f-]{36})/); if (m) s.merchantIds.add(m[1]); });
  await page.addInitScript(() => { window.__t = []; const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__t.push(el.innerText.replace(/\s+/g, ' ').trim()), 60); })).observe(document, { childList: true, subtree: true }); try { localStorage.setItem('language', 'ar'); } catch {} });
  await page.route(/supabase\.co\//, async route => {
    const r = route.request(); const m = r.method(); const u = r.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || (fn && READ.has(fn))) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-1"' });
    s.blocked.push(`${m} ${u.replace(SUPA, '').split('?')[0]}`);
    return route.abort('blockedbyclient');
  });
}
async function newSession(mobile = false) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar-SA' } : { viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const s = { ctx, errors: [], blocked: [], merchantIds: new Set() };
  wire(ctx, s);
  s.page = await ctx.newPage(); await sleep(100);
  return s;
}
async function login(s, email) {
  const p = s.page;
  await p.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await p.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await p.locator('#email').fill(email); await p.locator('#password').fill(PW);
  await p.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {}); await sleep(4000);
}
const reasonOf = t => /غير متاحة في باقتك/.test(t) ? 'PLAN' : /ليست لديك صلاحية/.test(t) ? 'PERM' : /لحساب الكاشير/.test(t) ? 'CASHIER' : '';
async function visit(page, path, w = 4500) {
  await page.evaluate(() => { window.__t = []; }).catch(() => {});
  await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(w);
  const u = new URL(page.url()); const t = await page.evaluate(() => window.__t.join(' | ')).catch(() => '');
  return { landed: u.pathname + u.search, reason: reasonOf(t), toast: t.slice(0, 120) };
}
const outcome = (p, r) => r.landed === p ? (r.reason ? `OPEN+${r.reason}` : 'OPEN') : `→${r.landed}${r.reason ? ' [' + r.reason + ']' : ''}`;
const bodyText = page => page.locator('body').innerText().then(t => t.replace(/\s+/g, ' ')).catch(() => '');

async function planAudit(label, email) {
  const s = await newSession(); const p = s.page;
  await login(s, email);
  const shop = (await bodyText(p)).match(/متجر ديمو - [^ ]+ [^ ]+/)?.[0] || '';
  // sidebar
  const menu = await p.evaluate(() => [...document.querySelectorAll('aside a[href]')].map(a => `${(a.innerText || '').trim()}=${a.getAttribute('href')}`));
  out(`${label}|shop+menu`, { shop, menu });
  // every page: direct, reload, new tab
  const res = {}; const allowed = [];
  for (const path of PAGES) {
    const a = await visit(p, path);
    await p.evaluate(() => { window.__t = []; }); await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(4000);
    const rl = { landed: new URL(p.url()).pathname + new URL(p.url()).search };
    const np = await s.ctx.newPage(); await sleep(100);
    const nt = await visit(np, path, 4000); await np.close();
    const o = outcome(path, a);
    res[path] = o + (rl.landed !== a.landed ? ` RELOAD→${rl.landed}` : '') + (nt.landed !== a.landed ? ` NEWTAB→${nt.landed}` : '');
    if (o === 'OPEN') allowed.push(path);
  }
  out(`${label}|pages`, res);
  // internal links inside allowed pages
  const hrefs = new Map();
  for (const path of allowed) {
    await visit(p, path, 3500);
    const hs = await p.evaluate(() => [...document.querySelectorAll('main a[href^="/"]')].map(a => [a.getAttribute('href'), (a.innerText || '').trim().slice(0, 30)]));
    for (const [h, txt] of hs) if (!h.startsWith('/store/') && !hrefs.has(h)) hrefs.set(h, `${path} «${txt}»`);
  }
  const linkRes = {};
  for (const [h, from] of hrefs) { const r = await visit(p, h, 3500); if (r.reason || (r.landed.split('?')[0] !== h.split('?')[0])) linkRes[h] = `${from} → ${r.landed}${r.reason ? ' [' + r.reason + ']' : ''}`; }
  out(`${label}|internal-links`, { checked: hrefs.size, redirectedOrRefused: linkRes });
  // dashboard cards, alerts, notifications, search
  await visit(p, '/', 6000);
  const dash = await bodyText(p);
  const cards = ['إيرادات اليوم', 'الوحدات المباعة اليوم', 'أجهزة في المخزون', 'الإكسسوارات المتاحة', 'طلبات صيانة مفتوحة', 'مستحقات الموردين', 'أوامر شراء غير مدفوعة', 'تحويلات بانتظار الموافقة', 'تحويل معلق'].filter(c => dash.includes(c));
  let bell = [];
  try { await p.locator('header button:has(svg.lucide-bell)').first().click(); await sleep(1500); bell = (await p.locator('[role="menu"], [data-radix-popper-content-wrapper]').allInnerTexts()).join(' ').replace(/\s+/g, ' ').slice(0, 400); await p.keyboard.press('Escape'); } catch (e) { bell = 'n/a'; }
  let search = [];
  for (const q of ['ا', '1']) {
    try {
      const box = p.getByPlaceholder(/ابحث عن أجهزة/).first(); await box.click(); await box.fill(q); await sleep(2500);
      search.push((await p.locator('header, [role="listbox"], [cmdk-list]').allInnerTexts()).join(' ').replace(/\s+/g, ' ').match(/(#R[\w-]+|#RO[\w-]+|صيانة|طلب صيانة|عميل)/g)?.slice(0, 6) || []);
      await box.fill(''); await p.keyboard.press('Escape');
    } catch { search.push('n/a'); }
  }
  out(`${label}|dashboard-notices-search`, { cards, bell, searchHits: search });
  // section nav tabs as shown
  const tabs = {};
  for (const sec of ['/products', '/sales', '/team', '/reports']) { await visit(p, sec, 4000); tabs[sec] = await p.evaluate(() => [...document.querySelectorAll('main nav button, main [role="tab"]')].map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 16)); }
  out(`${label}|section-tabs`, tabs);
  out(`${label}|merchant-ids-in-requests`, [...s.merchantIds]);
  out(`${label}|errors`, s.errors.slice(0, 5));
  return s;
}

async function scenarios(label, s) {
  const p = s.page;
  // POS: search, add, qty, remove, totals, pay dialog
  await step(`${label}|pos-flow`, async () => {
    await visit(p, '/pos', 5000);
    const scan = p.getByPlaceholder(/امسح رقم IMEI أو الباركود/);
    await scan.click(); await scan.fill('ACC-004'); await scan.press('Enter'); await sleep(1500);
    const added = /حماية شاشة/.test(await bodyText(p));
    const plus = p.locator('button:has(svg.lucide-plus)').first(); await plus.click().catch(() => {}); await sleep(500);
    const t1 = (await bodyText(p)).match(/الإجمالي[^ر]{0,30}ر\.س/)?.[0];
    await p.locator('button:has(svg.lucide-minus)').first().click().catch(() => {}); await sleep(500);
    const t2 = (await bodyText(p)).match(/الإجمالي[^ر]{0,30}ر\.س/)?.[0];
    await p.getByRole('button', { name: /إتمام البيع/ }).click(); await sleep(1200);
    const dlg = (await p.getByRole('dialog').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220);
    await p.keyboard.press('Escape'); await sleep(500);
    await p.locator('button:has(svg.lucide-trash-2), button:has(svg.lucide-x)').first().click().catch(() => {}); await sleep(600);
    const emptied = /السلة فارغة|لا توجد منتجات في السلة|أضف منتجات/.test(await bodyText(p));
    return { added, totalAfterPlus: t1, totalAfterMinus: t2, payDialog: dlg, removedToEmpty: emptied, writes: s.blocked.length };
  });
  await step(`${label}|invoice-history`, async () => {
    await visit(p, '/pos?tab=history', 5000);
    const rows = await p.locator('main').innerText().then(t => (t.match(/INV-[\d-]+/g) || []).length);
    await p.locator('main button:has-text("INV-"), main [role="button"]:has-text("INV-"), main tr:has-text("INV-")').first().click().catch(() => {}); await sleep(1500);
    const detail = (await p.getByRole('dialog').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    await p.keyboard.press('Escape');
    return { invoicesListed: rows, detail };
  });
  await step(`${label}|stock-consistency`, async () => {
    await visit(p, '/', 6000); const d = await bodyText(p);
    const dash = d.match(/أجهزة في المخزون\s*(\d+)/)?.[1];
    await visit(p, '/products?tab=inventory', 6000); const pr = await bodyText(p);
    const prod = pr.match(/(\d+)\s*·\s*\d+\s*مباع/)?.[0] || pr.match(/الأجهزة[^0-9]{0,20}(\d+)/)?.[0];
    let rep = null;
    const r = await visit(p, '/reports?tab=inventory', 6000);
    if (r.landed.includes('/reports')) rep = (await bodyText(p)).match(/\d+\s*·\s*متاح[^)]{0,60}/)?.[0];
    return { dashboardDevices: dash, productsPage: prod, reportsInventory: rep };
  });
  await step(`${label}|customers-flow`, async () => {
    const r = await visit(p, '/sales?tab=customers', 5000);
    if (!r.landed.includes('customers')) return { skipped: `→${r.landed} ${r.reason}` };
    const link = await p.locator('main a[href^="/customers/"]').first().getAttribute('href').catch(() => null);
    if (!link) { await p.locator('main tr, main [role="button"]').nth(1).click().catch(() => {}); await sleep(2000); return { detailUrl: new URL(p.url()).pathname }; }
    const d = await visit(p, link, 5000);
    return { link, landed: d.landed, hasOrders: /الطلبات|المشتريات|الفواتير/.test(await bodyText(p)), back: await p.goBack().then(() => new URL(p.url()).pathname + new URL(p.url()).search).catch(() => null) };
  });
  await step(`${label}|suppliers-flow`, async () => {
    const r = await visit(p, '/products?tab=suppliers', 5000);
    if (!r.landed.includes('suppliers')) return { skipped: `→${r.landed} ${r.reason}` };
    const t = await bodyText(p);
    const r2 = await visit(p, '/products?tab=suppliers&sub=orders', 5000);
    return { suppliersShown: /المورد|موردين/.test(t), ordersTab: r2.landed, poShown: /PO-|أمر شراء/.test(await bodyText(p)) };
  });
  await step(`${label}|shipping-flow`, async () => {
    const r = await visit(p, '/shipping?tab=shipments', 5000);
    const t = await bodyText(p);
    return { landed: r.landed, toShip: t.match(/بانتظار الشحن\s*(\d+)/)?.[1], shipButtons: await p.getByRole('button', { name: 'شحن الطلب' }).count(), manualNote: /يدويًا/.test(t) };
  });
}

// ---------- plans ----------
const PLANS = [['Lite', 'demo-basic@wasil.demo'], ['Pro', 'demo-enterprise@wasil.demo'], ['Max', 'demo-distributor@wasil.demo']];
for (const [label, email] of PLANS) {
  const s = await planAudit(label, email);
  await scenarios(label, s);
  await s.ctx.close();
}
// ---------- mobile per plan ----------
for (const [label, email] of PLANS) {
  const s = await newSession(true); await login(s, email);
  const o = {};
  for (const path of ['/', '/pos', '/products?tab=inventory', '/sales?tab=closings', '/organization?tab=branches', '/subscription', '/reports', '/sales?tab=customers']) {
    const r = await visit(s.page, path, 4000);
    o[path] = { landed: r.landed, overflowX: await s.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) };
  }
  out(`${label}|mobile`, o); await s.ctx.close();
}
// ---------- switching accounts in one browser ----------
await step('switch Max→Lite→Max', async () => {
  const s = await newSession(); const p = s.page;
  await login(s, 'demo-distributor@wasil.demo');
  const max1 = await visit(p, '/sales?tab=wholesale');
  await p.locator('header button').last().click().catch(() => {}); await sleep(800);
  await p.getByRole('menuitem', { name: /تسجيل الخروج/ }).click().catch(() => {}); await sleep(3000);
  const afterLogout = new URL(p.url()).pathname;
  await login(s, 'demo-basic@wasil.demo');
  const liteShop = (await bodyText(p)).match(/متجر ديمو - [^ ]+ [^ ]+/)?.[0];
  const liteWholesale = await visit(p, '/sales?tab=wholesale');
  const liteReports = await visit(p, '/reports');
  const liteMenu = await p.evaluate(() => [...document.querySelectorAll('aside a[href]')].map(a => a.getAttribute('href')));
  await p.locator('header button').last().click().catch(() => {}); await sleep(800);
  await p.getByRole('menuitem', { name: /تسجيل الخروج/ }).click().catch(() => {}); await sleep(3000);
  await login(s, 'demo-distributor@wasil.demo');
  const max2 = await visit(p, '/sales?tab=wholesale');
  const ids = [...s.merchantIds];
  await s.ctx.close();
  return { max1: outcome('/sales?tab=wholesale', max1), afterLogout, liteShop, liteWholesale: outcome('/sales?tab=wholesale', liteWholesale), liteReports: outcome('/reports', liteReports), liteMenuHasReports: liteMenu.includes('/reports'), max2: outcome('/sales?tab=wholesale', max2), merchantIdsSeen: ids.length };
});
// ---------- roles in Max ----------
for (const [label, email] of [['Max/admin', 'demo-admin@wasil.demo'], ['Max/cashier', 'demo-cashier@wasil.demo'], ['Max/employee', 'demo-employee@wasil.demo']]) {
  const s = await newSession(); const p = s.page; await login(s, email);
  const menu = await p.evaluate(() => [...document.querySelectorAll('aside a[href]')].map(a => (a.innerText || '').trim()));
  const res = {};
  for (const path of PAGES) res[path] = outcome(path, await visit(p, path, 3500));
  const actions = {};
  for (const path of ['/products?tab=inventory', '/pos?tab=history', '/team?tab=users', '/organization?tab=branches']) {
    const r = await visit(p, path, 4500);
    actions[path] = r.landed !== path ? `→${r.landed}` : await p.evaluate(() => [...document.querySelectorAll('main button')].map(b => (b.innerText || '').trim()).filter(t => /إضافة|حذف|تعديل|طلب|جديد/.test(t)).slice(0, 8));
  }
  // financial figures visible?
  await visit(p, '/', 5000);
  const fin = (await bodyText(p)).match(/(إيرادات اليوم|إجمالي الربح|إجمالي التكاليف|مستحقات الموردين)/g);
  out(`${label}|access`, { menu, pages: res, actions, financialOnHome: fin, errors: s.errors.slice(0, 3) });
  await s.ctx.close();
}
await browser.close();
