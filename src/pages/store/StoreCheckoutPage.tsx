import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, User, MapPin, Truck, CreditCard, Pencil, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useStoreCart } from '@/components/store/StoreCart';
import { StoreSEO } from '@/components/store/StoreSEO';
import { StorePaymentOptions, AppleMark } from '@/components/store/StorePaymentOptions';
import type { DesignExtras, StoreSettings } from '@/hooks/useOnlineStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { saveOrder } from '@/lib/storeOrdersHistory';
import { supabase } from '@/integrations/supabase/client';
import { isStorePaymentAvailable, payButtonLabel } from '@/lib/storePayments';
import {
  addressLine, addressProblem, loadCustomer, saveCustomer, orderAddress, shippingOptions, shippingCost,
  normaliseShortCode, EMPTY_ADDRESS, type CheckoutCustomer, type NationalAddress,
} from '@/lib/storeCheckout';
import { roundSar, VAT_RATE } from '@/lib/money';

// The map (and Leaflet) loads only when the customer opens the address form
const DeliveryMapPicker = lazy(() =>
  import('@/components/store/DeliveryMapPicker').then(m => ({ default: m.DeliveryMapPicker })));

interface Props {
  store: StoreSettings;
  designExtras?: DesignExtras | null;
  placeOrder: (data: any) => Promise<any>;
}

const phoneOk = (p: string) => p.replace(/\D/g, '').length >= 9;

