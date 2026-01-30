import { supabase } from '@/lib/supabase/client';
import { analyzeInvoiceWithGemini, fileToBase64, type GeminiInvoiceData } from '@/lib/gemini';
import { uploadInvoiceToDrive, ensureFolder, getOrCreateYearlySheet, getTokenInfo } from '@/lib/google/drive';
import { appendInvoiceToSheet } from '@/lib/google/sheets';
import type { Invoice } from '@/types/database';

export interface UploadResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
  isDuplicate?: boolean;
}

/**
 * FLUXO COMPLETO COM ARQUITETURA HIERÁRQUICA
 */
export async function processInvoiceUpload(
  file: File,
  userId: string | null = null,
  accessToken: string | null = null
): Promise<UploadResult> {
  try {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'Ficheiro demasiado grande (max 10MB)' };
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Formato não suportado. Use JPG, PNG ou PDF.' };
    }

    if (!accessToken) {
      return {
        success: false,
        error: 'Por favor, adicione uma conta Google em Automações primeiro.'
      };
    }

    // Verificar scopes do token ANTES de começar o processamento
    console.log('[processInvoiceUpload] A verificar scopes do token...');
    const tokenInfo = await getTokenInfo(accessToken);
    if (tokenInfo) {
      console.log('[processInvoiceUpload] Scopes:', tokenInfo.scopes);
      console.log('[processInvoiceUpload] Email:', tokenInfo.email);

      const hasDriveScope = tokenInfo.scopes.some(
        s => s === 'https://www.googleapis.com/auth/drive' ||
             s === 'https://www.googleapis.com/auth/drive.file'
      );
      const hasSheetsScope = tokenInfo.scopes.some(
        s => s === 'https://www.googleapis.com/auth/spreadsheets'
      );

      if (!hasDriveScope) {
        return {
          success: false,
          error: `Token sem permissão de Google Drive. Scopes atuais: [${tokenInfo.scopes.join(', ')}]. ` +
                 `Vá a https://myaccount.google.com/permissions, remova o acesso desta app, e reconecte a conta em Automações.`
        };
      }

      // drive.file é limitado - só funciona com ficheiros criados pela app
      if (tokenInfo.scopes.includes('https://www.googleapis.com/auth/drive.file') &&
          !tokenInfo.scopes.includes('https://www.googleapis.com/auth/drive')) {
        console.warn('[processInvoiceUpload] AVISO: Token com drive.file (limitado) em vez de drive (completo)');
      }

      if (!hasSheetsScope) {
        console.warn('[processInvoiceUpload] AVISO: Token sem permissão de Google Sheets');
      }
    } else {
      console.warn('[processInvoiceUpload] Não foi possível verificar scopes do token');
    }

    const base64Data = await fileToBase64(file);
    const geminiData: GeminiInvoiceData = await analyzeInvoiceWithGemini(base64Data, file.type);

    geminiData.supplier_name = geminiData.supplier_name?.toUpperCase().trim() || null;

    let isDuplicate = false;

    // VERIFICAÇÃO 1: Se tem doc_number, verificar se já existe fatura com MESMO doc_number
    if (geminiData.doc_number) {
      const { data: docDups } = await supabase
        .from('invoices')
        .select('id')
        .ilike('doc_number', geminiData.doc_number);
      if (docDups && docDups.length > 0) isDuplicate = true;
    }

    // VERIFICAÇÃO 2: Se não tem doc_number, verificar por fornecedor + data + valor + summary
    // Isto evita falsos positivos quando há múltiplas faturas do mesmo fornecedor no mesmo dia
    if (!isDuplicate && !geminiData.doc_number) {
      const { data: fieldDups } = await supabase
        .from('invoices')
        .select('id, summary')
        .ilike('supplier_name', geminiData.supplier_name || '')
        .eq('doc_date', geminiData.doc_date)
        .eq('total_amount', geminiData.total_amount)
        .is('doc_number', null);  // Só comparar com faturas que também não têm doc_number

      // Só é duplicado se também tiver o mesmo summary (ou ambos vazios)
      if (fieldDups && fieldDups.length > 0) {
        const summaryMatch = fieldDups.some(dup =>
          (dup.summary || '').toLowerCase().trim() === (geminiData.summary || '').toLowerCase().trim()
        );
        if (summaryMatch) isDuplicate = true;
      }
    }

    if (isDuplicate) {
      return {
        success: false,
        isDuplicate: true,
        error: `Esta fatura já existe no sistema (${geminiData.supplier_name} - ${geminiData.doc_date})`,
      };
    }

    const year = geminiData.doc_year || new Date().getFullYear();
    const rootFolderId = await ensureFolder(accessToken, 'FATURAS');
    const yearFolderId = await ensureFolder(accessToken, year.toString(), rootFolderId);

    let costTypeFolderName = 'Por Classificar';
    if (geminiData.cost_type === 'custo_fixo') {
      costTypeFolderName = 'Custos Fixos';
    } else if (geminiData.cost_type === 'custo_variavel') {
      costTypeFolderName = 'Custos Variáveis';
    }

    const costTypeFolderId = await ensureFolder(accessToken, costTypeFolderName, yearFolderId);

    const spreadsheetId = await getOrCreateYearlySheet(accessToken, year, yearFolderId);

    const pdfFileName = `${geminiData.doc_date}_${geminiData.supplier_name}_${geminiData.total_amount?.toFixed(2) || '0.00'}.pdf`
      .replace(/[/\\?%*:|"<>]/g, '_');

    let uint8Array: Uint8Array;
    try {
      const arrayBuffer = await file.arrayBuffer();
      uint8Array = new Uint8Array(arrayBuffer);
    } catch {
      return {
        success: false,
        error: 'Não foi possível ler o ficheiro. O ficheiro pode estar corrompido ou inacessível.'
      };
    }

    const driveFile = await uploadInvoiceToDrive(
      accessToken,
      uint8Array,
      pdfFileName,
      costTypeFolderId
    );

    const invoiceData = {
      user_id: userId,
      file_url: driveFile.webViewLink,
      storage_path: null,
      drive_link: driveFile.webViewLink,
      drive_file_id: driveFile.id,
      spreadsheet_id: spreadsheetId,
      document_type: geminiData.document_type,
      cost_type: geminiData.cost_type,
      doc_date: geminiData.doc_date,
      doc_year: geminiData.doc_year,
      supplier_name: geminiData.supplier_name,
      supplier_vat: geminiData.supplier_vat,
      doc_number: geminiData.doc_number,
      total_amount: geminiData.total_amount,
      summary: geminiData.summary,
      status: geminiData.confidence_score < 70 ? 'review' : 'processed',
      manual_review: geminiData.confidence_score < 70,
    };

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (insertError) {
      return {
        success: false,
        error: `Erro ao guardar dados: ${insertError.message}`
      };
    }

    try {
      await appendInvoiceToSheet(accessToken, spreadsheetId, {
        doc_date: geminiData.doc_date,
        supplier_name: geminiData.supplier_name,
        supplier_vat: geminiData.supplier_vat,
        cost_type: geminiData.cost_type,
        doc_number: geminiData.doc_number,
        total_amount: geminiData.total_amount,
        tax_amount: geminiData.tax_amount,
        summary: geminiData.summary,
        drive_link: driveFile.webViewLink,
      });
    } catch {
      // Continue without Sheets
    }

    return {
      success: true,
      invoice: invoice as Invoice
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}
