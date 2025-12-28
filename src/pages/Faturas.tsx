import { useState } from "react";
import type { Documento } from "@/types/database";
import { AppLayout } from "@/components/layout/AppLayout";
import { FaturaFilters } from "@/components/faturas/FaturaFilters";
import { FaturasTable } from "@/components/faturas/FaturasTable";
import { FaturaDetailDrawer } from "@/components/faturas/FaturaDetailDrawer";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useDocumentosFiltered, useCategorias, useTipos } from "@/hooks/useSupabase";
import { useSearchParams } from "react-router-dom";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Faturas() {
  const [searchParams] = useSearchParams();
  const fornecedorFromUrl = searchParams.get("fornecedor");
  const anoFromUrl = searchParams.get("ano");
  const mesFromUrl = searchParams.get("mes");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("all");
  const [selectedTipo, setSelectedTipo] = useState("all");
  const [selectedFatura, setSelectedFatura] = useState<Documento | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: documentos, isLoading, error } = useDocumentosFiltered({
    search: fornecedorFromUrl || searchQuery,
    categoria: selectedCategoria,
    tipo: selectedTipo,
    ano: anoFromUrl || undefined,
    mes: mesFromUrl || undefined,
  });

  const { data: categorias = [] } = useCategorias();
  const { data: tipos = [] } = useTipos();

  const handleViewDetails = (fatura: Documento) => {
    setSelectedFatura(fatura);
    setDrawerOpen(true);
  };

  if (error) {
    return (
      <AppLayout>
        <ErrorState description={error instanceof Error ? error.message : "Não foi possível carregar as faturas."} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {fornecedorFromUrl 
              ? fornecedorFromUrl 
              : anoFromUrl 
                ? mesFromUrl 
                  ? `${MESES[parseInt(mesFromUrl) - 1]} ${anoFromUrl}`
                  : `Ano ${anoFromUrl}`
                : "Faturas"
            }
          </h1>
          <p className="mt-1 text-muted-foreground">
            {fornecedorFromUrl 
              ? `Faturas de ${fornecedorFromUrl}`
              : anoFromUrl
                ? mesFromUrl
                  ? `Faturas de ${MESES[parseInt(mesFromUrl) - 1]} de ${anoFromUrl}`
                  : `Todas as faturas de ${anoFromUrl}`
                : "Consulte e gerencie todas as suas faturas"
            }
          </p>
        </div>

        {/* Filters */}
        {!fornecedorFromUrl && !anoFromUrl && (
          <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
            <FaturaFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategoria={selectedCategoria}
              onCategoriaChange={setSelectedCategoria}
              selectedTipo={selectedTipo}
              onTipoChange={setSelectedTipo}
              categorias={categorias}
              tipos={tipos}
            />
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between animate-fade-in" style={{ animationDelay: "100ms" }}>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "A carregar..." : `${documentos?.length || 0} ${(documentos?.length || 0) === 1 ? "resultado" : "resultados"} encontrados`}
          </p>
        </div>

        {/* Table */}
        <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
          {isLoading ? (
            <LoadingState message="A carregar faturas..." />
          ) : (
            <FaturasTable 
              faturas={documentos || []} 
              onViewDetails={handleViewDetails} 
            />
          )}
        </div>
      </div>

      <FaturaDetailDrawer
        fatura={selectedFatura}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </AppLayout>
  );
}
