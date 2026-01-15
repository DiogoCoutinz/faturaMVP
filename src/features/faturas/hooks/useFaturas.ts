import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Invoice } from '@/types/database'

// Fetch all invoices
export function useDocumentos() {
  return useQuery({
    queryKey: ['documentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('doc_date', { ascending: false })

      if (error) throw error
      return (data || []) as Invoice[]
    },
  })
}

// Fetch invoices with filters
export function useDocumentosFiltered(filters: {
  search?: string
  categoria?: string
  tipo?: string
  ano?: string
  mes?: string
}) {
  return useQuery({
    queryKey: ['documentos', 'filtered', filters],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('doc_date', { ascending: false })

      if (filters.search) {
        query = query.ilike('supplier_name', `%${filters.search}%`)
      }
      if (filters.categoria && filters.categoria !== 'all') {
        query = query.eq('cost_type', filters.categoria)
      }
      if (filters.tipo && filters.tipo !== 'all') {
        query = query.eq('document_type', filters.tipo)
      }
      
      const { data, error } = await query

      if (error) throw error
      let result = (data || []) as Invoice[]

      if (filters.ano && filters.ano !== 'all') {
        result = result.filter(d => d.doc_year === parseInt(filters.ano!))
      }

      return result
    },
  })
}

// Dashboard metrics
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*')
      if (error) throw error

      const docs = (data || []) as Invoice[]
      
      const saldoTotal = docs.reduce((acc, d) => acc + (Number(d.total_amount) || 0), 0)
      const totalGastos = docs.filter(d => (d.total_amount || 0) < 0).reduce((acc, d) => acc + Number(d.total_amount), 0)
      const totalReceitas = docs.filter(d => (d.total_amount || 0) > 0).reduce((acc, d) => acc + Number(d.total_amount), 0)
      const uniqueFornecedores = new Set(docs.map(d => d.supplier_name)).size
      const ultimaFatura = docs.sort((a, b) => {
        const dateA = a.doc_date ? new Date(a.doc_date).getTime() : 0
        const dateB = b.doc_date ? new Date(b.doc_date).getTime() : 0
        return dateB - dateA
      })[0] || null

      return {
        totalFaturas: docs.length,
        saldoTotal,
        totalGastos,
        totalReceitas,
        uniqueFornecedores,
        ultimaFatura
      }
    },
  })
}

// Recent documents for dashboard
export function useRecentDocumentos(limit = 5) {
  return useQuery({
    queryKey: ['documentos', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('doc_date', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data || []) as Invoice[]
    },
  })
}

// Category breakdown for chart
export function useCategoryBreakdown() {
  return useQuery({
    queryKey: ['dashboard', 'categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('cost_type, total_amount')

      if (error) throw error

      const docs = (data || []) as { cost_type: string | null; total_amount: number | null }[]
      const categoryTotals: Record<string, number> = {}
      docs.forEach((doc) => {
        const cat = doc.cost_type || 'Sem categoria'
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(doc.total_amount) || 0)
      })

      return Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value)
    },
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('cost_type')
      if (error) throw error
      return [...new Set(data.map(d => d.cost_type).filter(Boolean))] as string[]
    },
  })
}

export function useTipos() {
  return useQuery({
    queryKey: ['tipos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('document_type')
      if (error) throw error
      return [...new Set(data.map(d => d.document_type).filter(Boolean))] as string[]
    },
  })
}

export function useAnos() {
  return useQuery({
    queryKey: ['anos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('doc_year')
      if (error) throw error
      return [...new Set(data.map(d => d.doc_year).filter(Boolean))].sort((a, b) => b - a) as number[]
    },
  })
}

export function useUpdateDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Invoice> }) => {
      const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data as Invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
