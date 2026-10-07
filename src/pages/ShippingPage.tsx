import { useCallback, useEffect, useState } from 'react';
import {
  Truck, Plus, Pencil, Wifi, WifiOff, AlertCircle, Settings2, RefreshCw,
  Loader2, Sparkles, PackageSearch,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/useTabParam';
import { useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  shippingService, aiService, usingMock, isOk,
  type ShippingCarrier, type CarrierConnectionStatus, type AiInsight,
} from '@/services';
import {
  LoadingState, EmptyState, ErrorState, UnavailableState, MockDataBanner,
} from '@/components/common/StateViews';

const CONNECTION: Record<CarrierConnectionStatus, { ar: string; en: string; cls: string; icon: typeof Wifi }> = {
  connected:      { ar: 'متصل',          en: 'Connected',      cls: 'bg-success/15 text-success', icon: Wifi },
  disconnected:   { ar: 'غير متصل',      en: 'Disconnected',   cls: 'bg-muted text-muted-foreground', icon: WifiOff },
  error:          { ar: 'خطأ في الاتصال', en: 'Connection error', cls: 'bg-destructive/15 text-destructive', icon: AlertCircle },
  not_configured: { ar: 'لم يُهيّأ',      en: 'Not configured', cls: 'bg-warning/15 text-warning', icon: Settings2 },
};

const TABS = [
  { key: 'carriers', ar: 'شركات الشحن', en: 'Carriers' },
  { key: 'api', ar: 'إعدادات الاتصال', en: 'API settings' },
  { key: 'ai', ar: 'تحليلات الشحن', en: 'Shipping insights' },
] as const;

const EMPTY_FORM = { name: '', serviceType: '', logoUrl: '', isActive: true };

export default function ShippingPage() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [activeTab, setActiveTab] = useTabParam('carriers');

  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ShippingCarrier | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await shippingService.listCarriers();
    if (!isOk(result)) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setCarriers(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setCreating(true); };
  const openEdit = (carrier: ShippingCarrier) => {
    setForm({
      name: carrier.name,
      serviceType: carrier.serviceType ?? '',
      logoUrl: carrier.logoUrl ?? '',
      isActive: carrier.isActive,
    });
    setEditing(carrier);
  };
  const close = () => { setCreating(false); setEditing(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      serviceType: form.serviceType.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      isActive: form.isActive,
    };
    const result = editing
      ? await shippingService.updateCarrier(editing.id, payload)
      : await shippingService.createCarrier(payload);
    setSaving(false);

    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(editing ? (t ? 'تم حفظ التعديلات' : 'Saved') : (t ? 'تمت إضافة الشركة' : 'Carrier added'));
    close();
    load();
  };

  const toggleActive = async (carrier: ShippingCarrier) => {
    const result = await shippingService.setCarrierActive(carrier.id, !carrier.isActive);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    load();
  };

  const test = async (carrier: ShippingCarrier) => {
    setTesting(carrier.id);
    const result = await shippingService.testConnection(carrier.id);
    setTesting(null);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(result.data.message);
    load();
  };

  return (
    <AppLayout
      title={t ? 'الشحن' : 'Shipping'}
      subtitle={t ? 'شركات الشحن وإعدادات الاتصال' : 'Carriers and their connections'}
    >
      {usingMock('shipping') && <MockDataBanner what={t ? 'خدمة الشحن' : 'the shipping service'} />}

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
        <TabsContent value="carriers" className="m-0 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />{t ? 'إضافة شركة' : 'Add carrier'}
            </Button>
          </div>

          {loading ? <LoadingState />
            : error ? <ErrorState message={error} onRetry={load} />
            : carriers.length === 0 ? (
              <EmptyState icon={Truck}
                title={t ? 'لم تُضف أي شركة شحن' : 'No carriers yet'}
                description={t
                  ? 'أضف شركة لتظهر هنا. بيانات الاتصال بالشركة يحفظها الخادم، ولا تُدخل من هذه الشاشة.'
                  : 'Add one to see it here. Its credentials are stored by the backend, not entered on this screen.'}
                action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />{t ? 'إضافة شركة' : 'Add carrier'}</Button>} />
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t ? 'الشركة' : 'Carrier'}</TableHead>
                      <TableHead className="text-center">{t ? 'نوع الخدمة' : 'Service'}</TableHead>
                      <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="text-center">{t ? 'الاتصال' : 'Connection'}</TableHead>
                      <TableHead className="text-center">{t ? 'الشحنات' : 'Shipments'}</TableHead>
                      <TableHead className="text-center">{t ? 'أُضيفت في' : 'Added'}</TableHead>
                      <TableHead className="text-end">{t ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {carriers.map(carrier => {
                        const conn = CONNECTION[carrier.connectionStatus];
                        const ConnIcon = conn.icon;
                        return (
                          <TableRow key={carrier.id} className={carrier.isActive ? '' : 'opacity-60'}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {carrier.logoUrl
                                  ? <img src={carrier.logoUrl} alt="" className="w-8 h-8 rounded object-contain bg-muted/30" />
                                  : <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                                      <Truck className="w-4 h-4 text-primary" />
                                    </div>}
                                {carrier.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{carrier.serviceType || '—'}</TableCell>
                            <TableCell className="text-center">
                              <Switch checked={carrier.isActive} onCheckedChange={() => toggleActive(carrier)} />
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn(conn.cls, 'gap-1')}>
                                <ConnIcon className="w-3 h-3" />{t ? conn.ar : conn.en}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {/* dash, not 0 — the backend has not reported a count */}
                              {carrier.shipmentCount ?? '—'}
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {new Date(carrier.createdAt).toLocaleDateString(t ? 'ar-SA' : 'en-GB')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => test(carrier)} disabled={testing === carrier.id}
                                  title={t ? 'اختبار الاتصال' : 'Test connection'}>
                                  {testing === carrier.id
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <RefreshCw className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(carrier)} title={t ? 'تعديل' : 'Edit'}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
        </TabsContent>

        <TabsContent value="api" className="m-0">
          <ApiSettings carriers={carriers} loading={loading} onTest={test} testing={testing} />
        </TabsContent>

        <TabsContent value="ai" className="m-0">
          <ShippingInsights />
        </TabsContent>
      </Tabs>

      <Dialog open={creating || !!editing} onOpenChange={open => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? (t ? 'تعديل شركة شحن' : 'Edit carrier') : (t ? 'إضافة شركة شحن' : 'Add carrier')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="carrier-name">{t ? 'اسم الشركة' : 'Carrier name'} *</Label>
              <Input id="carrier-name" value={form.name} required
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="carrier-service">{t ? 'نوع الخدمة' : 'Service type'}</Label>
              <Input id="carrier-service" value={form.serviceType}
                onChange={e => setForm({ ...form, serviceType: e.target.value })}
                placeholder={t ? 'سريع، عادي، نفس اليوم…' : 'Express, standard, same-day…'} />
            </div>
            <div>
              <Label htmlFor="carrier-logo">{t ? 'رابط الشعار' : 'Logo URL'}</Label>
              <Input id="carrier-logo" dir="ltr" value={form.logoUrl}
                onChange={e => setForm({ ...form, logoUrl: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="carrier-active" className="cursor-pointer">{t ? 'مفعّلة' : 'Active'}</Label>
              <Switch id="carrier-active" checked={form.isActive}
                onCheckedChange={v => setForm({ ...form, isActive: v })} />
            </div>

            {/* Said plainly so nobody looks for a key field that is not here. */}
            <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 border border-border">
              {t
                ? 'مفاتيح الاتصال بشركة الشحن تُحفظ في الخادم ولا تُدخل من المتصفح، حمايةً لها.'
                : 'Carrier API keys are stored on the server and are never entered in the browser.'}
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>{t ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                {editing ? (t ? 'حفظ' : 'Save') : (t ? 'إضافة' : 'Add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function ApiSettings({
  carriers, loading, onTest, testing,
}: {
  carriers: ShippingCarrier[];
  loading: boolean;
  onTest: (carrier: ShippingCarrier) => void;
  testing: string | null;
}) {
  const { isRTL } = useLanguage();
  const t = isRTL;

  if (loading) return <LoadingState />;
  if (carriers.length === 0) {
    return <EmptyState icon={Settings2}
      title={t ? 'لا توجد شركات لعرض إعدادات اتصالها' : 'No carriers to configure'}
      description={t ? 'أضف شركة شحن أولاً من تبويب «شركات الشحن».' : 'Add a carrier first.'} />;
  }

  return (
    <div className="space-y-3">
      {carriers.map(carrier => {
        const conn = CONNECTION[carrier.connectionStatus];
        const ConnIcon = conn.icon;
        return (
          <div key={carrier.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{carrier.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t ? 'آخر مزامنة: ' : 'Last sync: '}
                  {carrier.lastSyncAt
                    ? new Date(carrier.lastSyncAt).toLocaleString(t ? 'ar-SA' : 'en-GB')
                    : (t ? 'لم تتم بعد' : 'never')}
                </p>
              </div>
              <Badge className={cn(conn.cls, 'gap-1 ms-auto')}>
                <ConnIcon className="w-3 h-3" />{t ? conn.ar : conn.en}
              </Badge>
              <Button variant="outline" size="sm" className="gap-2"
                onClick={() => onTest(carrier)} disabled={testing === carrier.id}>
                {testing === carrier.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t ? 'اختبار الاتصال' : 'Test connection'}
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
              <Field label={t ? 'بيانات الاتصال' : 'Credentials'}
                value={carrier.credentialsSet
                  ? (t ? 'محفوظة في الخادم' : 'Stored on the server')
                  : (t ? 'لم تُحفظ بعد' : 'Not set yet')} />
              <Field label={t ? 'عدد الشحنات' : 'Shipments'} value={carrier.shipmentCount?.toString() ?? '—'} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ShippingInsights() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [status, list] = await Promise.all([
        aiService.getStatus(),
        aiService.listInsights('shipping'),
      ]);
      if (cancelled) return;
      if (isOk(status)) setConfigured(status.data.configured);
      if (isOk(list)) setInsights(list.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState />;

  if (!configured) {
    return (
      <UnavailableState
        title={t ? 'لا توجد بيانات كافية للتحليل حالياً' : 'Not enough data to analyse yet'}
        message={t
          ? 'تحليلات الشحن تحتاج شركة شحن مربوطة وشحنات فعلية. الواجهة جاهزة لعرض النتائج فور توفرها من الخادم.'
          : 'Shipping insights need a connected carrier and real shipments. This screen is ready to show them once the backend has them.'}
      />
    );
  }

  if (insights.length === 0) {
    return <EmptyState icon={PackageSearch}
      title={t ? 'لا توجد ملاحظات حالياً' : 'No insights right now'} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.map(insight => (
        <div key={insight.id} className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{insight.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{insight.body}</p>
              {insight.basis && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t ? 'المصدر: ' : 'Based on: '}{insight.basis}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
