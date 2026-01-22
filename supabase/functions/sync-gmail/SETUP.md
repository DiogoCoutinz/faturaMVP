# Setup: Sincronizacao Automatica Gmail

## 1. Variaveis de Ambiente (Supabase)

No Supabase Dashboard > Edge Functions > sync-gmail, adiciona:

```
GEMINI_API_KEY=<tua_api_key_gemini>
GOOGLE_CLIENT_ID=<client_id_do_google_cloud>
GOOGLE_CLIENT_SECRET=<client_secret_do_google_cloud>
N8N_ERROR_WEBHOOK=<url_do_teu_webhook_n8n_para_erros>
SYNC_API_KEY=<chave_secreta_para_proteger_endpoint> (opcional)
```

## 2. Executar Migration SQL

```bash
supabase db push
# ou manualmente no SQL Editor do Supabase
```

## 3. Adicionar Tokens OAuth

Para cada conta Gmail que queres sincronizar, insere na tabela `user_oauth_tokens`:

```sql
INSERT INTO user_oauth_tokens (user_id, provider, email, access_token, refresh_token, token_expiry, scopes)
VALUES (
  '<uuid_do_utilizador>',
  'google',
  'conta1@gmail.com',
  '<access_token>',
  '<refresh_token>',
  '<data_expiracao_iso>',
  ARRAY['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/spreadsheets']
);
```

## 4. Deploy da Edge Function

```bash
supabase functions deploy sync-gmail
```

## 5. Configurar n8n (Trigger Diario as 10h)

### Workflow n8n:

1. **Schedule Trigger**
   - Tipo: Cron
   - Expressao: `0 10 * * *` (todos os dias as 10:00)

2. **HTTP Request**
   - Metodo: POST
   - URL: `https://<project_id>.supabase.co/functions/v1/sync-gmail`
   - Headers:
     - `Authorization`: `Bearer <SYNC_API_KEY>` (se configuraste)
     - `Content-Type`: `application/json`

3. **IF Node** (verificar erros)
   - Condicao: `{{ $json.total_errors > 0 }}`

4. **Slack/Email/Webhook** (notificar erros)
   - Envia alerta se houver erros

## 6. Testar Manualmente

```bash
curl -X POST https://<project_id>.supabase.co/functions/v1/sync-gmail \
  -H "Authorization: Bearer <SYNC_API_KEY>" \
  -H "Content-Type: application/json"
```

## Resposta Esperada

```json
{
  "success": true,
  "accounts_processed": 3,
  "total_processed": 15,
  "total_duplicates": 2,
  "total_errors": 0,
  "details": [
    {
      "user_id": "...",
      "email": "conta1@gmail.com",
      "processed": 5,
      "duplicates": 1,
      "errors": []
    }
  ]
}
```

## Notas

- A Edge Function usa `service_role` para aceder a todas as contas
- Os tokens sao automaticamente refreshados quando expirados
- Erros sao enviados para o webhook n8n configurado
- Logs ficam registados na tabela `sync_logs`
