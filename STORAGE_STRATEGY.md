# 🔄 ESTRATÉGIA DE ARMAZENAMENTO - FASE 1 & 2

## 📊 ARQUITETURA FINAL

```
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Tabela: invoices                                  │  │
│  │ - Dados extraídos (Fornecedor, Valor, Data, NIF) │  │
│  │ - storage_path (Supabase - temporário)           │  │
│  │ - drive_file_id + drive_link (Google Drive)     │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
   ┌─────▼─────┐                      ┌──────▼──────┐
   │ SUPABASE  │                      │   GOOGLE    │
   │  STORAGE  │  ───MIGRAÇÃO──→      │    DRIVE    │
   │  (Cache)  │                      │ (Permanente)│
   └───────────┘                      └─────────────┘
    Fase 1: 7 dias                     Fase 2: Forever
```

---

## 🎯 FASE 1 (ATUAL) - Supabase como Cache

### ✅ O QUE JÁ ESTÁ IMPLEMENTADO:

1. **Upload para Supabase Storage** (`bucket: invoices`)
   - Path: `uploads/{user_id}/{timestamp}-{random}.{ext}`
   - Guardado em: `storage_path` (coluna nova)
   - URL público gerado: `file_url`

2. **Análise com Gemini AI**
   - Extração de dados estruturados
   - JSON completo guardado na tabela

3. **Persistência no DB**
   ```sql
   storage_path   → "uploads/anonymous/1234567890-abc.pdf"
   file_url       → "https://...supabase.co/storage/v1/object/public/..."
   drive_file_id  → NULL (ainda não migrado)
   drive_link     → NULL (ainda não migrado)
   status         → "processed" ou "review"
   ```

### 📝 CAMPOS ADICIONADOS (Nova Estrutura):

```typescript
interface Invoice {
  // STORAGE (Fase 1: Cache temporário)
  file_url: string;        // URL público do Supabase
  storage_path: string;    // Caminho interno (ex: uploads/user/file.pdf)
  
  // GOOGLE DRIVE (Fase 2: Permanente)
  drive_link: string | null;      // URL de visualização no Drive
  drive_file_id: string | null;   // ID do ficheiro (para API)
  
  // DADOS EXTRAÍDOS
  supplier_name, total_amount, doc_date, etc...
  
  // CONTROLO
  status: 'processed' | 'review' | 'migrated'
}
```

### 🗄️ MIGRAÇÃO SQL (Executar no Supabase):

```bash
# Ficheiro criado: supabase/migrations/add_google_drive_fields.sql
```

Executa no **SQL Editor** do Supabase para adicionar:
- `storage_path` (TEXT)
- `drive_file_id` (TEXT)
- Índices para queries rápidas
- Comentários de documentação

---

## 🚀 FASE 2 (TODO) - Migração para Google Drive

### Fluxo de Migração:

```javascript
// TODO: Implementar na próxima iteração
async function migrateToGoogleDrive(invoiceId: string) {
  // 1. Buscar invoice com storage_path preenchido
  const invoice = await getInvoiceById(invoiceId);
  
  // 2. Download do ficheiro do Supabase
  const file = await supabase.storage
    .from('invoices')
    .download(invoice.storage_path);
  
  // 3. Upload para Google Drive
  const driveFile = await uploadToGoogleDrive(file, {
    name: `${invoice.supplier_name}_${invoice.doc_date}.pdf`,
    folderId: 'PASTA_FATURAS_ID'
  });
  
  // 4. Atualizar DB
  await supabase
    .from('invoices')
    .update({
      drive_file_id: driveFile.id,
      drive_link: driveFile.webViewLink,
      status: 'migrated'
    })
    .eq('id', invoiceId);
  
  // 5. Apagar do Supabase Storage (Limpar cache)
  await supabase.storage
    .from('invoices')
    .remove([invoice.storage_path]);
  
  console.log('✅ Migrado para Google Drive!');
}
```

### APIs Necessárias (Fase 2):
- [ ] Google Drive API v3
- [ ] OAuth 2.0 (Service Account ou User Auth)
- [ ] Pasta partilhada no Drive (`PASTA_FATURAS_ID`)

---

## 🧪 TESTES ATUAIS (Fase 1)

### Checklist de Validação:

1. **Upload funciona?**
   ```bash
   # Vai a /upload e arrasta uma fatura
   # Verifica se aparece no Supabase Storage
   ```

2. **Dados são extraídos?**
   ```sql
   SELECT supplier_name, total_amount, doc_date, storage_path
   FROM invoices
   ORDER BY created_at DESC
   LIMIT 1;
   ```

3. **storage_path está preenchido?**
   ```sql
   SELECT id, storage_path, drive_file_id
   FROM invoices
   WHERE storage_path IS NOT NULL;
   ```

4. **Logs no Browser Console:**
   ```
   📤 Upload para Supabase Storage: uploads/anonymous/...
   ✅ URL público gerado: https://...
   🤖 Enviando para Gemini AI...
   ✅ Dados extraídos: { supplier_name: "Galp", ... }
   ✅ Fatura processada com sucesso! ID: abc-123
   ```

---

## 📊 QUERIES ÚTEIS

### Ver faturas ainda não migradas:
```sql
SELECT 
  id, 
  supplier_name, 
  storage_path, 
  drive_file_id,
  status,
  created_at
FROM invoices
WHERE storage_path IS NOT NULL 
  AND drive_file_id IS NULL
ORDER BY created_at DESC;
```

### Contar ficheiros no cache:
```sql
SELECT 
  status,
  COUNT(*) as total
FROM invoices
GROUP BY status;
```

### Tamanho estimado no Supabase Storage:
```sql
-- Assumindo 1MB por ficheiro em média
SELECT 
  COUNT(*) as ficheiros,
  COUNT(*) * 1.0 as mb_aproximados
FROM invoices
WHERE storage_path IS NOT NULL 
  AND drive_file_id IS NULL;
```

---

## 💰 ESTIMATIVA DE CUSTOS

### Supabase (Cache - 7 dias):
- **Free Tier**: 1GB Storage
- **Custo Extra**: $0.021/GB/mês
- **Exemplo**: 100 faturas/mês × 1MB = 0.1GB ≈ **GRÁTIS**

### Google Drive (Permanente):
- **Google Workspace**: 30GB/utilizador incluído
- **Custo Extra**: $0.02/GB/mês (se ultrapassar)
- **Exemplo**: 1000 faturas × 1MB = 1GB ≈ **GRÁTIS**

---

## 🎯 PRÓXIMOS PASSOS

### Fase 1 (Agora):
- [x] Adicionar `storage_path` e `drive_file_id` à tabela
- [x] Logs detalhados no processamento
- [x] TODOs no código para Fase 2
- [ ] Executar migração SQL no Supabase
- [ ] Testar upload end-to-end

### Fase 2 (Próxima Iteração):
- [ ] Integração Google Drive API
- [ ] Script de migração em lote
- [ ] Cron Job para limpeza automática (7 dias)
- [ ] Notificações de sucesso/falha

---

**Resumo**: Os dados ficam **sempre** no Supabase DB. Os ficheiros ficam **temporariamente** no Supabase Storage e **permanentemente** no Google Drive (Fase 2).
