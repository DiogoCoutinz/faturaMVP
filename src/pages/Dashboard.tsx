import { useState } from "react";
import { FileText, Euro, Building2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { AppLayout } from "@/components/common/AppLayout";
import { MetricCard } from "@/features/dashboard/MetricCard";
import { RecentInvoicesTable } from "@/features/dashboard/RecentInvoicesTable";
import { CategoryChart } from "@/features/dashboard/CategoryChart";
import { FaturaDetailDrawer } from "@/features/faturas/FaturaDetailDrawer";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useDashboardMetrics, useRecentDocumentos, useCategoryBreakdown } from "@/features/faturas/hooks/useFaturas";
import type { Invoice } from "@/types/database";

export default function Dashboard() {
  const [selectedFatura, setSelectedFatura] = useState<Invoice | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useDashboardMetrics();
  const { data: recentDocs, isLoading: recentLoading, error: recentError } = useRecentDocumentos(5);
  const { data: categoryData, isLoading: categoryLoading } = useCategoryBreakdown();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handleViewDetails = (fatura: Invoice) => {
    setSelectedFatura(fatura);
    setDrawerOpen(true);
  };

  const isLoading = metricsLoading || recentLoading;
  const hasError = metricsError || recentError;

  if (hasError) {
    return (
      <AppLayout>
        <ErrorState description="Não foi possível carregar os dados do dashboard." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Visão geral das suas faturas e despesas
          </p>
        </div>

        {/* Metrics Grid */}
        {isLoading ? (
          <LoadingState message="A carregar métricas..." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
              <MetricCard
                title="Total de Faturas"
                value={metrics?.totalFaturas || 0}
                subtitle="documentos processados"
                icon={FileText}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
              <MetricCard
                title="Saldo Total"
                value={formatCurrency(metrics?.saldoTotal || 0)}
                subtitle="balanço geral"
                icon={Wallet}
                variant="primary"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "150ms" }}>
              <MetricCard
                title="Total Receitas"
                value={formatCurrency(metrics?.totalReceitas || 0)}
                subtitle="entradas (valores positivos)"
                icon={TrendingUp}
                variant="accent"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
              <MetricCard
                title="Total Gastos"
                value={formatCurrency(Math.abs(metrics?.totalGastos || 0))}
                subtitle="saídas (valores negativos)"
                icon={TrendingDown}
              />
            </div>
          </div>
        )}

        {/* Charts & Table */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "250ms" }}>
            {categoryLoading ? (
              <LoadingState message="A carregar gráfico..." />
            ) : categoryData && categoryData.length > 0 ? (
              <CategoryChart data={categoryData} />
            ) : (
              <EmptyState title="Sem categorias" description="Nenhuma categoria encontrada." />
            )}
          </div>
          <div className="lg:col-span-3 animate-fade-in" style={{ animationDelay: "300ms" }}>
            {recentLoading ? (
              <LoadingState message="A carregar faturas..." />
            ) : recentDocs && recentDocs.length > 0 ? (
              <RecentInvoicesTable 
                faturas={recentDocs} 
                onViewDetail={handleViewDetails} 
              />
            ) : (
              <EmptyState title="Sem faturas" description="Nenhuma fatura encontrada." />
            )}
          </div>
        </div>
      </div>

      <FaturaDetailDrawer
        fatura={selectedFatura}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </AppLayout>
  );
}
