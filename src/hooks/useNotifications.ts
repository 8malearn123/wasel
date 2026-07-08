import { useEffect, useState, useCallback } from "react";
import {
  Package, Wrench, CreditCard, Clock, CheckCircle2, ArrowRightLeft,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AlertType = "urgent" | "warning" | "info";
export type AlertCategory = "stock" | "transfers" | "sales" | "repairs";

export interface Notification {
  id: string;
  type: AlertType;
  category: AlertCategory;
  icon: React.ElementType;
  title: string;
  message: string;
  time: string;
}

export function useNotifications() {
  const { t } = useLanguage();
  const n = t.notifications;
  const { merchant } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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

  return { notifications, loading, refetch: fetchNotifications };
}
