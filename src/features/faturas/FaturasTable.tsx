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
import { ExternalLink, MoreVertical, Eye, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronRightIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Invoice } from "@/types/database";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS_PER_PAGE = 20;

interface FaturasTableProps {
  faturas: Invoice[];
  onViewDetail: (fatura: Invoice) => void;
}

type SortField = 'date' | 'amount' | 'supplier';
type SortOrder = 'asc' | 'desc';

export function FaturasTable({ faturas, onViewDetail }: FaturasTableProps) {
  const isMobile = useIsMobile();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, index: number, fatura: Invoice) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        onViewDetail(fatura);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(Math.min(index + 1, paginatedFaturas.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(Math.max(index - 1, 0));
        break;
    }
  };

  // Focus the row when focusedIndex changes
  useEffect(() => {
    if (focusedIndex !== null) {
      const row = document.querySelector(`[data-row-index="${focusedIndex}"]`) as HTMLElement;
      row?.focus();
    }
  }, [focusedIndex]);

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

  // Paginação
  const totalPages = Math.ceil(sortedFaturas.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFaturas = sortedFaturas.slice(startIndex, endIndex);

  // Reset página quando os dados mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [faturas.length, sortField, sortOrder]);

  const getValueColor = (tipo: string | null) => {
    if (tipo === "COMPRA") return "text-destructive";
    if (tipo === "VENDA") return "text-green-600";
    return "text-foreground";
  };

  const getCategoryBadgeStyle = (costType: string | null) => {
    if (costType === "custo_fixo") {
      return "bg-[#0E2435]/10 text-[#0E2435] border-[#0E2435]/20";
    }
    if (costType === "custo_variavel") {
      return "bg-[#BBB388]/20 text-[#8B7355] border-[#BBB388]/30";
    }
    return "bg-muted/20 text-muted-foreground";
  };

  const getCategoryLabel = (costType: string | null) => {
    if (costType === "custo_fixo") return "Custo Fixo";
    if (costType === "custo_variavel") return "Custo Variável";
    return "Sem categoria";
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />;
  };

  // Mobile Card View
  if (isMobile) {
    return (
      <div className="space-y-3">
        {paginatedFaturas.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Nenhuma fatura encontrada.
          </div>
        ) : (
          <>
            {paginatedFaturas.map((fatura) => (
              <div
                key={fatura.id}
                onClick={() => onViewDetail(fatura)}
                className="rounded-xl border border-border bg-card p-4 shadow-sm active:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">
                        {fatura.supplier_name}
                      </span>
                      {fatura.status === 'review' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700 shrink-0">
                          A rever
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {fatura.doc_date ? format(new Date(fatura.doc_date), "dd/MM/yyyy", { locale: pt }) : "—"}
                      </span>
                      <span>·</span>
                      <Badge variant="outline" className={`text-xs font-normal ${getCategoryBadgeStyle(fatura.cost_type)}`}>
                        {getCategoryLabel(fatura.cost_type)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${getValueColor(fatura.document_type)}`}>
                      {formatCurrency(Number(fatura.total_amount) || 0)}
                    </span>
                    <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  {startIndex + 1}-{Math.min(endIndex, sortedFaturas.length)} de {sortedFaturas.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm font-medium">{currentPage}/{totalPages}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Desktop Table View
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
          {paginatedFaturas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                Nenhuma fatura encontrada.
              </TableCell>
            </TableRow>
          ) : (
            paginatedFaturas.map((fatura, index) => (
              <TableRow
                key={fatura.id}
                data-row-index={index}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes de ${fatura.supplier_name}, ${formatCurrency(Number(fatura.total_amount) || 0)}`}
                className="hover:bg-muted/30 transition-colors cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                onClick={() => onViewDetail(fatura)}
                onKeyDown={(e) => handleKeyDown(e, index, fatura)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {fatura.doc_date ? format(new Date(fatura.doc_date), "dd/MM/yyyy", { locale: pt }) : "—"}
                </TableCell>
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    {fatura.supplier_name}
                    {fatura.status === 'review' && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700">
                        A rever
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className={`font-medium ${getCategoryBadgeStyle(fatura.cost_type)}`}>
                    {getCategoryLabel(fatura.cost_type)}
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            A mostrar {startIndex + 1}-{Math.min(endIndex, sortedFaturas.length)} de {sortedFaturas.length} faturas
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 px-2">
              <span className="text-sm font-medium">{currentPage}</span>
              <span className="text-sm text-muted-foreground">de</span>
              <span className="text-sm font-medium">{totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
