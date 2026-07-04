import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Package, Clock, CreditCard, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Alert {
  id: string;
  type: "warning" | "info" | "urgent";
  icon: React.ElementType;
  title: string;
  message: string;
  time: string;
}

export function AlertsWidget() {
  const { t } = useLanguage();
  const { merchant } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const fetchAlerts = useCallback(async () => {
    if (!merchant) return;
    const newAlerts: Alert[] = [];

    // Check low-stock repair parts
    const { data: lowParts } = await supabase
      .from('repair_parts')
      .select('name, quantity, min_quantity')
      .eq('merchant_id', merchant.id)
      .order('quantity', { ascending: true });

    if (lowParts) {
      const lowStockParts = lowParts.filter(p => p.quantity <= (p.min_quantity || 5));
      for (const part of lowStockParts.slice(0, 3)) {
        newAlerts.push({
          id: `rp-${part.name}`,
          type: part.quantity === 0 ? "urgent" : "warning",
          icon: Wrench,
          title: part.quantity === 0 ? "نفاد قطعة صيانة" : "انخفاض مخزون قطعة صيانة",
          message: `${part.name} - الكمية: ${part.quantity} (الحد الأدنى: ${part.min_quantity || 5})`,
          time: t.dashboard.justNow,
        });
      }
    }

    // Check low-stock accessories
    const { data: lowAcc } = await supabase
      .from('accessories')
      .select('name, quantity, min_quantity')
      .eq('merchant_id', merchant.id)
      .order('quantity', { ascending: true });

    if (lowAcc) {
      const lowStockAcc = lowAcc.filter(a => a.quantity <= (a.min_quantity || 5));
      for (const acc of lowStockAcc.slice(0, 2)) {
        newAlerts.push({
          id: `acc-${acc.name}`,
          type: acc.quantity === 0 ? "urgent" : "warning",
          icon: Package,
          title: t.dashboard.lowStockAlert,
          message: `${acc.name} - الكمية: ${acc.quantity}`,
          time: t.dashboard.today,
        });
      }
    }

    // Check pending transfers
    const { count: pendingTransfers } = await supabase
      .from('stock_transfers')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .eq('status', 'pending');

    if (pendingTransfers && pendingTransfers > 0) {
      newAlerts.push({
        id: 'pending-transfers',
        type: "info",
        icon: Clock,
        title: t.dashboard.pendingTransfer,
        message: `${pendingTransfers} تحويلات بانتظار الموافقة`,
        time: t.dashboard.today,
      });
    }

    // Check unpaid sales
    const { count: unpaidSales } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .eq('payment_status', 'unpaid');

    if (unpaidSales && unpaidSales > 0) {
      newAlerts.push({
        id: 'unpaid-sales',
        type: "info",
        icon: CreditCard,
        title: t.dashboard.unpaidInvoice,
        message: `${unpaidSales} فواتير غير مدفوعة`,
        time: t.dashboard.today,
      });
    }

    // If no alerts, show a positive message
    if (newAlerts.length === 0) {
      newAlerts.push({
        id: 'all-good',
        type: "info",
        icon: Package,
        title: "كل شيء على ما يرام",
        message: "لا توجد تنبيهات حالياً",
        time: t.dashboard.justNow,
      });
    }

    setAlerts(newAlerts);
  }, [merchant, t]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-card rounded-xl border border-border shadow-md overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">{t.dashboard.alerts}</h3>
        <p className="text-sm text-muted-foreground">{t.dashboard.itemsRequiringAttention}</p>
      </div>

      <div className="p-4 space-y-3">
        {alerts.map((alert, index) => {
          const Icon = alert.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
              className={cn(
                "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                typeStyles[alert.type]
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", iconStyles[alert.type])}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{alert.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{alert.time}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
