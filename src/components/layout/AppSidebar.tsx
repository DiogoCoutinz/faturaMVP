import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Zap,
  Building2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentos } from "@/hooks/useSupabase";
import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Faturas", href: "/faturas", icon: FileText },
  { name: "Upload", href: "/upload", icon: Upload },
];

interface FornecedorStats {
  nome: string;
  count: number;
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [fornecedoresOpen, setFornecedoresOpen] = useState(true);
  
  const { data: documentos = [] } = useDocumentos();

  const fornecedoresStats = useMemo(() => {
    const stats: Record<string, FornecedorStats> = {};

    documentos.forEach((doc) => {
      const nome = doc.fornecedor;
      if (!stats[nome]) {
        stats[nome] = { nome, count: 0 };
      }
      stats[nome].count += 1;
    });

    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [documentos]);

  const handleFornecedorClick = (fornecedor: string) => {
    navigate(`/faturas?fornecedor=${encodeURIComponent(fornecedor)}`);
  };

  // Check if current route is a fornecedor filter
  const searchParams = new URLSearchParams(location.search);
  const currentFornecedor = searchParams.get("fornecedor");

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-accent-foreground">FaturaAI</h1>
          <p className="text-xs text-sidebar-foreground/60">Gestão inteligente</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 px-3 py-4 shrink-0">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href && !currentFornecedor;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* Fornecedores Section */}
      <div className="flex-1 overflow-hidden px-3 border-t border-sidebar-border pt-4">
        <Collapsible open={fornecedoresOpen} onOpenChange={setFornecedoresOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Fornecedores</span>
              <span className="text-xs bg-sidebar-accent px-1.5 py-0.5 rounded-full">
                {fornecedoresStats.length}
              </span>
            </div>
            {fornecedoresOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <ScrollArea className="h-[calc(100vh-22rem)]">
              <div className="space-y-0.5 py-2">
                {fornecedoresStats.map((forn) => {
                  const isActive = currentFornecedor === forn.nome;
                  return (
                    <button
                      key={forn.nome}
                      onClick={() => handleFornecedorClick(forn.nome)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className="truncate max-w-[140px]">{forn.nome}</span>
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full",
                        isActive 
                          ? "bg-sidebar-primary-foreground/20" 
                          : "bg-sidebar-accent"
                      )}>
                        {forn.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 shrink-0">
        <div className="rounded-lg bg-sidebar-accent/50 p-3">
          <p className="text-xs text-sidebar-foreground/70">
            Versão Beta • 2025
          </p>
        </div>
      </div>
    </aside>
  );
}
