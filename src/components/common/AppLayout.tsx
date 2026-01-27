import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Renovar tokens expirados automaticamente quando a app carrega
  useTokenRefresh();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <main className={cn(
        "transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "pl-20" : "pl-64"
      )}>
        <div className="min-h-screen p-6 lg:p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
