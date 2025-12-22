import { useState, useMemo } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Extrato {
  id: string;
  cliente_nome: string;
  banco_nome: string;
  ano: number;
  mes_nome: string;
  mes_numero: string;
  data_movimento: string;
  descritivo: string;
  debito: number | null;
  credito: number | null;
  saldo_apos_movimento: number;
}

interface ExtratosTableProps {
  extratos: Extrato[];
  isLoading: boolean;
}

type SortField = "data_movimento" | "descritivo" | "debito" | "credito" | "saldo_apos_movimento";
type SortDirection = "asc" | "desc";

export function ExtratosTable({ extratos, isLoading }: ExtratosTableProps) {
  const [sortField, setSortField] = useState<SortField>("data_movimento");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  const sortedExtratos = useMemo(() => {
    return [...extratos].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "data_movimento":
          comparison = new Date(a.data_movimento).getTime() - new Date(b.data_movimento).getTime();
          break;
        case "descritivo":
          comparison = a.descritivo.localeCompare(b.descritivo);
          break;
        case "debito":
          comparison = (Number(a.debito) || 0) - (Number(b.debito) || 0);
          break;
        case "credito":
          comparison = (Number(a.credito) || 0) - (Number(b.credito) || 0);
          break;
        case "saldo_apos_movimento":
          comparison = Number(a.saldo_apos_movimento) - Number(b.saldo_apos_movimento);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [extratos, sortField, sortDirection]);

  const formatCurrency = (value: number | null) => {
    if (!value || value === 0) return "-";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (extratos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Nenhum movimento encontrado</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("data_movimento")}
            >
              <div className="flex items-center">
                Data
                <SortIcon field="data_movimento" />
              </div>
            </TableHead>
            <TableHead>Banco</TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("descritivo")}
            >
              <div className="flex items-center">
                Descritivo
                <SortIcon field="descritivo" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-right"
              onClick={() => handleSort("debito")}
            >
              <div className="flex items-center justify-end">
                Débito
                <SortIcon field="debito" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-right"
              onClick={() => handleSort("credito")}
            >
              <div className="flex items-center justify-end">
                Crédito
                <SortIcon field="credito" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-right"
              onClick={() => handleSort("saldo_apos_movimento")}
            >
              <div className="flex items-center justify-end">
                Saldo
                <SortIcon field="saldo_apos_movimento" />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedExtratos.map((extrato) => (
            <TableRow key={extrato.id}>
              <TableCell className="font-medium">
                {format(new Date(extrato.data_movimento), "dd/MM/yyyy", { locale: pt })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {extrato.banco_nome}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[300px] truncate" title={extrato.descritivo}>
                {extrato.descritivo}
              </TableCell>
              <TableCell className={cn("text-right", Number(extrato.debito) > 0 && "text-destructive font-medium")}>
                {formatCurrency(Number(extrato.debito))}
              </TableCell>
              <TableCell className={cn("text-right", Number(extrato.credito) > 0 && "text-accent font-medium")}>
                {formatCurrency(Number(extrato.credito))}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(Number(extrato.saldo_apos_movimento))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
