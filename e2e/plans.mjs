// One-off READ-ONLY check of every plan: what each demo shop's plan opens, on a build of
// claude/frontend-regression-fixes against the live data. Every write is aborted in the browser.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const SITE = 'http://localhost:4173';
const ANON = process.env.ANON;
const PW = 'demo1234';
const READ = new Set(['get_user_merchant_id', 'my_permissions', 'get_subscription_state', 'is_platform_admin', 'wholesale_parties', 'wholesale_listing_items', 'get_user_login_code', 'has_permission']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = (k, v) => console.log(`R|${k}|${JSON.stringify(v).slice(0, 1500)}`);
const LEAVES = {
  '/products': ['inventory', 'stocktake', 'transfers', 'suppliers', 'labels'],
  '/sales': ['orders', 'repairs', 'closings', 'store', 'seo', 'customers', 'marketing', 'wholesale'],
  '/team': ['employees', 'attendance', 'devices', 'payroll', 'users'],
  '/settings': ['general', 'notifications', 'policy'],
  '/organization': ['branches', 'support'],
  '/reports': ['sales', 'table-sales', 'inventory', 'parts', 'employees', 'table-suppliers', 'table-customers'],
  '/pos': ['pos', 'history'],
  '/shipping': ['shipments', 'carriers', 'insights'],
};
const PAGES = ['/', '/ai-insights', '/subscription', ...Object.entries(LEAVES).flatMap(([p, ls]) => ls.map(l => `${p}?tab=${l}`))];
const ACCOUNTS = ['demo-basic', 'demo-professional', 'demo-enterprise', 'demo-distributor'];

async function api(token, path) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  return r.json().catch(() => null);
}
{
  const r = await fetch(`${SUPA}/rest/v1/plans?select=*&order=sort_order`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  out('plans', await r.json());
}
const browser = await chromium.launch({ channel: 'chrome' });
for (const acct of ACCOUNTS) {
  const email = `${acct}@wasil.demo`;
  const tr = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  const tj = await tr.json();
  if (!tj.access_token) { out(`${acct}|login`, tj); continue; }
  const me = await api(tj.access_token, `merchant_users?select=id,merchant_id,role,is_active&user_id=eq.${tj.user.id}`);
  const mid = me?.[0]?.merchant_id;
  out(`${acct}|data`, {
    member: me,
    subscription: await api(tj.access_token, `subscriptions?select=plan,plan_id,status,max_branches,max_users,trial_ends_at,subscription_ends_at&merchant_id=eq.${mid}`),
    branches: await api(tj.access_token, `branches?select=name,is_active,is_warehouse&merchant_id=eq.${mid}`),
    users: (await api(tj.access_token, `merchant_users?select=role,is_active&merchant_id=eq.${mid}`))?.map(u => `${u.role}${u.is_active ? '' : '(off)'}`),
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 120)));
  await page.addInitScript(() => { window.__t = []; const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-sonner-toast]').forEach(el => { if (seen.has(el)) return; seen.add(el); setTimeout(() => window.__t.push(el.innerText.replace(/\s+/g, ' ').trim()), 60); })).observe(document, { childList: true, subtree: true }); try { localStorage.setItem('language', 'ar'); } catch {} });
  await page.route(/supabase\.co\//, async route => {
    const r = route.request(); const m = r.method(); const u = r.url();
    if (!/\/(rest|functions|storage)\/v1\//.test(u)) return route.continue();
    const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || (fn && READ.has(fn))) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(`${SITE}/auth`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await page.getByRole('tab', { name: /دخول بالإيميل|Email Login/ }).click();
  await page.locator('#email').fill(email); await page.locator('#password').fill(PW);
  await page.getByRole('button', { name: /تسجيل الدخول|^Login$|Sign In/ }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 25000 }).catch(() => {}); await sleep(4000);

  // the menu as this plan sees it (sidebar, with groups opened)
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const menu = await page.evaluate(() => [...document.querySelectorAll('aside a, aside button, nav a')].map(a => (a.innerText || '').trim()).filter(t => t && t.length < 40));
  out(`${acct}|menu`, [...new Set(menu)]);

  const results = {};
  for (const p of PAGES) {
    await page.evaluate(() => { window.__t = []; }).catch(() => {});
    await page.goto(`${SITE}${p}`, { waitUntil: 'domcontentloaded' }); await sleep(4500);
    const url = new URL(page.url()); const t = await page.evaluate(() => window.__t.join(' | '));
    const reason = /غير متاحة في باقتك/.test(t) ? 'PLAN' : /ليست لديك صلاحية/.test(t) ? 'PERM' : /لحساب الكاشير/.test(t) ? 'CASHIER' : '';
    const landed = url.pathname + url.search;
    results[p] = landed === p || (p === '/' && landed === '/') ? (reason ? `OPEN+${reason}` : 'OPEN') : `→${landed}${reason ? ' [' + reason + ']' : ''}`;
  }
  out(`${acct}|pages`, results);

  // limits as shown
  await page.goto(`${SITE}/organization?tab=branches`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const br = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  await page.goto(`${SITE}/subscription`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const sub = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  await page.goto(`${SITE}/team?tab=users`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
  const us = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  out(`${acct}|limits`, {
    branchesBadge: (br.match(/\d+\s*\/\s*\d+/) || [''])[0],
    branchNotice: (br.match(/(عدد الفروع النشطة أكبر[^.]*\.|تم الوصول للحد الأقصى للفروع)/) || [''])[0],
    requestBranchButton: /طلب إضافة فرع جديد/.test(br),
    subscriptionPage: sub.slice(0, 500),
    addUserButton: /إضافة مستخدم جديد/.test(us),
    usersShown: (us.match(/\d+\s*مستخدم/) || [''])[0],
    errors,
  });
  await ctx.close();
}
await browser.close();
