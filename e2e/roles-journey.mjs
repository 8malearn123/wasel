// One-off READ-ONLY role journeys: customer, cashier, accountant (mock role), owner, platform admin (mock).
// Every write is aborted in the browser before it leaves. LIVE = real data read-only; MOCK = one answer replaced.
import { chromium } from 'playwright';
const SITE = 'http://localhost:4173';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const PW = 'demo1234';
const READ = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission', 'get_public_merchant_legal']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 3500)}`);
const browser = await chromium.launch({ channel: 'chrome' });
const isObjAccept = req => /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
const KNOWN_404 = /my_permissions|get_subscription_state|wholesale_parties|wholesale_listing_items|\/roles|\/permissions|\/employees|product_media/;
// Latin-only UI labels that should be Arabic (brand/model names and codes allowed)
const ALLOW = /^(PIXA|IMEI|QR|API|SKU|VAT|CSV|PDF|SEO|B2B|SAR|iPhone|Samsung|Galaxy|Apple|AirPods|USB|Type-C|mAh|GB|TB|Pro|Max|Mini|Plus|Ultra|OK|ID|URL|SMS|Mada|Visa|Mastercard|Apple Pay|STC Pay|[A-Z0-9#\-_. :/]+|.*\d.*)$/i;

async function session({ mobile = false, mock = null, label }) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar-SA' } : { viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const s = { ctx, label, errors: [], console: [], blocked: [], http: [], notes: [], steps: [] };
  await ctx.addInitScript(() => { window.__t = []; const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__t.push(el.innerText.replace(/\s+/g, ' ').trim()), 60); })).observe(document, { childList: true, subtree: true }); try { localStorage.setItem('language', 'ar'); } catch {} });
  await ctx.route(/supabase\.co\//, async route => {
    const r = route.request(); const m = r.method(); const u = r.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    if (mock && await mock(route, r)) return;
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || (fn && (READ.has(fn) || /^(get_public|track_|lookup_)/.test(fn)))) return route.continue();
    if (fn === 'generate_invoice_number') return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-QA-LOCAL-1"' });
    s.blocked.push(`${m} ${u.split('/v1/')[1].split('?')[0]}`);
    return route.abort('blockedbyclient');
  });
  s.page = await ctx.newPage();
  s.page.on('pageerror', e => s.errors.push(e.message.slice(0, 160)));
  s.page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|blockedbyclient|ERR_BLOCKED/i.test(m.text())) s.console.push(m.text().slice(0, 160)); });
  s.page.on('response', r => { const u = r.url(); if (r.status() >= 400 && /supabase\.co|localhost/.test(u) && !KNOWN_404.test(u)) s.http.push(`${r.status()} ${u.replace(SUPA, '').replace(SITE, '').split('?')[0]}`); });
  return s;
}
const toasts = p => p.evaluate(() => window.__t.join(' | ')).catch(() => '');
const clearToasts = p => p.evaluate(() => { window.__t = []; }).catch(() => {});
const body = p => p.locator('body').innerText().then(t => t.replace(/\s+/g, ' ')).catch(() => '');
async function englishLeftovers(p) {
  return p.evaluate(src => {
    const allow = new RegExp(src, 'i');
    const els = [...document.querySelectorAll('button, label, h1, h2, h3, h4, th, [role="tab"], [role="menuitem"], [data-sonner-toast], [role="dialog"] p, main p')];
    const bad = new Set();
    for (const e of els) {
      if (!e.offsetParent && e.getAttribute('role') !== 'dialog') continue;
      const t = (e.innerText || '').trim().replace(/\s+/g, ' ');
      if (!t || t.length < 4 || t.length > 60) continue;
      if (/[؀-ۿ]/.test(t)) continue;
      if (!/[a-z]{3,}/i.test(t)) continue;
      if (allow.test(t)) continue;
      bad.add(t);
    }
    return [...bad].slice(0, 8);
  }, ALLOW.source).catch(() => []);
}
async function overflow(p) { return p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0); }
async function step(s, name, fn) {
  const p = s.page; await clearToasts(p); const t0 = Date.now(); let res;
  try { res = await fn(p); } catch (e) { res = { ERROR: e.message.split('\n')[0].slice(0, 160) }; }
  const ms = Date.now() - t0; const t = await toasts(p); const en = await englishLeftovers(p); const ov = await overflow(p);
  const rec = { step: name, ms, url: new URL(p.url()).pathname + new URL(p.url()).search, ...(typeof res === 'object' ? res : { result: res }) };
  if (t) rec.toast = t.slice(0, 220);
  if (en.length) rec.englishUI = en;
  if (ov > 2) rec.overflowPx = ov;
  s.steps.push(rec); out(`${s.label}|${name}`, rec);
}
async function finish(s) {
  out(`${s.label}|SUMMARY`, { jsErrors: [...new Set(s.errors)].slice(0, 6), consoleErrors: [...new Set(s.console)].slice(0, 8), httpErrors: [...new Set(s.http)].slice(0, 10), writesBlocked: s.blocked });
  await s.ctx.close();
}
async function go(p, path, w = 5000) { await p.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(w); }
async function login(s, email) {
  const p = s.page;
  await go(p, '/auth', 2000);
  await p.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await p.locator('#email').fill(email); await p.locator('#password').fill(PW);
  const t0 = Date.now();
  await p.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {});
  const ms = Date.now() - t0; await sleep(3500); return ms;
}
const has = (b, re) => re.test(b);
const firstMatch = (b, re) => (b.match(re) || [])[0] || null;

