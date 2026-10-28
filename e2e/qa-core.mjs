// Shared harness for the live customer-perspective QA run (one-off).
// - Drives the real site (wasel-alpha.vercel.app) in Chrome as real users.
// - WRITE GUARD: a write request leaves the browser only if it carries the
//   test tag, or targets a row this run created (ids learned from responses).
//   Every other write is aborted and logged as BLOCKED-WRITE — so settings,
//   real customers, real invoices and anything not ours cannot change.
// - Records every step: PASS / FAIL / BLOCKED (could not test) / NOTE, with a
//   screenshot on failure.
import { chromium } from 'playwright';
import fs from 'fs';

export const SITE = 'https://wasel-alpha.vercel.app';
export const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
export const ANON = process.env.ANON;
export const TAG = 'QA1028';
export const PW = 'demo1234'; // the demo password shown publicly on the login page
export const SHOTS = 'shots';
fs.mkdirSync(SHOTS, { recursive: true });

export const created = new Set();   // ids of rows this run created
const createdLog = [];               // {table, id, label}
export const results = [];

export function rec(role, area, test, status, detail = '') {
  const r = { role, area, test, status, detail: String(detail).replace(/\s+/g, ' ').slice(0, 600) };
  results.push(r);
  console.log(`R|${status}|${role}|${area}|${test}|${r.detail}`);
}

const tableOf = url => (url.match(/\/rest\/v1\/(?:rpc\/)?([a-z_]+)/) || [])[1] || url;
const idsIn = s => (s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || []);

// writes the app makes as a side effect of our own actions, allowed when they
// only touch rows we created (checked by id), or are pure reads named as rpc
const READ_RPCS = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin',
  'get_public_merchant_legal', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission',
  'track_online_order', 'get_store_by_slug']);
const NUMBER_RPCS = new Set(['generate_invoice_number', 'generate_online_order_number', 'generate_repair_number',
  'generate_stocktake_number', 'generate_transfer_number']);

