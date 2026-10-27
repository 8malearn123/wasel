// Carrier APIs for the shipping page, run on the server so no carrier key ever
// reaches the browser. Keys are Supabase function secrets (supabase secrets
// set ARAMEX_USERNAME=… etc.); a carrier without all of its secrets answers
// «not_configured» — nothing pretends to be connected.
//
// POST { action: 'status' }
// POST { action: 'rate',   carrier, orderId, weightKg? }
// POST { action: 'create', carrier, orderId, weightKg? }
// POST { action: 'track',  carrier, trackingNumber }
//
// The caller's own token is used for every database read, so RLS decides
// which order they may ship: only an order of their own shop is found.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ADAPTERS, carrierStatus, configured } from '../_shared/carriers/index.ts';
import { CarrierError, type Address, type HttpCall } from '../_shared/carriers/types.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const http: HttpCall = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, json: () => res.json().catch(() => ({})) };
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: token } },
  });
  const { data: user } = await db.auth.getUser();
  if (!user?.user) return json({ error: 'unauthorized' }, 401);

  const env = Deno.env.toObject();
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  if (body.action === 'status') return json({ carriers: carrierStatus(env) });

  const adapter = ADAPTERS[String(body.carrier ?? '')];
  if (!adapter) return json({ error: 'carrier_not_supported', carrier: body.carrier }, 400);
  if (!configured(adapter, env)) {
    return json({ error: 'not_configured', carrier: adapter.id, missingSecrets: adapter.secrets.filter(k => !env[k]) }, 409);
  }

  try {
    if (body.action === 'track') {
      if (!body.trackingNumber) return json({ error: 'tracking_number_required' }, 400);
      return json({ events: await adapter.track(http, env, String(body.trackingNumber)) });
    }

    if (body.action !== 'rate' && body.action !== 'create') return json({ error: 'unknown_action' }, 400);
    if (!body.orderId) return json({ error: 'order_id_required' }, 400);

    // RLS: found only when the order belongs to the caller's shop
    const { data: order } = await db.from('online_orders').select('*').eq('id', body.orderId).maybeSingle();
    if (!order) return json({ error: 'order_not_found' }, 404);
    const { data: store } = await db.from('store_settings')
      .select('store_name, whatsapp_number').eq('merchant_id', order.merchant_id).maybeSingle();
    const { data: items } = await db.from('online_order_items').select('quantity, item_name').eq('order_id', order.id);

    // the shop's pickup address is the carrier account's address unless set here
    const from: Address = {
      name: store?.store_name || env.SHIPPER_NAME || 'Store',
      phone: store?.whatsapp_number || env.SHIPPER_PHONE || '',
      line1: env.SHIPPER_ADDRESS || '',
      city: env.SHIPPER_CITY || 'Riyadh',
      countryCode: 'SA',
    };
    const to: Address = {
      name: order.customer_name, phone: order.customer_phone, email: order.customer_email,
      line1: order.shipping_address, city: order.shipping_city, countryCode: 'SA',
    };
    const pieces = (items ?? []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 1;
    const parcel = {
      weightKg: Number(body.weightKg) > 0 ? Number(body.weightKg) : 1,
      pieces,
      description: (items ?? []).map((i: any) => i.item_name).join(', ').slice(0, 100) || 'Order',
      codAmount: order.payment_status !== 'paid' && (!order.payment_method || order.payment_method === 'cod') ? Number(order.total_amount) : 0,
      reference: order.order_number,
    };

    if (body.action === 'rate') return json({ rate: await adapter.rate(http, env, from, to, parcel) });
    // The shipment is created at the carrier; the page then saves the tracking
    // number on the order (the same write as shipping by hand).
    return json({ shipment: await adapter.create(http, env, from, to, parcel) });
  } catch (e) {
    if (e instanceof CarrierError) return json({ error: 'carrier_error', carrier: e.carrier, message: e.message }, 502);
    return json({ error: 'internal_error' }, 500);
  }
});
