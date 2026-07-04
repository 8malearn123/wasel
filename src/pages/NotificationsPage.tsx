import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Package, Wrench, CreditCard, Clock, AlertTriangle,
  CheckCircle2, Loader2, ArrowRightLeft, ShoppingCart
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AlertType = "urgent" | "warning" | "info";
type AlertCategory = "stock" | "transfers" | "sales" | "repairs";

interface Notification {
  id: string;
  type: AlertType;
  category: AlertCategory;
  icon: React.ElementType;
  title: string;
  message: string;
  time: string;
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const n = t.notifications;
  const { merchant } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const fetchNotifications = useCallback(async () => {
    if (!merchant) return;
    setLoading(true);
    const alerts: Notification[] = [];

    // 1. Low stock accessories
    const { data: lowAcc } = await supabase
      .from("accessories")
      .select("name, quantity, min_quantity")
      .eq("merchant_id", merchant.id)
      .order("quantity", { ascending: true });

    if (lowAcc) {
      for (const acc of lowAcc.filter(a => a.quantity <= (a.min_quantity || 5))) {
        alerts.push({
          id: `acc-${acc.name}`,
          type: acc.quantity === 0 ? "urgent" : "warning",
          category: "stock",
          icon: Package,
          title: acc.quantity === 0 ? n.outOfStockAccessory : n.lowStockAccessory,
          message: `${acc.name} — ${n.quantity}: ${acc.quantity} / ${n.minimum}: ${acc.min_quantity || 5}`,
          time: n.today,
        });
      }
    }

    // 2. Low stock repair parts
    const { data: lowParts } = await supabase
      .from("repair_parts")
      .select("name, quantity, min_quantity")
      .eq("merchant_id", merchant.id)
      .order("quantity", { ascending: true });

    if (lowParts) {
      for (const part of lowParts.filter(p => p.quantity <= (p.min_quantity || 5))) {
        alerts.push({
          id: `rp-${part.name}`,
          type: part.quantity === 0 ? "urgent" : "warning",
          category: "stock",
          icon: Wrench,
          title: part.quantity === 0 ? n.outOfStockPart : n.lowStockPart,
          message: `${part.name} — ${n.quantity}: ${part.quantity} / ${n.minimum}: ${part.min_quantity || 5}`,
          time: n.today,
        });
      }
    }

    // 3. Pending transfers
    const { data: pendingTransfers } = await supabase
      .from("stock_transfers")
      .select("id, transfer_number, created_at")
      .eq("merchant_id", merchant.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (pendingTransfers) {
      for (const tr of pendingTransfers) {
        alerts.push({
          id: `tr-${tr.id}`,
          type: "info",
          category: "transfers",
          icon: ArrowRightLeft,
          title: n.pendingTransfer,
          message: `#${tr.transfer_number}`,
          time: new Date(tr.created_at).toLocaleDateString(),
        });
      }
    }

    // 4. Unpaid sales
    const { data: unpaidSales } = await supabase
      .from("sales")
      .select("id, invoice_number, total_amount, customer_name, created_at")
      .eq("merchant_id", merchant.id)
      .eq("payment_status", "unpaid")
      .order("created_at", { ascending: false })
      .limit(20);

    if (unpaidSales) {
      for (const sale of unpaidSales) {
        alerts.push({
          id: `sale-${sale.id}`,
          type: "warning",
          category: "sales",
          icon: CreditCard,
          title: n.unpaidInvoice,
          message: `#${sale.invoice_number} — ${sale.customer_name || ""} — ${Number(sale.total_amount).toLocaleString()} ${t.reports?.currency || "SAR"}`,
          time: new Date(sale.created_at).toLocaleDateString(),
        });
      }
    }

    // 5. Pending repairs (received/diagnosing for > 2 days)
    const { data: pendingRepairs } = await supabase
      .from("repair_orders")
      .select("id, repair_number, customer_name, device_type, device_brand, device_model, status, received_at")
      .eq("merchant_id", merchant.id)
      .in("status", ["received", "diagnosing"])
      .order("received_at", { ascending: true })
      .limit(10);

    if (pendingRepairs) {
      for (const repair of pendingRepairs) {
        const daysSince = Math.floor((Date.now() - new Date(repair.received_at).getTime()) / 86400000);
        if (daysSince >= 2) {
          alerts.push({
            id: `rep-${repair.id}`,
            type: daysSince >= 5 ? "urgent" : "warning",
            category: "repairs",
            icon: Clock,
            title: n.pendingRepair,
            message: `#${repair.repair_number} — ${repair.customer_name} — ${repair.device_brand || ""} ${repair.device_model || ""} (${daysSince} ${t.reports?.daily === "Daily" ? "days" : "يوم"})`,
            time: new Date(repair.received_at).toLocaleDateString(),
          });
        }
      }
    }

    // 6. Completed repairs ready for pickup
    const { data: completedRepairs } = await supabase
      .from("repair_orders")
      .select("id, repair_number, customer_name, customer_phone, completed_at")
      .eq("merchant_id", merchant.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10);

    if (completedRepairs) {
      for (const repair of completedRepairs) {
        alerts.push({
          id: `rep-done-${repair.id}`,
          type: "info",
          category: "repairs",
          icon: CheckCircle2,
          title: n.completedRepair,
          message: `#${repair.repair_number} — ${repair.customer_name} — ${n.repairReadyForPickup}`,
          time: repair.completed_at ? new Date(repair.completed_at).toLocaleDateString() : n.today,
        });
      }
    }

    // Sort: urgent first, then warning, then info
    const priority = { urgent: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => priority[a.type] - priority[b.type]);

    setNotifications(alerts);
    setLoading(false);
  }, [merchant, n, t]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
