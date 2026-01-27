/**
 * Hook global para renovar tokens automaticamente quando a app carrega
 * Garante que os tokens estão frescos antes de qualquer operação
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface TokenRefreshState {
  isRefreshing: boolean;
  refreshedCount: number;
  error: string | null;
}

export function useTokenRefresh(): TokenRefreshState {
  const hasRefreshed = useRef(false);
  const [state, setState] = useState<TokenRefreshState>({
    isRefreshing: true,
    refreshedCount: 0,
    error: null,
  });

  useEffect(() => {
    // Só executar uma vez por sessão
    if (hasRefreshed.current) return;
    hasRefreshed.current = true;

    const refreshExpiredTokens = async () => {
      if (!SUPABASE_URL) {
        setState({ isRefreshing: false, refreshedCount: 0, error: null });
        return;
      }

      // Buscar todas as contas Google que têm refresh_token
      const { data: accounts } = await supabase
        .from('user_oauth_tokens')
        .select('email, token_expiry, refresh_token')
        .eq('provider', 'google')
        .not('refresh_token', 'is', null);

      if (!accounts || accounts.length === 0) {
        setState({ isRefreshing: false, refreshedCount: 0, error: null });
        return;
      }

      const now = new Date();
      const bufferMs = 5 * 60 * 1000; // 5 minutos de margem
      let refreshedCount = 0;
      let lastError: string | null = null;

      for (const account of accounts) {
        // Renovar se expirou OU se vai expirar nos próximos 5 minutos
        const expiryTime = new Date(account.token_expiry).getTime();
        const needsRefresh = expiryTime < now.getTime() + bufferMs;

        if (needsRefresh && account.refresh_token) {
          console.log(`[TokenRefresh] A renovar token para ${account.email}...`);

          try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/refresh-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: account.email }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log(`[TokenRefresh] ✓ Token renovado para ${account.email}`, result);
              refreshedCount++;
            } else {
              const result = await response.json();
              console.warn(`[TokenRefresh] ✗ Falha ao renovar ${account.email}:`, result.error);
              lastError = result.error;
            }
          } catch (error) {
            console.error(`[TokenRefresh] ✗ Erro ao renovar ${account.email}:`, error);
            lastError = String(error);
          }
        } else {
          console.log(`[TokenRefresh] Token válido para ${account.email}`);
        }
      }

      setState({
        isRefreshing: false,
        refreshedCount,
        error: lastError,
      });
    };

    refreshExpiredTokens();
  }, []);

  return state;
}
