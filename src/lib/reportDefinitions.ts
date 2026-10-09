import type { ReportDefinition, ReportStat } from './reportEngine';
import { fmtCount, fmtMoney, fmtNumber } from './reportFormat';
import type { Sale, Device, Accessory, Supplier } from '@/types/database';
import type { Customer } from '@/hooks/useCustomers';

/**
 * The reports available, as definitions rather than screens.
 *
 * Each one describes its columns over a row type the hooks already return, so
 * nothing new is fetched and nothing is duplicated. Adding a report means
 * adding a definition here and a tab that passes it rows.
 *
 * `stats` runs over the rows the filters left, so the figures above a table
 * always answer for what the table is showing. A report returns only the
 * figures its data supports — a number it cannot compute is left out, never
 * shown as a zero that reads like a real answer.
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

const sum = <Row,>(rows: Row[], of: (row: Row) => number) =>
  rows.reduce((total, row) => total + (Number(of(row)) || 0), 0);

export const salesReport: ReportDefinition<Sale> = {
  key: 'sales',
  title: 'المبيعات',
  dateKey: 'sale_date',
  rowKey: r => r.id,
  columns: [
    { key: 'invoice_number', header: 'رقم الفاتورة', type: 'id', value: r => r.invoice_number, width: 16 },
    { key: 'sale_date', header: 'التاريخ', type: 'date', value: r => r.sale_date, align: 'center', width: 20 },
    { key: 'customer_name', header: 'العميل', value: r => r.customer_name || '' },
    { key: 'customer_phone', header: 'الجوال', type: 'id', value: r => r.customer_phone || '', defaultHidden: true },
    { key: 'subtotal', header: 'قبل الضريبة', type: 'money', value: r => Number(r.subtotal), align: 'center', defaultHidden: true },
    { key: 'tax_amount', header: 'الضريبة', type: 'money', value: r => Number(r.tax_amount), align: 'center', defaultHidden: true },
    { key: 'discount_amount', header: 'الخصم', type: 'money', value: r => Number(r.discount_amount), align: 'center' },
    { key: 'total_amount', header: 'الإجمالي', type: 'money', value: r => Number(r.total_amount), align: 'center' },
    {
      key: 'payment_method', header: 'طريقة الدفع', align: 'center', filterable: true,
      value: r => PAYMENT_METHOD_AR[r.payment_method] || r.payment_method,
    },
    {
      key: 'payment_status', header: 'حالة الدفع', align: 'center', filterable: true,
      value: r => PAYMENT_STATUS_AR[r.payment_status] || r.payment_status,
    },
    {
      key: 'branch', header: 'الفرع', align: 'center', defaultHidden: true, filterable: true,
      value: r => r.branch?.name || '',
    },
  ],
  stats: rows => {
    const total = sum(rows, r => Number(r.total_amount));
    const discounts = sum(rows, r => Number(r.discount_amount));
    const stats: ReportStat[] = [
      { key: 'total', label: 'إجمالي المبيعات', value: fmtMoney(total), tone: 'positive' },
      { key: 'count', label: 'عدد العمليات', value: fmtCount(rows.length) },
      {
        key: 'average', label: 'متوسط قيمة العملية',
        value: rows.length ? fmtMoney(total / rows.length) : '—',
      },
    ];
    // Shown only when some sale actually carried a discount: a flat zero here
    // would read as a fact about the period rather than an absence of data.
    if (discounts > 0) {
      stats.push({ key: 'discounts', label: 'إجمالي الخصومات', value: fmtMoney(discounts), tone: 'warning' });
    }
    return stats;
  },
};

export const devicesReport: ReportDefinition<Device> = {
  key: 'devices',
  title: 'الأجهزة',
  dateKey: 'created_at',
  rowKey: r => r.id,
  columns: [
    { key: 'imei', header: 'IMEI', type: 'id', value: r => r.imei, width: 20 },
    { key: 'brand', header: 'الماركة', value: r => r.brand || '', align: 'center', filterable: true },
    { key: 'model', header: 'الموديل', value: r => r.model },
    { key: 'storage', header: 'السعة', value: r => r.storage || '', align: 'center', filterable: true },
    { key: 'color', header: 'اللون', value: r => r.color || '', align: 'center' },
    { key: 'condition', header: 'الحالة', value: r => r.condition || '', align: 'center', defaultHidden: true, filterable: true },
    { key: 'cost', header: 'التكلفة', type: 'money', value: r => Number(r.cost), align: 'center' },
    { key: 'price', header: 'السعر', type: 'money', value: r => Number(r.price), align: 'center' },
    { key: 'margin', header: 'الربح المتوقع', type: 'money', value: r => Number(r.price) - Number(r.cost), align: 'center' },
    {
      key: 'status', header: 'الوضع', align: 'center', filterable: true, filterLabel: 'الوضع',
      value: r => DEVICE_STATUS_AR[r.status] || r.status,
    },
    { key: 'created_at', header: 'أُضيف في', type: 'date', value: r => r.created_at, align: 'center', defaultHidden: true },
  ],
  stats: rows => [
    { key: 'count', label: 'عدد الأجهزة', value: fmtCount(rows.length) },
    {
      key: 'available', label: 'المتاح للبيع',
      value: fmtCount(rows.filter(r => r.status === 'available').length),
    },
    {
      key: 'cost', label: 'قيمة المخزون بالتكلفة',
      value: fmtMoney(sum(rows, r => Number(r.cost))),
    },
    {
      key: 'retail', label: 'القيمة التقديرية للبيع',
      value: fmtMoney(sum(rows, r => Number(r.price))),
      hint: 'بأسعار البيع الحالية',
    },
  ],
};

export const accessoriesReport: ReportDefinition<Accessory> = {
  key: 'accessories',
  title: 'الإكسسوارات',
  dateKey: 'created_at',
  rowKey: r => r.id,
  columns: [
    { key: 'sku', header: 'SKU', type: 'id', value: r => r.sku },
    { key: 'name', header: 'اسم المنتج', value: r => r.name, width: 26 },
    { key: 'category', header: 'التصنيف', value: r => r.category || '', align: 'center', filterable: true },
    { key: 'brand', header: 'الماركة', value: r => r.brand || '', align: 'center', defaultHidden: true, filterable: true },
    { key: 'quantity', header: 'الكمية المتوفرة', type: 'number', value: r => Number(r.quantity), align: 'center' },
    { key: 'min_quantity', header: 'حد التنبيه', type: 'number', value: r => Number(r.min_quantity ?? 0), align: 'center', defaultHidden: true },
    { key: 'cost', header: 'تكلفة الوحدة', type: 'money', value: r => Number(r.cost), align: 'center' },
    { key: 'price', header: 'سعر البيع', type: 'money', value: r => Number(r.price), align: 'center' },
    {
      // The header says التكلفة because the figure is cost × quantity. Calling
      // it plain "قيمة المخزون" invited reading it as a retail figure, and the
      // two differ by the whole margin.
      key: 'stock_value', header: 'قيمة المخزون (تكلفة)', type: 'money', align: 'center',
      value: r => Number(r.cost) * Number(r.quantity),
    },
    {
      key: 'retail_value', header: 'القيمة التقديرية للبيع', type: 'money', align: 'center', defaultHidden: true,
      value: r => Number(r.price) * Number(r.quantity),
    },
    { key: 'created_at', header: 'أُضيف في', type: 'date', value: r => r.created_at, align: 'center', defaultHidden: true },
  ],
  stats: rows => [
    { key: 'count', label: 'عدد المنتجات', value: fmtCount(rows.length) },
    { key: 'quantity', label: 'إجمالي الكميات المتوفرة', value: fmtNumber(sum(rows, r => Number(r.quantity))) },
    {
      key: 'cost', label: 'قيمة المخزون بالتكلفة',
      value: fmtMoney(sum(rows, r => Number(r.cost) * Number(r.quantity))),
    },
    {
      key: 'retail', label: 'القيمة التقديرية للبيع',
      value: fmtMoney(sum(rows, r => Number(r.price) * Number(r.quantity))),
      hint: 'بأسعار البيع الحالية',
    },
  ],
};

export const customersReport: ReportDefinition<Customer> = {
  key: 'customers',
  title: 'العملاء',
  dateKey: 'created_at',
  rowKey: r => r.id,
  columns: [
    { key: 'name', header: 'الاسم', value: r => r.name, width: 24 },
    { key: 'phone', header: 'الجوال', type: 'id', value: r => r.phone || '' },
    { key: 'email', header: 'البريد', value: r => r.email || '', defaultHidden: true },
    { key: 'total_purchases', header: 'عدد المشتريات', type: 'number', value: r => Number(r.total_purchases ?? 0), align: 'center' },
    { key: 'total_spent', header: 'إجمالي الإنفاق', type: 'money', value: r => Number(r.total_spent ?? 0), align: 'center' },
    { key: 'loyalty_points', header: 'نقاط الولاء', type: 'number', value: r => Number(r.loyalty_points ?? 0), align: 'center' },
    { key: 'created_at', header: 'أول تعامل', type: 'date', value: r => r.created_at, align: 'center' },
  ],
  stats: rows => {
    const spent = sum(rows, r => Number(r.total_spent ?? 0));
    const buyers = rows.filter(r => Number(r.total_purchases ?? 0) > 0);
    return [
      { key: 'count', label: 'عدد العملاء', value: fmtCount(rows.length) },
      { key: 'buyers', label: 'عملاء لديهم مشتريات', value: fmtCount(buyers.length) },
      { key: 'spent', label: 'إجمالي الإنفاق', value: fmtMoney(spent), tone: 'positive' },
      {
        key: 'average', label: 'متوسط إنفاق العميل المشتري',
        value: buyers.length ? fmtMoney(spent / buyers.length) : '—',
      },
    ];
  },
};

/**
 * The suppliers report.
 *
 * `balance` is what the shop owes the supplier, as the suppliers screen reads
 * it, so the figures here are debt — not purchase volume, which lives on the
 * purchase orders and is not part of this row.
 */
