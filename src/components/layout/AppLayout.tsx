import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import DemoPlanSwitcher from "@/components/demo/DemoPlanSwitcher";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="transition-all duration-300 ml-[280px]">
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
