import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subDays, startOfDay } from "date-fns";
import { saleTotal, saleCost, saleProfit } from "@/lib/salesMath";

export function FinancialSummary() {
  const { isRTL } = useLanguage();
  const { merchant } = useAuth();
  const [data, setData] = useState({
    totalSalesMonth: 0,
    vatMonth: 0,
    totalCostMonth: 0,
    grossProfit: 0,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    mixedSales: 0,
  });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchData = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    setFailed(false);
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30)).toISOString();

    // one read for totals, VAT and cost, a page at a time (the server stops a
    // single answer at 1,000 rows). A refused read used to show zeros.
    type Row = { total_amount: number; tax_amount: number | null; payment_method: string; items: { cost_at_sale: number | null; quantity: number }[] | null };
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase
        .from('sales')
        .select('total_amount, tax_amount, payment_method, items:sale_items(cost_at_sale, quantity)')
        .eq('merchant_id', merchant.id)
        .gte('sale_date', thirtyDaysAgo)
        .order('id')
        .range(from, from + 999);
      if (error) { setFailed(true); setLoading(false); return; }
      rows.push(...((page || []) as unknown as Row[]));
      if (!page || page.length < 1000) break;
    }

    const byMethod = (m: string) => rows.filter(s => s.payment_method === m).reduce((t, s) => t + saleTotal(s), 0);
    const totalSales = rows.reduce((t, s) => t + saleTotal(s), 0);
    const vat = rows.reduce((t, s) => t + Number(s.tax_amount || 0), 0);
    const cost = rows.reduce((t, s) => t + saleCost(s), 0);

    setData({
      totalSalesMonth: totalSales,
      vatMonth: vat,
      totalCostMonth: cost,
      // before VAT: the tax is collected for the state, not earned
      grossProfit: rows.reduce((t, s) => t + saleProfit(s), 0),
      cashSales: byMethod('cash'),
      cardSales: byMethod('card'),
      transferSales: byMethod('bank_transfer'),
      mixedSales: byMethod('mixed'),
    });
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatNum = (n: number) => n.toLocaleString('en-SA', { maximumFractionDigits: 0 });

  const items = [
    { label: isRTL ? 'إجمالي المبيعات (30 يوم)' : 'Total Sales (30d)', value: formatNum(data.totalSalesMonth), icon: ArrowUpRight, color: 'text-success' },
    { label: isRTL ? 'منها ضريبة القيمة المضافة' : 'of which VAT', value: formatNum(data.vatMonth), icon: ArrowDownRight, color: 'text-muted-foreground' },
    { label: isRTL ? 'إجمالي التكاليف' : 'Total Costs', value: formatNum(data.totalCostMonth), icon: ArrowDownRight, color: 'text-destructive' },
    { label: isRTL ? 'إجمالي الربح (بعد الضريبة)' : 'Gross Profit (ex VAT)', value: formatNum(data.grossProfit), icon: Wallet, color: data.grossProfit >= 0 ? 'text-success' : 'text-destructive' },
  ];

  const paymentBreakdown = [
    { label: isRTL ? 'نقداً' : 'Cash', value: data.cashSales, color: 'bg-success' },
    { label: isRTL ? 'بطاقة' : 'Card', value: data.cardSales, color: 'bg-primary' },
    { label: isRTL ? 'تحويل' : 'Transfer', value: data.transferSales, color: 'bg-accent' },
    // a mixed (cash + card) sale used to vanish from the breakdown
    { label: isRTL ? 'مختلط' : 'Mixed', value: data.mixedSales, color: 'bg-warning' },
  ];

  const totalPayments = data.cashSales + data.cardSales + data.transferSales + data.mixedSales;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-[18px] border border-border shadow-md overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{isRTL ? "ملخص مالي" : "Financial Summary"}</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : failed ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">{isRTL ? 'تعذّر تحميل الملخص المالي' : 'Could not load the financial summary'}</p>
            <button type="button" className="text-sm text-primary underline" onClick={() => fetchData()}>
              {isRTL ? 'إعادة المحاولة' : 'Try again'}
            </button>
          </div>
        ) : (
          <>
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="font-semibold text-sm text-foreground">{item.value} ر.س</span>
                </div>
              );
            })}

            {/* Payment Method Breakdown */}
            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                {isRTL ? "طرق الدفع" : "Payment Methods"}
              </p>
              {/* Bar */}
              {totalPayments > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden">
                  {paymentBreakdown.map((p, i) => (
                    <div
                      key={i}
                      className={`${p.color} transition-all`}
                      style={{ width: `${(p.value / totalPayments) * 100}%` }}
                    />
                  ))}
                </div>
              )}
              <div className="flex justify-between text-xs">
                {paymentBreakdown.map((p, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${p.color}`} />
                    <span className="text-muted-foreground">{p.label}: {formatNum(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
