import { ReactNode, useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(true);
      setIsMobileMenuOpen(false);
    }
  }, [isMobile]);

  // Renovar tokens expirados automaticamente quando a app carrega
  useTokenRefresh();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <AppSidebar
        isCollapsed={isMobile ? !isMobileMenuOpen : isSidebarCollapsed}
        onToggle={() => {
          if (isMobile) {
            setIsMobileMenuOpen(!isMobileMenuOpen);
          } else {
            setIsSidebarCollapsed(!isSidebarCollapsed);
          }
        }}
        isMobile={isMobile}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      <main className={cn(
        "transition-all duration-300 ease-in-out",
        isMobile ? "pl-0" : (isSidebarCollapsed ? "pl-20" : "pl-64")
      )}>
        <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