export function StoreCheckoutPage({ store, designExtras, placeOrder }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, subtotal, clear } = useStoreCart();
  const [submitting, setSubmitting] = useState(false);

  // What this shopper entered here before — the store has no customer accounts
  const [customer, setCustomer] = useState<CheckoutCustomer>(() => loadCustomer(slug || ''));
  const [editingCustomer, setEditingCustomer] = useState(() => !(customer.name && customer.phone));
  const [draft, setDraft] = useState(customer);
  const [addressOpen, setAddressOpen] = useState(false);

  const options = useMemo(() => shippingOptions(store, designExtras?.carriers), [store, designExtras]);
  const [shippingId, setShippingId] = useState(options[0]?.id);
  const option = options.find(o => o.id === shippingId) ?? options[0];

  const [payment, setPayment] = useState<string>('cod');

  const currency = store.currency_symbol || 'ر.س';
  const shipping = shippingCost(option, subtotal, store);
  // Delivery is charged on website orders only, and VAT applies to it as well
  // the same sums placeOrder stores
  const tax = roundSar((subtotal + shipping) * VAT_RATE);
  const total = roundSar(subtotal + tax + shipping);
  const freeShipping = !!store.free_shipping_threshold && subtotal >= store.free_shipping_threshold;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">سلتك فارغة</h1>
        <Button asChild><Link to={`/store/${slug}/products`}>تصفح المنتجات</Link></Button>
      </div>
    );
  }

  const remember = (next: CheckoutCustomer) => {
    setCustomer(next);
    if (slug) saveCustomer(slug, next);
  };

  const confirmCustomer = () => {
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    if (!name) { toast.error('اكتب اسمك'); return; }
    if (!phoneOk(phone)) { toast.error('اكتب رقم جوال صحيح'); return; }
    remember({ ...customer, name, phone, email: draft.email.trim() });
    setEditingCustomer(false);
  };

  const saveAddress = (address: NationalAddress) => {
    remember({ ...customer, address: { ...address, shortCode: normaliseShortCode(address.shortCode) } });
    setAddressOpen(false);
    toast.success('تم حفظ عنوان التوصيل');
  };

  const submit = async () => {
    if (editingCustomer || !customer.name || !phoneOk(customer.phone)) { toast.error('أكمل بياناتك أولاً'); return; }
    if (!customer.address) { toast.error('أضف عنوان التوصيل'); setAddressOpen(true); return; }
    if (!isStorePaymentAvailable(payment)) { toast.error('اختر طريقة دفع متاحة'); return; }

    const carrierNote = option && option.id !== 'store'
      ? `${option.name}${option.days ? ` (${option.days})` : ''}`
      : undefined;
    const shippingAddress = orderAddress(customer.address, carrierNote);
    const { name, phone, email } = customer;

    setSubmitting(true);
    const orderItems = items.map((c) => ({
      device_id: c.deviceId, accessory_id: c.accessoryId,
      item_name: c.name, quantity: c.quantity, unit_price: c.price,
    }));
    const result = await placeOrder({
      customer_name: name, customer_phone: phone, customer_email: email || undefined,
      shipping_address: shippingAddress, shipping_city: customer.address.city, payment_method: payment,
      shipping_option: option?.id,
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
        shipping_address: shippingAddress,
        shipping_city: customer.address.city,
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
          toast.success(`حصلت على ${lr.points} نقطة ولاء!`);
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

  const money = (n: number) => `${n.toLocaleString()} ${currency}`;
  const address = customer.address;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      <StoreSEO title={`إتمام الطلب - ${store.store_name}`} noindex />
      <h1 className="text-2xl font-bold mb-5">إتمام الطلب</h1>

      <div className="bg-card border rounded-2xl divide-y overflow-hidden">
        {/* 1. The customer */}
        <Section icon={<User className="w-5 h-5" />} title="بياناتك"
          action={!editingCustomer && <EditButton label="تعديل بياناتك" onClick={() => { setDraft(customer); setEditingCustomer(true); }} />}>
          {editingCustomer ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>الاسم الكامل *</Label><Input className="mt-1.5" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="name" /></div>
              <div><Label>رقم الجوال *</Label><Input className="mt-1.5" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" inputMode="tel" autoComplete="tel" placeholder="05XXXXXXXX" /></div>
              <div className="sm:col-span-2"><Label>البريد الإلكتروني (اختياري)</Label><Input className="mt-1.5" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} dir="ltr" autoComplete="email" /></div>
              <div className="sm:col-span-2 flex justify-end">
                <Button onClick={confirmCustomer} className="text-white gap-1.5" style={{ background: 'hsl(var(--store-primary))' }}>
                  <Check className="w-4 h-4" /> حفظ
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-lg font-bold">حياك، {customer.name}!</p>
              <p className="text-sm text-muted-foreground mt-0.5 text-right" dir="ltr">{customer.phone}</p>
            </div>
          )}
        </Section>

        {/* 2. Where it goes */}
        <Section icon={<MapPin className="w-5 h-5" />} title="عنوان التوصيل"
          action={address && <EditButton label="تعديل العنوان" onClick={() => setAddressOpen(true)} />}>
          {address ? (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed">{addressLine(address)}</p>
              <div className="flex flex-wrap items-center gap-2">
                {address.shortCode && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                    style={{ borderColor: 'hsl(var(--store-primary) / 0.35)', background: 'hsl(var(--store-primary) / 0.06)' }}>
                    <span className="text-muted-foreground">العنوان المختصر</span>
                    <span className="font-mono font-bold tracking-wider" dir="ltr">{address.shortCode}</span>
                  </span>
                )}
                {address.location && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" /> محدد على الخريطة
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddressOpen(true)}
              className="w-full rounded-xl border-2 border-dashed p-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">
              <Plus className="w-4 h-4" /> إضافة عنوان التوصيل
            </button>
          )}
        </Section>

        {/* 3. Who carries it */}
        <Section icon={<Truck className="w-5 h-5" />} title="شركة الشحن">
          <div role="radiogroup" aria-label="شركة الشحن" className="space-y-2">
            {options.map(o => {
              const selected = o.id === option?.id;
              const cost = freeShipping ? 0 : o.cost;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={selected} onClick={() => setShippingId(o.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border-2 p-3.5 text-right transition-colors',
                    selected ? 'border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary)/0.06)]' : 'border-border hover:border-muted-foreground/40',
                  )}>
                  <Radio on={selected} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-sm">{o.name}</span>
                    {o.days && <span className="block text-xs text-muted-foreground mt-0.5">التوصيل خلال {o.days}</span>}
                  </span>
                  <span className={cn('text-sm font-bold shrink-0', cost === 0 && 'text-emerald-600')}>
                    {cost === 0 ? 'مجاني' : money(cost)}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* 4. How it is paid */}
        <Section icon={<CreditCard className="w-5 h-5" />} title="الدفع">
          <StorePaymentOptions value={payment} onChange={setPayment} />
        </Section>

        {/* 5. The total, and the button for the chosen method */}
        <div className="p-5 sm:p-6 bg-muted/20 space-y-4">
          <div className="space-y-1.5 text-sm">
            <Row label="المجموع الفرعي" value={money(subtotal)} />
            <Row label="الشحن" value={shipping === 0 ? 'مجاني' : money(shipping)} />
            <Row label="ضريبة القيمة المضافة (15%)" value={money(tax)} />
            <Row label="الإجمالي" value={money(total)} bold />
          </div>
          {payment === 'apple_pay' ? (
            <button type="button" onClick={submit} disabled={submitting}
              className="w-full h-12 rounded-xl bg-black text-white font-semibold flex items-center justify-center gap-1.5 hover:bg-black/85 transition-colors disabled:opacity-60">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>الدفع باستخدام <span className="inline-flex items-center gap-0.5" dir="ltr"><AppleMark className="w-4 h-4 -mt-0.5" />Pay</span></>
              )}
            </button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="w-full h-12 text-base font-semibold text-white" style={{ background: 'hsl(var(--store-primary))' }}>
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : payButtonLabel(payment)}
            </Button>
          )}
        </div>
      </div>

      <AddressDialog open={addressOpen} onOpenChange={setAddressOpen} initial={address} onSave={saveAddress} />
    </div>
  );
}

