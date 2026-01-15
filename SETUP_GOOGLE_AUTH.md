# 🔐 FASE 2 - INTEGRAÇÃO GOOGLE (GMAIL + DRIVE + SHEETS)

## ✅ O QUE FOI IMPLEMENTADO

### 1. **AuthContext Atualizado** (`src/features/auth/AuthContext.tsx`)
- ✅ Função `signInWithGoogle()` com TODOS os scopes necessários
- ✅ `access_type: 'offline'` + `prompt: 'consent'` para refresh_token
- ✅ Estado `providerToken` e `hasGoogleScopes` para validação
- ✅ Extração automática do provider_token da sessão

### 2. **Google API Clients** (`src/lib/google/`)
- ✅ **drive.ts**: Upload ficheiros, criar pastas, listar ficheiros
- ✅ **gmail.ts**: Listar emails, buscar anexos, download attachments
- ✅ **sheets.ts**: Escrever/ler Google Sheets, helper de formatação

### 3. **UI Components**
- ✅ **GoogleConnectionCard** (`src/features/auth/GoogleConnectionCard.tsx`)
  - Estados: Desconectado → Conectando → Conectado
  - Validação de scopes
  - Aviso se faltar permissões
- ✅ **Página Settings** (`src/pages/Settings.tsx`)
  - Gestão de conexão Google
  - Info sobre armazenamento

### 4. **Roteamento**
- ✅ Rota `/settings` adicionada ao App
- ✅ Link "Definições" adicionado à Sidebar

---

## 📋 CONFIGURAÇÃO NO SUPABASE (PASSO A PASSO)

### PASSO 1: Configurar Google Provider

1. Acede ao **Dashboard do Supabase**
2. Vai a **Authentication** → **Providers**
3. Ativa o **Google** (toggle ON)
4. Configurações:

```
Client ID: [O teu Client ID do Google Cloud Console]
Client Secret: [O teu Client Secret]

Redirect URL (copia isto):
https://[teu-projeto].supabase.co/auth/v1/callback
```

5. **IMPORTANTE**: No Google Cloud Console, adiciona esta URL aos **Authorized redirect URIs**

### PASSO 2: Configurar Scopes no Supabase

No campo **"Additional scopes"** do Provider Google, adiciona:

```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/spreadsheets
```

> **NOTA**: Os scopes `email` e `profile` já vêm por padrão.

### PASSO 3: Ativar APIs no Google Cloud Console

