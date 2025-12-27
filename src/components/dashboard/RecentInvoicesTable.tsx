import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import type { Documento } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RecentInvoicesTableProps {
  faturas: Documento[];
  onViewDetails: (fatura: Documento) => void;
}

export function RecentInvoicesTable({ faturas, onViewDetails }: RecentInvoicesTableProps) {
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

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-lg font-semibold text-card-foreground">Últimas Faturas</h3>
        <p className="text-sm text-muted-foreground">Documentos recentemente adicionados</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground">Data</TableHead>
            <TableHead className="text-muted-foreground">Fornecedor</TableHead>
            <TableHead className="text-muted-foreground">Categoria</TableHead>
            <TableHead className="text-right text-muted-foreground">Total</TableHead>
            <TableHead className="text-right text-muted-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faturas.map((fatura, index) => (
            <TableRow 
              key={fatura.id} 
              className="cursor-pointer transition-colors hover:bg-muted/50 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => onViewDetails(fatura)}
            >
              <TableCell className="font-medium text-card-foreground">
                {format(new Date(fatura.data_doc), "dd MMM yyyy", { locale: pt })}
              </TableCell>
              <TableCell className="text-card-foreground">{fatura.fornecedor}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">
                  {fatura.categoria || "Sem categoria"}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-semibold ${getValueColor(fatura.tipo)}`}>
                {formatCurrency(fatura.total)}
              </TableCell>
              <TableCell className="text-right">
                {fatura.link_drive && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(fatura.link_drive!, "_blank");
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
