import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Search, Download, ChevronDown, ChevronUp, Eye, CreditCard,
  Calendar, DollarSign, FileText, XCircle, CheckCircle, Smartphone,
  Wrench, Shield, Loader2, Users,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { usePlans, Plan } from '@/hooks/usePlans';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    trial: { label: 'تجريبي', className: 'bg-warning/15 text-warning' },
    active: { label: 'نشط', className: 'bg-success/15 text-success' },
    expired: { label: 'منتهي', className: 'bg-destructive/15 text-destructive' },
    cancelled: { label: 'موقوف', className: 'bg-muted text-muted-foreground' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
};

function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

export default function AdminCompaniesPage() {
  const {
    companies, fetchCompanies, updateSubscriptionStatus, updateSubscriptionPlan,
    extendSubscription, addAdminNote, updateMerchantFee, isPlatformAdmin, loading: adminLoading,
  } = usePlatformAdmin();
  const { plans } = usePlans();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; target: any } | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) { navigate('/auth'); return; }
    fetchCompanies().then(() => setLoaded(true));
  }, [isPlatformAdmin, adminLoading]);

  const filteredCompanies = useMemo(() => {
    let result = companies;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)));
    }
    if (statusFilter !== 'all') result = result.filter(c => c.subscription?.status === statusFilter);
    return result;
  }, [companies, searchQuery, statusFilter]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    const { type, target } = actionDialog;
    let result;
    switch (type) {
      case 'suspend': result = await updateSubscriptionStatus(target.subscription.id, 'cancelled'); break;
      case 'reactivate': result = await updateSubscriptionStatus(target.subscription.id, 'active'); break;
      case 'extend': result = await extendSubscription(target.subscription.id, parseInt(actionValue) || 30); break;
      case 'upgrade': {
        const plan = plans.find((p: Plan) => p.id === actionValue);
        if (plan) result = await updateSubscriptionPlan(target.subscription.id, plan.id, plan.branch_limit, plan.user_limit, plan.name);
        break;
      }
      case 'note': result = await addAdminNote(target.subscription.id, actionValue); break;
      case 'fee': result = await updateMerchantFee(target.id, actionValue !== '' ? parseFloat(actionValue) : 5); break;
    }
    if (result && !result.error) toast.success('تمت العملية بنجاح');
    else if (result?.error) toast.error((result.error as any).message || 'حدث خطأ');
    setActionLoading(false);
    setActionDialog(null);
    setActionValue('');
  };

  if (!loaded || adminLoading) {
    return <AdminLayout title="الشركات"><div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AdminLayout>;
  }

  return (
    <AdminLayout title="الشركات" subtitle={`${companies.length} شركة مسجلة`}>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو البريد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="trial">تجريبي</SelectItem>
            <SelectItem value="expired">منتهي</SelectItem>
            <SelectItem value="cancelled">موقوف</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => {
          exportToCSV(companies.map(c => ({
            'الاسم': c.name, 'البريد': c.email || '', 'الهاتف': c.phone || '',
            'الباقة': c.subscription?.plan || '', 'الحالة': c.subscription?.status || '',
            'الفروع': c.branch_count, 'المستخدمين': c.user_count, 'المبيعات': c.sales_total,
          })), 'merchants');
          toast.success('تم تصدير التقرير');
        }} className="gap-2">
          <Download className="w-4 h-4" /> تصدير
        </Button>
      </div>

      {/* Companies List */}
      <div className="space-y-3">
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد شركات مطابقة</p>
          </div>
        ) : filteredCompanies.map(company => (
          <motion.div key={company.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{company.name}</h3>
                  <p className="text-sm text-muted-foreground">{company.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-sm font-medium">{company.subscription?.plan || '—'}</p>
                  {company.subscription && statusBadge(company.subscription.status)}
                </div>
                <div className="hidden sm:flex items-center gap-4 text-center text-sm">
                  <div><span className="font-semibold">{company.branch_count}</span><p className="text-muted-foreground text-xs">فروع</p></div>
                  <div><span className="font-semibold">{company.user_count}</span><p className="text-muted-foreground text-xs">مستخدمين</p></div>
                  <div><p className="font-semibold text-primary">{company.sales_total.toLocaleString()}</p><p className="text-muted-foreground text-xs">مبيعات</p></div>
                </div>
                {expandedCompany === company.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>

            {expandedCompany === company.id && company.subscription && (
              <div className="p-4 border-t border-border bg-muted/10 space-y-4">
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-5 text-sm">
                  <div className="p-3 rounded-lg bg-card border border-border text-center">
                    <Smartphone className="w-4 h-4 mx-auto text-primary mb-1" /><p className="font-bold">{company.device_count}</p><p className="text-xs text-muted-foreground">أجهزة</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border text-center">
                    <Wrench className="w-4 h-4 mx-auto text-warning mb-1" /><p className="font-bold">{company.repair_count}</p><p className="text-xs text-muted-foreground">إصلاحات</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border text-center">
                    <DollarSign className="w-4 h-4 mx-auto text-success mb-1" /><p className="font-bold">{company.sales_total.toLocaleString()}</p><p className="text-xs text-muted-foreground">مبيعات</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border text-center">
                    <Shield className="w-4 h-4 mx-auto text-accent-foreground mb-1" /><p className="font-bold">{company.platform_fee_percentage || 5}%</p><p className="text-xs text-muted-foreground">عمولة</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border text-center">
                    <Calendar className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="font-bold text-xs">
                      {company.subscription.subscription_ends_at ? format(new Date(company.subscription.subscription_ends_at), 'dd/MM/yyyy')
                        : company.subscription.trial_ends_at ? format(new Date(company.subscription.trial_ends_at), 'dd/MM/yyyy') : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">انتهاء</p>
                  </div>
                </div>
                {company.subscription.admin_notes && (
                  <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">ملاحظات:</p>
                    <p className="text-foreground">{company.subscription.admin_notes}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate(`/platform-admin/merchant/${company.id}`)}><Eye className="w-4 h-4 ml-1" /> تفاصيل</Button>
                  <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'upgrade', target: company })}><CreditCard className="w-4 h-4 ml-1" /> ترقية</Button>
                  <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'extend', target: company })}><Calendar className="w-4 h-4 ml-1" /> تمديد</Button>
                  <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'fee', target: company })}><DollarSign className="w-4 h-4 ml-1" /> عمولة</Button>
                  {company.subscription.status !== 'cancelled' ? (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setActionDialog({ type: 'suspend', target: company })}><XCircle className="w-4 h-4 ml-1" /> تعليق</Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-success" onClick={() => setActionDialog({ type: 'reactivate', target: company })}><CheckCircle className="w-4 h-4 ml-1" /> تفعيل</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'note', target: company })}><FileText className="w-4 h-4 ml-1" /> ملاحظة</Button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setActionValue(''); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'upgrade' && 'ترقية الباقة'}
              {actionDialog?.type === 'extend' && 'تمديد الاشتراك'}
              {actionDialog?.type === 'note' && 'إضافة ملاحظة'}
              {actionDialog?.type === 'fee' && 'تعديل العمولة'}
              {actionDialog?.type === 'suspend' && 'تعليق الاشتراك'}
              {actionDialog?.type === 'reactivate' && 'إعادة تفعيل'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionDialog?.type === 'upgrade' && (
              <div>
                <Label>اختر الباقة</Label>
                <Select value={actionValue} onValueChange={setActionValue}>
                  <SelectTrigger><SelectValue placeholder="اختر باقة" /></SelectTrigger>
                  <SelectContent>{plans.map((p: Plan) => <SelectItem key={p.id} value={p.id}>{p.name_ar} - {p.price} ر.س</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {actionDialog?.type === 'extend' && (
              <div><Label>عدد الأيام</Label><Input type="number" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder="30" /></div>
            )}
            {actionDialog?.type === 'note' && (
              <div><Label>الملاحظة</Label><Textarea value={actionValue} onChange={e => setActionValue(e.target.value)} /></div>
            )}
            {actionDialog?.type === 'fee' && (
              <div><Label>نسبة العمولة %</Label><Input type="number" step="0.1" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder="5" /></div>
            )}
            {(actionDialog?.type === 'suspend' || actionDialog?.type === 'reactivate') && (
              <p className="text-sm text-muted-foreground">
                {actionDialog.type === 'suspend' ? 'سيتم تعليق اشتراك هذه الشركة ومنع الوصول.' : 'سيتم إعادة تفعيل اشتراك هذه الشركة.'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setActionValue(''); }}>إلغاء</Button>
            <Button onClick={handleAction} disabled={actionLoading}>{actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
