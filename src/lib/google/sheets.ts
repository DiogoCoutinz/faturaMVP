/**
 * GOOGLE SHEETS SERVICE
 * Responsável por escrever dados numa folha de cálculo (Dashboard)
 * 
 * REQUISITOS:
 * - Provider Token do Supabase Auth (OAuth Google)
 * - Scope: https://www.googleapis.com/auth/spreadsheets
 */

import { google } from 'googleapis';

export interface SheetRow {
  [key: string]: string | number | boolean | null;
}

/**
 * Cria cliente do Google Sheets autenticado
 */
export function createSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.sheets({ version: 'v4', auth });
}

/**
 * Escreve uma linha numa folha de cálculo
 * @param accessToken - Token OAuth
 * @param spreadsheetId - ID da folha (encontrado na URL)
 * @param range - Range A1 (ex: "Sheet1!A2:Z2")
 * @param values - Array de valores a escrever
 */
export async function appendRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: Array<string | number | null>
): Promise<void> {
  try {
    const sheets = createSheetsClient(accessToken);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    console.log('✅ Linha adicionada ao Google Sheets');
  } catch (error) {
    console.error('❌ Erro ao escrever no Sheets:', error);
    throw error;
  }
}

/**
 * Escreve múltiplas linhas de uma vez
 * @param accessToken - Token OAuth
 * @param spreadsheetId - ID da folha
 * @param range - Range inicial (ex: "Sheet1!A2")
 * @param rows - Array de arrays com os valores
 */
export async function appendMultipleRows(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rows: Array<Array<string | number | null>>
): Promise<void> {
  try {
    const sheets = createSheetsClient(accessToken);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });

    console.log(`✅ ${rows.length} linhas adicionadas ao Google Sheets`);
  } catch (error) {
    console.error('❌ Erro ao escrever múltiplas linhas:', error);
    throw error;
  }
}

/**
 * Lê valores de uma folha (útil para validação)
 * @param accessToken - Token OAuth
 * @param spreadsheetId - ID da folha
 * @param range - Range A1 (ex: "Sheet1!A1:Z10")
 */
export async function readFromSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<Array<Array<string | number>>> {
  try {
    const sheets = createSheetsClient(accessToken);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return (response.data.values || []) as Array<Array<string | number>>;
  } catch (error) {
    console.error('❌ Erro ao ler do Sheets:', error);
    throw error;
  }
}

/**
 * Atualiza valores específicos (UPDATE em vez de APPEND)
 * @param accessToken - Token OAuth
 * @param spreadsheetId - ID da folha
 * @param range - Range exato (ex: "Sheet1!B5:D5")
 * @param values - Array de valores
 */
export async function updateSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: Array<Array<string | number | null>>
): Promise<void> {
  try {
    const sheets = createSheetsClient(accessToken);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    console.log('✅ Range atualizado no Google Sheets');
  } catch (error) {
    console.error('❌ Erro ao atualizar Sheets:', error);
    throw error;
  }
}

/**
 * Helper: Converte Invoice para row do Google Sheets
 * Formato: [Data, Fornecedor, NIF, Valor, Tipo, Categoria, Link Drive]
 */
export function invoiceToSheetRow(invoice: {
  doc_date: string | null;
  supplier_name: string | null;
  supplier_vat: string | null;
  total_amount: number | null;
  document_type: string | null;
  cost_type: string | null;
  drive_link: string | null;
}): Array<string | number | null> {
  return [
    invoice.doc_date || '',
    invoice.supplier_name || '',
    invoice.supplier_vat || '',
    invoice.total_amount || 0,
    invoice.document_type || '',
    invoice.cost_type || '',
    invoice.drive_link || '',
  ];
}

// TODO (Fase 2 - Automação):
// - Criar sheet automaticamente se não existir
// - Formatar headers (bold, cores)
// - Fórmulas automáticas (SUM, AVERAGE)
// - Validação de dados (evitar duplicados)
