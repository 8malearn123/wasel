import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useLanguage } from "@/i18n";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import type { DailySalesData } from "@/hooks/useDashboardData";

interface SalesChartProps {
  data: DailySalesData[];
  loading: boolean;
}

export function SalesChart({ data, loading }: SalesChartProps) {
  const { t, isRTL } = useLanguage();
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-card rounded-xl border border-border p-6 shadow-md"
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t.dashboard.salesOverview}</h3>
          <p className="text-sm text-muted-foreground">{t.dashboard.last7Days}</p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as "area" | "bar")}>
            <TabsList className="h-8">
              <TabsTrigger value="area" className="text-xs px-3 h-7">{isRTL ? "مساحي" : "Area"}</TabsTrigger>
              <TabsTrigger value="bar" className="text-xs px-3 h-7">{isRTL ? "أعمدة" : "Bar"}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">{t.dashboard.revenue}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-sm text-muted-foreground">{t.dashboard.sales}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي الإيرادات" : "Total Revenue"}</p>
            <p className="text-lg font-bold text-foreground">
              {data.reduce((s, d) => s + d.revenue, 0).toLocaleString()} <span className="text-xs">ر.س</span>
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/5 border border-accent/10">
            <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي المبيعات" : "Total Sales"}</p>
            <p className="text-lg font-bold text-foreground">
              {data.reduce((s, d) => s + d.count, 0)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-success/5 border border-success/10">
            <p className="text-xs text-muted-foreground">{isRTL ? "متوسط يومي" : "Daily Avg"}</p>
            <p className="text-lg font-bold text-foreground">
              {Math.round(data.reduce((s, d) => s + d.revenue, 0) / (data.length || 1)).toLocaleString()} <span className="text-xs">ر.س</span>
            </p>
          </div>
        </div>
      )}

      <div className="h-[280px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "area" ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(345, 75%, 52%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(345, 75%, 52%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38, 95%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(38, 95%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} ${name === 'revenue' ? 'ر.س' : ''}`,
                    name === 'revenue' ? (isRTL ? 'الإيرادات' : 'Revenue') : (isRTL ? 'عدد المبيعات' : 'Sales Count')
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(345, 75%, 52%)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="count" stroke="hsl(38, 95%, 50%)" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} ${name === 'revenue' ? 'ر.س' : ''}`,
                    name === 'revenue' ? (isRTL ? 'الإيرادات' : 'Revenue') : (isRTL ? 'عدد المبيعات' : 'Sales Count')
                  ]}
                />
                <Bar dataKey="revenue" fill="hsl(345, 75%, 52%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="count" fill="hsl(38, 95%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
