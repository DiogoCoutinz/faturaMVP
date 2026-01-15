import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Mail, 
  HardDrive, 
  Sheet, 
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';

export function GoogleConnectionCard() {
  const { user, hasGoogleScopes, signInWithGoogle, signOut, loading, providerToken } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Erro ao conectar:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Tens a certeza que queres desconectar? As automações vão parar.')) {
      await signOut();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // User não está logado
  if (!user) {
    return (
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-6 w-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Conectar com Google
          </CardTitle>
          <CardDescription>
            Autoriza o acesso ao Gmail, Drive e Sheets para automação completa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="font-medium">Permissões necessárias:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Gmail (leitura) - Detetar faturas automaticamente
              </li>
              <li className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Google Drive - Guardar PDFs permanentemente
              </li>
              <li className="flex items-center gap-2">
                <Sheet className="h-4 w-4" /> Google Sheets - Dashboard de contabilidade
              </li>
            </ul>
          </div>

          <Separator />

          <Button 
            onClick={handleConnect} 
            disabled={isConnecting}
            className="w-full gap-2"
            size="lg"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A redirecionar...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                </svg>
                Conectar com Google
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ao conectar, autorizas o acesso às APIs do Google. Podes revogar a qualquer momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  // User logado mas sem scopes do Google
  if (!hasGoogleScopes) {
    return (
      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Permissões Incompletas
          </CardTitle>
          <CardDescription>
            Estás logado mas as automações não funcionam sem as permissões do Google
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="bg-yellow-100 border-yellow-300">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Para ativar a leitura automática de emails e upload para Drive, 
              precisas de reconectar a tua conta Google com as permissões corretas.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting}
              className="flex-1 gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A reconectar...
                </>
              ) : (
                'Reconectar com Google'
              )}
            </Button>
            <Button variant="outline" onClick={handleDisconnect}>
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User logado COM scopes (tudo OK!)
  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-5 w-5" />
          Google Conectado
        </CardTitle>
        <CardDescription>
          Todas as automações estão ativas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white border">
          {user.user_metadata?.avatar_url && (
            <img 
              src={user.user_metadata.avatar_url} 
              alt={user.user_metadata.full_name || user.email} 
              className="h-10 w-10 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {user.user_metadata?.full_name || user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>

        {/* Scopes Status */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Permissões Ativas:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <Mail className="h-4 w-4" />
              Gmail (leitura de emails)
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <HardDrive className="h-4 w-4" />
              Google Drive (upload de ficheiros)
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <Sheet className="h-4 w-4" />
              Google Sheets (escrita de dados)
            </div>
          </div>
        </div>

        <Separator />

        {/* Token Info (Debug) */}
        {providerToken && (
          <Alert>
            <AlertDescription className="text-xs font-mono truncate">
              Token: {providerToken.substring(0, 30)}...
            </AlertDescription>
          </Alert>
        )}

        {/* Disconnect Button */}
        <Button 
          variant="outline" 
          onClick={handleDisconnect}
          className="w-full gap-2"
        >
          <LogOut className="h-4 w-4" />
          Desconectar
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Para revogar completamente o acesso, vai a{' '}
          <a 
            href="https://myaccount.google.com/permissions" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Permissões da Conta Google
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
