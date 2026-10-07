import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, LogIn, LogOut, CalendarDays, Fingerprint, Loader2, Timer, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTabParam } from '@/hooks/useTabParam';
import { useLanguage } from '@/i18n';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmployees } from '@/hooks/useEmployees';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  attendanceService, usingMock, isOk,
  type AttendanceToday, type AttendanceRecord, type AttendanceStatus,
} from '@/services';
import {
  LoadingState, EmptyState, ErrorState, PermissionDeniedState, MockDataBanner,
} from '@/components/common/StateViews';

const STATUS: Record<AttendanceStatus, { ar: string; en: string; cls: string }> = {
  present:  { ar: 'حاضر',   en: 'Present',  cls: 'bg-success/15 text-success' },
  absent:   { ar: 'غائب',   en: 'Absent',   cls: 'bg-destructive/15 text-destructive' },
  late:     { ar: 'متأخر',  en: 'Late',     cls: 'bg-warning/15 text-warning' },
  on_leave: { ar: 'إجازة',  en: 'On leave', cls: 'bg-primary/15 text-primary' },
  holiday:  { ar: 'عطلة',   en: 'Holiday',  cls: 'bg-muted text-muted-foreground' },
};

const SOURCE_AR: Record<string, string> = { device: 'جهاز البصمة', manual: 'يدوي', web: 'النظام' };

const TABS = [
  { key: 'today', ar: 'اليوم', en: 'Today' },
  { key: 'log', ar: 'سجل الحضور', en: 'Attendance log' },
] as const;

const time = (iso: string | null, isRTL: boolean) =>
  iso ? new Date(iso).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';

const duration = (minutes: number | null, isRTL: boolean) => {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return isRTL ? `${h} س ${m} د` : `${h}h ${m}m`;
};

export default function AttendanceSection() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const { can, loading: permsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useTabParam('today', 'sub');
  const { employees } = useEmployees();

  const mayViewAll = can('employees.view');

  if (permsLoading) {
    return <LoadingState />;
  }

  return (
    <>
      {usingMock('attendance') && (
        <MockDataBanner what={t ? 'خدمة الحضور' : 'the attendance service'} />
      )}

      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border mb-5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="today" className="m-0">
          <TodayPanel />
        </TabsContent>
        <TabsContent value="log" className="m-0">
          {mayViewAll
            ? <AttendanceLog employees={employees.map(e => ({ id: e.id, name: e.full_name }))} />
            : <PermissionDeniedState permission="employees.view" />}
        </TabsContent>
      </Tabs>
    </>
  );
}