// ───────────────────────── 1. CUSTOMER (anonymous, storefront) ─────────────────────────
let slug = null;
try {
  const r = await fetch(`${SUPA}/rest/v1/store_settings?select=slug,store_name,is_published&is_published=eq.true&limit=5`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const rows = await r.json(); out('customer|stores', rows); slug = rows.find(x => /distrib|ماكس|max/i.test(`${x.slug} ${x.store_name}`))?.slug || rows[0]?.slug;
} catch (e) { out('customer|stores', 'ERROR ' + e.message); }
for (const mobile of [false, true]) {
  const s = await session({ mobile, label: mobile ? 'CUSTOMER(mobile)' : 'CUSTOMER(desktop)' });
  if (!slug) { out(`${s.label}|skip`, 'no published store'); await finish(s); continue; }
  await step(s, 'open store home', async p => { await go(p, `/store/${slug}`, 7000); const b = await body(p); return { title: await p.title(), hasProducts: has(b, /ر\.س/), brokenImages: await p.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0).length), snippet: b.slice(0, 160) }; });
  await step(s, 'browse all products', async p => { await go(p, `/store/${slug}/products`, 6000); const cards = await p.locator('a[href*="/device/"], a[href*="/accessory/"]').count(); return { productLinks: cards }; });
  await step(s, 'search "ايفون"', async p => { const box = p.locator('input[type="search"], input[placeholder*="بحث"], input[placeholder*="ابحث"]').first(); if (!(await box.count())) return { searchBox: false }; await box.fill('ايفون'); await sleep(2500); const n = await p.locator('a[href*="/device/"], a[href*="/accessory/"]').count(); await box.fill('iphone'); await sleep(2500); const n2 = await p.locator('a[href*="/device/"], a[href*="/accessory/"]').count(); await box.fill(''); return { resultsArabic: n, resultsLatin: n2 }; });
  let productUrl = null;
  await step(s, 'open a product', async p => { const a = p.locator('a[href*="/device/"], a[href*="/accessory/"]').first(); productUrl = await a.getAttribute('href'); await a.click(); await sleep(4000); const b = await body(p); return { href: productUrl, price: firstMatch(b, /[\d,]+(\.\d+)?\s*ر\.س/), addToCart: await p.getByRole('button', { name: /إضافة للسلة|أضف للسلة/ }).count() }; });
  await step(s, 'add to cart + open cart', async p => { await p.getByRole('button', { name: /إضافة للسلة|أضف للسلة/ }).first().click(); await sleep(1500); await go(p, `/store/${slug}/cart`, 3500); const b = await body(p); return { cartEmpty: has(b, /السلة فارغة|لا توجد منتجات/), total: firstMatch(b, /الإجمالي[^ر]{0,25}ر\.س/), plusBtn: await p.locator('button:has(svg.lucide-plus)').count() }; });
  await step(s, 'increase quantity', async p => { const plus = p.locator('main button:has(svg.lucide-plus)').first(); if (await plus.count()) { await plus.click(); await sleep(1000); } const b = await body(p); return { total: firstMatch(b, /الإجمالي[^ر]{0,25}ر\.س/) }; });
  await step(s, 'checkout: empty submit', async p => { await go(p, `/store/${slug}/checkout`, 4500); const btns = (await p.locator('main button').allInnerTexts()).map(x => x.trim()).filter(Boolean); const submit = p.getByRole('button', { name: /تأكيد الطلب|إتمام الطلب|اطلب الآن|إرسال الطلب/ }).first(); let disabled = null; if (await submit.count()) { disabled = await submit.isDisabled(); if (!disabled) { await submit.click(); await sleep(1500); } } const b = await body(p); return { buttons: btns.slice(0, 10), submitDisabled: disabled, validation: firstMatch(b, /(مطلوب|أدخل|يرجى|الرجاء)[^.]{0,50}/) }; });
  await step(s, 'checkout: fill and place order (write blocked)', async p => {
    const name = p.locator('input[autocomplete="name"]').first(); if (await name.count()) await name.fill('عميل اختبار');
    const tel = p.locator('input[autocomplete="tel"]').first(); if (await tel.count()) await tel.fill('0500000000');
    const conf = p.getByRole('button', { name: /متابعة|تأكيد البيانات|حفظ/ }).first(); if (await conf.count()) { await conf.click().catch(() => {}); await sleep(800); }
    const submit = p.getByRole('button', { name: /تأكيد الطلب|إتمام الطلب|اطلب الآن|إرسال الطلب/ }).first();
    let r = { submitFound: await submit.count() > 0 };
    if (r.submitFound) { r.submitDisabled = await submit.isDisabled(); if (!r.submitDisabled) { await submit.click(); await sleep(5000); } }
    const b = await body(p); r.landed = new URL(p.url()).pathname; r.thankYou = has(b, /شكرًا|شكراً|تم استلام طلبك/); r.message = firstMatch(b, /(تعذّر|تعذر|العنوان|اختر)[^.]{0,70}/); return r;
  });
  await step(s, 'track an order that does not exist', async p => { await go(p, `/store/${slug}/track`, 3500); const ins = p.locator('main input'); if (await ins.count() >= 2) { await ins.nth(0).fill('ORD-000000'); await ins.nth(1).fill('1234'); await p.getByRole('button', { name: /تتبع|بحث|عرض/ }).first().click().catch(() => {}); await sleep(3500); } const b = await body(p); return { message: firstMatch(b, /(لم نجد|غير موجود|لا يوجد|تعذّر|تحقق)[^.]{0,70}/) }; });
  await step(s, 'unknown store link', async p => { await go(p, `/store/no-such-store-qa`, 5000); const b = await body(p); return { message: b.slice(0, 140) }; });
  await finish(s);
}

