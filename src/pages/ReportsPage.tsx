import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package, Smartphone, 
  Building2, Calendar, Loader2, Wrench, AlertTriangle, Download, Archive, Users
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from '@/hooks/useTabParam';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useReports } from "@/hooks/useReports";
import { useRepairPartsReport } from "@/hooks/useRepairPartsReport";
import { toast } from "@/hooks/use-toast";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

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

export default function ReportsPage() {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useTabParam('sales');
  const { t, isRTL } = useLanguage();
  const r = t.reports;
  const { 
    loading, getDailySalesReport, getMonthlySalesReport, 
    getInventoryReport, getBranchReport, getProfitByDevice, getSummaryStats,
    getEmployeePerformance,
    devices, accessories, salesData
  } = useReports();
  const partsReport = useRepairPartsReport();

  const dailyData = getDailySalesReport(14);
  const monthlyData = getMonthlySalesReport(6);
  const inventory = getInventoryReport();
  const branchReport = getBranchReport();
  const profitByDevice = getProfitByDevice().slice(0, 10);
  const stats = getSummaryStats();
  const chartData = period === 'daily' ? dailyData : monthlyData;
  const employeeData = getEmployeePerformance();

  const inventoryPieData = [
    { name: r.available, value: inventory.availableDevices },
    { name: r.reserved, value: inventory.reservedDevices },
    { name: r.soldStatus, value: inventory.soldDevices }
  ].filter(d => d.value > 0);

  const getDeadStock = useCallback(() => {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const deviceLastSale: Record<string, Date> = {};
    for (const sale of salesData) {
      for (const item of (sale.items || [])) {
        if (item.device_id) {
          const saleDate = new Date(sale.sale_date);
          if (!deviceLastSale[item.device_id] || saleDate > deviceLastSale[item.device_id]) {
            deviceLastSale[item.device_id] = saleDate;
          }
        }
      }
    }
    const modelLastSale: Record<string, Date> = {};
    for (const [deviceId, lastSale] of Object.entries(deviceLastSale)) {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        const key = `${device.brand}-${device.model}`;
        if (!modelLastSale[key] || lastSale > modelLastSale[key]) {
          modelLastSale[key] = lastSale;
        }
      }
    }
    return devices
      .filter(d => d.status === 'available')
      .map(d => {
        const key = `${d.brand}-${d.model}`;
        const lastSale = modelLastSale[key];
        const daysSince = lastSale ? Math.floor((now.getTime() - lastSale.getTime()) / (24 * 60 * 60 * 1000)) : null;
        return { ...d, daysSinceLastSale: daysSince };
      })
      .filter(d => d.daysSinceLastSale === null || d.daysSinceLastSale >= 60)
      .sort((a, b) => (b.daysSinceLastSale ?? 999) - (a.daysSinceLastSale ?? 999));
  }, [devices, salesData]);

  const getLowStockItems = useCallback(() => {
    return accessories.filter(a => a.quantity <= a.min_quantity).sort((a, b) => a.quantity - b.quantity);
  }, [accessories]);

  const handleExportSales = () => {
    const data = chartData.map(d => ({
      Date: d.date, Revenue: d.totalRevenue, Cost: d.totalCost, Profit: d.profit, Devices: d.devicesSold,
    }));
    exportToCSV(data, 'sales-report');
    toast({ title: r.exportSuccess });
  };

  const handleExportInventory = () => {
    const items = [
      ...devices.filter(d => d.status === 'available').map(d => ({
        Type: 'Device', Name: `${d.brand} ${d.model}`, IMEI: d.imei, Cost: d.cost, Price: d.price, Status: d.status,
      })),
      ...accessories.map(a => ({
        Type: 'Accessory', Name: a.name, IMEI: a.sku, Cost: a.cost, Price: a.price, Status: a.quantity > a.min_quantity ? 'OK' : 'Low',
      }))
    ];
    exportToCSV(items, 'inventory-report');
    toast({ title: r.exportSuccess });
  };

  const handleExportEmployees = () => {
    exportToCSV(employeeData.map(e => ({
      Name: e.userName, Sales: e.totalSales, Revenue: e.totalRevenue, Profit: e.totalProfit, AvgSale: e.avgSaleValue
    })), 'employee-performance');
    toast({ title: r.exportSuccess });
  };

  const fmtCurrency = (val: number) => `${val.toLocaleString()} ${r.currency}`;

  const StatCard = ({ label, value, sub, icon: Icon, iconColor = 'text-primary', bgColor = 'bg-primary/10', delay = 0 }: any) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="p-4 rounded-xl bg-card border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", bgColor)}>
          <Icon className={cn("w-6 h-6", iconColor)} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <AppLayout title={r.title} subtitle={r.subtitle}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        </div>

        {/* SALES TAB */}
        <TabsContent value="sales">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard label={r.todayRevenue} value={fmtCurrency(stats.todayRevenue)}
                  sub={`+${fmtCurrency(stats.todayProfit)} ${r.profit}`}
                  icon={DollarSign} iconColor="text-primary" bgColor="bg-primary/10" />
                <StatCard label={r.monthlyRevenue} value={fmtCurrency(stats.thisMonthRevenue)}
                  sub={
                    <span className={cn("flex items-center gap-1", stats.revenueChange >= 0 ? "text-primary" : "text-destructive")}>
                      {stats.revenueChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange.toFixed(1)}% {r.changeFromLastMonth}
                    </span>
                  }
                  icon={BarChart3} iconColor="text-primary" bgColor="bg-primary/10" delay={0.05} />
                <StatCard label={r.inventoryValue} value={fmtCurrency(stats.inventoryValue)}
                  sub={`${stats.availableDevices} ${r.devices}`}
                  icon={Smartphone} iconColor="text-accent-foreground" bgColor="bg-accent/10" delay={0.1} />
                <StatCard label={r.lowStockItems} value={stats.lowStockItems}
                  sub={r.needsRestock}
                  icon={Package} iconColor="text-destructive" bgColor="bg-destructive/10" delay={0.15} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2 mb-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="bg-card rounded-xl border border-border p-6 shadow-md">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-foreground">{r.salesOverview}</h3>
                    <div className="flex gap-2">
                      <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">{r.daily}</SelectItem>
                          <SelectItem value="monthly">{r.monthly}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={handleExportSales}><Download className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12}
                          tickFormatter={(v) => period === 'daily' ? v.slice(5) : v} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="totalRevenue" name={r.revenue} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="profit" name={r.profit} stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="bg-card rounded-xl border border-border p-6 shadow-md">
                  <h3 className="font-semibold text-foreground mb-6">{r.deviceStatus}</h3>
                  <div className="h-64 flex items-center justify-center">
                    {inventoryPieData.length === 0 ? (
                      <p className="text-muted-foreground">{r.noData}</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={inventoryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                            paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                            {inventoryPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="bg-card rounded-xl border border-border p-6 shadow-md">
                  <h3 className="font-semibold text-foreground mb-6">{r.branchPerformance}</h3>
                  {branchReport.length === 0 ? (
                    <p className="text-muted-foreground text-center py-10">{r.noBranchData}</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={branchReport} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis type="category" dataKey="branchName" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                          <Bar dataKey="totalRevenue" name={r.revenue} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="bg-card rounded-xl border border-border p-6 shadow-md">
                  <h3 className="font-semibold text-foreground mb-6">{r.topProfitDevices}</h3>
                  {profitByDevice.length === 0 ? (
                    <p className="text-muted-foreground text-center py-10">{r.noSalesData}</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {profitByDevice.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                            <div>
                              <p className="font-medium text-foreground text-sm">{item.model}</p>
                              <p className="text-xs text-muted-foreground">{item.brand} · {item.unitsSold} {r.sold}</p>
                            </div>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-primary">{fmtCurrency(item.profit)}</p>
                            <p className="text-xs text-muted-foreground">{item.margin.toFixed(1)}% {r.margin}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </>
          )}
        </TabsContent>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <Button variant="outline" onClick={handleExportInventory} className="gap-2">
                  <Download className="w-4 h-4" /> {r.exportCSV}
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard label={r.totalDevices} value={inventory.totalDevices}
                  sub={`${inventory.availableDevices} ${r.available}`}
                  icon={Smartphone} iconColor="text-primary" bgColor="bg-primary/10" />
                <StatCard label={r.deviceValue} value={fmtCurrency(inventory.deviceValue)}
                  icon={DollarSign} iconColor="text-primary" bgColor="bg-primary/10" delay={0.05} />
                <StatCard label={r.totalAccessories} value={inventory.totalAccessories}
                  sub={`${inventory.lowStockAccessories} ${r.lowStock}`}
                  icon={Package} iconColor="text-accent-foreground" bgColor="bg-accent/10" delay={0.1} />
                <StatCard label={r.accessoryValue} value={fmtCurrency(inventory.accessoryValue)}
                  icon={DollarSign} iconColor="text-accent-foreground" bgColor="bg-accent/10" delay={0.15} />
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-card rounded-xl border border-border shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">{r.lowStockItems}</h3>
                </div>
                {getLowStockItems().length === 0 ? (
                  <div className="text-center py-16">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{r.noData}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.itemName}</th>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.currentStock}</th>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.minStock}</th>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.stockStatus}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {getLowStockItems().map(item => (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="px-6 py-4 font-medium text-foreground">{item.name}</td>
                            <td className="px-6 py-4 font-semibold text-foreground">{item.quantity}</td>
                            <td className="px-6 py-4 text-muted-foreground">{item.min_quantity}</td>
                            <td className="px-6 py-4">
                              {item.quantity === 0 ? <Badge variant="destructive">{r.outOfStock}</Badge> : <Badge variant="secondary">{r.lowStock}</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </TabsContent>

        {/* EMPLOYEE PERFORMANCE TAB */}
        <TabsContent value="employees">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{isRTL ? "أداء الموظفين" : "Employee Performance"}</h2>
                  <p className="text-sm text-muted-foreground">{isRTL ? "تحليل أداء المبيعات لكل موظف" : "Sales performance analysis per employee"}</p>
                </div>
                <Button variant="outline" onClick={handleExportEmployees} className="gap-2">
                  <Download className="w-4 h-4" /> {r.exportCSV}
                </Button>
              </div>

              {employeeData.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-card rounded-xl border border-border p-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{r.noSalesData}</p>
                </motion.div>
              ) : (
                <>
                  {/* Employee Stats Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                    {employeeData.slice(0, 3).map((emp, i) => (
                      <motion.div key={emp.userId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="p-5 rounded-xl bg-card border border-border shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                            i === 0 ? "bg-primary/20 text-primary" : i === 1 ? "bg-muted text-muted-foreground" : "bg-accent/20 text-accent-foreground"
                          )}>#{i + 1}</div>
                          <div>
                            <p className="font-semibold text-foreground">{emp.userName}</p>
                            <p className="text-xs text-muted-foreground">{emp.totalSales} {isRTL ? "عملية بيع" : "sales"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">{r.revenue}</p>
                            <p className="font-bold text-primary">{fmtCurrency(emp.totalRevenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{r.profit}</p>
                            <p className="font-bold text-primary">{fmtCurrency(emp.totalProfit)}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Employee Chart */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-card rounded-xl border border-border p-6 shadow-md mb-6">
                    <h3 className="font-semibold text-foreground mb-6">{isRTL ? "مقارنة إيرادات الموظفين" : "Employee Revenue Comparison"}</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={employeeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="userName" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                          <Bar dataKey="totalRevenue" name={r.revenue} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="totalProfit" name={r.profit} fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  {/* Employee Table */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-card rounded-xl border border-border shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">#</th>
                            <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{isRTL ? "الموظف" : "Employee"}</th>
                            <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{isRTL ? "عدد المبيعات" : "Sales"}</th>
                            <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.revenue}</th>
                            <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.profit}</th>
                            <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.margin}</th>
                            <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{isRTL ? "متوسط الفاتورة" : "Avg Sale"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {employeeData.map((emp, i) => (
                            <tr key={emp.userId} className="hover:bg-muted/20">
                              <td className="px-6 py-4">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                              </td>
                              <td className="px-6 py-4 font-medium text-foreground">{emp.userName}</td>
                              <td className="px-6 py-4 font-semibold text-foreground">{emp.totalSales}</td>
                              <td className="px-6 py-4 text-foreground">{fmtCurrency(emp.totalRevenue)}</td>
                              <td className="px-6 py-4 font-semibold text-primary">{fmtCurrency(emp.totalProfit)}</td>
                              <td className="px-6 py-4 text-foreground">{emp.margin.toFixed(1)}%</td>
                              <td className="px-6 py-4 text-muted-foreground">{fmtCurrency(emp.avgSaleValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* DEAD STOCK TAB */}
        <TabsContent value="deadstock">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">{r.deadStockTitle}</h2>
                <p className="text-sm text-muted-foreground">{r.deadStockDesc}</p>
              </div>
              {getDeadStock().length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-card rounded-xl border border-border p-12 text-center">
                  <Archive className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{r.noDeadStock}</p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-xl border border-border shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">#</th>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">IMEI</th>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.itemName}</th>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.cost}</th>
                          <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.daysSinceLastSale}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {getDeadStock().map((d, i) => (
                          <tr key={d.id} className="hover:bg-muted/20">
                            <td className="px-6 py-4 text-muted-foreground">{i + 1}</td>
                            <td className="px-6 py-4"><code className="text-sm font-mono bg-muted px-2 py-1 rounded">{d.imei}</code></td>
                            <td className="px-6 py-4 font-medium text-foreground">{d.brand} {d.model}</td>
                            <td className="px-6 py-4 text-foreground">{fmtCurrency(Number(d.cost))}</td>
                            <td className="px-6 py-4">
                              {d.daysSinceLastSale === null ? (
                                <Badge variant="destructive">{r.neverSold}</Badge>
                              ) : (
                                <Badge variant="secondary">{d.daysSinceLastSale} {isRTL ? 'يوم' : 'days'}</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </TabsContent>

        {/* PARTS TAB */}
        <TabsContent value="parts">
          <PartsConsumptionReport report={partsReport} r={r} fmtCurrency={fmtCurrency} isRTL={isRTL} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function PartsConsumptionReport({ report, r, fmtCurrency, isRTL }: { report: ReturnType<typeof useRepairPartsReport>; r: any; fmtCurrency: (v: number) => string; isRTL: boolean }) {
  const { loading, getConsumptionByPart, getDailyUsage, getSummary } = report;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const consumption = getConsumptionByPart();
  const dailyUsage = getDailyUsage(14);
  const summary = getSummary();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{r.totalPartsUsed}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{summary.totalPartsUsed}</p>
              <p className="text-sm text-muted-foreground mt-1">{r.inRepairs.replace('{0}', summary.totalRepairsWithParts)}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Wrench className="w-6 h-6 text-primary" /></div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{r.totalPartsCost}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{fmtCurrency(summary.totalCost)}</p>
              <p className="text-sm text-muted-foreground mt-1">{r.avgPerRepair} {fmtCurrency(summary.avgCostPerRepair)}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="w-6 h-6 text-primary" /></div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{r.lowStockParts}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{summary.lowStockCount}</p>
              <p className="text-sm text-muted-foreground mt-1">{r.belowMinimum}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-destructive" /></div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{r.outOfStockParts}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{summary.outOfStockCount}</p>
              <p className="text-sm text-destructive mt-1">{r.unavailable}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center"><Package className="w-6 h-6 text-destructive" /></div>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-6 shadow-md">
          <h3 className="font-semibold text-foreground mb-6">{r.dailyPartsUsage}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value} ${r.pieces}`, r.part]} />
                <Bar dataKey="totalParts" name={r.part} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border p-6 shadow-md">
          <h3 className="font-semibold text-foreground mb-6">{r.dailyPartsCost}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number) => [fmtCurrency(value), r.cost]} />
                <Line type="monotone" dataKey="totalCost" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-card rounded-xl border border-border shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{r.partsConsumptionDetails}</h3>
          <p className="text-sm text-muted-foreground">{r.sortedByUsage}</p>
        </div>
        {consumption.length === 0 ? (
          <div className="text-center py-16">
            <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{r.noPartsUsed}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">#</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.part}</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">SKU</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.quantityUsed}</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.totalCostLabel}</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground text-start">{r.repairCount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {consumption.map((item, index) => (
                  <motion.tr key={item.partSku} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.03 }}
                    className="hover:bg-muted/20">
                    <td className="px-6 py-4">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{index + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center"><Wrench className="w-4 h-4 text-accent-foreground" /></div>
                        <span className="font-medium text-foreground">{item.partName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><code className="text-sm font-mono bg-muted px-2 py-1 rounded">{item.partSku}</code></td>
                    <td className="px-6 py-4 font-semibold text-foreground">{item.totalUsed}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{fmtCurrency(item.totalCost)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{item.repairCount}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </>
  );
}
