import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, AlertCircle, Clock, Package, Receipt, ChevronRight } from "lucide-react";
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
  const navigate = useNavigate();
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
      <div className="space-y-12 animate-fade-in pb-8">
        {/* Header */}
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard Financeiro
          </h1>
        </div>

        {/* Metrics Grid */}
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
              <MetricCard
                title="Total Gastos"
                value={formatCurrency(metrics?.totalGastos || 0)}
                subtitle="Acumulado este ano"
                icon={Receipt}
                variant="primary"
              />
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <MetricCard
                title="Custos Fixos"
                value={formatCurrency(metrics?.custosFixos || 0)}
                subtitle="Rendas, utilities, etc."
                icon={Package}
                variant="default"
              />
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <MetricCard
                title="Custos Variáveis"
                value={formatCurrency(metrics?.custosVariaveis || 0)}
                subtitle="Material, serviços, etc."
                icon={TrendingUp}
                variant="accent"
              />
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <MetricCard
                title="A Rever"
                value={`${metrics?.countPendente || 0}`}
                subtitle="Faturas com baixa confiança"
                icon={AlertCircle}
                variant="default"
                trend={metrics?.countPendente && metrics.countPendente > 0 ? { value: metrics.countPendente, isPositive: false, label: "faturas" } : undefined}
                onClick={() => navigate('/faturas?status=review')}
              />
            </div>
          </div>
        </div>

        {/* Executive Analytics Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-foreground">Análise e Tendências</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-border via-border/50 to-transparent"></div>
          </div>
          <div className="grid gap-8 lg:grid-cols-5 items-start">
            <div className="lg:col-span-3 h-full animate-fade-in-up" style={{ animationDelay: '400ms' }}>
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
            <div className="lg:col-span-2 h-full animate-fade-in-up" style={{ animationDelay: '500ms' }}>
              {categoryLoading ? (
                <LoadingState message="A analisar categorias..." />
              ) : categoryData && categoryData.length > 0 ? (
                <CategoryChart data={categoryData} />
              ) : (
                <EmptyState title="Sem categorias" description="Nenhuma categoria encontrada." />
              )}
            </div>
          </div>
        </div>

        {/* Executive Activity Section */}
        <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Atividade Recente</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Últimas faturas processadas</p>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = '/faturas'}
              className="group/btn border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 font-medium"
            >
              Ver todas
              <ChevronRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
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