function Section({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2.5 text-base font-bold">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'hsl(var(--store-primary) / 0.1)', color: 'hsl(var(--store-primary))' }}>
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} aria-label={label} title={label} className="shrink-0">
      <Pencil className="w-4 h-4" />
    </Button>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
      on ? 'border-[hsl(var(--store-primary))]' : 'border-muted-foreground/40')}>
      {on && <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--store-primary))]" />}
    </span>
  );
}

function AddressDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: NationalAddress | null;
  onSave: (a: NationalAddress) => void;
}) {
  const [a, setA] = useState<NationalAddress>(initial ?? EMPTY_ADDRESS);
  const [error, setError] = useState('');
  const set = (k: keyof NationalAddress) => (e: React.ChangeEvent<HTMLInputElement>) => setA({ ...a, [k]: e.target.value });

  const change = (o: boolean) => {
    if (o) { setA(initial ?? EMPTY_ADDRESS); setError(''); }
    onOpenChange(o);
  };
  const save = () => {
    const problem = addressProblem(a);
    if (problem) { setError(problem); return; }
    onSave(a);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="pr-8">
          <DialogTitle>{initial ? 'تعديل عنوان التوصيل' : 'إضافة عنوان التوصيل'}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          اكتب بيانات عنوانك الوطني كما هي في تطبيق «سبل» أو موقع العنوان الوطني.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المدينة *"><Input value={a.city} onChange={set('city')} /></Field>
          <Field label="الحي *"><Input value={a.district} onChange={set('district')} /></Field>
          <Field label="اسم الشارع *" wide><Input value={a.street} onChange={set('street')} /></Field>
          <Field label="رقم المبنى"><Input value={a.building} onChange={set('building')} dir="ltr" inputMode="numeric" maxLength={4} placeholder="1234" /></Field>
          <Field label="الرقم الإضافي"><Input value={a.additional} onChange={set('additional')} dir="ltr" inputMode="numeric" maxLength={4} placeholder="5678" /></Field>
          <Field label="الرمز البريدي"><Input value={a.postal} onChange={set('postal')} dir="ltr" inputMode="numeric" maxLength={5} placeholder="12345" /></Field>
          <Field label="العنوان المختصر"><Input value={a.shortCode} onChange={set('shortCode')} dir="ltr" maxLength={9} placeholder="RRRD2929" className="font-mono uppercase" /></Field>
          <div className="col-span-2">
            <Label>الموقع على الخريطة</Label>
            <div className="mt-1.5">
              <Suspense fallback={<div className="h-64 rounded-xl border bg-muted/30 animate-pulse" />}>
                <DeliveryMapPicker value={a.location} onChange={(location) => setA(prev => ({ ...prev, location }))} />
              </Suspense>
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => change(false)}>إلغاء</Button>
          <Button onClick={save} className="text-white" style={{ background: 'hsl(var(--store-primary))' }}>حفظ العنوان</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <div className={wide ? 'col-span-2' : undefined}><Label>{label}</Label><div className="mt-1.5">{children}</div></div>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'font-bold text-base pt-2 border-t' : ''}`}><span className={bold ? '' : 'text-muted-foreground'}>{label}</span><span>{value}</span></div>;
}
