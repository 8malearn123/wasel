import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import DemoPlanSwitcher from "@/components/demo/DemoPlanSwitcher";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        isRTL ? "mr-[280px]" : "ml-[280px]"
      )}>
        <Header title={title} subtitle={subtitle} />
        
        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Demo Plan Switcher */}
      <DemoPlanSwitcher />
    </div>
  );
}
