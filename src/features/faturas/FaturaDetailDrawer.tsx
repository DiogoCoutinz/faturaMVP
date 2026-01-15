import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useState } from "react";
import { X, ExternalLink, Building2, Calendar, Hash, Tag, Pencil, Trash2, Save, XCircle } from "lucide-react";
import type { Invoice } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateDocumento, useDeleteDocumento } from "@/features/faturas/hooks/useFaturas";
import { toast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [editData, setEditData] = useState<Partial<Invoice>>({});
  
  const updateMutation = useUpdateDocumento();
  const deleteMutation = useDeleteDocumento();

  if (!fatura) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handleStartEdit = () => {
    setEditData({
      supplier_name: fatura.supplier_name,
      supplier_vat: fatura.supplier_vat || "",
      doc_number: fatura.doc_number || "",
      total_amount: fatura.total_amount,
      cost_type: fatura.cost_type || "",
      document_type: fatura.document_type || "",
      doc_date: fatura.doc_date,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditData({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: fatura.id,
        updates: editData,
      });
      toast({
        title: "Fatura atualizada",
        description: "Os dados foram guardados com sucesso.",
      });
      setIsEditing(false);
      setEditData({});
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível guardar as alterações.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(fatura.id);
      toast({
        title: "Fatura eliminada",
        description: "A fatura foi removida com sucesso.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Erro ao eliminar",
        description: "Não foi possível eliminar a fatura.",
        variant: "destructive",
      });
    }
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

  const EditField = ({ label, field, type = "text" }: { label: string; field: keyof Invoice; type?: string }) => (
    <div className="space-y-2">
      <Label htmlFor={field as string}>{label}</Label>
      <Input
        id={field as string}
        type={type}
        value={editData[field] as string || ""}
        onChange={(e) => setEditData(prev => ({ 
          ...prev, 
          [field]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value 
        }))}
      />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleCancelEdit();
        onClose();
      }
    }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl font-bold text-foreground">
                {fatura.supplier_name}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {isEditing ? "Editar fatura" : "Detalhes da fatura"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => {
              handleCancelEdit();
              onClose();
            }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {!isEditing && (
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
          )}
        </SheetHeader>

        {isEditing ? (
          <div className="mt-6 space-y-4">
            <EditField label="Fornecedor" field="supplier_name" />
            <EditField label="NIF Fornecedor" field="supplier_vat" />
            <EditField label="Número Documento" field="doc_number" />
            <EditField label="Total (€)" field="total_amount" type="number" />
            <EditField label="Categoria" field="cost_type" />
            <EditField label="Tipo" field="document_type" />
            <EditField label="Data" field="doc_date" type="date" />

            <Separator className="my-4" />

            <div className="flex gap-2">
              <Button 
                onClick={handleSave} 
                disabled={updateMutation.isPending}
                className="flex-1 gap-2"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "A guardar..." : "Guardar"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-1">
            <DetailRow
              icon={Building2}
              label="Fornecedor"
              value={fatura.supplier_name || ""}
            />
            {fatura.supplier_vat && (
              <DetailRow
                icon={Hash}
                label="NIF"
                value={fatura.supplier_vat}
              />
            )}
            <DetailRow
              icon={Calendar}
              label="Data do Documento"
              value={fatura.doc_date ? format(new Date(fatura.doc_date), "dd 'de' MMMM 'de' yyyy", { locale: pt }) : "—"}
            />
            {fatura.doc_number && (
              <DetailRow
                icon={Hash}
                label="Número do Documento"
                value={fatura.doc_number}
              />
            )}
            {fatura.cost_type && (
              <DetailRow
                icon={Tag}
                label="Categoria"
                value={fatura.cost_type}
              />
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
              {fatura.drive_link && (
                <Button 
                  className="w-full gap-2" 
                  onClick={() => window.open(fatura.drive_link!, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir PDF
                </Button>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={handleStartEdit}
                >
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
                        no valor de {formatCurrency(Number(fatura.total_amount) || 0)} será permanentemente eliminada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? "A eliminar..." : "Eliminar"}
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
        )}
      </SheetContent>
    </Sheet>
  );
}
