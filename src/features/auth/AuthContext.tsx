import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  hasGoogleScopes: boolean // Verifica se o user tem permissões do Google
  providerToken: string | null // Token do Google para APIs
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  hasGoogleScopes: false,
  providerToken: null,
})

/**
 * SCOPES NECESSÁRIOS PARA AUTOMAÇÃO COMPLETA
 * - Gmail: Ler emails com faturas + marcar como lido
 * - Drive: Criar pastas e guardar PDFs
 * - Sheets: Escrever dados no dashboard
 */
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify', // Ler emails + marcar como lido (era .readonly)
  'https://www.googleapis.com/auth/drive.file', // Upload ficheiros
  'https://www.googleapis.com/auth/spreadsheets', // Escrever sheets
].join(' ');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [providerToken, setProviderToken] = useState<string | null>(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.provider_token) {
        setProviderToken(session.provider_token)
      }

      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.provider_token) {
        setProviderToken(session.provider_token)
      } else {
        setProviderToken(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Login com Google (OAuth 2.0)
   * Solicita TODAS as permissões de uma vez
   * IMPORTANTE: access_type: 'offline' garante refresh_token
   */
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: GOOGLE_SCOPES,
          queryParams: {
            access_type: 'offline', // Crucial para refresh_token
            prompt: 'consent', // Força re-autenticação para garantir todos os scopes
          },
          redirectTo: `${window.location.origin}/`,
        },
      })

      if (error) {
        throw error
      }
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProviderToken(null)
  }

  // Verifica se o user tem os scopes do Google (provider = 'google')
  const hasGoogleScopes = !!(
    session?.user?.app_metadata?.provider === 'google' && 
    providerToken
  )

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signInWithGoogle,
      signOut,
      hasGoogleScopes,
      providerToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
