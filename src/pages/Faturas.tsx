import { useState } from "react";
import { AppLayout } from "@/components/common/AppLayout";
import { FaturaFilters } from "@/features/faturas/FaturaFilters";
import { FaturasTable } from "@/features/faturas/FaturasTable";
import { FaturaDetailDrawer } from "@/features/faturas/FaturaDetailDrawer";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { useDocumentosFiltered, useCategorias, useTipos, useAnos } from "@/features/faturas/hooks/useFaturas";
import { useSearchParams } from "react-router-dom";
import type { Invoice } from "@/types/database";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { FileArchive } from "lucide-react";
import { exportInvoicesToZip } from "@/lib/sync/export-zip";
import { toast } from "sonner";

export default function Faturas() {
  const [searchParams] = useSearchParams();
  const fornecedorFromUrl = searchParams.get("fornecedor");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("all");
  const [selectedTipo, setSelectedTipo] = useState("all");
  const [selectedAno, setSelectedAno] = useState("all");
  const [selectedMes, setSelectedMes] = useState("all");
  const [selectedFatura, setSelectedFatura] = useState<Invoice | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: documentos, isLoading, error } = useDocumentosFiltered({
    search: fornecedorFromUrl || searchQuery,
    categoria: selectedCategoria,
    tipo: selectedTipo,
    ano: selectedAno !== "all" ? selectedAno : undefined,
    mes: selectedMes !== "all" ? selectedMes : undefined,
  });

  const { data: categorias = [] } = useCategorias();
  const { data: tipos = [] } = useTipos();
  const { data: anos = [] } = useAnos();

  const handleViewDetails = (fatura: Invoice) => {
    setSelectedFatura(fatura);
    setDrawerOpen(true);
  };

  const { providerToken } = useAuth();

  const handleExportZip = async () => {
    if (!documentos || documentos.length === 0) {
      toast.error("Não há faturas para exportar");
      return;
    }

    if (!providerToken) {
      toast.error("Conecte a sua conta Google para exportar as faturas");
      return;
    }

    setIsExporting(true);
    try {
      const zipName = `faturas_${selectedAno !== 'all' ? selectedAno : 'total'}${selectedMes !== 'all' ? '_' + selectedMes : ''}.zip`;
      await exportInvoicesToZip(documentos, providerToken, zipName);
    } catch (err) {
      console.error("Erro na exportação:", err);
      toast.error("Ocorreu um erro ao gerar o ficheiro ZIP");
    } finally {
      setIsExporting(false);
    }
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
              : "Faturas"
            }
          </h1>
          <p className="mt-1 text-muted-foreground">
            {fornecedorFromUrl
              ? `Faturas de ${fornecedorFromUrl}`
              : "Consulte e gerencie todas as suas faturas"
            }
          </p>
        </div>

        {/* Filters */}
        {!fornecedorFromUrl && (
          <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
            <FaturaFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategoria={selectedCategoria}
              onCategoriaChange={setSelectedCategoria}
              selectedTipo={selectedTipo}
              onTipoChange={setSelectedTipo}
              selectedAno={selectedAno}
              onAnoChange={(value) => {
                setSelectedAno(value);
              }}
              selectedMes={selectedMes}
              onMesChange={setSelectedMes}
              categorias={categorias}
              tipos={tipos}
              anos={anos}
            />
          </div>
        )}

        {/* Results count & Actions */}
        <div className="flex items-center justify-between animate-fade-in" style={{ animationDelay: "100ms" }}>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "A carregar..." : `${documentos?.length || 0} ${(documentos?.length || 0) === 1 ? "resultado" : "resultados"} encontrados`}
          </p>

          {documentos && documentos.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-primary/20 hover:bg-primary/5 text-primary"
              onClick={handleExportZip}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  A exportar...
                </>
              ) : (
                <>
                  <FileArchive className="h-4 w-4" />
                  Exportar ZIP
                </>
              )}
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
          {isLoading ? (
            <LoadingState message="A carregar faturas..." />
          ) : (
            <FaturasTable
              faturas={documentos || []}
              onViewDetail={handleViewDetails}
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
