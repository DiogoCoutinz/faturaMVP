import { useState } from "react";
import { Mail, HardDrive, Table } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { toast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  connected: boolean;
  iconColor: string;
}

export default function Integracoes() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "gmail",
      name: "Gmail",
      description: "Importa automaticamente faturas recebidas por email. Analisa anexos e extrai dados.",
      icon: Mail,
      connected: false,
      iconColor: "text-red-500",
    },
    {
      id: "drive",
      name: "Google Drive",
      description: "Sincroniza faturas armazenadas no Drive. Mantém uma cópia organizada dos documentos.",
      icon: HardDrive,
      connected: false,
      iconColor: "text-yellow-500",
    },
    {
      id: "sheets",
      name: "Google Sheets",
      description: "Exporta dados das faturas para uma spreadsheet. Atualização automática em tempo real.",
      icon: Table,
      connected: false,
      iconColor: "text-green-600",
    },
  ]);

  const handleConnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === id ? { ...int, connected: !int.connected } : int
      )
    );
    
    const integration = integrations.find((int) => int.id === id);
    if (integration) {
      toast({
        title: integration.connected ? "Integração desligada" : "Integração simulada",
        description: integration.connected 
          ? `${integration.name} foi desligado.`
          : `${integration.name} seria ligado aqui. (Funcionalidade de demonstração)`,
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Integrações</h1>
          <p className="mt-1 text-muted-foreground">
            Conecte os seus serviços para automatizar o fluxo de faturas
          </p>
        </div>

        {/* Integration Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration, index) => (
            <div 
              key={integration.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <IntegrationCard
                name={integration.name}
                description={integration.description}
                icon={integration.icon}
                connected={integration.connected}
                iconColor={integration.iconColor}
                onConnect={() => handleConnect(integration.id)}
              />
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="rounded-xl border border-border bg-muted/30 p-6 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <h3 className="font-semibold text-card-foreground">Como funcionam as integrações?</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              <span><strong>Gmail:</strong> Monitoriza a caixa de entrada e extrai faturas de emails automaticamente.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              <span><strong>Google Drive:</strong> Guarda uma cópia de todas as faturas numa pasta dedicada.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
              <span><strong>Google Sheets:</strong> Mantém uma spreadsheet atualizada com todos os dados das faturas.</span>
            </li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
