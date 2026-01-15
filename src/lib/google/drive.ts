/**
 * GOOGLE DRIVE SERVICE
 * Responsável por upload de ficheiros para o Google Drive
 * 
 * REQUISITOS:
 * - Provider Token do Supabase Auth (OAuth Google)
 * - Scope: https://www.googleapis.com/auth/drive.file
 */

import { google } from 'googleapis';

/**
 * Cria cliente do Google Drive autenticado
 */
export function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.drive({ version: 'v3', auth });
}

/**
 * Upload de ficheiro para o Google Drive
 * @param accessToken - Token OAuth do Google
 * @param file - Ficheiro a fazer upload (File ou Blob)
 * @param fileName - Nome do ficheiro
 * @param folderId - ID da pasta de destino (opcional)
 */
export async function uploadFileToDrive(
  accessToken: string,
  file: File | Blob,
  fileName: string,
  folderId?: string
): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
  try {
    const drive = createDriveClient(accessToken);

    // Converter File/Blob para Buffer (para Node.js) ou usar FormData (para fetch API)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileMetadata: any = {
      name: fileName,
      mimeType: file.type,
    };

    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType: file.type,
      body: buffer,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    if (!response.data.id) {
      throw new Error('Upload falhou: ID do ficheiro não retornado');
    }

    console.log('✅ Ficheiro enviado para Drive:', response.data.id);

    return {
      id: response.data.id,
      webViewLink: response.data.webViewLink || '',
      webContentLink: response.data.webContentLink || '',
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload para Drive:', error);
    throw new Error(
      error instanceof Error 
        ? `Falha no upload: ${error.message}` 
        : 'Erro desconhecido no upload'
    );
  }
}

/**
 * Cria uma pasta no Google Drive
 * @param accessToken - Token OAuth
 * @param folderName - Nome da pasta
 * @param parentFolderId - ID da pasta pai (opcional)
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  try {
    const drive = createDriveClient(accessToken);

    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    if (!response.data.id) {
      throw new Error('Criação de pasta falhou');
    }

    console.log('📁 Pasta criada no Drive:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ Erro ao criar pasta no Drive:', error);
    throw error;
  }
}

/**
 * Lista ficheiros numa pasta (útil para debug/validação)
 */
export async function listFilesInFolder(
  accessToken: string,
  folderId: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  try {
    const drive = createDriveClient(accessToken);

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 100,
    });

    return response.data.files || [];
  } catch (error) {
    console.error('❌ Erro ao listar ficheiros:', error);
    throw error;
  }
}

// TODO (Fase 2 - Limpeza):
// - Função para apagar ficheiros: drive.files.delete({ fileId })
// - Gestão de quotas e erros de rate limit
// - Retry logic para uploads falhados
