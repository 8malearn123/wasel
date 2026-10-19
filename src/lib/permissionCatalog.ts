import type { CatalogPermission } from '@/hooks/useCustomRoles';

/**
 * The permissions a custom role may be built from — the rows the migrations
 * put in public.permissions (20261004100200_rbac.sql, 20261020100100_custom_roles.sql),
 * less CUSTOM_ROLE_FORBIDDEN.
 *
 * The role editor reads the table; this is what it shows when the table is
 * not there yet, so the owner always has the list to choose from. Saving still
 * goes through save_custom_role, which checks every key against the table.
 * customRoles.test.ts keeps the two in step.
 */
export const CUSTOM_ROLE_CATALOG: CatalogPermission[] = [
  { key: 'products.view', module: 'products', name: 'عرض المنتجات', description: 'قراءة الأجهزة والإكسسوارات وقطع الغيار' },
  { key: 'products.create', module: 'products', name: 'إضافة منتج', description: null },
  { key: 'products.update', module: 'products', name: 'تعديل منتج', description: null },
  { key: 'products.delete', module: 'products', name: 'حذف منتج', description: null },
  { key: 'products.media.upload', module: 'products', name: 'رفع صور المنتجات', description: null },
  { key: 'products.media.delete', module: 'products', name: 'حذف صور المنتجات', description: null },
  { key: 'categories.manage', module: 'products', name: 'إدارة التصنيفات', description: null },
  { key: 'employees.view', module: 'employees', name: 'عرض الموظفين', description: null },
  { key: 'employees.create', module: 'employees', name: 'إضافة موظف', description: null },
  { key: 'employees.update', module: 'employees', name: 'تعديل موظف', description: null },
  { key: 'employees.delete', module: 'employees', name: 'أرشفة موظف', description: null },
  { key: 'dashboard.view', module: 'dashboard', name: 'عرض لوحة التحكم', description: 'الصفحة الرئيسية وملخصها المالي' },
  { key: 'pos.access', module: 'sales', name: 'نقطة البيع', description: 'إنشاء فواتير البيع وسجل مبيعات الكاشير' },
  { key: 'invoices.view', module: 'finance', name: 'الاطلاع على الفواتير', description: 'تفاصيل المبيعات والفواتير في التقارير' },
  { key: 'reports.view', module: 'finance', name: 'عرض التقارير المالية', description: 'المبيعات والأرباح والمخزون وبقية التقارير' },
  { key: 'closings.manage', module: 'finance', name: 'الإغلاق اليومي وحركة الصندوق', description: 'تقارير الإغلاق اليومي والكاش' },
  { key: 'suppliers.manage', module: 'finance', name: 'الموردون والمشتريات والمديونيات', description: 'أوامر الشراء ومديونيات الموردين' },
  { key: 'repairs.manage', module: 'sales', name: 'إدارة الصيانة', description: null },
  { key: 'online_orders.manage', module: 'sales', name: 'إدارة طلبات المتجر', description: null },
  { key: 'store.manage', module: 'sales', name: 'إدارة المتجر الإلكتروني', description: 'إعدادات المتجر ومحركات البحث' },
  { key: 'customers.manage', module: 'sales', name: 'العملاء والولاء', description: null },
  { key: 'marketing.manage', module: 'sales', name: 'التسويق والكوبونات', description: null },
  { key: 'wholesale.manage', module: 'sales', name: 'بيع الجملة', description: null },
  { key: 'stocktake.manage', module: 'products', name: 'الجرد', description: null },
  { key: 'transfers.manage', module: 'products', name: 'التحويلات بين الفروع', description: null },
  { key: 'shipping.manage', module: 'shipping', name: 'الشحن', description: null },
  { key: 'ai_insights.view', module: 'insights', name: 'تحليلات الذكاء الاصطناعي', description: null },
  { key: 'attendance.manage', module: 'employees', name: 'الحضور وأجهزة البصمة', description: null },
  { key: 'payroll.manage', module: 'employees', name: 'الرواتب', description: null },
];