function TodayPanel() {
  const { isRTL } = useLanguage();
  const t = isRTL;
  const [today, setToday] = useState<AttendanceToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [punching, setPunching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await attendanceService.getToday();
    if (!isOk(result)) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setToday(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const punch = async (kind: 'in' | 'out') => {
    if (!today) return;
    setPunching(true);
    const result = kind === 'in'
      ? await attendanceService.checkIn(today.employeeId)
      : await attendanceService.checkOut(today.employeeId);
    setPunching(false);

    if (!isOk(result)) {
      toast.error(result.error.message);
      return;
    }
    setToday(result.data);
    toast.success(kind === 'in'
      ? (t ? 'تم تسجيل الحضور' : 'Checked in')
      : (t ? 'تم تسجيل الانصراف' : 'Checked out'));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!today) {
    return <EmptyState icon={Fingerprint}
      title={t ? 'لا يوجد سجل لهذا اليوم' : 'Nothing recorded today'} />;
  }

  const status = STATUS[today.status];
  const checkedIn = Boolean(today.checkInAt);
  const checkedOut = Boolean(today.checkOutAt);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={CalendarDays} label={t ? 'التاريخ' : 'Date'}
          value={new Date(today.date).toLocaleDateString(t ? 'ar-SA' : 'en-GB')} />
        <Tile icon={LogIn} label={t ? 'وقت الحضور' : 'Checked in'} value={time(today.checkInAt, t)} />
        <Tile icon={LogOut} label={t ? 'وقت الانصراف' : 'Checked out'} value={time(today.checkOutAt, t)} />
        <Tile icon={Timer} label={t ? 'مدة العمل' : 'Worked'} value={duration(today.workedMinutes, t)} />
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center',
              checkedIn && !checkedOut ? 'bg-success/10' : 'bg-muted')}>
              <Fingerprint className={cn('w-6 h-6', checkedIn && !checkedOut ? 'text-success' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="font-semibold text-foreground">{today.employeeName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={status.cls}>{t ? status.ar : status.en}</Badge>
                {/* Only shown when the backend sent it — lateness rules are not
                    defined here, so nothing is computed in the browser. */}
                {today.lateMinutes !== null && today.lateMinutes > 0 && (
                  <span className="text-xs text-warning">
                    {t ? `تأخير ${today.lateMinutes} دقيقة` : `${today.lateMinutes} min late`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 ms-auto">
            <Button onClick={() => punch('in')} disabled={punching || checkedIn} className="gap-2">
              {punching ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {t ? 'تسجيل حضور' : 'Check in'}
            </Button>
            <Button onClick={() => punch('out')} disabled={punching || !checkedIn || checkedOut}
              variant="outline" className="gap-2">
              {punching ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {t ? 'تسجيل انصراف' : 'Check out'}
            </Button>
          </div>
        </div>

        {today.lastPunchAt && (
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t ? 'آخر عملية: ' : 'Last punch: '}
            {new Date(today.lastPunchAt).toLocaleString(t ? 'ar-SA' : 'en-GB')}
            {today.lastPunchSource && ` · ${t ? (SOURCE_AR[today.lastPunchSource] ?? today.lastPunchSource) : today.lastPunchSource}`}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          {t
            ? 'البصمة نفسها تُقرأ من الجهاز عبر الخادم — هذه الأزرار تسجّل العملية ولا تتصل بالجهاز مباشرة.'
            : 'The fingerprint itself is read by the device through the backend; these buttons record the punch, they do not talk to any device.'}
        </p>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-card border border-border shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Icon className="w-5 h-5 text-primary" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AttendanceLog({ employees }: { employees: { id: string; name: string }[] }) {
  const { isRTL } = useLanguage();
  const t = isRTL;

  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await attendanceService.list({
      search: search || undefined,
      employeeId: employeeId === 'all' ? undefined : employeeId,
      status: status === 'all' ? undefined : (status as AttendanceStatus),
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize,
    });
    if (!isOk(result)) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setRows(result.data.items);
    setTotal(result.data.total);
    setLoading(false);
  }, [search, employeeId, status, from, to, page]);

  useEffect(() => { load(); }, [load]);
  // any change to the filters starts again from the first page
  useEffect(() => { setPage(1); }, [search, employeeId, status, from, to]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(search || employeeId !== 'all' || status !== 'all' || from || to);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[170px] max-w-xs">
          <Label className="text-xs text-muted-foreground">{t ? 'بحث' : 'Search'}</Label>
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t ? 'اسم الموظف' : 'Employee name'} />
        </div>

        <div className="min-w-[150px]">
          <Label className="text-xs text-muted-foreground">{t ? 'الموظف' : 'Employee'}</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t ? 'الكل' : 'All'}</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px]">
          <Label className="text-xs text-muted-foreground">{t ? 'الحالة' : 'Status'}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t ? 'الكل' : 'All'}</SelectItem>
              {(Object.keys(STATUS) as AttendanceStatus[]).map(key => (
                <SelectItem key={key} value={key}>{t ? STATUS[key].ar : STATUS[key].en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">{t ? 'من' : 'From'}</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t ? 'إلى' : 'To'}</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered
            ? (t ? 'لا نتائج مطابقة' : 'Nothing matches')
            : (t ? 'لا يوجد سجل حضور بعد' : 'No attendance recorded yet')}
          description={filtered ? undefined : (t
            ? 'سيظهر السجل هنا فور ربط جهاز البصمة بالخادم.'
            : 'Records appear here once a device is connected through the backend.')}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t ? 'الموظف' : 'Employee'}</TableHead>
                <TableHead className="text-center">{t ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead className="text-center">{t ? 'الحضور' : 'In'}</TableHead>
                <TableHead className="text-center">{t ? 'الانصراف' : 'Out'}</TableHead>
                <TableHead className="text-center">{t ? 'مدة العمل' : 'Worked'}</TableHead>
                <TableHead className="text-center">{t ? 'التأخير' : 'Late'}</TableHead>
                <TableHead className="text-center">{t ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-center">{t ? 'المصدر' : 'Source'}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(row => {
                  const meta = STATUS[row.status];
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.employeeName}</TableCell>
                      <TableCell className="text-center">
                        {new Date(row.date).toLocaleDateString(t ? 'ar-SA' : 'en-GB')}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{time(row.checkInAt, t)}</TableCell>
                      <TableCell className="text-center tabular-nums">{time(row.checkOutAt, t)}</TableCell>
                      <TableCell className="text-center tabular-nums">{duration(row.workedMinutes, t)}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {/* dash, not zero: the backend has no shift rules yet */}
                        {row.lateMinutes === null ? '—' : `${row.lateMinutes} ${t ? 'د' : 'm'}`}
                      </TableCell>
                      <TableCell className="text-center"><Badge className={meta.cls}>{t ? meta.ar : meta.en}</Badge></TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {row.source ? (t ? (SOURCE_AR[row.source] ?? row.source) : row.source) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border-t border-border text-sm">
            <span className="text-muted-foreground">
              {t ? `${total} سجل` : `${total} records`}
            </span>
            <div className="flex items-center gap-1 ms-auto">
              <Button variant="outline" size="sm" className="h-8 px-3"
                disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                {t ? 'السابق' : 'Previous'}
              </Button>
              <span className="px-2 tabular-nums text-muted-foreground">{page} / {pageCount}</span>
              <Button variant="outline" size="sm" className="h-8 px-3"
                disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>
                {t ? 'التالي' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
