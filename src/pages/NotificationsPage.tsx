import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, AlertTriangle, Loader2, ShoppingCart, Package,
  CheckCircle2, ArrowRightLeft, Wrench
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTabParam } from '@/hooks/useTabParam';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useNotifications } from "@/hooks/useNotifications";

// The five lists that used to be five sidebar entries
const CATEGORIES = [
  { key: "all", labelKey: "all" },
  { key: "stock", labelKey: "stock" },
  { key: "transfers", labelKey: "transfers" },
  { key: "sales", labelKey: "sales" },
  { key: "repairs", labelKey: "repairs" },
] as const;

export default function NotificationsPage() {
  const { t, isRTL } = useLanguage();
  const n = t.notifications;
  const { notifications, loading } = useNotifications();
  const [activeTab, setActiveTab] = useTabParam("all");
  // Severity narrows whatever category is on screen; the summary cards drive it
  const [severity, setSeverity] = useState<"all" | "urgent" | "warning" | "info">("all");

  const filtered = useMemo(() => {
    return notifications.filter(item => {
      if (activeTab !== "all" && item.category !== activeTab) return false;
      if (severity !== "all" && item.type !== severity) return false;
      return true;
    });
  }, [notifications, activeTab, severity]);

  const counts = useMemo(() => ({
    all: notifications.length,
    stock: notifications.filter(n => n.category === "stock").length,
    transfers: notifications.filter(n => n.category === "transfers").length,
    sales: notifications.filter(n => n.category === "sales").length,
    repairs: notifications.filter(n => n.category === "repairs").length,
    urgent: notifications.filter(n => n.type === "urgent").length,
    warning: notifications.filter(n => n.type === "warning").length,
    info: notifications.filter(n => n.type === "info").length,
  }), [notifications]);

  const typeStyles = {
    urgent: "border-destructive/30 bg-destructive/5",
    warning: "border-warning/30 bg-warning/5",
    info: "border-primary/30 bg-primary/5",
  };

  const iconStyles = {
    urgent: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
    info: "text-primary bg-primary/10",
  };

  return (
    <AppLayout title={n.title} subtitle={n.subtitle}>
      {/* Summary cards — each one is the severity filter for the list below */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <motion.button type="button" onClick={() => setSeverity("all")}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={cn("p-4 rounded-xl bg-card border shadow-sm text-start transition-all hover:shadow-md",
            severity === "all" ? "border-primary ring-2 ring-primary/20" : "border-border")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{n.totalAlerts}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts.all}</p>
              <p className="text-sm text-muted-foreground mt-1">{counts.all > 0 ? `${counts.all} ${n.itemsNeedAction}` : n.everythingOk}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary" />
            </div>
          </div>
        </motion.button>

        <motion.button type="button" onClick={() => setSeverity("urgent")}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={cn("p-4 rounded-xl bg-card border shadow-sm text-start transition-all hover:shadow-md",
            severity === "urgent" ? "border-destructive ring-2 ring-destructive/20" : "border-border")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{n.criticalAlerts}</p>
              <p className="text-2xl font-bold text-destructive mt-1">{counts.urgent}</p>
              <p className="text-sm text-destructive mt-1">{n.needsAttention}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
          </div>
        </motion.button>

        <motion.button type="button" onClick={() => setSeverity("warning")}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={cn("p-4 rounded-xl bg-card border shadow-sm text-start transition-all hover:shadow-md",
            severity === "warning" ? "border-warning ring-2 ring-warning/20" : "border-border")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{n.warningAlerts}</p>
              <p className="text-2xl font-bold text-warning mt-1">{counts.warning}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-warning" />
            </div>
          </div>
        </motion.button>

        <motion.button type="button" onClick={() => setSeverity("info")}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className={cn("p-4 rounded-xl bg-card border shadow-sm text-start transition-all hover:shadow-md",
            severity === "info" ? "border-primary ring-2 ring-primary/20" : "border-border")}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{n.infoAlerts}</p>
              <p className="text-2xl font-bold text-primary mt-1">{counts.info}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* Categories — the sidebar used to be the only way to switch between these */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
          {CATEGORIES.map(category => (
            <button
              key={category.key}
              type="button"
              onClick={() => setActiveTab(category.key)}
              aria-pressed={activeTab === category.key}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
                activeTab === category.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {n[category.labelKey as keyof typeof n] as string}
              <span className={cn(
                "text-[11px] tabular-nums px-1.5 rounded-full",
                activeTab === category.key
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}>
                {counts[category.key as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        {severity !== "all" && (
          <button
            type="button"
            onClick={() => setSeverity("all")}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            {isRTL ? "إلغاء تصفية الأهمية" : "Clear severity filter"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border p-16 text-center">
          <Bell className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">{n.noNotifications}</h3>
          <p className="text-muted-foreground">{n.allCaughtUp}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((alert, index) => {
              const Icon = alert.icon;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, delay: Math.min(index, 12) * 0.03 }}
                  className={cn(
                    "p-4 rounded-xl border transition-all hover:shadow-sm",
                    typeStyles[alert.type]
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", iconStyles[alert.type])}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-foreground">{alert.title}</p>
                        <Badge variant={alert.type === "urgent" ? "destructive" : alert.type === "warning" ? "secondary" : "default"}
                          className="text-[10px]">
                          {alert.type === "urgent" ? n.criticalAlerts : alert.type === "warning" ? n.warningAlerts : n.infoAlerts}
                        </Badge>
                        {/* Which part of the shop it came from — the list mixes them under "الكل" */}
                        {activeTab === "all" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {n[(CATEGORIES.find(c => c.key === alert.category)?.labelKey || "all") as keyof typeof n] as string}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 mt-1">{alert.time}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

    </AppLayout>
  );
}
