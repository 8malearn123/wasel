// One-off, read only: every product the demo Max shop holds, straight from the
// database, and the figures the LIVE site (wasel-alpha.vercel.app) shows for them.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const SITE = 'https://wasel-alpha.vercel.app';
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
})).json();
const H = { apikey: ANON, Authorization: `Bearer ${session.access_token}` };
const get = async (p) => {
  const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: H });
  const j = await r.json();
  if (!r.ok) console.log(`ERR ${p}: ${JSON.stringify(j)}`);
  return Array.isArray(j) ? j : [];
};
const [mu] = await get(`merchant_users?select=merchant_id&user_id=eq.${session.user.id}`);
const M = mu.merchant_id;
const branches = await get(`branches?select=id,name&merchant_id=eq.${M}`);
const bn = id => branches.find(b => b.id === id)?.name ?? '—';
const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

const devices = await get(`devices?select=model,brand,status,price,cost,branch_id&merchant_id=eq.${M}&order=status,model`);
const accessories = await get(`accessories?select=name,sku,quantity,price,cost,min_quantity,branch_id&merchant_id=eq.${M}&order=name`);
const parts = await get(`repair_parts?select=*&merchant_id=eq.${M}`);

const stock = devices.filter(d => d.status !== 'sold');
const count = s => devices.filter(d => d.status === s).length;
console.log(`DB devices total=${devices.length} in-stock=${stock.length} for-sale=${count('available')} sold=${count('sold')} in-transfer=${count('transferred')} reserved=${count('reserved')} repair=${count('repair')}`);
for (const d of stock) console.log(`STOCK-DEVICE | ${[d.brand, d.model].filter(Boolean).join(' ')} | ${d.status} | ${bn(d.branch_id)} | price ${fmt(d.price)} | cost ${fmt(d.cost)}`);
const devRetail = stock.reduce((s, d) => s + Number(d.price), 0);
const devCost = stock.reduce((s, d) => s + Number(d.cost), 0);
console.log(`DB in-stock devices value: price ${fmt(devRetail)} · cost ${fmt(devCost)}`);
for (const a of accessories) console.log(`STOCK-ACC | ${a.name} | ${a.sku} | qty ${a.quantity} (min ${a.min_quantity})${a.quantity <= a.min_quantity ? ' LOW' : ''} | ${bn(a.branch_id)} | price ${fmt(a.price)} | line ${fmt(a.price * a.quantity)}`);
const accRetail = accessories.reduce((s, a) => s + a.price * a.quantity, 0);
const accCost = accessories.reduce((s, a) => s + (a.cost || 0) * a.quantity, 0);
console.log(`DB accessories lines=${accessories.length} pieces=${accessories.reduce((s, a) => s + a.quantity, 0)} low=${accessories.filter(a => a.quantity <= a.min_quantity).length} value: price ${fmt(accRetail)} · cost ${fmt(accCost)}`);
console.log(`DB parts lines=${parts.length} keys=${parts[0] ? Object.keys(parts[0]).join(',') : '-'}`);
const ipo = stock.filter(d => d.model === 'ipo').reduce((s, d) => s + Number(d.price), 0);
console.log(`DB TOTAL stock value at price = ${fmt(devRetail + accRetail)} (without «ipo»: ${fmt(devRetail + accRetail - ipo)})`);

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: w, height: h } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  // reads only: GET and HEAD, and the read RPCs
  await context.route(`${SUPA}/rest/v1/**`, route =>
    ['GET', 'HEAD'].includes(route.request().method()) || route.request().url().includes('/rpc/') ? route.continue() : route.abort());
  const page = await context.newPage();
  for (const [label, path] of [['dashboard', '/'], ['products', '/products?tab=inventory'], ['reports-sales', '/reports?tab=sales'], ['reports-inventory', '/reports?tab=inventory']]) {
    await page.goto(SITE + path);
    await page.waitForTimeout(12000);
    const info = await page.evaluate(() => ({
      text: (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 650),
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    console.log(`SITE ${label}@${w} overflow=${info.overflow}: ${info.text}`);
    const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
    console.log(`SHOT-BEGIN ${label}-${w}`); console.log(shot.toString('base64')); console.log('SHOT-END');
  }
  await context.close();
}
await browser.close();
