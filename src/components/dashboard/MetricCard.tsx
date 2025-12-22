import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "accent";
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend,
  variant = "default" 
}: MetricCardProps) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border p-6 transition-all duration-300 hover:shadow-card-hover",
      variant === "default" && "bg-card border-border shadow-card",
      variant === "primary" && "gradient-primary border-transparent text-primary-foreground",
      variant === "accent" && "gradient-accent border-transparent text-accent-foreground"
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            variant === "default" ? "text-muted-foreground" : "text-current/80"
          )}>
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className={cn(
              "text-sm",
              variant === "default" ? "text-muted-foreground" : "text-current/70"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trend.isPositive 
                ? "bg-success/10 text-success" 
                : "bg-destructive/10 text-destructive"
            )}>
              {trend.isPositive ? "+" : ""}{trend.value}%
            </div>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          variant === "default" ? "bg-primary/10 text-primary" : "bg-white/20"
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
