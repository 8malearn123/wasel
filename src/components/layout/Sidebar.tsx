import { useState, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Building2,
  ArrowLeftRight,
  Truck,
  Barcode,
  Bell,
  Megaphone,
  Wrench,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Smartphone,
  CreditCard,
  
  ClipboardCheck,
  Store,
  ShoppingBag,
  Calculator,
  Heart,
  Warehouse,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";


interface NavChild {
  key: string;
  label: string;
  labelAr: string;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  labelAr: string;
  path: string;
  badge?: number;
  requireFeature?: 'onlineStore' | 'wholesale' | 'repairs' | 'suppliers' | 'marketing' | 'stocktake' | 'customers' | 'reports' | 'transfers';
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", labelAr: "لوحة التحكم", path: "/" },
  { icon: ShoppingCart, label: "Point of Sale", labelAr: "نقطة البيع", path: "/pos", children: [
    { key: "pos", label: "Point of Sale", labelAr: "نقطة البيع" },
    { key: "history", label: "Sales History", labelAr: "سجل المبيعات" },
  ] },
  { icon: Package, label: "Inventory", labelAr: "المخزون", path: "/inventory", children: [
    { key: "devices", label: "Devices", labelAr: "الأجهزة" },
    { key: "accessories", label: "Accessories", labelAr: "الإكسسوارات" },
    { key: "repair_parts", label: "Repair Parts", labelAr: "قطع الصيانة" },
    { key: "categories", label: "Categories", labelAr: "التصنيفات" },
  ] },
  { icon: Building2, label: "Branches", labelAr: "الفروع", path: "/branches" },
  { icon: ArrowLeftRight, label: "Transfers", labelAr: "التحويلات", path: "/transfers", requireFeature: 'transfers' },
  { icon: Truck, label: "Suppliers", labelAr: "الموردين", path: "/suppliers", requireFeature: 'suppliers', children: [
    { key: "suppliers", label: "Suppliers", labelAr: "الموردين" },
    { key: "orders", label: "Purchase Orders", labelAr: "أوامر الشراء" },
    { key: "debts", label: "Debts", labelAr: "المديونيات" },
  ] },
  { icon: ShoppingBag, label: "Purchases", labelAr: "المشتريات", path: "/purchases", requireFeature: 'suppliers' },
  { icon: Barcode, label: "Verification Codes", labelAr: "أكواد التحقق", path: "/labels", children: [
    { key: "all", label: "All", labelAr: "الكل" },
    { key: "devices", label: "Devices", labelAr: "أجهزة" },
    { key: "accessories", label: "Accessories", labelAr: "إكسسوارات" },
  ] },
  { icon: Bell, label: "Notifications", labelAr: "الإشعارات", path: "/notifications", children: [
    { key: "all", label: "All", labelAr: "الكل" },
    { key: "stock", label: "Stock", labelAr: "المخزون" },
    { key: "transfers", label: "Transfers", labelAr: "التحويلات" },
    { key: "sales", label: "Sales", labelAr: "المبيعات" },
    { key: "repairs", label: "Repairs", labelAr: "الصيانة" },
  ] },
  { icon: Megaphone, label: "Marketing", labelAr: "التسويق", path: "/marketing", requireFeature: 'marketing', children: [
    { key: "coupons", label: "Coupons", labelAr: "الكوبونات" },
    { key: "campaigns", label: "Campaigns", labelAr: "الحملات" },
  ] },
  { icon: Wrench, label: "Maintenance", labelAr: "الصيانة", path: "/repairs", requireFeature: 'repairs' },
  { icon: BarChart3, label: "Reports", labelAr: "التقارير", path: "/reports", requireFeature: 'reports', children: [
    { key: "sales", label: "Sales", labelAr: "المبيعات" },
    { key: "inventory", label: "Inventory", labelAr: "المخزون" },
    { key: "employees", label: "Employees", labelAr: "الموظفين" },
    { key: "deadstock", label: "Dead Stock", labelAr: "الرواكد" },
    { key: "parts", label: "Repair Parts", labelAr: "قطع الصيانة" },
  ] },
  { icon: ClipboardCheck, label: "Stocktake", labelAr: "الجرد", path: "/stocktake", requireFeature: 'stocktake' },
  { icon: Store, label: "Online Store", labelAr: "المتجر الإلكتروني", path: "/online-store", requireFeature: 'onlineStore', children: [
    { key: "general", label: "General", labelAr: "عام" },
    { key: "branding", label: "Branding", labelAr: "الهوية" },
    { key: "hero", label: "Storefront", labelAr: "الواجهة" },
    { key: "banners", label: "Banners", labelAr: "البنرات" },
    { key: "legal", label: "Legal & Tax", labelAr: "الصلاحيات والضريبة" },
    { key: "seo", label: "SEO", labelAr: "SEO" },
    { key: "pages", label: "Pages", labelAr: "الصفحات" },
    { key: "categories", label: "Categories", labelAr: "التصنيفات" },
    { key: "shipping", label: "Shipping", labelAr: "الشحن" },
    { key: "links", label: "Links", labelAr: "الروابط" },
  ] },
  { icon: ShoppingBag, label: "Online Orders", labelAr: "طلبات المتجر", path: "/online-orders", requireFeature: 'onlineStore' },
  { icon: Calculator, label: "Daily Closings", labelAr: "الإغلاق اليومي", path: "/daily-closings" },
  { icon: Heart, label: "Customers", labelAr: "العملاء والولاء", path: "/customers", requireFeature: 'customers' },
  { icon: Warehouse, label: "Wholesale", labelAr: "بيع الجملة", path: "/wholesale", requireFeature: 'wholesale', children: [
    { key: "listings", label: "My Listings", labelAr: "منتجاتي" },
    { key: "marketplace", label: "Marketplace", labelAr: "سوق الجملة" },
    { key: "my-orders", label: "My Orders", labelAr: "طلباتي" },
    { key: "incoming", label: "Incoming", labelAr: "طلبات واردة" },
    { key: "credits-out", label: "Credits Out", labelAr: "مديونيات لي" },
    { key: "credits-in", label: "Credits In", labelAr: "مديونياتي" },
  ] },
  { icon: Users, label: "Users", labelAr: "المستخدمين", path: "/users" },
  { icon: CreditCard, label: "Subscription", labelAr: "الباقات والاشتراك", path: "/subscription" },
  { icon: LifeBuoy, label: "Support", labelAr: "الدعم الفني", path: "/support" },
];

// Plan tier order: Basic=0, Professional=1, Enterprise=2, Distributor=3
const PLAN_TIERS: Record<string, number> = {
  'Basic': 0, 'Professional': 1, 'Enterprise': 2, 'Distributor': 3, 'trial': 3,
};

// Minimum plan required for each feature
const FEATURE_MIN_PLAN: Record<string, number> = {
  repairs: 1,      // باقة ب
  suppliers: 1,    // باقة ب
  transfers: 1,    // باقة ب
  stocktake: 1,    // باقة ب
  reports: 1,      // باقة ب
  marketing: 2,    // باقة ج
  customers: 2,    // باقة ج
  onlineStore: 1,  // باقة ب (from DB has_online_store)
  wholesale: 3,    // باقة الموزع (from DB has_wholesale)
};

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t, isRTL } = useLanguage();
  const { merchant, merchantUser, subscription } = useAuth();
  const isCashier = merchantUser?.role === 'cashier';
  const logoUrl = (merchant as { logo_url?: string | null } | null)?.logo_url;

  const currentPlanTier = PLAN_TIERS[subscription?.plan || 'trial'] ?? 3;

  const filteredNavItems = navItems.filter(item => {
    if (isCashier && item.path !== '/pos' && item.path !== '/daily-closings' && item.path !== '/repairs') {
      return false;
    }
    if (item.requireFeature) {
      const minTier = FEATURE_MIN_PLAN[item.requireFeature] ?? 0;
      if (currentPlanTier < minTier) return false;
    }
    return true;
  });

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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const label = isRTL ? item.labelAr : item.label;
          const showChildren = !!item.children && isActive && !isCollapsed;
          const currentTab = searchParams.get("tab") || item.children?.[0]?.key;

          return (
            <div key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  "nav-item relative group",
                  isActive && "active"
                )}
              >
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

                {item.children && !isCollapsed && (
                  <ChevronDown className={cn("w-4 h-4 opacity-60 transition-transform", showChildren && "rotate-180")} />
                )}

                {item.badge && !isCollapsed && (
                  <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    {item.badge}
                  </span>
                )}

                {item.badge && isCollapsed && (
                  <span className={cn(
                    "absolute top-1 w-2 h-2 rounded-full bg-accent",
                    isRTL ? "left-1" : "right-1"
                  )} />
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

      {/* Settings & Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {!isCashier && (
          <>
            <Link
              to="/settings"
              className={cn(
                "nav-item",
                location.pathname === "/settings" && "active"
              )}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-sm"
                  >
                    {t.nav.settings}
                  </motion.span>
                )}
              </AnimatePresence>
              {!isCollapsed && (
                <ChevronDown className={cn("w-4 h-4 opacity-60 transition-transform", location.pathname === "/settings" && "rotate-180")} />
              )}
            </Link>
            {location.pathname === "/settings" && !isCollapsed && (
              <div className={cn("space-y-0.5 py-1", isRTL ? "pr-9" : "pl-9")}>
                {[
                  { key: "business", label: "Business", labelAr: "المتجر" },
                  { key: "tax-invoice", label: "Tax & Invoice", labelAr: "الضريبة والفاتورة" },
                  { key: "printer", label: "Printer", labelAr: "الطابعة" },
                  { key: "subscription", label: "Subscription", labelAr: "الاشتراك" },
                  { key: "api", label: "Accounting API", labelAr: "API المحاسبي" },
                ].map((child) => (
                  <Link
                    key={child.key}
                    to={`/settings?tab=${child.key}`}
                    className={cn(
                      "block px-3 py-1.5 rounded-md text-sm transition-colors",
                      (searchParams.get("tab") || "business") === child.key
                        ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    {isRTL ? child.labelAr : child.label}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="nav-item w-full"
        >
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
