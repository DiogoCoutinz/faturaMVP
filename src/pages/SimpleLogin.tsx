import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';

// Domínio interno para converter username em email
const EMAIL_DOMAIN = '@faturasai.local';

export default function SimpleLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signInWithEmail } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Converte username para email interno
    const email = username.includes('@') ? username : `${username.toLowerCase()}${EMAIL_DOMAIN}`;
    const { error } = await signInWithEmail(email, password);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Bem-vindo!');
      navigate('/');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Equipa Francisco</CardTitle>
          <CardDescription>Gestão de Faturas AI</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Utilizador</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Introduza o utilizador"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Introduza a palavra-passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'A entrar...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
