/**
 * FASE 4: ORQUESTRADOR DE UPDATES BIDIRECIONAIS
 * Frontend → Supabase → Google Sheets → Drive (move ficheiro se cost_type mudar)
 */

import { supabase } from '@/lib/supabase/client';
import { getOrCreateYearlySheet, ensureFolder, moveFile } from '@/lib/google/drive';
import {
  findInvoiceRowIndex,
  updateSheetCells,
  getSheetNameFromDate,
  moveRowBetweenSheets,
  moveRowBetweenSpreadsheets,
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
  userId: string | null;
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
 */
export async function updateInvoiceEverywhere(
  input: UpdateInvoiceInput
): Promise<UpdateInvoiceResult> {
  try {
    // PASSO 1: Obter dados atuais da fatura
    // Todos os utilizadores podem editar todas as faturas (sem filtro por user_id)
    const { data: currentInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', input.invoiceId)
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

    // PASSO 2: Atualizar no Supabase
    // Todos os utilizadores podem editar todas as faturas (sem filtro por user_id)
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(input.updates)
      .eq('id', input.invoiceId)
      .select()
      .single();

    if (updateError || !updatedInvoice) {
      const errorMessage = updateError?.message || 'Erro desconhecido ao atualizar no Supabase';
      return {
        success: false,
        updatedInSupabase: false,
        updatedInSheets: false,
        fileMoved: false,
        message: `Erro ao atualizar no Supabase: ${errorMessage}`,
        error: errorMessage,
      };
    }

    // PASSO 3: Verificar se precisa mover ficheiro no Drive
    let fileMoved = false;

    const costTypeChanged = input.updates.cost_type !== undefined && input.updates.cost_type !== currentInvoice.cost_type;
    const yearChanged = input.updates.doc_year !== undefined && input.updates.doc_year !== currentInvoice.doc_year;

    if ((costTypeChanged || yearChanged) && currentInvoice.drive_file_id) {
      try {
        const targetYear = input.updates.doc_year || currentInvoice.doc_year || new Date().getFullYear();
        const targetCostType = input.updates.cost_type ?? currentInvoice.cost_type;

        try {
          const rootFolderId = await ensureFolder(input.accessToken, 'FATURAS');
          const yearFolderId = await ensureFolder(input.accessToken, targetYear.toString(), rootFolderId);
          const newFolderName = getCostTypeFolderName(targetCostType);
          const newFolderId = await ensureFolder(input.accessToken, newFolderName, yearFolderId);

          fileMoved = await moveFile(input.accessToken, currentInvoice.drive_file_id, newFolderId);
        } catch {
          // Continuar mesmo se Drive falhar
        }
      } catch {
        // Continuar mesmo se houver erro
      }
    }

    // PASSO 4: Tentar atualizar no Google Sheets
    let sheetsUpdated = false;

    try {
      const oldYear = currentInvoice.doc_year || new Date(currentInvoice.doc_date || '').getFullYear();
      const newYear = input.updates.doc_year ?? oldYear;

      const rootFolderId = await ensureFolder(input.accessToken, 'FATURAS');
      const oldYearFolderId = await ensureFolder(input.accessToken, oldYear.toString(), rootFolderId);
      const oldSpreadsheetId = await getOrCreateYearlySheet(input.accessToken, oldYear, oldYearFolderId);
      const oldSheetName = getSheetNameFromDate(currentInvoice.doc_date);

      const dateChanged = input.updates.doc_date !== undefined &&
        currentInvoice.doc_date !== null &&
        input.updates.doc_date !== currentInvoice.doc_date;

      let calculatedNewYear = newYear;
      if (dateChanged && input.updates.doc_date) {
        const newDate = new Date(input.updates.doc_date);
        if (!isNaN(newDate.getTime())) {
          calculatedNewYear = newDate.getFullYear();
        }
      }

      const yearChangedCalc = oldYear !== calculatedNewYear;

      let newSheetName = oldSheetName;
      if (dateChanged) {
        newSheetName = getSheetNameFromDate(input.updates.doc_date);
      }

      // MUDANÇA DE ANO
      if (yearChangedCalc) {
        const newYearFolderId = await ensureFolder(input.accessToken, calculatedNewYear.toString(), rootFolderId);
        const newSpreadsheetId = await getOrCreateYearlySheet(input.accessToken, calculatedNewYear, newYearFolderId);

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
        }
      }
      // MUDANÇA DE MÊS (mesmo ano)
      else if (dateChanged && oldYear === newYear && oldSheetName !== newSheetName) {
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
        }
      }

      // Update normal se não houve mudança de mês/ano
      const shouldDoNormalUpdate = !dateChanged || !sheetsUpdated || (costTypeChanged && !dateChanged);

      if (shouldDoNormalUpdate) {
        const spreadsheetId = yearChangedCalc ? await getOrCreateYearlySheet(input.accessToken, calculatedNewYear, await ensureFolder(input.accessToken, calculatedNewYear.toString(), rootFolderId)) : oldSpreadsheetId;
        const sheetName = dateChanged ? newSheetName : getSheetNameFromDate(updatedInvoice.doc_date || currentInvoice.doc_date);

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
          }

          sheetsUpdated = await updateSheetCells(
            input.accessToken,
            spreadsheetId,
            sheetName,
            rowIndex,
            sheetsUpdates
          );
        }
      }
    } catch {
      // Erro ao atualizar Sheets - continuar
    }

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
      return {
        success: true,
        updatedInSupabase: true,
        updatedInSheets: false,
        fileMoved,
        message: 'Fatura atualizada no sistema. A linha pode não existir no Excel ou ter sido movida manualmente.',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
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
