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
        case 'day': {
          // Dia: "15 Jan"
          const dayDate = new Date(dateStr);
          if (isNaN(dayDate.getTime())) return dateStr;
          return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(dayDate);
        }
        case 'week': {
          // Semana: "S3 Jan" (semana 3 de janeiro)
          const weekDate = new Date(dateStr);
          if (isNaN(weekDate.getTime())) return dateStr;
          const weekNum = Math.ceil(weekDate.getDate() / 7);
          const monthName = new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(weekDate);
          return `S${weekNum} ${monthName}`;
        }
        case 'month': {
          // Mês: "Jan 25"
          const parts = dateStr.split('-');
          if (parts.length < 2) return dateStr;
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          if (isNaN(year) || isNaN(month)) return dateStr;
          const monthDate = new Date(year, month - 1);
          if (isNaN(monthDate.getTime())) return dateStr;
          return new Intl.DateTimeFormat('pt-PT', { month: 'short', year: '2-digit' }).format(monthDate);
        }
        case 'year':
          // Ano: "2025"
          return dateStr;
        default:
          return dateStr;
      }
    } catch {
      return dateStr;
    }
  };

  // Formatação completa para tooltip
  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return '';

    try {
      switch (period) {
        case 'day': {
          const dayDate = new Date(dateStr);
          if (isNaN(dayDate.getTime())) return dateStr;
          return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(dayDate);
        }
        case 'week': {
          const weekDate = new Date(dateStr);
          if (isNaN(weekDate.getTime())) return dateStr;
          const weekEnd = new Date(weekDate);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const startStr = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(weekDate);
          const endStr = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(weekEnd);
          return `Semana: ${startStr} - ${endStr}`;
        }
        case 'month': {
          const parts = dateStr.split('-');
          if (parts.length < 2) return dateStr;
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]);
          if (isNaN(year) || isNaN(month)) return dateStr;
          const monthDate = new Date(year, month - 1);
          return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(monthDate);
        }
        case 'year':
          return `Ano ${dateStr}`;
        default:
          return dateStr;
      }
    } catch {
      return dateStr;
    }
  };

  const hasDateFilter = startDate || endDate;

  // Calcular intervalo ideal para os ticks do eixo X
  const getTickInterval = () => {
    const dataLength = filteredData.length;
    if (dataLength <= 7) return 0; // Mostrar todos
    if (dataLength <= 14) return 1; // Mostrar 1 em cada 2
    if (dataLength <= 30) return Math.floor(dataLength / 7); // ~7 ticks
    return Math.floor(dataLength / 6); // ~6 ticks para datasets grandes
  };

  return (
    <Card className="col-span-full lg:col-span-3 border border-border/60 shadow-sm hover:shadow-lg transition-all duration-500 hover:-translate-y-0.5 group/card bg-card/50 backdrop-blur-sm">
      {/* Executive accent */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"></div>
      
      <CardHeader className="flex flex-col gap-5 pb-5 pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1 w-8 bg-primary rounded-full"></div>
              <CardTitle className="text-base font-semibold text-foreground">
                Análise de Gastos
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground ml-10">Evolução temporal dos custos</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-4 h-9 bg-muted/50">
                <TabsTrigger value="day" className="text-xs px-2 transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Dia</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2 transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Sem</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2 transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Mês</TabsTrigger>
                <TabsTrigger value="year" className="text-xs px-2 transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Ano</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={costType} onValueChange={(v) => setCostType(v as CostType)}>
              <SelectTrigger className="w-[140px] h-9 text-sm transition-all duration-300 hover:border-primary/50 focus:border-primary">
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
              className="h-9 gap-1.5 transition-all duration-300 hover:scale-105"
              onClick={() => setShowDateFilter(!showDateFilter)}
            >
              <CalendarDays className="h-4 w-4 transition-transform duration-300 group-hover/card:rotate-12" />
              <span className="text-sm">Datas</span>
            </Button>
          </div>
        </div>

        {/* Filtro de datas personalizado */}
        {showDateFilter && (
          <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/50 rounded-lg border border-border/50 animate-fade-in-up backdrop-blur-sm">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="h-9 w-[150px] text-sm transition-all duration-300 hover:border-primary/50 focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="h-9 w-[150px] text-sm transition-all duration-300 hover:border-primary/50 focus:border-primary"
              />
            </div>
            {hasDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-foreground hover:text-destructive transition-all duration-300 hover:bg-destructive/10 hover:scale-105"
                onClick={handleClearDateFilter}
              >
                <X className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                <span className="text-sm">Limpar</span>
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full pt-4">
          {filteredData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-foreground">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">Sem dados para o período selecionado</p>
                <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros de data</p>
              </div>
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
                  interval={getTickInterval()}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => {
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}k€`;
                    return `${value}€`;
                  }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  width={50}
                />
                <Tooltip
                  isAnimationActive={false}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'fixos' ? 'Custos Fixos' : 'Custos Variáveis'
                  ]}
                  labelFormatter={formatDateFull}
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeOpacity: 0.5 }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', paddingBottom: '20px' }}
                  formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                />
                {(costType === 'all' || costType === 'fixo') && (
                  <Area
                    type="monotone"
                    dataKey="fixos"
                    name="Custos Fixos"
                    stroke="#0E2435"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFixos)"
                    isAnimationActive={false}
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
                    isAnimationActive={false}
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
