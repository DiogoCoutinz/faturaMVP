import { useState } from "react";
import { Search, Users, FileText, Euro, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useClientesDerivados } from "@/hooks/useSupabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Clientes() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const { data: clientes, isLoading, error } = useClientesDerivados(searchQuery);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handleViewDocumentos = (clienteNome: string) => {
    navigate(`/faturas?cliente=${encodeURIComponent(clienteNome)}`);
  };

  if (error) {
    console.error('Erro na página Clientes:', error);
    return (
      <AppLayout>
        <ErrorState 
          title="Erro ao carregar clientes"
          description={`${error.message || 'Não foi possível carregar os clientes.'} Verifique se RLS está configurado corretamente.`} 
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="mt-1 text-muted-foreground">
            Lista de clientes derivada dos documentos
          </p>
        </div>

        {/* Search */}
        <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>

        {/* Results count */}
        <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "A carregar..." : `${clientes?.length || 0} ${(clientes?.length || 0) === 1 ? "cliente" : "clientes"} encontrados`}
          </p>
        </div>

        {/* Table */}
        <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
          {isLoading ? (
            <LoadingState message="A carregar clientes..." />
          ) : clientes && clientes.length > 0 ? (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/30">
                    <TableHead className="text-muted-foreground font-semibold">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Nome
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground font-semibold text-center">
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" />
                        Documentos
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground font-semibold text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Euro className="h-4 w-4" />
                        Total Gasto
                      </div>
                    </TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente, index) => (
                    <TableRow
                      key={cliente.nome}
                      className="animate-fade-in cursor-pointer hover:bg-muted/50"
                      style={{ animationDelay: `${index * 30}ms` }}
                      onClick={() => handleViewDocumentos(cliente.nome)}
                    >
                      <TableCell className="font-medium text-card-foreground">
                        {cliente.nome}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {cliente.totalDocumentos}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(cliente.totalGasto)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDocumentos(cliente.nome);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="Nenhum cliente encontrado"
              description="Não existem documentos registados ou que correspondam à pesquisa."
              icon={<Users className="h-8 w-8 text-muted-foreground" />}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
