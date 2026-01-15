# 🚀 GUIA DE CONFIGURAÇÃO - Upload + Gemini AI

## ✅ O QUE FOI IMPLEMENTADO

### 1. **Gemini AI Client** (`src/lib/gemini.ts`)
- Prompt de sistema para atuar como Contabilista Sénior
- Análise de imagem/PDF com extração de dados estruturados
- Classificação automática de custos (fixos vs variáveis)
- Modelo: `gemini-2.0-flash-exp` (mais rápido) ou `gemini-1.5-pro`

### 2. **Processador de Invoices** (`src/lib/invoiceProcessor.ts`)
- **Fluxo completo**:
  1. Upload para Supabase Storage (bucket: `invoices`)
  2. Análise com Gemini Vision
  3. Inserção na tabela `invoices`
- Validações: tamanho (max 10MB), formatos (JPG, PNG, PDF)
- Tratamento de erros e rollback

### 3. **Componente de Upload** (`src/features/upload/UploadZone.tsx`)
- Drag & Drop (powered by `react-dropzone`)
- Estados visuais: idle → uploading → analyzing → success/error
- Progress bar animada
- Exibição dos dados extraídos
- Alerta de revisão manual se confidence < 70%

---

## 📋 CONFIGURAÇÃO NECESSÁRIA

### PASSO 1: Adicionar API Key do Gemini

1. Vai a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Cria uma nova API Key
3. Adiciona ao teu ficheiro `.env`:

```bash
VITE_GEMINI_API_KEY=AIzaSy...
```

### PASSO 2: Criar Bucket no Supabase

1. Acede ao [Dashboard do Supabase](https://supabase.com/dashboard)
2. Vai a **Storage** → **New Bucket**
3. Configurações:
   - **Name**: `invoices`
   - **Public bucket**: ✅ **SIM** (para gerar URLs públicos)
   - **File size limit**: 10MB
   - **Allowed MIME types**: `image/jpeg, image/png, application/pdf`

4. **Criar Política de Acesso** (Storage Policies):

```sql
-- Permitir uploads anónimos (já que não há auth)
create policy "Anyone can upload"
on storage.objects for insert
with check (bucket_id = 'invoices');

-- Permitir leitura pública
create policy "Public access"
on storage.objects for select
using (bucket_id = 'invoices');
```

### PASSO 3: Verificar Tabela `invoices`

Confirma que a tabela tem estes campos:

```sql
-- Verificar estrutura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices';
```

Campos obrigatórios:
- `file_url` (text)
- `document_type` (text)
- `cost_type` (text)
- `doc_date` (date)
- `doc_year` (integer)
- `supplier_name` (text)
- `total_amount` (numeric)
- `summary` (text)
- `status` (text)
- `manual_review` (boolean)

---

## 🧪 TESTAR AGORA

1. **Reinicia o dev server** (para ler o .env):
   ```bash
   npm run dev
   ```

2. **Vai a** `http://localhost:8080/upload`

3. **Testa com uma fatura**:
   - Arrasta uma imagem JPG/PNG ou PDF
   - Vê o progresso: Upload → Análise IA → Sucesso
   - Verifica os dados extraídos

4. **Consulta em Supabase**:
   ```sql
   SELECT * FROM invoices ORDER BY created_at DESC LIMIT 1;
   ```

---

## 🐛 TROUBLESHOOTING

### Erro: "VITE_GEMINI_API_KEY não configurada"
- Adiciona a key no `.env`
- Reinicia o `npm run dev`

### Erro: "Bucket não existe"
- Confirma que o bucket `invoices` foi criado no Supabase Storage
- Verifica se está público

### Erro: "Failed to insert"
- Verifica se a tabela `invoices` tem as colunas corretas
- Confirma que as políticas RLS permitem insert anónimo

### Análise imprecisa
- Usa imagens com boa resolução
- PDFs nativos (não scans) têm melhor precisão
- Se `confidence_score < 70`, o sistema marca para revisão manual

---

## 📊 PRÓXIMOS PASSOS (FASE 2)

- [ ] Integração com Gmail (ler emails automaticamente)
- [ ] Sincronização com Google Drive
- [ ] Dashboard de métricas (custos fixos vs variáveis)
- [ ] Exportação para Excel/CSV
- [ ] Notificações (Toast) ao processar
- [ ] Batch upload (múltiplas faturas)

---

## 🎯 ESTRUTURA DE FICHEIROS CRIADOS

```
src/
├── lib/
│   ├── gemini.ts              # Cliente Gemini + Prompt de sistema
│   └── invoiceProcessor.ts    # Fluxo Upload → AI → DB
└── features/
    └── upload/
        └── UploadZone.tsx     # Componente Drag & Drop
```

**Dependências instaladas:**
- `@google/generative-ai` (Gemini SDK)
- `react-dropzone` (Upload interface)

---

Está tudo pronto! Siga testar! 🚀
