// One-off check against the live data, on this branch's build: the owner adds
// «عرض التقارير المالية» to the cashier role, the demo cashier signs in and
// should now open the reports; then the cashier role is put back as it was.
import { chromium } from 'playwright';
const SITE = process.env.SITE;
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const rest = (path, token, init = {}) => fetch(`${SUPA}/rest/v1/${path}`, {
  ...init, headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
});
async function signIn(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  const s = await r.json();
  if (!s.access_token) throw new Error(`sign-in ${email}: ${JSON.stringify(s)}`);
  return s;
}
const owner = await signIn('demo-distributor@wasil.demo');
const [om] = await (await rest(`merchant_users?select=merchant_id&user_id=eq.${owner.user.id}`, owner.access_token)).json();
const M = om.merchant_id;
const latest = async () => {
  const [last] = await (await rest(`activity_logs?select=new_data&merchant_id=eq.${M}&entity_type=eq.custom_roles&order=created_at.desc&limit=1`, owner.access_token)).json();
  return last?.new_data && Array.isArray(last.new_data.roles) ? last.new_data : { roles: [], assignments: {} };
};
const write = async (config) => {
  const w = await rest('activity_logs', owner.access_token, { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ merchant_id: M, user_id: owner.user.id, action: 'custom_roles_update', entity_type: 'custom_roles', new_data: config }) });
  if (!w.ok) throw new Error(await w.text());
};

const before = await latest();
const browser = await chromium.launch();
async function look(label) {
  const session = await signIn('demo-cashier@wasil.demo');
  const context = await browser.newContext({ locale: 'ar', viewport: { width: 1600, height: 950 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  const page = await context.newPage();
  const settle = async () => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
  };
  await page.goto(`${SITE}/`); await settle();
  const home = new URL(page.url()).pathname;
  await page.goto(`${SITE}/reports?tab=sales`); await settle();
  const reports = new URL(page.url()).pathname;
  // the till is full-width with no sidebar; read it on the page that opened
  const nav = [...new Set((await page.locator('aside a').allInnerTexts().catch(() => [])).map(t => t.trim().split('\n')[0]).filter(Boolean))];
  await page.goto(`${SITE}/pos`); await settle();
  const pos = new URL(page.url()).pathname;
  console.log(`[${label}] home ${home} | /reports → ${reports} | /pos → ${pos} | sidebar: ${nav.join(' | ')}`);
  await context.close();
  return { home, reports, pos, nav };
}
let ok = true;
try {
  const a = await look('cashier as is');
  await write({ ...before, systemRoles: { ...(before.systemRoles || {}), cashier: ['products.view', 'pos.access', 'repairs.manage', 'closings.manage', 'reports.view'] } });
  const b = await look('cashier + reports');
  ok = a.reports !== '/reports' && b.reports === '/reports' && b.pos === '/pos' && b.nav.includes('التقارير') && !b.nav.includes('الإعدادات');
} finally {
  // the cashier role as it was
  const now = await latest();
  const systemRoles = { ...(now.systemRoles || {}) };
  if (before.systemRoles?.cashier) systemRoles.cashier = before.systemRoles.cashier; else delete systemRoles.cashier;
  await write({ ...now, systemRoles });
  const c = await look('cashier restored');
  ok = ok && c.reports !== '/reports';
  await browser.close();
}
console.log(ok ? 'RESULT PASS' : 'RESULT FAIL');
if (!ok) process.exit(1);
