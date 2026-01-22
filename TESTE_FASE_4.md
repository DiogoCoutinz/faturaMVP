# 🧪 GUIA DE TESTES - FASE 4: EDIÇÃO BIDIRECIONAL

## 🎯 OBJETIVO DOS TESTES
Verificar se o sistema de edição bidirecional (Frontend ↔ Supabase ↔ Google Sheets) está a funcionar corretamente.

---

## ⚙️ PRÉ-REQUISITOS

### Antes de começar os testes:

1. ✅ **Google Conectado**
   - Vai para `http://localhost:8081/settings`
   - Verifica se está conectado com Google
   - Se não: Clica "Conectar Google Account"

2. ✅ **Faturas Existentes**
   - Vai para `http://localhost:8081/faturas`
   - Deve haver pelo menos 3-5 faturas processadas
   - Se não: Vai para `/upload` e carrega algumas faturas

3. ✅ **Google Sheets Acessível**
   - Abre o Google Sheets do ano corrente (ex: `EXTRATO_2025`)
   - Link: `https://drive.google.com/drive/folders/[ID_DA_PASTA_FATURAS]`
   - Mantém aberto numa aba separada para ver mudanças em tempo real

4. ✅ **Console do Browser Aberto**
   - Abre DevTools (F12)
   - Tab "Console"
   - Vai ver logs detalhados de cada operação

---

## 📋 SUITE DE TESTES

### **TESTE 1: Abrir Drawer de Edição**

**Objetivo:** Verificar se o drawer abre corretamente

**Passos:**
1. Vai para `http://localhost:8081/faturas`
2. Escolhe qualquer fatura
3. Clica no ícone "⋮" (três pontos)
4. Clica "Editar"

**Resultado Esperado:**
- ✅ Drawer abre do lado direito
- ✅ Todos os campos estão preenchidos com os dados atuais
- ✅ Botão "Guardar Alterações" visível
- ✅ Botão "Cancelar" visível

**Se falhar:**
- Verifica console: erros de permissões?
- Verifica se `hasGoogleScopes` é `true` (Settings → Google conectado?)

---

### **TESTE 2: Edição de Campo Simples (Fornecedor)**

**Objetivo:** Editar o nome do fornecedor e verificar sincronização

**Passos:**
1. Abre drawer de edição de uma fatura
2. **ANOTA O NOME ATUAL:** ex: "Vodafone"
3. Altera para: "Vodafone Portugal SA"
4. Clica "Guardar Alterações"

**Resultado Esperado:**
- ✅ Botão muda para "A atualizar..." (com spinner)
- ✅ Após 2-3 segundos: Alert verde com "✅ Fatura atualizada no sistema e no Google Sheets!"
- ✅ Toast (canto superior direito): "Fatura atualizada com sucesso!"
- ✅ Drawer fecha automaticamente após 2 segundos

**Verificação Manual:**
1. **Supabase:**
   - Vai para `https://supabase.com/dashboard/project/[SEU_PROJETO]/editor`
   - Abre tabela `invoices`
   - Procura a fatura pelo ID
   - ✅ Verifica: `supplier_name` = "Vodafone Portugal SA"

2. **Google Sheets:**
   - Vai para o Sheet correspondente ao ano da fatura
   - Procura a linha da fatura (coluna B - Fornecedor)
   - ✅ Verifica: Célula foi atualizada para "Vodafone Portugal SA"

**Logs do Console (Esperados):**
```
🔄 Iniciando update bidirecional...
   📝 Campos a atualizar: ["supplier_name"]
   ✅ Fatura atual: Vodafone
   ✅ Supabase atualizado
   📊 Procurando em [SPREADSHEET_ID] (aba: 06_Junho)
🔍 Procurando fatura em 06_Junho...
   📊 Procurando em 15 linhas...
   ✅ Encontrado por doc_number na linha 5
📝 Atualizando 1 células na linha 5...
   ✅ 1 células atualizadas
✅ Resultado: {success: true, updatedInSupabase: true, updatedInSheets: true, ...}
```

---

### **TESTE 3: Edição de Valor Monetário**

**Objetivo:** Editar o valor total e verificar formatação correta

**Passos:**
1. Abre drawer de edição
2. **ANOTA O VALOR ATUAL:** ex: "120.50"
3. Altera "Valor Total" para: "135.75"
4. Guarda

**Resultado Esperado:**
- ✅ Update bem-sucedido (alert verde)
- ✅ No Sheets: Célula F mostra "135.75" ou "135,75 €" (dependendo do formato)
- ✅ Na lista de faturas: Valor aparece como "135,75 €"

**Armadilhas Comuns:**
- ❌ Se colocar vírgula no input: "135,75" → Pode dar erro
- ✅ Solução: Input aceita ponto decimal: "135.75"

