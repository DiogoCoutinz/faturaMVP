-- ============================================================================
-- FaturaAI MVP - Schema Completo
-- Criado: 2026-02-08
-- ============================================================================

-- ============================================================================
-- 1. TABELA: invoices (tabela principal de faturas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- STORAGE (ficheiro original)
  file_url TEXT NOT NULL,
  storage_path TEXT,

  -- GOOGLE DRIVE (armazenamento permanente)
  drive_link TEXT,
  drive_file_id TEXT,
  spreadsheet_id TEXT,

  -- DADOS EXTRAÍDOS PELA AI
  document_type TEXT,
  cost_type TEXT,
  doc_date TEXT,
  doc_year INTEGER,
  supplier_name TEXT,
  supplier_vat TEXT,
  doc_number TEXT,
  total_amount NUMERIC,
  tax_amount NUMERIC,
  summary TEXT,

  -- CONTROLO DE QUALIDADE
  status TEXT DEFAULT 'pending',
  manual_review BOOLEAN DEFAULT FALSE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_invoices_doc_date ON public.invoices(doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON public.invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_invoices_cost_type ON public.invoices(cost_type);
CREATE INDEX IF NOT EXISTS idx_invoices_doc_year ON public.invoices(doc_year);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_drive_file_id ON public.invoices(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_invoices_storage_path ON public.invoices(storage_path);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);

-- RLS: acesso autenticado
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all invoices"
  ON public.invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update invoices"
  ON public.invoices FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete invoices"
  ON public.invoices FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access invoices"
  ON public.invoices
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.invoices IS 'Faturas processadas pela AI - tabela principal do FaturaAI MVP';

-- ============================================================================
-- 2. TABELA: user_oauth_tokens (tokens OAuth Google)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  is_primary_storage BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider, email)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON public.user_oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON public.user_oauth_tokens(user_id);

ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens"
  ON public.user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON public.user_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON public.user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON public.user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access tokens"
  ON public.user_oauth_tokens
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.user_oauth_tokens IS 'Tokens OAuth para contas Google (Gmail, Drive, Sheets)';

-- ============================================================================
-- 3. TABELA: sync_logs (histórico de sincronizações)
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON public.sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON public.sync_logs(started_at DESC);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON public.sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access logs"
  ON public.sync_logs
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.sync_logs IS 'Histórico de sincronizações automáticas do Gmail';

-- ============================================================================
-- 4. TABELA: extratos_movimentos (movimentos bancários)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.extratos_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  data_movimento DATE,
  descricao TEXT,
  valor NUMERIC,
  tipo TEXT,
  categoria TEXT,
  referencia TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.extratos_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read extratos"
  ON public.extratos_movimentos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert extratos"
  ON public.extratos_movimentos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE public.extratos_movimentos IS 'Movimentos bancários importados';

-- ============================================================================
-- 5. FUNÇÃO: Auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON public.user_oauth_tokens;
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. STORAGE BUCKET para uploads temporários
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND auth.role() = 'authenticated');

CREATE POLICY "Public can read invoices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can delete own uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices' AND auth.role() = 'authenticated');
