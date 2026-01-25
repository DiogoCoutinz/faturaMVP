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
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metadataResponse.ok) {
      return false;
    }

    const metadata = await metadataResponse.json();
    const sheet = metadata.sheets?.find(
      (s: any) => s.properties?.title === sheetName
    );

    if (!sheet) {
      return false;
    }

    const sheetId = sheet.properties.sheetId;

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
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        }),
      }
    );

    return deleteResponse.ok;
  } catch {
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

    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

/**
 * Elimina fatura de TODOS os sistemas (Supabase + Sheets + Drive)
 */
export async function deleteInvoiceEverywhere(
  input: DeleteInvoiceInput
): Promise<DeleteInvoiceResult> {
  try {
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

    let deletedFromSheets = false;
    let deletedFromDrive = false;

    if (invoice.spreadsheet_id && invoice.doc_date) {
      const sheetName = getSheetNameFromDate(invoice.doc_date);

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
        deletedFromSheets = await deleteSheetRow(
          input.accessToken,
          invoice.spreadsheet_id,
          sheetName,
          rowIndex
        );
      }
    }

    if (invoice.drive_file_id) {
      deletedFromDrive = await deleteDriveFile(
        input.accessToken,
        invoice.drive_file_id
      );
    }

    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', input.invoiceId)
      .eq('user_id', input.userId);

    if (deleteError) {
      return {
        success: false,
        deletedFromSupabase: false,
        deletedFromSheets,
        deletedFromDrive,
        message: `Erro ao apagar do sistema: ${deleteError.message}`,
        error: deleteError.message,
      };
    }

    return {
      success: true,
      deletedFromSupabase: true,
      deletedFromSheets,
      deletedFromDrive,
      message: 'Fatura eliminada com sucesso!',
    };
  } catch (error) {
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
