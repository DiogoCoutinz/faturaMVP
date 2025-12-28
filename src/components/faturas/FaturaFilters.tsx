import { Search, Filter, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MESES = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

interface FaturaFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategoria: string;
  onCategoriaChange: (value: string) => void;
  selectedTipo: string;
  onTipoChange: (value: string) => void;
  selectedAno: string;
  onAnoChange: (value: string) => void;
  selectedMes: string;
  onMesChange: (value: string) => void;
  categorias: string[];
  tipos: string[];
  anos: number[];
}

export function FaturaFilters({
  searchQuery,
  onSearchChange,
  selectedCategoria,
  onCategoriaChange,
  selectedTipo,
  onTipoChange,
  selectedAno,
  onAnoChange,
  selectedMes,
  onMesChange,
  categorias,
  tipos,
  anos,
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
        <Select value={selectedAno} onValueChange={onAnoChange}>
          <SelectTrigger className="w-[120px] bg-card border-border">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {anos.map((ano) => (
              <SelectItem key={ano} value={ano.toString()}>
                {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMes} onValueChange={onMesChange}>
          <SelectTrigger className="w-[140px] bg-card border-border">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {MESES.map((mes) => (
              <SelectItem key={mes.value} value={mes.value}>
                {mes.label}
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
