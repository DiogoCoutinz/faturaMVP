import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import NotFound from "./pages/NotFound";
import Faturas from "./pages/Faturas";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import SimpleLogin from "./pages/SimpleLogin";
import Automations from "./pages/Automations";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

const queryClient = new QueryClient();

// Verificar se está logado
function isLoggedIn() {
  return localStorage.getItem('faturasai_logged_in') === 'true';
}

// Componente para proteger rotas
function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/login" element={isLoggedIn() ? <Navigate to="/" replace /> : <SimpleLogin />} />

          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />

          <Route path="/faturas" element={<RequireAuth><Faturas /></RequireAuth>} />

          <Route path="/upload" element={<RequireAuth><Upload /></RequireAuth>} />

          <Route path="/automations" element={<RequireAuth><Automations /></RequireAuth>} />

          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
