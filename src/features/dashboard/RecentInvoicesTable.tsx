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

  const getValueColor = (tipo: string | null) => {
    if (tipo === "COMPRA") return "text-destructive";
    if (tipo === "VENDA") return "text-green-600";
    return "text-foreground";
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[120px]">Data</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="hidden md:table-cell">Categoria</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faturas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Sem dados recentes.
              </TableCell>
            </TableRow>
          ) : (
            faturas.map((fatura) => (
              <TableRow 
                key={fatura.id} 
                className="hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => onViewDetail(fatura)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {fatura.doc_date ? format(new Date(fatura.doc_date), "dd MMM yyyy", { locale: pt }) : "—"}
                </TableCell>
                <TableCell className="text-card-foreground font-semibold">{fatura.supplier_name}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="font-normal bg-muted/20">
                    {fatura.cost_type || "Sem categoria"}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-bold ${getValueColor(fatura.document_type)}`}>
                  {formatCurrency(Number(fatura.total_amount) || 0)}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  {fatura.drive_link && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => window.open(fatura.drive_link!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
