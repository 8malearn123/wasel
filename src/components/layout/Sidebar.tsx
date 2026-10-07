import { useState } from "react";
import { type FeatureKey } from "@/lib/planAccess";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { usePermissions, type PermissionKey } from "@/hooks/usePermissions";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeftRight,
  Barcode,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  Fingerprint,
  HardDrive,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/database";

interface NavChild {
  /** the section leaf this opens, as ?tab= */
  key: string;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  requireFeature?: FeatureKey;
  requirePermission?: PermissionKey;
  denyRoles?: UserRole[];
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  labelAr: string;
  path: string;
  requireFeature?: FeatureKey;
  requirePermission?: PermissionKey;
  denyRoles?: UserRole[];
  children?: NavChild[];
}

/**
 * Nine sections. Each one's children deep-link into that page's ?tab=, which
 * is the same leaf key the page's own sub-navigation uses — so the sidebar and
 * the page can never disagree about where you are.
 *
 * The gates here are the usability half of the per-leaf gates in SectionShell:
 * hiding an entry has never been what stops anyone, RLS is.
 */
const navItems: NavItem[] = [
  {
    // A cashier's "/" bounces straight to the till, so it is not offered to them
    icon: LayoutDashboard, label: "Dashboard", labelAr: "الرئيسية", path: "/",
    denyRoles: ["cashier"],
  },
  {
    icon: Package, label: "Products", labelAr: "المنتجات", path: "/products",
    denyRoles: ["cashier"],
    children: [
      { key: "inventory", label: "Stock", labelAr: "المخزون", icon: Package },
      { key: "stocktake", label: "Stocktake", labelAr: "الجرد", icon: ClipboardCheck, requireFeature: "stocktake" },
      { key: "transfers", label: "Transfers", labelAr: "التحويلات", icon: ArrowLeftRight, requireFeature: "transfers" },
      { key: "suppliers", label: "Suppliers & purchases", labelAr: "الموردين والمشتريات", icon: Truck, requireFeature: "suppliers" },
      { key: "labels", label: "Verification codes", labelAr: "أكواد التحقق", icon: Barcode },
    ],
  },
  {
    icon: ShoppingBag, label: "Orders & Sales", labelAr: "الطلبات والمبيعات", path: "/sales",
    children: [
      { key: "orders", label: "Online orders", labelAr: "طلبات المتجر", icon: ShoppingBag, requireFeature: "onlineStore", denyRoles: ["cashier"] },
      { key: "repairs", label: "Repairs", labelAr: "الصيانة", icon: Wrench, requireFeature: "repairs" },
      { key: "closings", label: "Daily closings", labelAr: "الإغلاق اليومي", icon: Calculator },
      { key: "store", label: "Store settings", labelAr: "إعدادات المتجر", icon: Store, requireFeature: "onlineStore", denyRoles: ["cashier"] },
      { key: "seo", label: "Search engines", labelAr: "محركات البحث", icon: Search, requireFeature: "onlineStore", denyRoles: ["cashier"] },
      { key: "customers", label: "Customers & loyalty", labelAr: "العملاء والولاء", icon: Heart, requireFeature: "customers", denyRoles: ["cashier"] },
      { key: "marketing", label: "Marketing", labelAr: "التسويق", icon: Megaphone, requireFeature: "marketing", denyRoles: ["cashier"] },
      { key: "wholesale", label: "Wholesale", labelAr: "بيع الجملة", icon: Warehouse, denyRoles: ["cashier"] },
    ],
  },
  {
    icon: Truck, label: "Shipping", labelAr: "الشحن", path: "/shipping",
    denyRoles: ["cashier"],
    children: [
      { key: "carriers", label: "Carriers", labelAr: "شركات الشحن", icon: Truck },
      { key: "api", label: "API settings", labelAr: "إعدادات الاتصال", icon: SlidersHorizontal },
      { key: "ai", label: "Shipping insights", labelAr: "تحليلات الشحن", icon: Sparkles },
    ],
  },
  {
    icon: BarChart3, label: "Reports", labelAr: "التقارير", path: "/reports",
    requireFeature: "reports", denyRoles: ["cashier"],
    children: [
      { key: "sales", label: "Sales", labelAr: "المبيعات", icon: BarChart3 },
      { key: "inventory", label: "Inventory", labelAr: "المخزون", icon: Package },
      { key: "employees", label: "Employees", labelAr: "الموظفين", icon: Users },
      { key: "deadstock", label: "Dead Stock", labelAr: "الرواكد", icon: Warehouse },
      { key: "parts", label: "Repair Parts", labelAr: "قطع الصيانة", icon: Wrench },
      { key: "table-sales", label: "Sales Table", labelAr: "جدول المبيعات", icon: FileText },
      { key: "table-devices", label: "Devices Table", labelAr: "جدول الأجهزة", icon: FileText },
      { key: "table-accessories", label: "Accessories Table", labelAr: "جدول الإكسسوارات", icon: FileText },
      { key: "table-customers", label: "Customers Table", labelAr: "جدول العملاء", icon: FileText },
    ],
  },
  {
    icon: Briefcase, label: "People", labelAr: "الموارد البشرية", path: "/team",
    denyRoles: ["cashier"],
    children: [
      { key: "employees", label: "Employees", labelAr: "الموظفون", icon: Users, requirePermission: "employees.view" },
      { key: "attendance", label: "Attendance", labelAr: "الحضور والانصراف", icon: Fingerprint },
      { key: "devices", label: "Fingerprint devices", labelAr: "أجهزة البصمة", icon: HardDrive },
      { key: "payroll", label: "Payroll", labelAr: "الرواتب", icon: Briefcase, denyRoles: ["branch_manager", "inventory_manager"] },
      { key: "users", label: "Users & permissions", labelAr: "المستخدمين والصلاحيات", icon: ShieldCheck, denyRoles: ["branch_manager", "inventory_manager"] },
    ],
  },
  {
    icon: Sparkles, label: "AI insights", labelAr: "الذكاء الاصطناعي", path: "/ai-insights",
    denyRoles: ["cashier"],
  },
  {
    icon: CreditCard, label: "Subscription & Plans", labelAr: "الاشتراك والباقات", path: "/subscription",
    denyRoles: ["cashier", "branch_manager", "inventory_manager"],
  },
  {
    icon: Settings, label: "Settings", labelAr: "الإعدادات", path: "/settings",
    children: [
      { key: "general", label: "General", labelAr: "عام", icon: SlidersHorizontal, denyRoles: ["cashier"] },
      { key: "notifications", label: "Notifications", labelAr: "الإشعارات", icon: Bell, denyRoles: ["cashier"] },
      { key: "policy", label: "Business policy", labelAr: "سياسة العمل", icon: FileText, denyRoles: ["cashier", "branch_manager", "inventory_manager"] },
      { key: "branches", label: "Branches", labelAr: "الفروع", icon: Building2, denyRoles: ["cashier"] },
      { key: "support", label: "Support", labelAr: "الدعم الفني", icon: LifeBuoy },
    ],
  },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t, isRTL } = useLanguage();
  const { merchant, merchantUser } = useAuth();
  const role = merchantUser?.role as UserRole | undefined;
  const { can } = usePermissions();
  const { allows: planAllowsFeature, loading: plansLoading } = useFeatureAccess();
  const logoUrl = (merchant as { logo_url?: string | null } | null)?.logo_url;

  const permitted = (gate: { requireFeature?: FeatureKey; requirePermission?: PermissionKey; denyRoles?: UserRole[] }) => {
    if (gate.denyRoles && role && gate.denyRoles.includes(role)) return false;
    // While the plans table loads nothing is hidden on a plan basis — otherwise
    // half the sidebar appears a moment after the rest.
    if (!plansLoading && gate.requireFeature && !planAllowsFeature(gate.requireFeature)) return false;
    if (gate.requirePermission && !can(gate.requirePermission)) return false;
    return true;
  };

  const items = navItems
    .map(item => ({ ...item, children: item.children?.filter(permitted) }))
    // A section whose every leaf is closed to this user is not a section for them
    .filter(item => permitted(item) && (!item.children || item.children.length > 0));

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "fixed top-0 h-screen bg-sidebar z-50 flex flex-col",
        isRTL ? "right-0 border-l border-sidebar-border" : "left-0 border-r border-sidebar-border"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-cover shadow-glow" />
              ) : (
                <img src="/brand/app-icon.svg" alt="وصل" className="w-10 h-10 rounded-xl shadow-glow" />
              )}
              <div className="flex flex-col gap-0.5">
                <img src="/brand/wordmark-ink.svg" alt="وصل" className="h-5 w-auto object-contain object-right dark:hidden" />
                <img src="/brand/wordmark-white.svg" alt="وصل" className="h-5 w-auto object-contain object-right hidden dark:block" />
                <span className="text-[10px] text-sidebar-foreground/50 tracking-wider">نظام محلات الجوالات</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isCollapsed && (
          logoUrl ? (
            <img src={logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-cover shadow-glow mx-auto" />
          ) : (
            <img src="/brand/app-icon.svg" alt="وصل" className="w-10 h-10 rounded-xl shadow-glow mx-auto" />
          )
        )}
      </div>

      {/* The till is the one screen a shop opens all day, so it leads and is not
          folded into a section */}
      <div className="px-3 pt-3">
        <Link
          to="/pos"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition-colors group relative",
            location.pathname === "/pos"
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20",
            isCollapsed && "justify-center"
          )}
        >
          <ShoppingCart className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">{isRTL ? "نقطة البيع" : "Point of Sale"}</span>}
          {isCollapsed && (
            <div className={cn(
              "absolute px-3 py-2 bg-popover text-popover-foreground rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 text-sm",
              isRTL ? "right-full mr-2" : "left-full ml-2"
            )}>
              {isRTL ? "نقطة البيع" : "Point of Sale"}
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const label = isRTL ? item.labelAr : item.label;
          const showChildren = !!item.children?.length && isActive && !isCollapsed;
          const currentTab = searchParams.get("tab") || item.children?.[0]?.key;

          return (
            <div key={item.path}>
              <Link to={item.path} className={cn("nav-item relative group", isActive && "active")}>
                <Icon className="w-5 h-5 flex-shrink-0" />

                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isRTL ? 10 : -10 }}
                      className="flex-1 text-sm"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {!!item.children?.length && !isCollapsed && (
                  <ChevronDown className={cn("w-4 h-4 opacity-60 transition-transform", showChildren && "rotate-180")} />
                )}

                {isCollapsed && (
                  <div className={cn(
                    "absolute px-3 py-2 bg-popover text-popover-foreground rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 text-sm",
                    isRTL ? "right-full mr-2" : "left-full ml-2"
                  )}>
                    {label}
                  </div>
                )}
              </Link>

              <AnimatePresence>
                {showChildren && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn("overflow-hidden space-y-0.5 py-1", isRTL ? "pr-9" : "pl-9")}
                  >
                    {item.children!.map((child) => (
                      <Link
                        key={child.key}
                        to={`${item.path}?tab=${child.key}`}
                        className={cn(
                          "block px-3 py-1.5 rounded-md text-sm transition-colors",
                          currentTab === child.key
                            ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        {isRTL ? child.labelAr : child.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="nav-item w-full">
          {isCollapsed ? (
            isRTL ? <ChevronLeft className="w-5 h-5 mx-auto" /> : <ChevronRight className="w-5 h-5 mx-auto" />
          ) : (
            <>
              {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              <span className="text-sm">{t.nav.collapse}</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
