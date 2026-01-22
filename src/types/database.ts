import { Documento } from "./database";

export interface Invoice {
  id: string;
  created_at: string;
  user_id: string | null;
  
  // STORAGE (Fase 1: Supabase como cache temporário)
  file_url: string; // URL público do Supabase Storage
  storage_path: string | null; // Caminho interno no bucket (ex: uploads/user_id/file.pdf)
  
  // GOOGLE DRIVE (Fase 2: Migração para armazenamento permanente)
  drive_link: string | null; // URL público do Google Drive (quando migrado)
  drive_file_id: string | null; // ID do ficheiro no Google Drive (para manipulação via API)
  spreadsheet_id: string | null; // ID do Google Sheets (EXTRATO_YEAR)
  
  // DADOS EXTRAÍDOS PELA AI
  document_type: string | null;
  cost_type: string | null;
  doc_date: string | null;
  doc_year: number | null;
  supplier_name: string | null;
  supplier_vat: string | null;
  doc_number: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  summary: string | null;
  
  // CONTROLO DE QUALIDADE
  status: string | null; // 'pending' | 'processed' | 'review' | 'migrated'
  manual_review: boolean | null;
}

// Manter alias para não quebrar o código existente enquanto migramos
export type DocumentoAlias = Documento;
