import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface CategoryChartProps {
  data: { name: string; value: number }[];
}

export function CategoryChart({ data }: CategoryChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  // Sort by absolute value descending
  const sortedData = [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground">Valores por Categoria</h3>
        <p className="text-sm text-muted-foreground">
          <span className="text-accent">Verde = Receitas</span> | <span className="text-destructive">Vermelho = Gastos</span>
        </p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number" 
              tickFormatter={(value) => `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(0)}€`}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={100}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), "Valor"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "var(--shadow-md)",
              }}
              labelStyle={{ color: "hsl(var(--card-foreground))" }}
            />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {sortedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.value >= 0 ? "hsl(162, 72%, 45%)" : "hsl(0, 84%, 60%)"} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
