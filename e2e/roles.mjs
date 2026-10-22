// End-to-end check of roles and permissions on the live site, one profile per
// run (PROFILE env). Signs in, opens every section and leaf, and records where
// each one lands, what the sidebar and the sections menu offer, and any page
// error. Then checks the profile's rules and that the menus agree with the
// pages.
//
// READ-ONLY: every write to the database (REST insert/update/delete, edge
// functions) is blocked in the browser and only counted. Custom-role profiles
// are made by answering the custom-roles snapshot request in the browser — no
// role is created in the database.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const SITE = process.env.SITE || 'https://wasel-alpha.vercel.app';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const PROFILE = process.env.PROFILE;

// ── profiles ────────────────────────────────────────────────────────────────
const CUSTOM = {
  'custom-accountant': {
    name: 'محاسب',
    permissions: ['reports.view', 'invoices.view', 'closings.manage', 'suppliers.manage'],
  },
  'custom-orders': { name: 'طلبات المتجر فقط', permissions: ['online_orders.manage'] },
  'custom-pos': { name: 'بائع', permissions: ['pos.access', 'customers.manage'] },
  // a snapshot nobody could save from the screen, only forge: must still be safe
  'custom-forged': { name: 'مزوّر', permissions: ['roles.manage', 'users.update', 'subscription.manage', 'settings.manage'] },
};
const OWNERS = {
  'owner-basic': 'demo-basic@wasil.demo',
  'owner-professional': 'demo-professional@wasil.demo',
  'owner-enterprise': 'demo-enterprise@wasil.demo',
  'owner-distributor': 'demo-distributor@wasil.demo',
  // the role demo accounts of the Max shop — signed into with a password too
  'admin-max': 'demo-admin@wasil.demo',
  'cashier-max': 'demo-cashier@wasil.demo',
  'employee-max': 'demo-employee@wasil.demo',
};

// A custom role saved in the shop itself (not mocked): its permissions are
// read from the shop when the run starts, since the owner may change them
const LIVE_CUSTOM = { 'employee-max': null };

// Everything a member can open: [url, permission the app gates it on]
const TARGETS = [
  ['/', 'dashboard.view'],
  ['/pos', 'pos.access'],
  ['/products?tab=inventory', 'products.view'],
  ['/products?tab=stocktake', 'stocktake.manage'],
  ['/products?tab=transfers', 'transfers.manage'],
  ['/products?tab=suppliers', 'suppliers.manage'],
  ['/products?tab=labels', 'products.view'],
  ['/sales?tab=orders', 'online_orders.manage'],
  ['/sales?tab=repairs', 'repairs.manage'],
  ['/sales?tab=closings', 'closings.manage'],
  ['/sales?tab=store', 'store.manage'],
  ['/sales?tab=seo', 'store.manage'],
  ['/sales?tab=customers', 'customers.manage'],
  ['/sales?tab=marketing', 'marketing.manage'],
  ['/sales?tab=wholesale', 'wholesale.manage'],
  ['/shipping', 'shipping.manage'],
  ['/reports?tab=sales', 'reports.view'],
  ['/reports?tab=table-sales', 'invoices.view'],
  ['/reports?tab=inventory', 'reports.view'],
  ['/team?tab=employees', 'employees.view'],
  ['/team?tab=attendance', 'attendance.manage'],
  ['/team?tab=devices', 'attendance.manage'],
  ['/team?tab=payroll', 'payroll.manage'],
  ['/team?tab=users', 'users.view'],
  ['/ai-insights', 'ai_insights.view'],
  ['/subscription', 'subscription.manage'],
  ['/settings?tab=general', 'settings.manage'],
  ['/settings?tab=notifications', 'settings.manage'],
  ['/settings?tab=policy', 'policy.manage'],
  ['/organization?tab=branches', 'branches.manage'],
  ['/organization?tab=support', null],
];

// The sections menu shows labels; this maps them back to paths
const SECTION_LABELS = {
  'الرئيسية': '/', 'Dashboard': '/',
  'نقطة البيع': '/pos', 'Point of Sale': '/pos',
  'المنتجات': '/products', 'Products': '/products',
  'الطلبات والمبيعات': '/sales', 'Orders & Sales': '/sales',
  'الشحن': '/shipping', 'Shipping': '/shipping',
  'التقارير': '/reports', 'Reports': '/reports',
  'الموارد البشرية': '/team', 'People': '/team',
  'الذكاء الاصطناعي': '/ai-insights', 'AI insights': '/ai-insights',
  'الاشتراك والباقات': '/subscription', 'Subscription & Plans': '/subscription',
  'الإعدادات': '/settings', 'Settings': '/settings',
  'المنشأة والدعم': '/organization', 'Business & help': '/organization',
};

const DENIED_TEXT = /لا تملك صلاحية عرض هذه الصفحة|You do not have permission for this page/;