// ───────────────────────── 2. CASHIER (live, Max shop) ─────────────────────────
{
  const s = await session({ label: 'CASHIER' }); const p = s.page;
  await step(s, 'login', async () => ({ loginMs: await login(s, 'demo-cashier@wasil.demo'), landed: new URL(p.url()).pathname, menu: await p.evaluate(() => [...document.querySelectorAll('aside a[href]')].map(a => (a.innerText || '').trim() || a.getAttribute('href'))) }));
  await step(s, 'POS: search a product by name', async p => { await go(p, '/pos', 6000); const box = p.locator('main input').first(); await box.fill('شاحن'); await sleep(2000); const n = await p.locator('main button:has-text("ر.س")').count(); await box.fill(''); await sleep(800); return { results: n }; });
  await step(s, 'POS: unknown IMEI / barcode', async p => { const box = p.locator('main input').first(); await box.fill('000000000000000'); await box.press('Enter'); await sleep(2500); const b = await body(p); await box.fill(''); return { message: firstMatch(b, /(لم يتم العثور|غير موجود|لا توجد نتائج|لا يوجد)[^.]{0,60}/) }; });
  await step(s, 'POS: add two items and change qty', async p => { const items = p.locator('main button:has-text("ر.س")'); await items.nth(0).click(); await sleep(700); await items.nth(1).click().catch(() => {}); await sleep(700); const plus = p.locator('main button:has(svg.lucide-plus)').first(); await plus.click().catch(() => {}); await sleep(600); const b = await body(p); return { total: firstMatch(b, /الإجمالي\s*[\d,.]+\s*ر\.س/), tax: firstMatch(b, /الضريبة[^ر]{0,20}ر\.س/) }; });
  await step(s, 'POS: wrong coupon', async p => { const c = p.locator('input[placeholder*="كوبون"], input[placeholder*="الكوبون"]').first(); if (!(await c.count())) { await p.getByRole('button', { name: 'إتمام البيع' }).click(); await sleep(1200); } const c2 = p.locator('input[placeholder*="كوبون"], input[placeholder*="الكوبون"], [role="dialog"] input[placeholder*="كود"]').first(); if (!(await c2.count())) return { couponBox: false }; await c2.fill('NOPE-QA'); await p.getByRole('button', { name: /تطبيق/ }).first().click().catch(() => {}); await sleep(2500); const b = await body(p); return { message: firstMatch(b, /(غير صالح|غير موجود|منتهي|خطأ)[^.]{0,50}/) }; });
  await step(s, 'POS: cash less than due', async p => { if (!(await p.locator('[role="dialog"]').count())) { await p.getByRole('button', { name: 'إتمام البيع' }).click(); await sleep(1200); } const d = p.locator('[role="dialog"]').last(); await d.getByText('كاش', { exact: true }).click().catch(() => {}); await sleep(400); const cash = d.locator('input[inputmode="decimal"], input[type="number"]').last(); await cash.fill('1').catch(() => {}); await sleep(600); const confirm = p.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }); return { confirmEnabledWithTooLittleCash: await confirm.isEnabled().catch(() => null), hint: firstMatch(await d.innerText(), /(المبلغ|غير كاف|أقل)[^\n]{0,50}/) }; });
  await step(s, 'POS: pay exact cash (write blocked)', async p => { const d = p.locator('[role="dialog"]').last(); const cash = d.locator('input[inputmode="decimal"], input[type="number"]').last(); await cash.fill('').catch(() => {}); await sleep(300); const confirm = p.getByRole('button', { name: /تأكيد الدفع وإصدار الفاتورة/ }); await confirm.click(); await sleep(7000); const b = await body(p); return { cartKept: has(b, /الإجمالي\s*[1-9]/), receipt: has(b, /طباعة الفاتورة|تمت عملية البيع/) }; });
  await step(s, 'history: my invoices', async p => { await go(p, '/pos?tab=history', 6000); const b = await body(p); return { invoices: await p.locator('main .font-mono').count(), deleteButtons: await p.getByRole('button', { name: /^حذف$/ }).count(), snippet: b.slice(b.indexOf('سجل المبيعات'), b.indexOf('سجل المبيعات') + 160) }; });
  for (const path of ['/', '/reports?tab=sales', '/sales?tab=closings', '/settings?tab=general', '/team?tab=users', '/products?tab=inventory']) {
    await step(s, `try ${path}`, async p => { await go(p, path, 4500); const b = await body(p); return { deniedInPlace: b.includes('لا تملك صلاحية عرض هذه الصفحة'), addButtons: (await p.locator('main button').allInnerTexts()).filter(t => /إضافة|جديد|حذف/.test(t)).slice(0, 4) }; });
  }
  await step(s, 'end of shift: daily closing', async p => { await go(p, '/sales?tab=closings', 4500); const b = await body(p); return { canClose: has(b, /إغلاق اليوم|إقفال/), denied: b.includes('لا تملك صلاحية') }; });
  await step(s, 'logout', async p => { const btn = p.locator('button:has-text("تسجيل الخروج"), [role="menuitem"]:has-text("تسجيل الخروج")').first(); if (!(await btn.count())) { await p.locator('header button').last().click().catch(() => {}); await sleep(600); } await p.locator('button:has-text("تسجيل الخروج"), [role="menuitem"]:has-text("تسجيل الخروج")').first().click().catch(() => {}); await sleep(3000); return { landed: new URL(p.url()).pathname }; });
  await finish(s);
}

