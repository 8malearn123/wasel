import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    pending_review: { label: 'قيد المراجعة', className: 'bg-warning/15 text-warning' },
    pending_payment: { label: 'بانتظار الدفع', className: 'bg-primary/15 text-primary' },
    activated: { label: 'مفعّل', className: 'bg-success/15 text-success' },
    rejected: { label: 'مرفوض', className: 'bg-destructive/15 text-destructive' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
};

export default function AdminBranchRequestsPage() {
  const { branchRequests, fetchBranchRequests, approveBranchRequest, rejectBranchRequest, issueInvoice, confirmPaymentAndActivate, isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ type: string; target: any } | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) { navigate('/auth'); return; }
    fetchBranchRequests().then(() => setLoaded(true));
  }, [isPlatformAdmin, adminLoading]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    let result;
    switch (actionDialog.type) {
      case 'approve': result = await approveBranchRequest(actionDialog.target.id); break;
      case 'reject': result = await rejectBranchRequest(actionDialog.target.id, actionValue); break;
      case 'invoice': result = await issueInvoice(actionDialog.target.id, parseFloat(actionValue) || 0); break;
      case 'activate': result = await confirmPaymentAndActivate(actionDialog.target.id); break;
    }
    if (result && !result.error) toast.success('تمت العملية');
    setActionLoading(false); setActionDialog(null); setActionValue('');
  };

  if (!loaded || adminLoading) return <AdminLayout title="طلبات الفروع"><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout title="طلبات الفروع" subtitle={`${branchRequests.length} طلب`}>
      <div className="space-y-3">
        {branchRequests.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border border-border">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد طلبات فروع</p>
          </div>
        ) : branchRequests.map(req => (
          <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{req.branch_name}</h3>
                <p className="text-sm text-muted-foreground">{(req as any).merchant?.name} • {req.city || '—'}</p>
                {req.notes && <p className="text-sm text-muted-foreground mt-1">{req.notes}</p>}
                <p className="text-xs text-muted-foreground mt-1">{format(new Date(req.created_at), 'dd MMM yyyy', { locale: ar })}</p>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(req.status)}
                {req.invoice_amount && <span className="text-sm font-medium">{req.invoice_amount} ر.س</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {req.status === 'pending_review' && (
                <>
                  <Button size="sm" onClick={() => setActionDialog({ type: 'approve', target: req })}><CheckCircle className="w-4 h-4 ml-1" /> موافقة</Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setActionDialog({ type: 'reject', target: req })}><XCircle className="w-4 h-4 ml-1" /> رفض</Button>
                  <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'invoice', target: req })}><DollarSign className="w-4 h-4 ml-1" /> فاتورة</Button>
                </>
              )}
              {req.status === 'pending_payment' && (
                <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => setActionDialog({ type: 'activate', target: req })}>
                  <CheckCircle className="w-4 h-4 ml-1" /> تأكيد وتفعيل
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionValue(''); }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>
            {actionDialog?.type === 'approve' && 'موافقة على الطلب'}
            {actionDialog?.type === 'reject' && 'رفض الطلب'}
            {actionDialog?.type === 'invoice' && 'إصدار فاتورة'}
            {actionDialog?.type === 'activate' && 'تأكيد الدفع والتفعيل'}
          </DialogTitle></DialogHeader>
          <div className="py-4">
            {actionDialog?.type === 'reject' && <div><Label>سبب الرفض</Label><Textarea value={actionValue} onChange={e => setActionValue(e.target.value)} /></div>}
            {actionDialog?.type === 'invoice' && <div><Label>المبلغ (ر.س)</Label><Input type="number" value={actionValue} onChange={e => setActionValue(e.target.value)} /></div>}
            {(actionDialog?.type === 'approve' || actionDialog?.type === 'activate') && <p className="text-sm text-muted-foreground">هل أنت متأكد؟</p>}
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
