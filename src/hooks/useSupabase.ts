import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Documento, ClienteDerivado } from '@/types/database'

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
  cliente?: string
}) {
  return useQuery({
    queryKey: ['documentos', 'filtered', filters],
    queryFn: async () => {
      let query = supabase
        .from('documentos')
        .select('*')
        .order('data_doc', { ascending: false })

      if (filters.search) {
        query = query.ilike('fornecedor_nome', `%${filters.search}%`)
      }
      if (filters.categoria && filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria)
      }
      if (filters.tipo && filters.tipo !== 'all') {
        query = query.eq('tipo', filters.tipo)
      }
      if (filters.cliente && filters.cliente !== 'all') {
        query = query.eq('cliente_nome', filters.cliente)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar documentos (filtered):', error.message, error.details, error.hint)
        throw error
      }

      return (data || []) as Documento[]
    },
  })
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
        .select('fornecedor_nome')

      if (fornError) throw fornError
      const fornecedores = (fornecedoresData || []) as { fornecedor_nome: string }[]
      const uniqueFornecedores = new Set(fornecedores.map(d => d.fornecedor_nome)).size

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
      
      const docs = (data || []) as { tipo: string }[]
      const unique = [...new Set(docs.map(d => d.tipo).filter(Boolean))]
      return unique as string[]
    },
  })
}

// Fetch unique cliente names from documentos (for filter dropdown)
export function useClienteNames() {
  return useQuery({
    queryKey: ['cliente_names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('cliente_nome')

      if (error) throw error
      
      const docs = (data || []) as { cliente_nome: string }[]
      const unique = [...new Set(docs.map(d => d.cliente_nome).filter(Boolean))]
      return unique.sort() as string[]
    },
  })
}

// Fetch derived clientes from documentos with stats
export function useClientesDerivados(search?: string) {
  return useQuery({
    queryKey: ['clientes_derivados', search],
    queryFn: async (): Promise<ClienteDerivado[]> => {
      const { data, error } = await supabase
        .from('documentos')
        .select('cliente_nome, total')

      if (error) {
        console.error('Erro ao buscar clientes:', error.message, error.details, error.hint)
        throw error
      }

      console.log('Dados para clientes:', data?.length || 0, 'documentos')

      const docs = (data || []) as { cliente_nome: string; total: number }[]
      
      // Aggregate by cliente_nome
      const clienteMap: Record<string, { totalDocumentos: number; totalGasto: number }> = {}
      
      docs.forEach((doc) => {
        if (!doc.cliente_nome) return
        if (!clienteMap[doc.cliente_nome]) {
          clienteMap[doc.cliente_nome] = { totalDocumentos: 0, totalGasto: 0 }
        }
        clienteMap[doc.cliente_nome].totalDocumentos += 1
        clienteMap[doc.cliente_nome].totalGasto += doc.total || 0
      })

      let clientes = Object.entries(clienteMap).map(([nome, stats]) => ({
        nome,
        totalDocumentos: stats.totalDocumentos,
        totalGasto: Math.round(stats.totalGasto * 100) / 100,
      }))

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase()
        clientes = clientes.filter(c => c.nome.toLowerCase().includes(searchLower))
      }

      // Sort alphabetically
      return clientes.sort((a, b) => a.nome.localeCompare(b.nome))
    },
  })
}

// Fetch documentos for a specific cliente
export function useDocumentosByCliente(clienteNome: string) {
  return useQuery({
    queryKey: ['documentos', 'by_cliente', clienteNome],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('cliente_nome', clienteNome)
        .order('data_doc', { ascending: false })

      if (error) throw error
      return (data || []) as Documento[]
    },
    enabled: !!clienteNome,
  })
}

// Fetch extratos with filters
export function useExtratos(filters: {
  search?: string
  banco?: string
  cliente?: string
}) {
  return useQuery({
    queryKey: ['extratos', filters],
    queryFn: async () => {
      let query = supabase
        .from('extratos_movimentos')
        .select('*')
        .order('data_movimento', { ascending: false })

      if (filters.search) {
        query = query.ilike('descritivo', `%${filters.search}%`)
      }
      if (filters.banco && filters.banco !== 'all') {
        query = query.eq('banco_nome', filters.banco)
      }
      if (filters.cliente && filters.cliente !== 'all') {
        query = query.eq('cliente_nome', filters.cliente)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar extratos:', error.message)
        throw error
      }

      return data || []
    },
  })
}

// Fetch unique bancos from extratos
export function useBancos() {
  return useQuery({
    queryKey: ['bancos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extratos_movimentos')
        .select('banco_nome')

      if (error) throw error
      
      const docs = (data || []) as { banco_nome: string }[]
      const unique = [...new Set(docs.map(d => d.banco_nome).filter(Boolean))]
      return unique.sort() as string[]
    },
  })
}
