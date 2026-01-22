import { useState } from 'react';
import { AppLayout } from '@/components/common/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Mail,
  HardDrive,
  Database,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { syncGmailInvoices, type SyncProgress } from '@/lib/sync-engine';

export default function AutomationsPage() {
  const { providerToken, hasGoogleScopes, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    phase: 'idle',
    message: '',
    current: 0,
    total: 0,
    errors: [],
  });
  const [lastSyncResult, setLastSyncResult] = useState<{
    processed: number;
    duplicates: number; // NOVO
    errors: string[];
    timestamp: Date;
  } | null>(null);

  const handleSync = async () => {
    if (!providerToken || !hasGoogleScopes) {
      alert('Conecta o Google primeiro em /settings');
      return;
    }

    setIsSyncing(true);
    setProgress({
      phase: 'fetching',
      message: 'Iniciando sincronização...',
      current: 0,
      total: 0,
      errors: [],
    });

    try {
      const result = await syncGmailInvoices(
        providerToken,
        user?.id || null,
        (progressUpdate) => {
          setProgress(progressUpdate);
        }
      );

      setLastSyncResult({
        processed: result.processed,
        duplicates: result.duplicates, // NOVO
        errors: result.errors,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Erro na sincronização:', error);
      setProgress({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        current: 0,
        total: 0,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getPhaseIcon = () => {
    switch (progress.phase) {
      case 'fetching':
        return <Mail className="h-5 w-5 animate-pulse" />;
      case 'processing':
        return <Zap className="h-5 w-5 animate-pulse" />;
      case 'uploading':
        return <HardDrive className="h-5 w-5 animate-pulse" />;
      case 'saving':
        return <Database className="h-5 w-5 animate-pulse" />;
      case 'done':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getPhaseColor = () => {
    switch (progress.phase) {
      case 'done':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            Automações
          </h1>
          <p className="mt-1 text-muted-foreground">
            Sincronização automática de faturas do Gmail para o Drive
          </p>
        </div>

        {/* Google Connection Status */}
        {!hasGoogleScopes && (
          <Alert variant="default" className="bg-yellow-50 border-yellow-200 animate-fade-in">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Conecta o Google primeiro!</strong> Vai a{' '}
              <a href="/settings" className="underline font-medium">
                Definições
              </a>{' '}
              para autorizar o acesso ao Gmail e Drive.
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Control Card */}
        <Card className={`animate-fade-in transition-colors ${getPhaseColor()}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getPhaseIcon()}
              Sincronizar Gmail
            </CardTitle>
            <CardDescription>
              Procura emails não lidos com faturas, processa com IA e guarda no Drive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            {isSyncing && progress.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {progress.current} de {progress.total}
                  </span>
                  <span className="font-medium">{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}

            {/* Status Message */}
            {progress.message && (
              <div className="flex items-center gap-2 text-sm">
                {isSyncing && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className={progress.phase === 'error' ? 'text-destructive' : ''}>
                  {progress.message}
                </span>
              </div>
            )}

            {/* Errors */}
            {progress.errors.length > 0 && (
              <Alert variant="destructive" className="text-sm">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{progress.errors.length} erro(s):</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                    {progress.errors.slice(0, 3).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {progress.errors.length > 3 && <li>... e mais {progress.errors.length - 3}</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Sync Button */}
            <Button
              onClick={handleSync}
              disabled={!hasGoogleScopes || isSyncing}
              className="w-full gap-2"
              size="lg"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  A sincronizar...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Sincronizar Agora
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Última Sincronização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data/Hora:</span>
                <span className="font-medium">
                  {lastSyncResult.timestamp.toLocaleString('pt-PT')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Faturas Processadas:</span>
                <Badge variant="default" className="font-semibold">
                  {lastSyncResult.processed}
                </Badge>
              </div>
              {lastSyncResult.duplicates > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duplicadas (Ignoradas):</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    {lastSyncResult.duplicates}
                  </Badge>
                </div>
              )}
              {lastSyncResult.errors.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Erros:</span>
                  <Badge variant="destructive">{lastSyncResult.errors.length}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ol className="list-decimal list-inside space-y-2">
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Procura emails <strong>não lidos</strong> com anexos PDF no Gmail</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Extrai dados (fornecedor, valor, data) com <strong>Gemini AI</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
                <span>Verifica se a fatura <strong>já existe</strong> no sistema (proteção contra duplicados)</span>
              </li>
              <li className="flex items-start gap-2">
                <HardDrive className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Guarda o PDF no <strong>Google Drive</strong> (pasta "Faturas 202X")</span>
              </li>
              <li className="flex items-start gap-2">
                <Database className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Salva os dados no <strong>Supabase</strong> e <strong>Google Sheets</strong> (aba do mês)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Marca o email como <strong>lido</strong> para não repetir</span>
              </li>
            </ol>

            <Separator className="my-4" />

            <p className="text-xs pt-2">
              💡 <strong>Dica:</strong> Envia faturas para o teu email Gmail e clica "Sincronizar Agora"
              para processar automaticamente!
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
