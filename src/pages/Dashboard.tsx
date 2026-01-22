import { useState } from "react";
import { Euro, Building2, TrendingUp, TrendingDown, Wallet, FileText, AlertCircle, Clock, Package, Receipt, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { AppLayout } from "@/components/common/AppLayout";
import { MetricCard } from "@/features/dashboard/MetricCard";
import { RecentInvoicesTable } from "@/features/dashboard/RecentInvoicesTable";
import { CategoryChart } from "@/features/dashboard/CategoryChart";
import { TrendsChart } from "@/features/dashboard/TrendsChart";
import { FaturaDetailDrawer } from "@/features/faturas/FaturaDetailDrawer";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useDashboardMetrics, useRecentDocumentos, useCategoryBreakdown, useExpenseTrends } from "@/features/faturas/hooks/useFaturas";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/database";

export default function Dashboard() {
  const [selectedFatura, setSelectedFatura] = useState<Invoice | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });

  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useDashboardMetrics();
  const { data: recentDocs, isLoading: recentLoading, error: recentError } = useRecentDocumentos(5);
  const { data: categoryData, isLoading: categoryLoading } = useCategoryBreakdown(
    dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined
  );
  const { data: trendsData, isLoading: trendsLoading } = useExpenseTrends();

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

  const isLoading = metricsLoading || recentLoading || trendsLoading;
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
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Financeiro</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Controlo de despesas e faturas • {format(new Date(), "MMMM yyyy", { locale: pt })}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Gastos"
            value={formatCurrency(metrics?.totalGastos || 0)}
            subtitle="Acumulado este ano"
            icon={Receipt}
            variant="primary"
          />
          <MetricCard
            title="Custos Fixos"
            value={formatCurrency(metrics?.custosFixos || 0)}
            subtitle="Rendas, utilities, etc."
            icon={Package}
            variant="default"
          />
          <MetricCard
            title="Custos Variáveis"
            value={formatCurrency(metrics?.custosVariaveis || 0)}
            subtitle="Material, serviços, etc."
            icon={TrendingUp}
            variant="accent"
          />
          <MetricCard
            title="A Rever"
            value={metrics?.countPendente || 0}
            subtitle="Faturas com baixa confiança"
            icon={AlertCircle}
            variant="default"
            trend={metrics?.countPendente && metrics.countPendente > 0 ? { value: metrics.countPendente, isPositive: false } : undefined}
          />
        </div>

        {/* Main Section: Chart & Categorization */}
        <div className="grid gap-6 lg:grid-cols-5 items-start">
          <div className="lg:col-span-3 h-full">
            {trendsLoading ? (
              <LoadingState message="A calcular tendências..." />
            ) : trendsData && trendsData.length > 0 ? (
              <TrendsChart
                data={trendsData}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
              />
            ) : (
              <EmptyState title="Sem dados de tendência" description="Ainda não há faturas suficientes para gerar tendências." />
            )}
          </div>
          <div className="lg:col-span-2 h-full">
            {categoryLoading ? (
              <LoadingState message="A analisar categorias..." />
            ) : categoryData && categoryData.length > 0 ? (
              <CategoryChart data={categoryData} />
            ) : (
              <EmptyState title="Sem categorias" description="Nenhuma categoria encontrada." />
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Atividade Recente
            </h3>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/faturas'}>
              Ver tudo
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          
          <div className="animate-scale-in">
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
