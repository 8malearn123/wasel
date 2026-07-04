import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Building2, CreditCard, Activity, Package,
  Wallet, LifeBuoy, ChevronLeft, ChevronRight, Shield,
  LogOut, Settings, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface AdminNavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const adminNavItems: AdminNavItem[] = [
  { icon: LayoutDashboard, label: "نظرة عامة", path: "/admin" },
  { icon: Building2, label: "الشركات", path: "/admin/companies" },
  { icon: CreditCard, label: "الباقات", path: "/admin/plans" },
  { icon: Package, label: "طلبات الفروع", path: "/admin/branch-requests" },
  { icon: Wallet, label: "المدفوعات", path: "/admin/payouts" },
  { icon: BarChart3, label: "التقارير", path: "/admin/reports" },
  { icon: Activity, label: "سجل النشاط", path: "/admin/activity" },
  { icon: LifeBuoy, label: "تذاكر الدعم", path: "/admin/tickets" },
];

export function AdminLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Admin Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed top-0 right-0 h-screen bg-[hsl(220,30%,8%)] z-50 flex flex-col border-l border-[hsl(220,20%,15%)]"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[hsl(220,20%,15%)]">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm">لوحة الإدارة</span>
                  <span className="text-[10px] text-gray-500 tracking-wider">ADMIN PANEL</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isCollapsed && (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg mx-auto">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {adminNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-amber-500/15 text-amber-400 font-medium"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isCollapsed && (
                  <div className="absolute right-full mr-2 px-3 py-2 bg-popover text-popover-foreground rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 text-sm">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[hsl(220,20%,15%)] space-y-1">
          <button onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-white/5 hover:text-red-400 transition-all w-full">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm">تسجيل الخروج</span>}
          </button>
          <button onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-white/5 transition-all w-full">
            {isCollapsed ? <ChevronLeft className="w-5 h-5 mx-auto" /> : <><ChevronRight className="w-5 h-5" /><span className="text-sm">طي</span></>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={cn("flex-1 transition-all duration-300", isCollapsed ? "mr-[80px]" : "mr-[260px]")}>
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
          <div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-500" />
            </div>
          </div>
        </header>

        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
