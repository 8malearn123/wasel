import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import DemoPlanSwitcher from "@/components/demo/DemoPlanSwitcher";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  /**
   * The page takes the full width and the sidebar is hidden — for the till,
   * where every pixel goes to products and the cart. A menu button in the
   * header opens the sidebar over the page when it is needed.
   */
  hideSidebar?: boolean;
}

export function AppLayout({ children, title, subtitle, hideSidebar = false }: AppLayoutProps) {
  const { isRTL } = useLanguage();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Picking a page from the overlay closes it
  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-background">
      {/* On a computer the sidebar stands beside the page; on a tablet or a
          phone (and on the till) it opens over the page from the menu button */}
      <div className={cn(menuOpen ? "block" : hideSidebar ? "hidden" : "hidden lg:block")}>
        <Sidebar />
      </div>
      {menuOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/40"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Main Content — beside the sidebar, as wide as it is (--sidebar-w) */}
      <div className={cn(
        "transition-all duration-300 min-w-0",
        !hideSidebar && (isRTL ? "lg:mr-[var(--sidebar-w,280px)]" : "lg:ml-[var(--sidebar-w,280px)]")
      )}>
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMenuOpen(true)}
          menuOnSmallScreens={!hideSidebar}
        />

        <main className={hideSidebar ? "p-4" : "p-4 lg:p-6"}>
          {children}
        </main>
      </div>

      {/* Demo Plan Switcher */}
      <DemoPlanSwitcher />
    </div>
  );
}
