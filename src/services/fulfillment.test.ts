import { describe, it, expect, vi } from 'vitest';

let answer: { error: { message: string; code?: string } | null } = { error: null };
const writes: unknown[] = [];
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ update: (row: unknown) => { writes.push(row); return { eq: async () => answer }; } }) },
}));

import { manualFulfillment, fulfillment } from './fulfillment';

describe('manual fulfillment', () => {
  it('is the provider in use', () => expect(fulfillment.kind).toBe('manual'));

  it('ships with the carrier and the waybill as the order stores them', async () => {
    answer = { error: null };
    expect(await manualFulfillment.ship({ orderId: 'o1', carrierId: 'aramex', trackingNumber: ' 123 ' })).toEqual({ ok: true });
    expect(writes.at(-1)).toEqual({ shipping_provider: 'aramex', tracking_number: '123', status: 'shipped' });
  });

  it('a failure comes back as an Arabic sentence, not thrown', async () => {
    answer = { error: { message: 'TypeError: Failed to fetch' } };
    const r = await manualFulfillment.ship({ orderId: 'o1', carrierId: 'smsa', trackingNumber: '9' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/تعذّر الاتصال/);
    answer = { error: { code: '42501', message: 'row-level security' } };
    const d = await manualFulfillment.markDelivered('o1');
    expect(d.ok === false && d.message).toBe('ليست لديك صلاحية لهذا الإجراء.');
  });
});
