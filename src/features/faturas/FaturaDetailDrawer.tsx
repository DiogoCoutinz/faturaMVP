import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useState, useCallback } from "react";
import { X, ExternalLink, Building2, Calendar, Hash, Tag, Pencil, Trash2, Save, XCircle, Table2 } from "lucide-react";
import type { Invoice } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { updateInvoiceEverywhere } from "@/lib/sync/updateInvoice";
import { deleteInvoiceEverywhere } from "@/lib/sync/deleteInvoice";
import { useAuth } from "@/features/auth/AuthContext";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FaturaDetailDrawerProps {
  fatura: Invoice | null;
  open: boolean;
  onClose: () => void;
}

export function FaturaDetailDrawer({ fatura, open, onClose }: FaturaDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user, providerToken } = useAuth();
  const queryClient = useQueryClient();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handleStartEdit = useCallback(() => {
    if (!fatura) return;
    setEditData({
      supplier_name: fatura.supplier_name || "",
      supplier_vat: fatura.supplier_vat || "",
      doc_number: fatura.doc_number || "",
      total_amount: String(fatura.total_amount || 0),
      cost_type: fatura.cost_type || "",
      document_type: fatura.document_type || "",
      doc_date: fatura.doc_date || "",
      summary: fatura.summary || "",
    });
    setIsEditing(true);
  }, [fatura]);

  const handleCancelEdit = useCallback(() => {
    setEditData({});
    setIsEditing(false);
  }, []);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async () => {
    if (!fatura || !user || !providerToken) {
      toast({
        title: "Erro",
        description: "Dados de autenticação inválidos.",
        variant: "destructive",
      });
      return;
    }

    const updates: Record<string, unknown> = {};

    if (editData.supplier_name !== fatura.supplier_name) {
      updates.supplier_name = editData.supplier_name;
    }
    if (editData.supplier_vat !== fatura.supplier_vat) {
      updates.supplier_vat = editData.supplier_vat;
    }
    if (editData.doc_number !== fatura.doc_number) {
      updates.doc_number = editData.doc_number;
    }
    if (editData.doc_date !== fatura.doc_date) {
      updates.doc_date = editData.doc_date;
      const newYear = new Date(editData.doc_date).getFullYear();
      if (!isNaN(newYear)) {
        updates.doc_year = newYear;
      }
    }

    const numValue = parseFloat(editData.total_amount.replace(',', '.'));
    if (!isNaN(numValue) && numValue !== fatura.total_amount) {
      updates.total_amount = numValue;
    }

    if (editData.summary !== fatura.summary) {
      updates.summary = editData.summary;
    }
    if (editData.cost_type !== fatura.cost_type) {
      updates.cost_type = editData.cost_type;
    }

    if (Object.keys(updates).length === 0) {
      toast({ title: "Sem alterações", description: "Nenhuma alteração foi detectada." });
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateInvoiceEverywhere({
        invoiceId: fatura.id,
        userId: user.id,
        accessToken: providerToken,
        updates,
      });

      if (result.success) {
        const movedText = result.fileMoved ? ' (ficheiro movido no Drive!)' : '';
        sonnerToast.success(`Fatura atualizada!${movedText}`);
        setIsEditing(false);
        setEditData({});
        queryClient.invalidateQueries({ queryKey: ['documentos'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        onClose();
      } else {
        toast({
          title: "Erro ao atualizar",
          description: result.message || "Não foi possível guardar.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!fatura || !user || !providerToken) return;

    setIsDeleting(true);
    try {
      const result = await deleteInvoiceEverywhere({
        invoiceId: fatura.id,
        userId: user.id,
        accessToken: providerToken,
      });

      if (result.success) {
        sonnerToast.success("Fatura eliminada!");
        queryClient.invalidateQueries({ queryKey: ['documentos'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        onClose();
      } else {
        toast({
          title: "Erro ao eliminar",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro ao eliminar",
        description: "Não foi possível eliminar.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!fatura) return null;

  const pdfPreviewUrl = fatura.drive_file_id
    ? `https://drive.google.com/file/d/${fatura.drive_file_id}/preview`
    : null;

  const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
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

  // Modal de edição em ecrã cheio com PDF ao lado
  if (isEditing) {
    return (
      <Dialog open={isEditing} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[85vh] p-0 gap-0 flex flex-col">
          <div className="flex flex-1 min-h-0">
            {/* ESQUERDA - PDF Preview */}
            <div className="flex-1 bg-muted/30 border-r min-h-0">
              {pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                  allow="autoplay"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>PDF não disponível</p>
                </div>
              )}
            </div>

            {/* DIREITA - Formulário */}
            <div className="w-[400px] flex flex-col min-h-0">
              <DialogHeader className="p-4 pb-3 border-b shrink-0">
                <DialogTitle className="text-lg">Editar Fatura</DialogTitle>
                <p className="text-sm text-muted-foreground">{fatura.supplier_name}</p>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                {/* Fornecedor */}
                <div className="space-y-1">
                  <Label className="text-xs">Fornecedor</Label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                    value={editData.supplier_name}
                    onChange={(e) => handleFieldChange('supplier_name', e.target.value)}
                  />
                </div>

                {/* NIF */}
                <div className="space-y-1">
                  <Label className="text-xs">NIF Fornecedor</Label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                    value={editData.supplier_vat}
                    onChange={(e) => handleFieldChange('supplier_vat', e.target.value)}
                  />
                </div>

                {/* Número Documento */}
                <div className="space-y-1">
                  <Label className="text-xs">Número Documento</Label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                    value={editData.doc_number}
                    onChange={(e) => handleFieldChange('doc_number', e.target.value)}
                  />
                </div>

                {/* Total e Data lado a lado */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Total (€)</Label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                      value={editData.total_amount}
                      onChange={(e) => handleFieldChange('total_amount', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data</Label>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                      value={editData.doc_date}
                      onChange={(e) => handleFieldChange('doc_date', e.target.value)}
                    />
                  </div>
                </div>

                {/* Categoria e Tipo lado a lado */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <Select
                      value={editData.cost_type}
                      onValueChange={(value) => handleFieldChange('cost_type', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custo_fixo">Custo Fixo</SelectItem>
                        <SelectItem value="custo_variavel">Custo Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                      value={editData.document_type}
                      onChange={(e) => handleFieldChange('document_type', e.target.value)}
                    />
                  </div>
                </div>

                {/* Resumo */}
                <div className="space-y-1">
                  <Label className="text-xs">Resumo</Label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
                    value={editData.summary}
                    onChange={(e) => handleFieldChange('summary', e.target.value)}
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="p-4 border-t flex gap-2 shrink-0 bg-background">
                <Button onClick={handleSave} disabled={isSaving} className="flex-1 gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? "A guardar..." : "Guardar"}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} className="gap-2">
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Drawer normal para ver detalhes
  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleCancelEdit();
        onClose();
      }
    }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" aria-describedby="fatura-detail-description">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl font-bold text-foreground">
                {fatura.supplier_name}
              </SheetTitle>
              <SheetDescription id="fatura-detail-description">
                Detalhes da fatura
              </SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            {fatura.document_type && (
              <Badge variant={fatura.document_type === "COMPRA" ? "default" : "secondary"}>
                {fatura.document_type}
              </Badge>
            )}
            {fatura.cost_type && (
              <Badge variant="outline">{fatura.cost_type}</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-1">
          <DetailRow icon={Building2} label="Fornecedor" value={fatura.supplier_name || ""} />
          {fatura.supplier_vat && (
            <DetailRow icon={Hash} label="NIF" value={fatura.supplier_vat} />
          )}
          <DetailRow
            icon={Calendar}
            label="Data do Documento"
            value={fatura.doc_date ? format(new Date(fatura.doc_date), "dd 'de' MMMM 'de' yyyy", { locale: pt }) : "—"}
          />
          {fatura.doc_number && (
            <DetailRow icon={Hash} label="Número do Documento" value={fatura.doc_number} />
          )}
          {fatura.cost_type && (
            <DetailRow icon={Tag} label="Categoria" value={fatura.cost_type} />
          )}

          <Separator className="my-4" />

          <div className="flex items-center justify-between py-4">
            <span className="text-lg font-medium text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-foreground">
              {formatCurrency(Number(fatura.total_amount) || 0)}
            </span>
          </div>

          <Separator className="my-4" />

          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              {fatura.drive_link && (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => window.open(fatura.drive_link!, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir PDF
                </Button>
              )}
              {fatura.spreadsheet_id && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${fatura.spreadsheet_id}/edit`, "_blank")}
                >
                  <Table2 className="h-4 w-4" />
                  Abrir Excel
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={handleStartEdit}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar fatura?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser revertida. A fatura de "{fatura.supplier_name}"
                      no valor de {formatCurrency(Number(fatura.total_amount) || 0)} será eliminada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "A eliminar..." : "Eliminar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {fatura.created_at && (
            <div className="mt-6 rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">
                Adicionado em {format(new Date(fatura.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
