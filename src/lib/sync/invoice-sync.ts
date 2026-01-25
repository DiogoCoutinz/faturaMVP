/**
 * Sincronização de faturas entre Supabase, Google Drive e Google Sheets
 */

import { ensureFolder, moveFile } from '@/lib/google/drive';

interface SyncInvoiceParams {
  accessToken: string;
  invoiceId: string;
  driveFileId: string | null;
  docYear: number;
  oldCostType: string | null;
  newCostType: string | null;
}

/**
 * Sincroniza a fatura quando o tipo de custo muda
 */
export async function syncInvoiceOnCostTypeChange({
  accessToken,
  driveFileId,
  docYear,
  oldCostType,
  newCostType,
}: SyncInvoiceParams): Promise<{ success: boolean; error?: string }> {
  if (!driveFileId || oldCostType === newCostType) {
    return { success: true };
  }

  try {
    let newFolderName = 'Por Classificar';
    if (newCostType === 'custo_fixo') {
      newFolderName = 'Custos Fixos';
    } else if (newCostType === 'custo_variavel') {
      newFolderName = 'Custos Variáveis';
    }

    const rootFolderId = await ensureFolder(accessToken, 'FATURAS');
    const yearFolderId = await ensureFolder(accessToken, docYear.toString(), rootFolderId);
    const newCostTypeFolderId = await ensureFolder(accessToken, newFolderName, yearFolderId);

    const moved = await moveFile(accessToken, driveFileId, newCostTypeFolderId);

    if (moved) {
      return { success: true };
    } else {
      return { success: false, error: 'Não foi possível mover o ficheiro no Drive' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na sincronização'
    };
  }
}
