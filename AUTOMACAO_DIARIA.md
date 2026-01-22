# Automacao Diaria - Sincronizacao de Emails

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO AUTOMATICO                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Supabase Edge Function]                                       │
│        │                                                        │
│        │ CRON: Todos os dias as 10:00                          │
│        ▼                                                        │
│  [Supabase Database]                                           │
│        │ Busca refresh_token do user                           │
│        ▼                                                        │
│  [Google OAuth] ─► Gera novo access_token                      │
│        │                                                        │
│        ▼                                                        │
│  [Gmail API] ─► Lista emails nao lidos (ultimas 24h)           │
│        │                                                        │
│        ▼                                                        │
│  [Gemini API] ─► Analisa PDFs                                  │
│        │                                                        │
│        ▼                                                        │
│  [Google Drive] ─► Upload organizadp                           │
│        │                                                        │
│        ▼                                                        │
│  [Google Sheets] ─► Adiciona linha                             │
│        │                                                        │
│        ▼                                                        │
│  [Supabase DB] ─► Guarda fatura                                │
│        │                                                        │
│        ▼                                                        │
│  [n8n Webhook] ─► Notifica erros via WhatsApp                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PARTE 1: Guardar Refresh Token (Preparacao)

### 1.1 Criar tabela no Supabase

Executa este SQL no Supabase SQL Editor:

```sql
-- Tabela para armazenar tokens OAuth de forma segura
CREATE TABLE IF NOT EXISTS user_oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Tabela para logs de sincronizacao
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running', -- 'running', 'success', 'error', 'partial'
  processed_count INT DEFAULT 0,
  duplicate_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS policies
ALTER TABLE user_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" ON user_oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON user_oauth_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON user_oauth_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own logs" ON sync_logs
  FOR SELECT USING (auth.uid() = user_id);
```

### 1.2 Modificar o Login para guardar refresh_token

O Google OAuth do Supabase ja devolve o refresh_token. Precisas de o capturar e guardar.

No ficheiro `src/features/auth/AuthContext.tsx`, apos o login bem-sucedido, adiciona:

```typescript
// Apos login com sucesso, guardar refresh_token
if (session?.provider_refresh_token) {
  await supabase.from('user_oauth_tokens').upsert({
    user_id: session.user.id,
    provider: 'google',
    access_token: session.provider_token,
    refresh_token: session.provider_refresh_token,
    token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hora
    scopes: ['gmail', 'drive', 'sheets'],
  }, { onConflict: 'user_id,provider' });
}
```

---

## PARTE 2: Supabase Edge Function

### 2.1 Criar a Edge Function

No terminal, dentro do projeto Supabase:

```bash
supabase functions new daily-invoice-sync
```

### 2.2 Codigo da Edge Function

Cria o ficheiro `supabase/functions/daily-invoice-sync/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL') // Opcional

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Renovar access_token usando refresh_token
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${await response.text()}`)
  }

  const data = await response.json()
  return data.access_token
}

// Enviar notificacao de erro para n8n
async function notifyError(error: string, details: any) {
  if (!N8N_WEBHOOK_URL) return

  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sync_error',
        timestamp: new Date().toISOString(),
        error,
        details,
      }),
    })
  } catch (e) {
    console.error('Failed to notify n8n:', e)
  }
}

// Funcao principal de sync (simplificada - adaptar do sync-engine.ts)
async function syncInvoices(userId: string, accessToken: string) {
  // TODO: Portar a logica de sync-engine.ts para Deno
  // Por agora, retorna mock
  return {
    processed: 0,
    duplicates: 0,
    errors: [] as string[],
  }
}

