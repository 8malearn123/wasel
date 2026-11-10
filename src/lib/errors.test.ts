import { describe, it, expect } from 'vitest';
import { friendlyError, isNetworkError } from './errors';
import { isCashierMember } from './cashier';

describe('friendlyError', () => {
  it('turns a dropped connection into Arabic, never «TypeError: Failed to fetch»', () => {
    const e = { message: 'TypeError: Failed to fetch' };
    expect(isNetworkError(e)).toBe(true);
    expect(friendlyError(e, 'حفظ الجهاز')).toBe('تعذّر الاتصال بالخادم، ولم يتم حفظ الجهاز. تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.');
  });
  it('names duplicates, refusals and bad values without the database text', () => {
    expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "devices_merchant_id_imei_key"' })).not.toMatch(/duplicate|constraint/);
    expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy' })).toBe('ليست لديك صلاحية لهذا الإجراء.');
    expect(friendlyError({ code: '23514', message: 'violates check constraint' })).toMatch(/بيانات غير صالحة/);
  });
  it('tells a server failure apart from bad data and from a dropped connection', () => {
    const server = friendlyError({ code: 'XX000', message: 'internal error' }, 'إتمام البيع');
    expect(server).toMatch(/خطأ في الخادم/);
    expect(friendlyError({ message: 'Internal Server Error' }, 'إتمام البيع')).toMatch(/خطأ في الخادم/);
    expect(friendlyError({ code: '22P02', message: 'invalid input syntax for type numeric' })).toMatch(/بيانات غير صالحة/);
    expect(friendlyError({ code: '23502', message: 'null value in column "price" violates not-null constraint' })).toMatch(/بيانات غير صالحة/);
    expect(server).not.toMatch(/الإنترنت/);
  });
  it('names an expired session and a feature missing on the server', () => {
    expect(friendlyError({ code: 'PGRST301', message: 'JWT expired' })).toMatch(/انتهت جلستك/);
    expect(friendlyError({ code: 'PGRST205', message: "Could not find the table 'public.employees' in the schema cache" }, 'حفظ الموظف')).toBe('هذه الميزة غير مفعّلة على الخادم بعد، فلم يتم حفظ الموظف.');
    expect(friendlyError({ code: 'PGRST202', message: 'Could not find the function public.x' })).toMatch(/غير مفعّلة على الخادم/);
  });
  it('passes the database\'s own Arabic messages through', () => {
    expect(friendlyError({ code: 'P0001', message: 'لا يمكن للكاشير تعديل مبالغ فاتورة مدفوعة' })).toBe('لا يمكن للكاشير تعديل مبالغ فاتورة مدفوعة');
  });
});

describe('isCashierMember', () => {
  it('a cashier is a cashier also after the shop changed the role', () => {
    expect(isCashierMember({ role: 'cashier' })).toBe(true);
    expect(isCashierMember({ role: 'custom', customRole: { system: 'cashier' } })).toBe(true);
    expect(isCashierMember({ role: 'custom', customRole: {} })).toBe(false);
    expect(isCashierMember({ role: 'admin' })).toBe(false);
    expect(isCashierMember(null)).toBe(false);
  });
});
