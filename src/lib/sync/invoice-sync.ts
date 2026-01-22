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
 * - Move o ficheiro no Drive para a nova pasta
 */
export async function syncInvoiceOnCostTypeChange({
  accessToken,
  driveFileId,
  docYear,
  oldCostType,
  newCostType,
}: SyncInvoiceParams): Promise<{ success: boolean; error?: string }> {
  // Se não mudou ou não tem ficheiro, não faz nada
  if (!driveFileId || oldCostType === newCostType) {
    return { success: true };
  }

  console.log('🔄 Sincronizando fatura após mudança de tipo de custo...');
  console.log(`   Tipo anterior: ${oldCostType} → Novo tipo: ${newCostType}`);

  try {
    // Determinar a nova pasta
    let newFolderName = 'Por Classificar';
    if (newCostType === 'custo_fixo') {
      newFolderName = 'Custos Fixos';
    } else if (newCostType === 'custo_variavel') {
      newFolderName = 'Custos Variáveis';
    }

    // Obter IDs das pastas
    const rootFolderId = await ensureFolder(accessToken, 'FATURAS');
    const yearFolderId = await ensureFolder(accessToken, docYear.toString(), rootFolderId);
    const newCostTypeFolderId = await ensureFolder(accessToken, newFolderName, yearFolderId);

    console.log(`   📁 Nova pasta: FATURAS/${docYear}/${newFolderName} (${newCostTypeFolderId})`);

    // Mover ficheiro
    const moved = await moveFile(accessToken, driveFileId, newCostTypeFolderId);

    if (moved) {
      console.log('   ✅ Ficheiro movido com sucesso!');
      return { success: true };
    } else {
      console.error('   ❌ Falha ao mover ficheiro');
      return { success: false, error: 'Não foi possível mover o ficheiro no Drive' };
    }
  } catch (error) {
    console.error('   ❌ Erro na sincronização:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na sincronização'
    };
  }
}
