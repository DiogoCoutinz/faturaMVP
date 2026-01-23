import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryChartProps {
  data: { name: string; value: number }[];
}

// Cores fixas por categoria para consistência
const CATEGORY_COLORS: Record<string, string> = {
  "Custos Fixos": "#0E2435",      // Azul escuro (primary)
  "Custos Variáveis": "#BBB388",  // Dourado
  "Por Classificar": "#94a3b8",   // Cinza
};

const getColorByCategory = (name: string) => {
  return CATEGORY_COLORS[name] || "#94a3b8";
};

export function CategoryChart({ data }: CategoryChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="h-full border border-border/60 shadow-sm hover:shadow-lg transition-all duration-500 hover:-translate-y-0.5 group/card bg-card/50 backdrop-blur-sm">
      {/* Executive accent */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"></div>
      
      <CardHeader className="pb-5 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-1 w-8 bg-primary rounded-full"></div>
          <CardTitle className="text-base font-semibold text-foreground">
            Divisão de Custos
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground ml-10">Distribuição por categoria</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                stroke="hsl(var(--card))"
                strokeWidth={2}
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColorByCategory(entry.name)}
                    style={{
                      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.08))',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderColor: 'hsl(var(--primary) / 0.2)'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Total']}
                cursor={{ fill: 'transparent' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 space-y-2.5 border-t border-border/50 pt-5">
          {data.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center justify-between text-sm group/item p-3 rounded-lg -mx-3 transition-all duration-300 hover:bg-muted/40 cursor-pointer border border-transparent hover:border-border/30"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="h-4 w-4 rounded-full transition-all duration-300 group-hover/item:scale-125 group-hover/item:ring-2 group-hover/item:ring-offset-2 shrink-0 border-2 border-card"
                  style={{
                    backgroundColor: getColorByCategory(item.name),
                    ringColor: getColorByCategory(item.name)
                  }}
                />
                <span className="text-foreground font-medium truncate transition-colors duration-300 group-hover/item:text-primary">
                  {item.name}
                </span>
              </div>
              <span className="font-bold text-foreground tabular-nums ml-3 text-base transition-all duration-300">
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
