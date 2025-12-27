import { useMemo } from "react";
import { Building2, ChevronRight } from "lucide-react";
import type { Documento } from "@/types/database";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FornecedoresSidebarProps {
  documentos: Documento[];
  selectedFornecedor: string | null;
  onSelectFornecedor: (fornecedor: string | null) => void;
}

interface FornecedorStats {
  nome: string;
  count: number;
  total: number;
}

export function FornecedoresSidebar({
  documentos,
  selectedFornecedor,
  onSelectFornecedor,
}: FornecedoresSidebarProps) {
  const fornecedoresStats = useMemo(() => {
    const stats: Record<string, FornecedorStats> = {};

    documentos.forEach((doc) => {
      const nome = doc.fornecedor;
      if (!stats[nome]) {
        stats[nome] = { nome, count: 0, total: 0 };
      }
      stats[nome].count += 1;
      stats[nome].total += doc.total;
    });

    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [documentos]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      signDisplay: "always",
    }).format(value);
  };

  return (
    <div className="w-64 shrink-0 border-r border-border bg-card/50">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Fornecedores
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {fornecedoresStats.length} fornecedores
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-16rem)]">
        <div className="p-2 space-y-1">
          {/* All suppliers option */}
          <button
            onClick={() => onSelectFornecedor(null)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
              "hover:bg-muted/80",
              selectedFornecedor === null
                ? "bg-primary/10 border border-primary/20"
                : "border border-transparent"
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn(
                "font-medium text-sm",
                selectedFornecedor === null ? "text-primary" : "text-foreground"
              )}>
                Todos
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {documentos.length}
              </span>
            </div>
          </button>

          {/* Individual suppliers */}
          {fornecedoresStats.map((forn) => (
            <button
              key={forn.nome}
              onClick={() => onSelectFornecedor(forn.nome)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg transition-colors group",
                "hover:bg-muted/80",
                selectedFornecedor === forn.nome
                  ? "bg-primary/10 border border-primary/20"
                  : "border border-transparent"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "font-medium text-sm truncate max-w-[140px]",
                  selectedFornecedor === forn.nome ? "text-primary" : "text-foreground"
                )}>
                  {forn.nome}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {forn.count}
                  </span>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    selectedFornecedor === forn.nome 
                      ? "text-primary rotate-90" 
                      : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  )} />
                </div>
              </div>
              <div className={cn(
                "text-xs mt-1",
                forn.total >= 0 ? "text-accent" : "text-destructive"
              )}>
                {formatCurrency(forn.total)}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
