import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, MoreVertical, Eye, Download, ChevronUp, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Invoice } from "@/types/database";
import { useState } from "react";

interface FaturasTableProps {
  faturas: Invoice[];
  onViewDetail: (fatura: Invoice) => void;
}

type SortField = 'date' | 'amount' | 'supplier';
type SortOrder = 'asc' | 'desc';

export function FaturasTable({ faturas, onViewDetail }: FaturasTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedFaturas = [...faturas].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'date') {
      const dateA = a.doc_date ? new Date(a.doc_date).getTime() : 0;
      const dateB = b.doc_date ? new Date(b.doc_date).getTime() : 0;
      comparison = dateA - dateB;
    } else if (sortField === 'amount') {
      comparison = (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
    } else if (sortField === 'supplier') {
      comparison = (a.supplier_name || "").localeCompare(b.supplier_name || "");
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getValueColor = (tipo: string | null) => {
    if (tipo === "COMPRA") return "text-destructive";
    if (tipo === "VENDA") return "text-green-600";
    return "text-foreground";
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />;
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[120px]">
              <button 
                className="flex items-center hover:text-foreground transition-colors"
                onClick={() => handleSort('date')}
              >
                Data <SortIcon field="date" />
              </button>
            </TableHead>
            <TableHead>
              <button 
                className="flex items-center hover:text-foreground transition-colors"
                onClick={() => handleSort('supplier')}
              >
                Fornecedor <SortIcon field="supplier" />
              </button>
            </TableHead>
            <TableHead className="hidden md:table-cell">Categoria</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="hidden lg:table-cell">Nº Doc</TableHead>
            <TableHead className="text-right">
              <button 
                className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                onClick={() => handleSort('amount')}
              >
                Valor <SortIcon field="amount" />
              </button>
            </TableHead>
            <TableHead className="w-[80px] text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFaturas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                Nenhuma fatura encontrada.
              </TableCell>
            </TableRow>
          ) : (
            sortedFaturas.map((fatura) => (
              <TableRow 
                key={fatura.id} 
                className="hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => onViewDetail(fatura)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {fatura.doc_date ? format(new Date(fatura.doc_date), "dd/MM/yyyy", { locale: pt }) : "—"}
                </TableCell>
                <TableCell className="font-semibold text-foreground">
                  {fatura.supplier_name}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="font-normal bg-muted/20">
                    {fatura.cost_type || "Sem categoria"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge 
                    variant={fatura.document_type === "COMPRA" ? "destructive" : "default"}
                    className="font-normal"
                  >
                    {fatura.document_type || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {fatura.doc_number || "—"}
                </TableCell>
                <TableCell className={`text-right font-semibold ${getValueColor(fatura.document_type)}`}>
                  {formatCurrency(Number(fatura.total_amount) || 0)}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => onViewDetail(fatura)} className="gap-2">
                        <Eye className="h-4 w-4" /> Ver Detalhes
                      </DropdownMenuItem>
                      {fatura.drive_link && (
                        <DropdownMenuItem 
                          onClick={() => window.open(fatura.drive_link!, "_blank")}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" /> Abrir PDF
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
