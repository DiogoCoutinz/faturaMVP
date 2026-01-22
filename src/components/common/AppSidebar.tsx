import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Settings,
  Bot,
  Building2,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Faturas", href: "/faturas", icon: FileText },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Automações", href: "/automations", icon: Bot },
  { name: "Definições", href: "/settings", icon: Settings },
];

interface FornecedorStats {
  nome: string;
  count: number;
}

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const currentFornecedor = searchParams.get("fornecedor");

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
              <h1 className="text-sm font-bold leading-tight text-sidebar-accent-foreground truncate">Equipa Francisco Brito</h1>
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
      <div className="border-t border-sidebar-border p-4 shrink-0 overflow-hidden text-center">
        {isCollapsed ? (
          <div className="mx-auto h-2 w-2 rounded-full bg-sidebar-primary" />
        ) : (
          <div className="rounded-lg bg-sidebar-accent/50 p-3 animate-fade-in text-center">
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest font-semibold">
              Equipa FB • 2026
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
