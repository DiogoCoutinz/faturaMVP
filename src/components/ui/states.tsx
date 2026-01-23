import { Loader2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "A carregar...", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-sm font-medium text-foreground">{message}</p>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Sem dados",
  description = "Não foram encontrados registos.",
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16",
      className
    )}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon || <FileText className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="mt-4 text-lg font-medium text-card-foreground">{title}</h3>
      <p className="mt-1 text-sm font-medium text-foreground/80">{description}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function ErrorState({
  title = "Erro ao carregar",
  description = "Ocorreu um erro ao carregar os dados. Tente novamente.",
  className,
}: ErrorStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16",
      className
    )}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-card-foreground">{title}</h3>
      <p className="mt-1 text-sm font-medium text-foreground/80">{description}</p>
    </div>
  );
}
