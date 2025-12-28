import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Zap,
  Building2,
  ChevronDown,
  ChevronRight,
  Calendar,
  CalendarDays
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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [fornecedoresOpen, setFornecedoresOpen] = useState(true);
  const [anosOpen, setAnosOpen] = useState(false);
  const [expandedAnos, setExpandedAnos] = useState<number[]>([]);
  
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

  // Extrair anos e meses dos documentos
  const anosComMeses = useMemo(() => {
    const anosMap: Record<number, Set<number>> = {};
    
    documentos.forEach((doc) => {
      if (doc.data_doc) {
        const date = new Date(doc.data_doc);
        const ano = date.getFullYear();
        const mes = date.getMonth() + 1;
        
        if (!anosMap[ano]) {
          anosMap[ano] = new Set();
        }
        anosMap[ano].add(mes);
      }
    });

    return Object.entries(anosMap)
      .map(([ano, meses]) => ({
        ano: parseInt(ano),
        meses: Array.from(meses).sort((a, b) => b - a)
      }))
      .sort((a, b) => b.ano - a.ano);
  }, [documentos]);

  const handleFornecedorClick = (fornecedor: string) => {
    navigate(`/faturas?fornecedor=${encodeURIComponent(fornecedor)}`);
  };

  const handleAnoClick = (ano: number) => {
    navigate(`/faturas?ano=${ano}`);
  };

  const handleMesClick = (ano: number, mes: number) => {
    navigate(`/faturas?ano=${ano}&mes=${mes}`);
  };

  const toggleAnoExpanded = (ano: number) => {
    setExpandedAnos(prev => 
      prev.includes(ano) ? prev.filter(a => a !== ano) : [...prev, ano]
    );
  };

  const currentFornecedor = searchParams.get("fornecedor");
  const currentAno = searchParams.get("ano");
  const currentMes = searchParams.get("mes");

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

      {/* Sidebar Sections */}
      <ScrollArea className="flex-1 px-3 border-t border-sidebar-border pt-4">
        {/* Fornecedores Section */}
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
            <div className="space-y-0.5 py-2 max-h-48 overflow-y-auto">
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
          </CollapsibleContent>
        </Collapsible>

        {/* Anos Section */}
        <Collapsible open={anosOpen} onOpenChange={setAnosOpen} className="mt-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Por Data</span>
              <span className="text-xs bg-sidebar-accent px-1.5 py-0.5 rounded-full">
                {anosComMeses.length}
              </span>
            </div>
            {anosOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="space-y-1 py-2">
              {anosComMeses.map(({ ano, meses }) => {
                const isAnoActive = currentAno === ano.toString() && !currentMes;
                const isAnoExpanded = expandedAnos.includes(ano);
                
                return (
                  <div key={ano}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleAnoExpanded(ano)}
                        className="p-1 hover:bg-sidebar-accent rounded"
                      >
                        {isAnoExpanded ? (
                          <ChevronDown className="h-3 w-3 text-sidebar-foreground/60" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-sidebar-foreground/60" />
                        )}
                      </button>
                      <button
                        onClick={() => handleAnoClick(ano)}
                        className={cn(
                          "flex-1 text-left px-2 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between",
                          isAnoActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <span className="font-medium">{ano}</span>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full",
                          isAnoActive 
                            ? "bg-sidebar-primary-foreground/20" 
                            : "bg-sidebar-accent"
                        )}>
                          {meses.length}
                        </span>
                      </button>
                    </div>
                    
                    {isAnoExpanded && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {meses.map((mes) => {
                          const isMesActive = currentAno === ano.toString() && currentMes === mes.toString();
                          return (
                            <button
                              key={`${ano}-${mes}`}
                              onClick={() => handleMesClick(ano, mes)}
                              className={cn(
                                "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2",
                                isMesActive
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              )}
                            >
                              <CalendarDays className="h-3 w-3" />
                              {MESES[mes - 1]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </ScrollArea>

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
