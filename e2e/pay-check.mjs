// One-off (phone and desktop): time from «تأكيد الدفع» to the invoice, and the invoice's labels
// and date, on live data. Nothing is written: every write (and the invoice
// number RPC, which advances a counter) is answered here after the same delay
// as a real Supabase round trip, measured in the same page.
import { chromium } from 'playwright';
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
})).json();
// a real round trip from this runner, as the median of 7 reads
const rtts = [];
for (let i = 0; i < 7; i++) { const t = Date.now(); await fetch(`${SUPA}/rest/v1/devices?select=id&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}` } }); rtts.push(Date.now() - t); }
const RTT = rtts.sort((a, b) => a - b)[3];
console.log(`TEXT round trip to Supabase: ${RTT} ms (reads: ${rtts.join(', ')})`);
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
for (const [label, site] of [['branch', 'http://localhost:4173']]) {
 for (const w of [1440, 390]) {
  const context = await browser.newContext({ locale: 'ar', viewport: { width: w, height: w > 500 ? 900 : 844 } });
  await context.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('language', 'ar'); },
    ['sb-ynwddyxzypbcftlevuam-auth-token', JSON.stringify(session)]);
  let t0 = 0; const log = [];
  await context.route(`${SUPA}/rest/v1/**`, async route => {
    const req = route.request(); const url = req.url(); const m = req.method();
    const write = !['GET', 'HEAD'].includes(m) && !url.includes('/rpc/') || url.includes('/rpc/generate_invoice_number');
    if (!write) {
      const s = Date.now(); const resp = await route.fetch(); if (t0) log.push(`${s - t0}-${Date.now() - t0} ${m} ${url.split('/rest/v1/')[1].slice(0, 50)}`);
      return route.fulfill({ response: resp });
    }
    const s = Date.now(); await new Promise(r => setTimeout(r, RTT));
    if (t0) log.push(`${s - t0}-${Date.now() - t0} ${m} ${url.split('/rest/v1/')[1].slice(0, 50)} (answered here)`);
    if (url.includes('generate_invoice_number')) return route.fulfill({ status: 200, contentType: 'application/json', body: '"INV-TEST-0001"' });
    if (url.includes('/sales') && m === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      const row = { ...body, id: '00000000-0000-4000-8000-000000000001', sale_date: new Date().toISOString(), created_at: new Date().toISOString() };
      return route.fulfill({ status: 201, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(row) });
    }
    return route.fulfill({ status: m === 'POST' ? 201 : 204, body: '' });
  });
  const page = await context.newPage();
  const step = async (name, fn) => { try { await fn(); console.log(`OK   ${label} ${w} ${name}`); } catch (e) { console.log(`FAIL ${label} ${w} ${name}: ${e.message.split('\n')[0]}`); } };
  await page.goto(`${site}/pos`); await page.waitForTimeout(9000);
  if (w < 500) console.log(`TEXT ${label} ${w} page: ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600)}`);
  await step('add iPhone 14 Pro', async () => { await page.getByText('Apple iPhone 14 Pro').first().click({ timeout: 6000 }); });
  await step('add power bank', async () => { await page.getByText('20000').first().click({ timeout: 6000 }); });
  await step('open payment', async () => {
    const cartBtn = page.getByRole('button', { name: /السلة/ }).first();
    if (w < 500 && await cartBtn.isVisible().catch(() => false)) await cartBtn.click();
    await page.getByRole('button', { name: 'إتمام البيع' }).last().click({ timeout: 6000 });
  });
  await step('cash, amount', async () => {
    const dlg = page.getByRole('dialog').last();
    await dlg.getByText('كاش', { exact: true }).first().click({ timeout: 6000 });
    await dlg.locator('input[type=number]').first().fill('5000');
  });
  let ms = -1;
  await step('confirm → invoice', async () => {
    t0 = Date.now();
    await page.getByRole('button', { name: 'تأكيد الدفع وإصدار الفاتورة' }).click({ timeout: 6000 });
    await page.getByText('INV-TEST-0001').first().waitFor({ timeout: 20000 });
    ms = Date.now() - t0;
  });
  await page.waitForTimeout(1500); t0 = 0;
  console.log(`TEXT ${label} ${w} PAYMENT ${ms} ms`);
  for (const l of log) console.log(`TEXT ${label} ${w}   ${l}`);
  const inv = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').split('فاتورة ضريبية').pop();
  console.log(`TEXT ${label} ${w} invoice: ${inv.slice(0, 900)}`);
  console.log(`TEXT ${label} ${w} dates: ${JSON.stringify(inv.match(/\d{1,2}\/\d{1,2}\/\d{4}( \d{1,2}:\d{2})?/g))}`);
  const b = await page.screenshot({ type: 'jpeg', quality: 72 }); console.log(`SHOT-BEGIN ${label}-${w}`); console.log(b.toString('base64')); console.log('SHOT-END');
  await context.close();
 }
}
await browser.close();
