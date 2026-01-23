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
    label?: string;
  };
  variant?: "default" | "primary" | "accent";
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
      "group relative overflow-hidden rounded-2xl border transition-all duration-500 hover:shadow-xl hover:-translate-y-0.5",
      onClick && "cursor-pointer",
      variant === "default" && "bg-card border-border/60 shadow-sm hover:border-primary/30",
      variant === "primary" && "gradient-primary border-transparent text-primary-foreground shadow-lg",
      variant === "accent" && "gradient-accent border-transparent text-accent-foreground shadow-lg"
    )}>
      {/* Executive accent bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1 transition-all duration-500",
        variant === "default" && "bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 group-hover:from-primary/50 group-hover:via-primary group-hover:to-primary/50",
        variant === "primary" && "bg-white/30",
        variant === "accent" && "bg-white/30"
      )} />
      
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.015] group-hover:opacity-[0.03] transition-opacity duration-500">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(45deg, currentColor 1px, transparent 1px), linear-gradient(-45deg, currentColor 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
      </div>

      <div className="relative p-7 flex flex-col gap-4 z-10">
        {/* Header with icon */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn(
              "text-xs font-semibold uppercase tracking-wider transition-colors duration-300",
              variant === "default" ? "text-muted-foreground group-hover:text-foreground" : "text-current/70"
            )}>
              {title}
            </p>
          </div>
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-500 shrink-0 border",
            variant === "default" ? "bg-primary/5 border-primary/10 text-primary group-hover:bg-primary/10 group-hover:border-primary/20" : "bg-white/10 border-white/20 group-hover:bg-white/20"
          )}>
            <Icon className="h-5 w-5 transition-transform duration-500" />
          </div>
        </div>

        {/* Value section */}
        <div className="space-y-2">
          <p className={cn(
            "text-3xl sm:text-4xl font-bold tracking-tight tabular-nums leading-none transition-all duration-300",
            variant === "default" ? "text-foreground" : "text-current"
          )}>
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              "text-sm font-medium transition-colors duration-300",
              variant === "default" ? "text-muted-foreground" : "text-current/80"
            )}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Trend badge */}
        {trend && (
          <div className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold w-fit transition-all duration-300 border",
            trend.isPositive 
              ? "bg-success/10 text-success border-success/20" 
              : "bg-destructive/10 text-destructive border-destructive/20"
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              trend.isPositive ? "bg-success" : "bg-destructive"
            )} />
            {trend.isPositive ? "+" : ""}{trend.value}{trend.label ? ` ${trend.label}` : "%"}
          </div>
        )}
      </div>
    </div>
  );
}
