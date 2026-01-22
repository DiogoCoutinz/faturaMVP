/**
 * FASE 4: ORQUESTRADOR DE UPDATES BIDIRECIONAIS
 * Frontend → Supabase → Google Sheets → Drive (move ficheiro se cost_type mudar)
 */

import { supabase } from '@/lib/supabase/client';
import { Invoice } from '@/types/database';
import { getOrCreateYearlySheet, ensureFolder, moveFile } from '@/lib/google/drive';
import {
  findInvoiceRowIndex,
  updateSheetCells,
  getSheetNameFromDate,
  moveRowBetweenSheets,
  moveRowBetweenSpreadsheets,
  COLUMN_MAP,
} from './sheets-updater';

/**
 * Helper: Converte cost_type para nome de pasta no Drive
 */
function getCostTypeFolderName(costType: string | null): string {
  switch (costType) {
    case 'custo_fixo':
      return 'Custos Fixos';
    case 'custo_variavel':
      return 'Custos Variáveis';
    default:
      return 'Por Classificar';
  }
}

export interface UpdateInvoiceInput {
  invoiceId: string;
  userId: string;
  accessToken: string;
  updates: {
    supplier_name?: string;
    supplier_vat?: string;
    doc_number?: string;
    doc_date?: string;
    doc_year?: number;
    total_amount?: number;
    summary?: string;
    cost_type?: string;
  };
}

export interface UpdateInvoiceResult {
  success: boolean;
  updatedInSupabase: boolean;
  updatedInSheets: boolean;
  fileMoved: boolean;
  message: string;
  error?: string;
}

/**
 * FASE 4 MVP: Atualiza fatura em TODOS os sistemas (Supabase + Sheets)
 * Apenas para campos simples que não requerem mover linhas/ficheiros
 */
