/**
 * FASE 4: EDIÇÃO BIDIRECIONAL - SHEETS UPDATER
 * Responsável por localizar e atualizar linhas no Google Sheets
 */

import { ensureSheetHasHeader } from '@/lib/google/sheets';

interface InvoiceSearchCriteria {
  doc_number?: string | null;
  supplier_name?: string | null;
  total_amount?: number | null;
  doc_date?: string | null;
}

/**
 * Mapeamento de campos para colunas do Sheets
 * Baseado na estrutura definida na Fase 2B
 */
const COLUMN_MAP = {
  doc_date: 0,        // A
  supplier_name: 1,   // B
  supplier_vat: 2,    // C
  cost_type: 3,       // D
  doc_number: 4,      // E
  total_amount: 5,    // F
  tax_amount: 6,      // G
  summary: 7,         // H
  drive_link: 8,      // I
  processed_date: 9   // J
} as const;

/**
 * Converte índice de coluna para letra (0 = A, 1 = B, ..., 25 = Z, 26 = AA, etc.)
 */
function columnIndexToLetter(index: number): string {
  let letter = '';
  let num = index + 1; // Converter para 1-indexed

  while (num > 0) {
    num--; // Ajustar para 0-indexed internamente
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26);
  }

  return letter;
}

/**
 * FASE 4: Localiza o índice de uma fatura no Google Sheets
 * Retorna o número da linha (1-indexed) ou null se não encontrar
 */
