import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, DollarSign, Building2, ShoppingBag, Wrench, Smartphone, Download } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const fmtMoney = (n: number) => new Intl.NumberFormat('ar-SA').format(Math.round(n)) + ' ر.س';

export default function AdminReportsPage() {
  const {
    companies, payouts, platformStats,
    fetchCompanies, fetchPayouts,
    isPlatformAdmin, loading: adminLoading,
  } = usePlatformAdmin();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (adminLoading) return;
    if (!isPlatformAdmin) { navigate('/auth'); return; }
    Promise.all([fetchCompanies(), fetchPayouts()]).then(() => setLoaded(true));
  }, [isPlatformAdmin, adminLoading]);

  const topMerchantsBySales = useMemo(() => {
    return [...companies]
      .sort((a, b) => b.sales_total - a.sales_total)
      .slice(0, 10)
      .map(c => ({ name: c.name, sales: c.sales_total, devices: c.device_count, repairs: c.repair_count }));
  }, [companies]);

  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    companies.forEach(c => {
      const p = c.subscription?.plan || 'غير محدد';
      counts[p] = (counts[p] || 0) + 1;
    });
    const palette = ['hsl(180, 70%, 40%)', 'hsl(38, 95%, 50%)', 'hsl(265, 70%, 55%)', 'hsl(142, 70%, 40%)', 'hsl(0, 72%, 55%)'];
    return Object.entries(counts).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, [companies]);

  const signupTrend = useMemo(() => {
    const buckets: Record<string, number> = {};
    companies.forEach(c => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [companies]);

  const payoutsSummary = useMemo(() => {
    const total = payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
    const fees = payouts.reduce((s, p) => s + Number(p.platform_fee || 0), 0);
    const net = payouts.reduce((s, p) => s + Number(p.net_amount || 0), 0);
    const pending = payouts.filter(p => p.status === 'pending').length;
    const completed = payouts.filter(p => p.status === 'completed').length;
    return { total, fees, net, pending, completed };
  }, [payouts]);

  const exportCSV = () => {
    const rows = [
      ['الشركة', 'الباقة', 'الحالة', 'الفروع', 'المستخدمون', 'الأجهزة', 'الصيانة', 'إجمالي المبيعات'],
      ...companies.map(c => [
        c.name,
        c.subscription?.plan || '-',
        c.subscription?.status || '-',
        c.branch_count, c.user_count, c.device_count, c.repair_count,
        Math.round(c.sales_total),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (adminLoading || !loaded) {
    return (
      <AdminLayout title="التقارير">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const kpis = [
    { label: 'إجمالي الشركات', value: platformStats.totalMerchants, icon: Building2, color: 'text-primary' },
    { label: 'إجمالي المبيعات', value: fmtMoney(platformStats.totalRevenue), icon: DollarSign, color: 'text-success' },
    { label: 'الأجهزة المسجلة', value: platformStats.totalDevices, icon: Smartphone, color: 'text-warning' },
    { label: 'طلبات الصيانة', value: platformStats.totalRepairs, icon: Wrench, color: 'text-accent' },
    { label: 'الطلبات الإلكترونية', value: platformStats.totalOnlineOrders, icon: ShoppingBag, color: 'text-primary' },
    { label: 'صافي الدفعات', value: fmtMoney(payoutsSummary.net), icon: TrendingUp, color: 'text-success' },
  ];

  return (
    <AdminLayout title="التقارير" subtitle="نظرة شاملة على أداء المنصة">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> تصدير CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <k.icon className={`w-5 h-5 mb-2 ${k.color}`} />
                  <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                  <p className="text-lg font-bold">{k.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList>
            <TabsTrigger value="sales">المبيعات</TabsTrigger>
            <TabsTrigger value="growth">نمو المنصة</TabsTrigger>
            <TabsTrigger value="plans">توزيع الباقات</TabsTrigger>
            <TabsTrigger value="payouts">الدفعات</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>أعلى 10 شركات حسب المبيعات</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={topMerchantsBySales}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>تفاصيل الشركات</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الشركة</TableHead>
                      <TableHead>الباقة</TableHead>
                      <TableHead>الفروع</TableHead>
                      <TableHead>الأجهزة</TableHead>
                      <TableHead>الصيانة</TableHead>
                      <TableHead>المبيعات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.slice(0, 20).map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.subscription?.plan || '-'}</TableCell>
                        <TableCell>{c.branch_count}</TableCell>
                        <TableCell>{c.device_count}</TableCell>
                        <TableCell>{c.repair_count}</TableCell>
                        <TableCell>{fmtMoney(c.sales_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="growth">
            <Card>
              <CardHeader><CardTitle>تسجيلات الشركات (آخر 12 شهرًا)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={signupTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans">
            <Card>
              <CardHeader><CardTitle>توزيع الباقات</CardTitle></CardHeader>
              <CardContent>
                {planDistribution.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie data={planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                        {planDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">إجمالي الدفعات</p><p className="text-lg font-bold">{fmtMoney(payoutsSummary.total)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">رسوم المنصة</p><p className="text-lg font-bold">{fmtMoney(payoutsSummary.fees)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">معلقة</p><p className="text-lg font-bold">{payoutsSummary.pending}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">مكتملة</p><p className="text-lg font-bold">{payoutsSummary.completed}</p></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
