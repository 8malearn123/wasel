import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
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


interface NavItem {
  icon: React.ElementType;
  label: string;
  labelAr: string;
  path: string;
  badge?: number;
  requireFeature?: 'onlineStore' | 'wholesale' | 'repairs' | 'suppliers' | 'marketing' | 'stocktake' | 'customers' | 'reports' | 'transfers';
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", labelAr: "لوحة التحكم", path: "/" },
  { icon: ShoppingCart, label: "Point of Sale", labelAr: "نقطة البيع", path: "/pos" },
  { icon: Package, label: "Inventory", labelAr: "المخزون", path: "/inventory" },
  { icon: Building2, label: "Branches", labelAr: "الفروع", path: "/branches" },
  { icon: ArrowLeftRight, label: "Transfers", labelAr: "التحويلات", path: "/transfers", requireFeature: 'transfers' },
  { icon: Truck, label: "Suppliers", labelAr: "الموردين", path: "/suppliers", requireFeature: 'suppliers' },
  { icon: Barcode, label: "Verification Codes", labelAr: "أكواد التحقق", path: "/labels" },
  { icon: Bell, label: "Notifications", labelAr: "الإشعارات", path: "/notifications" },
  { icon: Megaphone, label: "Marketing", labelAr: "التسويق", path: "/marketing", requireFeature: 'marketing' },
  { icon: Wrench, label: "Maintenance", labelAr: "الصيانة", path: "/repairs", requireFeature: 'repairs' },
  { icon: BarChart3, label: "Reports", labelAr: "التقارير", path: "/reports", requireFeature: 'reports' },
  { icon: ClipboardCheck, label: "Stocktake", labelAr: "الجرد", path: "/stocktake", requireFeature: 'stocktake' },
  { icon: Store, label: "Online Store", labelAr: "المتجر الإلكتروني", path: "/online-store", requireFeature: 'onlineStore' },
  { icon: ShoppingBag, label: "Online Orders", labelAr: "طلبات المتجر", path: "/online-orders", requireFeature: 'onlineStore' },
  { icon: Calculator, label: "Daily Closings", labelAr: "الإغلاق اليومي", path: "/daily-closings" },
  { icon: Heart, label: "Customers", labelAr: "العملاء والولاء", path: "/customers", requireFeature: 'customers' },
  { icon: Warehouse, label: "Wholesale", labelAr: "بيع الجملة", path: "/wholesale", requireFeature: 'wholesale' },
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
  const { t, isRTL } = useLanguage();
  const { merchantUser, subscription } = useAuth();
  const isCashier = merchantUser?.role === 'cashier';

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
      className="fixed top-0 left-0 h-screen bg-sidebar z-50 flex flex-col border-r border-sidebar-border"
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
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sidebar-foreground text-sm">وصل</span>
                <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">نظام محلات الجوالات</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isCollapsed && (
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mx-auto">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const label = isRTL ? item.labelAr : item.label;
          
          return (
            <Link
              key={item.path}
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

              {item.badge && !isCollapsed && (
                <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                  {item.badge}
                </span>
              )}

              {item.badge && isCollapsed && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
              )}

              {isCollapsed && (
                <div className="absolute left-full ml-2 px-3 py-2 bg-popover text-popover-foreground rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 text-sm">
                  {label}
                </div>
              )}
            </Link>
          );
        })}

      </nav>

      {/* Settings & Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {!isCashier && (
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
                  className="text-sm"
                >
                  {t.nav.settings}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="nav-item w-full"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 mx-auto" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">{t.nav.collapse}</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
