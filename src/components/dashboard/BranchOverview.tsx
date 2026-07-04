import { motion } from "framer-motion";
import { Building2, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import type { BranchStats } from "@/hooks/useDashboardData";

interface BranchOverviewProps {
  branches: BranchStats[];
  loading: boolean;
}

export function BranchOverview({ branches, loading }: BranchOverviewProps) {
  const { t, isRTL } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border border-border shadow-md overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">{t.dashboard.branchPerformance}</h3>
        <p className="text-sm text-muted-foreground">{t.dashboard.realTimeMetrics}</p>
      </div>

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : branches.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">
            {isRTL ? "لا توجد فروع" : "No branches"}
          </p>
        ) : (
          branches.map((branch, index) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
              className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  {branch.isWarehouse ? (
                    <Warehouse className="w-6 h-6 text-primary" />
                  ) : (
                    <Building2 className="w-6 h-6 text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground">{branch.name}</h4>
                  {branch.address && (
                    <p className="text-sm text-muted-foreground truncate">{branch.address}</p>
                  )}
                </div>

                <div className={cn("text-right", isRTL && "text-left")}>
                  <p className="text-lg font-bold text-foreground">{branch.todayRevenue.toLocaleString()} ر.س</p>
                  <span className="text-sm text-muted-foreground">
                    {branch.todaySales} {isRTL ? "مبيعات" : "sales"}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
