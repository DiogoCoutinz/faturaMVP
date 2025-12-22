import { useState } from "react";
import { useExtratos } from "@/hooks/useSupabase";
import { ExtratosTable } from "@/components/extratos/ExtratosTable";
import { ExtratosFilters } from "@/components/extratos/ExtratosFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark } from "lucide-react";

export default function Extratos() {
  const [filters, setFilters] = useState({
    search: "",
    banco: "",
    cliente: "",
  });

  const { data: extratos, isLoading } = useExtratos(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
          <Landmark className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extratos Bancários</h1>
          <p className="text-sm text-muted-foreground">
            Movimentos bancários importados
          </p>
        </div>
      </div>

      <ExtratosFilters filters={filters} onFiltersChange={setFilters} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Movimentos</CardTitle>
        </CardHeader>
        <CardContent>
          <ExtratosTable extratos={extratos || []} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
