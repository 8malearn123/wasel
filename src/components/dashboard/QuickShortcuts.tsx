import { Link } from "react-router-dom";
import { ShoppingCart, PackagePlus, Truck, BarChart3, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAuth } from "@/hooks/useAuth";
import type { PermissionKey } from "@/hooks/usePermissions";
import type { FeatureKey } from "@/lib/planAccess";

/**
 * Claude Design's «اختصارات سريعة»: links to screens that already exist,
 * each shown only when the role and the plan open that screen — the same
 * rules the sidebar follows, so a shortcut never leads to a refusal.
 */
const SHORTCUTS: { to: string; ar: string; en: string; icon: typeof ShoppingCart; permission: PermissionKey; feature?: FeatureKey; denyCashier?: boolean }[] = [
  { to: "/pos", ar: "بيع جديد", en: "New sale", icon: ShoppingCart, permission: "pos.access" },
  { to: "/products?tab=inventory", ar: "منتج جديد", en: "New product", icon: PackagePlus, permission: "products.create", denyCashier: true },
  { to: "/shipping", ar: "الشحنات", en: "Shipments", icon: Truck, permission: "shipping.manage", denyCashier: true },
  { to: "/sales?tab=customers", ar: "العملاء", en: "Customers", icon: Users, permission: "customers.manage", feature: "customers", denyCashier: true },
  { to: "/reports?tab=sales", ar: "التقارير", en: "Reports", icon: BarChart3, permission: "reports.view", feature: "reports", denyCashier: true },
  { to: "/ai-insights", ar: "المساعد", en: "Assistant", icon: Sparkles, permission: "ai_insights.view", denyCashier: true },
];

export function QuickShortcuts({ isRTL, className }: { isRTL: boolean; className?: string }) {
  const { can, loading } = usePermissions();
  const { allows } = useFeatureAccess();
  const { merchantUser } = useAuth();
  const isCashier = merchantUser?.role === "cashier";
  if (loading) return null;
  const shown = SHORTCUTS.filter(s => can(s.permission) && (!s.feature || allows(s.feature)) && !(s.denyCashier && isCashier));
  if (shown.length === 0) return null;

  return (
    <section className={cn("bg-card rounded-[24px] border shadow-md p-5", className)} aria-label={isRTL ? "اختصارات سريعة" : "Shortcuts"}>
      <h3 className="font-bold text-foreground mb-4">{isRTL ? "اختصارات سريعة" : "Shortcuts"}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {shown.map(s => (
          <Link
            key={s.to}
            to={s.to}
            className="group flex flex-col items-center gap-2 rounded-2xl p-3 min-h-[88px] bg-muted/50 hover:bg-accent transition-colors text-center"
          >
            <span className="w-11 h-11 rounded-[14px] bg-card border shadow-sm flex items-center justify-center text-primary-text group-hover:scale-105 transition-transform">
              <s.icon className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold text-foreground">{isRTL ? s.ar : s.en}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
