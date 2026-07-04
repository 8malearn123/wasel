import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subDays, startOfDay } from "date-fns";

export function FinancialSummary() {
  const { isRTL } = useLanguage();
  const { merchant } = useAuth();
  const [data, setData] = useState({
    totalSalesMonth: 0,
    totalCostMonth: 0,
    grossProfit: 0,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);

    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30)).toISOString();

    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount, payment_method')
      .eq('merchant_id', merchant.id)
      .gte('sale_date', thirtyDaysAgo);

    // Get cost data from sale_items
    const { data: salesWithItems } = await supabase
      .from('sales')
      .select('id')
      .eq('merchant_id', merchant.id)
      .gte('sale_date', thirtyDaysAgo);

    let totalCost = 0;
    if (salesWithItems && salesWithItems.length > 0) {
      const saleIds = salesWithItems.map(s => s.id);
      // Fetch in batches
      for (let i = 0; i < saleIds.length; i += 50) {
        const batch = saleIds.slice(i, i + 50);
        const { data: items } = await supabase
          .from('sale_items')
          .select('cost_at_sale, quantity')
          .in('sale_id', batch);

        if (items) {
          totalCost += items.reduce((s, item) => s + (Number(item.cost_at_sale || 0) * item.quantity), 0);
        }
      }
    }

    const totalSales = (sales || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const cashSales = (sales || []).filter(s => s.payment_method === 'cash').reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const cardSales = (sales || []).filter(s => s.payment_method === 'card').reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const transferSales = (sales || []).filter(s => s.payment_method === 'bank_transfer').reduce((s, r) => s + Number(r.total_amount || 0), 0);

    setData({
      totalSalesMonth: totalSales,
      totalCostMonth: totalCost,
      grossProfit: totalSales - totalCost,
      cashSales,
      cardSales,
      transferSales,
    });
    setLoading(false);
  }, [merchant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatNum = (n: number) => n.toLocaleString('en-SA', { maximumFractionDigits: 0 });

  const items = [
    { label: isRTL ? 'إجمالي المبيعات (30 يوم)' : 'Total Sales (30d)', value: formatNum(data.totalSalesMonth), icon: ArrowUpRight, color: 'text-success' },
    { label: isRTL ? 'إجمالي التكاليف' : 'Total Costs', value: formatNum(data.totalCostMonth), icon: ArrowDownRight, color: 'text-destructive' },
    { label: isRTL ? 'إجمالي الربح' : 'Gross Profit', value: formatNum(data.grossProfit), icon: Wallet, color: data.grossProfit >= 0 ? 'text-success' : 'text-destructive' },
  ];

  const paymentBreakdown = [
    { label: isRTL ? 'نقداً' : 'Cash', value: data.cashSales, color: 'bg-success' },
    { label: isRTL ? 'بطاقة' : 'Card', value: data.cardSales, color: 'bg-primary' },
    { label: isRTL ? 'تحويل' : 'Transfer', value: data.transferSales, color: 'bg-accent' },
  ];

  const totalPayments = data.cashSales + data.cardSales + data.transferSales;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border border-border shadow-md overflow-hidden"
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
