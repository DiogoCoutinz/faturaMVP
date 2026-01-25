import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/common/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Clock,
  Mail,
  HardDrive,
  Database,
  Zap,
  RefreshCw,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SyncLog {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  processed_count: number;
  duplicate_count: number;
  error_count: number;
  metadata: { email?: string; skipped?: number };
}

interface ConnectedAccount {
  id: string;
  email: string;
  token_expiry: string;
  is_primary_storage: boolean;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

export default function AutomationsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAccount, setAddingAccount] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const [accountsRes, logsRes] = await Promise.all([
      supabase.from('user_oauth_tokens').select('id, email, token_expiry, is_primary_storage').eq('provider', 'google'),
      supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(5),
    ]);

    setAccounts(accountsRes.data || []);
    setSyncLogs(logsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Verificar se voltámos do OAuth
    const handleOAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken) {
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
          // Obter informações do utilizador do Google
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const userInfo = await userInfoRes.json();

          // Verificar se já existe
          const { data: existing } = await supabase
            .from('user_oauth_tokens')
            .select('id')
            .eq('email', userInfo.email)
            .single();

          if (existing) {
            // Atualizar tokens existentes
            await supabase
              .from('user_oauth_tokens')
              .update({
                access_token: accessToken,
                refresh_token: refreshToken || undefined,
                token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
              })
              .eq('id', existing.id);
            toast.success(`Conta ${userInfo.email} atualizada!`);
          } else {
            // Criar novo registo
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('user_oauth_tokens').insert({
              user_id: user?.id || userInfo.id,
              provider: 'google',
              email: userInfo.email,
              access_token: accessToken,
              refresh_token: refreshToken || '',
              token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
              scopes: GOOGLE_SCOPES.split(' '),
            });
            toast.success(`Conta ${userInfo.email} adicionada!`);
          }

          fetchData();
        } catch {
          toast.error('Erro ao guardar conta');
        }
      }
    };

    handleOAuthCallback();
  }, []);

  const handleAddAccount = async () => {
    setAddingAccount(true);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google Client ID não configurado');
      setAddingAccount(false);
      return;
    }

    const redirectUri = window.location.origin + '/automations';
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES);
    authUrl.searchParams.set('prompt', 'select_account');

    window.location.href = authUrl.toString();
  };

  const handleRemoveAccount = async (accountId: string, email: string) => {
    if (!confirm(`Remover a conta ${email}?`)) return;

    const { error } = await supabase
      .from('user_oauth_tokens')
      .delete()
      .eq('id', accountId);

    if (error) {
      toast.error('Erro ao remover conta');
    } else {
      toast.success('Conta removida');
      fetchData();
    }
  };

  const handleSetPrimaryStorage = async (accountId: string, email: string) => {
    const { error } = await supabase
      .from('user_oauth_tokens')
      .update({ is_primary_storage: true })
      .eq('id', accountId);

    if (error) {
      toast.error('Erro ao definir conta principal');
    } else {
      toast.success(`${email} definida como conta de armazenamento`);
      fetchData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Sucesso</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Parcial</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">A correr...</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary" />
              Automações
            </h1>
            <p className="mt-1 text-muted-foreground">
              Sincronização automática de faturas do Gmail (últimas 24h)
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Contas Conectadas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contas Conectadas
                </CardTitle>
                <CardDescription>
                  Contas Gmail que serão verificadas. A conta com <Star className="h-3 w-3 inline" /> guarda os ficheiros no Drive/Sheets.
                </CardDescription>
              </div>
              <Button onClick={handleAddAccount} disabled={addingAccount} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Conta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Nenhuma conta conectada</p>
                  <p className="text-sm text-yellow-700">Adiciona uma conta Gmail para começar a sincronização automática.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      acc.is_primary_storage
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        acc.is_primary_storage
                          ? 'bg-primary/20'
                          : 'bg-primary/10'
                      }`}>
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{acc.email}</p>
                          {acc.is_primary_storage && (
                            <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                              <Star className="h-3 w-3" />
                              Armazenamento
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Token expira: {new Date(acc.token_expiry).toLocaleString('pt-PT')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!acc.is_primary_storage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => handleSetPrimaryStorage(acc.id, acc.email)}
                          title="Definir como conta de armazenamento"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveAccount(acc.id, acc.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Clock className="h-5 w-5" />
              Sincronização Automática
            </CardTitle>
            <CardDescription>
              Todos os dias às 23:59, verifica emails das últimas 24 horas com anexos PDF
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Sync Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-5 w-5" />
              Últimas Sincronizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sincronização registada ainda.</p>
            ) : (
              <div className="space-y-3">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-background"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.status)}
                        <span className="text-xs text-muted-foreground">
                          {log.metadata?.email || 'Sistema'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.started_at).toLocaleString('pt-PT')}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-medium">
                          {log.processed_count} novas
                        </span>
                        {log.duplicate_count > 0 && (
                          <span className="text-yellow-600">{log.duplicate_count} dup</span>
                        )}
                        {log.error_count > 0 && (
                          <span className="text-red-600">{log.error_count} erros</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Verifica <strong>emails das últimas 24h</strong> com anexos PDF</span>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Analisa com <strong>Gemini AI</strong> - só processa faturas/recibos</span>
              </div>
              <div className="flex items-start gap-3">
                <HardDrive className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Organiza no <strong>Google Drive</strong> por ano e tipo de custo</span>
              </div>
              <div className="flex items-start gap-3">
                <Database className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Regista no <strong>Supabase</strong> e <strong>Google Sheets</strong></span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Ignora duplicados automaticamente</span>
              </div>
            </div>

            <Separator className="my-4" />

            <p className="text-xs">
              Os erros são enviados automaticamente para o webhook de monitorização.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
