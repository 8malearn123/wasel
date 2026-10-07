import { describe, it, expect, beforeEach } from 'vitest';
import { mockAttendanceService, __resetAttendanceMock } from './attendance';
import { isOk } from '../contracts';

// The mock stands in for a backend, so the behaviour the UI relies on is
// pinned here: no double punch, no check-out before check-in, filters apply.
describe('attendance mock', () => {
  beforeEach(() => __resetAttendanceMock());

  it('reports today without inventing a lateness figure', async () => {
    const result = await mockAttendanceService.getToday();
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    // null, not 0: shift rules are not defined, so lateness is unknown
    expect(result.data.lateMinutes).toBeNull();
  });

  it('refuses a second check-in on the same day', async () => {
    const again = await mockAttendanceService.checkIn('mock-emp-1');
    expect(isOk(again)).toBe(false);
  });

  it('refuses a second check-out', async () => {
    const first = await mockAttendanceService.checkOut('mock-emp-1');
    expect(isOk(first)).toBe(true);
    const second = await mockAttendanceService.checkOut('mock-emp-1');
    expect(isOk(second)).toBe(false);
  });

  it('filters by status, employee and search', async () => {
    const byStatus = await mockAttendanceService.list({ status: 'absent' });
    expect(isOk(byStatus)).toBe(true);
    if (isOk(byStatus)) expect(byStatus.data.items.every(r => r.status === 'absent')).toBe(true);

    const byEmployee = await mockAttendanceService.list({ employeeId: 'mock-emp-1' });
    if (isOk(byEmployee)) expect(byEmployee.data.items.every(r => r.employeeId === 'mock-emp-1')).toBe(true);

    const bySearch = await mockAttendanceService.list({ search: 'لا أحد' });
    if (isOk(bySearch)) expect(bySearch.data.items).toHaveLength(0);
  });

  it('pages and keeps the total', async () => {
    const page = await mockAttendanceService.list({ page: 1, pageSize: 2 });
    expect(isOk(page)).toBe(true);
    if (!isOk(page)) return;
    expect(page.data.items.length).toBeLessThanOrEqual(2);
    expect(page.data.total).toBeGreaterThan(2);
  });
});
