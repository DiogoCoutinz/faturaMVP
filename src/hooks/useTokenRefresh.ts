/**
 * Hook global para renovar tokens automaticamente quando a app carrega
 * Garante que os tokens estão frescos antes de qualquer operação
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useTokenRefresh() {
  const hasRefreshed = useRef(false);

  useEffect(() => {
    // Só executar uma vez por sessão
    if (hasRefreshed.current) return;
    hasRefreshed.current = true;

    const refreshExpiredTokens = async () => {
      if (!SUPABASE_URL) return;

      // Buscar todas as contas com tokens expirados que têm refresh_token
      const { data: accounts } = await supabase
        .from('user_oauth_tokens')
        .select('email, token_expiry, refresh_token')
        .eq('provider', 'google')
        .not('refresh_token', 'is', null);

      if (!accounts || accounts.length === 0) return;

      const now = new Date();

      for (const account of accounts) {
        const isExpired = new Date(account.token_expiry) < now;

        if (isExpired && account.refresh_token) {
          console.log(`[TokenRefresh] A renovar token para ${account.email}...`);

          try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/refresh-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: account.email }),
            });

            if (response.ok) {
              console.log(`[TokenRefresh] Token renovado para ${account.email}`);
            } else {
              const result = await response.json();
              console.warn(`[TokenRefresh] Falha ao renovar ${account.email}:`, result.error);
            }
          } catch (error) {
            console.error(`[TokenRefresh] Erro ao renovar ${account.email}:`, error);
          }
        }
      }
    };

    refreshExpiredTokens();
  }, []);
}
