-- ============================================================================
-- MIGRATION: Tabelas para Automação de Sincronização Gmail
-- ============================================================================

-- Tabela: user_oauth_tokens
-- Armazena tokens OAuth para múltiplas contas Google por utilizador
CREATE TABLE IF NOT EXISTS public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  email TEXT, -- Email da conta Google (para identificação)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Cada conta Google só pode estar registada uma vez por utilizador
  UNIQUE(user_id, provider, email)
);

-- Índice para busca rápida por provider
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON public.user_oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON public.user_oauth_tokens(user_id);

-- RLS: Utilizadores só veem os seus próprios tokens
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" ON public.user_oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON public.user_oauth_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON public.user_oauth_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON public.user_oauth_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role full access" ON public.user_oauth_tokens
  USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- Tabela: sync_logs
-- Regista histórico de todas as sincronizações
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  processed_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON public.sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON public.sync_logs(started_at DESC);

-- RLS: Utilizadores só veem os seus próprios logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.sync_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role full access logs" ON public.sync_logs
  USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- Função: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para user_oauth_tokens
DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON public.user_oauth_tokens;
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Comentários para documentação
COMMENT ON TABLE public.user_oauth_tokens IS 'Tokens OAuth para múltiplas contas Google (Gmail, Drive, Sheets)';
COMMENT ON COLUMN public.user_oauth_tokens.email IS 'Email da conta Google para identificação visual';
COMMENT ON COLUMN public.user_oauth_tokens.scopes IS 'Scopes OAuth autorizados para esta conta';

COMMENT ON TABLE public.sync_logs IS 'Histórico de sincronizações automáticas do Gmail';
COMMENT ON COLUMN public.sync_logs.status IS 'running=em curso, success=sucesso total, partial=parcialmente ok, failed=falhou';
COMMENT ON COLUMN public.sync_logs.metadata IS 'Dados extras: email da conta, etc.';
