import { useEffect, useState } from "react";
import { type FeatureKey } from "@/lib/planAccess";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { usePermissions, type PermissionKey } from "@/hooks/usePermissions";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  ArrowLeftRight,
  Barcode,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calculator,
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
  Smartphone,
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

type NavGroup = 'ops' | 'catalog' | 'manage' | 'account';

// Claude Design: the sidebar in labelled groups. The items, their links and
// every gate below stay exactly as they were; only their order and grouping
// on screen change.
const GROUPS: { key: NavGroup; ar: string; en: string }[] = [
  { key: 'ops', ar: 'التشغيل', en: 'Operations' },
  { key: 'catalog', ar: 'الكتالوج', en: 'Catalogue' },
  { key: 'manage', ar: 'الإدارة', en: 'Management' },
  { key: 'account', ar: 'الحساب', en: 'Account' },
];

interface NavItem {
  group: NavGroup;
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
 * Ten sections. The sidebar shows only the sections; each page's own
 * sub-navigation is the one place its leaves are listed, so they are never
 * shown twice. `children` mirrors those leaves (same ?tab= keys) and is kept
 * for the gating below: a section whose leaves are all denied is hidden.
 *
 * The gates here are the usability half of the per-leaf gates in SectionShell:
 * hiding an entry has never been what stops anyone, RLS is.
 */
const navItems: NavItem[] = [
  {
    // A cashier's "/" bounces straight to the till, so it is not offered to them
    group: 'ops', icon: LayoutDashboard, label: "Dashboard", labelAr: "الرئيسية", path: "/",
    denyRoles: ["cashier"], requirePermission: "dashboard.view",
  },
  {
    group: 'catalog', icon: Package, label: "Products", labelAr: "المنتجات", path: "/products",
    denyRoles: ["cashier"],
    children: [
      { key: "inventory", label: "Stock", labelAr: "المخزون", icon: Package, requirePermission: "products.view" },
      { key: "stocktake", label: "Stocktake", labelAr: "الجرد", icon: ClipboardCheck, requireFeature: "stocktake", requirePermission: "stocktake.manage" },
      { key: "transfers", label: "Transfers", labelAr: "التحويلات", icon: ArrowLeftRight, requireFeature: "transfers", requirePermission: "transfers.manage" },
      { key: "suppliers", label: "Suppliers & purchases", labelAr: "الموردين والمشتريات", icon: Truck, requireFeature: "suppliers", requirePermission: "suppliers.manage" },
      { key: "labels", label: "Verification codes", labelAr: "أكواد التحقق", icon: Barcode, requirePermission: "products.view" },
    ],
  },
  {
    group: 'ops', icon: ShoppingBag, label: "Orders & Sales", labelAr: "الطلبات والمبيعات", path: "/sales",
    children: [
      { key: "orders", label: "Online orders", labelAr: "طلبات المتجر", icon: ShoppingBag, requireFeature: "onlineStore", denyRoles: ["cashier"], requirePermission: "online_orders.manage" },
      { key: "repairs", label: "Repairs", labelAr: "الصيانة", icon: Wrench, requireFeature: "repairs", requirePermission: "repairs.manage" },
      { key: "closings", label: "Daily closings", labelAr: "الإغلاق اليومي", icon: Calculator, requirePermission: "closings.manage" },
      { key: "store", label: "Store settings", labelAr: "إعدادات المتجر", icon: Store, requireFeature: "onlineStore", denyRoles: ["cashier"], requirePermission: "store.manage" },
      { key: "seo", label: "Search engines", labelAr: "محركات البحث", icon: Search, requireFeature: "onlineStore", denyRoles: ["cashier"], requirePermission: "store.manage" },
      { key: "customers", label: "Customers & loyalty", labelAr: "العملاء والولاء", icon: Heart, requireFeature: "customers", denyRoles: ["cashier"], requirePermission: "customers.manage" },
      { key: "marketing", label: "Marketing", labelAr: "التسويق", icon: Megaphone, requireFeature: "marketing", denyRoles: ["cashier"], requirePermission: "marketing.manage" },
      { key: "wholesale", label: "Wholesale", labelAr: "بيع الجملة", icon: Warehouse, requireFeature: "wholesale", denyRoles: ["cashier"], requirePermission: "wholesale.manage" },
    ],
  },
  {
    group: 'ops', icon: Truck, label: "Shipping", labelAr: "الشحن", path: "/shipping",
    denyRoles: ["cashier"],
    children: [
      // the page's own tabs (ShippingPage TABS), same keys
      { key: "shipments", label: "Shipments", labelAr: "الشحنات", icon: Truck, requirePermission: "shipping.manage" },
      { key: "carriers", label: "Carriers", labelAr: "شركات الشحن", icon: SlidersHorizontal, requirePermission: "shipping.manage" },
      { key: "insights", label: "Shipping insights", labelAr: "تحليلات الشحن", icon: Sparkles, requirePermission: "shipping.manage" },
    ],
  },
  {
    group: 'manage', icon: BarChart3, label: "Reports", labelAr: "التقارير", path: "/reports",
    requireFeature: "reports", denyRoles: ["cashier"],
    // Same order and keys as the report groups on the page, so the sidebar and
    // the page's own sub-navigation can never disagree about where you are
    children: [
      { key: "sales", label: "Sales & profit", labelAr: "المبيعات والأرباح", icon: BarChart3, requirePermission: "reports.view" },
      { key: "table-sales", label: "Sales detail", labelAr: "تفاصيل المبيعات", icon: FileText, requirePermission: "invoices.view" },
      { key: "inventory", label: "Stock", labelAr: "المخزون", icon: Package, requirePermission: "reports.view" },
      { key: "table-devices", label: "Devices", labelAr: "الأجهزة", icon: Smartphone, requirePermission: "reports.view" },
      { key: "table-accessories", label: "Accessories", labelAr: "الإكسسوارات", icon: Package, requirePermission: "reports.view" },
      { key: "parts", label: "Repair parts", labelAr: "قطع الصيانة", icon: Wrench, requirePermission: "reports.view" },
      { key: "deadstock", label: "Dead stock", labelAr: "الرواكد", icon: Archive, requirePermission: "reports.view" },
      { key: "employees", label: "Employees", labelAr: "الموظفون", icon: Users, requirePermission: "reports.view" },
      { key: "table-suppliers", label: "Suppliers", labelAr: "الموردون", icon: Truck, requirePermission: "reports.view" },
      { key: "table-customers", label: "Customers", labelAr: "العملاء", icon: Heart, requirePermission: "reports.view" },
    ],
  },
  {
    group: 'manage', icon: Briefcase, label: "People", labelAr: "الموارد البشرية", path: "/team",
    denyRoles: ["cashier"],
    children: [
      { key: "employees", label: "Employees", labelAr: "الموظفون", icon: Users, requirePermission: "employees.view" },
      { key: "attendance", label: "Attendance", labelAr: "الحضور والانصراف", icon: Fingerprint, requirePermission: "attendance.manage" },
      { key: "devices", label: "Fingerprint devices", labelAr: "أجهزة البصمة", icon: HardDrive, requirePermission: "attendance.manage" },
      { key: "payroll", label: "Payroll", labelAr: "الرواتب", icon: Briefcase, denyRoles: ["branch_manager", "inventory_manager"], requirePermission: "payroll.manage" },
      { key: "users", label: "Users & permissions", labelAr: "المستخدمين والصلاحيات", icon: ShieldCheck, denyRoles: ["branch_manager", "inventory_manager"], requirePermission: "users.view" },
    ],
  },
  {
    group: 'manage', icon: Sparkles, label: "AI insights", labelAr: "الذكاء الاصطناعي", path: "/ai-insights",
    denyRoles: ["cashier"], requirePermission: "ai_insights.view",
  },
  {
    group: 'account', icon: CreditCard, label: "Subscription & Plans", labelAr: "الاشتراك والباقات", path: "/subscription",
    // the page itself is owner/admin only (RoleRoute), custom roles included
    denyRoles: ["cashier", "branch_manager", "inventory_manager", "custom"],
  },
  {
    group: 'account', icon: Settings, label: "Settings", labelAr: "الإعدادات", path: "/settings",
    children: [
      { key: "general", label: "General", labelAr: "عام", icon: SlidersHorizontal, denyRoles: ["cashier"], requirePermission: "settings.manage" },
      { key: "notifications", label: "Notifications", labelAr: "الإشعارات", icon: Bell, denyRoles: ["cashier"], requirePermission: "settings.manage" },
      { key: "policy", label: "Business policy", labelAr: "سياسة العمل", icon: FileText, denyRoles: ["cashier", "branch_manager", "inventory_manager"], requirePermission: "policy.manage" },
    ],
  },
  {
    group: 'account', icon: Building2, label: "Business & help", labelAr: "المنشأة والدعم", path: "/organization",
    children: [
      { key: "branches", label: "Branches", labelAr: "الفروع", icon: Building2, denyRoles: ["cashier"], requirePermission: "branches.manage" },
      { key: "support", label: "Support", labelAr: "الدعم الفني", icon: LifeBuoy },
    ],
  },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // the page beside it keeps its width in step (AppLayout reads --sidebar-w)
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', isCollapsed ? '80px' : '280px');
  }, [isCollapsed]);
  const location = useLocation();
  const { t, isRTL } = useLanguage();
  const { merchant, merchantUser } = useAuth();
  const role = merchantUser?.role as UserRole | undefined;
  const { can, loading: permsLoading } = usePermissions();
  const { allows: planAllowsFeature, loading: plansLoading } = useFeatureAccess();
  const logoUrl = (merchant as { logo_url?: string | null } | null)?.logo_url;

  const permitted = (gate: { requireFeature?: FeatureKey; requirePermission?: PermissionKey; denyRoles?: UserRole[] }) => {
    if (gate.denyRoles && role && gate.denyRoles.includes(role)) return false;
    // While the plans table loads nothing is hidden on a plan basis — otherwise
    // half the sidebar appears a moment after the rest.
    if (!plansLoading && gate.requireFeature && !planAllowsFeature(gate.requireFeature)) return false;
    if (gate.requirePermission && (permsLoading || !can(gate.requirePermission))) return false;
    return true;
  };

  const items = navItems
    .map(item => ({ ...item, children: item.children?.filter(permitted) }))
    // A section whose every leaf is closed to this user is not a section for them
    .filter(item => permitted(item) && (!item.children || item.children.length > 0));

  // the design's order inside each group (same items, same links)
  const ORDER = ['/', '/sales', '/shipping', '/products', '/team', '/reports', '/ai-insights', '/subscription', '/settings', '/organization'];
  const ordered = [...items].sort((a, b) => ORDER.indexOf(a.path) - ORDER.indexOf(b.path));
  const grouped = GROUPS
    .map(g => ({ ...g, items: ordered.filter(i => i.group === g.key) }))
    .filter(g => g.items.length > 0);

  const tooltip = (label: string) => isCollapsed && (
    <div className={cn(
      "absolute px-3 py-2 bg-popover text-popover-foreground rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 text-sm",
      isRTL ? "right-full mr-2" : "left-full ml-2"
    )}>
      {label}
    </div>
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "sidebar-shell fixed top-0 h-screen z-50 flex flex-col overflow-hidden text-sidebar-foreground",
        isRTL ? "right-0" : "left-0"
      )}
    >
      {/* a soft signal glow in the corner, as in the design */}
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-16 w-60 h-60 rounded-full sidebar-glow" />

      {/* Brand + shop */}
      <div className={cn("relative px-4 pt-5 pb-3 flex flex-col gap-3", isCollapsed && "items-center")}>
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-[14px] bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
            ) : (
              <img src="/brand/app-icon.svg" alt="PIXA" className="w-9 h-9 rounded-[10px]" />
            )}
          </span>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-1 min-w-0">
                {/* The sidebar is Midnight in both themes, so the light wordmark always */}
                <img src="/brand/wordmark-white.svg" alt="PIXA" className="h-5 w-auto object-contain object-right" />
                <span className="text-[11px] text-[#A9A2C4] truncate">
                  {merchant?.name ? merchant.name : (isRTL ? "واصل · إدارة المتاجر" : "Wasel · store management")}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* The till is the one screen a shop opens all day, so it leads and is not
          folded into a section */}
      {permitted({ requirePermission: "pos.access" }) && (
        <div className="relative px-3 pb-2">
          <Link
            to="/pos"
            className={cn(
              "group relative flex items-center gap-3 rounded-2xl p-2 min-h-[56px] border transition-colors",
              location.pathname === "/pos"
                ? "sidebar-active border-transparent"
                : "bg-sidebar-primary/[0.12] border-sidebar-primary/35 text-sidebar-accent-foreground hover:bg-sidebar-primary/20",
              isCollapsed && "justify-center"
            )}
          >
            <span className="w-[38px] h-[38px] rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </span>
            {!isCollapsed && (
              <span className="flex-1 flex flex-col leading-tight">
                <span className="text-sm font-bold">{isRTL ? "نقطة البيع" : "Point of Sale"}</span>
                <span className="text-[11px] opacity-75">{isRTL ? "ابدأ عملية بيع" : "Start a sale"}</span>
              </span>
            )}
            {tooltip(isRTL ? "نقطة البيع" : "Point of Sale")}
          </Link>
        </div>
      )}

      {/* Navigation, in labelled groups */}
      <nav className="relative flex-1 overflow-y-auto px-3 pb-3 space-y-4" aria-label={isRTL ? "القائمة الرئيسية" : "Main menu"}>
        {grouped.map(group => (
          <div key={group.key} className="space-y-1">
            {!isCollapsed && (
              <p className="px-2.5 pt-1 text-[11px] font-semibold text-[#8D86A8]">{isRTL ? group.ar : group.en}</p>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              const label = isRTL ? item.labelAr : item.label;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={cn("nav-item relative group", isActive && "active", isCollapsed && "justify-center px-0")}
                >
                  <span className="nav-icon">
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
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
                  {tooltip(label)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="relative p-3 border-t border-white/10">
        <button onClick={() => setIsCollapsed(!isCollapsed)} className={cn("nav-item w-full", isCollapsed && "justify-center px-0")}>
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
