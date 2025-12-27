import { useState, useMemo } from "react";
import type { Documento } from "@/types/database";
import { AppLayout } from "@/components/layout/AppLayout";
import { FaturaFilters } from "@/components/faturas/FaturaFilters";
import { FaturasTable } from "@/components/faturas/FaturasTable";
import { FaturaDetailDrawer } from "@/components/faturas/FaturaDetailDrawer";
import { FornecedoresSidebar } from "@/components/faturas/FornecedoresSidebar";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useDocumentos, useCategorias, useTipos } from "@/hooks/useSupabase";

export default function Faturas() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("all");
  const [selectedTipo, setSelectedTipo] = useState("all");
  const [selectedFornecedor, setSelectedFornecedor] = useState<string | null>(null);
  const [selectedFatura, setSelectedFatura] = useState<Documento | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Buscar todos os documentos (para a sidebar)
  const { data: allDocumentos = [], isLoading, error } = useDocumentos();
  const { data: categorias = [] } = useCategorias();
  const { data: tipos = [] } = useTipos();

  // Filtrar documentos localmente
  const filteredDocumentos = useMemo(() => {
    return allDocumentos.filter((doc) => {
      // Filtro por fornecedor (sidebar)
      if (selectedFornecedor && doc.fornecedor !== selectedFornecedor) {
        return false;
      }
      // Filtro por pesquisa
      if (searchQuery && !doc.fornecedor.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Filtro por categoria
      if (selectedCategoria !== "all" && doc.categoria !== selectedCategoria) {
        return false;
      }
      // Filtro por tipo
      if (selectedTipo !== "all" && doc.tipo !== selectedTipo) {
        return false;
      }
      return true;
    });
  }, [allDocumentos, selectedFornecedor, searchQuery, selectedCategoria, selectedTipo]);

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
      <div className="flex h-[calc(100vh-4rem)] -m-6">
        {/* Sidebar de Fornecedores */}
        <FornecedoresSidebar
          documentos={allDocumentos}
          selectedFornecedor={selectedFornecedor}
          onSelectFornecedor={setSelectedFornecedor}
        />

        {/* Conteúdo principal */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {selectedFornecedor ? selectedFornecedor : "Faturas"}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {selectedFornecedor 
                  ? `Faturas de ${selectedFornecedor}`
                  : "Consulte e gerencie todas as suas faturas"
                }
              </p>
            </div>

            {/* Filters */}
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

            {/* Results count */}
            <div className="flex items-center justify-between animate-fade-in" style={{ animationDelay: "100ms" }}>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "A carregar..." : `${filteredDocumentos.length} ${filteredDocumentos.length === 1 ? "resultado" : "resultados"} encontrados`}
              </p>
            </div>

            {/* Table */}
            <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
              {isLoading ? (
                <LoadingState message="A carregar faturas..." />
              ) : (
                <FaturasTable 
                  faturas={filteredDocumentos} 
                  onViewDetails={handleViewDetails} 
                />
              )}
            </div>
          </div>
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
