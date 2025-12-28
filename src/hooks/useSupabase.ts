import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Documento } from '@/types/database'

type DocumentoUpdate = {
  fornecedor?: string
  nif_fornecedor?: string | null
  numero_doc?: string | null
  total?: number
  categoria?: string | null
  tipo?: string | null
  data_doc?: string
  link_drive?: string | null
  sheet_link?: string | null
  ano?: number | null
  mes?: string | null
}

// Fetch all documentos
export function useDocumentos() {
  return useQuery({
    queryKey: ['documentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .order('data_doc', { ascending: false })

      if (error) {
        console.error('Erro ao buscar documentos:', error.message, error.details, error.hint)
        throw error
      }
      
      console.log('Documentos carregados:', data?.length || 0)
      return (data || []) as Documento[]
    },
  })
}

// Fetch documentos with filters
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
        .from('documentos')
        .select('*')
        .order('data_doc', { ascending: false })

      if (filters.search) {
        query = query.ilike('fornecedor', `%${filters.search}%`)
      }
      if (filters.categoria && filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria)
      }
      if (filters.tipo && filters.tipo !== 'all') {
        query = query.eq('tipo', filters.tipo)
      }
      const hasAno = !!(filters.ano && filters.ano !== 'all')
      const hasMes = !!(filters.mes && filters.mes !== 'all')

      // Filtrar por ano e/ou mês usando a data_doc (tipo DATE)
      if (hasAno && hasMes) {
        const ano = parseInt(filters.ano as string, 10)
        const mes = parseInt(filters.mes as string, 10)
        const mesNum = String(mes).padStart(2, '0')

        const startOfMonth = `${ano}-${mesNum}-01`
        const nextAno = mes === 12 ? ano + 1 : ano
        const nextMes = mes === 12 ? 1 : mes + 1
        const endExclusive = `${nextAno}-${String(nextMes).padStart(2, '0')}-01`

        query = query.gte('data_doc', startOfMonth).lt('data_doc', endExclusive)
      } else if (hasAno) {
        const ano = parseInt(filters.ano as string, 10)
        const startOfYear = `${ano}-01-01`
        const endExclusive = `${ano + 1}-01-01`
        query = query.gte('data_doc', startOfYear).lt('data_doc', endExclusive)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar documentos (filtered):', error.message, error.details, error.hint)
        throw error
      }

      let result = (data || []) as Documento[]

      // Só mês selecionado (sem ano): filtra no cliente para evitar operadores inválidos em DATE
      if (!hasAno && hasMes) {
        const mes = parseInt(filters.mes as string, 10)
        result = result.filter((d) => parseInt(d.data_doc.slice(5, 7), 10) === mes)
      }

      return result
    },
  })
}

function getMesNome(mes: number): string {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]
  return meses[mes - 1] || ""
}


// Dashboard metrics
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async (): Promise<{
      totalFaturas: number
      saldoTotal: number
      totalGastos: number
      totalReceitas: number
      uniqueFornecedores: number
      ultimaFatura: Documento | null
    }> => {
      // Total count
      const { count: totalFaturas, error: countError } = await supabase
        .from('documentos')
        .select('*', { count: 'exact', head: true })

      if (countError) throw countError

      // Sum total
      const { data: sumData, error: sumError } = await supabase
        .from('documentos')
        .select('total')

      if (sumError) throw sumError
      const docs = (sumData || []) as { total: number }[]
      
      // Saldo Total: soma direta de todos os valores
      const saldoTotal = docs.reduce((acc, d) => acc + (d.total || 0), 0)
      
      // Total Gastos: soma apenas dos valores negativos (< 0)
      const totalGastos = docs
        .filter(d => d.total < 0)
        .reduce((acc, d) => acc + d.total, 0)
      
      // Total Receitas: soma apenas dos valores positivos (> 0)
      const totalReceitas = docs
        .filter(d => d.total > 0)
        .reduce((acc, d) => acc + d.total, 0)

      // Unique fornecedores
      const { data: fornecedoresData, error: fornError } = await supabase
        .from('documentos')
        .select('fornecedor')

      if (fornError) throw fornError
      const fornecedores = (fornecedoresData || []) as { fornecedor: string }[]
      const uniqueFornecedores = new Set(fornecedores.map(d => d.fornecedor)).size

      // Latest invoice
      const { data: latestData, error: latestError } = await supabase
        .from('documentos')
        .select('*')
        .order('data_doc', { ascending: false })
        .limit(1)

      if (latestError) throw latestError
      const latest = (latestData || []) as Documento[]
      const ultimaFatura = latest[0] || null

      return {
        totalFaturas: totalFaturas || 0,
        saldoTotal,
        totalGastos,
        totalReceitas,
        uniqueFornecedores,
        ultimaFatura,
      }
    },
  })
}

// Category breakdown for chart
export function useCategoryBreakdown() {
  return useQuery({
    queryKey: ['dashboard', 'categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('categoria, total')

      if (error) throw error

      const docs = (data || []) as { categoria: string | null; total: number }[]
      const categoryTotals: Record<string, number> = {}
      docs.forEach((doc) => {
        const cat = doc.categoria || 'Sem categoria'
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (doc.total || 0)
      })

      return Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value)
    },
  })
}

// Recent documentos for dashboard
export function useRecentDocumentos(limit = 5) {
  return useQuery({
    queryKey: ['documentos', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .order('data_doc', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data || []) as Documento[]
    },
  })
}

// Fetch unique categories
export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('categoria')

      if (error) throw error
      
      const docs = (data || []) as { categoria: string | null }[]
      const unique = [...new Set(docs.map(d => d.categoria).filter(Boolean))]
      return unique as string[]
    },
  })
}

// Fetch unique tipos
export function useTipos() {
  return useQuery({
    queryKey: ['tipos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('tipo')

      if (error) throw error
      
      const docs = (data || []) as { tipo: string | null }[]
      const unique = [...new Set(docs.map(d => d.tipo).filter(Boolean))]
      return unique as string[]
    },
  })
}

// Fetch unique years from documentos
export function useAnos() {
  return useQuery({
    queryKey: ['anos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('data_doc')

      if (error) throw error
      
      const docs = (data || []) as { data_doc: string }[]
      const years = docs.map(d => new Date(d.data_doc).getFullYear())
      const unique = [...new Set(years)].sort((a, b) => b - a)
      return unique
    },
  })
}

// Update documento
export function useUpdateDocumento() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: DocumentoUpdate }) => {
      const { data, error } = await (supabase
        .from('documentos') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Erro ao atualizar documento:', error.message)
        throw error
      }
      return data as Documento
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// Delete documento
export function useDeleteDocumento() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('documentos')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Erro ao eliminar documento:', error.message)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
