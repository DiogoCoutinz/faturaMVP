/**
 * FASE 4: DELETE BIDIRECIONAL
 * Elimina fatura do Supabase, Google Sheets e Google Drive
 */

import { supabase } from '@/lib/supabase/client';
import { findInvoiceRowIndex, getSheetNameFromDate } from './sheets-updater';

export interface DeleteInvoiceInput {
  invoiceId: string;
  userId: string;
  accessToken: string;
}

export interface DeleteInvoiceResult {
  success: boolean;
  deletedFromSupabase: boolean;
  deletedFromSheets: boolean;
  deletedFromDrive: boolean;
  message: string;
  error?: string;
}

/**
 * Apaga uma linha específica no Google Sheets
 */
async function deleteSheetRow(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
): Promise<boolean> {
  try {
    // Primeiro precisamos do sheetId (não o nome, o ID numérico)
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metadataResponse.ok) {
      console.error('   ❌ Erro ao obter metadados do spreadsheet');
      return false;
    }

    const metadata = await metadataResponse.json();
    const sheet = metadata.sheets?.find(
      (s: any) => s.properties?.title === sheetName
    );

    if (!sheet) {
      console.warn(`   ⚠️ Aba "${sheetName}" não encontrada`);
      return false;
    }

    const sheetId = sheet.properties.sheetId;

    // Apagar a linha usando batchUpdate
    const deleteResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // API usa índice 0-based
                  endIndex: rowIndex,
                },
              },
            },
          ],
        }),
      }
    );

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      console.error(`   ❌ Erro ao apagar linha do Sheets: ${error}`);
      return false;
    }

    console.log(`   ✅ Linha ${rowIndex} apagada do Sheets`);
    return true;
  } catch (error) {
    console.error('   ❌ Erro ao apagar linha do Sheets:', error);
    return false;
  }
}

/**
 * Apaga um ficheiro do Google Drive
 */
async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      console.error(`   ❌ Erro ao apagar ficheiro do Drive: ${error}`);
      return false;
    }

    console.log(`   ✅ Ficheiro apagado do Drive`);
    return true;
  } catch (error) {
    console.error('   ❌ Erro ao apagar ficheiro do Drive:', error);
    return false;
  }
}

/**
 * Elimina fatura de TODOS os sistemas (Supabase + Sheets + Drive)
 */
export async function deleteInvoiceEverywhere(
  input: DeleteInvoiceInput
): Promise<DeleteInvoiceResult> {
  console.log('🔴 ========== DELETE INVOICE EVERYWHERE ==========');
  console.log('🔴 Invoice ID:', input.invoiceId);

  try {
    // PASSO 1: Obter dados da fatura antes de apagar
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', input.invoiceId)
      .eq('user_id', input.userId)
      .single();

    if (fetchError || !invoice) {
      return {
        success: false,
        deletedFromSupabase: false,
        deletedFromSheets: false,
        deletedFromDrive: false,
        message: 'Fatura não encontrada',
        error: fetchError?.message,
      };
    }

    console.log('🔴 Fatura encontrada:', invoice.supplier_name);
    console.log('🔴 Drive file ID:', invoice.drive_file_id);
    console.log('🔴 Spreadsheet ID:', invoice.spreadsheet_id);

    let deletedFromSheets = false;
    let deletedFromDrive = false;

    // PASSO 2: Apagar do Google Sheets (se existir)
    if (invoice.spreadsheet_id && invoice.doc_date) {
      const sheetName = getSheetNameFromDate(invoice.doc_date);
      console.log(`🔴 Procurando linha no Sheets (aba: ${sheetName})...`);

      const rowIndex = await findInvoiceRowIndex(
        input.accessToken,
        invoice.spreadsheet_id,
        sheetName,
        {
          doc_number: invoice.doc_number,
          supplier_name: invoice.supplier_name,
          total_amount: invoice.total_amount,
          doc_date: invoice.doc_date,
        }
      );

      if (rowIndex) {
        console.log(`🔴 Linha encontrada: ${rowIndex}`);
        deletedFromSheets = await deleteSheetRow(
          input.accessToken,
          invoice.spreadsheet_id,
          sheetName,
          rowIndex
        );
      } else {
        console.warn('🔴 Linha não encontrada no Sheets');
      }
    }

    // PASSO 3: Apagar do Google Drive (se existir)
    if (invoice.drive_file_id) {
      console.log('🔴 Apagando ficheiro do Drive...');
      deletedFromDrive = await deleteDriveFile(
        input.accessToken,
        invoice.drive_file_id
      );
    }

    // PASSO 4: Apagar do Supabase
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', input.invoiceId)
      .eq('user_id', input.userId);

    if (deleteError) {
      console.error('🔴 ❌ Erro ao apagar do Supabase:', deleteError.message);
      return {
        success: false,
        deletedFromSupabase: false,
        deletedFromSheets,
        deletedFromDrive,
        message: `Erro ao apagar do sistema: ${deleteError.message}`,
        error: deleteError.message,
      };
    }

    console.log('🔴 ✅ Apagado do Supabase');
    console.log('🔴 ========== FIM DELETE ==========');

    return {
      success: true,
      deletedFromSupabase: true,
      deletedFromSheets,
      deletedFromDrive,
      message: 'Fatura eliminada com sucesso!',
    };
  } catch (error) {
    console.error('🔴 ❌ Erro no delete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      deletedFromSupabase: false,
      deletedFromSheets: false,
      deletedFromDrive: false,
      message: `Erro ao eliminar: ${errorMessage}`,
      error: errorMessage,
    };
  }
}