// ───────────────────────── 3. ACCOUNTANT (mock custom role on the cashier account) ─────────────────────────
{
  let memberId = null;
  const ACCT = ['dashboard.view', 'invoices.view', 'reports.view', 'closings.manage', 'suppliers.manage', 'products.view'];
  const mock = async (route, req) => {
    const u = req.url();
    if (req.method() === 'GET' && /\/rest\/v1\/merchant_users\?/.test(u) && /user_id=eq\./.test(u)) { const resp = await route.fetch(); const txt = await resp.text(); try { const j = JSON.parse(txt); const rows = Array.isArray(j) ? j : [j]; for (const r of rows) if (r?.id) memberId = r.id; } catch {} await route.fulfill({ response: resp, body: txt }); return true; }
    if (req.method() === 'GET' && /\/rest\/v1\/activity_logs\?/.test(u) && /entity_type=eq\.custom_roles/.test(u)) { const data = { new_data: { roles: [{ id: 'acct', name: 'محاسب', description: null, permissions: ACCT }], assignments: { [memberId]: 'acct' } } }; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObjAccept(req) ? data : [data]) }); return true; }
    return false;
  };
  const s = await session({ label: 'ACCOUNTANT(mock role)', mock }); const p = s.page;
  await step(s, 'login', async () => ({ loginMs: await login(s, 'demo-cashier@wasil.demo'), landed: new URL(p.url()).pathname, menu: await p.evaluate(() => [...document.querySelectorAll('aside a[href]')].map(a => a.getAttribute('href'))) }));
  await step(s, 'dashboard KPIs', async p => { await go(p, '/', 8000); const b = await body(p); return { revenueToday: firstMatch(b, /إيرادات اليوم\s*[\d,.]+/), stillLoading: await p.locator('main .animate-pulse, main .animate-spin').count() }; });
  for (const tab of ['sales', 'table-sales', 'inventory', 'table-suppliers', 'deadstock']) {
    await step(s, `report ${tab}`, async p => { await go(p, `/reports?tab=${tab}`, 7000); const b = await body(p); const exp = p.getByRole('button', { name: /تصدير|CSV|Excel|PDF/ }).first(); return { empty: has(b, /لا توجد بيانات|لا توجد نتائج/), denied: b.includes('لا تملك صلاحية'), exportButton: await exp.count() > 0, firstNumber: firstMatch(b, /[\d,]{3,}(\.\d+)?\s*ر\.س/) }; });
  }
  await step(s, 'export sales CSV', async p => { await go(p, '/reports?tab=table-sales', 7000); const exp = p.getByRole('button', { name: /تصدير|CSV|Excel/ }).first(); if (!(await exp.count())) return { exportButton: false }; const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null); await exp.click(); const d = await dl; if (!d) { await sleep(1000); return { downloaded: false, menu: (await p.locator('[role="menu"]').allInnerTexts()).join(' ').slice(0, 80) }; } return { downloaded: true, file: d.suggestedFilename() }; });
  await step(s, 'daily closings', async p => { await go(p, '/sales?tab=closings', 6000); const b = await body(p); return { denied: b.includes('لا تملك صلاحية'), expected: firstMatch(b, /المتوقع[^ر]{0,30}ر\.س/), historyTab: await p.getByRole('button', { name: /السجل|سابقة/ }).count() }; });
  await step(s, 'supplier payables', async p => { await go(p, '/products?tab=suppliers', 6000); const b = await body(p); return { denied: b.includes('لا تملك صلاحية'), balance: firstMatch(b, /(المستحق|الرصيد)[^ر]{0,30}ر\.س/) }; });
  for (const path of ['/team?tab=users', '/settings?tab=general', '/pos', '/sales?tab=customers']) await step(s, `try ${path}`, async p => { await go(p, path, 4500); const b = await body(p); return { deniedInPlace: b.includes('لا تملك صلاحية عرض هذه الصفحة') }; });
  await finish(s);
}

