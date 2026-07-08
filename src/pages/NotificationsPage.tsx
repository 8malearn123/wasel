import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, AlertTriangle, Loader2, ShoppingCart, Package,
  CheckCircle2, ArrowRightLeft, Wrench
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationsPage() {
  const { t } = useLanguage();
  const n = t.notifications;
  const { notifications, loading } = useNotifications();
  const [activeTab, setActiveTab] = useState("all");

  const filtered = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter(n => n.category === activeTab);
  }, [notifications, activeTab]);

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
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
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
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
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
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{n.warningAlerts}</p>
              <p className="text-2xl font-bold text-warning mt-1">{counts.warning}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-warning" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{n.infoAlerts}</p>
              <p className="text-2xl font-bold text-primary mt-1">{counts.info}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs + List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 mb-4">
          <TabsTrigger value="all" className="gap-2">
            <Bell className="w-4 h-4" /> {n.all}
            {counts.all > 0 && <Badge variant="secondary" className="text-xs ml-1">{counts.all}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Package className="w-4 h-4" /> {n.stock}
            {counts.stock > 0 && <Badge variant="secondary" className="text-xs ml-1">{counts.stock}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-2">
            <ArrowRightLeft className="w-4 h-4" /> {n.transfers}
            {counts.transfers > 0 && <Badge variant="secondary" className="text-xs ml-1">{counts.transfers}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="w-4 h-4" /> {n.sales}
            {counts.sales > 0 && <Badge variant="secondary" className="text-xs ml-1">{counts.sales}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="repairs" className="gap-2">
            <Wrench className="w-4 h-4" /> {n.repairs}
            {counts.repairs > 0 && <Badge variant="secondary" className="text-xs ml-1">{counts.repairs}</Badge>}
          </TabsTrigger>
        </TabsList>

        {["all", "stock", "transfers", "sales", "repairs"].map(tab => (
          <TabsContent key={tab} value={tab}>
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
                        transition={{ duration: 0.2, delay: index * 0.03 }}
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
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-foreground">{alert.title}</p>
                              <Badge variant={alert.type === "urgent" ? "destructive" : alert.type === "warning" ? "secondary" : "default"}
                                className="text-[10px]">
                                {alert.type === "urgent" ? n.criticalAlerts : alert.type === "warning" ? n.warningAlerts : n.infoAlerts}
                              </Badge>
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
          </TabsContent>
        ))}
      </Tabs>
    </AppLayout>
  );
}
