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


// ── stores: which published store has products
let rows = [];
try { const r = await fetch(`${SUPA}/rest/v1/store_settings?select=slug,store_name,is_published&is_published=eq.true&limit=10`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }); rows = await r.json(); } catch {}
let best = null, bestN = -1;
{
  const s = await session({ label: 'STORES' });
  for (const r of rows) {
    await step(s, `products of ${r.slug}`, async p => { await go(p, `/store/${r.slug}/products`, 8000); const n = await p.locator('a[href*="/device/"], a[href*="/accessory/"]').count(); if (n > bestN) { bestN = n; best = r.slug; } const b = await body(p); return { productLinks: n, text: n ? undefined : b.slice(0, 220) }; });
  }
  await finish(s);
}
if (best && bestN > 0) for (const mobile of [false, true]) {
  const s = await session({ mobile, label: mobile ? 'CUSTOMER2(mobile)' : 'CUSTOMER2(desktop)' });
  await step(s, `home ${best}`, async p => { await go(p, `/store/${best}`, 7000); const imgs = await p.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(-60))); return { brokenImages: imgs }; });
  await step(s, 'search', async p => { await go(p, `/store/${best}/products`, 7000); const box = p.locator('input[type="search"], input[placeholder*="بحث"], input[placeholder*="ابحث"]').first(); const n0 = await p.locator('a[href*="/device/"], a[href*="/accessory/"]').count(); if (!(await box.count())) return { searchBox: false, all: n0 }; await box.fill('سامسونج'); await sleep(2000); const ar = await p.locator('a[href*="/device/"], a[href*="/accessory/"]').count(); await box.fill('samsung'); await sleep(2000); const en = await p.locator('a[href*="/device/"], a[href*="/accessory/"]').count(); await box.fill(''); await sleep(1000); return { all: n0, arabicQuery: ar, latinQuery: en }; });
  await step(s, 'product page', async p => { const a = p.locator('a[href*="/device/"], a[href*="/accessory/"]').first(); const href = await a.getAttribute('href'); await go(p, href, 5000); const b = await body(p); return { href, price: firstMatch(b, /[\d,]+(\.\d+)?\s*ر\.س/), addBtn: await p.getByRole('button', { name: /إضافة للسلة/ }).count(), buyNow: await p.getByRole('button', { name: /اشتر الآن|شراء الآن/ }).count() }; });
  await step(s, 'add to cart', async p => { await p.getByRole('button', { name: /إضافة للسلة/ }).first().click(); await sleep(1500); await go(p, `/store/${best}/cart`, 4000); const b = await body(p); return { empty: has(b, /السلة فارغة/), total: firstMatch(b, /(الإجمالي|المجموع)[^ر]{0,25}ر\.س/), qtyButtons: await p.locator('main button:has(svg.lucide-plus), main button:has(svg.lucide-minus)').count() }; });
  await step(s, 'qty +1', async p => { const plus = p.locator('main button:has(svg.lucide-plus)').first(); if (await plus.count()) { await plus.click(); await sleep(1000); } const b = await body(p); return { total: firstMatch(b, /(الإجمالي|المجموع)[^ر]{0,25}ر\.س/) }; });
  await step(s, 'checkout page', async p => { const c = p.getByRole('button', { name: /إتمام الطلب|متابعة الدفع|الدفع|إتمام الشراء/ }).first(); if (await c.count()) { await c.click(); await sleep(4000); } else await go(p, `/store/${best}/checkout`, 4000); const btns = (await p.locator('main button').allInnerTexts()).map(x => x.trim()).filter(Boolean); return { buttons: [...new Set(btns)].slice(0, 12), inputs: await p.locator('main input').count() }; });
  await step(s, 'checkout: fill customer + try order', async p => {
    const name = p.locator('input[autocomplete="name"]').first(); if (await name.count()) await name.fill('عميل اختبار');
    const tel = p.locator('input[autocomplete="tel"]').first(); if (await tel.count()) await tel.fill('0500000000');
    const r = {};
    const save = p.locator('main button').filter({ hasText: /حفظ|تأكيد|متابعة/ }).first(); if (await save.count()) { r.clicked = (await save.innerText()).trim(); await save.click().catch(() => {}); await sleep(1200); }
    const btns = (await p.locator('main button').allInnerTexts()).map(x => x.trim()).filter(Boolean); r.buttonsAfter = [...new Set(btns)].slice(0, 12);
    const place = p.locator('main button').filter({ hasText: /تأكيد الطلب|إرسال الطلب|اطلب|إتمام الطلب/ }).first();
    if (await place.count()) { r.place = (await place.innerText()).trim(); r.placeDisabled = await place.isDisabled(); if (!r.placeDisabled) { await place.click(); await sleep(5000); } }
    const b = await body(p); r.landed = new URL(p.url()).pathname; r.message = firstMatch(b, /(تعذّر|تعذر|يرجى|الرجاء|أدخل|اختر)[^.]{0,80}/); return r;
  });
  await finish(s);
}
// ── owner: report cards, add product, customer detail
{
  const s = await session({ label: 'OWNER2' }); const p = s.page;
  await step(s, 'login', async () => ({ loginMs: await login(s, 'demo-distributor@wasil.demo') }));
  await step(s, 'sales report cards', async p => { await go(p, '/reports?tab=sales', 8000); const cards = await p.evaluate(() => [...document.querySelectorAll('main [class*="rounded"]')].filter(e => e.children.length < 8 && /ر\.س|٪|%/.test(e.innerText) && e.innerText.length < 120).map(e => e.innerText.replace(/\s+/g, ' ')).slice(0, 8)); return { cards }; });
  await step(s, 'add product', async p => { await go(p, '/products?tab=inventory', 7000); const btns = (await p.locator('main button').allInnerTexts()).map(x => x.trim()).filter(x => /إضافة/.test(x)); const add = p.locator('main button').filter({ hasText: /^إضافة$/ }).first(); await add.click(); await sleep(1500); const menu = (await p.locator('[role="menu"]').allInnerTexts()).join(' | '); const dlg = await p.locator('[role="dialog"]').count(); let r = { addButtons: btns, menu, dialog: dlg }; if (menu && !dlg) { await p.locator('[role="menuitem"]').first().click(); await sleep(1500); } const d = p.locator('[role="dialog"]').last(); if (await d.count()) { r.title = (await d.innerText()).split('\n')[0]; const save = d.locator('button').filter({ hasText: /حفظ|إضافة/ }).last(); await save.click().catch(() => {}); await sleep(1500); r.emptySave = firstMatch(await d.innerText(), /(مطلوب|أدخل|يجب|يرجى)[^\n]{0,60}/); r.stillOpen = await d.isVisible(); } return r; });
  await step(s, 'customer detail', async p => { await go(p, '/sales?tab=customers', 7000); const links = await p.locator('main a[href^="/customers/"]').count(); const rowsN = await p.locator('main tbody tr').count(); const clickable = p.locator('main a[href^="/customers/"], main tbody tr, main [class*="cursor-pointer"]').first(); await clickable.click().catch(() => {}); await sleep(4000); const at = new URL(p.url()).pathname; const b = await body(p); return { links, rows: rowsN, opened: at, detail: at.startsWith('/customers/') ? b.slice(0, 160) : undefined, dialog: await p.locator('[role="dialog"]').count() }; });
  await finish(s);
}
// ── cashier: notices now Arabic
{
  const s = await session({ label: 'CASHIER2' }); const p = s.page;
  await step(s, 'login', async () => ({ loginMs: await login(s, 'demo-cashier@wasil.demo') }));
  await step(s, 'unknown code + add item', async p => { await go(p, '/pos', 6000); const box = p.locator('main input').first(); await box.fill('000000000000000'); await box.press('Enter'); await sleep(2500); await box.fill(''); await p.locator('main button:has-text("ر.س")').first().click(); await sleep(1500); return {}; });
  await finish(s);
}
// ── platform admin: activity in words
{
  const mock = async (route, req) => { if (req.method() === 'GET' && /\/rest\/v1\/platform_admins/.test(req.url())) { await route.fulfill({ status: 200, contentType: 'application/json', body: isObjAccept(req) ? '{"id":"qa"}' : '[{"id":"qa"}]' }); return true; } return false; };
  const s = await session({ label: 'SUPERADMIN2(mock)', mock }); const p = s.page;
  await step(s, 'login', async () => ({ loginMs: await login(s, 'demo-distributor@wasil.demo') }));
  await step(s, 'overview recent activity', async p => { await go(p, '/admin', 8000); const b = await body(p); return { rawCodes: (b.match(/[a-z]+_[a-z_]+ • [a-z_]+/g) || []).slice(0, 5), stats: (await p.evaluate(() => [...document.querySelectorAll('main [class*="rounded"]')].filter(e => e.children.length < 6 && e.innerText.length < 60).map(e => e.innerText.replace(/\s+/g, ' ')).slice(0, 10))) }; });
  await step(s, 'activity page', async p => { await go(p, '/admin/activity', 7000); const cells = await p.locator('main tbody tr').first().innerText().catch(() => ''); const b = await body(p); return { firstRow: cells.replace(/\s+/g, ' '), rawCodes: (b.match(/\b[a-z]+_[a-z_]+\b/g) || []).slice(0, 5) }; });
  await step(s, 'reports tabs', async p => { await go(p, '/admin/reports', 7000); const tabs = (await p.locator('main button').allInnerTexts()).map(x => x.trim()); const r = { tabs }; for (const t of ['نمو المنصة', 'توزيع الباقات']) { const b = p.locator('main button').filter({ hasText: t }).first(); const t0 = Date.now(); await b.click({ timeout: 5000 }).catch(e => { r[t] = 'click failed'; }); await sleep(1500); if (!r[t]) r[t] = { ms: Date.now() - t0, charts: await p.locator('main svg.recharts-surface').count() }; } return r; });
  await finish(s);
}
await browser.close();
