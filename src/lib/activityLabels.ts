// What the activity log's codes mean, in words. The log stores codes
// (pos_sale_edited, custom_roles_update …); the platform pages used to show
// them raw, or only knew a handful of them.

const ACTIONS: Record<string, string> = {
  branch_activated: 'تفعيل فرع',
  device_added: 'إضافة جهاز',
  device_sold: 'بيع جهاز',
  sale_created: 'إنشاء فاتورة',
  sale_edited: 'تعديل فاتورة',
  pos_sale_edited: 'تعديل فاتورة من نقطة البيع',
  pos_sale_deleted: 'حذف فاتورة من نقطة البيع',
  pos_check_in: 'بدء وردية',
  pos_check_out: 'إنهاء وردية',
  repair_created: 'إنشاء إصلاح',
  transfer_created: 'إنشاء تحويل',
  user_created: 'إضافة مستخدم',
  accessory_added: 'إضافة إكسسوار',
  stocktake_created: 'إنشاء جرد',
  stocktake_completed: 'إنهاء جرد',
  custom_roles_update: 'تعديل الأدوار والصلاحيات',
  upgrade_requested: 'طلب ترقية الباقة',
};

const ENTITIES: Record<string, string> = {
  sale: 'فاتورة',
  attendance: 'حضور',
  branch: 'فرع',
  stocktake: 'جرد',
  subscription: 'اشتراك',
  custom_roles: 'الأدوار',
  device: 'جهاز',
  accessory: 'إكسسوار',
  repair: 'إصلاح',
  transfer: 'تحويل',
  user: 'مستخدم',
  settings: 'الإعدادات',
};

/** A code with no wording yet is shown as «إجراء آخر», never as the raw code */
export const actionLabel = (code?: string | null) => (code && ACTIONS[code]) || 'إجراء آخر';
export const entityLabel = (code?: string | null) => (code && ENTITIES[code]) || '—';
