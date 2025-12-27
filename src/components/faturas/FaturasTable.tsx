import { useState, useMemo } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ExternalLink, FileText, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from "lucide-react";
import type { Documento } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FaturasTableProps {
  faturas: Documento[];
  onViewDetails: (fatura: Documento) => void;
}

type SortField = "data_doc" | "total" | "fornecedor" | null;
type SortDirection = "asc" | "desc";

export function FaturasTable({ faturas, onViewDetails }: FaturasTableProps) {
  const [sortField, setSortField] = useState<SortField>("data_doc");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  // VENDA = receita (verde), COMPRA = despesa (vermelho)
  const getValueColor = (tipo: string | null) => {
    if (tipo === "COMPRA") return "text-destructive";
    if (tipo === "VENDA") return "text-accent";
    return "text-card-foreground";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedFaturas = useMemo(() => {
    if (!sortField) return faturas;
    
    return [...faturas].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === "data_doc") {
        comparison = new Date(a.data_doc).getTime() - new Date(b.data_doc).getTime();
      } else if (sortField === "total") {
        comparison = a.total - b.total;
      } else if (sortField === "fornecedor") {
        comparison = a.fornecedor.localeCompare(b.fornecedor);
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [faturas, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="ml-1 h-3 w-3" /> 
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  if (faturas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-card-foreground">Nenhuma fatura encontrada</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tente ajustar os filtros ou adicionar novas faturas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/30">
            <TableHead 
              className="text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort("data_doc")}
            >
              <div className="flex items-center">
                Data
                <SortIcon field="data_doc" />
              </div>
            </TableHead>
            <TableHead 
              className="text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort("fornecedor")}
            >
              <div className="flex items-center">
                Fornecedor
                <SortIcon field="fornecedor" />
              </div>
            </TableHead>
            <TableHead className="text-muted-foreground font-semibold">Categoria</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Tipo</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Nº Documento</TableHead>
            <TableHead 
              className="text-right text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort("total")}
            >
              <div className="flex items-center justify-end">
                Total
                <SortIcon field="total" />
              </div>
            </TableHead>
            <TableHead className="text-right text-muted-foreground font-semibold">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFaturas.map((fatura, index) => (
            <TableRow
              key={fatura.id}
              className="cursor-pointer transition-colors hover:bg-muted/50 animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => onViewDetails(fatura)}
            >
              <TableCell className="font-medium text-card-foreground">
                {format(new Date(fatura.data_doc), "dd/MM/yyyy", { locale: pt })}
              </TableCell>
              <TableCell className="text-card-foreground font-medium">
                {fatura.fornecedor}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">
                  {fatura.categoria || "Sem categoria"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={fatura.tipo === "COMPRA" ? "destructive" : "default"}
                  className="font-normal"
                >
                  {fatura.tipo || "—"}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                {fatura.numero_doc || "—"}
              </TableCell>
              <TableCell className={`text-right font-semibold ${getValueColor(fatura.tipo)}`}>
                {formatCurrency(fatura.total)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {fatura.sheet_link && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(fatura.sheet_link!, "_blank");
                          }}
                          className="hover:bg-accent/10 hover:text-accent"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Abrir Excel</TooltipContent>
                    </Tooltip>
                  )}
                  {fatura.link_drive && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(fatura.link_drive!, "_blank");
                          }}
                          className="hover:bg-primary/10 hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Abrir PDF</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
