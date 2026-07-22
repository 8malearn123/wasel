import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { CheckCircle2, Loader2, Printer, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreSEO } from '@/components/store/StoreSEO';
import type { StoreSettings } from '@/hooks/useOnlineStore';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address: string;
  shipping_city: string;
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_amount: number;
  payment_status: string;
  status: string;
  created_at: string;
}

export function StoreThankYouPage({ store }: { store: StoreSettings }) {
  const { slug, orderNumber } = useParams<{ slug: string; orderNumber: string }>();
  const location = useLocation();
  const stateOrder = (location.state as any)?.order as (Order & { items: OrderItem[] }) | undefined;
  const loyalty = (location.state as any)?.loyalty as { points: number; total_points: number; tier: string } | null | undefined;

  const [order, setOrder] = useState<Order | null>(stateOrder || null);
  const [items, setItems] = useState<OrderItem[]>(stateOrder?.items || []);
  const [loading, setLoading] = useState(!stateOrder);

  const currency = store.currency_symbol || 'ر.س';

  useEffect(() => {
    if (stateOrder || !orderNumber) return;
    (async () => {
      const { data: orderData } = await supabase
        .from('online_orders')
        .select('*')
        .eq('order_number', orderNumber)
        .eq('merchant_id', store.merchant_id)
        .maybeSingle();
      if (orderData) {
        setOrder(orderData as any);
        const { data: itemsData } = await supabase
          .from('online_order_items')
          .select('id,item_name,quantity,unit_price')
          .eq('order_id', (orderData as any).id);
        setItems((itemsData || []) as OrderItem[]);
      }
      setLoading(false);
    })();
  }, [orderNumber, store.merchant_id, stateOrder]);

  const handlePrint = () => window.print();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 print:py-4">
      <StoreSEO title={`تم استلام طلبك - ${store.store_name}`} noindex />

      {/* Success header */}
      <div className="text-center mb-8 print:hidden">
        <CheckCircle2 className="w-20 h-20 mx-auto mb-4" style={{ color: `hsl(var(--store-primary))` }} />
        <h1 className="text-3xl font-bold mb-2">شكراً لطلبك!</h1>
        <p className="text-muted-foreground">تم استلام طلبك بنجاح وسنتواصل معك قريباً.</p>
      </div>

      {/* Loyalty award banner */}
      {loyalty && loyalty.points > 0 && (
        <div className="mb-6 print:hidden rounded-2xl border-2 p-5 flex items-center gap-4"
          style={{ borderColor: `hsl(var(--store-primary) / 0.4)`, background: `hsl(var(--store-primary) / 0.06)` }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl shrink-0"
            style={{ background: `hsl(var(--store-primary))` }}>🎁</div>
          <div className="flex-1">
            <p className="font-bold text-lg">حصلت على {loyalty.points} نقطة ولاء!</p>
            <p className="text-sm text-muted-foreground">
              رصيدك الحالي: <span className="font-semibold text-foreground">{loyalty.total_points} نقطة</span>
              {' • '}مستواك: <span className="font-semibold text-foreground">
                {loyalty.tier === 'platinum' ? 'بلاتيني' : loyalty.tier === 'gold' ? 'ذهبي' : loyalty.tier === 'silver' ? 'فضي' : 'برونزي'}
              </span>
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : !order ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">رقم الطلب:</p>
          <p className="font-mono font-bold text-xl" style={{ color: `hsl(var(--store-primary))` }}>{orderNumber}</p>
        </div>
      ) : (
        <>
          {/* Invoice */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm print:shadow-none print:border-0">
            {/* Invoice header */}
            <div className="p-6 border-b bg-muted/30 print:bg-transparent">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">{store.store_name}</h2>
                  <p className="text-xs text-muted-foreground">فاتورة طلب إلكتروني</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground mb-1">رقم الطلب</p>
                  <p className="font-mono font-bold text-lg" style={{ color: `hsl(var(--store-primary))` }}>
                    {order.order_number}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(order.created_at).toLocaleString('ar-SA')}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer */}
            <div className="p-6 border-b grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-semibold">بيانات العميل</p>
                <p className="font-medium">{order.customer_name}</p>
                <p dir="ltr" className="text-right">{order.customer_phone}</p>
                {order.customer_email && <p dir="ltr" className="text-right text-muted-foreground">{order.customer_email}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-semibold">عنوان الشحن</p>
                <p>{order.shipping_address}</p>
                <p className="text-muted-foreground">{order.shipping_city}</p>
              </div>
            </div>

            {/* Items */}
            <div className="p-6 border-b">
              <p className="text-xs text-muted-foreground mb-3 font-semibold">البنود</p>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{it.item_name}</p>
                        <p className="text-xs text-muted-foreground">الكمية: {it.quantity} × {it.unit_price.toLocaleString()} {currency}</p>
                      </div>
                    </div>
                    <p className="font-semibold">{(it.quantity * it.unit_price).toLocaleString()} {currency}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="p-6 space-y-2 text-sm">
              <Row label="المجموع الفرعي" value={`${order.subtotal.toLocaleString()} ${currency}`} />
              <Row label="ضريبة القيمة المضافة (15%)" value={`${order.tax_amount.toLocaleString()} ${currency}`} />
              <Row label="الشحن" value={order.shipping_cost === 0 ? 'مجاني' : `${order.shipping_cost.toLocaleString()} ${currency}`} />
              <div className="flex justify-between font-bold text-lg pt-3 border-t">
                <span>الإجمالي</span>
                <span style={{ color: `hsl(var(--store-primary))` }}>{order.total_amount.toLocaleString()} {currency}</span>
              </div>
              <div className="pt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">طريقة الدفع</span>
                <span className="font-medium">{order.payment_method === 'bank_transfer' ? 'تحويل بنكي' : order.payment_method === 'apple_pay' ? 'أبل باي' : 'الدفع عند الاستلام'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">حالة الدفع</span>
                <span className="font-medium">{order.payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 print:hidden">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="w-4 h-4 ml-2" /> طباعة الفاتورة
            </Button>
            <Button asChild className="text-white" style={{ background: `hsl(var(--store-primary))` }}>
              <Link to={`/store/${slug}/track/${orderNumber}`}>تتبع الطلب</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to={`/store/${slug}`}>متابعة التسوق</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
