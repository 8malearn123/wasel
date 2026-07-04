import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Users, CreditCard, Clock, Shield, AlertTriangle,
  CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp,
  Calendar, FileText, DollarSign, Package, Search,
  BarChart3, ShoppingCart, Wrench, Smartphone, Globe,
  Activity, Wallet, TrendingUp, Eye, Download, LifeBuoy, MessageSquare, Send
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { usePlans, Plan } from '@/hooks/usePlans';
import { useAdminTickets, SupportTicket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    trial: { label: 'تجريبي', className: 'bg-warning/15 text-warning' },
    active: { label: 'نشط', className: 'bg-success/15 text-success' },
    expired: { label: 'منتهي', className: 'bg-destructive/15 text-destructive' },
    cancelled: { label: 'موقوف', className: 'bg-muted text-muted-foreground' },
    pending_review: { label: 'قيد المراجعة', className: 'bg-warning/15 text-warning' },
    pending_payment: { label: 'بانتظار الدفع', className: 'bg-primary/15 text-primary' },
    activated: { label: 'مفعّل', className: 'bg-success/15 text-success' },
    rejected: { label: 'مرفوض', className: 'bg-destructive/15 text-destructive' },
    pending: { label: 'معلق', className: 'bg-warning/15 text-warning' },
    completed: { label: 'مكتمل', className: 'bg-success/15 text-success' },
    processing: { label: 'قيد المعالجة', className: 'bg-primary/15 text-primary' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
};

const actionLabels: Record<string, string> = {
  branch_activated: 'تفعيل فرع',
  device_added: 'إضافة جهاز',
  device_sold: 'بيع جهاز',
  sale_created: 'إنشاء فاتورة',
  repair_created: 'إنشاء إصلاح',
  transfer_created: 'إنشاء تحويل',
  user_created: 'إضافة مستخدم',
  accessory_added: 'إضافة إكسسوار',
  stocktake_created: 'إنشاء جرد',
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

export default function PlatformAdminPage() {
  const {
    companies, branchRequests, platformStats, activityLogs, payouts,
    fetchCompanies, fetchBranchRequests, fetchActivityLogs, fetchPayouts,
    updateSubscriptionStatus, updateSubscriptionPlan, extendSubscription,
    addAdminNote, updateMerchantFee, updatePayoutStatus,
    approveBranchRequest, rejectBranchRequest,
    issueInvoice, confirmPaymentAndActivate,
  } = usePlatformAdmin();
  const { plans } = usePlans();
  const { tickets: adminTickets, loading: ticketsLoading, replyToTicket, updateTicketStatus } = useAdminTickets();
  const [ticketReply, setTicketReply] = useState('');
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; target: any } | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [actionValue2, setActionValue2] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    Promise.all([fetchCompanies(), fetchBranchRequests(), fetchActivityLogs(), fetchPayouts()])
      .then(() => setLoaded(true));
  }, [fetchCompanies, fetchBranchRequests, fetchActivityLogs, fetchPayouts]);

  const filteredCompanies = useMemo(() => {
    let result = companies;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => c.subscription?.status === statusFilter);
    }
    return result;
  }, [companies, searchQuery, statusFilter]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setActionLoading(true);
    const { type, target } = actionDialog;
    let result;

    switch (type) {
      case 'suspend':
        result = await updateSubscriptionStatus(target.subscription.id, 'cancelled');
        break;
      case 'reactivate':
        result = await updateSubscriptionStatus(target.subscription.id, 'active');
        break;
      case 'extend':
        result = await extendSubscription(target.subscription.id, parseInt(actionValue) || 30);
        break;
      case 'upgrade': {
        const plan = plans.find((p: Plan) => p.id === actionValue);
        if (plan) {
          result = await updateSubscriptionPlan(target.subscription.id, plan.id, plan.branch_limit, plan.user_limit, plan.name);
        }
        break;
      }
      case 'note':
        result = await addAdminNote(target.subscription.id, actionValue);
        break;
      case 'fee':
        result = await updateMerchantFee(target.id, actionValue !== '' ? parseFloat(actionValue) : 5);
        break;
      case 'approve_branch':
        result = await approveBranchRequest(target.id);
        break;
      case 'reject_branch':
        result = await rejectBranchRequest(target.id, actionValue);
        break;
      case 'invoice_branch':
        result = await issueInvoice(target.id, parseFloat(actionValue) || 0);
        break;
      case 'activate_branch':
        result = await confirmPaymentAndActivate(target.id);
        break;
      case 'payout_complete':
        result = await updatePayoutStatus(target.id, 'completed', actionValue);
        break;
      case 'payout_reject':
        result = await updatePayoutStatus(target.id, 'rejected');
        break;
    }

    if (result && !result.error) {
      toast.success('تمت العملية بنجاح');
    } else if (result?.error) {
      toast.error((result.error as any).message || 'حدث خطأ');
    }

    setActionLoading(false);
    setActionDialog(null);
    setActionValue('');
    setActionValue2('');
  };

  const handleExportMerchants = () => {
    const data = companies.map(c => ({
      'الاسم': c.name,
      'البريد': c.email || '',
      'الهاتف': c.phone || '',
      'الباقة': c.subscription?.plan || '',
      'الحالة': c.subscription?.status || '',
      'الفروع': c.branch_count,
      'المستخدمين': c.user_count,
      'الأجهزة': c.device_count,
      'إجمالي المبيعات': c.sales_total,
      'الإصلاحات': c.repair_count,
      'تاريخ الانضمام': c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd') : '',
    }));
    exportToCSV(data, 'merchants-report');
    toast.success('تم تصدير التقرير');
  };

  const stats = platformStats;

  if (!loaded) {
    return (
      <AppLayout title="إدارة المنصة" subtitle="لوحة تحكم مدير المنصة">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="إدارة المنصة" subtitle="لوحة تحكم شاملة لإدارة المنصة">
      {/* Platform-wide Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        {[
          { icon: Building2, label: 'إجمالي الشركات', value: stats.totalMerchants, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: CheckCircle, label: 'اشتراكات نشطة', value: stats.activeSubs, color: 'text-success', bg: 'bg-success/10' },
          { icon: DollarSign, label: 'إجمالي المبيعات', value: `${(stats.totalRevenue / 1000).toFixed(0)}K`, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Smartphone, label: 'إجمالي الأجهزة', value: stats.totalDevices, color: 'text-accent-foreground', bg: 'bg-accent/10' },
          { icon: Globe, label: 'طلبات أونلاين', value: stats.totalOnlineOrders, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: TrendingUp, label: 'انضموا هذا الأسبوع', value: stats.recentSignups, color: 'text-success', bg: 'bg-success/10' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-3 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="companies" dir="rtl">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="w-4 h-4" /> الشركات
            <Badge variant="secondary" className="mr-1 text-xs">{companies.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="branch-requests" className="gap-2">
            <Package className="w-4 h-4" /> طلبات الفروع
            {stats.pendingBranchRequests > 0 && <Badge variant="destructive" className="mr-1">{stats.pendingBranchRequests}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2">
            <Wallet className="w-4 h-4" /> المدفوعات
            {stats.pendingPayouts > 0 && <Badge variant="destructive" className="mr-1">{stats.pendingPayouts}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <CreditCard className="w-4 h-4" /> الباقات
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" /> سجل النشاط
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <LifeBuoy className="w-4 h-4" /> تذاكر الدعم
            {adminTickets.filter(t => t.status === 'open').length > 0 && (
              <Badge variant="destructive" className="mr-1">{adminTickets.filter(t => t.status === 'open').length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، البريد، الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
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
            <Button variant="outline" onClick={handleExportMerchants} className="gap-2">
              <Download className="w-4 h-4" /> تصدير
            </Button>
          </div>

          <div className="space-y-3">
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-xl border border-border">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد شركات مطابقة</p>
              </div>
            ) : filteredCompanies.map((company) => (
              <motion.div key={company.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
                >
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
                      <div>
                        <span className="font-semibold">{company.branch_count}</span>
                        <span className="text-muted-foreground">/{company.subscription?.max_branches || '?'}</span>
                        <p className="text-muted-foreground text-xs">فروع</p>
                      </div>
                      <div>
                        <span className="font-semibold">{company.user_count}</span>
                        <span className="text-muted-foreground">/{company.subscription?.max_users || '?'}</span>
                        <p className="text-muted-foreground text-xs">مستخدمين</p>
                      </div>
                      <div>
                        <p className="font-semibold text-primary">{company.sales_total.toLocaleString()}</p>
                        <p className="text-muted-foreground text-xs">مبيعات</p>
                      </div>
                    </div>
                    {expandedCompany === company.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {expandedCompany === company.id && company.subscription && (
                  <div className="p-4 border-t border-border bg-muted/10 space-y-4">
                    {/* Quick stats for this merchant */}
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-5 text-sm">
                      <div className="p-3 rounded-lg bg-card border border-border text-center">
                        <Smartphone className="w-4 h-4 mx-auto text-primary mb-1" />
                        <p className="font-bold">{company.device_count}</p>
                        <p className="text-xs text-muted-foreground">أجهزة</p>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border text-center">
                        <Wrench className="w-4 h-4 mx-auto text-warning mb-1" />
                        <p className="font-bold">{company.repair_count}</p>
                        <p className="text-xs text-muted-foreground">إصلاحات</p>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border text-center">
                        <DollarSign className="w-4 h-4 mx-auto text-success mb-1" />
                        <p className="font-bold">{company.sales_total.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">مبيعات (ر.س)</p>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border text-center">
                        <Shield className="w-4 h-4 mx-auto text-accent-foreground mb-1" />
                        <p className="font-bold">{company.platform_fee_percentage || 5}%</p>
                        <p className="text-xs text-muted-foreground">عمولة المنصة</p>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border text-center">
                        <Calendar className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                        <p className="font-bold text-xs">
                          {company.subscription.subscription_ends_at
                            ? format(new Date(company.subscription.subscription_ends_at), 'dd/MM/yyyy')
                            : company.subscription.trial_ends_at
                              ? format(new Date(company.subscription.trial_ends_at), 'dd/MM/yyyy')
                              : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">تاريخ الانتهاء</p>
                      </div>
                    </div>

                    {company.subscription.admin_notes && (
                      <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 text-sm">
                        <p className="text-xs text-muted-foreground mb-1">ملاحظات المدير:</p>
                        <p className="text-foreground">{company.subscription.admin_notes}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => navigate(`/platform-admin/merchant/${company.id}`)}>
                        <Eye className="w-4 h-4 ml-1" /> عرض التفاصيل
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'upgrade', target: company })}>
                        <CreditCard className="w-4 h-4 ml-1" /> ترقية الباقة
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'extend', target: company })}>
                        <Calendar className="w-4 h-4 ml-1" /> تمديد
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'fee', target: company })}>
                        <DollarSign className="w-4 h-4 ml-1" /> تعديل العمولة
                      </Button>
                      {company.subscription.status !== 'cancelled' ? (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setActionDialog({ type: 'suspend', target: company })}>
                          <XCircle className="w-4 h-4 ml-1" /> تعليق
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-success" onClick={() => setActionDialog({ type: 'reactivate', target: company })}>
                          <CheckCircle className="w-4 h-4 ml-1" /> إعادة تفعيل
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'note', target: company })}>
                        <FileText className="w-4 h-4 ml-1" /> ملاحظة
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Branch Requests Tab */}
        <TabsContent value="branch-requests">
          <div className="space-y-3">
            {branchRequests.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-xl border border-border">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد طلبات فروع</p>
              </div>
            ) : (
              branchRequests.map((req) => (
                <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-card rounded-xl border border-border shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{req.branch_name}</h3>
                      <p className="text-sm text-muted-foreground">{(req as any).merchant?.name} • {req.city || '—'}</p>
                      {req.notes && <p className="text-sm text-muted-foreground mt-1">{req.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(req.created_at), 'dd MMM yyyy', { locale: ar })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {statusBadge(req.status)}
                      {req.invoice_amount && (
                        <span className="text-sm font-medium">{req.invoice_amount} ر.س</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {req.status === 'pending_review' && (
                      <>
                        <Button size="sm" onClick={() => setActionDialog({ type: 'approve_branch', target: req })}>
                          <CheckCircle className="w-4 h-4 ml-1" /> موافقة
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setActionDialog({ type: 'reject_branch', target: req })}>
                          <XCircle className="w-4 h-4 ml-1" /> رفض
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setActionDialog({ type: 'invoice_branch', target: req })}>
                          <DollarSign className="w-4 h-4 ml-1" /> إصدار فاتورة
                        </Button>
                      </>
                    )}
                    {req.status === 'pending_payment' && (
                      <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => setActionDialog({ type: 'activate_branch', target: req })}>
                        <CheckCircle className="w-4 h-4 ml-1" /> تأكيد الدفع وتفعيل
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
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
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">{(payout as any).merchant?.name || '—'}</TableCell>
                        <TableCell className="font-semibold">{Number(payout.amount).toLocaleString()} ر.س</TableCell>
                        <TableCell className="text-muted-foreground">{Number(payout.platform_fee || 0).toLocaleString()} ر.س</TableCell>
                        <TableCell className="font-semibold text-primary">{Number(payout.net_amount || 0).toLocaleString()} ر.س</TableCell>
                        <TableCell>{payout.orders_count || 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {payout.period_from ? format(new Date(payout.period_from), 'dd/MM') : '—'}
                          {' - '}
                          {payout.period_to ? format(new Date(payout.period_to), 'dd/MM') : '—'}
                        </TableCell>
                        <TableCell>{statusBadge(payout.status || 'pending')}</TableCell>
                        <TableCell className="text-xs font-mono">{payout.reference_number || '—'}</TableCell>
                        <TableCell>
                          {payout.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => setActionDialog({ type: 'payout_complete', target: payout })}>
                                تأكيد
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                                onClick={() => setActionDialog({ type: 'payout_reject', target: payout })}>
                                رفض
                              </Button>
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
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan: Plan, i: number) => {
              const subscriberCount = companies.filter(c => c.subscription?.plan_id === plan.id).length;
              return (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl border border-border shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-foreground">{plan.name_ar}</h3>
                      <p className="text-sm text-muted-foreground">{plan.name}</p>
                    </div>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? 'نشطة' : 'معطلة'}
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold text-primary mb-4">{plan.price} <span className="text-sm font-normal text-muted-foreground">ر.س/شهر</span></p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">الفروع</span><span className="font-medium">{plan.branch_limit}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المستخدمين</span><span className="font-medium">{plan.user_limit}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">متجر إلكتروني</span><span>{plan.has_online_store ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">تقارير متقدمة</span><span>{plan.advanced_reports ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">دعم أولوية</span><span>{plan.priority_support ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</span></div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">مشتركين حاليين</span>
                      <Badge variant="secondary" className="text-sm">{subscriberCount}</Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity">
          {activityLogs.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا يوجد نشاط مسجل</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاجر</TableHead>
                      <TableHead>الإجراء</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{(log as any).merchant?.name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.entity_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets">
          {ticketsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : adminTickets.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <LifeBuoy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد تذاكر دعم</p>
            </div>
          ) : (
            <div className="space-y-3">
              {adminTickets.map((ticket) => {
                const statusColors: Record<string, string> = {
                  open: 'bg-blue-500/10 text-blue-700',
                  in_progress: 'bg-amber-500/10 text-amber-700',
                  resolved: 'bg-green-500/10 text-green-700',
                  closed: 'bg-muted text-muted-foreground',
                };
                const priorityColors: Record<string, string> = {
                  low: 'bg-muted text-muted-foreground',
                  normal: 'bg-blue-500/10 text-blue-700',
                  high: 'bg-amber-500/10 text-amber-700',
                  urgent: 'bg-destructive/10 text-destructive',
                };
                const priorityLabels: Record<string, string> = { low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' };
                const statusLabelsMap: Record<string, string> = { open: 'مفتوحة', in_progress: 'قيد المعالجة', resolved: 'تم الحل', closed: 'مغلقة' };

                return (
                  <div key={ticket.id} className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={statusColors[ticket.status] || ''}>{statusLabelsMap[ticket.status]}</Badge>
                          <Badge variant="outline" className={cn("text-xs", priorityColors[ticket.priority] || '')}>{priorityLabels[ticket.priority]}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {(ticket as any).merchant?.name || ''}
                          </span>
                        </div>
                        <h4 className="font-semibold text-foreground">{ticket.subject}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(ticket.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {ticket.status === 'open' && (
                          <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, 'in_progress')}>
                            قيد المعالجة
                          </Button>
                        )}
                        {ticket.status !== 'closed' && (
                          <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, 'closed')}>
                            إغلاق
                          </Button>
                        )}
                      </div>
                    </div>

                    {ticket.admin_reply && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-1 mb-1">
                          <MessageSquare className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium text-primary">ردك السابق</span>
                        </div>
                        <p className="text-sm">{ticket.admin_reply}</p>
                      </div>
                    )}

                    {replyingTicketId === ticket.id ? (
                      <div className="space-y-2">
                        <Textarea value={ticketReply} onChange={(e) => setTicketReply(e.target.value)}
                          placeholder="اكتب ردك هنا..." className="min-h-[80px]" />
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1" onClick={async () => {
                            if (!ticketReply.trim()) return;
                            await replyToTicket(ticket.id, ticketReply.trim(), 'resolved');
                            setTicketReply('');
                            setReplyingTicketId(null);
                          }}>
                            <Send className="w-3 h-3" /> إرسال وحل
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setReplyingTicketId(null); setTicketReply(''); }}>
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    ) : (
                      ticket.status !== 'closed' && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setReplyingTicketId(ticket.id)}>
                          <MessageSquare className="w-3 h-3" /> رد
                        </Button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setActionValue(''); setActionValue2(''); } }}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === 'upgrade' && 'ترقية الباقة'}
              {actionDialog?.type === 'extend' && 'تمديد الاشتراك'}
              {actionDialog?.type === 'suspend' && 'تعليق الاشتراك'}
              {actionDialog?.type === 'reactivate' && 'إعادة تفعيل الاشتراك'}
              {actionDialog?.type === 'note' && 'إضافة ملاحظة'}
              {actionDialog?.type === 'fee' && 'تعديل عمولة المنصة'}
              {actionDialog?.type === 'approve_branch' && 'موافقة على الطلب'}
              {actionDialog?.type === 'reject_branch' && 'رفض الطلب'}
              {actionDialog?.type === 'invoice_branch' && 'إصدار فاتورة'}
              {actionDialog?.type === 'activate_branch' && 'تأكيد الدفع وتفعيل الفرع'}
              {actionDialog?.type === 'payout_complete' && 'تأكيد الدفع'}
              {actionDialog?.type === 'payout_reject' && 'رفض الدفعة'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {actionDialog?.type === 'upgrade' && (
              <div className="space-y-2">
                <Label>اختر الباقة</Label>
                <Select value={actionValue} onValueChange={setActionValue}>
                  <SelectTrigger><SelectValue placeholder="اختر باقة" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p: Plan) => (
                      <SelectItem key={p.id} value={p.id}>{p.name_ar} - {p.price} ر.س</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {actionDialog?.type === 'extend' && (
              <div className="space-y-2">
                <Label>عدد الأيام</Label>
                <Input type="number" value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="30" />
              </div>
            )}
            {actionDialog?.type === 'fee' && (
              <div className="space-y-2">
                <Label>نسبة العمولة (%)</Label>
                <Input type="number" value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="5" step="0.5" />
                <p className="text-xs text-muted-foreground">النسبة الحالية: {actionDialog.target.platform_fee_percentage || 5}%</p>
              </div>
            )}
            {(actionDialog?.type === 'suspend' || actionDialog?.type === 'reactivate' || actionDialog?.type === 'approve_branch' || actionDialog?.type === 'activate_branch' || actionDialog?.type === 'payout_reject') && (
              <p className="text-muted-foreground">هل أنت متأكد من هذا الإجراء؟</p>
            )}
            {(actionDialog?.type === 'note' || actionDialog?.type === 'reject_branch') && (
              <div className="space-y-2">
                <Label>{actionDialog.type === 'note' ? 'الملاحظة' : 'سبب الرفض'}</Label>
                <Textarea value={actionValue} onChange={(e) => setActionValue(e.target.value)} />
              </div>
            )}
            {actionDialog?.type === 'invoice_branch' && (
              <div className="space-y-2">
                <Label>مبلغ الفاتورة (ر.س)</Label>
                <Input type="number" value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="500" />
              </div>
            )}
            {actionDialog?.type === 'payout_complete' && (
              <div className="space-y-2">
                <Label>رقم المرجع / التحويل</Label>
                <Input value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="REF-xxxx" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setActionValue(''); setActionValue2(''); }}>إلغاء</Button>
            <Button onClick={handleAction} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
