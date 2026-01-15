-- MIGRAÇÃO: Adicionar campos para Google Drive (Fase 2)
-- Executar no SQL Editor do Supabase

-- Adicionar storage_path para rastrear o caminho no Supabase Storage
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS storage_path TEXT;

COMMENT ON COLUMN public.invoices.storage_path IS 
'Caminho do ficheiro no Supabase Storage (ex: uploads/user_id/file.pdf). 
Usado para limpeza após migração para Google Drive.';

-- Adicionar drive_file_id para integração com Google Drive (Fase 2)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

COMMENT ON COLUMN public.invoices.drive_file_id IS 
'ID do ficheiro no Google Drive. Usado para manipulação via Google Drive API.';

-- drive_link já existe, apenas adicionar comentário
COMMENT ON COLUMN public.invoices.drive_link IS 
'URL público de visualização no Google Drive. Será o link permanente após migração.';

-- Criar índice para queries rápidas por drive_file_id
CREATE INDEX IF NOT EXISTS idx_invoices_drive_file_id 
ON public.invoices(drive_file_id);

-- Criar índice para queries por storage_path (para limpeza em lote)
CREATE INDEX IF NOT EXISTS idx_invoices_storage_path 
ON public.invoices(storage_path);

-- Atualizar coluna status para incluir 'migrated'
ALTER TABLE public.invoices 
ALTER COLUMN status TYPE TEXT;

COMMENT ON COLUMN public.invoices.status IS 
'Estado do processamento: pending | processed | review | migrated';

-- Query útil: Ver faturas ainda não migradas para Drive
-- SELECT id, supplier_name, storage_path, drive_file_id 
-- FROM invoices 
-- WHERE storage_path IS NOT NULL AND drive_file_id IS NULL;