---

### **TESTE 4: Edição de Múltiplos Campos**

**Objetivo:** Alterar vários campos de uma vez

**Passos:**
1. Abre drawer de edição
2. Altera:
   - **Fornecedor:** "EDP" → "EDP Comercial"
   - **NIF:** "123456789" → "500907042"
   - **Valor Total:** "80.00" → "95.50"
   - **IVA:** "18.40" → "21.97"
   - **Resumo:** (adiciona texto) "Fatura de eletricidade - Abril 2025"
3. Guarda

**Resultado Esperado:**
- ✅ Console mostra: `Campos a atualizar: ["supplier_name", "supplier_vat", "total_amount", "tax_amount", "summary"]`
- ✅ Alert verde
- ✅ No Sheets: **5 células** foram atualizadas (B, C, F, G, H)

**Logs do Console (Esperados):**
```
📝 Enviando updates: {
  supplier_name: "EDP Comercial",
  supplier_vat: "500907042",
  total_amount: 95.5,
  tax_amount: 21.97,
  summary: "Fatura de eletricidade - Abril 2025"
}
   ✅ 5 células atualizadas
```

---

### **TESTE 5: Sem Mudanças (Edge Case)**

**Objetivo:** Verificar que não faz requests desnecessários

**Passos:**
1. Abre drawer de edição
2. **NÃO altera NADA**
3. Clica "Guardar Alterações"

**Resultado Esperado:**
- ✅ Toast: "Nenhuma alteração detectada"
- ✅ Drawer NÃO fecha automaticamente (user pode continuar a editar)
- ✅ Console: NÃO aparece "Iniciando update bidirecional"
- ✅ **0 requests** ao Supabase/Sheets (verificar tab Network)

---

### **TESTE 6: Mudança de Tipo de Custo**

**Objetivo:** Trocar entre "Custo Fixo" e "Custo Variável"

**Passos:**
1. Abre drawer de edição de uma fatura com `cost_type = "custo_fixo"`
2. Muda dropdown de "Custo Fixo" para "Custo Variável"
3. Guarda

**Resultado Esperado (MVP - Fase 4):**
- ✅ Supabase atualizado: `cost_type = "custo_variavel"`
- ✅ Sheets atualizado: Coluna D (Tipo) = "custo_variavel"
- ⚠️ **Ficheiro PDF NÃO é movido** (limitação do MVP, será Fase 5)

**Nota:** Na Fase 5, isto vai mover o PDF entre pastas:
```
DE:   FATURAS/2025/Custos Fixos/2025-06-15_Vodafone_89.90.pdf
PARA: FATURAS/2025/Custos Variáveis/2025-06-15_Vodafone_89.90.pdf
```

---

### **TESTE 7: Validação de Campos Numéricos**

**Objetivo:** Testar inputs inválidos

**Passos:**
1. Abre drawer de edição
2. No campo "Valor Total", escreve: "abc"
3. Tenta guardar

**Resultado Esperado:**
- ✅ Input HTML não permite submeter (type="number")
- ✅ Se forçar via DevTools: Backend converte para 0
- ✅ Alert amarelo ou erro

**Outros Casos:**
- Valor negativo: "-50.00" → Aceita? (depende das regras de negócio)
- Valor muito grande: "999999999.99" → Deve funcionar
- Zero: "0.00" → Deve funcionar

---

### **TESTE 8: Erro de Sincronização (Simular)**

**Objetivo:** Verificar tratamento de erro quando linha não existe no Sheets

**Setup:**
1. Escolhe uma fatura
2. **Anota o `doc_number`** (ex: "FA2025-123")
3. Abre o Google Sheets correspondente
4. **APAGA MANUALMENTE** a linha desta fatura
5. Volta ao frontend

**Passos:**
1. Tenta editar a fatura (ex: mudar fornecedor)
2. Guarda

**Resultado Esperado:**
- ✅ Supabase é atualizado (dados salvos com sucesso)
- ✅ Sheets retorna "Linha não encontrada"
- ✅ Alert **amarelo** (warning): "⚠️ Atualizado no sistema, mas não foi possível sincronizar com o Excel"
- ✅ Toast: "Fatura atualizada com sucesso!" (porque Supabase funcionou)

**Logs do Console:**
```
🔍 Procurando fatura em 06_Junho...
   📊 Procurando em 14 linhas...
   ⚠️ Fatura não encontrada no Sheets
   ⚠️ Linha não encontrada no Sheets (pode ter sido movida/apagada)
```

**Verificação:**
- ✅ No Supabase: Dados foram alterados
- ✅ No Sheets: Linha continua não existindo (esperado)
- ✅ User foi AVISADO que algo não bateu certo

---

