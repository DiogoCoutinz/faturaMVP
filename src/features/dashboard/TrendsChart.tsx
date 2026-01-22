import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CalendarDays, X } from 'lucide-react';

interface DataPoint {
  date: string;
  fixos: number;
  variaveis: number;
}

interface TrendsChartProps {
  data: DataPoint[];
  dateFilter?: { startDate: string; endDate: string };
  onDateFilterChange?: (filter: { startDate: string; endDate: string }) => void;
}

type Period = 'day' | 'week' | 'month' | 'year';
type CostType = 'all' | 'fixo' | 'variavel';

export function TrendsChart({ data, dateFilter, onDateFilterChange }: TrendsChartProps) {
  const [period, setPeriod] = useState<Period>('month');
  const [costType, setCostType] = useState<CostType>('all');
  const [startDate, setStartDate] = useState<string>(dateFilter?.startDate || '');
  const [endDate, setEndDate] = useState<string>(dateFilter?.endDate || '');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Sincronizar com props externas
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    onDateFilterChange?.({ startDate: value, endDate });
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    onDateFilterChange?.({ startDate, endDate: value });
  };

  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    onDateFilterChange?.({ startDate: '', endDate: '' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Filtrar e agrupar dados baseado no período e datas
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let filtered = [...data];

    // Filtrar por datas personalizadas
    if (startDate) {
      filtered = filtered.filter(d => d.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(d => d.date <= endDate);
    }

    // Agrupar por período
    const grouped: Record<string, { fixos: number; variaveis: number }> = {};

    filtered.forEach(item => {
      let key: string;
      const date = new Date(item.date);

      switch (period) {
        case 'day':
          key = item.date; // YYYY-MM-DD
          break;
        case 'week':
          // Agrupar por semana (início da semana)
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = `${date.getFullYear()}`;
          break;
        default:
          key = item.date;
      }

      if (!grouped[key]) {
        grouped[key] = { fixos: 0, variaveis: 0 };
      }
      grouped[key].fixos += item.fixos || 0;
      grouped[key].variaveis += item.variaveis || 0;
    });

    // Converter para array e ordenar
    return Object.entries(grouped)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, period, startDate, endDate]);

  // Formatar data para exibição baseado no período
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';

    try {
      switch (period) {
        case 'day':
          const dayDate = new Date(dateStr);
          if (isNaN(dayDate.getTime())) return dateStr;
          return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(dayDate);
        case 'week':
          const weekDate = new Date(dateStr);
          if (isNaN(weekDate.getTime())) return dateStr;
          return `Sem ${new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(weekDate)}`;
        case 'month':
          const parts = dateStr.split('-');
          if (parts.length < 2) return dateStr;
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          if (isNaN(year) || isNaN(month)) return dateStr;
          const monthDate = new Date(year, month - 1);
          if (isNaN(monthDate.getTime())) return dateStr;
          return new Intl.DateTimeFormat('pt-PT', { month: 'short', year: '2-digit' }).format(monthDate);
        case 'year':
          return dateStr;
        default:
          return dateStr;
      }
    } catch {
      return dateStr;
    }
  };

  const hasDateFilter = startDate || endDate;

  return (
    <Card className="col-span-full lg:col-span-3 border-none shadow-card hover:shadow-card-hover transition-all duration-300">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Análise de Gastos
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-4 h-8">
                <TabsTrigger value="day" className="text-[10px] px-0">Dia</TabsTrigger>
                <TabsTrigger value="week" className="text-[10px] px-0">Sem</TabsTrigger>
                <TabsTrigger value="month" className="text-[10px] px-0">Mês</TabsTrigger>
                <TabsTrigger value="year" className="text-[10px] px-0">Ano</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={costType} onValueChange={(v) => setCostType(v as CostType)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="fixo">Custos Fixos</SelectItem>
                <SelectItem value="variavel">Custos Var.</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showDateFilter ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1"
              onClick={() => setShowDateFilter(!showDateFilter)}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="text-xs">Datas</span>
            </Button>
          </div>
        </div>

        {/* Filtro de datas personalizado */}
        {showDateFilter && (
          <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="h-8 w-[140px] text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="h-8 w-[140px] text-xs"
              />
            </div>
            {hasDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleClearDateFilter}
              >
                <X className="h-3.5 w-3.5" />
                <span className="text-xs">Limpar</span>
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full pt-4">
          {filteredData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Sem dados para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFixos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0E2435" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0E2435" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorVariaveis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#BBB388" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#BBB388" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatDate}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}€`}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                  labelFormatter={formatDate}
                />
                <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: '20px' }} />
                {(costType === 'all' || costType === 'fixo') && (
                  <Area
                    type="monotone"
                    dataKey="fixos"
                    name="Custos Fixos"
                    stroke="#0E2435"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFixos)"
                    animationDuration={1500}
                  />
                )}
                {(costType === 'all' || costType === 'variavel') && (
                  <Area
                    type="monotone"
                    dataKey="variaveis"
                    name="Custos Variáveis"
                    stroke="#BBB388"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVariaveis)"
                    animationDuration={1500}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
