import { describe, it, expect } from 'vitest';
import { toOrderShipping, orderShipment } from './shipping';

describe('order shipping in the database enum', () => {
  it('keeps aramex and smsa as they are', () => {
    expect(toOrderShipping('smsa', ' 290012 ')).toEqual({ shipping_provider: 'smsa', tracking_number: '290012' });
    expect(orderShipment({ shipping_provider: 'smsa', tracking_number: '290012' })).toMatchObject({
      carrier: { id: 'smsa' }, number: '290012', url: 'https://www.smsaexpress.com/ar/track?tracknumbers=290012',
    });
  });
  it('stores any other carrier as other, with its id in front of the number', () => {
    expect(toOrderShipping('naqel', '77001')).toEqual({ shipping_provider: 'other', tracking_number: 'naqel:77001' });
    expect(toOrderShipping('spl')).toEqual({ shipping_provider: 'other', tracking_number: 'spl:' });
    expect(orderShipment({ shipping_provider: 'other', tracking_number: 'naqel:77001' })).toMatchObject({
      carrier: { id: 'naqel' }, number: '77001', url: 'https://www.naqelexpress.com/ar/track-shipment/?waybill=77001',
    });
    expect(orderShipment({ shipping_provider: 'other', tracking_number: 'spl:' })).toMatchObject({ carrier: { id: 'spl' }, number: null, url: null });
  });
  it('reads old rows and rows without a carrier', () => {
    expect(orderShipment({ shipping_provider: 'other', tracking_number: 'ABC-1' })).toEqual({ carrier: undefined, number: 'ABC-1', url: null });
    expect(orderShipment({ shipping_provider: null, tracking_number: null })).toEqual({ carrier: undefined, number: null, url: null });
    expect(toOrderShipping(null)).toEqual({ shipping_provider: null, tracking_number: null });
  });
  it('a carrier without online tracking has no link', () => {
    expect(orderShipment({ shipping_provider: 'other', tracking_number: 'own:12' })).toMatchObject({ carrier: { id: 'own' }, number: '12', url: null });
  });
});
