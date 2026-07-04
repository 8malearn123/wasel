import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Package, Truck, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackPublicOrder, type OnlineOrder, type OnlineOrderItem, type StoreSettings } from '@/hooks/useOnlineStore';
import { StoreSEO } from '@/components/store/StoreSEO';
import { toast } from 'sonner';

const STATUS_FLOW = [
  { key: 'pending', label: 'بانتظار التأكيد', icon: Clock },
  { key: 'confirmed', label: 'مؤكّد', icon: CheckCircle2 },
  { key: 'shipped', label: 'في الطريق', icon: Truck },
  { key: 'delivered', label: 'تم التسليم', icon: Package },
];

export function StoreTrackOrderPage({ store }: { store: StoreSettings }) {
  const { orderNumber: paramOrder } = useParams<{ orderNumber: string }>();
  const [orderNumber, setOrderNumber] = useState(paramOrder || '');
  const [last4, setLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OnlineOrder | null>(null);
  const [items, setItems] = useState<OnlineOrderItem[]>([]);
  const currency = store.currency_symbol || 'ر.س';

  const search = async () => {
    if (!orderNumber.trim() || last4.length !== 4) { toast.error('عبّئ رقم الطلب وآخر 4 أرقام من الجوال'); return; }
    setLoading(true);
    const res = await trackPublicOrder(orderNumber.trim(), last4);
    setLoading(false);
    if (res.error) { toast.error(res.error); setOrder(null); return; }
    setOrder(res.order!); setItems(res.items || []);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <StoreSEO title={`تتبع الطلب - ${store.store_name}`} noindex />
      <h1 className="text-2xl font-bold mb-6">تتبع طلبك</h1>
      <div className="bg-card border rounded-xl p-6 space-y-4 mb-6">
        <div><Label>رقم الطلب</Label><Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} dir="ltr" placeholder="ORD-..." /></div>
        <div><Label>آخر 4 أرقام من جوالك</Label><Input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} dir="ltr" maxLength={4} /></div>
        <Button onClick={search} disabled={loading} className="w-full text-white" style={{ background: `hsl(var(--store-primary))` }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بحث'}
        </Button>
      </div>

      {order && (
        <div className="bg-card border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">رقم الطلب</p>
              <p className="font-mono font-bold">{order.order_number}</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">الإجمالي</p>
              <p className="font-bold" style={{ color: `hsl(var(--store-primary))` }}>{Number(order.total_amount).toLocaleString()} {currency}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {STATUS_FLOW.map((s, i) => {
              const currentIdx = STATUS_FLOW.findIndex((x) => x.key === order.status);
              const reached = currentIdx >= i;
              const Icon = s.icon;
              return (
                <div key={s.key} className="text-center">
                  <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${reached ? 'text-white' : 'bg-muted text-muted-foreground'}`} style={reached ? { background: `hsl(var(--store-primary))` } : {}}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-xs">{s.label}</p>
                </div>
              );
            })}
          </div>

          {order.tracking_number && (
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <p className="text-xs text-muted-foreground">رقم الشحنة</p>
              <p className="font-mono font-bold">{order.tracking_number}</p>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">المنتجات</h3>
            <div className="space-y-2 text-sm">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>{it.item_name} × {it.quantity}</span>
                  <span>{(Number(it.unit_price) * it.quantity).toLocaleString()} {currency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