export async function findInvoiceRowIndex(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  criteria: InvoiceSearchCriteria
): Promise<number | null> {
  console.log('🟡 ========== FIND INVOICE ROW INDEX ==========');
  console.log(`🟡 Procurando fatura em ${sheetName}...`);
  console.log(`🟡 Spreadsheet ID: ${spreadsheetId}`);
  console.log(`🟡 Critérios:`, JSON.stringify(criteria, null, 2));
  
  try {
    // Ler todas as linhas da aba (exceto cabeçalho)
    // Usar aspas no nome da aba para lidar com caracteres especiais
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A2:K1000`;
    console.log(`   📡 URL do pedido: ${url}`);
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log(`   📡 Status da resposta: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`   ⚠️ Erro ao ler aba ${sheetName}: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      console.log('   ⚠️ Aba vazia ou sem dados');
      return null;
    }

    console.log(`   📊 Total de linhas encontradas: ${rows.length}`);
    console.log(`   📄 Exemplo de linha 1:`, rows[0]);

    // ESTRATÉGIA 1: Match por doc_number (mais confiável)
    if (criteria.doc_number) {
      const searchDocNum = criteria.doc_number?.toString().trim();
      console.log(`   🔎 ESTRATÉGIA 1: Procurando por doc_number: "${searchDocNum}"`);
      console.log(`   📍 Índice da coluna doc_number: ${COLUMN_MAP.doc_number} (E)`);
      
      const rowIndex = rows.findIndex((row, idx) => {
        const docNum = row[COLUMN_MAP.doc_number]?.toString().trim();
        const match = docNum === searchDocNum;
        
        // Log TODAS as linhas para debug TOTAL
        console.log(`      📄 Linha ${idx + 2}: doc_number="${docNum}" | Match? ${match ? '✅ SIM!' : '❌'}`);
        
        return match;
      });

      if (rowIndex !== -1) {
        const actualRow = rowIndex + 2; // +2 porque começa em A2
        console.log(`🟡 🎉 SUCESSO! Encontrado por doc_number na linha ${actualRow}`);
        console.log(`🟡 📄 Conteúdo completo da linha:`, rows[rowIndex]);
        console.log('🟡 ===========================================');
        return actualRow;
      } else {
        console.warn(`🟡 ❌ FALHOU! Nenhuma linha tem doc_number = "${searchDocNum}"`);
      }
    } else {
      console.log(`   ⚠️ SKIP Estratégia 1: doc_number não fornecido`);
    }

    // ESTRATÉGIA 2: Match por supplier_name + total_amount
    if (criteria.supplier_name && criteria.total_amount !== null && criteria.total_amount !== undefined) {
      console.log(`   🔎 Procurando por supplier="${criteria.supplier_name}" + amount=${criteria.total_amount}`);
      
      const rowIndex = rows.findIndex((row, idx) => {
        const supplier = row[COLUMN_MAP.supplier_name]?.toString().trim().toLowerCase();
        const amount = parseFloat(row[COLUMN_MAP.total_amount]?.toString() || '0');
        
        const supplierMatch = supplier === criteria.supplier_name?.toString().trim().toLowerCase();
        const amountMatch = Math.abs(amount - (criteria.total_amount || 0)) < 0.01; // Tolerância de 1 cêntimo
        
        // Log detalhado para debug
        if (idx < 5) {
          console.log(`      Linha ${idx + 2}: supplier="${supplier}" amount=${amount} ${supplierMatch && amountMatch ? '✅ MATCH!' : '❌'}`);
        }
        
        return supplierMatch && amountMatch;
      });

      if (rowIndex !== -1) {
        const actualRow = rowIndex + 2;
        console.log(`   ✅ Encontrado por supplier+amount na linha ${actualRow}`);
        return actualRow;
      } else {
        console.warn(`   ⚠️ Nenhuma linha encontrada com supplier="${criteria.supplier_name}" e amount=${criteria.total_amount}`);
      }
    }

    // ESTRATÉGIA 3: Match por supplier_name + doc_date (menos confiável)
    if (criteria.supplier_name && criteria.doc_date) {
      const rowIndex = rows.findIndex(row => {
        const supplier = row[COLUMN_MAP.supplier_name]?.toString().trim().toLowerCase();
        const date = row[COLUMN_MAP.doc_date]?.toString().trim();
        
        const supplierMatch = supplier === criteria.supplier_name?.toString().trim().toLowerCase();
        const dateMatch = date === criteria.doc_date?.toString().trim();
        
        return supplierMatch && dateMatch;
      });

      if (rowIndex !== -1) {
        const actualRow = rowIndex + 2;
        console.log(`   ✅ Encontrado por supplier+date na linha ${actualRow}`);
        return actualRow;
      }
    }

    console.warn('🟡 ⚠️ Fatura não encontrada no Sheets');
    console.log('🟡 ===========================================');
    return null;
  } catch (error) {
    console.error('🟡 ❌ ERRO ao procurar fatura:', error);
    console.log('🟡 ===========================================');
    return null;
  }
}

/**
 * FASE 4: Atualiza uma célula específica no Google Sheets
 */
export async function updateSheetCell(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  columnIndex: number,
  value: string | number | null
): Promise<boolean> {
  const columnLetter = columnIndexToLetter(columnIndex);
  const range = `${sheetName}!${columnLetter}${rowIndex}`;
  
  console.log(`📝 Atualizando célula ${range} → "${value}"`);

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[value ?? '']],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`   ❌ Erro ao atualizar célula: ${response.status} - ${error}`);
      return false;
    }

    console.log('   ✅ Célula atualizada');
    return true;
  } catch (error) {
    console.error('   ❌ Erro ao atualizar célula:', error);
    return false;
  }
}

/**
 * FASE 4: Atualiza múltiplas células de uma vez (mais eficiente)
 */
export async function updateSheetCells(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  updates: Record<string, string | number | null>
): Promise<boolean> {
  console.log('🟡 ========== UPDATE SHEET CELLS ==========');
  console.log(`🟡 Atualizando ${Object.keys(updates).length} células na linha ${rowIndex}`);
  console.log(`🟡 Spreadsheet ID: ${spreadsheetId}`);
  console.log(`🟡 Aba: ${sheetName}`);
  console.log(`🟡 Campos a atualizar:`, Object.keys(updates));
  console.log(`🟡 Valores:`, updates);

  try {
    // Garantir que a aba existe antes de tentar atualizar
    await ensureSheetHasHeader(accessToken, spreadsheetId, sheetName);

    // Preparar batch update
    const data = Object.entries(updates).map(([field, value]) => {
      const columnIndex = COLUMN_MAP[field as keyof typeof COLUMN_MAP];
      if (columnIndex === undefined) {
        console.warn(`      ⚠️ Campo desconhecido: ${field} (não está no COLUMN_MAP)`);
        console.warn(`      📋 COLUMN_MAP disponível:`, Object.keys(COLUMN_MAP));
        return null;
      }
      const columnLetter = columnIndexToLetter(columnIndex);

      // Converter valor para string/number apropriado (nunca null/undefined)
      let cellValue: string | number;
      if (value === null || value === undefined) {
        cellValue = '';
      } else if (typeof value === 'number') {
        cellValue = value;
      } else {
        cellValue = String(value);
      }

      console.log(`      ✅ ${field} → coluna ${columnLetter}${rowIndex} = "${cellValue}"`);

      return {
        range: `'${sheetName}'!${columnLetter}${rowIndex}`,
        values: [[cellValue]],
      };
    }).filter(Boolean) as Array<{ range: string; values: Array<Array<string | number>> }>;

    if (data.length === 0) {
      console.warn('   ⚠️ Nenhum campo válido para atualizar');
      return false;
    }

    console.log(`🟡 📤 Enviando batch update com ${data.length} células...`);
    console.log(`🟡 📋 Payload completo:`, JSON.stringify({ valueInputOption: 'USER_ENTERED', data }, null, 2));

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Erro ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
        console.error(`   ❌ Erro detalhado:`, errorJson);
      } catch {
        console.error(`   ❌ Erro ao atualizar células: ${response.status} - ${errorText}`);
      }
      console.error(`   ❌ Erro ao atualizar células: ${response.status} - ${errorMessage}`);
      return false;
    }

    const result = await response.json();
    console.log(`🟡 ✅ SUCESSO! ${result.totalUpdatedCells} células atualizadas`);
    console.log('🟡 ===========================================');
    return true;
  } catch (error) {
    console.error('🟡 ❌ ERRO ao atualizar células:', error);
    console.error('🟡 Tipo:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('🟡 Mensagem:', error instanceof Error ? error.message : String(error));
    console.log('🟡 ===========================================');
    return false;
  }
}

/**
 * FASE 4: Determina a aba (mês) baseada na data da fatura
 */
export function getSheetNameFromDate(docDate: string | null): string {
  if (!docDate) return '01_Janeiro'; // Fallback

  const MONTH_NAMES = [
    '01_Janeiro', '02_Fevereiro', '03_Março', '04_Abril',
    '05_Maio', '06_Junho', '07_Julho', '08_Agosto',
    '09_Setembro', '10_Outubro', '11_Novembro', '12_Dezembro'
  ];

  try {
    const date = new Date(docDate);
    const month = date.getMonth(); // 0-11
    return MONTH_NAMES[month] || '01_Janeiro';
  } catch {
    return '01_Janeiro';
  }
}

/**
 * FASE 5: Move uma linha entre abas do mesmo spreadsheet (mudança de mês)
 * Lê a linha completa da aba antiga, apaga e adiciona na nova aba
 */
export async function moveRowBetweenSheets(
  accessToken: string,
  spreadsheetId: string,
  oldSheetName: string,
  newSheetName: string,
  rowIndex: number,
  invoiceData: Record<string, string | number | null>
): Promise<boolean> {
  console.log(`🔄 Movendo linha ${rowIndex} de ${oldSheetName} para ${newSheetName}...`);

  try {
    // PASSO 1: Ler linha completa da aba antiga
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${oldSheetName}'!A${rowIndex}:J${rowIndex}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!readResponse.ok) {
      const error = await readResponse.text();
      console.error(`   ❌ Erro ao ler linha: ${readResponse.status} - ${error}`);
      return false;
    }

    const readData = await readResponse.json();
    const rowData = readData.values?.[0] || [];

    if (rowData.length === 0) {
      console.warn(`   ⚠️ Linha ${rowIndex} está vazia ou não existe`);
      return false;
    }

    console.log(`   ✅ Linha lida: ${rowData.length} células`);

    // PASSO 2: Garantir que nova aba existe
    await ensureSheetHasHeader(accessToken, spreadsheetId, newSheetName);

    // PASSO 3: Obter sheetId numérico da aba antiga para poder apagar
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      console.error(`   ❌ Erro ao obter metadata: ${metaResponse.status}`);
      return false;
    }

    const metaData = await metaResponse.json();
    const oldSheet = metaData.sheets?.find((s: any) => s.properties.title === oldSheetName);
    
    if (!oldSheet) {
      console.error(`   ❌ Aba ${oldSheetName} não encontrada`);
      return false;
    }

    const oldSheetId = oldSheet.properties.sheetId;
    const actualRowIndex = rowIndex - 1; // Converter para 0-indexed para deleteDimension

    // PASSO 4: Apagar linha da aba antiga usando deleteDimension
    console.log(`   🗑️ Apagando linha ${rowIndex} da aba ${oldSheetName}...`);
    const deleteResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: oldSheetId,
                dimension: 'ROWS',
                startIndex: actualRowIndex,
                endIndex: actualRowIndex + 1,
              },
            },
          }],
        }),
      }
    );

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      console.error(`   ❌ Erro ao apagar linha: ${deleteResponse.status} - ${error}`);
      return false;
    }

    console.log(`   ✅ Linha apagada da aba ${oldSheetName}`);

    // PASSO 5: Adicionar linha na nova aba usando appendInvoiceToSheet
    // Precisamos converter os dados da linha para o formato esperado por appendInvoiceToSheet
    const { appendInvoiceToSheet } = await import('@/lib/google/sheets');
    
    await appendInvoiceToSheet(accessToken, spreadsheetId, {
      doc_date: invoiceData.doc_date as string || rowData[COLUMN_MAP.doc_date] || null,
      supplier_name: invoiceData.supplier_name as string || rowData[COLUMN_MAP.supplier_name] || null,
      supplier_vat: invoiceData.supplier_vat as string || rowData[COLUMN_MAP.supplier_vat] || null,
      cost_type: invoiceData.cost_type as string || rowData[COLUMN_MAP.cost_type] || null,
      doc_number: invoiceData.doc_number as string || rowData[COLUMN_MAP.doc_number] || null,
      total_amount: invoiceData.total_amount as number ?? (rowData[COLUMN_MAP.total_amount] ? parseFloat(rowData[COLUMN_MAP.total_amount]) : null),
      tax_amount: invoiceData.tax_amount as number ?? (rowData[COLUMN_MAP.tax_amount] ? parseFloat(rowData[COLUMN_MAP.tax_amount]) : null),
      summary: invoiceData.summary as string || rowData[COLUMN_MAP.summary] || null,
      drive_link: invoiceData.drive_link as string || rowData[COLUMN_MAP.drive_link] || null,
    });

    console.log(`   ✅ Linha adicionada na aba ${newSheetName}`);
    return true;
  } catch (error) {
    console.error('   ❌ Erro ao mover linha entre abas:', error);
    return false;
  }
}

/**
 * FASE 5: Move uma linha entre spreadsheets diferentes (mudança de ano)
 * Lê a linha completa do spreadsheet antigo, apaga e adiciona no novo
 */
export async function moveRowBetweenSpreadsheets(
  accessToken: string,
  oldSpreadsheetId: string,
  newSpreadsheetId: string,
  oldSheetName: string,
  newSheetName: string,
  rowIndex: number,
  invoiceData: Record<string, string | number | null>
): Promise<boolean> {
  console.log(`🔄 Movendo linha ${rowIndex} de ${oldSpreadsheetId} (${oldSheetName}) para ${newSpreadsheetId} (${newSheetName})...`);

  try {
    // PASSO 1: Ler linha completa do spreadsheet antigo
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${oldSpreadsheetId}/values/'${oldSheetName}'!A${rowIndex}:J${rowIndex}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!readResponse.ok) {
      const error = await readResponse.text();
      console.error(`   ❌ Erro ao ler linha: ${readResponse.status} - ${error}`);
      return false;
    }

    const readData = await readResponse.json();
    const rowData = readData.values?.[0] || [];

    if (rowData.length === 0) {
      console.warn(`   ⚠️ Linha ${rowIndex} está vazia ou não existe`);
      return false;
    }

    console.log(`   ✅ Linha lida: ${rowData.length} células`);

    // PASSO 2: Garantir que nova aba existe no novo spreadsheet
    await ensureSheetHasHeader(accessToken, newSpreadsheetId, newSheetName);

    // PASSO 3: Obter sheetId numérico da aba antiga para poder apagar
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${oldSpreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      console.error(`   ❌ Erro ao obter metadata: ${metaResponse.status}`);
      return false;
    }

    const metaData = await metaResponse.json();
    const oldSheet = metaData.sheets?.find((s: any) => s.properties.title === oldSheetName);
    
    if (!oldSheet) {
      console.error(`   ❌ Aba ${oldSheetName} não encontrada no spreadsheet antigo`);
      return false;
    }

    const oldSheetId = oldSheet.properties.sheetId;
    const actualRowIndex = rowIndex - 1; // Converter para 0-indexed para deleteDimension

    // PASSO 4: Apagar linha do spreadsheet antigo
    console.log(`   🗑️ Apagando linha ${rowIndex} do spreadsheet antigo...`);
    const deleteResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${oldSpreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: oldSheetId,
                dimension: 'ROWS',
                startIndex: actualRowIndex,
                endIndex: actualRowIndex + 1,
              },
            },
          }],
        }),
      }
    );

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      console.error(`   ❌ Erro ao apagar linha: ${deleteResponse.status} - ${error}`);
      return false;
    }

    console.log(`   ✅ Linha apagada do spreadsheet antigo`);

    // PASSO 5: Adicionar linha no novo spreadsheet
    const { appendInvoiceToSheet } = await import('@/lib/google/sheets');
    
    await appendInvoiceToSheet(accessToken, newSpreadsheetId, {
      doc_date: invoiceData.doc_date as string || rowData[COLUMN_MAP.doc_date] || null,
      supplier_name: invoiceData.supplier_name as string || rowData[COLUMN_MAP.supplier_name] || null,
      supplier_vat: invoiceData.supplier_vat as string || rowData[COLUMN_MAP.supplier_vat] || null,
      cost_type: invoiceData.cost_type as string || rowData[COLUMN_MAP.cost_type] || null,
      doc_number: invoiceData.doc_number as string || rowData[COLUMN_MAP.doc_number] || null,
      total_amount: invoiceData.total_amount as number ?? (rowData[COLUMN_MAP.total_amount] ? parseFloat(rowData[COLUMN_MAP.total_amount]) : null),
      tax_amount: invoiceData.tax_amount as number ?? (rowData[COLUMN_MAP.tax_amount] ? parseFloat(rowData[COLUMN_MAP.tax_amount]) : null),
      summary: invoiceData.summary as string || rowData[COLUMN_MAP.summary] || null,
      drive_link: invoiceData.drive_link as string || rowData[COLUMN_MAP.drive_link] || null,
    });

    console.log(`   ✅ Linha adicionada no novo spreadsheet`);
    return true;
  } catch (error) {
    console.error('   ❌ Erro ao mover linha entre spreadsheets:', error);
    return false;
  }
}

export { COLUMN_MAP };
