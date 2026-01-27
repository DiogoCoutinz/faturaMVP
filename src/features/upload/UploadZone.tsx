import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { processInvoiceUpload } from '@/lib/invoiceProcessor';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Link } from 'react-router-dom';
import type { Invoice } from '@/types/database';

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'analyzing' | 'success' | 'error' | 'duplicate';
  message?: string;
  invoice?: Invoice;
}

interface StorageAccount {
  access_token: string;
  token_expiry: string;
  email: string;
}

const MAX_FILES = 10;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function UploadZone() {
  const { user } = useAuth();
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [storageAccount, setStorageAccount] = useState<StorageAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const processingRef = useRef(false);

  // Função para buscar e renovar token se necessário
  const fetchAndRefreshToken = useCallback(async () => {
    setIsLoading(true);
    setRefreshError(null);

    try {
      // Buscar conta principal
      const { data } = await supabase
        .from('user_oauth_tokens')
        .select('access_token, token_expiry, email, refresh_token')
        .eq('provider', 'google')
        .eq('is_primary_storage', true)
        .single();

      if (!data) {
        setStorageAccount(null);
        setIsLoading(false);
        return;
      }

      // Verificar se token expirou ou vai expirar nos próximos 5 minutos
      const now = new Date();
      const bufferMs = 5 * 60 * 1000;
      const isExpired = new Date(data.token_expiry).getTime() < now.getTime() + bufferMs;

      if (isExpired && data.refresh_token && SUPABASE_URL) {
        console.log('[UploadZone] Token expirado/prestes a expirar, a renovar...');

        const response = await fetch(`${SUPABASE_URL}/functions/v1/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email }),
        });

        const result = await response.json();

        if (response.ok) {
          console.log('[UploadZone] Token renovado com sucesso!', result);
          // Buscar token atualizado
          const { data: refreshedData } = await supabase
            .from('user_oauth_tokens')
            .select('access_token, token_expiry, email')
            .eq('email', data.email)
            .single();

          if (refreshedData) {
            setStorageAccount(refreshedData);
          }
        } else {
          console.error('[UploadZone] Falha ao renovar token:', result);
          setRefreshError(result.error || 'Erro ao renovar token');
          // Usar token atual mesmo expirado (pode ainda funcionar)
          setStorageAccount(data);
        }
      } else {
        // Token válido
        setStorageAccount(data);
      }
    } catch (error) {
      console.error('[UploadZone] Erro ao buscar/renovar token:', error);
      setRefreshError('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Buscar e renovar token ao carregar
  useEffect(() => {
    fetchAndRefreshToken();
  }, [fetchAndRefreshToken]);

  // Token atual
  const storageToken = storageAccount?.access_token || null;

  // Processar ficheiros em fila
  useEffect(() => {
    if (!isProcessing || processingRef.current) return;

    processingRef.current = true;

    const processQueue = async (statuses: FileUploadStatus[]) => {
      for (let i = 0; i < statuses.length; i++) {
        if (abortRef.current) break;

        setCurrentIndex(i);

        // Marcar como uploading
        setFileStatuses(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading', message: 'A carregar...' } : f
        ));

        await new Promise(r => setTimeout(r, 300));

        // Marcar como analyzing
        setFileStatuses(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'analyzing', message: 'A analisar com IA...' } : f
        ));

        try {
          const result = await processInvoiceUpload(statuses[i].file, user?.id || null, storageToken);

          if (result.success && result.invoice) {
            setFileStatuses(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: 'success', message: 'Processado!', invoice: result.invoice } : f
            ));
          } else if (result.isDuplicate) {
            setFileStatuses(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: 'duplicate', message: 'Duplicado' } : f
            ));
          } else {
            setFileStatuses(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: 'error', message: result.error || 'Erro' } : f
            ));
          }
        } catch (error) {
          setFileStatuses(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', message: error instanceof Error ? error.message : 'Erro' } : f
          ));
        }

        await new Promise(r => setTimeout(r, 500));
      }

      setIsProcessing(false);
      processingRef.current = false;
    };

    processQueue(fileStatuses);
  }, [isProcessing, storageToken, user?.id]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    if (!storageAccount) {
      setFileStatuses([{
        file: acceptedFiles[0],
        status: 'error',
        message: 'Por favor, adicione uma conta Google em Automações primeiro.',
      }]);
      return;
    }

    if (!storageToken) {
      setFileStatuses([{
        file: acceptedFiles[0],
        status: 'error',
        message: 'Erro ao obter token. Tente recarregar a página.',
      }]);
      return;
    }

    // Limitar a MAX_FILES
    const filesToProcess = acceptedFiles.slice(0, MAX_FILES);

    // Criar status para cada ficheiro
    const newStatuses: FileUploadStatus[] = filesToProcess.map(file => ({
      file,
      status: 'pending' as const,
    }));

    setFileStatuses(newStatuses);
    abortRef.current = false;
    setIsProcessing(true);
  }, [storageAccount, storageToken]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    maxFiles: MAX_FILES,
    disabled: isProcessing || isLoading,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const resetUpload = () => {
    abortRef.current = true;
    setIsProcessing(false);
    processingRef.current = false;
    setFileStatuses([]);
    setCurrentIndex(0);
  };

  const completedCount = fileStatuses.filter(f => f.status === 'success').length;
  const errorCount = fileStatuses.filter(f => f.status === 'error' || f.status === 'duplicate').length;
  const totalCount = fileStatuses.length;
  const progress = totalCount > 0 ? Math.round(((completedCount + errorCount) / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* A CARREGAR / A RENOVAR TOKEN */}
      {isLoading && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 shrink-0 animate-spin" />
              <div className="flex-1">
                <p className="font-medium text-blue-800">A verificar autenticação...</p>
                <p className="text-sm text-blue-700">
                  A renovar tokens automaticamente se necessário.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ERRO AO RENOVAR TOKEN */}
      {!isLoading && refreshError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-800">Erro ao renovar token</p>
                <p className="text-sm text-red-700">{refreshError}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                  onClick={fetchAndRefreshToken}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Tentar Novamente
                </Button>
                <Link to="/automations">
                  <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-100">
                    Ir para Automações
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEM CONTA CONFIGURADA */}
      {!isLoading && !storageAccount && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800">Nenhuma conta configurada</p>
                <p className="text-sm text-yellow-700">
                  Adicione uma conta Google em Automações para poder fazer upload de faturas.
                </p>
              </div>
              <Link to="/automations">
                <Button variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-100">
                  Configurar Conta
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOKEN PRONTO - MENSAGEM DE SUCESSO */}
      {!isLoading && storageAccount && !refreshError && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-green-800">Pronto para upload!</p>
                <p className="text-sm text-green-700">
                  Conta <strong>{storageAccount.email}</strong> conectada. Token válido.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DRAG & DROP ZONE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Faturas
          </CardTitle>
          <CardDescription>
            Arraste ficheiros ou clique para selecionar (até {MAX_FILES} ficheiros, JPG/PNG/PDF, max 10MB cada)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              ${isProcessing || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />

            {fileStatuses.length === 0 && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {isDragActive ? 'Solte os ficheiros aqui' : 'Arraste faturas ou clique para selecionar'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Formatos aceites: JPG, PNG, PDF (até 10MB cada, máximo {MAX_FILES} ficheiros)
                  </p>
                </div>
              </div>
            )}

            {fileStatuses.length > 0 && isProcessing && (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <div>
                  <p className="text-lg font-medium text-foreground">
                    A processar {currentIndex + 1} de {totalCount}...
                  </p>
                  <Progress value={progress} className="mt-3 max-w-xs mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {completedCount} processadas, {errorCount} erros
                  </p>
                </div>
              </div>
            )}

            {fileStatuses.length > 0 && !isProcessing && (
              <div className="space-y-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
                <p className="text-lg font-medium text-green-600">
                  Processamento concluído!
                </p>
                <p className="text-sm text-muted-foreground">
                  {completedCount} sucesso, {errorCount} erros/duplicados
                </p>
                <Button variant="outline" onClick={resetUpload}>
                  Carregar Mais
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LISTA DE FICHEIROS */}
      {fileStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Ficheiros ({fileStatuses.length})</span>
              {!isProcessing && (
                <Button variant="ghost" size="sm" onClick={resetUpload}>
                  Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {fileStatuses.map((fileStatus, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  fileStatus.status === 'success' ? 'bg-green-50 border-green-200' :
                  fileStatus.status === 'error' ? 'bg-red-50 border-red-200' :
                  fileStatus.status === 'duplicate' ? 'bg-yellow-50 border-yellow-200' :
                  fileStatus.status === 'uploading' || fileStatus.status === 'analyzing' ? 'bg-blue-50 border-blue-200' :
                  'bg-muted/50 border-muted'
                }`}
              >
                {/* Status Icon */}
                <div className="shrink-0">
                  {fileStatus.status === 'pending' && <FileText className="h-5 w-5 text-muted-foreground" />}
                  {(fileStatus.status === 'uploading' || fileStatus.status === 'analyzing') && (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  )}
                  {fileStatus.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {fileStatus.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                  {fileStatus.status === 'duplicate' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileStatus.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fileStatus.message || 'A aguardar...'}
                    {fileStatus.invoice && (
                      <span className="ml-2 font-medium">
                        — {fileStatus.invoice.supplier_name} ({formatCurrency(Number(fileStatus.invoice.total_amount) || 0)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* INSTRUÇÕES */}
      {fileStatuses.length === 0 && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal list-inside space-y-1">
              <li>Carrega até {MAX_FILES} faturas de uma vez (imagens ou PDFs)</li>
              <li>A IA (Gemini) extrai automaticamente os dados de cada uma</li>
              <li>Os dados são guardados e organizados no Google Drive</li>
              <li>Podes consultar tudo na página "Faturas"</li>
            </ol>
            <p className="text-xs pt-2 border-t mt-3">
              Dica: Quanto melhor a qualidade da imagem, mais precisa será a análise.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
