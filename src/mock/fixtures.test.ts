import { describe, it, expect } from 'vitest';
import {
  mockPolicyItems, mockInsights, mockShipments, mockCarriers,
  mockAttendanceToday, mockAttendanceRecords, mockDevices,
} from './fixtures';

/**
 * These guard the rule that matters most about this folder: nothing in it may
 * look like a real commercial decision or a real analysis of somebody's shop.
 */
describe('mock fixtures', () => {
  it('invents no price and no duration', () => {
    // Empty on purpose — the business has not set these
    expect(mockPolicyItems).toHaveLength(0);
  });

  it('invents no AI insight', () => {
    expect(mockInsights).toHaveLength(0);
  });

  it('invents no shipment', () => {
    expect(mockShipments).toHaveLength(0);
  });

  it('names no real carrier and claims no connection', () => {
    for (const carrier of mockCarriers) {
      expect(carrier.connectionStatus).toBe('not_configured');
      expect(carrier.credentialsSet).toBe(false);
      expect(carrier.shipmentCount).toBeNull();
    }
  });

  it('names no real device type', () => {
    for (const device of mockDevices) {
      expect(device.status).toBe('never_connected');
      expect(device.lastSeenAt).toBeNull();
    }
  });

  it('computes no lateness', () => {
    expect(mockAttendanceToday.lateMinutes).toBeNull();
    for (const record of mockAttendanceRecords) {
      expect(record.lateMinutes).toBeNull();
    }
  });

  it('marks every record as mock by its id', () => {
    const ids = [
      ...mockCarriers.map(c => c.id),
      ...mockDevices.map(d => d.id),
      ...mockAttendanceRecords.map(r => r.id),
    ];
    for (const id of ids) expect(id.startsWith('mock-')).toBe(true);
  });
});
