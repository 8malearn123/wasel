// One-off, read only: the demo Max shop's real devices, and what the dashboard,
// the products page and the reports show for them — with this branch's code.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const SITE = process.env.SITE;
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
})).json();
const H = { apikey: ANON, Authorization: `Bearer ${session.access_token}` };
const get = async (p) => (await fetch(`${SUPA}/rest/v1/${p}`, { headers: H })).json();
const [mu] = await get(`merchant_users?select=merchant_id&user_id=eq.${session.user.id}`);
const M = mu.merchant_id;

// ---- the data itself
const devices = await get(`devices?select=model,brand,status,price,cost,branch_id,created_at&merchant_id=eq.${M}&order=created_at`);
const accessories = await get(`accessories?select=name,quantity,price,cost,min_quantity&merchant_id=eq.${M}`);
const sales = await get(`sales?select=id,sale_date,items:sale_items(device_id,quantity)&merchant_id=eq.${M}`);
const branches = await get(`branches?select=id,name,is_active&merchant_id=eq.${M}`);
const by = {};
for (const d of devices) by[d.status] = (by[d.status] || 0) + 1;
console.log(`DATA devices=${devices.length} by status ${JSON.stringify(by)}`);
console.log(`DATA branches ${JSON.stringify(branches.map(b => [b.name, b.is_active]))}`);
for (const d of devices) console.log(`DEVICE | ${d.brand ?? ''} ${d.model} | ${d.status} | price ${d.price} | cost ${d.cost} | branch ${branches.find(b => b.id === d.branch_id)?.name ?? d.branch_id} | ${d.created_at.slice(0, 10)}`);
const unsold = devices.filter(d => d.status !== 'sold');
const accRetail = accessories.reduce((s, a) => s + a.price * a.quantity, 0);
console.log(`DATA accessories lines=${accessories.length} pieces=${accessories.reduce((s, a) => s + a.quantity, 0)} retail=${accRetail}`);
console.log(`DATA invoices=${sales.length} device lines on invoices=${sales.flatMap(s => s.items).filter(i => i.device_id).length}`);
console.log(`OLD dashboard (available)=${by.available || 0} · OLD products (all rows)=${devices.length} · OLD reports value (available+acc)=${devices.filter(d => d.status === 'available').reduce((s, d) => s + Number(d.price), 0) + accRetail} · OLD products value (unsold+acc)=${unsold.reduce((s, d) => s + Number(d.price), 0) + accRetail}`);
console.log(`NEW expected: in stock=${unsold.length} for sale=${by.available || 0} value=${unsold.reduce((s, d) => s + Number(d.price), 0) + accRetail}`);

// ---- the screens, read only
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const context = await browser.newContext({ locale: 'ar', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); }, ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
// reads only: GET and HEAD (the dashboard counts with HEAD), and the read RPCs
await context.route(`${SUPA}/rest/v1/**`, route => ['GET', 'HEAD'].includes(route.request().method()) || route.request().url().includes('/rpc/') ? route.continue() : route.abort());
const page = await context.newPage();
for (const [label, path, pick] of [
  ['dashboard', '/', 'main'],
  ['products', '/products?tab=inventory', 'main'],
  ['reports-sales', '/reports?tab=sales', 'main'],
  ['reports-inventory', '/reports?tab=inventory', 'main'],
]) {
  await page.goto(SITE + path); await page.waitForTimeout(12000);
  const text = await page.evaluate(sel => (document.querySelector(sel) || document.body).innerText.replace(/\s+/g, ' ').slice(0, 900), pick);
  console.log(`SCREEN ${label}: ${text}`);
  const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
  console.log(`SHOT-BEGIN ${label}`); console.log(shot.toString('base64')); console.log('SHOT-END');
}
await browser.close();
