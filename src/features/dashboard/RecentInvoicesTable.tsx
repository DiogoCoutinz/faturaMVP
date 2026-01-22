import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types/database";

interface RecentInvoicesTableProps {
  faturas: Invoice[];
  onViewDetail: (fatura: Invoice) => void;
}

export function RecentInvoicesTable({ faturas, onViewDetail }: RecentInvoicesTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const getBadgeColor = (tipo: string | null) => {
    if (tipo === "custo_fixo") return "bg-primary/10 text-primary border-primary/20";
    if (tipo === "custo_variavel") return "bg-secondary/20 text-secondary-foreground border-secondary/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="rounded-xl border-none bg-card overflow-hidden shadow-card">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="w-[120px] py-4">Data</TableHead>
            <TableHead className="py-4">Fornecedor</TableHead>
            <TableHead className="hidden md:table-cell py-4">Tipo de Custo</TableHead>
            <TableHead className="text-right py-4">Valor Total</TableHead>
            <TableHead className="w-[60px] py-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faturas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                Ainda não foram processadas faturas.
              </TableCell>
            </TableRow>
          ) : (
            faturas.map((fatura) => (
              <TableRow 
                key={fatura.id} 
                className="hover:bg-muted/20 transition-all duration-200 cursor-pointer group border-b border-border/50 last:border-0"
                onClick={() => onViewDetail(fatura)}
              >
                <TableCell className="font-medium text-muted-foreground text-xs">
                  {fatura.doc_date ? format(new Date(fatura.doc_date), "dd MMM yyyy", { locale: pt }) : "—"}
                </TableCell>
                <TableCell className="text-card-foreground font-semibold">
                  <div className="flex flex-col">
                    <span>{fatura.supplier_name}</span>
                    <span className="text-[10px] text-muted-foreground font-normal md:hidden">
                      {fatura.cost_type === 'custo_fixo' ? 'Fixo' : fatura.cost_type === 'custo_variavel' ? 'Variável' : 'N/A'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge className={cn("font-semibold text-[10px] px-2 py-0.5 uppercase tracking-wider", getBadgeColor(fatura.cost_type))}>
                    {fatura.cost_type === 'custo_fixo' ? 'Custo Fixo' : 
                     fatura.cost_type === 'custo_variavel' ? 'Custo Variável' : 
                     'Por Classificar'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold text-foreground">
                  {formatCurrency(Number(fatura.total_amount) || 0)}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end">
                    {fatura.drive_link ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => window.open(fatura.drive_link!, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="h-8 w-8" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