serve(async (req) => {
  try {
    // Verificar se e uma chamada de CRON ou manual
    const authHeader = req.headers.get('Authorization')

    // Buscar todos os users com tokens validos
    const { data: tokens, error: tokensError } = await supabase
      .from('user_oauth_tokens')
      .select('user_id, refresh_token')
      .eq('provider', 'google')

    if (tokensError) throw tokensError

    const results = []

    for (const token of tokens || []) {
      try {
        // Renovar access_token
        const accessToken = await refreshAccessToken(token.refresh_token)

        // Atualizar token na BD
        await supabase.from('user_oauth_tokens').update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', token.user_id)

        // Criar log de sync
        const { data: log } = await supabase.from('sync_logs').insert({
          user_id: token.user_id,
          status: 'running',
        }).select().single()

        // Executar sync
        const result = await syncInvoices(token.user_id, accessToken)

        // Atualizar log
        await supabase.from('sync_logs').update({
          status: result.errors.length > 0 ? 'partial' : 'success',
          completed_at: new Date().toISOString(),
          processed_count: result.processed,
          duplicate_count: result.duplicates,
          error_count: result.errors.length,
          errors: result.errors,
        }).eq('id', log?.id)

        results.push({
          user_id: token.user_id,
          success: true,
          processed: result.processed,
        })

        // Notificar erros se houver
        if (result.errors.length > 0) {
          await notifyError('Sync completed with errors', {
            user_id: token.user_id,
            errors: result.errors,
          })
        }

      } catch (userError) {
        const errorMsg = userError instanceof Error ? userError.message : 'Unknown error'

        results.push({
          user_id: token.user_id,
          success: false,
          error: errorMsg,
        })

        // Notificar erro critico
        await notifyError('Sync failed for user', {
          user_id: token.user_id,
          error: errorMsg,
        })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    // Notificar erro critico
    await notifyError('Critical sync error', { error: errorMsg })

    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### 2.3 Configurar CRON no Supabase

No Supabase Dashboard:
1. Vai a **Database** > **Extensions** > Ativa `pg_cron`
2. Vai a **SQL Editor** e executa:

```sql
-- Agendar para correr todos os dias as 10:00 (UTC)
-- Nota: Ajusta a hora para o teu fuso horario (Portugal = UTC+0/+1)
SELECT cron.schedule(
  'daily-invoice-sync',
  '0 10 * * *', -- Todos os dias as 10:00
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJETO.supabase.co/functions/v1/daily-invoice-sync',
    headers := '{"Authorization": "Bearer ' || current_setting('supabase.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### 2.4 Deploy da Edge Function

```bash
supabase functions deploy daily-invoice-sync
```

---

## PARTE 3: Notificacoes de Erro via n8n + WhatsApp

### 3.1 Criar Webhook no n8n

1. No n8n, cria um novo workflow
2. Adiciona um node **Webhook**:
   - Method: POST
   - Path: `/faturasai-errors`
3. Copia o URL do webhook (ex: `https://n8n.teudominio.com/webhook/faturasai-errors`)

### 3.2 Adicionar Logica no n8n

```
[Webhook]
    │
    ▼
[IF] ─► type == 'sync_error'
    │
    ▼
[HTTP Request] ─► Evolution API / WhatsApp
    │
    Body: {
      "number": "351912345678",
      "text": "⚠️ FaturasAI Erro!\n\n{{ $json.error }}\n\nDetalhes: {{ $json.details }}"
    }
```

### 3.3 Tipos de Erros a Notificar

| Erro | Codigo | Acao |
|------|--------|------|
| Token expirado | `token_expired` | Re-login necessario |
| Sem saldo Gemini | `gemini_quota` | Verificar billing |
| Gmail API error | `gmail_error` | Verificar permissoes |
| Drive cheio | `drive_full` | Limpar espaco |
| Sync crash | `sync_crash` | Bug no codigo |

### 3.4 Adicionar Webhook URL ao Supabase

```bash
supabase secrets set N8N_WEBHOOK_URL=https://n8n.teudominio.com/webhook/faturasai-errors
```

---

## PARTE 4: Variaveis de Ambiente Necessarias

### No Supabase (secrets):

```bash
supabase secrets set GOOGLE_CLIENT_ID=xxx
supabase secrets set GOOGLE_CLIENT_SECRET=xxx
supabase secrets set GEMINI_API_KEY=xxx
supabase secrets set N8N_WEBHOOK_URL=https://n8n.xxx.com/webhook/faturasai-errors
```

---

## PARTE 5: Testar

### 5.1 Testar Edge Function manualmente

```bash
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/daily-invoice-sync \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json"
```

### 5.2 Verificar logs

```bash
supabase functions logs daily-invoice-sync
```

### 5.3 Testar webhook n8n

```bash
curl -X POST https://n8n.teudominio.com/webhook/faturasai-errors \
  -H "Content-Type: application/json" \
  -d '{"type": "sync_error", "error": "Teste", "details": {"test": true}}'
```

---

## Resumo do que precisas fazer:

1. [ ] Criar tabelas `user_oauth_tokens` e `sync_logs` no Supabase
2. [ ] Modificar AuthContext para guardar refresh_token
3. [ ] Criar Edge Function `daily-invoice-sync`
4. [ ] Configurar CRON no Supabase
5. [ ] Criar workflow no n8n com webhook
6. [ ] Configurar secrets no Supabase
7. [ ] Testar tudo!

---

## Notas Importantes

1. **Seguranca**: Os refresh_tokens sao sensiveis. A tabela `user_oauth_tokens` tem RLS ativo.

2. **Limites**: O Gemini tem quotas. Considera implementar rate limiting.

3. **Fallback**: Se a Edge Function falhar, tens sempre o botao "Sincronizar Agora" no frontend.

4. **Logs**: Consulta a tabela `sync_logs` para ver historico de sincronizacoes.
