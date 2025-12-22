import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { X, ExternalLink, FileSpreadsheet, Building2, Calendar, Hash, Tag } from "lucide-react";
import type { Documento } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FaturaDetailDrawerProps {
  fatura: Documento | null;
  open: boolean;
  onClose: () => void;
}

export function FaturaDetailDrawer({ fatura, open, onClose }: FaturaDetailDrawerProps) {
  if (!fatura) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const DetailRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl font-bold text-foreground">
                {fatura.fornecedor_nome}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Detalhes da fatura
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Badge variant={fatura.tipo === "COMPRA" ? "default" : "secondary"}>
              {fatura.tipo}
            </Badge>
            {fatura.categoria && (
              <Badge variant="outline">{fatura.categoria}</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          <DetailRow
            icon={Building2}
            label="Fornecedor"
            value={fatura.fornecedor_nome}
          />
          {fatura.fornecedor_nif && (
            <DetailRow
              icon={Hash}
              label="NIF"
              value={fatura.fornecedor_nif}
            />
          )}
          <DetailRow
            icon={Calendar}
            label="Data do Documento"
            value={format(new Date(fatura.data_doc), "dd 'de' MMMM 'de' yyyy", { locale: pt })}
          />
          {fatura.numero_doc && (
            <DetailRow
              icon={Hash}
              label="Número do Documento"
              value={fatura.numero_doc}
            />
          )}
          {fatura.categoria && (
            <DetailRow
              icon={Tag}
              label="Categoria"
              value={fatura.categoria}
            />
          )}

          <Separator className="my-4" />

          <div className="flex items-center justify-between py-4">
            <span className="text-lg font-medium text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-foreground">
              {formatCurrency(fatura.total)}
            </span>
          </div>

          <Separator className="my-4" />

          <div className="space-y-3 pt-2">
            {fatura.drive_link && (
              <Button 
                className="w-full gap-2" 
                onClick={() => window.open(fatura.drive_link!, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir PDF
              </Button>
            )}
            {fatura.sheet_link && (
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => window.open(fatura.sheet_link!, "_blank")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Abrir no Google Sheets
              </Button>
            )}
          </div>

          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">
              Adicionado em {format(new Date(fatura.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
