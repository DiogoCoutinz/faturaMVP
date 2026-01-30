/**
 * FASE 4: DIALOG DE EDIÇÃO DE FATURAS COM PREVIEW DO PDF
 * Layout split-screen: PDF à esquerda, formulário à direita
 */

import { useState, useEffect, useRef } from 'react';
import { Invoice } from '@/types/database';
import { useAuth } from '@/features/auth/AuthContext';
import { updateInvoiceEverywhere } from '@/lib/sync/updateInvoice';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle, FileText, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditInvoiceDrawerProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditInvoiceDrawer({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: EditInvoiceDrawerProps) {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [storageToken, setStorageToken] = useState<string | null>(null);

  // Fetch storage token with auto-refresh
  useEffect(() => {
    if (!open) return;

    const fetchStorageToken = async () => {
      const { data } = await supabase
        .from('user_oauth_tokens')
        .select('access_token, token_expiry, email')
        .eq('provider', 'google')
        .eq('is_primary_storage', true)
        .single();

      if (data) {
        const isExpired = new Date(data.token_expiry) < new Date();

        if (isExpired && data.email && SUPABASE_URL) {
          // Auto-refresh token
          try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/refresh-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: data.email }),
            });

            if (response.ok) {
              // Fetch updated token
              const { data: refreshedData } = await supabase
                .from('user_oauth_tokens')
                .select('access_token')
                .eq('email', data.email)
                .single();

              if (refreshedData) {
                setStorageToken(refreshedData.access_token);
                return;
              }
            }
          } catch (error) {
            console.error('Error refreshing token:', error);
          }
        }

        setStorageToken(data.access_token);
      }
    };

    fetchStorageToken();
  }, [open]);

  // Form state
  const [supplierName, setSupplierName] = useState('');
  const [supplierVat, setSupplierVat] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [summary, setSummary] = useState('');
  const [costType, setCostType] = useState('');

  // Reset form quando invoice mudar
  useEffect(() => {
    if (invoice && open) {
      setSupplierName(invoice.supplier_name || '');
      setSupplierVat(invoice.supplier_vat || '');
      setDocNumber(invoice.doc_number || '');
      setDocDate(invoice.doc_date || '');
      setTotalAmount(invoice.total_amount?.toString() || '');
      setTaxAmount(invoice.tax_amount?.toString() || '');
      setSummary(invoice.summary || '');
      setCostType(invoice.cost_type || '');
      setUpdateResult(null);
    }
  }, [invoice, open]);

  // Gerar URL de preview do PDF do Google Drive
  const getPdfPreviewUrl = () => {
    if (!invoice?.drive_file_id) return null;
    return `https://drive.google.com/file/d/${invoice.drive_file_id}/preview`;
  };

  const handleSave = async () => {
    if (!invoice || !user || !storageToken) {
      toast.error('Dados de autenticação inválidos. Verifique a conta em Automações.');
      return;
    }

    // Cancelar save anterior se ainda estiver pendente
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Se já está a atualizar, ignorar nova chamada
    if (isUpdating) {
      toast.info('Aguarde a atualização anterior terminar');
      return;
    }

    // VALIDAÇÃO DE DADOS
    const validationErrors: string[] = [];

    // Validar data
    if (docDate) {
      const date = new Date(docDate);
      if (isNaN(date.getTime())) {
        validationErrors.push('Data inválida');
      } else {
        const year = date.getFullYear();
        if (year < 2000 || year > 2100) {
          validationErrors.push('Ano deve estar entre 2000 e 2100');
        }
      }
    }

    // Validar valores monetários
    if (totalAmount && isNaN(parseFloat(totalAmount))) {
      validationErrors.push('Valor total deve ser um número válido');
    }
    if (taxAmount && isNaN(parseFloat(taxAmount))) {
      validationErrors.push('IVA deve ser um número válido');
    }

    // Validar valores negativos
    if (totalAmount && parseFloat(totalAmount) < 0) {
      validationErrors.push('Valor total não pode ser negativo');
    }
    if (taxAmount && parseFloat(taxAmount) < 0) {
      validationErrors.push('IVA não pode ser negativo');
    }

    // Validar campos obrigatórios
    if (!supplierName || supplierName.trim() === '') {
      validationErrors.push('Fornecedor é obrigatório');
    }

    if (validationErrors.length > 0) {
      toast.error(`Erros de validação: ${validationErrors.join(', ')}`);
      setUpdateResult({
        type: 'error',
        message: `Erros de validação: ${validationErrors.join(', ')}`,
      });
      return;
    }

    setIsUpdating(true);
    setUpdateResult(null);

    try {
      // Detectar mudanças
      const updates: Record<string, unknown> = {};

      if (supplierName !== invoice.supplier_name) {
        updates.supplier_name = supplierName.trim();
      }
      if (supplierVat !== invoice.supplier_vat) {
        updates.supplier_vat = supplierVat.trim();
      }
      if (docNumber !== invoice.doc_number) {
        updates.doc_number = docNumber.trim();
      }
      if (docDate !== invoice.doc_date) {
        updates.doc_date = docDate;
        const newYear = new Date(docDate).getFullYear();
        if (!isNaN(newYear)) {
          updates.doc_year = newYear;
        }
      }
      if (totalAmount !== invoice.total_amount?.toString()) {
        const parsedAmount = parseFloat(totalAmount);
        if (!isNaN(parsedAmount)) {
          updates.total_amount = parsedAmount;
        }
      }
      if (taxAmount !== invoice.tax_amount?.toString()) {
        const parsedTax = parseFloat(taxAmount);
        if (!isNaN(parsedTax)) {
          updates.tax_amount = parsedTax;
        }
      }
      if (summary !== invoice.summary) {
        updates.summary = summary.trim();
      }
      if (costType !== invoice.cost_type) {
        updates.cost_type = costType;
      }

      if (Object.keys(updates).length === 0) {
        toast.info('Nenhuma alteração detectada');
        setIsUpdating(false);
        return;
      }

      const result = await updateInvoiceEverywhere({
        invoiceId: invoice.id,
        userId: invoice.user_id,  // Usar o user_id da fatura (pode ser null)
        accessToken: storageToken,
        updates,
      });

      if (result.success) {
        const movedText = result.fileMoved ? ' (ficheiro movido no Drive!)' : '';

        if (result.updatedInSheets) {
          setUpdateResult({
            type: 'success',
            message: `Fatura atualizada no sistema e no Google Sheets!${movedText}`,
          });
          toast.success(`Fatura atualizada com sucesso!${movedText}`);
        } else {
          setUpdateResult({
            type: 'warning',
            message: `Atualizado no sistema${movedText}, mas não foi possível sincronizar com o Excel`,
          });
          toast.warning(result.message);
        }

        onSuccess?.();

        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        setUpdateResult({
          type: 'error',
          message: result.message,
        });
        toast.error(result.message);
      }
    } catch (error) {
      setUpdateResult({
        type: 'error',
        message: `Erro ao processar atualização: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      });
      toast.error('Erro ao atualizar fatura');
    } finally {
      setIsUpdating(false);
      saveTimeoutRef.current = null;
    }
  };

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!invoice) return null;

  const pdfPreviewUrl = getPdfPreviewUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 gap-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
          {/* LADO ESQUERDO: Preview do PDF */}
          <div className="bg-muted/30 border-r flex flex-col h-full">
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">Documento Original</span>
              </div>
              {invoice.drive_link && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(invoice.drive_link!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Abrir no Drive
                </Button>
              )}
            </div>
            <div className="flex-1 p-4">
              {pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-full rounded-lg border bg-white"
                  title="Preview do PDF"
                  allow="autoplay"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>Preview não disponível</p>
                    {invoice.drive_link && (
                      <Button
                        variant="link"
                        onClick={() => window.open(invoice.drive_link!, '_blank')}
                        className="mt-2"
                      >
                        Abrir no Google Drive
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: Formulário de Edição */}
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 pb-4 border-b">
              <DialogTitle>Editar Fatura</DialogTitle>
              <DialogDescription>
                Compare com o documento original e corrija os dados se necessário
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-4">
                {/* Resultado do Update */}
                {updateResult && (
                  <Alert variant={updateResult.type === 'error' ? 'destructive' : 'default'}>
                    {updateResult.type === 'success' && <CheckCircle className="h-4 w-4" />}
                    {updateResult.type === 'warning' && <AlertCircle className="h-4 w-4" />}
                    {updateResult.type === 'error' && <AlertCircle className="h-4 w-4" />}
                    <AlertDescription>{updateResult.message}</AlertDescription>
                  </Alert>
                )}

                {/* Fornecedor */}
                <div className="space-y-2">
                  <Label htmlFor="supplier_name">Fornecedor</Label>
                  <Input
                    id="supplier_name"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Nome do fornecedor"
                    disabled={isUpdating}
                  />
                </div>

                {/* NIF */}
                <div className="space-y-2">
                  <Label htmlFor="supplier_vat">NIF Fornecedor</Label>
                  <Input
                    id="supplier_vat"
                    value={supplierVat}
                    onChange={(e) => setSupplierVat(e.target.value)}
                    placeholder="Número de identificação fiscal"
                    disabled={isUpdating}
                  />
                </div>

                {/* Grid 2 colunas */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Nº Documento */}
                  <div className="space-y-2">
                    <Label htmlFor="doc_number">Nº Documento</Label>
                    <Input
                      id="doc_number"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="Nº doc"
                      disabled={isUpdating}
                    />
                  </div>

                  {/* Data do Documento */}
                  <div className="space-y-2">
                    <Label htmlFor="doc_date">Data</Label>
                    <Input
                      id="doc_date"
                      type="date"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                {/* Grid 2 colunas - valores */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Valor Total */}
                  <div className="space-y-2">
                    <Label htmlFor="total_amount">Valor Total (€)</Label>
                    <Input
                      id="total_amount"
                      type="number"
                      step="0.01"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isUpdating}
                    />
                  </div>

                  {/* IVA */}
                  <div className="space-y-2">
                    <Label htmlFor="tax_amount">IVA (€)</Label>
                    <Input
                      id="tax_amount"
                      type="number"
                      step="0.01"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                {/* Tipo de Custo */}
                <div className="space-y-2">
                  <Label htmlFor="cost_type">Tipo de Custo</Label>
                  <Select value={costType} onValueChange={setCostType} disabled={isUpdating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custo_fixo">Custo Fixo</SelectItem>
                      <SelectItem value="custo_variavel">Custo Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Resumo */}
                <div className="space-y-2">
                  <Label htmlFor="summary">Resumo</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Descrição da fatura"
                    rows={3}
                    disabled={isUpdating}
                  />
                </div>

                {/* Links úteis */}
                <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
                  <p><strong>Tipo:</strong> {invoice.document_type || 'N/A'}</p>
                  {invoice.spreadsheet_id && (
                    <p>
                      <strong>Excel:</strong>{' '}
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${invoice.spreadsheet_id}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Abrir Google Sheets
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Footer com botões */}
            <div className="p-6 pt-4 border-t flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A atualizar...
                  </>
                ) : (
                  'Guardar Alterações'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
