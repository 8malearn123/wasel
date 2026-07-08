import {
  Bell, Search, User, Building2, Languages, Sun, Moon, LayoutGrid,
  LayoutDashboard, ShoppingCart, Package, ArrowLeftRight, Truck, Barcode,
  Megaphone, Wrench, BarChart3, ClipboardCheck, Store, ShoppingBag,
  Calculator, Heart, Warehouse, Users, CreditCard, LifeBuoy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const SECTIONS = [
  { icon: LayoutDashboard, label: "Dashboard", labelAr: "لوحة التحكم", path: "/" },
  { icon: ShoppingCart, label: "Point of Sale", labelAr: "نقطة البيع", path: "/pos" },
  { icon: Package, label: "Inventory", labelAr: "المخزون", path: "/inventory" },
  { icon: Building2, label: "Branches", labelAr: "الفروع", path: "/branches" },
  { icon: ArrowLeftRight, label: "Transfers", labelAr: "التحويلات", path: "/transfers" },
  { icon: Truck, label: "Suppliers", labelAr: "الموردين", path: "/suppliers" },
  { icon: Barcode, label: "Verification Codes", labelAr: "أكواد التحقق", path: "/labels" },
  { icon: Megaphone, label: "Marketing", labelAr: "التسويق", path: "/marketing" },
  { icon: Wrench, label: "Maintenance", labelAr: "الصيانة", path: "/repairs" },
  { icon: BarChart3, label: "Reports", labelAr: "التقارير", path: "/reports" },
  { icon: ClipboardCheck, label: "Stocktake", labelAr: "الجرد", path: "/stocktake" },
  { icon: Store, label: "Online Store", labelAr: "المتجر الإلكتروني", path: "/online-store" },
  { icon: ShoppingBag, label: "Online Orders", labelAr: "طلبات المتجر", path: "/online-orders" },
  { icon: Calculator, label: "Daily Closings", labelAr: "الإغلاق اليومي", path: "/daily-closings" },
  { icon: Heart, label: "Customers", labelAr: "العملاء والولاء", path: "/customers" },
  { icon: Warehouse, label: "Wholesale", labelAr: "بيع الجملة", path: "/wholesale" },
  { icon: Users, label: "Users", labelAr: "المستخدمين", path: "/users" },
  { icon: CreditCard, label: "Subscription", labelAr: "الباقات والاشتراك", path: "/subscription" },
  { icon: LifeBuoy, label: "Support", labelAr: "الدعم الفني", path: "/support" },
];

// Routes a cashier can open without being bounced back to the POS
const CASHIER_PATHS = new Set(["/pos", "/repairs", "/daily-closings", "/support"]);

export function Header({ title, subtitle }: HeaderProps) {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { signOut, merchantUser } = useAuth();
  const navigate = useNavigate();

  const isCashier = merchantUser?.role === "cashier";
  const visibleSections = isCashier
    ? SECTIONS.filter((s) => CASHIER_PATHS.has(s.path))
    : SECTIONS;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Browse Sections */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 touch-target">
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">
                {language === 'ar' ? 'تصفح الأقسام' : 'Browse Sections'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-[420px]">
            <DropdownMenuLabel>
              {language === 'ar' ? 'أقسام النظام' : 'System Sections'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="grid grid-cols-2 gap-1 p-1 max-h-[60vh] overflow-y-auto">
              {visibleSections.map((s) => (
                <DropdownMenuItem
                  key={s.path}
                  onSelect={() => navigate(s.path)}
                  className="gap-2 cursor-pointer"
                >
                  <s.icon className="w-4 h-4 text-primary" />
                  <span>{language === 'ar' ? s.labelAr : s.label}</span>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
            isRTL ? "right-3" : "left-3"
          )} />
          <Input
            placeholder={t.common.search}
            className={cn(
              "w-80 bg-muted/50 border-transparent focus:border-primary",
              isRTL ? "pr-9" : "pl-9"
            )}
          />
        </div>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="touch-target"
          onClick={toggleTheme}
          title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="touch-target">
              <Languages className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>{t.common.language}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setLanguage("en")}
              className={cn(language === "en" && "bg-primary/10 text-primary")}
            >
              {t.common.english}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLanguage("ar")}
              className={cn(language === "ar" && "bg-primary/10 text-primary")}
            >
              {t.common.arabic}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Branch Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 touch-target">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t.common.mainStore}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{t.common.switchBranch}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t.common.mainStore}</DropdownMenuItem>
            <DropdownMenuItem>{t.common.downtownBranch}</DropdownMenuItem>
            <DropdownMenuItem>{t.common.mallKiosk}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-primary">
              {t.common.viewAllBranches}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative touch-target">
          <Bell className="w-5 h-5" />
          <span className={cn(
            "absolute top-1 w-2 h-2 rounded-full bg-accent animate-pulse",
            isRTL ? "left-1" : "right-1"
          )} />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 touch-target">
              <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline text-sm font-medium">{t.common.admin}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{t.common.myAccount}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t.common.profile}</DropdownMenuItem>
            <DropdownMenuItem>{t.common.settings}</DropdownMenuItem>
            <DropdownMenuItem>{t.common.activityLog}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
              {t.common.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
