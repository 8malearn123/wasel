import { motion } from "framer-motion";
import { Smartphone, Package, ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import type { RecentSale } from "@/hooks/useDashboardData";
import { Badge } from "@/components/ui/badge";

interface RecentActivityProps {
  sales: RecentSale[];
  loading: boolean;
}

const paymentLabels: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقداً", en: "Cash" },
  card: { ar: "بطاقة", en: "Card" },
  bank_transfer: { ar: "تحويل", en: "Transfer" },
};

export function RecentActivity({ sales, loading }: RecentActivityProps) {
  const { t, isRTL } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card rounded-xl border border-border shadow-md overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t.dashboard.recentActivity}</h3>
          <p className="text-sm text-muted-foreground">{t.dashboard.latestTransactions}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {isRTL ? "لا توجد مبيعات حديثة" : "No recent sales"}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sales.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="px-6 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.type === "device" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                {item.type === "device" ? <Smartphone className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground font-mono">{item.identifier}</p>
              </div>

              <Badge variant="outline" className="text-xs">
                {paymentLabels[item.paymentMethod]?.[isRTL ? 'ar' : 'en'] || item.paymentMethod}
              </Badge>

              <div className={cn("text-right hidden sm:block", isRTL && "text-left")}>
                <p className="font-semibold text-foreground">{Number(item.price).toLocaleString()} ر.س</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