// ── sign in through the API, as the app would ──────────────────────────────
async function signIn() {
  if (OWNERS[PROFILE]) {
    const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNERS[PROFILE], password: 'demo1234' }),
    });
    const s = await r.json();
    if (!s.access_token) throw new Error(`sign-in failed: ${JSON.stringify(s)}`);
    return s;
  }
  // cashier and the custom profiles all sign in as the demo cashier; several
  // runs signing in with one code at once are refused, so retry with a pause
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`${SUPA}/functions/v1/login-by-code`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '70035' }),
    });
    last = await r.json();
    if (last.session?.access_token) return last.session;
    await new Promise(res => setTimeout(res, 4000 + Math.random() * 6000));
  }
  throw new Error(`code sign-in failed: ${JSON.stringify(last)}`);
}

async function memberOf(session) {
  const r = await fetch(`${SUPA}/rest/v1/merchant_users?select=id,role,merchant_id&user_id=eq.${session.user.id}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}` },
  });
  return (await r.json())[0];
}

// ── run ─────────────────────────────────────────────────────────────────────
const session = await signIn();
const member = await memberOf(session);
const custom = CUSTOM[PROFILE];
if (PROFILE in LIVE_CUSTOM) {
  const r = await fetch(`${SUPA}/rest/v1/activity_logs?select=new_data&merchant_id=eq.${member.merchant_id}&entity_type=eq.custom_roles&order=created_at.desc&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}` },
  });
  const config = (await r.json())[0]?.new_data;
  const role = config?.roles?.find(x => x.id === config.assignments?.[member.id]);
  LIVE_CUSTOM[PROFILE] = role?.permissions ?? [];
  console.log(`live role «${role?.name}»: ${LIVE_CUSTOM[PROFILE].join(', ')}`);
}

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const context = await browser.newContext({ locale: 'ar', viewport: { width: 1680, height: 1000 } });
const storageKey = 'sb-ynwddyxzypbcftlevuam-auth-token';
await context.addInitScript(([k, v]) => { window.localStorage.setItem(k, v); }, [storageKey, JSON.stringify(session)]);

const blockedWrites = [];
await context.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = req.url();
  const method = req.method();

  // the custom-role profiles: answer the snapshot read with this profile's role
  if (custom && method === 'GET' && url.includes('/rest/v1/activity_logs') && url.includes('entity_type=eq.custom_roles')) {
    const config = {
      roles: [{ id: 'e2e-role', name: custom.name, description: null, permissions: custom.permissions }],
      assignments: { [member.id]: 'e2e-role' },
    };
    const row = { new_data: config };
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? row : [row]) });
  }

  // The demo cashier's shop has an expired trial, which locks every screen.
  // For the roles test the session sees the subscription as active; nothing
  // in the database changes.
  if (!OWNERS[PROFILE] && method === 'GET' && url.includes('/rest/v1/subscriptions')) {
    const res = await route.fetch();
    let body = await res.json().catch(() => null);
    const unlock = (row) => row && ({ ...row, status: 'active', subscription_ends_at: new Date(Date.now() + 365 * 864e5).toISOString() });
    body = Array.isArray(body) ? body.map(unlock) : unlock(body);
    return route.fulfill({ response: res, body: JSON.stringify(body) });
  }

  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)
    && !url.includes('/rest/v1/rpc/') && !url.includes('/auth/v1/');
  if (isWrite) {
    blockedWrites.push(`${method} ${url.replace(SUPA, '').split('?')[0]}`);
    return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"blocked by e2e (read-only)"}' });
  }
  return route.continue();
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|403|404|406|blocked by e2e/.test(m.text())) {
    errors.push(`console: ${m.text().slice(0, 200)}`);
  }
});

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // the app shows a spinner while auth, plans and permissions load
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function visit(url) {
  let navigations = 0;
  const onNav = (f) => { if (f === page.mainFrame()) navigations++; };
  page.on('framenavigated', onNav);
  await page.goto(SITE + url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => errors.push(`goto ${url}: ${e.message}`));
  await settle();
  page.off('framenavigated', onNav);
  const final = new URL(page.url());
  const target = new URL(SITE + url);
  const denied = await page.getByText(DENIED_TEXT).count() > 0;
  const tab = final.searchParams.get('tab');
  const wantedTab = target.searchParams.get('tab');
  let outcome;
  if (final.pathname !== target.pathname) outcome = `→ ${final.pathname}${final.search}`;
  else if (denied) outcome = 'denied';
  // a section with no ?tab= left shows its default leaf: the asked one did not open
  else if (wantedTab && tab !== wantedTab) outcome = `→ ?tab=${tab ?? '(default)'}`;
  else outcome = 'open';
  return { url, outcome, navigations, final: final.pathname + final.search };
}

// what the menus offer, from the home page
await visit('/');
const sidebar = await page.$$eval('aside a[href]', as => [...new Set(as.map(a => new URL(a.href).pathname))]);
let menu = [];
const browse = page.getByRole('button', { name: /تصفح الأقسام|Browse Sections/ });
if (await browse.count()) {
  await browse.first().click();
  await page.waitForTimeout(400);
  menu = await page.$$eval('[role=menuitem]', els => els.map(e => e.textContent.trim()));
  await page.keyboard.press('Escape');
}
const menuPaths = menu.map(l => SECTION_LABELS[l]).filter(Boolean);
const home = new URL(page.url()).pathname;

