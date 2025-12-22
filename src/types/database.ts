export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      documentos: {
        Row: {
          id: string
          cliente_nome: string
          fornecedor_nome: string
          fornecedor_nif: string | null
          tipo: string
          categoria: string | null
          numero_doc: string | null
          data_doc: string
          total: number
          drive_link: string | null
          sheet_link: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cliente_nome: string
          fornecedor_nome: string
          fornecedor_nif?: string | null
          tipo: string
          categoria?: string | null
          numero_doc?: string | null
          data_doc: string
          total: number
          drive_link?: string | null
          sheet_link?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cliente_nome?: string
          fornecedor_nome?: string
          fornecedor_nif?: string | null
          tipo?: string
          categoria?: string | null
          numero_doc?: string | null
          data_doc?: string
          total?: number
          drive_link?: string | null
          sheet_link?: string | null
          created_at?: string
        }
      }
    }
  }
}

export type Documento = Database['public']['Tables']['documentos']['Row']

// Derived type for clients (extracted from documentos)
export interface ClienteDerivado {
  nome: string
  totalDocumentos: number
  totalGasto: number
}
