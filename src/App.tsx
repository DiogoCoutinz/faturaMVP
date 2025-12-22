import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Faturas from "./pages/Faturas";
import Upload from "./pages/Upload";
import Integracoes from "./pages/Integracoes";
import Clientes from "./pages/Clientes";
import Dashboard from "./pages/Dashboard";
import Extratos from "./pages/Extratos";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/faturas" element={<Faturas />} />
          <Route path="/extratos" element={<Extratos />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/integracoes" element={<Integracoes />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
