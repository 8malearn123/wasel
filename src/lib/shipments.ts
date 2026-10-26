/**
 * The shipping page's figures and its waybill, from the store's own orders.
 *
 * Everything here comes from online_orders as they are: the carrier the
 * customer chose or the merchant shipped with, the tracking number, the
 * address and the shipping fee. Nothing is asked of a carrier's system — a
 * direct link (waybills created and statuses updated by the carrier) needs an
 * account and an API key from each carrier, and none is connected.
 */
import { orderShipment } from './shipping';
import { formatSar } from './money';

export type ShipmentStage = 'to_ship' | 'shipped' | 'delivered' | 'closed';

export interface ShipmentOrder {
  id: string;
  order_number: string;
  status: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_cost?: number | null;
  total_amount?: number | null;
  shipping_provider?: string | null;
  tracking_number?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export function shipmentStage(order: Pick<ShipmentOrder, 'status'>): ShipmentStage {
  switch (order.status) {
    case 'shipped': return 'shipped';
    case 'delivered': return 'delivered';
    case 'cancelled':
    case 'refunded': return 'closed';
    default: return 'to_ship'; // pending, confirmed, processing
  }
}

/** Cash the courier collects: an unpaid cash-on-delivery order's total */
export const collectOnDelivery = (o: Pick<ShipmentOrder, 'payment_status' | 'payment_method' | 'total_amount'>) =>
  o.payment_status !== 'paid' && (!o.payment_method || o.payment_method === 'cod') ? Number(o.total_amount || 0) : 0;

export interface ShippingStats {
  toShip: number;
  shipped: number;
  delivered: number;
  /** shipping fees on orders that went out */
  fees: number;
  /** cash couriers are carrying for orders shipped and not yet delivered */
  codInTransit: number;
  byCarrier: { name: string; count: number }[];
  byCity: { city: string; count: number }[];
  /** delivered of everything that went out, 0–100; null before anything went out */
  deliveredRate: number | null;
}

export function shippingStats(orders: ShipmentOrder[]): ShippingStats {
  const out = orders.filter(o => ['shipped', 'delivered'].includes(shipmentStage(o)));
  const count = (stage: ShipmentStage) => orders.filter(o => shipmentStage(o) === stage).length;
  const tally = (keys: string[]) => {
    const m = new Map<string, number>();
    keys.forEach(k => m.set(k, (m.get(k) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const delivered = count('delivered');
  return {
    toShip: count('to_ship'),
    shipped: count('shipped'),
    delivered,
    fees: out.reduce((s, o) => s + Number(o.shipping_cost || 0), 0),
    codInTransit: orders.filter(o => shipmentStage(o) === 'shipped').reduce((s, o) => s + collectOnDelivery(o), 0),
    byCarrier: tally(out.map(o => orderShipment(o).carrier?.name ?? 'بدون شركة محددة')).map(([name, n]) => ({ name, count: n })),
    byCity: tally(out.map(o => o.shipping_city?.trim() || 'غير محددة')).slice(0, 5).map(([city, n]) => ({ city, count: n })),
    deliveredRate: out.length ? Math.round((delivered / out.length) * 100) : null,
  };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * A printable waybill (A6) for an order: sender, recipient, carrier and
 * tracking number, the order number as a barcode, and the cash to collect.
 * `barcodeSvg` is the order number already drawn (JsBarcode), or empty.
 */
export function waybillHtml(order: ShipmentOrder, sender: { name: string; phone?: string | null }, itemsCount: number, barcodeSvg = ''): string {
  const shipment = orderShipment(order);
  const cod = collectOnDelivery(order);
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(order.order_number)}</title>
<style>
  @page { size: A6; margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; margin: 0; color: #111; font-size: 12px; }
  .box { border: 1.5px solid #111; border-radius: 6px; padding: 8px; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .lbl { color: #555; font-size: 10px; }
  .big { font-size: 15px; font-weight: 700; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .cod { background: #111; color: #fff; text-align: center; padding: 6px; border-radius: 6px; font-weight: 700; font-size: 14px; }
  .bar { text-align: center; } .bar svg { max-width: 100%; height: 60px; }
</style></head><body>
  <div class="row box"><div><div class="lbl">شركة الشحن</div><div class="big">${esc(shipment.carrier?.name ?? '—')}</div></div>
    <div style="text-align:left"><div class="lbl">رقم الشحنة</div><div class="big ltr">${esc(shipment.number ?? '—')}</div></div></div>
  <div class="box"><div class="lbl">المرسل</div><div class="big">${esc(sender.name)}</div>${sender.phone ? `<div class="ltr">${esc(sender.phone)}</div>` : ''}</div>
  <div class="box"><div class="lbl">المستلم</div><div class="big">${esc(order.customer_name)}</div>
    <div class="ltr">${esc(order.customer_phone)}</div>
    <div style="margin-top:4px"><b>${esc(order.shipping_city)}</b> — ${esc(order.shipping_address).replace(/\n/g, '<br>')}</div></div>
  <div class="row box"><div><div class="lbl">رقم الطلب</div><div class="big ltr">${esc(order.order_number)}</div></div>
    <div><div class="lbl">عدد القطع</div><div class="big">${itemsCount}</div></div></div>
  ${barcodeSvg ? `<div class="bar box">${barcodeSvg}</div>` : ''}
  ${cod > 0 ? `<div class="cod">تحصيل عند الاستلام: ${formatSar(cod)} ر.س</div>`
    : order.payment_status === 'paid' ? '<div class="lbl" style="text-align:center">مدفوع — لا يُحصَّل شيء عند الاستلام</div>'
    : '<div class="lbl" style="text-align:center">لا يُحصَّل شيء عند الاستلام</div>'}
</body></html>`;
}