1. Acede a [Google Cloud Console](https://console.cloud.google.com/)
2. Seleciona o teu projeto
3. Vai a **APIs & Services** → **Library**
4. Ativa estas APIs:
   - ✅ **Gmail API**
   - ✅ **Google Drive API**
   - ✅ **Google Sheets API**

### PASSO 4: Configurar OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. Configurações:
   - **User Type**: External (para testar) ou Internal (se tens Google Workspace)
   - **Scopes**: Adiciona os 3 scopes manualmente:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/spreadsheets`
   - **Test Users**: Adiciona o teu email (se estiver em modo Testing)

3. **Publica a App** (quando pronto para produção)

---

## 🧪 TESTAR A INTEGRAÇÃO

### 1. Reiniciar o Dev Server
```bash
npm run dev
```

### 2. Testar o Fluxo de Login

1. Vai a `/settings`
2. Clica em **"Conectar com Google"**
3. Autoriza as 3 permissões (Gmail, Drive, Sheets)
4. És redirecionado de volta para `/`

### 3. Verificar no Browser Console

```javascript
// Abrir DevTools (F12) e verificar:
console.log(window.localStorage) // Ver se há sessão Supabase
```

Deves ver logs:
```
✅ Provider Token disponível: ya29.a0AfB...
```

### 4. Verificar no Supabase Dashboard

```sql
-- Ver utilizadores conectados
SELECT 
  id, 
  email, 
  raw_app_meta_data->>'provider' as provider,
  created_at
FROM auth.users
WHERE raw_app_meta_data->>'provider' = 'google';
```

---

## 🔑 ACESSO AOS TOKENS (Para APIs)

### No Client-Side (React):

```typescript
import { useAuth } from '@/features/auth/AuthContext';

function MyComponent() {
  const { providerToken, hasGoogleScopes } = useAuth();

  if (!hasGoogleScopes) {
    return <p>Conecta o Google primeiro!</p>;
  }

  const handleUploadToDrive = async () => {
    const { uploadFileToDrive } = await import('@/lib/google/drive');
    await uploadFileToDrive(providerToken!, file, 'fatura.pdf');
  };

  return <button onClick={handleUploadToDrive}>Upload para Drive</button>;
}
```

### Tokens Disponíveis:

- **`session.provider_token`**: Access Token (válido por 1h)
- **`session.provider_refresh_token`**: Refresh Token (para renovar)

> **NOTA**: O Supabase renova automaticamente o access_token quando expira (se tiveres o refresh_token).

---

## 📊 FLUXO COMPLETO (Fase 2)

```
1. User clica "Conectar com Google"
         ↓
2. Supabase redireciona para Google OAuth
         ↓
3. User autoriza: Gmail + Drive + Sheets
         ↓
4. Google devolve:
   - access_token
   - refresh_token (porque usamos access_type: 'offline')
         ↓
5. Supabase guarda na sessão:
   - session.provider_token
   - session.provider_refresh_token
         ↓
6. ✅ Automações podem usar os tokens!
```

---

## 🚀 PRÓXIMOS PASSOS (Automações)

### Fase 2A: Gmail → Supabase
```typescript
// TODO: Criar página /automations

// 1. Listar emails com faturas
const emails = await listEmails(providerToken, 'subject:fatura has:attachment');

// 2. Para cada email:
for (const email of emails) {
  // 2a. Buscar anexos
  const attachments = await getEmailAttachments(providerToken, email.id);
  
  // 2b. Download PDF
  const pdfData = await downloadAttachment(providerToken, email.id, attachments[0].attachmentId);
  
  // 2c. Processar com Gemini (já tens a função)
  const invoiceData = await analyzeInvoiceWithGemini(pdfData.data, pdfData.mimeType);
  
  // 2d. Upload para Drive
  const driveFile = await uploadFileToDrive(providerToken, pdfBlob, 'fatura.pdf');
  
  // 2e. Guardar no Supabase
  await supabase.from('invoices').insert({
    ...invoiceData,
    drive_file_id: driveFile.id,
    drive_link: driveFile.webViewLink,
  });
}
```

### Fase 2B: Supabase → Google Sheets
```typescript
// Sincronizar todas as faturas para um Google Sheet

const { data: invoices } = await supabase.from('invoices').select('*');

const rows = invoices.map(inv => [
  inv.doc_date,
  inv.supplier_name,
  inv.total_amount,
  inv.drive_link
]);

await appendMultipleRows(
  providerToken,
  'SPREADSHEET_ID', // Criar uma folha manualmente no Google Sheets
  'Sheet1!A2',
  rows
);
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Invalid OAuth 2.0 Redirect URI"
- Confirma que adicionaste o redirect URI do Supabase no Google Cloud Console
- Formato: `https://[projeto].supabase.co/auth/v1/callback`

### Erro: "Access blocked: This app's request is invalid"
- Falta adicionar os scopes no OAuth Consent Screen
- Vai ao Google Cloud Console → OAuth consent screen → Edit App → Scopes

### Erro: "provider_token is null"
- Não usaste `access_type: 'offline'` no signInWithOAuth
- Reconecta a conta (o código já está correto)

### Erro: "Token expired"
- O access_token expira após 1h
- O Supabase renova automaticamente SE tiveres o refresh_token
- Garante que tens `prompt: 'consent'` no OAuth

---

## 📖 DOCUMENTAÇÃO CRIADA

- **`src/features/auth/AuthContext.tsx`** - Auth com Google (scopes completos)
- **`src/lib/google/drive.ts`** - Upload para Drive
- **`src/lib/google/gmail.ts`** - Leitura de emails
- **`src/lib/google/sheets.ts`** - Escrita em Sheets
- **`src/features/auth/GoogleConnectionCard.tsx`** - UI de conexão
- **`src/pages/Settings.tsx`** - Página de configurações

---

**STATUS**: ✅ **Código pronto! Falta configurar no Supabase Dashboard.**

Depois de configurares o Google Provider, testa em `/settings`! 🚀
