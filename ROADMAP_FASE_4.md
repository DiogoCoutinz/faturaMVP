# 🚀 ROADMAP FASE 4: EDIÇÃO BIDIRECIONAL INTELIGENTE

## 📋 OBJETIVO
Criar um sistema de sincronização **bidirecional** entre Frontend ↔ Supabase ↔ Google Sheets/Drive, permitindo editar faturas e ter as mudanças propagadas automaticamente para todos os sistemas.

---

## 🎯 FUNCIONALIDADES ALVO

### 1. **Edição de Campos Simples**
**Trigger:** User edita campo no frontend (ex: `supplier_name`, `total_amount`, `summary`)

**Fluxo:**
```
User edita no frontend
  ↓
📝 Update Supabase (invoices table)
  ↓
🔄 Localiza linha no Google Sheets (match por invoice.id ou doc_number)
  ↓
📊 Update célula específica via Sheets API (batchUpdate)
  ↓
✅ Toast: "Fatura atualizada!"
```

**API Necessária:**
- `updateInvoice(invoiceId, newData)` → Supabase
- `updateSheetRow(spreadsheetId, rowIndex, columnIndex, newValue)` → Sheets API

---

### 2. **Mudança de Mês (doc_date)**
**Trigger:** User altera `doc_date` de `2025-06-15` para `2025-08-20`

**Fluxo:**
```
User muda data
  ↓
📝 Update Supabase
  ↓
🔍 Localiza linha antiga no Sheets (aba "06_Junho")
  ↓
🗑️ Apaga linha da aba antiga
  ↓
➕ Adiciona linha na aba nova ("08_Agosto")
  ↓
✅ Toast: "Fatura movida para Agosto!"
```

**Complexidade:** Precisa de "find row by unique identifier" (ex: `doc_number` ou `supplier_name + total_amount`)

---

### 3. **Mudança de Ano (doc_date ano diferente)**
**Trigger:** User altera `doc_date` de `2025-06-15` para `2024-12-20`

**Fluxo:**
```
User muda data (ano diferente!)
  ↓
📝 Update Supabase
  ↓
🔍 Identifica mudança de ano: 2025 → 2024
  ↓
🔄 NO GOOGLE DRIVE:
   📂 Localiza ficheiro PDF em "FATURAS/2025/Custos Fixos/"
   🚀 Move ficheiro para "FATURAS/2024/Custos Fixos/"
   🔗 Atualiza drive_link no Supabase
  ↓
🔄 NO GOOGLE SHEETS:
   🗑️ Apaga linha de "EXTRATO_2025" (aba "06_Junho")
   ➕ Adiciona linha em "EXTRATO_2024" (aba "12_Dezembro")
  ↓
✅ Toast: "Fatura movida para 2024!"
```

**API Necessária:**
- Drive API: `PATCH /files/{fileId}?addParents={newParentId}&removeParents={oldParentId}`

---

### 4. **Mudança de Tipo de Custo (cost_type)**
**Trigger:** User altera `cost_type` de `custo_fixo` para `custo_variavel`

**Fluxo:**
```
User muda tipo
  ↓
📝 Update Supabase
  ↓
🔄 NO GOOGLE DRIVE:
   📂 Localiza ficheiro em "FATURAS/2025/Custos Fixos/"
   🚀 Move para "FATURAS/2025/Custos Variáveis/"
  ↓
🔄 NO GOOGLE SHEETS:
   📊 Atualiza coluna "Tipo" na linha existente
  ↓
✅ Toast: "Custo reclassificado!"
```

---

## 🛠️ IMPLEMENTAÇÃO TÉCNICA

### **A. Backend Services a Criar**

#### `src/lib/sync/updateInvoice.ts`
```typescript
export async function updateInvoiceEverywhere(
  userId: string,
  invoiceId: string,
  oldData: Invoice,
  newData: Partial<Invoice>,
  accessToken: string
) {
  // 1. Update Supabase
  const updated = await supabase
    .from('invoices')
    .update(newData)
    .eq('id', invoiceId)
    .select()
    .single();

  // 2. Detectar mudanças críticas
  const yearChanged = oldData.doc_year !== newData.doc_year;
  const monthChanged = getMonth(oldData.doc_date) !== getMonth(newData.doc_date);
  const costTypeChanged = oldData.cost_type !== newData.cost_type;

  // 3. Propagação Inteligente
  if (yearChanged) {
    await handleYearChange(oldData, updated, accessToken);
  } else if (monthChanged) {
    await handleMonthChange(oldData, updated, accessToken);
  } else if (costTypeChanged) {
    await handleCostTypeChange(oldData, updated, accessToken);
  } else {
    // Apenas update simples no Sheets
    await updateSheetCell(oldData, newData, accessToken);
  }

  return updated;
}
```

#### `src/lib/sync/sheetsFinder.ts`
```typescript
/**
 * Localiza a linha de uma fatura no Google Sheets
 * Estratégia: Buscar por doc_number (único) ou supplier_name + total_amount
 */
export async function findInvoiceRowInSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  searchCriteria: {
    doc_number?: string;
    supplier_name?: string;
    total_amount?: number;
  }
): Promise<number | null> {
  // Ler todas as linhas da aba
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:K1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await response.json();
  const rows = data.values || [];

  // Procurar linha que coincide
  const rowIndex = rows.findIndex(row => {
    const [date, supplier, nif, type, docNum, amount] = row;
    
    if (searchCriteria.doc_number && docNum === searchCriteria.doc_number) {
      return true;
    }
    
    if (searchCriteria.supplier_name && supplier === searchCriteria.supplier_name &&
        searchCriteria.total_amount && Number(amount) === searchCriteria.total_amount) {
      return true;
    }
    
    return false;
  });

  return rowIndex !== -1 ? rowIndex + 2 : null; // +2 porque começa em A2
}
```

