import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  connected: boolean;
  onConnect: () => void;
  iconColor?: string;
}

export function IntegrationCard({
  name,
  description,
  icon: Icon,
  connected,
  onConnect,
  iconColor = "text-primary",
}: IntegrationCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover">
      <div className="flex items-start gap-4">
        <div className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          connected ? "bg-success/10" : "bg-muted"
        )}>
          <Icon className={cn("h-7 w-7", connected ? "text-success" : iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-card-foreground">{name}</h3>
            <Badge 
              variant={connected ? "default" : "secondary"}
              className={cn(
                "text-xs",
                connected && "bg-success text-success-foreground"
              )}
            >
              {connected ? "Ligado" : "Não ligado"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          variant={connected ? "outline" : "default"}
          size="sm"
          onClick={onConnect}
          className={cn(
            connected && "border-success/50 text-success hover:bg-success/10"
          )}
        >
          {connected ? "Configurar" : "Ligar"}
        </Button>
      </div>
    </div>
  );
}
