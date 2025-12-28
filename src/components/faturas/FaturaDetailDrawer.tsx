import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useState } from "react";
import { X, ExternalLink, Building2, Calendar, Hash, Tag, Pencil, Trash2, Save, XCircle } from "lucide-react";
import type { Documento } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateDocumento, useDeleteDocumento } from "@/hooks/useSupabase";
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
  fatura: Documento | null;
  open: boolean;
  onClose: () => void;
}

export function FaturaDetailDrawer({ fatura, open, onClose }: FaturaDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Documento>>({});
  
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
      fornecedor: fatura.fornecedor,
      nif_fornecedor: fatura.nif_fornecedor || "",
      numero_doc: fatura.numero_doc || "",
      total: fatura.total,
      categoria: fatura.categoria || "",
      tipo: fatura.tipo || "",
      data_doc: fatura.data_doc,
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

  const EditField = ({ label, field, type = "text" }: { label: string; field: keyof Documento; type?: string }) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
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
                {fatura.fornecedor}
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
              {fatura.tipo && (
                <Badge variant={fatura.tipo === "COMPRA" ? "default" : "secondary"}>
                  {fatura.tipo}
                </Badge>
              )}
              {fatura.categoria && (
                <Badge variant="outline">{fatura.categoria}</Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {isEditing ? (
          <div className="mt-6 space-y-4">
            <EditField label="Fornecedor" field="fornecedor" />
            <EditField label="NIF Fornecedor" field="nif_fornecedor" />
            <EditField label="Número Documento" field="numero_doc" />
            <EditField label="Total (€)" field="total" type="number" />
            <EditField label="Categoria" field="categoria" />
            <EditField label="Tipo" field="tipo" />
            <EditField label="Data" field="data_doc" type="date" />

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
              value={fatura.fornecedor}
            />
            {fatura.nif_fornecedor && (
              <DetailRow
                icon={Hash}
                label="NIF"
                value={fatura.nif_fornecedor}
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
              {fatura.link_drive && (
                <Button 
                  className="w-full gap-2" 
                  onClick={() => window.open(fatura.link_drive!, "_blank")}
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
                        Esta ação não pode ser revertida. A fatura de "{fatura.fornecedor}" 
                        no valor de {formatCurrency(fatura.total)} será permanentemente eliminada.
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