// ───────────────────────── 4. OWNER (live, Max) ─────────────────────────
{
  const s = await session({ label: 'OWNER' }); const p = s.page;
  await step(s, 'login', async () => ({ loginMs: await login(s, 'demo-distributor@wasil.demo'), landed: new URL(p.url()).pathname }));
  await step(s, 'morning dashboard', async p => { await go(p, '/', 9000); const b = await body(p); return { kpis: ['إيرادات اليوم', 'الوحدات المباعة اليوم', 'أجهزة في المخزون', 'طلبات صيانة مفتوحة', 'مستحقات الموردين'].map(k => firstMatch(b, new RegExp(k + '\\s*[\\d,.]+'))), stillLoading: await p.locator('main .animate-pulse').count() }; });
  await step(s, 'notifications bell', async p => { await p.locator('header button:has(svg.lucide-bell)').first().click(); await sleep(2000); const t = (await p.locator('[role="menu"], [data-radix-popper-content-wrapper]').allInnerTexts()).join(' ').replace(/\s+/g, ' '); await p.keyboard.press('Escape'); return { items: t.slice(0, 260) }; });
  await step(s, 'global search "S22"', async p => { const box = p.getByPlaceholder(/ابحث/).first(); await box.click(); await box.fill('S22'); await sleep(6000); const t = (await body(p)).match(/S22[^|]{0,60}/g)?.slice(0, 4); await box.fill(''); await p.keyboard.press('Escape'); return { hits: t }; });
  await step(s, 'products: search + filter', async p => { await go(p, '/products?tab=inventory', 7000); const rows0 = await p.locator('main tbody tr').count(); const box = p.locator('main input[placeholder*="بحث"], main input[placeholder*="ابحث"]').first(); if (await box.count()) { await box.fill('iPhone'); await sleep(1500); } const rows1 = await p.locator('main tbody tr').count(); if (await box.count()) await box.fill(''); return { rows: rows0, rowsAfterSearch: rows1 }; });
  await step(s, 'add product: save blocked', async p => { await p.getByRole('button', { name: /^إضافة$|إضافة جهاز|إضافة منتج/ }).first().click(); await sleep(1500); const d = p.locator('[role="dialog"]').last(); const title = (await d.innerText().catch(() => '')).split('\n')[0]; const save = d.getByRole('button', { name: /حفظ|إضافة/ }).last(); await save.click().catch(() => {}); await sleep(1500); const v = firstMatch(await d.innerText().catch(() => ''), /(مطلوب|أدخل|يجب)[^\n]{0,50}/); await p.keyboard.press('Escape'); await sleep(500); return { dialog: title, emptySaveMessage: v }; });
  await step(s, 'transfers: approve blocked', async p => { await go(p, '/products?tab=transfers', 6000); const ap = p.getByRole('button', { name: /اعتماد|موافقة/ }).first(); if (!(await ap.count())) return { approveButton: false }; await ap.click(); await sleep(1500); const c = p.getByRole('button', { name: /تأكيد|نعم/ }).first(); if (await c.count()) { await c.click(); await sleep(4000); } return { afterClick: (await toasts(p)).slice(0, 120) }; });
  await step(s, 'customer detail and back', async p => { await go(p, '/sales?tab=customers', 6000); const row = p.locator('main a[href^="/customers/"], main tbody tr').first(); await row.click().catch(() => {}); await sleep(4000); const at = new URL(p.url()).pathname; await p.goBack(); await sleep(3000); return { opened: at, back: new URL(p.url()).pathname + new URL(p.url()).search }; });
  await step(s, 'online store settings', async p => { await go(p, '/sales?tab=store', 7000); const b = await body(p); return { published: firstMatch(b, /(منشور|غير منشور)[^.]{0,30}/), studio: has(b, /استوديو/) }; });
  await step(s, 'wholesale market', async p => { await go(p, '/sales?tab=wholesale', 7000); const b = await body(p); return { dashes: (b.match(/ — /g) || []).length, listings: await p.locator('main [class*="rounded"]:has-text("ر.س")').count() }; });
  await step(s, 'users: add user dialog then cancel', async p => { await go(p, '/team?tab=users', 6000); const users = await p.locator('main').innerText().then(t => (t.match(/@/g) || []).length); await p.getByRole('button', { name: /إضافة مستخدم جديد/ }).click(); await sleep(1200); const d = p.locator('[role="dialog"]').last(); const fields = await d.locator('input').count(); await d.getByRole('button', { name: 'إلغاء' }).click().catch(() => p.keyboard.press('Escape')); await sleep(600); return { usersListed: users, dialogFields: fields, closed: (await p.locator('[role="dialog"]').count()) === 0 }; });
  await step(s, 'subscription page (descriptions)', async p => { await go(p, '/subscription', 7000); const b = await body(p); return { liteCustomerPromise: b.includes('قاعدة عملاء أساسية'), limits: (b.match(/(فرع واحد|\d+ فروع|\d+ فرعاً)[^·]{0,3}·[^ر]{0,30}/g) || []).slice(0, 4), plus: b.includes('بلس'), prices: (b.match(/\b(99|199|399|499)\b/g) || []) }; });
  await step(s, 'branches', async p => { await go(p, '/organization?tab=branches', 6000); const b = await body(p); return { notice: firstMatch(b, /لديك \d+ فروع[^.]{0,60}/), count: (b.match(/فرع/g) || []).length }; });
  await step(s, 'reload keeps the place', async p => { await go(p, '/reports?tab=parts', 6000); await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(5000); return { after: new URL(p.url()).pathname + new URL(p.url()).search }; });
  await finish(s);
  const m = await session({ mobile: true, label: 'OWNER(mobile)' });
  await step(m, 'login', async () => ({ loginMs: await login(m, 'demo-distributor@wasil.demo') }));
  for (const path of ['/', '/pos', '/products?tab=inventory', '/sales?tab=orders', '/reports?tab=sales', '/team?tab=users']) await step(m, `mobile ${path}`, async p => { await go(p, path, 5000); return {}; });
  await finish(m);
}

