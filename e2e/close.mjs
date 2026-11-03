// One-off READ-ONLY closing run. Every write is aborted in the browser before it leaves.
// Lines tagged LIVE use real data only; lines tagged MOCK replace one server answer in the browser.
import { chromium } from 'playwright';
const SITE = 'http://localhost:4173';
const PW = 'demo1234';
const READ = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 3000)}`);
async function step(n, f) { try { out(n, await f()); } catch (e) { out(n, 'ERROR ' + e.message.split('\n')[0].slice(0, 200)); } }
const browser = await chromium.launch({ channel: 'chrome' });
const isObjAccept = req => /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');

async function newSession({ mobile = false, mock = null } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar-SA' } : { viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const s = { ctx, errors: [], blocked: [], status: [], mock };
  await ctx.addInitScript(() => { window.__t = []; const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__t.push(el.innerText.replace(/\s+/g, ' ').trim()), 60); })).observe(document, { childList: true, subtree: true }); try { localStorage.setItem('language', 'ar'); } catch {} });
  await ctx.route(/supabase\.co\//, async route => {
    const r = route.request(); const m = r.method(); const u = r.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    if (s.mock && await s.mock(route, r)) return;
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || (fn && READ.has(fn))) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-1"' });
    s.blocked.push(`${m} ${u.split('/v1/')[1].split('?')[0]}`);
    return route.abort('blockedbyclient');
  });
  s.page = await ctx.newPage();
  s.page.on('pageerror', e => s.errors.push(e.message.slice(0, 140)));
  s.page.on('response', r => { if (r.status() >= 400 && /supabase\.co/.test(r.url())) s.status.push(`${r.status()} ${r.url().split('/v1/')[1]?.split('?')[0]}`); });
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
const toasts = p => p.evaluate(() => window.__t.join(' | ')).catch(() => '');
const clearToasts = p => p.evaluate(() => { window.__t = []; }).catch(() => {});
async function visit(p, path, w = 5000) {
  await clearToasts(p);
  await p.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(w);
  const u = new URL(p.url());
  return { landed: u.pathname + u.search, toast: (await toasts(p)).slice(0, 160) };
}
const bodyText = p => p.locator('body').innerText().then(t => t.replace(/\s+/g, ' ')).catch(() => '');
const menuOf = p => p.evaluate(() => [...document.querySelectorAll('aside a[href]')].map(a => a.getAttribute('href')));
const ADMIN = ['/admin', '/admin/companies', '/admin/plans', '/admin/branch-requests', '/admin/payouts', '/admin/reports', '/admin/activity', '/admin/tickets'];
const ADMIN_TITLES = { '/admin': 'نظرة عامة', '/admin/companies': 'الشركات', '/admin/plans': 'الباقات', '/admin/branch-requests': 'طلبات الفروع', '/admin/payouts': 'المدفوعات', '/admin/reports': 'التقارير', '/admin/activity': 'سجل النشاط', '/admin/tickets': 'تذاكر الدعم' };

async function openFirstEdit(p) {
  await p.locator('main tbody tr').first().locator('button:has(svg.lucide-ellipsis), button:has(svg.lucide-more-horizontal)').first().click(); await sleep(700);
  await p.getByRole('menuitem', { name: /تعديل/ }).first().click();
}
// ───────── 1. Platform admin pages ─────────
await step('LIVE|admin|signed-out', async () => {
  const s = await newSession(); const r = {};
  for (const path of ADMIN.slice(0, 3)) r[path] = (await visit(s.page, path, 4000)).landed;
  await s.ctx.close(); return r;
});
await step('LIVE|admin|shop-owner(Max)', async () => {
  const s = await newSession(); await login(s, 'demo-distributor@wasil.demo'); const r = {};
  for (const path of ADMIN) { const v = await visit(s.page, path, 4500); r[path] = `${v.landed} «${v.toast}»`; }
  r.errors = s.errors.slice(0, 3); r.blocked = s.blocked; await s.ctx.close(); return r;
});
const adminMock = async (route, req) => {
  if (req.method() === 'GET' && /\/rest\/v1\/platform_admins/.test(req.url())) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: isObjAccept(req) ? '{"id":"qa-mock"}' : '[{"id":"qa-mock"}]' });
    return true;
  }
  return false;
};
await step('MOCK|admin|pages(platform_admins answered «yes» in the browser)', async () => {
  const s = await newSession({ mock: adminMock }); await login(s, 'demo-distributor@wasil.demo'); const r = {};
  for (const path of ADMIN) {
    const t0 = Date.now(); const v = await visit(s.page, path, 7000);
    const h = await s.page.evaluate(() => [...document.querySelectorAll('main h1, main h2, header h1')].map(e => e.innerText.trim()).slice(0, 2));
    const btns = await s.page.evaluate(() => [...document.querySelectorAll('main button')].map(b => b.innerText.trim()).filter(Boolean));
    const spin = await s.page.locator('main .animate-spin').count();
    const empty = /لا توجد|لا يوجد/.test(await bodyText(s.page));
    r[path] = { landed: v.landed, heading: h, buttons: [...new Set(btns)].slice(0, 12), stillLoading: spin > 0, emptyText: empty, ms: Date.now() - t0 };
  }
  // side navigation between the pages
  await visit(s.page, '/admin', 6000); const nav = {};
  for (const path of ADMIN.slice(1)) {
    await s.page.locator(`aside >> text=${ADMIN_TITLES[path]}`).first().click().catch(() => {}); await sleep(3500);
    nav[path] = new URL(s.page.url()).pathname;
  }
  r.sideNav = nav;
  // one action dialog opened and cancelled (no write)
  await visit(s.page, '/admin/companies', 7000);
  let dialog = 'n/a';
  try {
    await s.page.locator('main .cursor-pointer, main [role="button"]').first().click(); await sleep(1200);
    await s.page.getByRole('button', { name: /ملاحظة/ }).first().click(); await sleep(800);
    dialog = await s.page.locator('[role="dialog"]').innerText().then(t => t.replace(/\s+/g, ' ').slice(0, 80));
    await s.page.getByRole('button', { name: 'إلغاء' }).click(); await sleep(600);
    dialog += ` | closed=${(await s.page.locator('[role="dialog"]').count()) === 0}`;
  } catch (e) { dialog = 'n/a ' + e.message.slice(0, 80); }
  r.noteDialog = dialog;
  r.detailsButton = await s.page.getByRole('button', { name: 'تفاصيل' }).count();
  r.errors = s.errors.slice(0, 4); r.http4xx5xx = [...new Set(s.status)].slice(0, 8); r.blocked = s.blocked;
  await s.ctx.close(); return r;
});
await step('MOCK|admin|check-fails(platform_admins answered 500)', async () => {
  const s = await newSession({ mock: async (route, req) => { if (/\/rest\/v1\/platform_admins/.test(req.url())) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"qa failure"}' }); return true; } return false; } });
  await login(s, 'demo-distributor@wasil.demo');
  const v = await visit(s.page, '/admin/companies', 12000);
  const b = await bodyText(s.page);
  const r = { landed: v.landed, message: b.includes('تعذّر التحقق من صلاحية مدير المنصة'), retry: await s.page.getByRole('button', { name: 'إعادة المحاولة' }).count() };
  await s.ctx.close(); return r;
});
await step('LIVE|admin|reload-keeps-page(mock admin)', async () => {
  const s = await newSession({ mock: adminMock }); await login(s, 'demo-distributor@wasil.demo');
  await visit(s.page, '/admin/plans', 6000); await s.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(6000);
  const r = new URL(s.page.url()).pathname; await s.ctx.close(); return r;
});

// ───────── 2. Invoice details (sales history) ─────────
async function invoiceDetails(label, email) {
  const s = await newSession(); await login(s, email); const p = s.page;
  const t0 = Date.now(); await visit(p, '/pos?tab=history', 3000);
  await p.getByText(/الأصناف/).first().waitFor({ timeout: 25000 }).catch(() => {});
  const loadMs = Date.now() - t0;
  const cards = p.locator('main .font-mono');
  const count = await cards.count();
  const res = { loadMs, invoices: count, checked: [] };
  for (let i = 0; i < Math.min(3, count); i++) {
    const card = p.locator('main [class*="rounded"]:has(.font-mono)').filter({ has: p.getByRole('button', { name: /الأصناف/ }) }).nth(i);
    const head = (await card.innerText()).replace(/\s+/g, ' ');
    const inv = head.match(/[A-Z]{2,}[-\w]*\d+/)?.[0];
    const total = Number((head.match(/([\d,]+(?:\.\d+)?) ر\.س/) || [])[1]?.replace(/,/g, '') || NaN);
    await card.getByRole('button', { name: /الأصناف/ }).click(); await sleep(900);
    const lines = (await card.innerText()).split('\n').filter(l => /×/.test(l));
    const sum = lines.reduce((a, l) => a + Number((l.match(/=\s*([\d,]+(?:\.\d+)?)/) || [])[1]?.replace(/,/g, '') || 0), 0);
    const date = head.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/)?.[0] || head.match(/(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)[^ ]* ?\d*/)?.[0];
    await card.getByRole('button', { name: /الأصناف/ }).click(); await sleep(500);
    const collapsed = (await card.innerText()).split('\n').filter(l => /×/.test(l)).length === 0;
    res.checked.push({ inv, total, itemsSum: Math.round(sum * 100) / 100, lines: lines.length, date, collapsed });
  }
  // edit dialog: open and cancel — never saved
  const edit = p.getByRole('button', { name: /^تعديل$/ }).first();
  res.editEnabled = await edit.isEnabled().catch(() => null);
  res.editTitle = await edit.getAttribute('title').catch(() => null);
  if (res.editEnabled) {
    await edit.click(); await sleep(900);
    res.editDialog = (await p.locator('[role="dialog"]').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 60);
    await p.getByRole('button', { name: 'إلغاء' }).click(); await sleep(600);
    res.editClosed = (await p.locator('[role="dialog"]').count()) === 0;
  }
  res.deleteButtons = await p.getByRole('button', { name: /^حذف$/ }).count();
  res.errors = s.errors.slice(0, 3); res.blocked = s.blocked;
  await s.ctx.close(); return res;
}
await step('LIVE|invoice|owner(Max)', () => invoiceDetails('owner', 'demo-distributor@wasil.demo'));
await step('LIVE|invoice|cashier(Max)', () => invoiceDetails('cashier', 'demo-cashier@wasil.demo'));
await step('MOCK|invoice|sales-read-fails', async () => {
  const s = await newSession({ mock: async (route, req) => { if (req.method() === 'GET' && /\/rest\/v1\/sales\?/.test(req.url())) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"qa failure","code":"XX000"}' }); return true; } return false; } });
  await login(s, 'demo-distributor@wasil.demo');
  const v = await visit(s.page, '/pos?tab=history', 16000);
  const b = await bodyText(s.page);
  const r = { toast: v.toast, emptyText: /لا توجد (فواتير|مبيعات)/.test(b), errorText: (b.match(/(تعذّر|تعذر|خطأ)[^.|]{0,60}/) || [])[0] || null };
  await s.ctx.close(); return r;
});

// ───────── 3. Roles by mock ─────────
let memberId = null;
const asRole = (role, snapshot) => async (route, req) => {
  const u = req.url();
  if (req.method() === 'GET' && /\/rest\/v1\/merchant_users\?/.test(u) && /user_id=eq\./.test(u)) {
    const resp = await route.fetch(); let body = await resp.text();
    try { const j = JSON.parse(body); const rows = Array.isArray(j) ? j : [j]; for (const r of rows) if (r && r.role) { memberId = r.id; if (role) r.role = role; } body = JSON.stringify(j); } catch {}
    await route.fulfill({ response: resp, body }); return true;
  }
  if (snapshot && req.method() === 'GET' && /\/rest\/v1\/activity_logs\?/.test(u) && /entity_type=eq\.custom_roles/.test(u)) {
    const data = { new_data: snapshot(memberId) };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObjAccept(req) ? data : [data]) }); return true;
  }
  return false;
};
const ROUTES = ['/', '/pos', '/products?tab=inventory', '/products?tab=stocktake', '/products?tab=transfers', '/products?tab=suppliers', '/sales?tab=orders', '/sales?tab=customers', '/sales?tab=repairs', '/sales?tab=closings', '/reports?tab=sales', '/team?tab=users', '/team?tab=employees', '/settings?tab=general', '/organization?tab=branches', '/subscription'];
async function roleAudit(s) {
  const p = s.page; const r = { menu: await menuOf(p), pages: {} };
  for (const path of ROUTES) {
    const v = await visit(p, path, 4500); const b = await bodyText(p);
    const denied = b.includes('لا تملك صلاحية عرض هذه الصفحة');
    const btns = await p.evaluate(() => [...document.querySelectorAll('main button')].map(x => x.innerText.trim()).filter(t => /إضافة|جديد|حذف|تعديل|اعتماد|موافقة/.test(t)));
    r.pages[path] = `${v.landed === path ? (denied ? 'DENIED-IN-PLACE' : 'OPEN') : '→' + v.landed}${v.toast ? ' «' + v.toast.slice(0, 50) + '»' : ''}${btns.length ? ' btns:' + [...new Set(btns)].slice(0, 5).join('/') : ''}`;
  }
  r.errors = s.errors.slice(0, 3); r.blocked = s.blocked; return r;
}
await step('MOCK|role|inventory_manager(cashier account, role answered as inventory_manager)', async () => {
  const s = await newSession({ mock: asRole('inventory_manager', null) }); await login(s, 'demo-cashier@wasil.demo');
  const r = await roleAudit(s); await s.ctx.close(); return r;
});
await step('MOCK|role|custom(cashier account given «دور اختبار QA»)', async () => {
  const snap = id => ({ roles: [{ id: 'qa-role', name: 'دور اختبار QA', description: null, permissions: ['products.view', 'pos.access', 'invoices.view', 'reports.view', 'customers.manage'] }], assignments: { [id]: 'qa-role' } });
  const s = await newSession({ mock: asRole(null, snap) }); await login(s, 'demo-cashier@wasil.demo');
  const r = await roleAudit(s); await s.ctx.close(); return r;
});

// ───────── 4. Writes intercepted (owner, Max) ─────────
await step('MOCK-WRITE|custom-role-create', async () => {
  const s = await newSession(); await login(s, 'demo-distributor@wasil.demo'); const p = s.page;
  await visit(p, '/team?tab=users', 6000);
  const r = {};
  try {
    await p.getByRole('button', { name: /إضافة مستخدم جديد/ }).click(); await sleep(1200);
    await p.getByText('إنشاء دور مخصص').click(); await sleep(1200);
    const dlg = p.locator('[role="dialog"]').last();
    await dlg.getByLabel('اسم الدور').fill('دور اختبار QA'); await dlg.getByText('الاطلاع على الفواتير').click();
    await clearToasts(p); await dlg.getByRole('button', { name: 'حفظ الدور' }).click(); await sleep(5000);
    r.toast = await toasts(p); r.inlineError = (await dlg.innerText().catch(() => '')).match(/(تعذّر|تعذر|لا يمكن|غير متاح|خطأ|الاتصال)[^\n]{0,70}/)?.[0] || null;
    r.dialogStillOpen = await dlg.isVisible().catch(() => false);
  } catch (e) { r.err = e.message.slice(0, 100); }
  r.blocked = s.blocked; await s.ctx.close(); return r;
});
await step('MOCK-WRITE|product-edit-save', async () => {
  const s = await newSession(); await login(s, 'demo-distributor@wasil.demo'); const p = s.page;
  await visit(p, '/products?tab=inventory', 7000); const r = {};
  try {
    await openFirstEdit(p);
    await sleep(1500);
    const dlg = p.locator('[role="dialog"]').last();
    r.opened = await dlg.isVisible();
    r.prefilled = await dlg.locator('input').evaluateAll(i => i.filter(x => x.value).length);
    await clearToasts(p); await dlg.getByRole('button', { name: /حفظ/ }).last().click(); await sleep(5000);
    r.toast = await toasts(p); r.dialogStillOpen = await dlg.isVisible().catch(() => false);
  } catch (e) { r.err = e.message.slice(0, 120); }
  r.blocked = s.blocked; await s.ctx.close(); return r;
});
await step('MOCK-WRITE|customer-create', async () => {
  const s = await newSession(); await login(s, 'demo-distributor@wasil.demo'); const p = s.page;
  await visit(p, '/sales?tab=customers', 7000); const r = {};
  try {
    await p.getByRole('button', { name: /إضافة عميل|عميل جديد/ }).first().click(); await sleep(1200);
    const dlg = p.locator('[role="dialog"]').last();
    const inputs = dlg.locator('input'); await inputs.nth(0).fill('عميل اختبار QA'); await inputs.nth(1).fill('0500000000').catch(() => {});
    await clearToasts(p); await dlg.getByRole('button', { name: /حفظ|إضافة/ }).last().click(); await sleep(5000);
    r.toast = await toasts(p); r.dialogStillOpen = await dlg.isVisible().catch(() => false);
  } catch (e) { r.err = e.message.slice(0, 120); }
  r.blocked = s.blocked; await s.ctx.close(); return r;
});
await step('MOCK-WRITE|pos-sale', async () => {
  const s = await newSession(); await login(s, 'demo-enterprise@wasil.demo'); const p = s.page;
  await visit(p, '/pos', 7000); const r = {};
  try {
    await p.locator('main button:has-text("ر.س")').first().click(); await sleep(1200);
    r.cartBefore = (await bodyText(p)).match(/الإجمالي[^ر]{0,30}ر\.س/)?.[0];
    await p.getByRole('button', { name: /الدفع|إتمام/ }).first().click(); await sleep(1500);
    const dlg = p.locator('[role="dialog"]').last();
    await clearToasts(p); await dlg.getByRole('button', { name: /تأكيد|إتمام|دفع/ }).last().click(); await sleep(6000);
    r.toast = await toasts(p); r.dialogStillOpen = await dlg.isVisible().catch(() => false);
    r.cartAfter = (await bodyText(p)).match(/الإجمالي[^ر]{0,30}ر\.س/)?.[0];
  } catch (e) { r.err = e.message.slice(0, 120); }
  r.blocked = s.blocked; await s.ctx.close(); return r;
});

// ───────── 5. Consistency re-check ─────────
for (const [label, email] of [['Lite', 'demo-basic@wasil.demo'], ['Pro', 'demo-enterprise@wasil.demo'], ['Max', 'demo-distributor@wasil.demo']]) {
  await step(`LIVE|consistency|${label}`, async () => {
    const s = await newSession(); await login(s, email); const p = s.page; const r = { menu: await menuOf(p) };
    for (const path of ['/sales?tab=wholesale', '/reports?tab=sales', '/products?tab=stocktake', '/sales?tab=customers', '/admin']) { const v = await visit(p, path, 4500); r[path] = `${v.landed}${v.toast ? ' «' + v.toast.slice(0, 45) + '»' : ''}`; }
    const banners = {};
    for (const path of ['/ai-insights', '/team?tab=attendance', '/team?tab=devices', '/settings?tab=policy']) { const v = await visit(p, path, 4500); banners[path] = v.landed !== path ? '→' + v.landed : (await bodyText(p)).includes('بيانات تجريبية') ? 'banner' : 'NO-BANNER'; }
    r.mockBanners = banners;
    const pv = await visit(p, '/products?tab=inventory', 6000);
    try { await openFirstEdit(p); await sleep(2500); r.mediaNotice = ((await p.locator('[role="dialog"]').innerText().catch(() => '')).match(/معرض صور المنتجات[^\n]{0,40}|تعذّر تحميل صور المنتج|لا توجد صور لهذا المنتج/) || [null])[0]; } catch { r.mediaNotice = 'n/a'; }
    r.errors = s.errors.slice(0, 3); r.blocked = s.blocked; await s.ctx.close(); return r;
  });
}
await step('LIVE|mobile|Lite+Max', async () => {
  const r = {};
  for (const [label, email] of [['Lite', 'demo-basic@wasil.demo'], ['Max', 'demo-distributor@wasil.demo']]) {
    const s = await newSession({ mobile: true }); await login(s, email); const over = [];
    for (const path of ['/', '/pos', '/products?tab=inventory', '/team?tab=users', '/settings?tab=general']) { await visit(s.page, path, 4000); const w = await s.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (w > 2) over.push(`${path}:${w}`); }
    r[label] = { overflow: over, errors: s.errors.slice(0, 2) }; await s.ctx.close();
  }
  return r;
});
await browser.close();
