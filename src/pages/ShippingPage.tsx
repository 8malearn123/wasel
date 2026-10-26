import { useMemo, useState } from 'react';
import {
  Truck, PackageCheck, PackageOpen, CheckCircle2, Printer, ExternalLink, Loader2,
  MapPin, Phone, User, Wallet, Save, Info, BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/useTabParam';
import { useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LoadingState, EmptyState } from '@/components/common/StateViews';
import { useOnlineOrders, useStorePages, useStoreSettings, type OnlineOrder } from '@/hooks/useOnlineStore';
import { CARRIERS, orderShipment, type CarrierSetting } from '@/lib/shipping';
import { shipmentStage, shippingStats, collectOnDelivery, waybillHtml, type ShipmentStage } from '@/lib/shipments';
import { formatSar } from '@/lib/money';
import { storePaymentLabel } from '@/lib/storePayments';

/**
 * Shipping, from the store's own orders: what is waiting to go out, what is on
 * its way, what arrived; the carriers the store works with and their prices;
 * and the figures those orders add up to. Each order is shipped here with a
 * carrier and a tracking number, which gives the customer a link to the
 * carrier's own tracking page, and a waybill is printed for the parcel.
 *
 * Not here, said so on the page: creating waybills in a carrier's system and
 * reading statuses back from it — that needs an account and an API key from
 * each carrier, and none is connected.
 */

const TABS = [
  { key: 'shipments', ar: 'الشحنات', en: 'Shipments' },
  { key: 'carriers', ar: 'شركات الشحن', en: 'Carriers' },
  { key: 'insights', ar: 'تحليلات الشحن', en: 'Shipping insights' },
] as const;

const STAGES: { key: Exclude<ShipmentStage, 'closed'>; ar: string; en: string; cls: string }[] = [
  { key: 'to_ship', ar: 'بانتظار الشحن', en: 'To ship', cls: 'bg-warning/10 text-warning border-warning/20' },
  { key: 'shipped', ar: 'في الطريق', en: 'On the way', cls: 'bg-primary/10 text-primary border-primary/20' },
  { key: 'delivered', ar: 'تم التسليم', en: 'Delivered', cls: 'bg-success/10 text-success border-success/20' },
];

export default function ShippingPage() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [activeTab, setActiveTab] = useTabParam('shipments');
  const { orders, loading, updateOrderStatus, updateTracking, getOrderItems } = useOnlineOrders();
  const { settings } = useStoreSettings();
  const { designExtras, saveDesignExtras, loading: pagesLoading } = useStorePages();

  const carrierSettings = designExtras?.carriers ?? [];
  const stats = useMemo(() => shippingStats(orders), [orders]);
  const cur = t ? 'ر.س' : 'SAR';

  return (
    <AppLayout
      title={t ? 'الشحن' : 'Shipping'}
      subtitle={t ? 'شحن طلبات المتجر الإلكتروني وتتبّعها' : 'Ship and track online store orders'}
    >
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border mb-5">
        {TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className={cn('px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {t ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="shipments" className="m-0 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={PackageOpen} tone="text-warning bg-warning/10" label={t ? 'بانتظار الشحن' : 'To ship'} value={String(stats.toShip)} />
            <Kpi icon={Truck} tone="text-primary bg-primary/10" label={t ? 'في الطريق' : 'On the way'} value={String(stats.shipped)} />
            <Kpi icon={PackageCheck} tone="text-success bg-success/10" label={t ? 'تم التسليم' : 'Delivered'} value={String(stats.delivered)} />
            <Kpi icon={Wallet} tone="text-primary bg-primary/10" label={t ? 'تحصيل مع المندوب' : 'Cash with couriers'} value={`${formatSar(stats.codInTransit)} ${cur}`} />
          </div>
          <Shipments
            orders={orders as OnlineOrder[]}
            loading={loading}
            carrierSettings={carrierSettings}
            sender={{ name: settings?.store_name || (t ? 'المتجر' : 'Store'), phone: settings?.whatsapp_number }}
            onShip={updateTracking}
            onDelivered={id => updateOrderStatus(id, 'delivered')}
            getOrderItems={getOrderItems}
          />
        </TabsContent>

        <TabsContent value="carriers" className="m-0">
          {pagesLoading ? <LoadingState /> : (
            <Carriers
              initial={carrierSettings}
              onSave={carriers => saveDesignExtras({ gallery: [], ...designExtras, carriers }, t ? 'تم حفظ شركات الشحن' : 'Carriers saved')}
            />
          )}
        </TabsContent>

        <TabsContent value="insights" className="m-0">
          {loading ? <LoadingState /> : <Insights stats={stats} />}
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          {t
            ? 'تُشحن الطلبات هنا يدويًا: تختار الشركة وتكتب رقم الشحنة من بوليصتها، فيصل العميل رابط التتبع لدى الشركة نفسها. الربط الآلي (إصدار البوليصة لدى الشركة وتحديث الحالة تلقائيًا) يحتاج حسابًا ومفتاح API من كل شركة، وغير مفعّل حاليًا.'
            : 'Orders are shipped here by hand: pick the carrier and enter the waybill number, and the customer gets the carrier\'s own tracking link. Automatic links (waybills issued by the carrier, statuses updated by it) need an account and an API key from each carrier and are not connected.'}
        </p>
      </div>
    </AppLayout>
  );
}

function Kpi({ icon: Icon, tone, label, value }: { icon: typeof Truck; tone: string; label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', tone)}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap">{value}</p>
      </div>
    </div>
  );
}

function Shipments({
  orders, loading, carrierSettings, sender, onShip, onDelivered, getOrderItems,
}: {
  orders: OnlineOrder[];
  loading: boolean;
  carrierSettings: CarrierSetting[];
  sender: { name: string; phone?: string | null };
  onShip: (orderId: string, carrierId: string, trackingNumber: string) => Promise<void>;
  onDelivered: (orderId: string) => Promise<void>;
  getOrderItems: (orderId: string) => Promise<{ quantity: number }[]>;
}) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [stage, setStage] = useState<Exclude<ShipmentStage, 'closed'>>('to_ship');
  const [shipping, setShipping] = useState<OnlineOrder | null>(null);
  const [carrierId, setCarrierId] = useState('');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // the store's carriers first, then the rest
  const enabled = new Set(carrierSettings.filter(c => c.enabled).map(c => c.id));
  const carrierList = [...CARRIERS].sort((a, b) => Number(enabled.has(b.id)) - Number(enabled.has(a.id)));
  const chosen = CARRIERS.find(c => c.id === carrierId);
  const numberRequired = !!chosen?.track;

  const list = orders.filter(o => shipmentStage(o) === stage);
  const cur = t ? 'ر.س' : 'SAR';

  const openShip = (o: OnlineOrder) => {
    const s = orderShipment(o);
    setShipping(o);
    // the carrier the customer chose at checkout, else the store's first one
    setCarrierId(s.carrier?.id ?? carrierList[0].id);
    setNumber(s.number ?? '');
  };

  const confirmShip = async () => {
    if (!shipping || !carrierId || (numberRequired && !number.trim())) return;
    setBusy(shipping.id);
    await onShip(shipping.id, carrierId, number.trim());
    setBusy(null);
    setShipping(null);
  };

  const delivered = async (o: OnlineOrder) => { setBusy(o.id); await onDelivered(o.id); setBusy(null); };

  const printWaybill = async (o: OnlineOrder) => {
    const w = window.open('', '_blank', 'width=480,height=720');
    if (!w) { toast.error(t ? 'اسمح بالنوافذ المنبثقة لطباعة البوليصة' : 'Allow pop-ups to print the waybill'); return; }
    const items = await getOrderItems(o.id);
    const pieces = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try { JsBarcode(svg, o.order_number, { format: 'CODE128', height: 50, displayValue: false, margin: 0 }); } catch { /* no barcode */ }
    w.document.write(waybillHtml(o, sender, pieces, svg.outerHTML));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {STAGES.map(s => (
          <button key={s.key} type="button" onClick={() => setStage(s.key)} aria-pressed={stage === s.key}
            className={cn('px-3 py-1.5 rounded-full border text-sm transition-colors',
              stage === s.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground')}>
            {t ? s.ar : s.en} <span className="ms-1 tabular-nums opacity-80">{orders.filter(o => shipmentStage(o) === s.key).length}</span>
          </button>
        ))}
      </div>

      {loading ? <LoadingState /> : list.length === 0 ? (
        <EmptyState icon={Truck}
          title={stage === 'to_ship' ? (t ? 'لا توجد طلبات بانتظار الشحن' : 'Nothing waiting to ship') : stage === 'shipped' ? (t ? 'لا توجد شحنات في الطريق' : 'Nothing on the way') : (t ? 'لا توجد شحنات مُسلّمة بعد' : 'No deliveries yet')}
          description={t ? 'تظهر هنا طلبات المتجر الإلكتروني حسب حالة شحنها.' : 'Online store orders appear here by shipping status.'}
          action={<Button asChild variant="outline"><Link to="/sales?tab=orders">{t ? 'طلبات المتجر' : 'Store orders'}</Link></Button>} />
      ) : (
        <div className="space-y-2">
          {list.map(o => {
            const s = orderShipment(o);
            const cod = collectOnDelivery(o);
            const st = STAGES.find(x => x.key === shipmentStage(o));
            return (
              <div key={o.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground whitespace-nowrap tabular-nums" dir="ltr">{o.order_number}</span>
                      {st && <Badge variant="outline" className={st.cls}>{t ? st.ar : st.en}</Badge>}
                      {o.status === 'pending' && <Badge variant="outline">{t ? 'لم يُؤكَّد بعد' : 'Not confirmed yet'}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{o.customer_name}</span>
                      <span className="flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" />{o.customer_phone}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{o.shipping_city}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{o.shipping_address}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                      <span className="inline-flex items-center gap-1 text-foreground"><Truck className="w-3 h-3" />{s.carrier?.name ?? (t ? 'لم تُحدَّد شركة' : 'No carrier yet')}</span>
                      {s.number && <span className="font-mono text-foreground" dir="ltr">{s.number}</span>}
                      {s.url && <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">{t ? 'تتبع لدى الشركة' : 'Track'}<ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  </div>
                  <div className="text-end shrink-0 space-y-1">
                    <p className="text-xs text-muted-foreground">{t ? 'رسوم الشحن' : 'Shipping'}: <span className="text-foreground font-medium">{formatSar(o.shipping_cost)} {cur}</span></p>
                    {cod > 0
                      ? <p className="text-xs font-semibold text-warning">{t ? 'تحصيل عند الاستلام' : 'Collect on delivery'}: {formatSar(cod)} {cur}</p>
                      : o.payment_status === 'paid'
                        ? <p className="text-xs text-success">{t ? 'مدفوع' : 'Paid'}</p>
                        : <p className="text-xs font-semibold text-destructive">{t ? `غير مدفوع · ${storePaymentLabel(o.payment_method)}` : 'Not paid yet'}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  {shipmentStage(o) === 'to_ship' && (
                    <Button size="sm" onClick={() => openShip(o)} disabled={busy === o.id}><Truck className="w-4 h-4 me-1" />{t ? 'شحن الطلب' : 'Ship'}</Button>
                  )}
                  {shipmentStage(o) === 'shipped' && (
                    <>
                      <Button size="sm" onClick={() => delivered(o)} disabled={busy === o.id}>
                        {busy === o.id ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 me-1" />}{t ? 'تم التسليم' : 'Delivered'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openShip(o)}>{t ? 'تعديل الشحنة' : 'Edit shipment'}</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => printWaybill(o)}><Printer className="w-4 h-4 me-1" />{t ? 'طباعة البوليصة' : 'Print waybill'}</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!shipping} onOpenChange={open => !open && setShipping(null)}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t ? 'شحن الطلب' : 'Ship order'} <span dir="ltr" className="tabular-nums">{shipping?.order_number}</span></DialogTitle>
            <DialogDescription>{t ? 'اختر شركة الشحن واكتب رقم الشحنة من البوليصة. يصل العميل رابط التتبع لدى الشركة.' : 'Pick the carrier and enter the waybill number. The customer gets the carrier\'s tracking link.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t ? 'شركة الشحن' : 'Carrier'}</Label>
              <Select value={carrierId} onValueChange={setCarrierId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {carrierList.map(c => (
                    <SelectItem key={c.id} value={c.id}>{t ? c.name : c.nameEn}{enabled.has(c.id) ? (t ? ' · مفعّلة في متجرك' : ' · enabled') : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t ? 'رقم الشحنة' : 'Tracking number'}{numberRequired ? ' *' : (t ? ' (اختياري)' : ' (optional)')}</Label>
              <Input value={number} onChange={e => setNumber(e.target.value)} dir="ltr" className="mt-1 font-mono" placeholder={numberRequired ? '1234567890' : ''} />
              {!numberRequired && chosen && <p className="text-xs text-muted-foreground mt-1">{t ? 'هذه الشركة بلا صفحة تتبع على الإنترنت؛ رقم الشحنة اختياري.' : 'This carrier has no online tracking; the number is optional.'}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShipping(null)}>{t ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={confirmShip} disabled={!carrierId || (numberRequired && !number.trim()) || busy === shipping?.id}>
              {busy === shipping?.id ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Truck className="w-4 h-4 me-1" />}{t ? 'تأكيد الشحن' : 'Confirm shipment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Carriers({ initial, onSave }: { initial: CarrierSetting[]; onSave: (carriers: CarrierSetting[]) => Promise<void> }) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [list, setList] = useState<CarrierSetting[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const upd = (id: string, patch: Partial<CarrierSetting>) => {
    setList(prev => {
      const next = [...prev];
      const i = next.findIndex(x => x.id === id);
      if (i >= 0) next[i] = { ...next[i], ...patch };
      else next.push({ id, enabled: false, ...patch });
      return next;
    });
    setDirty(true);
  };

  const save = async () => { setSaving(true); await onSave(list); setSaving(false); setDirty(false); };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t ? 'الشركات المفعّلة تظهر لعميلك عند الدفع بسعرها ومدة توصيلها، وتظهر أولًا عند شحن الطلبات.' : 'Enabled carriers are offered at checkout with their price and delivery time, and listed first when shipping.'}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {CARRIERS.map(c => {
          const cfg = list.find(x => x.id === c.id);
          const on = !!cfg?.enabled;
          return (
            <div key={c.id} className={cn('rounded-xl border p-3 bg-card transition-colors', on && 'border-primary/40 bg-primary/5')}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{t ? c.name : c.nameEn}</p>
                  <p className="text-[11px] text-muted-foreground">{c.track ? (t ? 'تتبع إلكتروني لدى الشركة' : 'Online tracking') : (t ? 'بلا تتبع إلكتروني' : 'No online tracking')}</p>
                </div>
                <Switch checked={on} onCheckedChange={v => upd(c.id, { enabled: v })} aria-label={c.name} />
              </div>
              {on && (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                  <div>
                    <Label className="text-[11px]">{t ? 'التكلفة (ر.س)' : 'Price (SAR)'}</Label>
                    <Input type="number" min={0} value={cfg?.cost ?? ''} onChange={e => upd(c.id, { cost: Number(e.target.value) || 0 })} className="mt-1 h-8 text-xs" placeholder="25" />
                  </div>
                  <div>
                    <Label className="text-[11px]">{t ? 'مدة التوصيل' : 'Delivery time'}</Label>
                    <Input value={cfg?.days || ''} onChange={e => upd(c.id, { days: e.target.value })} className="mt-1 h-8 text-xs" placeholder={t ? '١-٣ أيام' : '1–3 days'} />
                  </div>
                  <div>
                    <Label className="text-[11px]">{t ? 'رقم الحساب' : 'Account no.'}</Label>
                    <Input value={cfg?.account || ''} onChange={e => upd(c.id, { account: e.target.value })} className="mt-1 h-8 text-xs font-mono" dir="ltr" placeholder={t ? 'اختياري' : 'optional'} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}{t ? 'حفظ شركات الشحن' : 'Save carriers'}
        </Button>
      </div>
    </div>
  );
}

function Insights({ stats }: { stats: ReturnType<typeof shippingStats> }) {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const cur = t ? 'ر.س' : 'SAR';
  const went = stats.shipped + stats.delivered;
  if (went === 0) {
    return <EmptyState icon={BarChart3} title={t ? 'لا توجد شحنات بعد' : 'No shipments yet'}
      description={t ? 'تظهر التحليلات بعد شحن أول طلب.' : 'Insights appear once the first order is shipped.'} />;
  }
  const max = Math.max(...stats.byCarrier.map(c => c.count), 1);
  const maxCity = Math.max(...stats.byCity.map(c => c.count), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Truck} tone="text-primary bg-primary/10" label={t ? 'شحنات خرجت' : 'Shipped in total'} value={String(went)} />
        <Kpi icon={PackageCheck} tone="text-success bg-success/10" label={t ? 'نسبة التسليم' : 'Delivered rate'} value={`${stats.deliveredRate}%`} />
        <Kpi icon={Wallet} tone="text-primary bg-primary/10" label={t ? 'رسوم شحن محصّلة' : 'Shipping fees'} value={`${formatSar(stats.fees)} ${cur}`} />
        <Kpi icon={Wallet} tone="text-warning bg-warning/10" label={t ? 'متوسط رسوم الشحنة' : 'Average fee'} value={`${formatSar(stats.fees / went)} ${cur}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Bars title={t ? 'الشحنات حسب الشركة' : 'By carrier'} rows={stats.byCarrier.map(c => ({ label: c.name, value: c.count }))} max={max} />
        <Bars title={t ? 'أكثر المدن شحنًا' : 'Top cities'} rows={stats.byCity.map(c => ({ label: c.city, value: c.count }))} max={maxCity} />
      </div>
    </div>
  );
}

function Bars({ title, rows, max }: { title: string; rows: { label: string; value: number }[]; max: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="font-semibold text-foreground mb-3">{title}</p>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <span className="w-28 truncate text-muted-foreground">{r.label}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} /></div>
            <span className="w-8 text-end tabular-nums font-medium">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
