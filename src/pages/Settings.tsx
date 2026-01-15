import { AppLayout } from "@/components/common/AppLayout";
import { GoogleConnectionCard } from "@/features/auth/GoogleConnectionCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, Database, Cloud } from "lucide-react";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="h-8 w-8" />
            Definições
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configuração de integrações e automações
          </p>
        </div>

        {/* Google Connection */}
        <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          <GoogleConnectionCard />
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-5 w-5" />
                Base de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Todos os dados extraídos (fornecedor, valores, datas) ficam guardados
                no Supabase permanentemente.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cloud className="h-5 w-5" />
                Armazenamento
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Ficheiros ficam temporariamente no Supabase (cache) e são migrados
                automaticamente para o Google Drive.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
