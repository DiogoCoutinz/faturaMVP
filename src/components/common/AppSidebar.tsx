import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Bot,
  Building2,
  ChevronLeft,
  Menu,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Faturas", href: "/faturas", icon: FileText },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Automações", href: "/automations", icon: Bot },
];

interface FornecedorStats {
  nome: string;
  count: number;
}

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  isMobileMenuOpen?: boolean;
}

export function AppSidebar({ isCollapsed, onToggle, isMobile, isMobileMenuOpen }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signOut } = useAuth();

  const currentFornecedor = searchParams.get("fornecedor");

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Mobile: show as overlay menu, Desktop: show as sidebar
  if (isMobile) {
    return (
      <>
        {/* Mobile Header Bar */}
        <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-sidebar-accent-foreground">FaturaAI</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {/* Mobile Menu Overlay */}
        <aside className={cn(
          "fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* Navigation */}
          <nav className="space-y-1 px-3 py-4 shrink-0">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href && !currentFornecedor;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onToggle}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          <ScrollArea className="flex-1 px-3 border-t border-sidebar-border pt-4" />

          {/* Footer */}
          <div className="border-t border-sidebar-border p-4 shrink-0">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </aside>

        {/* Spacer for fixed header */}
        <div className="h-14" />
      </>
    );
  }

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Logo Area */}
      <div className={cn(
        "flex h-16 items-center border-b border-sidebar-border shrink-0 transition-all duration-300",
        isCollapsed ? "justify-center px-0" : "px-6 justify-between"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 animate-fade-in overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold leading-tight text-sidebar-accent-foreground truncate">__PLACEHOLDER_TEAM_NAME__</h1>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 font-medium truncate">Gestão de Faturas</p>
            </div>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggle}
          className={cn(
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0",
            isCollapsed ? "" : "ml-2"
          )}
        >
          {isCollapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 px-3 py-4 shrink-0 overflow-hidden">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href && !currentFornecedor;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? item.name : ""}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "" : "")} />
              {!isCollapsed && <span className="animate-fade-in">{item.name}</span>}
              
              {isCollapsed && isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary-foreground rounded-r-full" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Sections */}
      <ScrollArea className="flex-1 px-3 border-t border-sidebar-border pt-4">
        {/* Espaço para futuras secções */}
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 shrink-0 overflow-hidden">
        {isCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
            <div className="rounded-lg bg-sidebar-accent/50 p-3 text-center">
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest font-semibold">
                Equipa FB • 2026
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
