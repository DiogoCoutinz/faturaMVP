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
          id: number
          data_doc: string
          tipo: string | null
          fornecedor: string
          nif_fornecedor: string | null
          numero_doc: string | null
          total: number
          categoria: string | null
          link_drive: string | null
          ano: number | null
          mes: string | null
          created_at: string | null
        }
        Insert: {
          id?: never
          data_doc: string
          tipo?: string | null
          fornecedor: string
          nif_fornecedor?: string | null
          numero_doc?: string | null
          total: number
          categoria?: string | null
          link_drive?: string | null
          ano?: number | null
          mes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: never
          data_doc?: string
          tipo?: string | null
          fornecedor?: string
          nif_fornecedor?: string | null
          numero_doc?: string | null
          total?: number
          categoria?: string | null
          link_drive?: string | null
          ano?: number | null
          mes?: string | null
          created_at?: string | null
        }
      }
    }
  }
}

export type Documento = Database['public']['Tables']['documentos']['Row']

// Helper to get year from data_doc
export function getAnoFromDate(dataDoc: string): number {
  return new Date(dataDoc).getFullYear()
}

// Helper to get month from data_doc
export function getMesFromDate(dataDoc: string): string {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return months[new Date(dataDoc).getMonth()]
}
