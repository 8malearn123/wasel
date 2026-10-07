import { useCallback, useEffect, useState } from 'react';
import { FileText, Megaphone, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { policyService, usingMock, isOk, type PolicyItem } from '@/services';
import {
  LoadingState, EmptyState, ErrorState, MockDataBanner,
} from '@/components/common/StateViews';

const TABS = [
  { key: 'modification', ar: 'التعديلات', en: 'Modifications', icon: FileText },
  { key: 'marketing',    ar: 'التسويق',   en: 'Marketing',     icon: Megaphone },
] as const;

type Kind = 'modification' | 'marketing';

const EMPTY = {
  name: '', description: '', durationLabel: '', price: '',
  isFree: false, isActive: true, notes: '',
};

export default function BusinessPolicyPage() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [activeTab, setActiveTab] = useTabParam('modification');
  const kind = (activeTab === 'marketing' ? 'marketing' : 'modification') as Kind;

  const [items, setItems] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await policyService.list(kind);
    if (!isOk(result)) { setError(result.error.message); setLoading(false); return; }
    setItems(result.data);
    setLoading(false);
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setCreating(true); };
  const openEdit = (item: PolicyItem) => {
    setForm({
      name: item.name,
      description: item.description ?? '',
      durationLabel: item.durationLabel ?? '',
      price: item.price !== null ? String(item.price) : '',
      isFree: item.isFree ?? false,
      isActive: item.isActive,
      notes: item.notes ?? '',
    });
    setEditing(item);
  };
  const close = () => { setCreating(false); setEditing(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      kind,
      name: form.name.trim(),
      description: form.description.trim() || null,
      // Empty stays null. There is no default duration and no default price —
      // those are the business's decisions, and an invented number here would
      // be worse than a blank.
      durationLabel: form.durationLabel.trim() || null,
      price: form.isFree ? null : (form.price.trim() === '' ? null : Number(form.price)),
      isFree: form.isFree,
      isActive: form.isActive,
      notes: form.notes.trim() || null,
    };
    const result = editing
      ? await policyService.update(editing.id, payload)
      : await policyService.create(payload);
    setSaving(false);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(editing ? (t ? 'تم الحفظ' : 'Saved') : (t ? 'تمت الإضافة' : 'Added'));
    close();
    load();
  };

  const remove = async (item: PolicyItem) => {
    const result = await policyService.remove(item.id);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(t ? 'تم الحذف' : 'Removed');
    load();
  };

  const priceLabel = (item: PolicyItem) => {
    if (item.isFree) return t ? 'مجاني' : 'Free';
    if (item.price === null) return t ? 'غير محدد' : 'Not set';
    return `${item.price.toLocaleString(t ? 'ar-SA' : 'en-US')} ${t ? 'ر.س' : 'SAR'}`;
  };

  return (
    <AppLayout
      title={t ? 'سياسة العمل' : 'Business policy'}
      subtitle={t ? 'التعديلات وخدمات التسويق' : 'Modifications and marketing services'}
    >
      {usingMock('policy') && <MockDataBanner what={t ? 'خدمة سياسة العمل' : 'the policy service'} />}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
          {TABS.map(tab => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={cn('px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <tab.icon className="w-3.5 h-3.5" />
              {t ? tab.ar : tab.en}
            </button>
          ))}
        </div>

        <Button onClick={openCreate} className="gap-2 ms-auto">
          <Plus className="w-4 h-4" />
          {kind === 'marketing' ? (t ? 'إضافة خدمة' : 'Add service') : (t ? 'إضافة تعديل' : 'Add modification')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value={activeTab} className="m-0">
          {loading ? <LoadingState />
            : error ? <ErrorState message={error} onRetry={load} />
            : items.length === 0 ? (
              <EmptyState
                icon={kind === 'marketing' ? Megaphone : FileText}
                title={kind === 'marketing'
                  ? (t ? 'لم تُضف خدمات تسويق بعد' : 'No marketing services yet')
                  : (t ? 'لم تُضف أنواع تعديلات بعد' : 'No modification types yet')}
                description={t
                  ? 'أضف البنود بأسعارها ومددها كما تحددها أنت. لا يضع النظام أي سعر أو مدة من عنده.'
                  : 'Add the items with the prices and durations you decide. The system never fills in a price or a duration of its own.'}
                action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />{t ? 'إضافة' : 'Add'}</Button>} />
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{kind === 'marketing' ? (t ? 'الخدمة' : 'Service') : (t ? 'نوع التعديل' : 'Modification')}</TableHead>
                      <TableHead className="text-center">{t ? 'المدة' : 'Duration'}</TableHead>
                      <TableHead className="text-center">{kind === 'marketing' ? (t ? 'السعر' : 'Price') : (t ? 'الرسوم' : 'Fee')}</TableHead>
                      <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="text-end">{t ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id} className={item.isActive ? '' : 'opacity-60'}>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.description && (
                              <span className="block text-xs text-muted-foreground">{item.description}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.durationLabel || <span className="text-muted-foreground">{t ? 'غير محدد' : 'Not set'}</span>}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{priceLabel(item)}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={item.isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>
                              {item.isActive ? (t ? 'مفعّل' : 'Active') : (t ? 'متوقف' : 'Inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => remove(item)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
        </TabsContent>
      </Tabs>

      <Dialog open={creating || !!editing} onOpenChange={open => !open && close()}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? (t ? 'تعديل البند' : 'Edit item')
                : kind === 'marketing' ? (t ? 'إضافة خدمة تسويق' : 'Add marketing service')
                : (t ? 'إضافة نوع تعديل' : 'Add modification type')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="policy-name">{t ? 'الاسم' : 'Name'} *</Label>
              <Input id="policy-name" value={form.name} required
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="policy-desc">{t ? 'الوصف' : 'Description'}</Label>
              <Textarea id="policy-desc" rows={2} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="policy-duration">{t ? 'المدة' : 'Duration'}</Label>
                <Input id="policy-duration" value={form.durationLabel}
                  onChange={e => setForm({ ...form, durationLabel: e.target.value })}
                  placeholder={t ? 'اكتب المدة كما تحددها' : 'Type the duration you set'} />
              </div>
              <div>
                <Label htmlFor="policy-price">
                  {kind === 'marketing' ? (t ? 'السعر' : 'Price') : (t ? 'الرسوم' : 'Fee')}
                </Label>
                <Input id="policy-price" type="number" min={0} step="0.01" dir="ltr"
                  value={form.price} disabled={form.isFree}
                  onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="policy-free" className="cursor-pointer">{t ? 'مجاني' : 'Free'}</Label>
              <Switch id="policy-free" checked={form.isFree}
                onCheckedChange={v => setForm({ ...form, isFree: v, price: v ? '' : form.price })} />
            </div>

            <div>
              <Label htmlFor="policy-notes">{t ? 'شروط أو ملاحظات' : 'Terms or notes'}</Label>
              <Textarea id="policy-notes" rows={2} value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="policy-active" className="cursor-pointer">{t ? 'مفعّل' : 'Active'}</Label>
              <Switch id="policy-active" checked={form.isActive}
                onCheckedChange={v => setForm({ ...form, isActive: v })} />
            </div>

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
