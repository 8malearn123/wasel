// One-off: what the sales-employee demo account can really do. For each part
// of the shop: is it allowed by the role (the app's rule), and what does the
// database answer. Test records are removed again.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const signIn = async (email) => (await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'demo1234' }),
})).json());
const s = await signIn(process.env.EMAIL || 'demo-employee@wasil.demo');
const owner = await signIn('demo-distributor@wasil.demo');
const mk = (tok) => ({ apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' });
const H = mk(s.access_token), OH = mk(owner.access_token);
const api = async (method, path, body, headers = H) => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, { method, headers: { ...headers, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  // a write RLS refuses comes back 403, or 2xx with no rows
  const rows = Array.isArray(data) ? data.length : 0;
  const ok = res.ok && (method === 'GET' || rows > 0);
  return { ok, status: res.status, data, err: res.ok ? (ok ? '' : 'لم يتأثر أي سجل (منعته قاعدة البيانات)') : (data?.message || text).slice(0, 140) };
};
const [me] = (await api('GET', `merchant_users?select=id,role,merchant_id,branch_id&user_id=eq.${s.user.id}`)).data;
const M = me.merchant_id;
const cfg = (await api('GET', `activity_logs?select=new_data&merchant_id=eq.${M}&entity_type=eq.custom_roles&order=created_at.desc&limit=1`)).data?.[0]?.new_data;
// a custom role, else the system role as the shop changed it, else its defaults (legacyRolePermissions)
const DEFAULTS = { cashier: ['products.view', 'pos.access', 'repairs.manage', 'closings.manage'] };
const role = cfg?.roles?.find(r => r.id === cfg.assignments?.[me.id]);
const perms = new Set(role?.permissions ?? cfg?.systemRoles?.[me.role] ?? DEFAULTS[me.role] ?? []);
console.log(`member: db role ${me.role} · app role «${role?.name ?? me.role}»${!role && cfg?.systemRoles?.[me.role] ? ' (changed by the shop)' : ''}: ${[...perms].join(', ')}`);
const B0 = me.branch_id || (await api('GET', `branches?select=id&merchant_id=eq.${M}&order=created_at&limit=1`)).data?.[0]?.id;
const ts = Date.now().toString().slice(-8);
const rows = [];
function report(area, action, perm, res) {
  const allowed = perm === null ? true : perms.has(perm);
  const verdict = allowed === res.ok ? 'OK' : (allowed ? 'BLOCKED-BUT-ALLOWED' : 'ALLOWED-BUT-SHOULD-NOT');
  rows.push({ area, action, perm, allowed, db: res.ok, verdict, err: res.err });
  console.log(`${verdict.padEnd(22)} ${area} · ${action} [${perm ?? '—'} ${allowed ? 'مسموح' : 'غير مسموح'}] → db ${res.ok ? 'نجح' : `رفض ${res.status} ${res.err}`}`);
}
// a test row: added by the employee when the role allows, else by the owner (cleanup by the owner)
async function crud(area, table, insert, update, perm, deletePerm = perm) {
  const ins = await api('POST', table, { merchant_id: M, ...insert });
  report(area, 'إضافة', perm, ins);
  let id = Array.isArray(ins.data) ? ins.data[0]?.id : undefined;
  if (!id) { const o = await api('POST', table, { merchant_id: M, ...insert }, OH); id = Array.isArray(o.data) ? o.data[0]?.id : undefined; }
  if (!id) return;
  report(area, 'تعديل', perm, await api('PATCH', `${table}?id=eq.${id}`, update));
  report(area, 'حذف', deletePerm, await api('DELETE', `${table}?id=eq.${id}`));
  await api('DELETE', `${table}?id=eq.${id}`, undefined, OH); // gone either way
}
await crud('المنتجات · جهاز', 'devices', { imei: `98${ts}0000`, model: 'E2E جهاز', price: 1, cost: 1, status: 'available', branch_id: B0 }, { price: 2 }, 'products.create', 'products.delete');
await crud('المنتجات · إكسسوار', 'accessories', { name: 'E2E إكسسوار', sku: `E2E-EA-${ts}`, price: 1, cost: 1, quantity: 1, branch_id: B0 }, { quantity: 2 }, 'products.create', 'products.delete');
await crud('العملاء · عميل', 'customers', { name: 'E2E عميل', phone: '0500000000' }, { name: 'E2E عميل ٢' }, 'customers.manage');
await crud('الصيانة · طلب صيانة', 'repair_orders', { repair_number: `E2E-ER-${ts}`, customer_name: 'E2E', device_type: 'جوال', issue_description: 'اختبار', branch_id: B0 }, { issue_description: 'اختبار ٢' }, 'repairs.manage');
await crud('التسويق · كوبون', 'coupons', { code: `E2EE${ts}`, name: 'E2E', discount_type: 'percentage', discount_value: 10 }, { discount_value: 5 }, 'marketing.manage');
await crud('الموردون · مورد', 'suppliers', { name: 'E2E مورد' }, { name: 'E2E مورد ٢' }, 'suppliers.manage');
await crud('المتجر · تصنيف', 'store_categories', { name: 'E2E تصنيف' }, { name: 'E2E تصنيف ٢' }, 'store.manage');
// store orders: change one order's status and put it back
{
  const o = (await api('GET', `online_orders?select=id,status&merchant_id=eq.${M}&limit=1`)).data?.[0];
  if (o) {
    report('طلبات المتجر · تغيير الحالة', 'تعديل', 'online_orders.manage', await api('PATCH', `online_orders?id=eq.${o.id}`, { status: o.status }));
  } else report('طلبات المتجر', 'قراءة', 'online_orders.manage', { ok: false, status: 0, err: 'لا توجد طلبات' });
}

// the till: a sale of a test device and a test accessory, as the POS records it
{
  const dev = (await api('POST', 'devices', { merchant_id: M, imei: `97${ts}0000`, model: 'E2E جهاز بيع', price: 1, cost: 1, status: 'available', branch_id: B0 }, OH)).data?.[0];
  const acc = (await api('POST', 'accessories', { merchant_id: M, name: 'E2E إكسسوار بيع', sku: `E2E-POS-${ts}`, price: 1, cost: 1, quantity: 3, branch_id: B0 }, OH)).data?.[0];
  const inv = await api('POST', 'rpc/generate_invoice_number', { _merchant_id: M });
  report('الكاشير · رقم فاتورة', 'إنشاء', 'pos.access', { ...inv, ok: inv.status === 200 && typeof inv.data === 'string' });
  const sale = await api('POST', 'sales', { merchant_id: M, branch_id: B0, invoice_number: `E2E-${ts}`, subtotal: 2, tax_amount: 0.3, discount_amount: 0, total_amount: 2.3, payment_method: 'cash', payment_status: 'paid', sold_by: s.user.id });
  report('الكاشير · فاتورة بيع', 'إضافة', 'pos.access', sale);
  const sid = sale.data?.[0]?.id;
  if (sid) {
    report('الكاشير · بنود الفاتورة', 'إضافة', 'pos.access', await api('POST', 'sale_items', [
      { sale_id: sid, device_id: dev?.id, quantity: 1, unit_price: 1, cost_at_sale: 1 },
      { sale_id: sid, accessory_id: acc?.id, quantity: 1, unit_price: 1, cost_at_sale: 1 }]));
    report('الكاشير · قراءة فواتيره', 'قراءة', 'pos.access', await api('GET', `sales?select=id&id=eq.${sid}`));
  }
  if (dev) report('الكاشير · الجهاز يصبح مباعًا', 'تعديل', 'pos.access', await api('PATCH', `devices?id=eq.${dev.id}`, { status: 'sold' }));
  if (acc) report('الكاشير · إنقاص كمية الإكسسوار', 'تعديل', 'pos.access', await api('PATCH', `accessories?id=eq.${acc.id}`, { quantity: 2 }));
  report('الكاشير · بحث المنتجات', 'قراءة', 'products.view', await api('GET', `devices?select=id&merchant_id=eq.${M}&limit=1`));
  // a closing on a day long gone, so no real day is touched
  const cl = await api('POST', 'daily_closings', { merchant_id: M, branch_id: B0, closing_date: '2000-01-01', cash_sales: 0, card_sales: 0, bank_transfer_sales: 0, total_sales: 0, total_tax: 0, total_discount: 0, transactions_count: 0, devices_sold: 0, accessories_sold: 0, closed_by: s.user.id, status: 'closed' });
  report('إغلاق اليوم', 'إضافة', 'closings.manage', cl);
  if (sid) {
    await api('DELETE', `sale_items?sale_id=eq.${sid}`, undefined, OH);
    await api('DELETE', `sales?id=eq.${sid}`, undefined, OH);
  }
  await api('DELETE', `daily_closings?branch_id=eq.${B0}&closing_date=eq.2000-01-01`, undefined, OH);
  if (dev) await api('DELETE', `devices?id=eq.${dev.id}`, undefined, OH);
  if (acc) await api('DELETE', `accessories?id=eq.${acc.id}`, undefined, OH);
}
// reading what the role opens
report('الفواتير', 'قراءة', 'invoices.view', await api('GET', `sales?select=id&merchant_id=eq.${M}&limit=1`));
// what the role must not touch
const cur = (await api('GET', `store_settings?select=store_name&merchant_id=eq.${M}`)).data?.[0];
if (cur) report('إعدادات المتجر', 'حفظ', 'store.manage', await api('PATCH', `store_settings?merchant_id=eq.${M}`, cur));
const b = (await api('GET', `branches?select=id,name&merchant_id=eq.${M}&limit=1`)).data?.[0];
if (b) report('الفروع', 'تعديل', 'branches.manage', await api('PATCH', `branches?id=eq.${b.id}`, { name: b.name }));
const other = (await api('GET', `merchant_users?select=id,branch_id&merchant_id=eq.${M}&role=eq.admin&limit=1`)).data?.[0];
if (other) report('المستخدمين · تعديل مستخدم', 'تعديل', 'users.update', await api('PATCH', `merchant_users?id=eq.${other.id}`, { branch_id: other.branch_id }));
{
  const res = await fetch(`${SUPA}/functions/v1/admin-create-user`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  report('إضافة مستخدم (الدالة)', 'دخول', 'users.create', { ok: res.status === 400, status: res.status, err: (await res.text()).slice(0, 100) });
}
const bad = rows.filter(r => r.verdict !== 'OK');
console.log(`SUMMARY ${rows.length - bad.length}/${rows.length} as the role says`);
console.log('MISMATCH ' + JSON.stringify(bad));
