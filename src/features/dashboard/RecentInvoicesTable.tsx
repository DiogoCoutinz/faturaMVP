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
    if (tipo === "custo_fixo") return "bg-[#0E2435]/10 text-[#0E2435] border-[#0E2435]/20";
    if (tipo === "custo_variavel") return "bg-[#BBB388]/20 text-[#8B7355] border-[#BBB388]/40";
    return "bg-muted text-muted-foreground border-muted";
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-500">
      {/* Executive header accent */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"></div>
      
      <Table>
        <TableHeader className="bg-muted/30 border-b border-border/60">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="w-[130px] py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Data</TableHead>
            <TableHead className="py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Fornecedor</TableHead>
            <TableHead className="hidden md:table-cell py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Tipo de Custo</TableHead>
            <TableHead className="text-right py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor Total</TableHead>
            <TableHead className="w-[70px] py-5"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faturas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <p className="font-medium">Ainda não foram processadas faturas.</p>
                  <p className="text-sm text-muted-foreground/70">As faturas aparecerão aqui após o processamento.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            faturas.map((fatura, index) => (
              <TableRow 
                key={fatura.id} 
                className="hover:bg-muted/20 transition-all duration-300 cursor-pointer group border-b border-border/40 last:border-0 animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => onViewDetail(fatura)}
              >
                <TableCell className="font-medium text-foreground text-sm py-5 transition-colors duration-300 group-hover:text-primary">
                  {fatura.doc_date ? format(new Date(fatura.doc_date), "dd MMM yyyy", { locale: pt }) : "—"}
                </TableCell>
                <TableCell className="text-card-foreground font-semibold py-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold transition-colors duration-300 group-hover:text-primary">{fatura.supplier_name}</span>
                    <span className="text-xs text-muted-foreground font-normal md:hidden">
                      {fatura.cost_type === 'custo_fixo' ? 'Fixo' : fatura.cost_type === 'custo_variavel' ? 'Variável' : 'N/A'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell py-5">
                  <Badge className={cn(
                    "font-semibold text-xs px-3 py-1.5 uppercase tracking-wider border transition-all duration-300",
                    getBadgeColor(fatura.cost_type)
                  )}>
                    {fatura.cost_type === 'custo_fixo' ? 'Custo Fixo' : 
                     fatura.cost_type === 'custo_variavel' ? 'Custo Variável' : 
                     'Por Classificar'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold text-foreground tabular-nums text-base py-5 transition-all duration-300 group-hover:text-primary">
                  {formatCurrency(Number(fatura.total_amount) || 0)}
                </TableCell>
                <TableCell className="text-center py-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end">
                    {fatura.drive_link ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-primary opacity-0 group-hover:opacity-100 transition-all duration-300 focus:opacity-100 hover:bg-primary/10 hover:border-primary/20 border border-transparent"
                        onClick={() => window.open(fatura.drive_link!, "_blank")}
                        aria-label="Abrir fatura no Google Drive"
                      >
                        <ExternalLink className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                      </Button>
                    ) : (
                      <div className="h-9 w-9" />
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