### **TESTE 9: Token Google Expirado (Simular)**

**Objetivo:** Testar comportamento com autenticação inválida

**Setup (Avançado):**
1. Abre DevTools → Application → Local Storage
2. Procura por chave relacionada com `supabase.auth.token`
3. Modifica o `provider_token` para um valor inválido: "invalid_token_xyz"

**Passos:**
1. Tenta editar uma fatura
2. Guarda

**Resultado Esperado:**
- ✅ Supabase atualizado (usa session normal, não provider_token)
- ❌ Sheets falha com erro 401 Unauthorized
- ✅ Alert amarelo ou vermelho
- ✅ Mensagem sugere reconectar Google

**Solução para User:**
- Vai para `/settings`
- Clica "Desconectar" e depois "Conectar Google Account"
- Refaz o fluxo OAuth

---

### **TESTE 10: Múltiplas Edições Rápidas (Stress Test)**

**Objetivo:** Verificar race conditions

**Passos:**
1. Abre drawer de edição
2. Muda fornecedor para "Teste 1"
3. Guarda
4. **IMEDIATAMENTE** (antes do drawer fechar):
5. Muda fornecedor para "Teste 2"
6. Guarda novamente

**Resultado Esperado (Atual - sem debounce):**
- ⚠️ Ambas as requests são enviadas
- ⚠️ A segunda pode sobrescrever a primeira
- ⚠️ Pode haver inconsistência temporária

**Resultado Esperado (Fase 5 - com debounce):**
- ✅ Primeira request é cancelada
- ✅ Só a segunda é processada
- ✅ Valor final no Supabase/Sheets: "Teste 2"

**Nota:** Implementar debounce de 500ms em Fase 5

---

## 🐛 TROUBLESHOOTING

### **Erro: "Dados de autenticação inválidos"**
**Causa:** `providerToken` não disponível  
**Solução:** Reconectar Google em `/settings`

### **Erro: "Linha não encontrada no Sheets"**
**Causa:** 
- Linha foi apagada manualmente
- Fatura de antes do sistema de sync
**Solução:** Não é um bug - sistema avisa corretamente

### **Erro: "Failed to fetch" no Console**
**Causa:** Dev server offline ou CORS  
**Solução:** Verifica se `npm run dev` está rodando

### **Sheets não atualiza mas Supabase sim**
**Causa:** 
- Token expirado
- Spreadsheet ID errado
- Permissões insuficientes
**Solução:** 
- Verifica logs do Console
- Testa manualmente: `https://sheets.googleapis.com/v4/spreadsheets/[ID]` com token

---

## ✅ CHECKLIST FINAL

Marca cada teste como concluído:

- [ ] **TESTE 1:** Drawer abre corretamente
- [ ] **TESTE 2:** Edição de fornecedor sincroniza
- [ ] **TESTE 3:** Edição de valor monetário funciona
- [ ] **TESTE 4:** Múltiplos campos são atualizados
- [ ] **TESTE 5:** Sem mudanças não faz requests
- [ ] **TESTE 6:** Mudança de cost_type funciona (sem mover PDF)
- [ ] **TESTE 7:** Validação de inputs numéricos
- [ ] **TESTE 8:** Erro de linha não encontrada é tratado
- [ ] **TESTE 9:** Token expirado é tratado
- [ ] **TESTE 10:** Múltiplas edições não crasham

**Se todos passaram:** 🎉 **FASE 4 MVP VALIDADA!**

---

## 📊 REPORT DE TESTES (Template)

```
DATA DO TESTE: [DD/MM/YYYY]
TESTADOR: [Nome]
BROWSER: [Chrome/Firefox/Safari + Versão]

┌─────────────┬─────────┬──────────────────────┐
│ TESTE       │ STATUS  │ NOTAS                │
├─────────────┼─────────┼──────────────────────┤
│ Teste 1     │ ✅ PASS │                      │
│ Teste 2     │ ✅ PASS │                      │
│ Teste 3     │ ✅ PASS │                      │
│ Teste 4     │ ✅ PASS │                      │
│ Teste 5     │ ✅ PASS │                      │
│ Teste 6     │ ✅ PASS │ PDF não move (MVP)   │
│ Teste 7     │ ✅ PASS │                      │
│ Teste 8     │ ✅ PASS │                      │
│ Teste 9     │ ⚠️ SKIP │ Requer setup avançado│
│ Teste 10    │ ⚠️ WARN │ Race condition vista │
└─────────────┴─────────┴──────────────────────┘

BUGS ENCONTRADOS:
- Nenhum

SUGESTÕES:
- Adicionar debounce de 500ms (Fase 5)
- Histórico de mudanças (audit trail)
```

---

**BOA SORTE NOS TESTES!** 🚀🧪
