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

  // Query para procurar pasta existente
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

  // Se existe, retorna o ID
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Se não existe, cria
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

  console.log(`📁 Pasta criada: ${folderName}`);
  return createData.id;
}

/**
 * FASE 4: Move um ficheiro para uma pasta diferente (remove de parents antigos, adiciona novo)
 */
export async function moveFile(
  accessToken: string,
  fileId: string,
  newParentId: string
): Promise<boolean> {
  console.log(`📦 Movendo ficheiro ${fileId} para pasta ${newParentId}...`);

  try {
    // Primeiro, obter os parents atuais
    const getResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!getResponse.ok) {
      console.error(`   ❌ Erro ao obter parents do ficheiro: ${getResponse.status}`);
      return false;
    }

    const fileData = await getResponse.json();
    const previousParents = fileData.parents?.join(',') || '';

    console.log(`   📁 Parents atuais: ${previousParents}`);
    console.log(`   📁 Novo parent: ${newParentId}`);

    // Mover (adicionar novo parent, remover antigos)
    const moveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${previousParents}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!moveResponse.ok) {
      const error = await moveResponse.text();
      console.error(`   ❌ Erro ao mover ficheiro: ${moveResponse.status} - ${error}`);
      return false;
    }

    console.log(`   ✅ Ficheiro movido com sucesso!`);
    return true;
  } catch (error) {
    console.error('   ❌ Erro ao mover ficheiro:', error);
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
    console.log(`   ✅ Ficheiro "${fileName}" já existe: ${data.files[0].id}`);
    return data.files[0].id;
  }

  console.log(`   ℹ️ Ficheiro "${fileName}" não encontrado`);
  return null;
}

/**
 * FASE 3: Copia um ficheiro (usado para clonar o Template do Excel)
 * Retorna null se falhar (não lança erro)
 */
export async function copyFile(
  accessToken: string,
  sourceFileId: string,
  newName: string,
  destinationFolderId: string
): Promise<{ id: string; webViewLink: string } | null> {
  console.log(`📋 Tentando copiar Template: ${sourceFileId} → ${newName}`);

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
      const error = await response.text();
      console.warn(`   ⚠️ Não foi possível copiar Template: ${response.status} - ${error}`);
      console.warn('   💡 Isto é normal se o Template não tiver permissões corretas ou scope drive.file limitado');
      return null; // Retorna null em vez de lançar erro
    }

    const data = await response.json();
    console.log(`   ✅ Template copiado com sucesso: ${data.id}`);

    return {
      id: data.id,
      webViewLink: data.webViewLink || `https://docs.google.com/spreadsheets/d/${data.id}/edit`,
    };
  } catch (error) {
    console.warn('   ⚠️ Erro ao tentar copiar Template:', error);
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
  console.log(`📊 Criando novo Google Sheet: ${title}`);

  // Usar estrutura padrão de meses
  const sheets = MONTH_SHEET_NAMES;

  const headers = [
    'Data Doc.', 'Fornecedor', 'NIF Fornecedor', 'Tipo Custo',
    'Nº Documento', 'Valor Total (€)', 'IVA (€)', 'Resumo',
    'Link PDF', 'Data Processamento'
  ];

  // Passo 1: Criar o Spreadsheet via Sheets API
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
  console.log(`   ✅ Spreadsheet criado: ${spreadsheetId}`);

  // Passo 2: Aplicar cabeçalhos do Template
  await setupSpreadsheetHeaders(accessToken, spreadsheetId, headers);

  // Passo 3: Mover para a pasta correta via Drive API
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
      console.log(`   ✅ Movido para pasta: ${parentFolderId}`);
      return {
        id: spreadsheetId,
        webViewLink: moveData.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      };
    }
  } catch (moveError) {
    console.warn('   ⚠️ Não foi possível mover para pasta, mas Sheet foi criado');
  }

  return {
    id: spreadsheetId,
    webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * FASE 3: Obtém ou cria o Excel anual (EXTRATO_YEAR)
 * Fluxo: Procura existente → Cria novo com estrutura padrão
 */
export async function getOrCreateYearlySheet(
  accessToken: string,
  year: number,
  parentFolderId: string
): Promise<string> {
  const extractoName = `EXTRATO_${year}`;

  console.log(`📊 Gerindo Excel anual: ${extractoName}`);

  // PASSO 1: Verificar se já existe
  const existingId = await checkFileExists(accessToken, extractoName, parentFolderId);

  if (existingId) {
    console.log(`   ✅ ${extractoName} já existe (ID: ${existingId})`);
    return existingId;
  }

  // PASSO 2: Criar novo Spreadsheet com estrutura padrão
  console.log(`   🆕 ${extractoName} não existe, criando...`);
  const newSheet = await createNewSpreadsheet(accessToken, extractoName, parentFolderId);
  console.log(`   ✅ Novo Spreadsheet criado: ${newSheet.id}`);

  return newSheet.id;
}

/**
 * FASE 3: Upload organizado de ficheiro (com parent específico)
 * @param accessToken - Token OAuth do Google
 * @param fileData - Uint8Array ou Blob do ficheiro
 * @param fileName - Nome do ficheiro
 * @param parentFolderId - ID da pasta de destino
 */
export async function uploadInvoiceToDrive(
  accessToken: string,
  fileData: Uint8Array | Blob,
  fileName: string,
  parentFolderId: string
): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
  try {
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

    console.log(`📤 Upload concluído: ${fileName}`);

    return {
      id: result.id,
      webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
      webContentLink: result.webContentLink || '',
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload para Drive:', error);
    throw error;
  }
}
