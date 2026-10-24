// One-off, read only: invoices, the devices on them, and device statuses in the demo Max shop.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const session = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-distributor@wasil.demo', password: 'demo1234' }),
})).json();
const H = { apikey: ANON, Authorization: `Bearer ${session.access_token}` };
const get = async (p) => { const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: H }); const j = await r.json(); if (!r.ok) console.log(`ERR ${p}: ${JSON.stringify(j)}`); return Array.isArray(j) ? j : []; };
const [mu] = await get(`merchant_users?select=merchant_id&user_id=eq.${session.user.id}`);
const M = mu.merchant_id;
const devices = await get(`devices?select=id,model,status,updated_at&merchant_id=eq.${M}`);
const sales = await get(`sales?select=id,invoice_number,sale_date,total_amount,items:sale_items(device_id,accessory_id,quantity)&merchant_id=eq.${M}&order=sale_date`);
const online = await get(`online_order_items?select=device_id,order:online_orders!inner(order_number,status,merchant_id)&order.merchant_id=eq.${M}&device_id=not.is.null`);
const wholesale = await get(`wholesale_order_items?select=listing:wholesale_listings(device_id,merchant_id),order:wholesale_orders(order_number,status)`);
const byId = Object.fromEntries(devices.map(d => [d.id, d]));
const now = Date.now();
const last7 = sales.filter(s => now - new Date(s.sale_date).getTime() < 7 * 864e5);
console.log(`INVOICES all=${sales.length} last7days=${last7.length} last30days=${sales.filter(s => now - new Date(s.sale_date).getTime() < 30 * 864e5).length}`);
const lines = sales.flatMap(s => s.items.filter(i => i.device_id).map(i => ({ inv: s.invoice_number, date: s.sale_date.slice(0, 10), id: i.device_id })));
console.log(`DEVICE LINES on invoices=${lines.length} distinct devices=${new Set(lines.map(l => l.id)).size}`);
const seen = {};
for (const l of lines) { seen[l.id] = (seen[l.id] || 0) + 1; }
for (const l of lines) console.log(`LINE ${l.inv} ${l.date} | ${byId[l.id]?.model ?? '(deleted device ' + l.id + ')'} | status now: ${byId[l.id]?.status ?? '-'}${seen[l.id] > 1 ? ' | ON ' + seen[l.id] + ' INVOICES' : ''}`);
const sold = devices.filter(d => d.status === 'sold');
const onInvoice = new Set(lines.map(l => l.id));
console.log(`SOLD status=${sold.length}`);
for (const d of sold) if (!onInvoice.has(d.id)) console.log(`SOLD-NO-INVOICE ${d.model} (updated ${d.updated_at?.slice(0, 10)})`);
for (const id of onInvoice) if (byId[id] && byId[id].status !== 'sold') console.log(`INVOICED-NOT-SOLD ${byId[id].model} status=${byId[id].status}`);
console.log(`ONLINE device lines=${online.length} ${JSON.stringify(online.map(o => [byId[o.device_id]?.model, o.order.order_number, o.order.status]))}`);
console.log(`WHOLESALE device lines=${JSON.stringify(wholesale.filter(w => w.listing?.device_id && w.listing.merchant_id === M).map(w => [byId[w.listing.device_id]?.model, w.order?.order_number, w.order?.status]))}`);
