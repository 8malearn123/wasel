// Award loyalty points after a public store order, only if the merchant's plan allows it
// and the store has loyalty_enabled. Uses service role to bypass RLS safely.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  merchant_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = (await req.json()) as Body;
    if (!body?.merchant_id || !body?.order_number || !body?.customer_phone) {
      return new Response(JSON.stringify({ error: 'invalid_input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Verify subscription plan has loyalty
    const { data: sub } = await supa
      .from('subscriptions')
      .select('plan_id, status')
      .eq('merchant_id', body.merchant_id)
      .maybeSingle();

    let planAllows = false;
    if (sub?.plan_id) {
      const { data: plan } = await supa
        .from('plans')
        .select('has_loyalty')
        .eq('id', sub.plan_id)
        .maybeSingle();
      planAllows = !!plan?.has_loyalty;
    }

    // 2) Verify store opted-in
    const { data: store } = await supa
      .from('store_settings')
      .select('loyalty_enabled, loyalty_points_per_currency')
      .eq('merchant_id', body.merchant_id)
      .maybeSingle();

    if (!planAllows || !store?.loyalty_enabled) {
      return new Response(
        JSON.stringify({ awarded: false, reason: !planAllows ? 'plan_disabled' : 'store_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Find the order (must belong to merchant)
    const { data: order, error: orderErr } = await supa
      .from('online_orders')
      .select('id, total_amount, customer_phone, customer_name, customer_email')
      .eq('merchant_id', body.merchant_id)
      .eq('order_number', body.order_number)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'order_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Find or create customer by phone
    const phone = body.customer_phone.trim();
    let { data: customer } = await supa
      .from('customers')
      .select('id, loyalty_points, total_spent, total_purchases')
      .eq('merchant_id', body.merchant_id)
      .eq('phone', phone)
      .maybeSingle();

    if (!customer) {
      const { data: created, error: cErr } = await supa
        .from('customers')
        .insert({
          merchant_id: body.merchant_id,
          name: body.customer_name || order.customer_name,
          phone,
          email: body.customer_email || order.customer_email || null,
          loyalty_points: 0,
          total_spent: 0,
          total_purchases: 0,
        })
        .select('id, loyalty_points, total_spent, total_purchases')
        .single();
      if (cErr) {
        return new Response(JSON.stringify({ error: cErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      customer = created;
    }

    // 5) Idempotency: skip if loyalty already awarded for this order
    const description = `طلب أونلاين ${body.order_number}`;
    const { data: existing } = await supa
      .from('loyalty_transactions')
      .select('id')
      .eq('merchant_id', body.merchant_id)
      .eq('customer_id', customer!.id)
      .eq('description', description)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ awarded: false, reason: 'already_awarded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6) Compute and add points
    const ratio = Number(store.loyalty_points_per_currency || 1);
    const pointsEarned = Math.max(0, Math.floor(Number(order.total_amount) * ratio));

    if (pointsEarned > 0) {
      await supa.from('loyalty_transactions').insert({
        merchant_id: body.merchant_id,
        customer_id: customer!.id,
        type: 'earn',
        points: pointsEarned,
        description,
      });
    }

    // 7) Determine new tier
    const newPoints = (customer!.loyalty_points || 0) + pointsEarned;
    const newSpent = Number(customer!.total_spent || 0) + Number(order.total_amount);
    const newCount = (customer!.total_purchases || 0) + 1;
    const tier =
      newPoints >= 5000 ? 'platinum' : newPoints >= 2000 ? 'gold' : newPoints >= 500 ? 'silver' : 'bronze';

    await supa
      .from('customers')
      .update({
        loyalty_points: newPoints,
        total_spent: newSpent,
        total_purchases: newCount,
        loyalty_tier: tier,
      })
      .eq('id', customer!.id);

    return new Response(
      JSON.stringify({
        awarded: true,
        points: pointsEarned,
        total_points: newPoints,
        tier,
        customer_id: customer!.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
