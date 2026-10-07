import { useCallback, useEffect, useState } from 'react';
import {
  HardDrive, Plus, Pencil, Trash2, Wifi, WifiOff, AlertCircle, CircleDashed,
  RefreshCw, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  deviceService, usingMock, isOk,
  type ConnectedDevice, type DeviceConnectionStatus,
} from '@/services';
import {
  LoadingState, EmptyState, ErrorState, MockDataBanner,
} from '@/components/common/StateViews';

const STATUS: Record<DeviceConnectionStatus, { ar: string; en: string; cls: string; icon: typeof Wifi }> = {
  connected:       { ar: 'متصل',        en: 'Connected',    cls: 'bg-success/15 text-success',        icon: Wifi },
  disconnected:    { ar: 'غير متصل',    en: 'Disconnected', cls: 'bg-muted text-muted-foreground',    icon: WifiOff },
  error:           { ar: 'خطأ',         en: 'Error',        cls: 'bg-destructive/15 text-destructive', icon: AlertCircle },
  never_connected: { ar: 'لم يتصل بعد', en: 'Never connected', cls: 'bg-warning/15 text-warning',     icon: CircleDashed },
};

const EMPTY_FORM = { name: '', kind: '', model: '' };

export default function DevicesSection() {
  const { isRTL } = useLanguage();
  const t = isRTL;

  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ConnectedDevice | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await deviceService.list();
    if (!isOk(result)) { setError(result.error.message); setLoading(false); return; }
    setDevices(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setCreating(true); };
  const openEdit = (device: ConnectedDevice) => {
    setForm({ name: device.name, kind: device.kind, model: device.model ?? '' });
    setEditing(device);
  };
  const close = () => { setCreating(false); setEditing(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      kind: form.kind.trim(),
      model: form.model.trim() || null,
    };
    const result = editing
      ? await deviceService.update(editing.id, payload)
      : await deviceService.create(payload);
    setSaving(false);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(editing ? (t ? 'تم الحفظ' : 'Saved') : (t ? 'تمت إضافة الجهاز' : 'Device added'));
    close();
    load();
  };

  const remove = async (device: ConnectedDevice) => {
    const result = await deviceService.remove(device.id);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(t ? 'تم حذف الجهاز' : 'Device removed');
    load();
  };

  const test = async (device: ConnectedDevice) => {
    setTesting(device.id);
    const result = await deviceService.testConnection(device.id);
    setTesting(null);
    if (!isOk(result)) { toast.error(result.error.message); return; }
    toast.success(result.data.message);
    load();
  };

  return (
    <>
      {usingMock('devices') && <MockDataBanner what={t ? 'خدمة الأجهزة' : 'the device service'} />}

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />{t ? 'إضافة جهاز' : 'Add device'}
        </Button>
      </div>

      {loading ? <LoadingState />
        : error ? <ErrorState message={error} onRetry={load} />
        : devices.length === 0 ? (
          <EmptyState icon={HardDrive}
            title={t ? 'لا توجد أجهزة مسجّلة' : 'No devices registered'}
            description={t
              ? 'سجّل الجهاز هنا ليظهر مع حالته. طريقة الاتصال الفعلية يحددها الخادم حسب نوع الجهاز.'
              : 'Register a device to see it and its state here. How it actually connects is decided by the backend, per device type.'}
            action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />{t ? 'إضافة جهاز' : 'Add device'}</Button>} />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t ? 'الجهاز' : 'Device'}</TableHead>
                  <TableHead className="text-center">{t ? 'النوع' : 'Kind'}</TableHead>
                  <TableHead className="text-center">{t ? 'الموديل' : 'Model'}</TableHead>
                  <TableHead className="text-center">{t ? 'الفرع' : 'Branch'}</TableHead>
                  <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="text-center">{t ? 'آخر اتصال' : 'Last seen'}</TableHead>
                  <TableHead className="text-center">{t ? 'آخر مزامنة' : 'Last sync'}</TableHead>
                  <TableHead className="text-end">{t ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {devices.map(device => {
                    const meta = STATUS[device.status];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                              <HardDrive className="w-4 h-4 text-primary" />
                            </div>
                            {device.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{device.kind || '—'}</TableCell>
                        <TableCell className="text-center">{device.model || '—'}</TableCell>
                        <TableCell className="text-center">{device.branchName || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn(meta.cls, 'gap-1')}>
                            <Icon className="w-3 h-3" />{t ? meta.ar : meta.en}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString(t ? 'ar-SA' : 'en-GB') : '—'}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString(t ? 'ar-SA' : 'en-GB') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => test(device)}
                              disabled={testing === device.id} title={t ? 'اختبار الاتصال' : 'Test connection'}>
                              {testing === device.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(device)} title={t ? 'إعدادات' : 'Settings'}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => remove(device)} title={t ? 'حذف' : 'Remove'}>
                              <Trash2 className="w-4 h-4 text-destructive" />
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

      <Dialog open={creating || !!editing} onOpenChange={open => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? (t ? 'إعدادات الجهاز' : 'Device settings') : (t ? 'إضافة جهاز' : 'Add device')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="device-name">{t ? 'اسم الجهاز' : 'Device name'} *</Label>
              <Input id="device-name" value={form.name} required
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="device-kind">{t ? 'النوع' : 'Kind'}</Label>
              <Input id="device-kind" value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value })}
                placeholder={t ? 'اكتب نوع الجهاز' : 'Type the device kind'} />
              {/* Free text on purpose: no device type has been chosen, and a
                  fixed list here would be a guess. */}
              <p className="text-xs text-muted-foreground mt-1">
                {t
                  ? 'حقل حر — يُحدَّد نوع الجهاز وطريقة اتصاله من جهة الخادم.'
                  : 'Free text — the device type and how it connects are decided by the backend.'}
              </p>
            </div>
            <div>
              <Label htmlFor="device-model">{t ? 'الموديل' : 'Model'}</Label>
              <Input id="device-model" dir="ltr" value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })} />
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
    </>
  );
}
