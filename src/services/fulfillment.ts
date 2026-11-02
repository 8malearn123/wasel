/**
 * Shipping an order, separate from who carries it.
 *
 * The shipping screen asks a FulfillmentProvider to ship an order or mark it
 * delivered; it never knows how. Today the only provider is `manual`: the
 * merchant books the parcel with the carrier themselves and types the waybill
 * number here, and the order is updated in online_orders — exactly what the
 * screen did before.
 *
 * A carrier integration later (waybills issued by the carrier through the
 * backend's shipping-carriers function, statuses pushed back by it) is a second
 * provider with the same two methods. Credentials never pass through here.
 */
import { supabase } from '@/integrations/supabase/client';
import { friendlyError } from '@/lib/errors';
import { toOrderShipping } from '@/lib/shipping';

export interface ShipInput {
  orderId: string;
  carrierId: string;
  /** the waybill number; optional for carriers without online tracking */
  trackingNumber: string;
}

export type FulfillmentResult = { ok: true } | { ok: false; message: string };

export interface FulfillmentProvider {
  /** 'manual': the waybill comes from the merchant; 'carrier_api': from the carrier, through the backend */
  kind: 'manual' | 'carrier_api';
  ship(input: ShipInput): Promise<FulfillmentResult>;
  markDelivered(orderId: string): Promise<FulfillmentResult>;
}

export const manualFulfillment: FulfillmentProvider = {
  kind: 'manual',
  async ship({ orderId, carrierId, trackingNumber }) {
    const { error } = await supabase
      .from('online_orders')
      .update({ ...toOrderShipping(carrierId, trackingNumber), status: 'shipped' } as never)
      .eq('id', orderId);
    return error ? { ok: false, message: friendlyError(error, 'حفظ رقم الشحنة') } : { ok: true };
  },
  async markDelivered(orderId) {
    const { error } = await supabase
      .from('online_orders')
      .update({ status: 'delivered' } as never)
      .eq('id', orderId);
    return error ? { ok: false, message: friendlyError(error, 'تحديث حالة الطلب') } : { ok: true };
  },
};

/** The provider in use. Swap here when a carrier integration is live. */
export const fulfillment: FulfillmentProvider = manualFulfillment;
