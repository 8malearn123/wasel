import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Users, CreditCard, DollarSign, Smartphone, Globe,
  TrendingUp, Wrench, Activity, Shield, Loader2, AlertTriangle,
  CheckCircle, XCircle, Clock, ArrowUpRight, LifeBuoy,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useAdminTickets } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

export default function AdminDashboardPage() {
  const {
    companies, branchRequests, platformStats, activityLogs, payouts,
    fetchCompanies, fetchBranchRequests, fetchActivityLogs, fetchPayouts,
    isPlatformAdmin, loading: adminLoading,
  } = usePlatformAdmin();
  const { tickets: adminTickets } = useAdminTickets();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) {
      navigate('/auth');
      return;
    }
    Promise.all([fetchCompanies(), fetchBranchRequests(), fetchActivityLogs(), fetchPayouts()])
      .then(() => setLoaded(true));
  }, [isPlatformAdmin, adminLoading]);

  const stats = platformStats;

  // Subscription distribution for pie chart
  const subDistribution = useMemo(() => [
    { name: 'نشط', value: stats.activeSubs, color: 'hsl(142, 70%, 40%)' },
    { name: 'تجريبي', value: stats.trialSubs, color: 'hsl(38, 95%, 50%)' },
    { name: 'منتهي/موقوف', value: stats.expiredSubs, color: 'hsl(0, 72%, 51%)' },
  ].filter(d => d.value > 0), [stats]);

  // Top merchants by sales
  const topMerchants = useMemo(() =>
    [...companies].sort((a, b) => b.sales_total - a.sales_total).slice(0, 5),
    [companies]
  );

  // Recent signups
  const recentCompanies = useMemo(() =>
    [...companies].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [companies]
  );

  // Pending items
  const pendingBranch = branchRequests.filter(r => r.status === 'pending_review' || r.status === 'pending_payment');
  const openTickets = adminTickets.filter(t => t.status === 'open');
  const pendingPayoutsList = payouts.filter(p => p.status === 'pending');

  if (!loaded || adminLoading) {
    return (
      <AdminLayout title="نظرة عامة">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { icon: Building2, label: 'إجمالي الشركات', value: stats.totalMerchants, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: CheckCircle, label: 'اشتراكات نشطة', value: stats.activeSubs, color: 'text-success', bg: 'bg-success/10' },
    { icon: Clock, label: 'تجريبي', value: stats.trialSubs, color: 'text-warning', bg: 'bg-warning/10' },
    { icon: XCircle, label: 'منتهي/موقوف', value: stats.expiredSubs, color: 'text-destructive', bg: 'bg-destructive/10' },
    { icon: DollarSign, label: 'إجمالي المبيعات', value: `${(stats.totalRevenue / 1000).toFixed(0)}K ر.س`, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Smartphone, label: 'إجمالي الأجهزة', value: stats.totalDevices, color: 'text-accent-foreground', bg: 'bg-accent/10' },
    { icon: Wrench, label: 'إجمالي الإصلاحات', value: stats.totalRepairs, color: 'text-warning', bg: 'bg-warning/10' },
    { icon: TrendingUp, label: 'انضموا هذا الأسبوع', value: stats.recentSignups, color: 'text-success', bg: 'bg-success/10' },
  ];

  return (
    <AdminLayout title="نظرة عامة" subtitle="ملخص شامل لأداء المنصة">
      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {statCards.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", stat.bg)}>
                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Top Merchants */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              أعلى الشركات مبيعاً
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topMerchants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topMerchants} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ر.س`, 'المبيعات']} />
                  <Bar dataKey="sales_total" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Subscription Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              توزيع الاشتراكات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={subDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} strokeWidth={2} stroke="hsl(var(--card))">
                    {subDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v: number) => [v, 'شركة']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Items Row */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Pending Branch Requests */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                طلبات فروع معلقة
              </CardTitle>
              {pendingBranch.length > 0 && <Badge variant="destructive">{pendingBranch.length}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {pendingBranch.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبات معلقة ✓</p>
            ) : (
              <div className="space-y-3">
                {pendingBranch.slice(0, 3).map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{req.branch_name}</p>
                      <p className="text-xs text-muted-foreground">{(req as any).merchant?.name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{req.status === 'pending_review' ? 'مراجعة' : 'دفع'}</Badge>
                  </div>
                ))}
                {pendingBranch.length > 3 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/admin/branch-requests')}>
                    عرض الكل ({pendingBranch.length})
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Tickets */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-primary" />
                تذاكر مفتوحة
              </CardTitle>
              {openTickets.length > 0 && <Badge variant="destructive">{openTickets.length}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {openTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد تذاكر مفتوحة ✓</p>
            ) : (
              <div className="space-y-3">
                {openTickets.slice(0, 3).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">{(t as any).merchant?.name}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs flex-shrink-0",
                      t.priority === 'urgent' ? 'bg-destructive/10 text-destructive' :
                      t.priority === 'high' ? 'bg-warning/10 text-warning' : ''
                    )}>
                      {t.priority === 'urgent' ? 'عاجل' : t.priority === 'high' ? 'عالي' : 'عادي'}
                    </Badge>
                  </div>
                ))}
                {openTickets.length > 3 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/admin/tickets')}>
                    عرض الكل ({openTickets.length})
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Payouts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success" />
                مدفوعات معلقة
              </CardTitle>
              {pendingPayoutsList.length > 0 && <Badge variant="destructive">{pendingPayoutsList.length}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {pendingPayoutsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد مدفوعات معلقة ✓</p>
            ) : (
              <div className="space-y-3">
                {pendingPayoutsList.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{(p as any).merchant?.name}</p>
                      <p className="text-xs text-muted-foreground">{Number(p.net_amount || 0).toLocaleString()} ر.س</p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning">معلق</Badge>
                  </div>
                ))}
                {pendingPayoutsList.length > 3 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/admin/payouts')}>
                    عرض الكل ({pendingPayoutsList.length})
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Signups + Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Companies */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              آخر الشركات المسجلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCompanies.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/companies`)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), 'dd MMM', { locale: ar })}</p>
                    {c.subscription && (
                      <Badge variant="outline" className={cn("text-[10px]",
                        c.subscription.status === 'active' ? 'bg-success/10 text-success' :
                        c.subscription.status === 'trial' ? 'bg-warning/10 text-warning' : ''
                      )}>
                        {c.subscription.status === 'active' ? 'نشط' : c.subscription.status === 'trial' ? 'تجريبي' : c.subscription.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              آخر النشاطات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLogs.slice(0, 6).map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{(log as any).merchant?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{log.action} • {log.entity_type}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'HH:mm dd/MM')}</p>
                </div>
              ))}
              {activityLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">لا يوجد نشاط</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
