import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FaturaFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategoria: string;
  onCategoriaChange: (value: string) => void;
  selectedTipo: string;
  onTipoChange: (value: string) => void;
  selectedCliente: string;
  onClienteChange: (value: string) => void;
  categorias: string[];
  tipos: string[];
  clientes: string[];
}

export function FaturaFilters({
  searchQuery,
  onSearchChange,
  selectedCategoria,
  onCategoriaChange,
  selectedTipo,
  onTipoChange,
  selectedCliente,
  onClienteChange,
  categorias,
  tipos,
  clientes,
}: FaturaFiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por fornecedor..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Select value={selectedCliente} onValueChange={onClienteChange}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clientes.map((cliente) => (
              <SelectItem key={cliente} value={cliente}>
                {cliente}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategoria} onValueChange={onCategoriaChange}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedTipo} onValueChange={onTipoChange}>
          <SelectTrigger className="w-[140px] bg-card border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tipos.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {tipo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
