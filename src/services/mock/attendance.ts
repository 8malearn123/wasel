import type {
  AttendanceService, AttendanceQuery, AttendanceRecord, Result, Paged,
} from '../contracts';
import { mockAttendanceToday, mockAttendanceRecords } from '@/mock/fixtures';

/** Mock. See src/mock/README.md. Replace in src/services/index.ts. */
const delay = (ms = 350) => new Promise(resolve => setTimeout(resolve, ms));
const ok = <T,>(data: T): Result<T> => ({ status: 'ok', data });

let today = { ...mockAttendanceToday };
let records = [...mockAttendanceRecords];

export const mockAttendanceService: AttendanceService = {
  async getToday() {
    await delay();
    return ok(today);
  },

  async checkIn() {
    await delay();
    if (today.checkInAt) {
      // The real backend is what prevents a double punch; the mock mirrors it
      // so the UI's duplicate handling is exercised.
      return { status: 'error' as const, error: { code: 'validation', message: 'تم تسجيل الحضور لهذا اليوم بالفعل' } };
    }
    const now = new Date().toISOString();
    today = { ...today, checkInAt: now, status: 'present', lastPunchAt: now, lastPunchSource: 'web' };
    return ok(today);
  },

  async checkOut() {
    await delay();
    if (!today.checkInAt) {
      return { status: 'error' as const, error: { code: 'validation', message: 'لا يوجد تسجيل حضور لهذا اليوم' } };
    }
    if (today.checkOutAt) {
      return { status: 'error' as const, error: { code: 'validation', message: 'تم تسجيل الانصراف بالفعل' } };
    }
    const now = new Date().toISOString();
    today = { ...today, checkOutAt: now, lastPunchAt: now, lastPunchSource: 'web' };
    return ok(today);
  },

  async list(query: AttendanceQuery): Promise<Result<Paged<AttendanceRecord>>> {
    await delay();
    let rows = records;

    if (query.employeeId) rows = rows.filter(r => r.employeeId === query.employeeId);
    if (query.status) rows = rows.filter(r => r.status === query.status);
    if (query.from) rows = rows.filter(r => r.date >= query.from!);
    if (query.to) rows = rows.filter(r => r.date <= query.to!);
    if (query.search) {
      const term = query.search.toLowerCase();
      rows = rows.filter(r => r.employeeName.toLowerCase().includes(term));
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    return ok({
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    });
  },
};

/** Test seam — lets a test start from a known state. */
export const __resetAttendanceMock = () => {
  today = { ...mockAttendanceToday };
  records = [...mockAttendanceRecords];
};
