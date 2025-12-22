import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { Documento } from "@/types/database";
import { AppLayout } from "@/components/layout/AppLayout";
import { FaturaFilters } from "@/components/faturas/FaturaFilters";
import { FaturasTable } from "@/components/faturas/FaturasTable";
import { FaturaDetailDrawer } from "@/components/faturas/FaturaDetailDrawer";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useDocumentosFiltered, useCategorias, useTipos, useClienteNames } from "@/hooks/useSupabase";

export default function Faturas() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("all");
  const [selectedTipo, setSelectedTipo] = useState("all");
  const [selectedCliente, setSelectedCliente] = useState("all");
  const [selectedFatura, setSelectedFatura] = useState<Documento | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Read cliente filter from URL params
  useEffect(() => {
    const clienteFromUrl = searchParams.get("cliente");
    if (clienteFromUrl) {
      setSelectedCliente(clienteFromUrl);
    }
  }, [searchParams]);

  const { data: documentos, isLoading, error } = useDocumentosFiltered({
    search: searchQuery,
    categoria: selectedCategoria,
    tipo: selectedTipo,
    cliente: selectedCliente,
  });

  const { data: categorias = [] } = useCategorias();
  const { data: tipos = [] } = useTipos();
  const { data: clientes = [] } = useClienteNames();

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Faturas</h1>
          <p className="mt-1 text-muted-foreground">
            Consulte e gerencie todas as suas faturas
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
            selectedCliente={selectedCliente}
            onClienteChange={setSelectedCliente}
            categorias={categorias}
            tipos={tipos}
            clientes={clientes}
          />
        </div>

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
