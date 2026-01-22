/**
 * GOOGLE SHEETS REST API (Browser-Compatible)
 * Usa fetch direto para escrever em Sheets
 * Docs: https://developers.google.com/sheets/api/reference/rest
 */

// Mapeamento de mês para nome de aba
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
 * FASE 2B: Escreve uma fatura no Google Sheets
 * Formato: [Data, Fornecedor, NIF, Tipo, Nº Doc, Valor, IVA, Resumo, Link, Data Processamento]
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
  try {
    // Determinar a aba (mês) com base na doc_date
    let sheetName = MONTH_SHEET_NAMES[0]; // Fallback: 01_Janeiro

    if (invoiceData.doc_date) {
      try {
        const date = new Date(invoiceData.doc_date);
        if (!isNaN(date.getTime())) {
          const month = date.getMonth(); // 0-11
          if (month >= 0 && month < 12) {
            sheetName = MONTH_SHEET_NAMES[month];
          }
        }
      } catch {
        // Usar fallback se data inválida
      }
    }

    console.log(`📊 Escrevendo no Google Sheets (aba: ${sheetName})...`);

    // Garantir que a aba tem cabeçalho antes de adicionar dados
    await ensureSheetHasHeader(accessToken, spreadsheetId, sheetName);

    // Preparar linha de dados (ordem estrita)
    const row = [
      invoiceData.doc_date || '',                     // [A] Data
      invoiceData.supplier_name || '',                // [B] Fornecedor
      invoiceData.supplier_vat || '',                 // [C] NIF
      invoiceData.cost_type || '',                    // [D] Tipo Custo
      invoiceData.doc_number || '',                   // [E] Nº Doc
      invoiceData.total_amount || 0,                  // [F] Valor
      invoiceData.tax_amount || 0,                    // [G] IVA
      invoiceData.summary || '',                      // [H] Resumo
      invoiceData.drive_link || '',                   // [I] Link PDF
      new Date().toISOString().split('T')[0],         // [J] Data Processamento (hoje)
    ];

    // Range: Adiciona a partir da linha 2 (linha 1 é o cabeçalho)
    const range = `${sheetName}!A2:J`;

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro ao escrever no Sheets: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Linha adicionada ao Sheets: ${result.updates?.updatedRange}`);
  } catch (error) {
    console.error('❌ Erro ao escrever no Google Sheets:', error);
    throw error;
  }
}

/**
 * Escreve uma linha numa folha de cálculo (append genérico)
 */
export async function appendRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: Array<string | number | null>
): Promise<void> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [values],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao escrever no Sheets: ${response.status} - ${error}`);
  }

  console.log('✅ Linha adicionada ao Google Sheets');
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
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao escrever múltiplas linhas: ${response.status} - ${error}`);
  }

  console.log(`✅ ${rows.length} linhas adicionadas ao Google Sheets`);
}

/**
 * Helper: Converte Invoice para row do Google Sheets
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
 * FASE 3: Lê a estrutura do Template (cabeçalhos) para replicar
 */
export async function getTemplateStructure(
  accessToken: string,
  templateId: string
): Promise<{ headers: string[]; sheets: string[] } | null> {
  console.log('📖 Lendo estrutura do Template...');
  
  try {
    // Ler as abas do Template
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${templateId}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metadataResponse.ok) {
      console.warn('   ⚠️ Template não acessível para leitura');
      return null;
    }

    const metadata = await metadataResponse.json();
    const sheets = metadata.sheets.map((s: any) => s.properties.title);

    // Ler os cabeçalhos da primeira aba
    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${templateId}/values/${sheets[0]}!A1:K1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (headersResponse.ok) {
      const headersData = await headersResponse.json();
      const headers = headersData.values?.[0] || [];
      console.log(`   ✅ Template lido: ${sheets.length} abas, ${headers.length} colunas`);
      return { headers, sheets };
    }

    return null;
  } catch (error) {
    console.warn('   ⚠️ Erro ao ler Template:', error);
    return null;
  }
}

/**
 * Verifica se uma aba tem cabeçalho e adiciona se não tiver
 * Cria a aba se não existir
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
    // Primeiro verificar se a aba existe
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      console.warn(`⚠️ Não foi possível verificar spreadsheet ${spreadsheetId}`);
      return;
    }

    const metaData = await metaResponse.json();
    const sheetExists = metaData.sheets?.some((s: { properties: { title: string } }) => s.properties.title === sheetName);

    // Se a aba não existe, criar
    if (!sheetExists) {
      console.log(`📝 Criando aba ${sheetName}...`);
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
        const error = await createResponse.text();
        console.error(`❌ Erro ao criar aba ${sheetName}: ${error}`);
        return;
      }
      console.log(`   ✅ Aba ${sheetName} criada`);
    }

    // Verificar se a linha 1 tem conteúdo
    const checkResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A1:J1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!checkResponse.ok) {
      console.warn(`⚠️ Não foi possível verificar cabeçalho na aba ${sheetName}`);
      return;
    }

    const checkData = await checkResponse.json();
    const existingRow = checkData.values?.[0] || [];

    // Se a linha 1 está vazia ou o primeiro valor não é "Data Doc.", adicionar cabeçalho
    if (existingRow.length === 0 || existingRow[0] !== 'Data Doc.') {
      console.log(`📝 Adicionando cabeçalho à aba ${sheetName}...`);

      // Obter o sheetId numérico
      const metaResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const metaData = await metaResponse.json();
      const sheet = metaData.sheets?.find((s: any) => s.properties.title === sheetName);

      if (!sheet) return;

      const sheetId = sheet.properties.sheetId;

      // Se já tem dados na linha 1, inserir nova linha no topo
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

      // Escrever cabeçalho com formatação azul
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
                      backgroundColor: { red: 0.71, green: 0.82, blue: 0.93 }, // Azul claro
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

      console.log(`   ✅ Cabeçalho adicionado à aba ${sheetName}`);
    }
  } catch (error) {
    console.warn(`⚠️ Erro ao verificar/adicionar cabeçalho:`, error);
  }
}

/**
 * FASE 3: Escreve os cabeçalhos e aplica formatação profissional em todas as abas
 */
export async function setupSpreadsheetHeaders(
  accessToken: string,
  spreadsheetId: string,
  headers: string[]
): Promise<void> {
  console.log('📝 Configurando cabeçalhos e formatação em todas as abas...');

  try {
    // 1. Obter os sheetIds para poder aplicar formatação (que exige ID numérico)
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const metadata = await metadataResponse.json();
    const sheets = metadata.sheets || [];

    const requests: any[] = [];

    sheets.forEach((sheet: any) => {
      const sheetId = sheet.properties.sheetId;
      const sheetName = sheet.properties.title;

      // Request 1: Definir valores do cabeçalho
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
                backgroundColor: { red: 0.71, green: 0.82, blue: 0.93 }, // Azul suave
                textFormat: { bold: true, fontSize: 10 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE'
              }
            }))
          }],
          fields: 'userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
        }
      });

      // Request 2: Congelar a primeira linha
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      });

      // Request 3: Ajustar largura das colunas (formato correto: startIndex/endIndex)
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
      
      // Ajustes específicos de largura
      const columnWidths = [
        { idx: 0, size: 90 },  // Data
        { idx: 1, size: 200 }, // Fornecedor
        { idx: 7, size: 250 }, // Resumo
        { idx: 8, size: 300 }, // Link PDF
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

    // Enviar todos os requests num único batch
    const response = await fetch(
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

    if (response.ok) {
      console.log('   ✅ Cabeçalhos e formatação aplicados com sucesso!');
    } else {
      const errText = await response.text();
      console.warn('   ⚠️ Erro ao aplicar formatação:', errText);
    }
  } catch (error) {
    console.error('   ❌ Erro catastrófico ao configurar Sheet:', error);
  }
}
