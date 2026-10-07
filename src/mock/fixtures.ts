/**
 * Placeholder records for developing the UI. NOT real data.
 * See ./README.md. Every id starts with "mock-" on purpose.
 */
import type {
  AttendanceRecord, AttendanceToday, ShippingCarrier, Shipment,
  AiInsight, ConnectedDevice, PolicyItem,
} from '@/services/contracts';

const today = () => new Date().toISOString().slice(0, 10);
const at = (hours: number, minutes = 0) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const mockAttendanceToday: AttendanceToday = {
  employeeId: 'mock-emp-1',
  employeeName: 'موظف تجريبي',
  date: today(),
  checkInAt: at(8, 12),
  checkOutAt: null,
  workedMinutes: 214,
  // null on purpose: lateness depends on shift rules the business has not
  // defined, and the frontend must not invent them
  lateMinutes: null,
  status: 'present',
  lastPunchAt: at(8, 12),
  lastPunchSource: 'device',
};

export const mockAttendanceRecords: AttendanceRecord[] = [
  {
    id: 'mock-att-1', employeeId: 'mock-emp-1', employeeName: 'موظف تجريبي ١',
    date: today(), checkInAt: at(8, 12), checkOutAt: null,
    workedMinutes: 214, lateMinutes: null, status: 'present',
    source: 'device', deviceName: 'جهاز تجريبي',
  },
  {
    id: 'mock-att-2', employeeId: 'mock-emp-2', employeeName: 'موظف تجريبي ٢',
    date: today(), checkInAt: at(9, 5), checkOutAt: at(17, 2),
    workedMinutes: 477, lateMinutes: null, status: 'late',
    source: 'device', deviceName: 'جهاز تجريبي',
  },
  {
    id: 'mock-att-3', employeeId: 'mock-emp-3', employeeName: 'موظف تجريبي ٣',
    date: today(), checkInAt: null, checkOutAt: null,
    workedMinutes: null, lateMinutes: null, status: 'absent',
    source: null, deviceName: null,
  },
  {
    id: 'mock-att-4', employeeId: 'mock-emp-1', employeeName: 'موظف تجريبي ١',
    date: daysAgo(1).slice(0, 10), checkInAt: daysAgo(1), checkOutAt: daysAgo(1),
    workedMinutes: 462, lateMinutes: null, status: 'present',
    source: 'manual', deviceName: null,
  },
];

// No carrier is named: these are placeholders, and the real list comes from the
// backend once a company is chosen.
export const mockCarriers: ShippingCarrier[] = [
  {
    id: 'mock-carrier-1', name: 'شركة شحن تجريبية ١', logoUrl: null,
    serviceType: 'سريع', isActive: true, connectionStatus: 'not_configured',
    credentialsSet: false, lastSyncAt: null, shipmentCount: null,
    createdAt: daysAgo(30),
  },
  {
    id: 'mock-carrier-2', name: 'شركة شحن تجريبية ٢', logoUrl: null,
    serviceType: 'عادي', isActive: false, connectionStatus: 'not_configured',
    credentialsSet: false, lastSyncAt: null, shipmentCount: null,
    createdAt: daysAgo(12),
  },
];

/** Empty on purpose: no shipment exists until a real carrier is connected. */
export const mockShipments: Shipment[] = [];

/** Empty on purpose: no AI provider is configured, so there is nothing to show. */
export const mockInsights: AiInsight[] = [];

export const mockDevices: ConnectedDevice[] = [
  {
    id: 'mock-device-1', name: 'جهاز تجريبي', kind: 'غير محدد', model: null,
    branchName: null, status: 'never_connected',
    lastSeenAt: null, lastSyncAt: null, createdAt: daysAgo(3),
  },
];

/**
 * Deliberately empty. Prices and durations are commercial decisions the
 * business has not made; showing invented ones would be worse than showing
 * none, so the policy screens open on their empty state.
 */
export const mockPolicyItems: PolicyItem[] = [];
