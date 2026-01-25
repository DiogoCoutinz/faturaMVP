import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Loader2,
  Mail,
  HardDrive,
  Sheet,
  RefreshCw,
  Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface ConnectedAccount {
  id: string;
  email: string;
  token_expiry: string;
}

export function GoogleConnectionCard() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_oauth_tokens')
      .select('id, email, token_expiry')
      .eq('provider', 'google');

    setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Nenhuma Conta Conectada
          </CardTitle>
          <CardDescription>
            Nenhuma conta Google foi configurada para sincronização automática.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As contas são configuradas via backend. Contacta o administrador para adicionar contas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
              Contas Conectadas
            </CardTitle>
            <CardDescription>
              Sincronização automática ativa para {accounts.length} conta(s)
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchAccounts}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de Contas */}
        <div className="space-y-2">
          {accounts.map((account) => {
            const isExpired = new Date(account.token_expiry) < new Date();
            return (
              <div
                key={account.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white border"
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white font-bold">
                  {account.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {account.email || 'Email não disponível'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Token válido até: {new Date(account.token_expiry).toLocaleString('pt-PT')}
                  </p>
                </div>
                <Badge variant={isExpired ? "destructive" : "default"} className={isExpired ? "" : "bg-green-100 text-green-800 border-green-300"}>
                  {isExpired ? "Expirado" : "Ativo"}
                </Badge>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Permissões Ativas */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Permissões Configuradas:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <Mail className="h-4 w-4" />
              Gmail (leitura de todos os anexos)
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <HardDrive className="h-4 w-4" />
              Google Drive (organização automática)
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <Sheet className="h-4 w-4" />
              Google Sheets (registos)
            </div>
          </div>
        </div>

        <Separator />

        <p className="text-xs text-center text-muted-foreground">
          A sincronização corre automaticamente a cada 24 horas via Edge Function.
        </p>
      </CardContent>
    </Card>
  );
}
