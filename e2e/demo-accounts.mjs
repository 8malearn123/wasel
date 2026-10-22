// One-off: three demo members in the Max demo shop (demo-distributor), made as
// its owner through the app's own paths, then each signed into to see what it
// gets. Existing accounts are left as they are.
import { chromium } from 'playwright';
const SITE = 'https://wasel-alpha.vercel.app';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const PASSWORD = 'demo1234';

const ACCOUNTS = [
  { key: 'admin', email: 'demo-admin@wasil.demo', full_name: 'أدمن تجريبي', role: 'admin' },
  { key: 'cashier', email: 'demo-cashier@wasil.demo', full_name: 'كاشير تجريبي (ماكس)', role: 'cashier' },
  // a custom role: kept as cashier in the database, the role in the shop's store (customRolesStore)
  { key: 'employee', email: 'demo-employee@wasil.demo', full_name: 'موظف تجريبي', role: 'cashier',
    custom: { name: 'موظف مبيعات', description: 'حساب تجريبي', permissions: ['products.view', 'online_orders.manage', 'customers.manage', 'repairs.manage'] } },
];

const rest = (path, token, init = {}) => fetch(`${SUPA}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
});

async function signIn(email) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const s = await r.json();
  if (!s.access_token) throw new Error(`sign-in ${email}: ${JSON.stringify(s)}`);
  return s;
}

const owner = await signIn('demo-distributor@wasil.demo');
const [ownerMember] = await (await rest(`merchant_users?select=merchant_id,role&user_id=eq.${owner.user.id}`, owner.access_token)).json();
const merchantId = ownerMember.merchant_id;
console.log('shop', merchantId, 'owner role', ownerMember.role);

const report = [];
for (const a of ACCOUNTS) {
  const r = await fetch(`${SUPA}/functions/v1/admin-create-user`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${owner.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: a.email, password: PASSWORD, full_name: a.full_name, role: a.role }),
  });
  const body = await r.json().catch(() => ({}));
  console.log(`[${a.key}] create → ${r.status} ${JSON.stringify(body)}`);
  if (!r.ok && r.status !== 409) throw new Error(`could not create ${a.email}`);

  const s = await signIn(a.email);
  const [m] = await (await rest(`merchant_users?select=id,role,merchant_id,login_code,is_active&user_id=eq.${s.user.id}`, s.access_token)).json();
  if (!m || m.merchant_id !== merchantId) throw new Error(`${a.email} is not a member of the demo shop: ${JSON.stringify(m)}`);
  a.member = m;
  a.session = s;
  report.push({ key: a.key, email: a.email, role: m.role, login_code: m.login_code ?? body.login_code ?? null });
}

// The employee's custom role, written the way the users screen writes it
const employee = ACCOUNTS.find(a => a.custom);
{
  const res = await rest(`activity_logs?select=new_data&merchant_id=eq.${merchantId}&entity_type=eq.custom_roles&order=created_at.desc&limit=1`, owner.access_token);
  const [last] = await res.json();
  const config = last?.new_data && Array.isArray(last.new_data.roles) ? last.new_data : { roles: [], assignments: {} };
  let role = config.roles.find(r => r.name === employee.custom.name);
  if (!role) {
    role = { id: crypto.randomUUID(), ...employee.custom };
    config.roles.push(role);
  }
  config.assignments = { ...(config.assignments || {}), [employee.member.id]: role.id };
  const w = await rest('activity_logs', owner.access_token, {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ merchant_id: merchantId, user_id: owner.user.id, action: 'custom_roles_update', entity_type: 'custom_roles', new_data: config }),
  });
  console.log(`[employee] custom role «${role.name}» → ${w.status}`);
  if (!w.ok) throw new Error(await w.text());
}

// What each one sees on the live site
const browser = await chromium.launch();
for (const a of ACCOUNTS) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: 1600, height: 950 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(a.session)]);
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const landed = new URL(page.url()).pathname;
  const nav = await page.locator('aside a, nav a').allInnerTexts().catch(() => []);
  const sections = [...new Set(nav.map(t => t.trim().split('\n')[0]).filter(Boolean))];
  console.log(`[${a.key}] lands on ${landed}; sidebar: ${sections.join(' | ')}`);
  report.find(r => r.key === a.key).landed = landed;
  report.find(r => r.key === a.key).sections = sections;
  const jpg = await page.screenshot({ type: 'jpeg', quality: 45 });
  console.log(`SHOT-BEGIN ${a.key}`);
  const b64 = jpg.toString('base64');
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
  console.log(`SHOT-END ${a.key}`);
  await context.close();
}
await browser.close();
console.log('REPORT ' + JSON.stringify(report));
