import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { processInvoiceUpload } from '@/lib/invoiceProcessor';
import type { Invoice } from '@/types/database';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'analyzing' | 'success' | 'error';
  message?: string;
  invoice?: Invoice;
  progress?: number;
}

export function UploadZone() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle' });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0]; // Processar apenas 1 ficheiro de cada vez

    setUploadStatus({ 
      status: 'uploading', 
      message: `A carregar ${file.name}...`,
      progress: 30
    });

    // Simular progresso
    setTimeout(() => {
      setUploadStatus({ 
        status: 'analyzing', 
        message: 'A analisar documento com IA...',
        progress: 60
      });
    }, 800);

    try {
      const result = await processInvoiceUpload(file, null); // userId = null (sem auth)

      if (result.success && result.invoice) {
        setUploadStatus({
          status: 'success',
          message: 'Fatura processada com sucesso!',
          invoice: result.invoice,
          progress: 100
        });

        // Reset após 5 segundos
        setTimeout(() => {
          setUploadStatus({ status: 'idle' });
        }, 5000);
      } else {
        setUploadStatus({
          status: 'error',
          message: result.error || 'Erro desconhecido',
        });
      }
    } catch (error) {
      setUploadStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Falha no processamento',
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: uploadStatus.status === 'uploading' || uploadStatus.status === 'analyzing',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* DRAG & DROP ZONE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Fatura
          </CardTitle>
          <CardDescription>
            Arraste um ficheiro ou clique para selecionar (JPG, PNG ou PDF, max 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              ${(uploadStatus.status === 'uploading' || uploadStatus.status === 'analyzing') ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />

            {uploadStatus.status === 'idle' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {isDragActive ? 'Solte o ficheiro aqui' : 'Arraste uma fatura ou clique para selecionar'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Formatos aceites: JPG, PNG, PDF (até 10MB)
                  </p>
                </div>
              </div>
            )}

            {(uploadStatus.status === 'uploading' || uploadStatus.status === 'analyzing') && (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <div>
                  <p className="text-lg font-medium text-foreground">{uploadStatus.message}</p>
                  {uploadStatus.progress !== undefined && (
                    <Progress value={uploadStatus.progress} className="mt-3 max-w-xs mx-auto" />
                  )}
                </div>
              </div>
            )}

            {uploadStatus.status === 'success' && (
              <div className="space-y-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
                <p className="text-lg font-medium text-green-600">{uploadStatus.message}</p>
              </div>
            )}

            {uploadStatus.status === 'error' && (
              <div className="space-y-4">
                <XCircle className="h-12 w-12 mx-auto text-destructive" />
                <p className="text-lg font-medium text-destructive">{uploadStatus.message}</p>
                <Button variant="outline" onClick={() => setUploadStatus({ status: 'idle' })}>
                  Tentar Novamente
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RESULTADO DA ANÁLISE */}
      {uploadStatus.status === 'success' && uploadStatus.invoice && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Dados Extraídos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-medium text-muted-foreground">Fornecedor:</span>
                <p className="font-semibold">{uploadStatus.invoice.supplier_name}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Valor:</span>
                <p className="font-semibold text-lg">
                  {formatCurrency(Number(uploadStatus.invoice.total_amount) || 0)}
                </p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Data:</span>
                <p>{uploadStatus.invoice.doc_date}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Tipo:</span>
                <p className="capitalize">{uploadStatus.invoice.document_type}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Custo:</span>
                <p className="capitalize">{uploadStatus.invoice.cost_type || '—'}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Nº Doc:</span>
                <p>{uploadStatus.invoice.doc_number}</p>
              </div>
            </div>
            {uploadStatus.invoice.summary && (
              <div className="pt-2 border-t">
                <span className="font-medium text-muted-foreground">Resumo:</span>
                <p className="italic">{uploadStatus.invoice.summary}</p>
              </div>
            )}
            {uploadStatus.invoice.manual_review && (
              <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Revisão Manual Sugerida</strong> — A confiança da análise foi inferior a 70%.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* INSTRUÇÕES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ℹ️ Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ol className="list-decimal list-inside space-y-1">
            <li>Carrega a imagem ou PDF da fatura</li>
            <li>A IA (Gemini) extrai automaticamente os dados</li>
            <li>Os dados são guardados no Supabase</li>
            <li>Podes consultar tudo na página "Faturas"</li>
          </ol>
          <p className="text-xs pt-2 border-t mt-3">
            💡 <strong>Dica:</strong> Quanto melhor a qualidade da imagem, mais precisa será a análise.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
