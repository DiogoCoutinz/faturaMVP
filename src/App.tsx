import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import Faturas from "./pages/Faturas";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import SimpleLogin from "./pages/SimpleLogin";
import Automations from "./pages/Automations";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Componente para proteger rotas (usa Supabase Auth)
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Componente para redirecionar se já está logado
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><SimpleLogin /></PublicRoute>} />

      <Route path="/" element={<RequireAuth><ErrorBoundary fallbackTitle="Erro no Dashboard"><Dashboard /></ErrorBoundary></RequireAuth>} />
      <Route path="/faturas" element={<RequireAuth><ErrorBoundary fallbackTitle="Erro nas Faturas"><Faturas /></ErrorBoundary></RequireAuth>} />
      <Route path="/upload" element={<RequireAuth><ErrorBoundary fallbackTitle="Erro no Upload"><Upload /></ErrorBoundary></RequireAuth>} />
      <Route path="/automations" element={<RequireAuth><ErrorBoundary fallbackTitle="Erro nas Automações"><Automations /></ErrorBoundary></RequireAuth>} />

      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