const results = [];
for (const [url, permission] of TARGETS) {
  results.push({ ...(await visit(url)), permission });
}

// The till is full-width with no sidebar: an account that lands there has its
// sidebar read on another page it opens
if (sidebar.length === 0 && home === '/pos') {
  const other = results.find(r => r.outcome === 'open' && !r.url.startsWith('/pos'));
  if (other) {
    await visit(other.url);
    sidebar.push(...await page.$$eval('aside a[href]', as => [...new Set(as.map(a => new URL(a.href).pathname))]));
  }
}

await page.screenshot({ path: `report-${PROFILE}.png`, fullPage: false });
await browser.close();

// ── checks ──────────────────────────────────────────────────────────────────
const problems = [];
const opened = (u) => results.find(r => r.url === u)?.outcome === 'open';
const sectionOpens = (path) => results.some(r => new URL(SITE + r.url).pathname === path && r.outcome === 'open');

for (const r of results) {
  if (r.navigations > 8) problems.push(`redirect loop? ${r.url} navigated ${r.navigations} times`);
}
// every entry the menus offer must open; every section that opens should be offered
for (const p of sidebar) if (p !== '/' || home === '/') if (!sectionOpens(p)) problems.push(`sidebar offers ${p} but nothing there opens`);
for (const p of menuPaths) if (!sectionOpens(p)) problems.push(`sections menu offers ${p} but nothing there opens`);
for (const p of new Set(results.filter(r => r.outcome === 'open').map(r => new URL(SITE + r.url).pathname))) {
  if (p !== '/' && !sidebar.includes(p)) problems.push(`${p} opens but the sidebar does not offer it`);
}
if (menu.length === 0) problems.push('could not read the sections menu');
if (sidebar.length && menuPaths.length) {
  const a = [...sidebar].filter(p => p !== '/pos').sort().join(' ');
  const b = [...menuPaths].filter(p => p !== '/pos').sort().join(' ');
  if (a !== b) problems.push(`sidebar [${a}] and sections menu [${b}] disagree`);
}

// the profile's own rules
const role = member?.role;
const must = (u) => { if (!opened(u)) problems.push(`must open ${u}, got ${results.find(r => r.url === u)?.outcome}`); };
const mustNot = (u) => { if (opened(u)) problems.push(`must NOT open ${u}`); };

const grantedList = custom?.permissions ?? LIVE_CUSTOM[PROFILE];
if (grantedList) {
  const grants = new Set(grantedList.filter(k => !['roles.view', 'roles.manage', 'users.view', 'users.create', 'users.update', 'users.delete', 'subscription.manage', 'settings.manage', 'policy.manage', 'branches.manage'].includes(k)));
  for (const r of results) {
    if (r.permission && !grants.has(r.permission) && r.outcome === 'open') problems.push(`custom role opened ${r.url} without ${r.permission}`);
  }
  must('/organization?tab=support');
  ['/team?tab=users', '/subscription', '/settings?tab=general', '/settings?tab=policy', '/organization?tab=branches'].forEach(mustNot);
} else if (PROFILE === 'cashier' || PROFILE === 'cashier-max') {
  ['/', '/products?tab=inventory', '/shipping', '/reports?tab=sales', '/team?tab=employees', '/team?tab=users',
    '/ai-insights', '/subscription', '/settings?tab=general', '/organization?tab=branches', '/sales?tab=orders',
    '/sales?tab=customers'].forEach(mustNot);
  ['/pos', '/sales?tab=closings', '/organization?tab=support'].forEach(must);
} else {
  ['/', '/pos', '/products?tab=inventory', '/sales?tab=closings', '/team?tab=users', '/subscription',
    '/settings?tab=general', '/settings?tab=policy', '/organization?tab=branches', '/organization?tab=support'].forEach(must);
}
if (errors.length) problems.push(...[...new Set(errors)].slice(0, 10));

const report = { profile: PROFILE, role, home, sidebar, menu: menuPaths, results, blockedWrites: [...new Set(blockedWrites)], problems };
mkdirSync('reports', { recursive: true });
writeFileSync(`reports/${PROFILE}.json`, JSON.stringify(report, null, 2));

// readable log
console.log(`\n### ${PROFILE} (db role: ${role}) — home: ${home}`);
console.log(`sidebar: ${sidebar.join(' ')}`);
console.log(`menu:    ${menuPaths.join(' ')}`);
for (const r of results) console.log(`${r.outcome === 'open' ? 'OPEN  ' : '      '} ${r.url.padEnd(30)} ${r.outcome}`);
console.log(`blocked writes: ${report.blockedWrites.join(', ') || 'none'}`);
console.log(problems.length ? `PROBLEMS (${problems.length}):\n - ${problems.join('\n - ')}` : 'NO PROBLEMS');
process.exit(problems.length ? 1 : 0);
