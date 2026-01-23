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
  status?: string
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
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) throw error
      let result = (data || []) as Invoice[]

      // Filtrar por ano
      if (filters.ano) {
        const parsedYear = parseInt(filters.ano, 10);
        if (!isNaN(parsedYear)) {
          result = result.filter(d => d.doc_year === parsedYear);
        }
      }

      // Filtrar por mês (1-12)
      if (filters.mes) {
        const parsedMonth = parseInt(filters.mes, 10);
        if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
          result = result.filter(d => {
            if (!d.doc_date) return false;
            const parts = d.doc_date.split('-');
            if (parts.length >= 2) {
              const month = parseInt(parts[1], 10);
              return month === parsedMonth;
            }
            return false;
          });
        }
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
      
      const totalGastos = docs.reduce((acc, d) => acc + Math.abs(Number(d.total_amount) || 0), 0)
      const custosFixos = docs
        .filter(d => d.cost_type === 'custo_fixo')
        .reduce((acc, d) => acc + Math.abs(Number(d.total_amount) || 0), 0)
      const custosVariaveis = docs
        .filter(d => d.cost_type === 'custo_variavel')
        .reduce((acc, d) => acc + Math.abs(Number(d.total_amount) || 0), 0)
      
      const countPendente = docs.filter(d => d.status === 'review').length
      
      return {
        totalFaturas: docs.length,
        totalGastos,
        custosFixos,
        custosVariaveis,
        countPendente
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
export function useCategoryBreakdown(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'categories', filters?.startDate, filters?.endDate],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('cost_type, total_amount, doc_date')

      if (filters?.startDate) {
        query = query.gte('doc_date', filters.startDate)
      }
      if (filters?.endDate) {
        query = query.lte('doc_date', filters.endDate)
      }

      const { data, error } = await query

      if (error) throw error

      const docs = (data || []) as { cost_type: string | null; total_amount: number | null; doc_date: string | null }[]
      const categoryTotals: Record<string, number> = {}
      docs.forEach((doc) => {
        const cat = doc.cost_type === 'custo_fixo' ? 'Custos Fixos' :
                   doc.cost_type === 'custo_variavel' ? 'Custos Variáveis' :
                   'Por Classificar'
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(doc.total_amount) || 0)
      })

      return Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value: Math.abs(Math.round(value * 100) / 100) }))
        .sort((a, b) => b.value - a.value)
    },
  })
}

// Trends data for line chart - returns daily data, grouping is done in TrendsChart
export function useExpenseTrends() {
  return useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('doc_date, total_amount, cost_type')
        .order('doc_date', { ascending: true })

      if (error) throw error

      const docs = (data || []) as { doc_date: string | null; total_amount: number | null; cost_type: string | null }[]

      // Group by day (YYYY-MM-DD) - TrendsChart will handle further aggregation
      const dailyData: Record<string, { date: string, fixos: number, variaveis: number }> = {}

      docs.forEach(doc => {
        if (!doc.doc_date) return
        const dateKey = doc.doc_date // Already in YYYY-MM-DD format

        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            fixos: 0,
            variaveis: 0
          }
        }

        const amount = Math.abs(Number(doc.total_amount) || 0)
        if (doc.cost_type === 'custo_fixo') {
          dailyData[dateKey].fixos += amount
        } else if (doc.cost_type === 'custo_variavel') {
          dailyData[dateKey].variaveis += amount
        }
      })

      return Object.values(dailyData)
        .map(d => ({
          date: d.date,
          fixos: Math.round(d.fixos * 100) / 100,
          variaveis: Math.round(d.variaveis * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }
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
