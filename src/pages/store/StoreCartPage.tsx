import { Link, useParams } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreCart } from '@/components/store/StoreCart';
import { StoreSEO } from '@/components/store/StoreSEO';
import type { StoreSettings } from '@/hooks/useOnlineStore';

export function StoreCartPage({ store }: { store: StoreSettings }) {
  const { slug } = useParams<{ slug: string }>();
  const { items, subtotal, updateQty, removeItem } = useStoreCart();
  const currency = store.currency_symbol || 'ر.س';
  const shipping = store.free_shipping_threshold && subtotal >= store.free_shipping_threshold ? 0 : Number(store.shipping_cost || 0);
  const tax = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + tax + shipping;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-20 h-20 mx-auto text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold mb-2">سلتك فارغة</h1>
        <p className="text-muted-foreground mb-6">ابدأ التسوق وأضف منتجاتك المفضلة</p>
        <Button asChild size="lg" className="text-white" style={{ background: `hsl(var(--store-primary))` }}>
          <Link to={`/store/${slug}/products`}>تصفح المنتجات</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <StoreSEO title={`سلة التسوق - ${store.store_name}`} noindex />
      <h1 className="text-2xl font-bold mb-6">سلة التسوق ({items.length})</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-card border rounded-xl p-4 flex items-center gap-4">
              <div className="w-20 h-20 bg-muted/40 rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                <p className="text-sm text-muted-foreground">{item.price.toLocaleString()} {currency}</p>
                <div className="flex items-center gap-2 mt-2">
                  {item.type === 'accessory' ? (
                    <>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.id, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.id, 1)}><Plus className="w-3 h-3" /></Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">قطعة واحدة</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">{(item.price * item.quantity).toLocaleString()}</p>
                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-destructive h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-card border rounded-xl p-6 h-fit lg:sticky lg:top-20 space-y-3">
          <h2 className="font-bold text-lg mb-2">ملخص الطلب</h2>
          <Row label="المجموع الفرعي" value={`${subtotal.toLocaleString()} ${currency}`} />
          <Row label="الضريبة (15%)" value={`${tax.toLocaleString()} ${currency}`} />
          <Row label="الشحن" value={shipping === 0 ? 'مجاني' : `${shipping.toLocaleString()} ${currency}`} />
          <hr />
          <Row label="الإجمالي" value={`${total.toLocaleString()} ${currency}`} bold />
          <Button asChild size="lg" className="w-full text-white mt-3" style={{ background: `hsl(var(--store-primary))` }}>
            <Link to={`/store/${slug}/checkout`}>إتمام الطلب</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-bold text-base' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
