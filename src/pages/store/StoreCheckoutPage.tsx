import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useStoreCart } from '@/components/store/StoreCart';
import { StoreSEO } from '@/components/store/StoreSEO';
import type { StoreSettings } from '@/hooks/useOnlineStore';
import { toast } from 'sonner';
import { saveOrder } from '@/lib/storeOrdersHistory';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  store: StoreSettings;
  placeOrder: (data: any) => Promise<any>;
}

export function StoreCheckoutPage({ store, placeOrder }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, subtotal, clear } = useStoreCart();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [payment, setPayment] = useState('bank_transfer');

  const currency = store.currency_symbol || 'ر.س';
  const shipping = store.free_shipping_threshold && subtotal >= store.free_shipping_threshold ? 0 : Number(store.shipping_cost || 0);
  const tax = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + tax + shipping;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">سلتك فارغة</h1>
        <Button asChild><Link to={`/store/${slug}/products`}>تصفح المنتجات</Link></Button>
      </div>
    );
  }

  const next = () => {
    if (step === 1 && (!name.trim() || !phone.trim())) { toast.error('عبّئ الاسم ورقم الجوال'); return; }
    if (step === 2 && (!address.trim() || !city.trim())) { toast.error('عبّئ العنوان والمدينة'); return; }
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = async () => {
    setSubmitting(true);
    const orderItems = items.map((c) => ({
      device_id: c.deviceId, accessory_id: c.accessoryId,
      item_name: c.name, quantity: c.quantity, unit_price: c.price,
    }));
    const result = await placeOrder({
      customer_name: name, customer_phone: phone, customer_email: email || undefined,
      shipping_address: address, shipping_city: city, payment_method: payment,
      items: orderItems,
    });
    setSubmitting(false);
    if (result?.orderNumber) {
      const orderSnapshot = {
        order_number: result.orderNumber,
        created_at: new Date().toISOString(),
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        shipping_address: address,
        shipping_city: city,
        payment_method: payment,
        payment_status: 'unpaid',
        status: 'pending',
        subtotal,
        tax_amount: tax,
        shipping_cost: shipping,
        total_amount: total,
        items: orderItems.map((i, idx) => ({ id: String(idx), item_name: i.item_name, quantity: i.quantity, unit_price: i.unit_price })),
      };
      clear();
      if (slug) saveOrder(slug, orderSnapshot as any);

      // Award loyalty points (server checks plan + store opt-in)
      let loyaltyAwarded: { points: number; total_points: number; tier: string } | null = null;
      try {
        const { data: lr } = await supabase.functions.invoke('award-loyalty', {
          body: {
            merchant_id: store.merchant_id,
            order_number: result.orderNumber,
            customer_name: name,
            customer_phone: phone,
            customer_email: email || null,
          },
        });
        if (lr?.awarded) {
          loyaltyAwarded = { points: lr.points, total_points: lr.total_points, tier: lr.tier };
          toast.success(`حصلت على ${lr.points} نقطة ولاء! 🎉`);
        }
      } catch {
        /* loyalty is optional */
      }

      navigate(`/store/${slug}/thank-you/${result.orderNumber}`, {
        state: { order: orderSnapshot, loyalty: loyaltyAwarded },
      });
    } else {
      toast.error('فشل إرسال الطلب، حاول مرة أخرى');
    }
  };

  const steps = ['البيانات', 'الشحن', 'الدفع', 'مراجعة'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <StoreSEO title={`إتمام الطلب - ${store.store_name}`} noindex />
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => {
          const idx = i + 1;
          const active = step === idx;
          const done = step > idx;
          return (
            <div key={s} className="flex-1 flex items-center">
              <div className={`flex items-center gap-2 ${active ? 'font-bold' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${done || active ? 'text-white' : 'bg-muted text-muted-foreground'}`} style={done || active ? { background: `hsl(var(--store-primary))` } : {}}>
                  {done ? <Check className="w-4 h-4" /> : idx}
                </div>
                <span className="text-sm hidden md:inline">{s}</span>
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-border mx-2" />}
            </div>
          );
        })}
      </div>

      <div className="bg-card border rounded-xl p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-2">بياناتك</h2>
            <div><Label>الاسم الكامل *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>رقم الجوال *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></div>
            <div><Label>البريد الإلكتروني (اختياري)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-2">عنوان الشحن</h2>
            <div><Label>المدينة *</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><Label>العنوان التفصيلي *</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} /></div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-2">طريقة الدفع</h2>
            <RadioGroup value={payment} onValueChange={setPayment}>
              <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value="bank_transfer" /> <span className="font-medium">تحويل بنكي</span>
              </label>
              <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value="cod" /> <span className="font-medium">الدفع عند الاستلام</span>
              </label>
            </RadioGroup>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold mb-2">مراجعة الطلب</h2>
            <div className="text-sm space-y-1">
              <p><b>الاسم:</b> {name}</p>
              <p><b>الجوال:</b> {phone}</p>
              <p><b>العنوان:</b> {address}, {city}</p>
              <p><b>الدفع:</b> {payment === 'bank_transfer' ? 'تحويل بنكي' : 'الدفع عند الاستلام'}</p>
            </div>
            <hr />
            <div className="space-y-1 text-sm">
              <Row label="المجموع الفرعي" value={`${subtotal.toLocaleString()} ${currency}`} />
              <Row label="الضريبة" value={`${tax.toLocaleString()} ${currency}`} />
              <Row label="الشحن" value={shipping === 0 ? 'مجاني' : `${shipping.toLocaleString()} ${currency}`} />
              <Row label="الإجمالي" value={`${total.toLocaleString()} ${currency}`} bold />
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>السابق</Button>
          {step < 4 ? (
            <Button onClick={next} className="text-white" style={{ background: `hsl(var(--store-primary))` }}>
              التالي <ArrowRight className="w-4 h-4 mr-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="text-white" style={{ background: `hsl(var(--store-primary))` }}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الطلب'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'font-bold text-base pt-2 border-t' : ''}`}><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
