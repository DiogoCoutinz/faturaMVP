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
  let num = index + 1;

  while (num > 0) {
    num--;
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
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A2:K1000`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      return null;
    }

    // ESTRATÉGIA 1: Match por doc_number (mais confiável)
    if (criteria.doc_number) {
      const searchDocNum = criteria.doc_number?.toString().trim();

      const rowIndex = rows.findIndex((row: string[]) => {
        const docNum = row[COLUMN_MAP.doc_number]?.toString().trim();
        return docNum === searchDocNum;
      });

      if (rowIndex !== -1) {
        return rowIndex + 2;
      }
    }

    // ESTRATÉGIA 2: Match por supplier_name + total_amount
    if (criteria.supplier_name && criteria.total_amount !== null && criteria.total_amount !== undefined) {
      const rowIndex = rows.findIndex((row: string[]) => {
        const supplier = row[COLUMN_MAP.supplier_name]?.toString().trim().toLowerCase();
        const amount = parseFloat(row[COLUMN_MAP.total_amount]?.toString() || '0');

        const supplierMatch = supplier === criteria.supplier_name?.toString().trim().toLowerCase();
        const amountMatch = Math.abs(amount - (criteria.total_amount || 0)) < 0.01;

        return supplierMatch && amountMatch;
      });

      if (rowIndex !== -1) {
        return rowIndex + 2;
      }
    }

    // ESTRATÉGIA 3: Match por supplier_name + doc_date
    if (criteria.supplier_name && criteria.doc_date) {
      const rowIndex = rows.findIndex((row: string[]) => {
        const supplier = row[COLUMN_MAP.supplier_name]?.toString().trim().toLowerCase();
        const date = row[COLUMN_MAP.doc_date]?.toString().trim();

        const supplierMatch = supplier === criteria.supplier_name?.toString().trim().toLowerCase();
        const dateMatch = date === criteria.doc_date?.toString().trim();

        return supplierMatch && dateMatch;
      });

      if (rowIndex !== -1) {
        return rowIndex + 2;
      }
    }

    return null;
  } catch {
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

    return response.ok;
  } catch {
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
  try {
    await ensureSheetHasHeader(accessToken, spreadsheetId, sheetName);

    const data = Object.entries(updates).map(([field, value]) => {
      const columnIndex = COLUMN_MAP[field as keyof typeof COLUMN_MAP];
      if (columnIndex === undefined) {
        return null;
      }
      const columnLetter = columnIndexToLetter(columnIndex);

      let cellValue: string | number;
      if (value === null || value === undefined) {
        cellValue = '';
      } else if (typeof value === 'number') {
        cellValue = value;
      } else {
        cellValue = String(value);
      }

      return {
        range: `'${sheetName}'!${columnLetter}${rowIndex}`,
        values: [[cellValue]],
      };
    }).filter(Boolean) as Array<{ range: string; values: Array<Array<string | number>> }>;

    if (data.length === 0) {
      return false;
    }

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

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * FASE 4: Determina a aba (mês) baseada na data da fatura
 */
export function getSheetNameFromDate(docDate: string | null): string {
  if (!docDate) return '01_Janeiro';

  const MONTH_NAMES = [
    '01_Janeiro', '02_Fevereiro', '03_Março', '04_Abril',
    '05_Maio', '06_Junho', '07_Julho', '08_Agosto',
    '09_Setembro', '10_Outubro', '11_Novembro', '12_Dezembro'
  ];

  try {
    const date = new Date(docDate);
    const month = date.getMonth();
    return MONTH_NAMES[month] || '01_Janeiro';
  } catch {
    return '01_Janeiro';
  }
}

/**
 * FASE 5: Move uma linha entre abas do mesmo spreadsheet (mudança de mês)
 */
export async function moveRowBetweenSheets(
  accessToken: string,
  spreadsheetId: string,
  oldSheetName: string,
  newSheetName: string,
  rowIndex: number,
  invoiceData: Record<string, string | number | null>
): Promise<boolean> {
  try {
    // PASSO 1: Ler linha completa da aba antiga
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${oldSheetName}'!A${rowIndex}:J${rowIndex}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!readResponse.ok) {
      return false;
    }

    const readData = await readResponse.json();
    const rowData = readData.values?.[0] || [];

    if (rowData.length === 0) {
      return false;
    }

    // PASSO 2: Garantir que nova aba existe
    await ensureSheetHasHeader(accessToken, spreadsheetId, newSheetName);

    // PASSO 3: Obter sheetId numérico da aba antiga
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      return false;
    }

    const metaData = await metaResponse.json();
    const oldSheet = metaData.sheets?.find((s: { properties: { title: string } }) => s.properties.title === oldSheetName);

    if (!oldSheet) {
      return false;
    }

    const oldSheetId = oldSheet.properties.sheetId;
    const actualRowIndex = rowIndex - 1;

    // PASSO 4: Apagar linha da aba antiga
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
      return false;
    }

    // PASSO 5: Adicionar linha na nova aba
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

    return true;
  } catch {
    return false;
  }
}

/**
 * FASE 5: Move uma linha entre spreadsheets diferentes (mudança de ano)
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
  try {
    // PASSO 1: Ler linha completa do spreadsheet antigo
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${oldSpreadsheetId}/values/'${oldSheetName}'!A${rowIndex}:J${rowIndex}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!readResponse.ok) {
      return false;
    }

    const readData = await readResponse.json();
    const rowData = readData.values?.[0] || [];

    if (rowData.length === 0) {
      return false;
    }

    // PASSO 2: Garantir que nova aba existe no novo spreadsheet
    await ensureSheetHasHeader(accessToken, newSpreadsheetId, newSheetName);

    // PASSO 3: Obter sheetId numérico da aba antiga
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${oldSpreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      return false;
    }

    const metaData = await metaResponse.json();
    const oldSheet = metaData.sheets?.find((s: { properties: { title: string } }) => s.properties.title === oldSheetName);

    if (!oldSheet) {
      return false;
    }

    const oldSheetId = oldSheet.properties.sheetId;
    const actualRowIndex = rowIndex - 1;

    // PASSO 4: Apagar linha do spreadsheet antigo
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
      return false;
    }

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

    return true;
  } catch {
    return false;
  }
}

export { COLUMN_MAP };