#### `src/lib/sync/driveManager.ts`
```typescript
/**
 * Move ficheiro entre pastas no Google Drive
 */
export async function moveFileBetweenFolders(
  accessToken: string,
  fileId: string,
  newParentId: string,
  oldParentId: string
): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${oldParentId}&fields=id,webViewLink`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();
  return data.webViewLink;
}
```

---

### **B. Frontend UI**

#### `src/features/faturas/EditInvoiceDrawer.tsx`
```typescript
<Drawer>
  <DrawerContent>
    <form onSubmit={handleSave}>
      <Input label="Fornecedor" value={supplier_name} onChange={...} />
      <Input label="Valor" type="number" value={total_amount} onChange={...} />
      <DatePicker label="Data" value={doc_date} onChange={...} />
      <Select label="Tipo" value={cost_type} onChange={...}>
        <option value="custo_fixo">Custo Fixo</option>
        <option value="custo_variavel">Custo Variável</option>
      </Select>
      
      <Button type="submit">
        {isUpdating ? 'Atualizando...' : 'Guardar'}
      </Button>
    </form>
  </DrawerContent>
</Drawer>
```

**Hook:**
```typescript
const { mutate: updateInvoice, isLoading } = useMutation({
  mutationFn: async (data) => {
    const response = await fetch('/api/invoices/update', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, oldData, newData: data, accessToken })
    });
    return response.json();
  },
  onSuccess: () => {
    toast.success('Fatura atualizada com sucesso!');
    refetch(); // Recarregar lista
  }
});
```

---

## 📊 TABELA DE PRIORIDADES

| Feature | Complexidade | Impacto | Prioridade |
|---------|-------------|---------|-----------|
| **1. Edição Simples (campos texto/número)** | 🟢 Baixa | 🔥 Alto | **P0 (Essencial)** |
| **2. Mudança de Mês** | 🟡 Média | 🔥 Alto | **P1 (Importante)** |
| **3. Mudança de cost_type** | 🟡 Média | 🟠 Médio | **P2 (Desejável)** |
| **4. Mudança de Ano** | 🔴 Alta | 🟠 Médio | **P3 (Nice to Have)** |

---

## 🧪 TESTES NECESSÁRIOS

### Cenário 1: Edição Simples
```
✅ Editar fornecedor → Ver mudança no Sheets
✅ Editar valor → Ver mudança no Sheets
✅ Rollback se falhar Sheets API
```

### Cenário 2: Mudança de Mês
```
✅ Fatura de Junho → Agosto (mesmo ano)
✅ Linha apagada em 06_Junho
✅ Linha criada em 08_Agosto
✅ Drive link mantém-se igual
```

### Cenário 3: Mudança de Ano
```
✅ Fatura de 2025 → 2024
✅ PDF movido no Drive
✅ Linha apagada de EXTRATO_2025
✅ Linha criada em EXTRATO_2024
✅ drive_link atualizado no Supabase
```

### Cenário 4: Mudança de Tipo
```
✅ Custo Fixo → Custo Variável
✅ PDF movido entre pastas
✅ Coluna "Tipo" atualizada no Sheets
```

---

## ⚠️ DESAFIOS TÉCNICOS

### 1. **Race Conditions**
- Se user editar 2 campos rapidamente, podem haver conflitos
- **Solução:** Debounce de 500ms + queue de updates

### 2. **Identificação Única da Linha**
- Google Sheets não tem IDs de linha permanentes
- **Solução:** Usar `doc_number` como chave única (garantir que Gemini sempre extraia isto)

### 3. **Rollback em Caso de Erro**
- Se falhar Sheets mas Supabase já foi atualizado
- **Solução:** Transaction pattern ou "compensating actions" (reverter Supabase se Sheets falhar)

### 4. **Performance**
- Ler 1000 linhas para encontrar uma específica é lento
- **Solução:** Cache local da estrutura do Sheets + busca binária

---

## 🚀 PRÓXIMOS PASSOS (ORDEM)

1. ✅ **FASE 3 COMPLETA** (Template replication)
2. 🔲 **Implementar `findInvoiceRowInSheet`** (core da edição)
3. 🔲 **Criar `updateInvoiceEverywhere` básico** (apenas campos simples)
4. 🔲 **Criar UI de Edição no Frontend** (drawer ou modal)
5. 🔲 **Testar edição simples end-to-end**
6. 🔲 **Implementar mudança de mês** (mover linhas entre abas)
7. 🔲 **Implementar mudança de cost_type** (mover ficheiros Drive)
8. 🔲 **Implementar mudança de ano** (mover tudo)
9. 🔲 **Adicionar logs/audit trail** (histórico de mudanças)

---

## 🎯 MVP (Minimum Viable Product)

Para começar RÁPIDO, implementar apenas:
- ✅ Edição de campos simples (supplier_name, total_amount, summary)
- ✅ Update Supabase + Sheets (mesma aba)
- ⛔ SEM mover ficheiros/linhas (fase 2)

**Tempo estimado MVP:** 2-3 horas
**Tempo estimado Full Feature:** 8-12 horas

---

**STATUS:** 📋 Planejamento Completo → Pronto para implementação!
