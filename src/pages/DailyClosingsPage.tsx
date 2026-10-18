import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useDailyClosings, toDaySalesData, type DaySummary } from "@/hooks/useDailyClosings";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Banknote, CreditCard, Building2, ShoppingBag, Smartphone, Package,
  CheckCircle, Clock, Calculator, FileText, Printer, Download,
  TrendingUp, TrendingDown, Receipt, Award, Activity, ArrowLeftRight, AlertTriangle, Lock,
} from "lucide-react";
import { format, subDays } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { paymentMethodLabel } from "@/lib/payments";
import { toast } from "sonner";

export default function DailyClosingsPage() {
  const { isRTL } = useLanguage();
  const { merchant, currentBranch, user } = useAuth();
  const { closings, loading, fetchDaySummary, closeDay } = useDailyClosings();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  // The day = sum of the branch's shifts for that business day (daily_summary RPC).
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<DaySummary | null>(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [notes, setNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  const daySales = useMemo(() => (summary ? toDaySalesData(summary) : null), [summary]);
  const prevSales = useMemo(() => (prevSummary ? toDaySalesData(prevSummary) : null), [prevSummary]);
  const existingClosing = summary?.closing?.status === 'closed' ? summary.closing : null;

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, currentBranch?.id]);

  const loadData = async () => {
    setLoadingSales(true);
    const prevDate = format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd');
    const [today, prev] = await Promise.all([
      fetchDaySummary(selectedDate),
      fetchDaySummary(prevDate),
    ]);
    setSummary(today);
    setPrevSummary(prev);
    setLoadingSales(false);
  };

  const handleClose = async () => {
    if (!summary?.can_close) return;
    setIsClosing(true);
    const closed = await closeDay(selectedDate, notes);
    if (closed) setSummary(closed);
    if (closed && (merchant as { auto_print_closing?: boolean } | null)?.auto_print_closing) {
      const printResult = printReceipt(closed, notes);
      if (printResult.ok) {
        toast.success(isRTL ? "تمت طباعة إيصال الإغلاق تلقائياً" : "Closing receipt printed automatically");
      } else {
        toast.error(
          isRTL ? "تعذّرت الطباعة التلقائية" : "Auto-print failed",
          { description: printResult.reason }
        );
      }
    }
    setNotes('');
    setIsClosing(false);
  };

  const printReceipt = (day: DaySummary, noteText: string): { ok: boolean; reason?: string } => {
    const daySales = toDaySalesData(day);
    const w = window.open('', '_blank', 'width=400,height=700');
    if (!w) return { ok: false, reason: isRTL ? "تم حظر النافذة المنبثقة من المتصفح" : "Browser blocked popup window" };
    const cash = day.cash;
    const line = (l: string, r: string, bold = false) =>
      `<div class="row${bold ? ' b' : ''}"><span>${l}</span><span>${r}</span></div>`;
    const html = `<!doctype html><html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}"><head>
<meta charset="utf-8"><title>${isRTL ? 'تقرير الإغلاق' : 'Closing Report'} ${selectedDate}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', system-ui, -apple-system, sans-serif; width: 72mm; margin: 0 auto; padding: 4px; color: #000; font-size: 12px; line-height: 1.5; }
  .center { text-align: center; }
  h1 { font-size: 16px; margin: 4px 0; }
  h2 { font-size: 13px; margin: 8px 0 4px; border-bottom: 1px dashed #000; padding-bottom: 2px; }
  .meta { font-size: 11px; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  .row.b { font-weight: 700; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .total { border: 2px solid #000; padding: 6px; margin: 6px 0; text-align: center; font-weight: 700; font-size: 14px; }
  .small { font-size: 10px; color: #333; }
  .footer { text-align: center; margin-top: 10px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { padding: 2px 0; text-align: ${isRTL ? 'right' : 'left'}; }
  th { border-bottom: 1px solid #000; }
</style></head><body>
  <div class="center">
    <h1>${merchant?.name || ''}</h1>
    <div class="meta">${currentBranch?.name || ''}</div>
    <h2 style="border:none;margin:6px 0;">${isRTL ? 'تقرير الإغلاق اليومي' : 'Daily Closing Report'}</h2>
    <div class="meta">${selectedDate} • ${format(new Date(), 'HH:mm')}</div>
  </div>
  <div class="sep"></div>

  <h2>${isRTL ? 'الملخص' : 'Summary'}</h2>
  ${line(isRTL ? 'عدد الفواتير' : 'Invoices', String(daySales.transactionsCount))}
  ${line(isRTL ? 'الأجهزة المباعة' : 'Devices Sold', String(daySales.devicesSold))}
  ${line(isRTL ? 'الإكسسوارات' : 'Accessories', String(daySales.accessoriesSold))}
  ${peakHour ? line(isRTL ? 'ساعة الذروة' : 'Peak Hour', peakHour.hour) : ''}

  <h2>${isRTL ? 'طرق الدفع' : 'Payment Methods'}</h2>
  ${line(isRTL ? 'كاش' : 'Cash', formatCurrency(daySales.cashTotal))}
  ${line(isRTL ? 'بطاقة / مدى' : 'Card', formatCurrency(daySales.cardTotal))}
  ${line(isRTL ? 'تحويل بنكي' : 'Bank Transfer', formatCurrency(daySales.bankTransferTotal))}

  <h2>${isRTL ? 'الإجماليات' : 'Totals'}</h2>
  ${line(isRTL ? 'الصافي' : 'Net', formatCurrency(daySales.totalSales - daySales.totalTax))}
  ${line(isRTL ? 'الضريبة 15%' : 'VAT 15%', formatCurrency(daySales.totalTax))}
  ${line(isRTL ? 'الخصومات' : 'Discounts', formatCurrency(daySales.totalDiscount))}

  <div class="total">
    ${isRTL ? 'الإجمالي' : 'Total'}: ${formatCurrency(daySales.totalSales)}
  </div>

  ${day.shift_counts.total > 0 ? `
    <h2>${isRTL ? `مطابقة الدرج (${day.shift_counts.total} وردية)` : `Cash Drawer (${day.shift_counts.total} shifts)`}</h2>
    ${line(isRTL ? 'الرصيد الافتتاحي' : 'Opening Cash', formatCurrency(Number(cash.opening)))}
    ${line(isRTL ? 'مبيعات نقدية' : 'Cash Sales', formatCurrency(Number(cash.sales)))}
    ${line(isRTL ? 'إيداعات' : 'Cash In', formatCurrency(Number(cash.cash_in)))}
    ${line(isRTL ? 'سحوبات' : 'Cash Out', formatCurrency(Number(cash.cash_out)))}
    ${line(isRTL ? 'مصروفات' : 'Expenses', formatCurrency(Number(cash.expenses)))}
    ${cash.expected !== null ? line(isRTL ? 'المتوقع' : 'Expected', formatCurrency(Number(cash.expected)), true) : ''}
    ${cash.counted !== null ? line(isRTL ? 'المعدود' : 'Counted', formatCurrency(Number(cash.counted)), true) : ''}
    ${cash.difference !== null ? line(isRTL ? 'الفرق' : 'Difference', formatCurrency(Number(cash.difference)), true) : ''}
  ` : ''}

  ${topProducts.length > 0 ? `
    <h2>${isRTL ? 'أفضل المنتجات' : 'Top Products'}</h2>
    <table>
      <thead><tr><th>${isRTL ? 'المنتج' : 'Product'}</th><th>${isRTL ? 'كمية' : 'Qty'}</th><th>${isRTL ? 'الإجمالي' : 'Total'}</th></tr></thead>
      <tbody>
        ${topProducts.map(p => `<tr><td>${p.name.substring(0, 20)}</td><td>${p.quantity}</td><td>${formatCurrency(p.total)}</td></tr>`).join('')}
      </tbody>
    </table>
  ` : ''}

  ${noteText ? `<h2>${isRTL ? 'ملاحظات' : 'Notes'}</h2><div class="small">${noteText.replace(/</g, '&lt;')}</div>` : ''}

  <div class="sep"></div>
  <div class="footer">
    ${isRTL ? 'تم الإغلاق بواسطة' : 'Closed by'}: ${user?.email || '-'}<br/>
    ${isRTL ? 'شكراً لكم' : 'Thank you'}
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
    try {
      w.document.write(html);
      w.document.close();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: e?.message || (isRTL ? "خطأ غير معروف" : "Unknown error") };
    }
  };

  const formatCurrency = (v: number) => `${v.toFixed(2)} ر.س`;
  const pctChange = (curr: number, prev: number) => {
    if (!prev) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  // Hourly distribution
  const hourlyData = useMemo(() => {
    if (!daySales) return [];
    const hours: Record<number, { hour: string; sales: number; count: number }> = {};
    for (let h = 0; h < 24; h++) hours[h] = { hour: `${h}:00`, sales: 0, count: 0 };
    daySales.soldItems.forEach(item => {
      const h = new Date(item.saleTime).getHours();
      hours[h].sales += item.total;
      hours[h].count += 1;
    });
    return Object.values(hours).filter(h => h.sales > 0 || h.count > 0);
  }, [daySales]);

  const peakHour = useMemo(() => {
    if (!hourlyData.length) return null;
    return hourlyData.reduce((a, b) => (b.sales > a.sales ? b : a));
  }, [hourlyData]);

  const topProducts = useMemo(() => {
    if (!daySales) return [];
    const map = new Map<string, { name: string; quantity: number; total: number; type: string }>();
    daySales.soldItems.forEach(item => {
      const key = `${item.type}-${item.name}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.total += item.total;
      } else {
        map.set(key, { name: item.name, quantity: item.quantity, total: item.total, type: item.type });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [daySales]);

  const paymentPieData = useMemo(() => {
    if (!daySales) return [];
    return [
      { name: isRTL ? 'كاش' : 'Cash', value: daySales.cashTotal, color: 'hsl(142 71% 45%)' },
      { name: isRTL ? 'بطاقة' : 'Card', value: daySales.cardTotal, color: 'hsl(217 91% 60%)' },
      { name: isRTL ? 'تحويل' : 'Transfer', value: daySales.bankTransferTotal, color: 'hsl(271 76% 53%)' },
    ].filter(d => d.value > 0);
  }, [daySales, isRTL]);

  const avgInvoice = daySales && daySales.transactionsCount > 0
    ? daySales.totalSales / daySales.transactionsCount : 0;

  // Export CSV
  const exportCSV = () => {
    if (!daySales) return;
    const headers = [
      isRTL ? 'المنتج' : 'Product',
      isRTL ? 'النوع' : 'Type',
      isRTL ? 'الكمية' : 'Qty',
      isRTL ? 'السعر' : 'Price',
      isRTL ? 'الإجمالي' : 'Total',
      isRTL ? 'الدفع' : 'Payment',
      isRTL ? 'الفاتورة' : 'Invoice',
      isRTL ? 'العميل' : 'Customer',
      isRTL ? 'الوقت' : 'Time',
    ];
    const rows = daySales.soldItems.map(i => [
      i.name, i.type, i.quantity, i.unitPrice.toFixed(2),
      i.total.toFixed(2), i.paymentMethod, i.invoiceNumber,
      i.customerName || '', format(new Date(i.saleTime), 'HH:mm'),
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-closing-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => window.print();

  return (
    <AppLayout
      title={isRTL ? "الإغلاق اليومي" : "Daily Closings"}
      subtitle={isRTL ? "تقرير شامل لمبيعات اليوم وحركة الكاش" : "Comprehensive daily sales & cash report"}
    >
      {/* Tabs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <div className="flex gap-2">
          <Button variant={activeTab === 'today' ? 'default' : 'outline'} onClick={() => setActiveTab('today')} size="sm">
            <Calculator className="w-4 h-4 me-2" />
            {isRTL ? 'إغلاق اليوم' : "Today's Closing"}
          </Button>
          <Button variant={activeTab === 'history' ? 'default' : 'outline'} onClick={() => setActiveTab('history')} size="sm">
            <FileText className="w-4 h-4 me-2" />
            {isRTL ? 'السجل' : 'History'}
          </Button>
        </div>
        {activeTab === 'today' && daySales && daySales.transactionsCount > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={printReport}>
              <Printer className="w-4 h-4 me-2" />
              {isRTL ? 'طباعة' : 'Print'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 me-2" />
              {isRTL ? 'تصدير Excel' : 'Export CSV'}
            </Button>
          </div>
        )}
      </div>

      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* Print header (only on print) */}
          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">{merchant?.name}</h1>
            <p className="text-sm">{isRTL ? 'تقرير الإغلاق اليومي' : 'Daily Closing Report'} — {selectedDate}</p>
            <p className="text-xs">{currentBranch?.name}</p>
          </div>

          {/* Date + status */}
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-48"
            />
            {existingClosing ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="w-3 h-3" />{isRTL ? 'تم الإغلاق' : 'Closed'}
              </Badge>
            ) : summary && summary.shift_counts.total > 0 ? (
              <Badge variant="secondary" className="gap-1">
                <Clock className="w-3 h-3" />
                {summary.can_close || summary.blockers.every(b => b === 'MANAGER_REQUIRED')
                  ? (isRTL ? 'جاهز للإغلاق' : 'Ready to close')
                  : (isRTL ? 'مفتوح' : 'Open')}
              </Badge>
            ) : null}
          </div>

          {loadingSales ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : daySales ? (
            <>
              {/* Hero: total + comparison with yesterday */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-6 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-lg relative overflow-hidden"
              >
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative grid md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-80">{isRTL ? 'إجمالي مبيعات اليوم' : "Today's Total"}</p>
                    <p className="text-4xl font-bold mt-2">{formatCurrency(daySales.totalSales)}</p>
                    {prevSales && (
                      <div className="flex items-center gap-1 mt-2 text-sm opacity-90">
                        {pctChange(daySales.totalSales, prevSales.totalSales) >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : <TrendingDown className="w-4 h-4" />}
                        <span>{Math.abs(pctChange(daySales.totalSales, prevSales.totalSales)).toFixed(1)}%</span>
                        <span className="opacity-75">{isRTL ? 'مقارنة بالأمس' : 'vs yesterday'}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-80">{isRTL ? 'متوسط الفاتورة' : 'Avg Invoice'}</p>
                    <p className="text-3xl font-bold mt-2">{formatCurrency(avgInvoice)}</p>
                    <p className="text-sm opacity-80 mt-2">{daySales.transactionsCount} {isRTL ? 'فاتورة' : 'invoices'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-80">{isRTL ? 'صافي بعد الضريبة' : 'Net (excl. VAT)'}</p>
                    <p className="text-3xl font-bold mt-2">{formatCurrency(daySales.totalSales - daySales.totalTax)}</p>
                    <p className="text-sm opacity-80 mt-2">{isRTL ? 'الضريبة:' : 'VAT:'} {formatCurrency(daySales.totalTax)}</p>
                  </div>
                </div>
              </motion.div>

              {/* Payment cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { icon: Banknote, label: isRTL ? 'كاش' : 'Cash', value: daySales.cashTotal, card: 'border-green-500/30 bg-green-500/5', iconBg: 'bg-green-500/15', iconText: 'text-green-600', valueText: 'text-green-700 dark:text-green-400' },
                  { icon: CreditCard, label: isRTL ? 'مدى / بطاقة' : 'Card', value: daySales.cardTotal, card: 'border-blue-500/30 bg-blue-500/5', iconBg: 'bg-blue-500/15', iconText: 'text-blue-600', valueText: 'text-blue-700 dark:text-blue-400' },
                  { icon: Building2, label: isRTL ? 'تحويل بنكي' : 'Transfer', value: daySales.bankTransferTotal, card: 'border-purple-500/30 bg-purple-500/5', iconBg: 'bg-purple-500/15', iconText: 'text-purple-600', valueText: 'text-purple-700 dark:text-purple-400' },
                  { icon: ShoppingBag, label: isRTL ? 'الإجمالي' : 'Total', value: daySales.totalSales, card: 'border-primary/30 bg-primary/5', iconBg: 'bg-primary/15', iconText: 'text-primary', valueText: 'text-primary' },
                ].map((c, i) => (
                  <motion.div
                    key={c.label}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className={`${c.card} hover:shadow-md transition-shadow`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                            <c.icon className={`w-5 h-5 ${c.iconText}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">{c.label}</p>
                            <p className={`text-lg font-bold ${c.valueText} truncate`}>
                              {formatCurrency(c.value)}
                            </p>
                            {daySales.totalSales > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {((c.value / daySales.totalSales) * 100).toFixed(0)}%
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card><CardContent className="p-3 text-center">
                  <Receipt className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">{daySales.transactionsCount}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'الفواتير' : 'Invoices'}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <Smartphone className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">{daySales.devicesSold}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'أجهزة' : 'Devices'}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <Package className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">{daySales.accessoriesSold}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'إكسسوارات' : 'Accessories'}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <Activity className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">{peakHour?.hour || '-'}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'ساعة الذروة' : 'Peak Hour'}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <ArrowLeftRight className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(daySales.totalDiscount)}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'الخصومات' : 'Discounts'}</p>
                </CardContent></Card>
              </div>

              {/* Charts */}
              {daySales.transactionsCount > 0 && (
                <div className="grid lg:grid-cols-3 gap-4 print:hidden">
                  <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-base">{isRTL ? 'المبيعات حسب الساعة' : 'Sales by Hour'}</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={hourlyData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                            formatter={(v: number) => formatCurrency(v)}
                          />
                          <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">{isRTL ? 'توزيع طرق الدفع' : 'Payment Mix'}</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={paymentPieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                            {paymentPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Top products */}
              {topProducts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      {isRTL ? 'أفضل 5 منتجات' : 'Top 5 Products'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {topProducts.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.quantity} × {p.type === 'device' ? (isRTL ? 'جهاز' : 'Device') : (isRTL ? 'إكسسوار' : 'Accessory')}</p>
                          </div>
                          <p className="font-bold text-primary">{formatCurrency(p.total)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sold products table */}
              {daySales.soldItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{isRTL ? 'تفاصيل المبيعات' : 'Sales Details'}</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? 'المنتج' : 'Product'}</TableHead>
                          <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                          <TableHead>{isRTL ? 'الكمية' : 'Qty'}</TableHead>
                          <TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                          <TableHead>{isRTL ? 'الدفع' : 'Payment'}</TableHead>
                          <TableHead>{isRTL ? 'الفاتورة' : 'Invoice'}</TableHead>
                          <TableHead>{isRTL ? 'العميل' : 'Customer'}</TableHead>
                          <TableHead>{isRTL ? 'الوقت' : 'Time'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {daySales.soldItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.type === 'device' ? (isRTL ? 'جهاز' : 'Device') : (isRTL ? 'إكسسوار' : 'Accessory')}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(item.total)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {paymentMethodLabel(item.paymentMethod, isRTL)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{item.invoiceNumber}</TableCell>
                            <TableCell className="text-sm">{item.customerName || '-'}</TableCell>
                            <TableCell className="text-xs">{format(new Date(item.saleTime), 'HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Shifts of the day + cash drawer reconciliation */}
              {summary && summary.shift_counts.total > 0 && (
                <DayShiftsCard summary={summary} isRTL={isRTL} formatCurrency={formatCurrency} />
              )}

              {/* Close the day: managers only, once every shift is approved */}
              {summary && !existingClosing && (
                <Card className="border-primary/30 print:hidden">
                  <CardHeader><CardTitle className="text-base">{isRTL ? 'إغلاق اليوم' : 'Close Day'}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {summary.blockers.length > 0 && (
                      <div className="space-y-2">
                        {summary.blockers.map(b => (
                          <div key={b} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                            <span>
                              {blockerText(b, isRTL)}
                              {b === 'PENDING_SHIFTS' && (
                                <Link to="/shifts" className="text-primary underline ms-1">
                                  {isRTL ? 'صفحة الورديات' : 'Shifts page'}
                                </Link>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {summary.can_close && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {isRTL
                            ? 'يُحفظ الإغلاق من مجموع ورديات اليوم المعتمدة، ولا يمكن فتح وردية جديدة في هذا اليوم بعده.'
                            : "The closing is saved from the day's approved shifts; no new shift can open on this day afterwards."}
                        </p>
                        <div>
                          <label className="text-sm font-medium mb-1 block">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                          <Textarea
                            placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
                            value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                          />
                        </div>
                        <Button onClick={handleClose} disabled={isClosing} className="w-full md:w-auto">
                          <Lock className="w-4 h-4 me-2" />
                          {isClosing ? (isRTL ? 'جاري الإغلاق...' : 'Closing...') : (isRTL ? 'إغلاق اليوم' : 'Close Day')}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {existingClosing && (
                <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">
                        {isRTL ? 'تم إغلاق هذا اليوم' : 'This day has been closed'}
                        {existingClosing.closed_by_name ? ` · ${existingClosing.closed_by_name}` : ''}
                      </p>
                      {existingClosing.cash_counted !== null && (
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? 'الكاش المعدود:' : 'Cash counted:'} {formatCurrency(Number(existingClosing.cash_counted))}
                          {' | '}
                          {isRTL ? 'الفرق:' : 'Diff:'} {formatCurrency(Number(existingClosing.cash_difference || 0))}
                        </p>
                      )}
                      {existingClosing.notes && <p className="text-sm text-muted-foreground">{existingClosing.notes}</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {daySales.transactionsCount === 0 && (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{isRTL ? 'لا توجد مبيعات في هذا اليوم' : 'No sales on this day'}</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader><CardTitle>{isRTL ? 'سجل الإغلاقات' : 'Closings History'}</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : closings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{isRTL ? 'لا توجد إغلاقات سابقة' : 'No previous closings'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'كاش' : 'Cash'}</TableHead>
                    <TableHead>{isRTL ? 'مدى' : 'Card'}</TableHead>
                    <TableHead>{isRTL ? 'تحويل' : 'Transfer'}</TableHead>
                    <TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                    <TableHead>{isRTL ? 'الفواتير' : 'Invoices'}</TableHead>
                    <TableHead>{isRTL ? 'الورديات' : 'Shifts'}</TableHead>
                    <TableHead>{isRTL ? 'فرق الكاش' : 'Cash Diff'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closings.map(c => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedDate(c.closing_date); setActiveTab('today'); }}>
                      <TableCell className="font-medium">{c.closing_date}</TableCell>
                      <TableCell>{formatCurrency(Number(c.cash_sales))}</TableCell>
                      <TableCell>{formatCurrency(Number(c.card_sales))}</TableCell>
                      <TableCell>{formatCurrency(Number(c.bank_transfer_sales))}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(Number(c.total_sales))}</TableCell>
                      <TableCell>{c.transactions_count}</TableCell>
                      <TableCell>{c.source === 'shifts' ? c.shifts_count : (isRTL ? 'قديم' : 'Legacy')}</TableCell>
                      <TableCell className={Number(c.cash_difference || 0) !== 0 ? 'text-destructive font-medium' : 'text-green-600'}>
                        {c.cash_counted !== null ? formatCurrency(Number(c.cash_difference || 0)) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'closed' ? 'default' : 'secondary'}>
                          {c.status === 'closed' ? (isRTL ? 'مغلق' : 'Closed') : (isRTL ? 'مفتوح' : 'Open')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}

const BLOCKER_TEXT: Record<string, { ar: string; en: string }> = {
  NO_SHIFTS: { ar: 'لا توجد ورديات في هذا اليوم.', en: 'There are no shifts on this day.' },
  OPEN_SHIFTS: { ar: 'يوجد وردية مفتوحة، يجب إغلاقها من نقطة البيع أولاً.', en: 'A shift is still open; close it from the POS first.' },
  PENDING_SHIFTS: { ar: 'يوجد ورديات بانتظار اعتماد المدير.', en: 'Some shifts are waiting for manager approval.' },
  MANAGER_REQUIRED: { ar: 'إغلاق اليوم للمدير فقط.', en: 'Only a manager can close the day.' },
};

function blockerText(code: string, isRTL: boolean) {
  const t = BLOCKER_TEXT[code];
  return t ? t[isRTL ? 'ar' : 'en'] : code;
}

const SHIFT_STATUS: Record<string, { ar: string; en: string; className: string }> = {
  open: { ar: 'مفتوحة', en: 'Open', className: 'bg-success/15 text-success border-success/30' },
  pending_approval: { ar: 'بانتظار الاعتماد', en: 'Awaiting approval', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  closed: { ar: 'معتمدة', en: 'Approved', className: 'bg-muted text-muted-foreground' },
};

/** The day's shifts and the cash drawer reconciliation, summed across them. */
function DayShiftsCard({
  summary, isRTL, formatCurrency,
}: {
  summary: DaySummary;
  isRTL: boolean;
  formatCurrency: (v: number) => string;
}) {
  const money = (v: number | null) => (v === null ? '—' : formatCurrency(Number(v)));
  const diffClass = (v: number | null) =>
    v === null ? '' : v < 0 ? 'text-destructive font-bold' : v > 0 ? 'text-amber-600 font-bold' : 'text-green-600 font-bold';
  const { cash } = summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="w-4 h-4 text-green-600" />
          {isRTL ? `ورديات اليوم ومطابقة الدرج (${summary.shift_counts.total})` : `Shifts & Cash Drawer (${summary.shift_counts.total})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-center">
          {[
            { label: isRTL ? 'الافتتاحي' : 'Opening', value: money(cash.opening) },
            { label: isRTL ? 'مبيعات نقدية' : 'Cash sales', value: money(cash.sales) },
            { label: isRTL ? 'إيداعات' : 'Cash in', value: money(cash.cash_in) },
            { label: isRTL ? 'سحوبات' : 'Cash out', value: money(cash.cash_out) },
            { label: isRTL ? 'مصروفات' : 'Expenses', value: money(cash.expenses) },
            { label: isRTL ? 'المتوقع' : 'Expected', value: money(cash.expected) },
            { label: isRTL ? 'المعدود' : 'Counted', value: money(cash.counted) },
            { label: isRTL ? 'الفرق' : 'Difference', value: money(cash.difference), className: diffClass(cash.difference) },
          ].map(c => (
            <div key={c.label} className="rounded-lg border border-border p-2">
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              <p className={`text-sm font-semibold ${c.className || ''}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{isRTL ? 'الفتح' : 'Opened'}</TableHead>
                <TableHead>{isRTL ? 'الافتتاحي' : 'Opening'}</TableHead>
                <TableHead>{isRTL ? 'مبيعات نقدية' : 'Cash sales'}</TableHead>
                <TableHead>{isRTL ? 'المتوقع' : 'Expected'}</TableHead>
                <TableHead>{isRTL ? 'المعدود' : 'Counted'}</TableHead>
                <TableHead>{isRTL ? 'الفرق' : 'Diff'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.shifts.map(sh => {
                const st = SHIFT_STATUS[sh.status];
                return (
                  <TableRow key={sh.id}>
                    <TableCell className="font-medium">{sh.shift_no}</TableCell>
                    <TableCell><Badge variant="outline" className={st?.className}>{st ? st[isRTL ? 'ar' : 'en'] : sh.status}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(sh.opened_at), 'HH:mm')}
                      {sh.closed_at ? ` – ${format(new Date(sh.closed_at), 'HH:mm')}` : ''}
                      <div className="text-muted-foreground">{sh.opened_by_name || ''}</div>
                    </TableCell>
                    <TableCell>{money(sh.opening_cash)}</TableCell>
                    <TableCell>{money(sh.cash_sales)}</TableCell>
                    <TableCell>{sh.status === 'open' ? '—' : money(sh.expected_cash)}</TableCell>
                    <TableCell>{money(sh.counted_cash)}</TableCell>
                    <TableCell className={diffClass(sh.difference)}>{money(sh.difference)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {summary.sales.outside_shifts > 0 && (
          <p className="text-xs text-muted-foreground">
            {isRTL
              ? `${summary.sales.outside_shifts} فاتورة في هذا اليوم خارج الورديات (مستوردة أو قبل تفعيل الورديات): داخلة في المبيعات وغير داخلة في مطابقة الدرج.`
              : `${summary.sales.outside_shifts} invoice(s) this day belong to no shift: counted in sales, not in the drawer reconciliation.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
