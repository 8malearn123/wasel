// One-off: can the demo admin actually DO things — add, change, delete — in
// every part of the shop? Each test record is made, changed and removed again;
// existing records are only saved back with their own values.
const SUPA = 'https://ynwddyxzypbcftlevuam.supabase.co';
const ANON = process.env.ANON;
const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo-admin@wasil.demo', password: 'demo1234' }),
});
const s = await r.json();
const H = { apikey: ANON, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' };
const api = async (method, path, body, prefer = 'return=representation') => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, { method, headers: { ...H, Prefer: prefer }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data, err: res.ok ? '' : (data?.message || text).slice(0, 160) };
};
const [me] = (await api('GET', `merchant_users?select=id,role,merchant_id&user_id=eq.${s.user.id}`)).data;
const M = me.merchant_id;
console.log('admin member', JSON.stringify(me));
const branches = (await api('GET', `branches?select=id,name&merchant_id=eq.${M}&order=created_at`)).data;
const B0 = branches[0]?.id, B1 = branches[1]?.id;
const ts = Date.now().toString().slice(-8);
const rows = [];
const report = (area, action, res) => {
  rows.push({ area, action, ok: res.ok, status: res.status, err: res.err });
  console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${area} · ${action}${res.ok ? '' : ` → ${res.status} ${res.err}`}`);
};
// add → change → delete
async function crud(area, table, insert, update) {
  const ins = await api('POST', table, { merchant_id: M, ...insert });
  report(area, 'إضافة', ins);
  const id = Array.isArray(ins.data) ? ins.data[0]?.id : undefined;
  if (!id) return null;
  report(area, 'تعديل', await api('PATCH', `${table}?id=eq.${id}`, update));
  return async () => report(area, 'حذف', await api('DELETE', `${table}?id=eq.${id}`));
}
async function crudNow(...a) { const del = await crud(...a); if (del) await del(); }

await crudNow('المنتجات · جهاز', 'devices', { imei: `99${ts}0000`, model: 'E2E جهاز اختبار', price: 1, cost: 1, status: 'available', branch_id: B0 }, { price: 2 });
await crudNow('المنتجات · إكسسوار', 'accessories', { name: 'E2E إكسسوار', sku: `E2E-A-${ts}`, price: 1, cost: 1, quantity: 1, branch_id: B0 }, { quantity: 2 });
await crudNow('المنتجات · قطعة صيانة', 'repair_parts', { name: 'E2E قطعة', sku: `E2E-P-${ts}` }, { name: 'E2E قطعة ٢' });
await crudNow('المتجر · تصنيف', 'store_categories', { name: 'E2E تصنيف' }, { name: 'E2E تصنيف ٢' });
await crudNow('المتجر · صفحة', 'store_pages', { slug: `e2e-${ts}`, title: 'E2E صفحة' }, { title: 'E2E صفحة ٢' });
await crudNow('التسويق · كوبون', 'coupons', { code: `E2E${ts}`, name: 'E2E كوبون', discount_type: 'percentage', discount_value: 10 }, { discount_value: 5 });
await crudNow('التسويق · حملة', 'campaigns', { name: 'E2E حملة' }, { name: 'E2E حملة ٢' });
await crudNow('العملاء · عميل', 'customers', { name: 'E2E عميل', phone: '0500000000' }, { name: 'E2E عميل ٢' });
{
  const delSupplier = await crud('الموردون · مورد', 'suppliers', { name: 'E2E مورد' }, { name: 'E2E مورد ٢' });
  const sup = (await api('GET', `suppliers?select=id&merchant_id=eq.${M}&name=eq.${encodeURIComponent('E2E مورد ٢')}`)).data?.[0];
  if (sup) await crudNow('المشتريات · أمر شراء', 'purchase_orders', { order_number: `E2E-PO-${ts}`, supplier_id: sup.id, branch_id: B0 }, { notes: 'E2E' });
  if (delSupplier) await delSupplier();
}
await crudNow('الصيانة · طلب صيانة', 'repair_orders', { repair_number: `E2E-R-${ts}`, customer_name: 'E2E', device_type: 'جوال', issue_description: 'اختبار', branch_id: B0 }, { issue_description: 'اختبار ٢' });
await crudNow('المخزون · جرد', 'stocktakes', { stocktake_number: `E2E-ST-${ts}`, branch_id: B0 }, { notes: 'E2E' });
if (B1) await crudNow('المخزون · تحويل بين الفروع', 'stock_transfers', { transfer_number: `E2E-T-${ts}`, from_branch_id: B0, to_branch_id: B1 }, { notes: 'E2E' });
await crudNow('المبيعات · فاتورة', 'sales', { invoice_number: `E2E-S-${ts}`, branch_id: B0, total_amount: 0, subtotal: 0, payment_method: 'cash' }, { notes: 'E2E' });

// existing records: saved back with their own values
const save = async (area, table, filter, fields) => {
  const cur = (await api('GET', `${table}?select=${fields.join(',')}&${filter}&limit=1`)).data?.[0];
  if (!cur) { report(area, 'قراءة', { ok: false, status: 0, err: 'لا يوجد سجل' }); return; }
  report(area, 'حفظ التعديل', await api('PATCH', `${table}?${filter}`, cur));
};
await save('إعدادات المتجر', 'store_settings', `merchant_id=eq.${M}`, ['store_name']);
await save('الفروع · تعديل فرع', 'branches', `id=eq.${B0}`, ['name']);
await save('إعدادات المنشأة', 'merchants', `id=eq.${M}`, ['name']);
const emp = (await api('GET', `merchant_users?select=id,branch_id&merchant_id=eq.${M}&role=eq.cashier&limit=1`)).data?.[0];
if (emp) report('المستخدمين · تغيير فرع موظف', 'حفظ التعديل', await api('PATCH', `merchant_users?id=eq.${emp.id}`, { branch_id: emp.branch_id }));
{
  const log = await api('POST', 'activity_logs', { merchant_id: M, user_id: s.user.id, action: 'e2e_check', entity_type: 'e2e' });
  report('سجل النشاط / الأدوار المخصصة', 'كتابة', log);
}
// newer screens (tables from later database files)
for (const t of ['employees', 'roles', 'permissions', 'product_media']) {
  const res = await api('GET', `${t}?select=*&limit=1`);
  report(`جدول ${t}`, 'قراءة', res);
}
// users function: is the admin let in? (an empty body is refused before anything is made)
{
  const res = await fetch(`${SUPA}/functions/v1/admin-create-user`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const body = await res.text();
  report('إضافة مستخدم (الدالة)', 'صلاحية الدخول', { ok: res.status === 400, status: res.status, err: body.slice(0, 160) });
}
const failed = rows.filter(x => !x.ok);
console.log(`SUMMARY ${rows.length - failed.length}/${rows.length} ok`);
console.log('FAILED ' + JSON.stringify(failed));
