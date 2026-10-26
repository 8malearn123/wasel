// One-off, read only. 1) Suspect test data in the demo shops, with what refers
// to it. 2) Every page in Arabic and English: visible strings in the wrong
// language. Writes are blocked.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const login = async email => (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234' }) })).json();
const get = async (s, q) => (await fetch(`${SUPA}/rest/v1/${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}` } })).json();

for (const who of ['demo-distributor', 'demo-enterprise', 'demo-basic']) {
  const s = await login(`${who}@wasil.demo`);
  const mu = await get(s, `merchant_users?select=merchant_id,role&user_id=eq.${s.user.id}`);
  const mid = mu[0]?.merchant_id;
  const dev = await get(s, `devices?select=id,model,brand,price,cost,status,imei,created_at&merchant_id=eq.${mid}&or=(price.gte.100000,model.ilike.ipo,model.ilike.*test*)`);
  const acc = await get(s, `accessories?select=id,name,price,cost,quantity,created_at&merchant_id=eq.${mid}&or=(price.gte.50000,name.ilike.*test*)`);
  const wl = await get(s, `wholesale_listings?select=id,item_type,device_id,accessory_id,wholesale_price,min_quantity,is_active,notes,created_at&merchant_id=eq.${mid}`);
  console.log(`DATA ${who} merchant=${mid}`);
  for (const d of dev) {
    const si = await get(s, `sale_items?select=id,sale_id&device_id=eq.${d.id}`);
    const oi = await get(s, `online_order_items?select=id&device_id=eq.${d.id}`);
    const wli = await get(s, `wholesale_listings?select=id&device_id=eq.${d.id}`);
    console.log(`DATA   device ${JSON.stringify(d)} refs: sales=${si.length} online=${oi.length} wholesale=${wli.length}`);
  }
  for (const a of acc) console.log(`DATA   accessory ${JSON.stringify(a)}`);
  for (const l of wl) {
    const oi = await get(s, `wholesale_order_items?select=id,order_id&listing_id=eq.${l.id}`);
    console.log(`DATA   listing ${JSON.stringify({ ...l, notes: (l.notes || '').slice(0, 120) })} orders=${Array.isArray(oi) ? oi.length : JSON.stringify(oi)}`);
  }
}

const ROUTES = ['/', '/pos', '/products?tab=inventory', '/products?tab=stocktake', '/products?tab=transfers', '/products?tab=suppliers', '/products?tab=labels',
  '/sales?tab=orders', '/sales?tab=repairs', '/sales?tab=closings', '/sales?tab=store', '/sales?tab=seo', '/sales?tab=customers', '/sales?tab=marketing', '/sales?tab=wholesale',
  '/shipping', '/reports', '/team?tab=employees', '/team?tab=attendance', '/team?tab=devices', '/team?tab=payroll', '/team?tab=users',
  '/ai-insights', '/subscription', '/settings', '/organization?tab=branches', '/organization?tab=support', '/notifications', '/business-policy'];
const session = await login('demo-distributor@wasil.demo');
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const lang of ['ar', 'en']) {
  const context = await browser.newContext({ locale: lang, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([k, v, l]) => { localStorage.setItem(k, v); localStorage.setItem('language', l); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session), lang]);
  await context.route(`${SUPA}/rest/v1/**`, r => ['GET', 'HEAD'].includes(r.request().method()) || r.request().url().includes('/rpc/') ? r.continue() : r.abort());
  const page = await context.newPage();
  const seen = new Map();
  for (const route of ROUTES) {
    await page.goto(`${process.env.SITE}${route}`); await page.waitForTimeout(5500);
    const found = await page.evaluate(lang => {
      const out = [];
      const wrong = lang === 'ar' ? (s => /[A-Za-z]{3,}/.test(s) && !/[؀-ۿ]/.test(s)) : (s => /[؀-ۿ]/.test(s));
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode; const t = n.textContent.replace(/\s+/g, ' ').trim();
        const el = n.parentElement;
        if (!t || !el || el.closest('script,style,[data-sonner-toaster]')) continue;
        if (getComputedStyle(el).display === 'none' || !el.getClientRects().length) continue;
        if (wrong(t)) out.push(t.slice(0, 80));
      }
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
        for (const a of ['placeholder', 'title', 'aria-label']) { const v = el.getAttribute(a); if (v && wrong(v) && el.getClientRects().length) out.push(`@${a}: ${v.slice(0, 80)}`); }
      });
      return out;
    }, lang);
    for (const t of found) if (!seen.has(t)) seen.set(t, route);
  }
  console.log(`I18N ${lang} unique=${seen.size}`);
  for (const [t, r] of seen) console.log(`I18N ${lang} ${r} | ${t}`);
  await context.close();
}
await browser.close();
