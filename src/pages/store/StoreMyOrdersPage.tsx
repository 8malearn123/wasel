import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Package, ChevronDown, ChevronUp, ShoppingBag, Trash2, Truck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StoreSEO } from '@/components/store/StoreSEO';
import { getOrders, removeOrder, type SavedOrder } from '@/lib/storeOrdersHistory';
import { trackPublicOrder } from '@/hooks/useOnlineStore';
import type { StoreSettings } from '@/hooks/useOnlineStore';

interface OrderWithStatus extends SavedOrder {
  status?: string;
  payment_status?: string;
  tracking_number?: string | null;
}

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  pending: { label: 'بانتظار التأكيد', icon: Clock, cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  confirmed: { label: 'مؤكّد', icon: CheckCircle2, cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  shipped: { label: 'في الطريق', icon: Truck, cls: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  delivered: { label: 'تم التسليم', icon: Package, cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  cancelled: { label: 'ملغي', icon: XCircle, cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
};

export function StoreMyOrdersPage({ store }: { store: StoreSettings }) {
  const { slug } = useParams<{ slug: string }>();
  const [orders, setOrders] = useState<OrderWithStatus[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const currency = store.currency_symbol || 'ر.س';

  // Load + refresh statuses from server (using last 4 of saved phone)
  useEffect(() => {
    if (!slug) return;
    const local = getOrders(slug);
    setOrders(local);
    (async () => {
      const updated = await Promise.all(
        local.map(async (o) => {
          const last4 = (o.customer_phone || '').replace(/\D/g, '').slice(-4);
          if (!last4 || last4.length !== 4) return o;
          const res = await trackPublicOrder(o.order_number, last4);
          if (res.order) {
            return {
              ...o,
              status: (res.order as any).status,
              payment_status: (res.order as any).payment_status,
              tracking_number: (res.order as any).tracking_number,
            };
          }
          return o;
        })
      );
      setOrders(updated);
    })();
  }, [slug]);

  const handleRemove = (orderNumber: string) => {
    if (!slug) return;
    removeOrder(slug, orderNumber);
    setOrders((prev) => prev.filter((o) => o.order_number !== orderNumber));
  };

  if (orders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <StoreSEO title={`طلباتي - ${store.store_name}`} noindex />
        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">لا توجد طلبات سابقة</h1>
        <p className="text-muted-foreground mb-6">عند إتمام أول طلب من هذا المتجر، سيظهر هنا تلقائياً.</p>
        <Button asChild className="text-white" style={{ background: `hsl(var(--store-primary))` }}>
          <Link to={`/store/${slug}/products`}>تسوق الآن</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <StoreSEO title={`طلباتي - ${store.store_name}`} noindex />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">طلباتي</h1>
        <Badge variant="secondary">{orders.length} طلب</Badge>
      </div>

      <div className="space-y-3">
        {orders.map((o) => {
          const meta = STATUS_META[o.status || 'pending'] || STATUS_META.pending;
          const StatusIcon = meta.icon;
          const isOpen = openId === o.order_number;
          return (
            <div key={o.order_number} className="bg-card border rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => setOpenId(isOpen ? null : o.order_number)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-right"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-sm truncate">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString('ar-SA')} • {o.items.length} منتج
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`${meta.cls} border gap-1 hidden sm:inline-flex`} variant="outline">
                    <StatusIcon className="w-3 h-3" />
                    {meta.label}
                  </Badge>
                  <span className="font-bold text-sm" style={{ color: `hsl(var(--store-primary))` }}>
                    {o.total_amount.toLocaleString()} {currency}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Details */}
              {isOpen && (
                <div className="border-t p-4 space-y-4 bg-muted/20">
                  <Badge className={`${meta.cls} border gap-1 sm:hidden`} variant="outline">
                    <StatusIcon className="w-3 h-3" />
                    {meta.label}
                  </Badge>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">الاستلام</p>
                      <p className="font-medium">{o.customer_name}</p>
                      <p dir="ltr" className="text-right">{o.customer_phone}</p>
                      <p>{o.shipping_address}, {o.shipping_city}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">الدفع</p>
                      <p>{o.payment_method === 'bank_transfer' ? 'تحويل بنكي' : o.payment_method === 'apple_pay' ? 'أبل باي' : 'الدفع عند الاستلام'}</p>
                      <p className="text-muted-foreground">حالة الدفع</p>
                      <p>{o.payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}</p>
                      {o.tracking_number && (
                        <>
                          <p className="text-muted-foreground">رقم الشحنة</p>
                          <p className="font-mono">{o.tracking_number}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">المنتجات</p>
                    <div className="space-y-1.5">
                      {o.items.map((it, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{it.item_name} × {it.quantity}</span>
                          <span>{(it.quantity * it.unit_price).toLocaleString()} {currency}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs pt-3 border-t">
                    <Row label="المجموع الفرعي" value={`${o.subtotal.toLocaleString()} ${currency}`} />
                    <Row label="الضريبة" value={`${o.tax_amount.toLocaleString()} ${currency}`} />
                    <Row label="الشحن" value={o.shipping_cost === 0 ? 'مجاني' : `${o.shipping_cost.toLocaleString()} ${currency}`} />
                    <div className="flex justify-between font-bold text-sm pt-1.5 border-t">
                      <span>الإجمالي</span>
                      <span style={{ color: `hsl(var(--store-primary))` }}>{o.total_amount.toLocaleString()} {currency}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm" className="text-white" style={{ background: `hsl(var(--store-primary))` }}>
                      <Link to={`/store/${slug}/track/${o.order_number}`}>تتبع الطلب</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(o.order_number)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 ml-1" />
                      حذف من السجل
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground mt-6 text-center">
        * يُحفظ سجل الطلبات على هذا الجهاز فقط. الحالة تُحدّث من الخادم تلقائياً.
      </p>
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