export async function newSession(browser, role, { mobile = false, allow = {} } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-SA' }
    : { viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  const log = { console: [], net: [], blocked: [], writes: [] };
  page.on('console', m => { if (m.type() === 'error') log.console.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => { log.console.push('PAGEERROR ' + e.message.slice(0, 200)); console.log('PAGEERROR ' + role + ' ' + page.url() + ' ' + (e.stack || '').slice(0, 700).replace(/\n/g, ' / ')); });
  page.on('response', async r => {
    const u = r.url();
    if (!u.includes('supabase.co')) return;
    if (r.status() >= 400) log.net.push(`${r.status()} ${r.request().method()} ${u.replace(SUPA, '').split('?')[0]}`);
    // learn ids of rows we created
    const m = r.request().method();
    if (m === 'POST' && r.status() < 300 && /\/rest\/v1\//.test(u) && !/\/rpc\//.test(u)) {
      try {
        const body = r.request().postData() || '';
        if (body.includes(TAG) || idsIn(body).some(i => created.has(i)) || allow.post?.(u, body)) {
          const j = await r.json().catch(() => null);
          for (const row of [].concat(j || [])) if (row?.id) { created.add(row.id); createdLog.push({ table: tableOf(u), id: row.id, role }); }
        }
      } catch { /* ignore */ }
    }
  });
  await page.route(/supabase\.co\/(rest|functions|storage)\/v1\//, async route => {
    const req = route.request();
    const m = req.method();
    const u = req.url();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    const body = req.postData() || '';
    const t = tableOf(u);
    let ok = false;
    // settings, the shop, plans, accounts and money paid out never change in this run
    const NEVER = ['store_settings', 'store_pages', 'merchants', 'subscriptions', 'merchant_users', 'plans', 'profiles',
      'platform_admins', 'merchant_payouts', 'branch_requests', 'activation_codes', 'store_categories', 'campaigns'];
    if (NEVER.includes(t) && !/\/rpc\//.test(u)) ok = false;
    else if (/\/rpc\//.test(u)) ok = READ_RPCS.has(t) || NUMBER_RPCS.has(t) || (allow.rpc?.(t, body) ?? false);
    else if (/\/functions\/v1\//.test(u)) ok = allow.fn?.(u, body) ?? false;
    else if (/\/storage\/v1\//.test(u)) ok = false;
    else if (body.includes(TAG)) ok = true;                                   // our tagged rows
    else if (idsIn(u + ' ' + body).some(i => created.has(i))) ok = true;      // rows we created / lines of them
    else if (t === 'activity_logs' && m === 'POST') ok = idsIn(body).some(i => created.has(i)); // the app's own log of our action
    else ok = allow.write?.(m, t, u, body) ?? false;
    log.writes.push(`${ok ? 'SENT' : 'BLOCKED'} ${m} ${t} ${u.split('?')[1]?.slice(0, 120) || ''} ${body.slice(0, 160)}`);
    if (ok && m === 'POST' && /\/rest\/v1\//.test(u) && !/\/rpc\//.test(u)) {
      // learn the new rows' ids before the app's next request (its lines) goes out
      const resp = await route.fetch().catch(() => null);
      if (!resp) return route.abort('failed');
      const text = await resp.text().catch(() => '');
      try { for (const row of [].concat(JSON.parse(text) || [])) if (row?.id) { created.add(row.id); createdLog.push({ table: t, id: row.id, role }); } } catch { /* no body */ }
      return route.fulfill({ response: resp, body: text });
    }
    if (ok) return route.continue();
    log.blocked.push(`${m} ${t} ${(u.split('?')[1] || '').slice(0, 100)} ${body.slice(0, 120)}`);
    return route.abort('blockedbyclient');
  });
  return { ctx, page, log, role };
}

export async function shot(s, name) {
  const f = `${SHOTS}/${s.role}-${name}`.replace(/[^a-zA-Z0-9_\-\/]/g, '_') + '.png';
  await s.page.screenshot({ path: f, fullPage: false }).catch(() => {});
  return f;
}

/** run a step; failures record FAIL with a screenshot, never stop the run */
export async function step(s, area, test, fn) {
  const before = { c: s.log.console.length, n: s.log.net.length, b: s.log.blocked.length };
  try {
    const out = await fn();
    const extra = [];
    const newErr = s.log.console.slice(before.c).filter(x => !/404 \(\)|status of 404/.test(x));
    if (newErr.length) extra.push('console: ' + newErr.slice(0, 2).join(' | '));
    const net = s.log.net.slice(before.n).filter(x => !/my_permissions|get_subscription_state|\/roles|\/permissions|product_media|employees|wholesale_parties|wholesale_listing_items/.test(x));
    if (net.length) extra.push('http: ' + [...new Set(net)].slice(0, 3).join(' | '));
    const blocked = s.log.blocked.slice(before.b);
    if (blocked.length) extra.push('blocked-writes: ' + blocked.slice(0, 2).join(' | '));
    if (out && typeof out === 'object' && out.status === 'FAIL') {
      const dlg = await s.page.locator('[role="dialog"]').last().innerText().catch(() => '');
      extra.push(`url=${s.page.url().replace(SITE, '')}${dlg ? ' dialog=' + dlg.replace(/\s+/g, ' ').slice(0, 200) : ''} page=${(await bodyText(s.page)).slice(0, 300)}`);
    }
    if (out && typeof out === 'object' && out.status) rec(s.role, area, test, out.status, [out.detail, ...extra].filter(Boolean).join(' ; '));
    else rec(s.role, area, test, 'PASS', [typeof out === 'string' ? out : '', ...extra].filter(Boolean).join(' ; '));
  } catch (e) {
    const f = await shot(s, `${area}-${test}`.slice(0, 60));
    const t = (await bodyText(s.page)).slice(0, 700);
    const dlg = await s.page.locator('[role="dialog"]').last().innerText().catch(() => '');
    rec(s.role, area, test, 'FAIL', `${e.message.split('\n')[0]} | url=${s.page.url().replace(SITE, '')} | dialog=${dlg.replace(/\s+/g, ' ').slice(0, 300)} | page=${t}`);
  }
}

export async function loginUI(s, email, password = PW) {
  const { page } = s;
  await page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  return page;
}

export function track(table, id, role = 'api') { if (id && !created.has(id)) { created.add(id); createdLog.push({ table, id, role }); } }
export const createdRows = () => createdLog;

export function finish() {
  fs.writeFileSync('results.json', JSON.stringify({ results, created: createdLog }, null, 1));
  const c = s => results.filter(r => r.status === s).length;
  console.log(`SUMMARY pass=${c('PASS')} fail=${c('FAIL')} blocked=${c('BLOCKED')} note=${c('NOTE')} created=${createdLog.length}`);
}

export async function launch() {
  return chromium.launch({ channel: process.env.CHANNEL || undefined });
}

export const bodyText = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
export const overflowX = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