// ───────────────────────── 5. PLATFORM ADMIN (mock: platform_admins answered «yes») ─────────────────────────
{
  const mock = async (route, req) => { if (req.method() === 'GET' && /\/rest\/v1\/platform_admins/.test(req.url())) { await route.fulfill({ status: 200, contentType: 'application/json', body: isObjAccept(req) ? '{"id":"qa"}' : '[{"id":"qa"}]' }); return true; } return false; };
  const s = await session({ label: 'SUPERADMIN(mock)', mock }); const p = s.page;
  await step(s, 'platform login page while signed out', async p => { await go(p, '/admin/login', 4000); return { form: await p.locator('input[type="email"], #email').count() }; });
  await step(s, 'sign in (owner account, admin answered by mock)', async () => ({ loginMs: await login(s, 'demo-distributor@wasil.demo') }));
  await step(s, 'overview', async p => { await go(p, '/admin', 8000); const b = await body(p); return { stats: (b.match(/[؀-ۿ ]{4,20}\s\d[\d,]*/g) || []).slice(0, 8) }; });
  await step(s, 'companies: search + expand', async p => { await go(p, '/admin/companies', 8000); const n = await p.locator('main .cursor-pointer').count(); const box = p.locator('main input').first(); if (await box.count()) { await box.fill('ديمو'); await sleep(1200); } const n2 = await p.locator('main .cursor-pointer').count(); await p.locator('main .cursor-pointer').first().click().catch(() => {}); await sleep(1000); const btns = (await p.locator('main button').allInnerTexts()).map(t => t.trim()).filter(Boolean); return { companies: n, afterSearch: n2, actions: [...new Set(btns)].slice(0, 12) }; });
  await step(s, 'upgrade dialog: plans offered', async p => { await p.getByRole('button', { name: /ترقية/ }).first().click(); await sleep(1000); await p.locator('[role="dialog"] [role="combobox"]').first().click().catch(() => {}); await sleep(800); const opts = await p.locator('[role="option"]').allInnerTexts(); await p.keyboard.press('Escape'); await sleep(300); await p.keyboard.press('Escape'); return { plans: opts }; });
  await step(s, 'export companies', async p => { const dl = p.waitForEvent('download', { timeout: 6000 }).catch(() => null); await p.getByRole('button', { name: /تصدير/ }).first().click().catch(() => {}); const d = await dl; return { downloaded: !!d, file: d?.suggestedFilename() }; });
  for (const path of ['/admin/plans', '/admin/branch-requests', '/admin/payouts', '/admin/activity', '/admin/tickets']) await step(s, `open ${path}`, async p => { await go(p, path, 6000); const b = await body(p); return { empty: has(b, /لا توجد|لا يوجد/), snippet: b.slice(0, 120) }; });
  await step(s, 'reports tabs', async p => { await go(p, '/admin/reports', 7000); const r = {}; for (const t of ['المبيعات', 'نمو المنصة', 'توزيع الباقات', 'الدفعات']) { await p.getByRole('button', { name: t }).first().click().catch(() => {}); await sleep(1200); r[t] = (await p.locator('main svg.recharts-surface').count()); } const b = await body(p); r.plus = b.includes('بلس'); return r; });
  await step(s, 'ticket reply dialog then cancel', async p => { await go(p, '/admin/tickets', 6000); const rb = p.getByRole('button', { name: 'رد' }).first(); if (!(await rb.count())) return { replyButton: false }; await rb.click(); await sleep(900); const open = await p.locator('[role="dialog"]').count(); await p.keyboard.press('Escape'); return { dialog: open > 0 }; });
  await finish(s);
}
await browser.close();
