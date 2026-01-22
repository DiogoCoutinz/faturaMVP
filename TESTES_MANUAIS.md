# 🧪 Guia Completo de Testes Manuais - FaturasAI

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Suite 1: Edição Básica](#suite-1-edição-básica)
3. [Suite 2: Mudança de Mês](#suite-2-mudança-de-mês)
4. [Suite 3: Mudança de Ano](#suite-3-mudança-de-ano)
5. [Suite 4: Mudança de Tipo de Custo](#suite-4-mudança-de-tipo-de-custo)
6. [Suite 5: Casos de Erro](#suite-5-casos-de-erro)
7. [Suite 6: Edge Cases](#suite-6-edge-cases)
8. [Checklist de Validação](#checklist-de-validação)

---

## Pré-requisitos

### Antes de começar os testes:

1. ✅ **Google Conectado**
   - Vai para `http://localhost:8081/settings`
   - Verifica se está conectado com Google
   - Se não: Clica "Conectar Google Account"

2. ✅ **Faturas Existentes**
   - Vai para `http://localhost:8081/faturas`
   - Deve haver pelo menos 5-10 faturas processadas
   - Se não: Vai para `/upload` e carrega algumas faturas

3. ✅ **Google Sheets Acessível**
   - Abre o Google Sheets do ano corrente (ex: `EXTRATO_2025`)
   - Link: `https://drive.google.com/drive/folders/[ID_DA_PASTA_FATURAS]`
   - Mantém aberto numa aba separada para ver mudanças em tempo real

4. ✅ **Console do Browser Aberto**
   - Abre DevTools (F12)
   - Tab "Console"
   - Vai ver logs detalhados de cada operação

5. ✅ **Supabase Dashboard Aberto**
   - Vai para `https://supabase.com/dashboard/project/[SEU_PROJETO]/editor`
   - Abre tabela `invoices`
   - Mantém aberto para verificar mudanças em tempo real

---

## Suite 1: Edição Básica

### Teste 1.1: Editar Fornecedor

**Objetivo:** Verificar que edição de fornecedor sincroniza corretamente

**Passos:**
1. Vai para `http://localhost:8081/faturas`
2. Escolhe uma fatura qualquer
3. Clica no ícone "⋮" → "Editar"
4. **ANOTA O NOME ATUAL:** ex: "Vodafone"
5. Altera para: "Vodafone Portugal SA"
6. Clica "Guardar Alterações"

**Resultado Esperado:**
- ✅ Botão muda para "A atualizar..." (com spinner)
- ✅ Após 2-3 segundos: Alert verde com "✅ Fatura atualizada no sistema e no Google Sheets!"
- ✅ Toast (canto superior direito): "Fatura atualizada com sucesso!"
- ✅ Drawer fecha automaticamente após 2 segundos

**Verificação Manual:**
1. **Supabase:**
   - Vai para tabela `invoices`
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
   ✅ Encontrado por doc_number na linha 5
📝 Atualizando 1 células na linha 5...
   ✅ 1 células atualizadas
✅ Resultado: {success: true, updatedInSupabase: true, updatedInSheets: true, ...}
```

---

### Teste 1.2: Editar Valor Monetário

**Objetivo:** Editar o valor total e verificar formatação correta

**Passos:**
1. Abre drawer de edição de uma fatura
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

### Teste 1.3: Edição de Múltiplos Campos

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

---

### Teste 1.4: Sem Mudanças (Edge Case)

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

## Suite 2: Mudança de Mês

### Teste 2.1: Mudança de Mês (Mesmo Ano)

**Objetivo:** Verificar que linha é movida entre abas quando data muda de mês

**Passos:**
1. Escolhe uma fatura de Junho 2025 (ex: `doc_date = "2025-06-15"`)
2. **ANOTA:**
   - `doc_number`: ex: "FA2025-123"
   - Aba atual: `06_Junho`
   - Linha atual no Sheets
3. Abre drawer de edição
4. Altera data de `2025-06-15` para `2025-08-20`
5. Guarda

**Resultado Esperado:**
- ✅ Alert verde: "Fatura atualizada com sucesso!"
- ✅ No Sheets (EXTRATO_2025):
   - ❌ Linha **APAGADA** da aba `06_Junho`
   - ✅ Linha **ADICIONADA** na aba `08_Agosto`
   - ✅ Todos os dados corretos na nova linha
- ✅ No Supabase: `doc_date` = "2025-08-20", `doc_year` = 2025

**Logs do Console (Esperados):**
```
🔄 Iniciando update bidirecional...
   📝 Campos a atualizar: ["doc_date", "doc_year"]
   📅 Mudança de mês detectada: 06_Junho → 08_Agosto
   ✅ Linha encontrada: 5
🔄 Movendo linha 5 de 06_Junho para 08_Agosto...
   ✅ Linha lida: 10 células
   🗑️ Apagando linha 5 da aba 06_Junho...
   ✅ Linha apagada da aba 06_Junho
   ✅ Linha adicionada na aba 08_Agosto
```

---

### Teste 2.2: Mudança de Mês - Verificar Dados Preservados

**Objetivo:** Verificar que todos os dados são preservados ao mover entre abas

**Passos:**
1. Escolhe uma fatura com dados completos
2. Muda mês (ex: Julho → Setembro)
3. Guarda

**Resultado Esperado:**
- ✅ Todos os campos são preservados:
   - Fornecedor
   - NIF
   - Nº Documento
   - Valor Total
   - IVA
   - Resumo
   - Link PDF
   - Tipo de Custo

---

## Suite 3: Mudança de Ano

### Teste 3.1: Mudança de Ano Completa

**Objetivo:** Verificar que fatura é movida entre spreadsheets e PDF movido no Drive

**Passos:**
1. Escolhe uma fatura de 2025 (ex: `doc_date = "2025-06-15"`)
2. **ANOTA:**
   - `doc_number`: ex: "FA2025-123"
   - Spreadsheet atual: `EXTRATO_2025`
   - Aba atual: `06_Junho`
   - `drive_file_id`: ID do ficheiro no Drive
3. Abre drawer de edição
4. Altera data de `2025-06-15` para `2024-12-20`
5. Guarda

**Resultado Esperado:**
- ✅ Alert verde: "Fatura atualizada e ficheiro movido com sucesso!"
- ✅ **Google Drive:**
   - ❌ PDF **APAGADO** de `FATURAS/2025/Custos Fixos/`
   - ✅ PDF **MOVIDO** para `FATURAS/2024/Custos Fixos/`
   - ✅ `drive_link` atualizado no Supabase
- ✅ **Google Sheets:**
   - ❌ Linha **APAGADA** de `EXTRATO_2025` (aba `06_Junho`)
   - ✅ Linha **ADICIONADA** em `EXTRATO_2024` (aba `12_Dezembro`)
- ✅ **Supabase:**
   - `doc_date` = "2024-12-20"
   - `doc_year` = 2024
   - `drive_link` atualizado

**Logs do Console (Esperados):**
```
🔄 Iniciando update bidirecional...
   📝 Campos a atualizar: ["doc_date", "doc_year"]
   📦 MUDANÇA DETECTADA! A mover ficheiro no Drive...
      Ano: 2025 → 2024
      📁 Nova pasta: FATURAS/2024/Custos Fixos
      ✅ Ficheiro movido com sucesso no Drive!
   📅 Mudança de ano detectada: 2025 → 2024
🔄 Movendo linha 5 de EXTRATO_2025 (06_Junho) para EXTRATO_2024 (12_Dezembro)...
   ✅ Linha apagada do spreadsheet antigo
   ✅ Linha adicionada no novo spreadsheet
```

---

### Teste 3.2: Mudança de Ano com Mudança de Tipo de Custo

**Objetivo:** Verificar que PDF é movido para pasta correta quando ano e tipo mudam

**Passos:**
1. Escolhe uma fatura de 2025, tipo "Custo Fixo"
2. Altera:
   - Data: `2025-06-15` → `2024-12-20`
   - Tipo: `Custo Fixo` → `Custo Variável`
3. Guarda

**Resultado Esperado:**
- ✅ PDF movido para `FATURAS/2024/Custos Variáveis/`
- ✅ Linha movida para `EXTRATO_2024` (aba `12_Dezembro`)
- ✅ Coluna Tipo atualizada no Sheets

---

## Suite 4: Mudança de Tipo de Custo

### Teste 4.1: Mudança de Tipo de Custo (Mesmo Ano)

**Objetivo:** Verificar que PDF é movido entre pastas quando tipo muda

**Passos:**
1. Escolhe uma fatura de 2025, tipo "Custo Fixo"
2. **ANOTA:**
   - `drive_file_id`
   - Localização atual: `FATURAS/2025/Custos Fixos/`
3. Abre drawer de edição
4. Altera tipo de "Custo Fixo" para "Custo Variável"
5. Guarda

**Resultado Esperado:**
- ✅ Alert verde: "Fatura atualizada e ficheiro movido com sucesso!"
- ✅ **Google Drive:**
   - ❌ PDF **APAGADO** de `FATURAS/2025/Custos Fixos/`
   - ✅ PDF **MOVIDO** para `FATURAS/2025/Custos Variáveis/`
- ✅ **Google Sheets:**
   - ✅ Coluna D (Tipo Custo) atualizada para "custo_variavel"
- ✅ **Supabase:**
   - `cost_type` = "custo_variavel"
   - `drive_link` atualizado

---

## Suite 5: Casos de Erro

### Teste 5.1: Token Google Expirado

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

### Teste 5.2: Linha Não Encontrada no Sheets

**Objetivo:** Verificar tratamento quando linha foi apagada manualmente

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
- ✅ Alert **amarelo** (warning): "⚠️ Fatura atualizada no sistema. A linha pode não existir no Excel ou ter sido movida manualmente."
- ✅ Toast: "Fatura atualizada com sucesso!" (porque Supabase funcionou)

**Verificação:**
- ✅ No Supabase: Dados foram alterados
- ✅ No Sheets: Linha continua não existindo (esperado)
- ✅ User foi AVISADO que algo não bateu certo

---

### Teste 5.3: Múltiplas Edições Rápidas

**Objetivo:** Verificar que proteção contra múltiplas edições funciona

**Passos:**
1. Abre drawer de edição
2. Muda fornecedor para "Teste 1"
3. Clica "Guardar"
4. **IMEDIATAMENTE** (antes do drawer fechar):
5. Muda fornecedor para "Teste 2"
6. Tenta guardar novamente

**Resultado Esperado:**
- ✅ Primeira request é processada
- ✅ Segunda tentativa mostra toast: "Aguarde a atualização anterior terminar"
- ✅ Valor final no Supabase/Sheets: "Teste 1" (primeira edição)

---

## Suite 6: Edge Cases

### Teste 6.1: Validação de Data Inválida

**Objetivo:** Testar validação de inputs

**Passos:**
1. Abre drawer de edição
2. No campo "Data", escreve: "data-invalida"
3. Tenta guardar

**Resultado Esperado:**
- ✅ Toast de erro: "Erros de validação: Data inválida"
- ✅ Drawer não fecha
- ✅ Nenhum request ao Supabase/Sheets

---

### Teste 6.2: Validação de Valores Negativos

**Objetivo:** Testar se valores negativos são rejeitados

**Passos:**
1. Abre drawer de edição
2. No campo "Valor Total", escreve: "-50.00"
3. Tenta guardar

**Resultado Esperado:**
- ✅ Toast de erro: "Erros de validação: Valor total não pode ser negativo"
- ✅ Drawer não fecha
- ✅ Nenhum request ao Supabase/Sheets

---

### Teste 6.3: Validação de Campos Obrigatórios

**Objetivo:** Verificar que fornecedor é obrigatório

**Passos:**
1. Abre drawer de edição
2. Apaga completamente o campo "Fornecedor"
3. Tenta guardar

**Resultado Esperado:**
- ✅ Toast de erro: "Erros de validação: Fornecedor é obrigatório"
- ✅ Drawer não fecha
- ✅ Nenhum request ao Supabase/Sheets

---

### Teste 6.4: Fatura sem doc_number

**Objetivo:** Verificar que busca alternativa funciona

**Passos:**
1. Escolhe uma fatura que não tem `doc_number` (ou apaga manualmente no Supabase)
2. Tenta editar essa fatura
3. Guarda

**Resultado Esperado:**
- ✅ Sistema usa estratégia alternativa (supplier_name + total_amount)
- ✅ Linha encontrada no Sheets mesmo sem doc_number
- ✅ Update bem-sucedido

---

## Checklist de Validação

Marca cada teste como concluído:

### Suite 1: Edição Básica
- [ ] **Teste 1.1:** Editar fornecedor sincroniza
- [ ] **Teste 1.2:** Editar valor monetário funciona
- [ ] **Teste 1.3:** Múltiplos campos são atualizados
- [ ] **Teste 1.4:** Sem mudanças não faz requests

### Suite 2: Mudança de Mês
- [ ] **Teste 2.1:** Mudança de mês move linha entre abas
- [ ] **Teste 2.2:** Dados preservados ao mover

### Suite 3: Mudança de Ano
- [ ] **Teste 3.1:** Mudança de ano move linha e PDF
- [ ] **Teste 3.2:** Mudança de ano com mudança de tipo

### Suite 4: Mudança de Tipo
- [ ] **Teste 4.1:** Mudança de tipo move PDF

### Suite 5: Casos de Erro
- [ ] **Teste 5.1:** Token expirado é tratado
- [ ] **Teste 5.2:** Linha não encontrada é tratada
- [ ] **Teste 5.3:** Múltiplas edições são bloqueadas

### Suite 6: Edge Cases
- [ ] **Teste 6.1:** Data inválida é rejeitada
- [ ] **Teste 6.2:** Valores negativos são rejeitados
- [ ] **Teste 6.3:** Campos obrigatórios são validados
- [ ] **Teste 6.4:** Busca alternativa funciona sem doc_number

---

## 📊 Report de Testes (Template)

```
DATA DO TESTE: [DD/MM/YYYY]
TESTADOR: [Nome]
BROWSER: [Chrome/Firefox/Safari + Versão]

┌─────────────┬─────────┬──────────────────────┐
│ TESTE       │ STATUS  │ NOTAS                │
├─────────────┼─────────┼──────────────────────┤
│ Teste 1.1   │ ✅ PASS │                      │
│ Teste 1.2   │ ✅ PASS │                      │
│ Teste 1.3   │ ✅ PASS │                      │
│ Teste 1.4   │ ✅ PASS │                      │
│ Teste 2.1   │ ✅ PASS │                      │
│ Teste 2.2   │ ✅ PASS │                      │
│ Teste 3.1   │ ✅ PASS │                      │
│ Teste 3.2   │ ✅ PASS │                      │
│ Teste 4.1   │ ✅ PASS │                      │
│ Teste 5.1   │ ⚠️ SKIP │ Requer setup avançado│
│ Teste 5.2   │ ✅ PASS │                      │
│ Teste 5.3   │ ✅ PASS │                      │
│ Teste 6.1   │ ✅ PASS │                      │
│ Teste 6.2   │ ✅ PASS │                      │
│ Teste 6.3   │ ✅ PASS │                      │
│ Teste 6.4   │ ✅ PASS │                      │
└─────────────┴─────────┴──────────────────────┘

BUGS ENCONTRADOS:
- Nenhum

SUGESTÕES:
- [Sugestões de melhoria]
```

---

**BOA SORTE NOS TESTES!** 🚀🧪
