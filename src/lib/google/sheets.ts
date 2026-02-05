/**
 * GOOGLE SHEETS REST API (Browser-Compatible)
 * Usa fetch direto para escrever em Sheets
 */

import { sheetsLimiter } from '@/lib/rateLimiter';

const SHEETS_TIMEOUT_MS = 30_000;

function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeoutId) };
}

export const MONTH_SHEET_NAMES = [
  '01_Janeiro',
  '02_Fevereiro',
  '03_Março',
  '04_Abril',
  '05_Maio',
  '06_Junho',
  '07_Julho',
  '08_Agosto',
  '09_Setembro',
  '10_Outubro',
  '11_Novembro',
  '12_Dezembro',
];

/**
 * Escreve uma fatura no Google Sheets
 */
export async function appendInvoiceToSheet(
  accessToken: string,
  spreadsheetId: string,
  invoiceData: {
    doc_date: string | null;
    supplier_name: string | null;
    supplier_vat: string | null;
    cost_type: string | null;
    doc_number: string | null;
    total_amount: number | null;
    tax_amount?: number | null;
    summary: string | null;
    drive_link: string | null;
  }
): Promise<void> {
  let sheetName = MONTH_SHEET_NAMES[0];

  if (invoiceData.doc_date) {
    try {
      const date = new Date(invoiceData.doc_date);
      if (!isNaN(date.getTime())) {
        const month = date.getMonth();
        if (month >= 0 && month < 12) {
          sheetName = MONTH_SHEET_NAMES[month];
        }
      }
    } catch {
      // Usar fallback
    }
  }

  await ensureSheetHasHeader(accessToken, spreadsheetId, sheetName);

  const row = [
    invoiceData.doc_date || '',
    invoiceData.supplier_name || '',
    invoiceData.supplier_vat || '',
    invoiceData.cost_type || '',
    invoiceData.doc_number || '',
    invoiceData.total_amount || 0,
    invoiceData.tax_amount || 0,
    invoiceData.summary || '',
    invoiceData.drive_link || '',
    new Date().toISOString().split('T')[0],
  ];

  const range = `${sheetName}!A2:J`;

  await sheetsLimiter.waitForSlot();
  const t = createTimeoutSignal(SHEETS_TIMEOUT_MS);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
      signal: t.signal,
    }
  );
  t.clear();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao escrever no Sheets: ${response.status} - ${error}`);
  }
}

/**
 * Escreve uma linha numa folha de cálculo
 */
export async function appendRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: Array<string | number | null>
): Promise<void> {
  await sheetsLimiter.waitForSlot();
  const t1 = createTimeoutSignal(SHEETS_TIMEOUT_MS);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
      signal: t1.signal,
    }
  );
  t1.clear();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao escrever no Sheets: ${response.status} - ${error}`);
  }
}

/**
 * Escreve múltiplas linhas de uma vez
 */
export async function appendMultipleRows(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rows: Array<Array<string | number | null>>
): Promise<void> {
  await sheetsLimiter.waitForSlot();
  const t2 = createTimeoutSignal(SHEETS_TIMEOUT_MS);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
      signal: t2.signal,
    }
  );
  t2.clear();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao escrever múltiplas linhas: ${response.status} - ${error}`);
  }
}

/**
 * Converte Invoice para row do Google Sheets
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

/**
 * Lê a estrutura do Template
 */
export async function getTemplateStructure(
  accessToken: string,
  templateId: string
): Promise<{ headers: string[]; sheets: string[] } | null> {
  try {
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${templateId}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metadataResponse.ok) {
      return null;
    }

    const metadata = await metadataResponse.json();
    const sheets = metadata.sheets.map((s: any) => s.properties.title);

    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${templateId}/values/${sheets[0]}!A1:K1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (headersResponse.ok) {
      const headersData = await headersResponse.json();
      const headers = headersData.values?.[0] || [];
      return { headers, sheets };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica se uma aba tem cabeçalho e adiciona se não tiver
 */
export async function ensureSheetHasHeader(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const HEADERS = [
    'Data Doc.', 'Fornecedor', 'NIF Fornecedor', 'Tipo Custo',
    'Nº Documento', 'Valor Total (€)', 'IVA (€)', 'Resumo',
    'Link PDF', 'Data Processamento'
  ];

  try {
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      return;
    }

    const metaData = await metaResponse.json();
    const sheetExists = metaData.sheets?.some((s: { properties: { title: string } }) => s.properties.title === sheetName);

    if (!sheetExists) {
      const createResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: sheetName }
              }
            }]
          }),
        }
      );

      if (!createResponse.ok) {
        return;
      }
    }

    const checkResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A1:J1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!checkResponse.ok) {
      return;
    }

    const checkData = await checkResponse.json();
    const existingRow = checkData.values?.[0] || [];

    if (existingRow.length === 0 || existingRow[0] !== 'Data Doc.') {
      const metaResponse2 = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const metaData2 = await metaResponse2.json();
      const sheet = metaData2.sheets?.find((s: any) => s.properties.title === sheetName);

      if (!sheet) return;

      const sheetId = sheet.properties.sheetId;

      if (existingRow.length > 0) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [{
                insertDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: 0,
                    endIndex: 1
                  },
                  inheritFromBefore: false
                }
              }]
            }),
          }
        );
      }

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              updateCells: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: HEADERS.length
                },
                rows: [{
                  values: HEADERS.map(header => ({
                    userEnteredValue: { stringValue: header },
                    userEnteredFormat: {
                      backgroundColor: { red: 0.71, green: 0.82, blue: 0.93 },
                      textFormat: { bold: true, fontSize: 10 },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE'
                    }
                  }))
                }],
                fields: 'userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
              }
            }, {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  gridProperties: { frozenRowCount: 1 }
                },
                fields: 'gridProperties.frozenRowCount'
              }
            }]
          }),
        }
      );
    }
  } catch {
    // Silently fail
  }
}

/**
 * Escreve os cabeçalhos e aplica formatação em todas as abas
 */
export async function setupSpreadsheetHeaders(
  accessToken: string,
  spreadsheetId: string,
  headers: string[]
): Promise<void> {
  try {
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const metadata = await metadataResponse.json();
    const sheets = metadata.sheets || [];

    const requests: any[] = [];

    sheets.forEach((sheet: any) => {
      const sheetId = sheet.properties.sheetId;

      requests.push({
        updateCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: headers.length
          },
          rows: [{
            values: headers.map(header => ({
              userEnteredValue: { stringValue: header },
              userEnteredFormat: {
                backgroundColor: { red: 0.71, green: 0.82, blue: 0.93 },
                textFormat: { bold: true, fontSize: 10 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE'
              }
            }))
          }],
          fields: 'userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
        }
      });

      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      });

      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: headers.length
          },
          properties: { pixelSize: 120 },
          fields: 'pixelSize'
        }
      });

      const columnWidths = [
        { idx: 0, size: 90 },
        { idx: 1, size: 200 },
        { idx: 7, size: 250 },
        { idx: 8, size: 300 },
      ];

      columnWidths.forEach(w => {
        requests.push({
          updateDimensionProperties: {
            range: {
              sheetId: sheetId,
              dimension: 'COLUMNS',
              startIndex: w.idx,
              endIndex: w.idx + 1
            },
            properties: { pixelSize: w.size },
            fields: 'pixelSize'
          }
        });
      });
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );
  } catch {
    // Silently fail
  }
}