export const suppliersReport: ReportDefinition<Supplier> = {
  key: 'suppliers',
  title: 'الموردين',
  dateKey: 'created_at',
  rowKey: r => r.id,
  columns: [
    { key: 'name', header: 'المورد', value: r => r.name, width: 24 },
    { key: 'contact_name', header: 'مسؤول التواصل', value: r => r.contact_name || '' },
    { key: 'phone', header: 'الجوال', type: 'id', value: r => r.phone || '' },
    { key: 'email', header: 'البريد', value: r => r.email || '', defaultHidden: true },
    { key: 'address', header: 'العنوان', value: r => r.address || '', defaultHidden: true },
    { key: 'balance', header: 'المديونية', type: 'money', value: r => Number(r.balance ?? 0), align: 'center' },
    {
      key: 'is_active', header: 'الوضع', align: 'center', filterable: true, filterLabel: 'الوضع',
      value: r => (r.is_active ? 'نشط' : 'موقوف'),
    },
    { key: 'created_at', header: 'أُضيف في', type: 'date', value: r => r.created_at, align: 'center', defaultHidden: true },
  ],
  stats: rows => {
    const owed = sum(rows, r => Number(r.balance ?? 0));
    const withDebt = rows.filter(r => Number(r.balance ?? 0) > 0);
    const stats: ReportStat[] = [
      { key: 'count', label: 'عدد الموردين', value: fmtCount(rows.length) },
      { key: 'active', label: 'موردون نشطون', value: fmtCount(rows.filter(r => r.is_active).length) },
      {
        key: 'owed', label: 'إجمالي المديونيات',
        value: fmtMoney(owed), tone: owed > 0 ? 'danger' : 'default',
      },
    ];
    if (withDebt.length > 0) {
      stats.push({ key: 'withDebt', label: 'موردون لهم مديونية', value: fmtCount(withDebt.length) });
    }
    return stats;
  },
};
