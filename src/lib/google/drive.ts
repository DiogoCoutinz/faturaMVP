/**
 * GOOGLE DRIVE REST API (Browser-Compatible)
 * FASE 3: Arquitetura de pastas hierárquica
 * Docs: https://developers.google.com/drive/api/v3/reference
 */

/**
 * FASE 3: Encontra ou cria uma pasta (com parent opcional)
 */
export async function ensureFolder(
  accessToken: string,
  folderName: string,
  parentId: string | null = null
): Promise<string> {
  if (!accessToken) {
    throw new Error('Token de acesso não fornecido para criar pasta');
  }

  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`Erro ao procurar pasta: ${searchResponse.status} - ${errorText}`);
  }

  const searchData = await searchResponse.json();

  if (searchData.error) {
    throw new Error(`Erro da API Google: ${searchData.error.message}`);
  }

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Erro ao criar pasta: ${createResponse.status} - ${error}`);
  }

  const createData = await createResponse.json();

  if (createData.error) {
    throw new Error(`Erro ao criar pasta: ${createData.error.message}`);
  }

  if (!createData.id) {
    throw new Error('Pasta criada mas sem ID retornado');
  }

  return createData.id;
}

/**
 * FASE 4: Move um ficheiro para uma pasta diferente
 */
export async function moveFile(
  accessToken: string,
  fileId: string,
  newParentId: string
): Promise<boolean> {
  try {
    const getResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!getResponse.ok) {
      return false;
    }

    const fileData = await getResponse.json();
    const previousParents = fileData.parents?.join(',') || '';

    const moveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${previousParents}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return moveResponse.ok;
  } catch {
    return false;
  }
}

/**
 * FASE 3: Verifica se um ficheiro existe numa pasta específica
 */
export async function checkFileExists(
  accessToken: string,
  fileName: string,
  parentId: string
): Promise<string | null> {
  const query = `name='${fileName}' and '${parentId}' in parents and trashed=false`;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao verificar ficheiro: ${response.status}`);
  }

  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  return null;
}

/**
 * FASE 3: Copia um ficheiro (usado para clonar o Template do Excel)
 */
export async function copyFile(
  accessToken: string,
  sourceFileId: string,
  newName: string,
  destinationFolderId: string
): Promise<{ id: string; webViewLink: string } | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${sourceFileId}/copy`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName,
          parents: [destinationFolderId],
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      id: data.id,
      webViewLink: data.webViewLink || `https://docs.google.com/spreadsheets/d/${data.id}/edit`,
    };
  } catch {
    return null;
  }
}

import { setupSpreadsheetHeaders, MONTH_SHEET_NAMES } from './sheets';

/**
 * FASE 3: Cria um novo Google Sheet com estrutura padrão de meses
 */
export async function createNewSpreadsheet(
  accessToken: string,
  title: string,
  parentFolderId: string
): Promise<{ id: string; webViewLink: string }> {
  const sheets = MONTH_SHEET_NAMES;

  const headers = [
    'Data Doc.', 'Fornecedor', 'NIF Fornecedor', 'Tipo Custo',
    'Nº Documento', 'Valor Total (€)', 'IVA (€)', 'Resumo',
    'Link PDF', 'Data Processamento'
  ];

  const createResponse = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: sheets.map(name => ({ properties: { title: name } })),
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Erro ao criar Spreadsheet: ${createResponse.status} - ${error}`);
  }

  const createData = await createResponse.json();
  const spreadsheetId = createData.spreadsheetId;

  await setupSpreadsheetHeaders(accessToken, spreadsheetId, headers);

  try {
    const moveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${parentFolderId}&fields=id,parents,webViewLink`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (moveResponse.ok) {
      const moveData = await moveResponse.json();
      return {
        id: spreadsheetId,
        webViewLink: moveData.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      };
    }
  } catch {
    // Continue without moving
  }

  return {
    id: spreadsheetId,
    webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * FASE 3: Obtém ou cria o Excel anual (EXTRATO_YEAR)
 */
export async function getOrCreateYearlySheet(
  accessToken: string,
  year: number,
  parentFolderId: string
): Promise<string> {
  const extractoName = `EXTRATO_${year}`;

  const existingId = await checkFileExists(accessToken, extractoName, parentFolderId);

  if (existingId) {
    return existingId;
  }

  const newSheet = await createNewSpreadsheet(accessToken, extractoName, parentFolderId);

  return newSheet.id;
}

/**
 * FASE 3: Upload organizado de ficheiro
 */
export async function uploadInvoiceToDrive(
  accessToken: string,
  fileData: Uint8Array | Blob,
  fileName: string,
  parentFolderId: string
): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
  if (!accessToken) {
    throw new Error('Token de acesso não fornecido para upload');
  }
  if (!parentFolderId) {
    throw new Error('ID da pasta de destino não fornecido');
  }

  const metadata = {
    name: fileName,
    parents: [parentFolderId],
    mimeType: 'application/pdf',
  };

  let blob: Blob;
  if (fileData instanceof Blob) {
    blob = fileData;
  } else {
    blob = new Blob([new Uint8Array(fileData)], { type: 'application/pdf' });
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload falhou: ${response.status} - ${error}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`Erro no upload: ${result.error.message}`);
  }

  if (!result.id) {
    throw new Error('Ficheiro enviado mas sem ID retornado');
  }

  return {
    id: result.id,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    webContentLink: result.webContentLink || '',
  };
}
