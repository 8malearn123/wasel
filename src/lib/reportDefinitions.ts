import type { ReportDefinition } from './reportEngine';
import type { Sale, Device, Accessory } from '@/types/database';
import type { Customer } from '@/hooks/useCustomers';

/**
 * The reports available, as definitions rather than screens.
 *
 * Each one describes its columns over a row type the hooks already return, so
 * nothing new is fetched and nothing is duplicated. Adding a report means
 * adding a definition here and a tab that passes it rows.
 *
 * requiredPermission is a hint for the UI; the rows themselves are already
 * scoped by RLS, so a user who should not see them receives none.
 */

const PAYMENT_METHOD_AR: Record<string, string> = {
  cash: 'نقدي', card: 'شبكة', bank_transfer: 'تحويل بنكي', mixed: 'مختلط',
};
const PAYMENT_STATUS_AR: Record<string, string> = {
  paid: 'مدفوع', unpaid: 'غير مدفوع', partial: 'مدفوع جزئياً',
};
const DEVICE_STATUS_AR: Record<string, string> = {
  available: 'متاح', reserved: 'محجوز', sold: 'مباع',
  transferred: 'محوّل', repair: 'في الصيانة',
};

export const salesReport: ReportDefinition<Sale> = {
  key: 'sales',
  title: 'المبيعات',
  dateKey: 'sale_date',
  columns: [
    { key: 'invoice_number', header: 'رقم الفاتورة', value: r => r.invoice_number, width: 16 },
    { key: 'sale_date', header: 'التاريخ', type: 'date', value: r => r.sale_date, align: 'center', width: 20 },
    { key: 'customer_name', header: 'العميل', value: r => r.customer_name || '' },
    { key: 'customer_phone', header: 'الجوال', value: r => r.customer_phone || '', defaultHidden: true },
    { key: 'subtotal', header: 'قبل الضريبة', type: 'money', value: r => Number(r.subtotal), align: 'center', defaultHidden: true },
    { key: 'tax_amount', header: 'الضريبة', type: 'money', value: r => Number(r.tax_amount), align: 'center', defaultHidden: true },
    { key: 'discount_amount', header: 'الخصم', type: 'money', value: r => Number(r.discount_amount), align: 'center' },
    { key: 'total_amount', header: 'الإجمالي', type: 'money', value: r => Number(r.total_amount), align: 'center' },
    { key: 'payment_method', header: 'طريقة الدفع', value: r => PAYMENT_METHOD_AR[r.payment_method] || r.payment_method, align: 'center' },
    { key: 'payment_status', header: 'حالة الدفع', value: r => PAYMENT_STATUS_AR[r.payment_status] || r.payment_status, align: 'center' },
    { key: 'branch', header: 'الفرع', value: r => r.branch?.name || '', align: 'center', defaultHidden: true },
  ],
};

export const devicesReport: ReportDefinition<Device> = {
  key: 'devices',
  title: 'الأجهزة',
  dateKey: 'created_at',
  columns: [
    { key: 'imei', header: 'IMEI', value: r => r.imei, width: 20 },
    { key: 'brand', header: 'الماركة', value: r => r.brand || '', align: 'center' },
    { key: 'model', header: 'الموديل', value: r => r.model },
    { key: 'storage', header: 'السعة', value: r => r.storage || '', align: 'center' },
    { key: 'color', header: 'اللون', value: r => r.color || '', align: 'center' },
    { key: 'condition', header: 'الحالة', value: r => r.condition || '', align: 'center', defaultHidden: true },
    { key: 'cost', header: 'التكلفة', type: 'money', value: r => Number(r.cost), align: 'center' },
    { key: 'price', header: 'السعر', type: 'money', value: r => Number(r.price), align: 'center' },
    { key: 'margin', header: 'الربح', type: 'money', value: r => Number(r.price) - Number(r.cost), align: 'center' },
    { key: 'status', header: 'الوضع', value: r => DEVICE_STATUS_AR[r.status] || r.status, align: 'center' },
    { key: 'created_at', header: 'أُضيف في', type: 'date', value: r => r.created_at, align: 'center', defaultHidden: true },
  ],
};

export const accessoriesReport: ReportDefinition<Accessory> = {
  key: 'accessories',
  title: 'الإكسسوارات',
  dateKey: 'created_at',
  columns: [
    { key: 'sku', header: 'SKU', value: r => r.sku },
    { key: 'name', header: 'الاسم', value: r => r.name, width: 26 },
    { key: 'category', header: 'التصنيف', value: r => r.category || '', align: 'center' },
    { key: 'brand', header: 'الماركة', value: r => r.brand || '', align: 'center', defaultHidden: true },
    { key: 'quantity', header: 'الكمية', type: 'number', value: r => Number(r.quantity), align: 'center' },
    { key: 'min_quantity', header: 'حد التنبيه', type: 'number', value: r => Number(r.min_quantity ?? 0), align: 'center', defaultHidden: true },
    { key: 'cost', header: 'التكلفة', type: 'money', value: r => Number(r.cost), align: 'center' },
    { key: 'price', header: 'السعر', type: 'money', value: r => Number(r.price), align: 'center' },
    { key: 'stock_value', header: 'قيمة المخزون', type: 'money', value: r => Number(r.cost) * Number(r.quantity), align: 'center' },
    { key: 'created_at', header: 'أُضيف في', type: 'date', value: r => r.created_at, align: 'center', defaultHidden: true },
  ],
};

export const customersReport: ReportDefinition<Customer> = {
  key: 'customers',
  title: 'العملاء',
  dateKey: 'created_at',
  columns: [
    { key: 'name', header: 'الاسم', value: r => r.name, width: 24 },
    { key: 'phone', header: 'الجوال', value: r => r.phone || '' },
    { key: 'email', header: 'البريد', value: r => r.email || '', defaultHidden: true },
    { key: 'total_purchases', header: 'عدد المشتريات', type: 'number', value: r => Number(r.total_purchases ?? 0), align: 'center' },
    { key: 'total_spent', header: 'إجمالي الإنفاق', type: 'money', value: r => Number(r.total_spent ?? 0), align: 'center' },
    { key: 'loyalty_points', header: 'نقاط الولاء', type: 'number', value: r => Number(r.loyalty_points ?? 0), align: 'center' },
    { key: 'created_at', header: 'أول تعامل', type: 'date', value: r => r.created_at, align: 'center' },
  ],
};
