import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryChartProps {
  data: { name: string; value: number }[];
}

const COLORS = ["#0E2435", "#BBB388", "#1a3a52", "#cfc9a8"];

export function CategoryChart({ data }: CategoryChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="h-full border-none shadow-card hover:shadow-card-hover transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          Divisão de Custos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Total']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-3">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm group">
              <div className="flex items-center gap-2">
                <div 
                  className="h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                />
                <span className="text-muted-foreground font-medium">{item.name}</span>
              </div>
              <span className="font-bold">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
