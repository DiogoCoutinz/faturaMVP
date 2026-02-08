-- ============================================================================
-- FIX: RLS do user_oauth_tokens para MVP single-user
-- O oauth-callback insere com user_id=null (service role),
-- mas o frontend precisa ler os tokens com o user autenticado.
-- Solução: permitir acesso a qualquer utilizador autenticado (MVP).
-- ============================================================================

-- Remover policies antigas que filtram por user_id
DROP POLICY IF EXISTS "Users can view own tokens" ON public.user_oauth_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.user_oauth_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON public.user_oauth_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON public.user_oauth_tokens;

-- Novas policies: qualquer utilizador autenticado pode gerir tokens
CREATE POLICY "Authenticated users can view tokens"
  ON public.user_oauth_tokens FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert tokens"
  ON public.user_oauth_tokens FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tokens"
  ON public.user_oauth_tokens FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete tokens"
  ON public.user_oauth_tokens FOR DELETE
  USING (auth.role() = 'authenticated');

-- Manter policy de service role (para Edge Functions)
-- Já existe: "Service role full access tokens"

-- Também corrigir sync_logs para MVP
DROP POLICY IF EXISTS "Users can view own logs" ON public.sync_logs;

CREATE POLICY "Authenticated users can view logs"
  ON public.sync_logs FOR SELECT
  USING (auth.role() = 'authenticated');