export async function updateInvoiceEverywhere(
  input: UpdateInvoiceInput
): Promise<UpdateInvoiceResult> {
  console.log('🟢 ========== UPDATE INVOICE EVERYWHERE ==========');
  console.log('🟢 Invoice ID:', input.invoiceId);
  console.log('🟢 User ID:', input.userId);
  console.log('🟢 Campos a atualizar:', Object.keys(input.updates));
  console.log('🟢 Updates completos:', JSON.stringify(input.updates, null, 2));

  try {
    // PASSO 1: Obter dados atuais da fatura
    const { data: currentInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', input.invoiceId)
      .eq('user_id', input.userId)
      .single();

    if (fetchError || !currentInvoice) {
      return {
        success: false,
        updatedInSupabase: false,
        updatedInSheets: false,
        fileMoved: false,
        message: 'Fatura não encontrada',
        error: fetchError?.message,
      };
    }

    console.log('🟢 Fatura atual encontrada:', currentInvoice.supplier_name);
    console.log('🟢 Cost type atual:', currentInvoice.cost_type);
    console.log('🟢 Doc date atual:', currentInvoice.doc_date);

    // Guardar dados originais para possível rollback
    const originalData = { ...currentInvoice };

    // PASSO 2: Atualizar no Supabase
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(input.updates)
      .eq('id', input.invoiceId)
      .eq('user_id', input.userId)
      .select()
      .single();

    if (updateError || !updatedInvoice) {
      const errorMessage = updateError?.message || 'Erro desconhecido ao atualizar no Supabase';
      console.error(`   ❌ Erro ao atualizar Supabase: ${errorMessage}`);
      
      return {
        success: false,
        updatedInSupabase: false,
        updatedInSheets: false,
        fileMoved: false,
        message: `Erro ao atualizar no Supabase: ${errorMessage}`,
        error: errorMessage,
      };
    }

    console.log('🟢 ✅ Supabase atualizado com sucesso!');

    // PASSO 3: Verificar se precisa mover ficheiro no Drive (cost_type ou ano mudou)
    let fileMoved = false;

    const costTypeChanged = input.updates.cost_type !== undefined && input.updates.cost_type !== currentInvoice.cost_type;
    const yearChanged = input.updates.doc_year !== undefined && input.updates.doc_year !== currentInvoice.doc_year;
    
    console.log('🟢 ========== DETECÇÕES DE MUDANÇAS ==========');
    console.log(`🟢 cost_type mudou: ${costTypeChanged}`);
    if (costTypeChanged) {
      console.log(`   ANTES: "${currentInvoice.cost_type}"`);
      console.log(`   DEPOIS: "${input.updates.cost_type}"`);
    }
    console.log(`🟢 ano mudou: ${yearChanged}`);
    if (yearChanged) {
      console.log(`   ANTES: ${currentInvoice.doc_year}`);
      console.log(`   DEPOIS: ${input.updates.doc_year}`);
    }

    if ((costTypeChanged || yearChanged) && currentInvoice.drive_file_id) {
      console.log('   📦 MUDANÇA DETECTADA! A mover ficheiro no Drive...');
      if (costTypeChanged) console.log(`      Cost type: ${currentInvoice.cost_type} → ${input.updates.cost_type}`);
      if (yearChanged) console.log(`      Ano: ${currentInvoice.doc_year} → ${input.updates.doc_year}`);

      try {
        // Usar o novo ano se mudou, senão usar o atual
        const targetYear = input.updates.doc_year || currentInvoice.doc_year || new Date().getFullYear();
        const targetCostType = input.updates.cost_type ?? currentInvoice.cost_type;

        try {
          const rootFolderId = await ensureFolder(input.accessToken, 'FATURAS');
          const yearFolderId = await ensureFolder(input.accessToken, targetYear.toString(), rootFolderId);

          // Criar/obter a nova pasta de destino
          const newFolderName = getCostTypeFolderName(targetCostType);
          const newFolderId = await ensureFolder(input.accessToken, newFolderName, yearFolderId);

          console.log(`      📁 Nova pasta: FATURAS/${targetYear}/${newFolderName}`);

          // Mover o ficheiro
          fileMoved = await moveFile(input.accessToken, currentInvoice.drive_file_id, newFolderId);

          if (fileMoved) {
            console.log('      ✅ Ficheiro movido com sucesso no Drive!');
          } else {
            console.warn('      ⚠️ Não foi possível mover o ficheiro no Drive (API pode não estar habilitada)');
          }
        } catch (driveError: any) {
          // Se for erro 403 (API não habilitada), apenas avisar mas continuar
          if (driveError?.message?.includes('403') || driveError?.message?.includes('SERVICE_DISABLED')) {
            console.warn('      ⚠️ Google Drive API não está habilitada. Ficheiro não foi movido, mas continuando com atualização do Sheets...');
            console.warn('      💡 Para habilitar: https://console.developers.google.com/apis/api/drive.googleapis.com/overview');
          } else {
            console.error('      ❌ Erro ao mover ficheiro no Drive:', driveError);
          }
          // Continuar mesmo se Drive falhar - Sheets ainda deve ser atualizado
        }
      } catch (moveError) {
        console.error('      ❌ Erro ao processar movimento de ficheiro:', moveError);
        // Continuar mesmo se houver erro - Sheets ainda deve ser atualizado
      }
    }

    // PASSO 4: Tentar atualizar no Google Sheets
    let sheetsUpdated = false;
    
    try {
      // Resolver estrutura de pastas (igual à sync-engine)
      const oldYear = currentInvoice.doc_year || new Date(currentInvoice.doc_date || '').getFullYear();
      const newYear = input.updates.doc_year ?? oldYear;
      
      const rootFolderId = await ensureFolder(input.accessToken, 'FATURAS');
      const oldYearFolderId = await ensureFolder(input.accessToken, oldYear.toString(), rootFolderId);
      
      // Obter/Criar o Excel do ano antigo
      const oldSpreadsheetId = await getOrCreateYearlySheet(input.accessToken, oldYear, oldYearFolderId);
      
      // Determinar a aba (mês) correta - usar dados ANTIGOS para localizar
      const oldSheetName = getSheetNameFromDate(currentInvoice.doc_date);
      
      // Verificar se houve mudança de data
      const dateChanged = input.updates.doc_date !== undefined && 
        currentInvoice.doc_date !== null &&
        input.updates.doc_date !== currentInvoice.doc_date;
      
      // Calcular novo ano se doc_date mudou
      let calculatedNewYear = newYear;
      if (dateChanged && input.updates.doc_date) {
        const newDate = new Date(input.updates.doc_date);
        if (!isNaN(newDate.getTime())) {
          calculatedNewYear = newDate.getFullYear();
        }
      }
      
      // Verificar se houve mudança de ano
      const yearChanged = oldYear !== calculatedNewYear;
      
      let newSheetName = oldSheetName;
      if (dateChanged) {
        newSheetName = getSheetNameFromDate(input.updates.doc_date);
      }

      // MUDANÇA DE ANO DETECTADA
      if (yearChanged) {
        console.log(`   📅 Mudança de ano detectada: ${oldYear} → ${calculatedNewYear}`);
        
        // Obter/Criar o Excel do ano novo
        const newYearFolderId = await ensureFolder(input.accessToken, calculatedNewYear.toString(), rootFolderId);
        const newSpreadsheetId = await getOrCreateYearlySheet(input.accessToken, calculatedNewYear, newYearFolderId);
        
        // Encontrar linha no spreadsheet antigo
        const rowIndex = await findInvoiceRowIndex(
          input.accessToken,
          oldSpreadsheetId,
          oldSheetName,
          {
            doc_number: currentInvoice.doc_number,
            supplier_name: currentInvoice.supplier_name,
            total_amount: currentInvoice.total_amount,
            doc_date: currentInvoice.doc_date,
          }
        );

        if (rowIndex) {
          // Preparar dados atualizados para a nova linha
          const updatedInvoiceData: Record<string, string | number | null> = {
            doc_date: input.updates.doc_date ?? currentInvoice.doc_date,
            supplier_name: input.updates.supplier_name ?? currentInvoice.supplier_name,
            supplier_vat: input.updates.supplier_vat ?? currentInvoice.supplier_vat,
            cost_type: input.updates.cost_type ?? currentInvoice.cost_type,
            doc_number: input.updates.doc_number ?? currentInvoice.doc_number,
            total_amount: input.updates.total_amount ?? currentInvoice.total_amount,
            summary: input.updates.summary ?? currentInvoice.summary,
            drive_link: updatedInvoice.drive_link ?? currentInvoice.drive_link,
          };

          sheetsUpdated = await moveRowBetweenSpreadsheets(
            input.accessToken,
            oldSpreadsheetId,
            newSpreadsheetId,
            oldSheetName,
            newSheetName,
            rowIndex,
            updatedInvoiceData
          );
        } else {
          console.warn('   ⚠️ Linha não encontrada no spreadsheet antigo para mover');
        }
      } 
      // MUDANÇA DE MÊS DETECTADA (mesmo ano)
      else if (dateChanged && oldYear === newYear && oldSheetName !== newSheetName) {
        console.log(`   📅 Mudança de mês detectada: ${oldSheetName} → ${newSheetName}`);
        
        // Encontrar linha na aba antiga
        const rowIndex = await findInvoiceRowIndex(
          input.accessToken,
          oldSpreadsheetId,
          oldSheetName,
          {
            doc_number: currentInvoice.doc_number,
            supplier_name: currentInvoice.supplier_name,
            total_amount: currentInvoice.total_amount,
            doc_date: currentInvoice.doc_date,
          }
        );

        if (rowIndex) {
          // Preparar dados atualizados para a nova linha
          const updatedInvoiceData: Record<string, string | number | null> = {
            doc_date: input.updates.doc_date ?? currentInvoice.doc_date,
            supplier_name: input.updates.supplier_name ?? currentInvoice.supplier_name,
            supplier_vat: input.updates.supplier_vat ?? currentInvoice.supplier_vat,
            cost_type: input.updates.cost_type ?? currentInvoice.cost_type,
            doc_number: input.updates.doc_number ?? currentInvoice.doc_number,
            total_amount: input.updates.total_amount ?? currentInvoice.total_amount,
            summary: input.updates.summary ?? currentInvoice.summary,
            drive_link: updatedInvoice.drive_link ?? currentInvoice.drive_link,
          };

          sheetsUpdated = await moveRowBetweenSheets(
            input.accessToken,
            oldSpreadsheetId,
            oldSheetName,
            newSheetName,
            rowIndex,
            updatedInvoiceData
          );
        } else {
          console.warn('   ⚠️ Linha não encontrada na aba antiga para mover');
        }
      }

      // Se não houve mudança de mês/ano OU se apenas cost_type mudou (sem mudança de data) OU se a mudança falhou, fazer update normal
      const shouldDoNormalUpdate = !dateChanged || !sheetsUpdated || (costTypeChanged && !dateChanged);
      
      if (shouldDoNormalUpdate) {
        const spreadsheetId = yearChanged ? await getOrCreateYearlySheet(input.accessToken, calculatedNewYear, await ensureFolder(input.accessToken, calculatedNewYear.toString(), rootFolderId)) : oldSpreadsheetId;
        const sheetName = dateChanged ? newSheetName : getSheetNameFromDate(updatedInvoice.doc_date || currentInvoice.doc_date);
        
        console.log(`   📊 Procurando em ${spreadsheetId} (aba: ${sheetName})`);
        if (costTypeChanged && !dateChanged) {
          console.log(`   💡 Apenas cost_type mudou (sem mudança de data) - atualizando célula no Sheets`);
        }

        // Encontrar a linha no Sheets (usando dados ANTIGOS para localizar)
        console.log(`   🔍 Critérios de busca:`);
        console.log(`      - doc_number: "${currentInvoice.doc_number}"`);
        console.log(`      - supplier_name: "${currentInvoice.supplier_name}"`);
        console.log(`      - total_amount: ${currentInvoice.total_amount}`);
        console.log(`      - doc_date: "${currentInvoice.doc_date}"`);
        
        const rowIndex = await findInvoiceRowIndex(
          input.accessToken,
          spreadsheetId,
          sheetName,
          {
            doc_number: currentInvoice.doc_number,
            supplier_name: currentInvoice.supplier_name,
            total_amount: currentInvoice.total_amount,
            doc_date: currentInvoice.doc_date,
          }
        );

        if (rowIndex) {
          console.log(`   ✅ Linha encontrada: ${rowIndex}`);
          console.log(`   📝 Atualizações a aplicar:`, input.updates);
          // Preparar updates para o Sheets (apenas campos que foram alterados)
          const sheetsUpdates: Record<string, string | number | null> = {};
          
          if (input.updates.supplier_name !== undefined) {
            sheetsUpdates.supplier_name = input.updates.supplier_name;
          }
          if (input.updates.supplier_vat !== undefined) {
            sheetsUpdates.supplier_vat = input.updates.supplier_vat;
          }
          if (input.updates.doc_number !== undefined) {
            sheetsUpdates.doc_number = input.updates.doc_number;
          }
          if (input.updates.doc_date !== undefined) {
            sheetsUpdates.doc_date = input.updates.doc_date;
          }
          if (input.updates.total_amount !== undefined) {
            sheetsUpdates.total_amount = input.updates.total_amount;
          }
          if (input.updates.summary !== undefined) {
            sheetsUpdates.summary = input.updates.summary;
          }
          if (input.updates.cost_type !== undefined) {
            sheetsUpdates.cost_type = input.updates.cost_type;
            console.log(`   📝 Cost type será atualizado no Sheets: "${currentInvoice.cost_type}" → "${input.updates.cost_type}"`);
          }

          console.log(`   📝 Campos a atualizar no Sheets:`, Object.keys(sheetsUpdates));

          // Atualizar todas as células de uma vez
          sheetsUpdated = await updateSheetCells(
            input.accessToken,
            spreadsheetId,
            sheetName,
            rowIndex,
            sheetsUpdates
          );

          if (sheetsUpdated) {
            console.log(`   ✅ Sheets atualizado com sucesso!`);
          } else {
            console.warn(`   ⚠️ Falha ao atualizar Sheets`);
          }
        } else {
          console.warn('   ⚠️ Linha não encontrada no Sheets (pode ter sido movida/apagada)');
        }
      }
    } catch (sheetsError) {
      const errorMessage = sheetsError instanceof Error ? sheetsError.message : 'Erro desconhecido ao atualizar Sheets';
      console.error('   ⚠️ Erro ao atualizar Sheets:', errorMessage);
      
      // Se foi um erro crítico (não apenas linha não encontrada), considerar rollback
      const isCriticalError = !errorMessage.includes('não encontrada') && 
                              !errorMessage.includes('não foi possível sincronizar');
      
      if (isCriticalError) {
        console.warn('   ⚠️ Erro crítico no Sheets - considerando rollback do Supabase');
        // Em produção, poderia fazer rollback aqui, mas por agora apenas avisamos
        // Rollback seria: await supabase.from('invoices').update(originalData).eq('id', input.invoiceId);
      }
    }

    // RESULTADO FINAL
    console.log('🟢 ========== RESULTADO FINAL ==========');
    console.log('🟢 Supabase:', sheetsUpdated ? '✅ ATUALIZADO' : '❌ FALHOU');
    console.log('🟢 Sheets:', sheetsUpdated ? '✅ ATUALIZADO' : '❌ FALHOU');
    console.log('🟢 Ficheiro movido:', fileMoved ? '✅ SIM' : '❌ NÃO');
    console.log('🟢 ===========================================');
    
    if (sheetsUpdated) {
      const message = fileMoved 
        ? 'Fatura atualizada e ficheiro movido com sucesso!'
        : 'Fatura atualizada com sucesso!';
      return {
        success: true,
        updatedInSupabase: true,
        updatedInSheets: true,
        fileMoved,
        message,
      };
    } else {
      // Mensagem mais específica baseada no tipo de erro
      let warningMessage = 'Fatura atualizada no sistema, mas não foi possível sincronizar com o Excel';
      
      // Verificar se foi porque a linha não foi encontrada
      if (!sheetsUpdated) {
        warningMessage = 'Fatura atualizada no sistema. A linha pode não existir no Excel ou ter sido movida manualmente.';
      }
      
      return {
        success: true,
        updatedInSupabase: true,
        updatedInSheets: false,
        fileMoved,
        message: warningMessage,
      };
    }
  } catch (error) {
    console.error('❌ Erro no update bidirecional:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Tentar fazer rollback se Supabase foi atualizado mas houve erro crítico
    try {
      // Verificar se Supabase foi atualizado antes do erro
      // Se sim, tentar reverter (isso seria ideal, mas requer mais lógica)
      console.warn('   ⚠️ Erro crítico - verificar se rollback é necessário');
    } catch (rollbackError) {
      console.error('   ❌ Erro ao tentar rollback:', rollbackError);
    }
    
    return {
      success: false,
      updatedInSupabase: false,
      updatedInSheets: false,
      fileMoved: false,
      message: `Erro ao processar atualização: ${errorMessage}`,
      error: errorMessage,
    };
  }
}
