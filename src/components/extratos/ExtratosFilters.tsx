import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useBancos, useClienteNames } from "@/hooks/useSupabase";

interface ExtratosFiltersProps {
  filters: {
    search: string;
    banco: string;
    cliente: string;
  };
  onFiltersChange: (filters: { search: string; banco: string; cliente: string }) => void;
}

export function ExtratosFilters({ filters, onFiltersChange }: ExtratosFiltersProps) {
  const { data: bancos } = useBancos();
  const { data: clientes } = useClienteNames();

  return (
    <div className="flex flex-wrap gap-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar descritivo..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.banco}
        onValueChange={(value) => onFiltersChange({ ...filters, banco: value })}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Todos os bancos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os bancos</SelectItem>
          {bancos?.map((banco) => (
            <SelectItem key={banco} value={banco}>
              {banco}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.cliente}
        onValueChange={(value) => onFiltersChange({ ...filters, cliente: value })}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Todos os clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os clientes</SelectItem>
          {clientes?.map((cliente) => (
            <SelectItem key={cliente} value={cliente}>
              {cliente}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
