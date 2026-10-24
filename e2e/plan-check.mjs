// One-off, read only: the plans table, the Lite and Pro demo subscriptions, and
// what the LIVE site shows each account (plan name, branch usage, reports).
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const SITE = 'https://wasel-alpha.vercel.app';
const signIn = async (email) => (await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234' }),
})).json());
const getAs = (tok) => async (p) => {
  const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: ANON, Authorization: `Bearer ${tok}` } });
  const j = await r.json(); if (!r.ok) console.log(`ERR ${p}: ${JSON.stringify(j)}`); return Array.isArray(j) ? j : [];
};

// Put the two demo accounts back on the plans their names say, with the
// function the app's demo switcher uses (it writes plan, plan_id and limits together).
for (const [email, plan] of [['demo-enterprise@wasil.demo', 'Enterprise'], ['demo-basic@wasil.demo', 'Basic']]) {
  const s = await signIn(email);
  const r = await fetch(`${SUPA}/rest/v1/rpc/demo_switch_plan`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ _plan_name: plan }),
  });
  console.log(`SWITCH ${email} → ${plan}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let printedPlans = false;
for (const [label, email] of [['LITE', 'demo-basic@wasil.demo'], ['PRO', 'demo-enterprise@wasil.demo'], ['MAX', 'demo-distributor@wasil.demo']]) {
  const s = await signIn(email); const get = getAs(s.access_token);
  if (!printedPlans) {
    for (const p of await get('plans?select=*&order=sort_order')) console.log(`PLAN ${JSON.stringify(p)}`);
    printedPlans = true;
  }
  const [mu] = await get(`merchant_users?select=merchant_id,role&user_id=eq.${s.user.id}`);
  const [sub] = await get(`subscriptions?select=plan,plan_id,status,max_branches,max_users,trial_ends_at,subscription_ends_at&merchant_id=eq.${mu.merchant_id}`);
  const branches = await get(`branches?select=name,is_active&merchant_id=eq.${mu.merchant_id}`);
  console.log(`${label} subscription ${JSON.stringify(sub)} · active branches ${branches.filter(b => b.is_active).length} ${JSON.stringify(branches.map(b => b.name))}`);

  const context = await browser.newContext({ locale: 'ar', viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(s)]);
  await context.route(`${SUPA}/rest/v1/**`, route =>
    ['GET', 'HEAD'].includes(route.request().method()) || route.request().url().includes('/rpc/') ? route.continue() : route.abort());
  const page = await context.newPage();
  for (const [name, path] of [['subscription', '/subscription'], ['branches', '/organization?tab=branches'], ['reports', '/reports?tab=sales']]) {
    await page.goto(SITE + path); await page.waitForTimeout(9000);
    const text = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 500));
    const sidebar = await page.evaluate(() => [...document.querySelectorAll('aside a')].map(a => a.textContent.trim()).filter(Boolean).join(' | '));
    console.log(`${label} SCREEN ${name} → url ${new URL(page.url()).pathname}${new URL(page.url()).search} :: ${text}`);
    if (name === 'subscription') console.log(`${label} SIDEBAR ${sidebar}`);
    const shot = await page.screenshot({ type: 'jpeg', quality: 65 });
    console.log(`SHOT-BEGIN ${label}-${name}`); console.log(shot.toString('base64')); console.log('SHOT-END');
  }
  await context.close();
}
await browser.close();
