import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Wallet } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'معلق', className: 'bg-warning/15 text-warning' },
    completed: { label: 'مكتمل', className: 'bg-success/15 text-success' },
    rejected: { label: 'مرفوض', className: 'bg-destructive/15 text-destructive' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
};

export default function AdminPayoutsPage() {
  const { payouts, fetchPayouts, updatePayoutStatus, isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ type: string; target: any } | null>(null);
  const [refNumber, setRefNumber] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) { navigate('/auth'); return; }
    fetchPayouts().then(() => setLoaded(true));
  }, [isPlatformAdmin, adminLoading]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    const result = actionDialog.type === 'complete'
      ? await updatePayoutStatus(actionDialog.target.id, 'completed', refNumber)
      : await updatePayoutStatus(actionDialog.target.id, 'rejected');
    if (result && !result.error) toast.success('تمت العملية');
    setActionLoading(false); setActionDialog(null); setRefNumber('');
  };

  if (!loaded || adminLoading) return <AdminLayout title="المدفوعات"><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout title="المدفوعات" subtitle={`${payouts.length} عملية`}>
      {payouts.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">لا توجد مدفوعات</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاجر</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>العمولة</TableHead>
                  <TableHead>الصافي</TableHead>
                  <TableHead>الطلبات</TableHead>
                  <TableHead>الفترة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{(p as any).merchant?.name || '—'}</TableCell>
                    <TableCell className="font-semibold">{Number(p.amount).toLocaleString()} ر.س</TableCell>
                    <TableCell className="text-muted-foreground">{Number(p.platform_fee || 0).toLocaleString()} ر.س</TableCell>
                    <TableCell className="font-semibold text-primary">{Number(p.net_amount || 0).toLocaleString()} ر.س</TableCell>
                    <TableCell>{p.orders_count || 0}</TableCell>
                    <TableCell className="text-xs">{p.period_from ? format(new Date(p.period_from), 'dd/MM') : '—'} - {p.period_to ? format(new Date(p.period_to), 'dd/MM') : '—'}</TableCell>
                    <TableCell>{statusBadge(p.status || 'pending')}</TableCell>
                    <TableCell className="text-xs font-mono">{p.reference_number || '—'}</TableCell>
                    <TableCell>
                      {p.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setActionDialog({ type: 'complete', target: p })}>تأكيد</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setActionDialog({ type: 'reject', target: p })}>رفض</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setRefNumber(''); }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{actionDialog?.type === 'complete' ? 'تأكيد الدفع' : 'رفض الدفع'}</DialogTitle></DialogHeader>
          <div className="py-4">
            {actionDialog?.type === 'complete' && <div><Label>رقم المرجع</Label><Input value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="رقم الحوالة" /></div>}
            {actionDialog?.type === 'reject' && <p className="text-sm text-muted-foreground">هل أنت متأكد من رفض هذه الدفعة؟</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>إلغاء</Button>
            <Button onClick={handleAction} disabled={actionLoading}>{actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
