import { supabase } from '@/lib/supabase/client';
import { analyzeInvoiceWithGemini, fileToBase64, type GeminiInvoiceData } from '@/lib/gemini';
import { uploadInvoiceToDrive, ensureFolder, getOrCreateYearlySheet } from '@/lib/google/drive';
import { appendInvoiceToSheet } from '@/lib/google/sheets';
import type { Invoice } from '@/types/database';

export interface UploadResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
  isDuplicate?: boolean;
}

/**
 * FASE 3: FLUXO COMPLETO COM ARQUITETURA HIERÁRQUICA
 * 1. Análise com Gemini Vision
 * 2. Verificar duplicados
 * 3. Criar estrutura de pastas (FATURAS/Ano/Tipo)
 * 4. Gestão dinâmica do Excel (EXTRATO_YEAR)
 * 5. Upload para Google Drive (sub-pasta correta)
 * 6. Inserir no Supabase
 * 7. Escrever no Google Sheets
 */
export async function processInvoiceUpload(
  file: File,
  userId: string | null = null,
  accessToken: string | null = null // NOVO: Token Google necessário
): Promise<UploadResult> {
  try {
    // VALIDAÇÃO
    const maxSize = 10 * 1024 * 1024; // 10MB
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
        error: 'Token Google não disponível. Por favor, conecte o Google em /settings.' 
      };
    }

    // PASSO 1: ANÁLISE COM GEMINI
    console.log('🤖 Analisando fatura com IA...');
    const base64Data = await fileToBase64(file);
    const geminiData: GeminiInvoiceData = await analyzeInvoiceWithGemini(base64Data, file.type);

    // PASSO 2: VERIFICAR DUPLICADOS
    let query = supabase
      .from('invoices')
      .select('id, doc_number')
      .eq('supplier_name', geminiData.supplier_name)
      .eq('doc_date', geminiData.doc_date)
      .eq('total_amount', geminiData.total_amount);

    if (geminiData.doc_number) {
      query = query.eq('doc_number', geminiData.doc_number);
    }

    const { data: duplicates, error: dupError } = await query;

    if (dupError) {
      console.error('Erro ao verificar duplicado:', dupError);
      return { success: false, error: `Erro ao verificar duplicado: ${dupError.message}` };
    }

    if (duplicates && duplicates.length > 0) {
      console.warn('⚠️ Fatura DUPLICADA encontrada! ID:', duplicates[0].id);
      return {
        success: false,
        isDuplicate: true,
        error: `Esta fatura já existe no sistema (${geminiData.supplier_name} - ${geminiData.doc_date})`,
      };
    }

    // PASSO 3: CRIAR ESTRUTURA DE PASTAS HIERÁRQUICA
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
    console.log(`📂 Estrutura: FATURAS/${year}/${costTypeFolderName}`);

    // PASSO 4: GESTÃO DINÂMICA DO EXCEL
    const spreadsheetId = await getOrCreateYearlySheet(accessToken, year, yearFolderId);

    // PASSO 5: UPLOAD PARA GOOGLE DRIVE
    const pdfFileName = `${geminiData.doc_date}_${geminiData.supplier_name}_${geminiData.total_amount?.toFixed(2) || '0.00'}.pdf`
      .replace(/[/\\?%*:|"<>]/g, '_');

    // Converter File para Uint8Array (com tratamento de erro)
    let uint8Array: Uint8Array;
    try {
      const arrayBuffer = await file.arrayBuffer();
      uint8Array = new Uint8Array(arrayBuffer);
    } catch (readError) {
      console.error('❌ Erro ao ler ficheiro:', readError);
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

    // PASSO 6: INSERIR NO SUPABASE
    const invoiceData = {
      user_id: userId,

      // STORAGE (Google Drive permanente)
      file_url: driveFile.webViewLink,
      storage_path: null, // Não usamos Supabase Storage
      drive_link: driveFile.webViewLink,
      drive_file_id: driveFile.id,
      spreadsheet_id: spreadsheetId, // ID do Excel (EXTRATO_YEAR)
      
      // DADOS EXTRAÍDOS
      document_type: geminiData.document_type,
      cost_type: geminiData.cost_type,
      doc_date: geminiData.doc_date,
      doc_year: geminiData.doc_year,
      supplier_name: geminiData.supplier_name,
      supplier_vat: geminiData.supplier_vat,
      doc_number: geminiData.doc_number,
      total_amount: geminiData.total_amount,
      summary: geminiData.summary,
      
      // STATUS
      status: geminiData.confidence_score < 70 ? 'review' : 'processed',
      manual_review: geminiData.confidence_score < 70,
    };

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao inserir no DB:', insertError);
      return { 
        success: false, 
        error: `Erro ao guardar dados: ${insertError.message}` 
      };
    }

    // PASSO 7: ESCREVER NO GOOGLE SHEETS
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
    } catch (sheetsError) {
      console.warn('⚠️ Erro ao escrever no Sheets:', sheetsError);
    }

    console.log(`✅ Fatura processada: ${geminiData.supplier_name} - ${geminiData.total_amount}€`);
    
    return { 
      success: true, 
      invoice: invoice as Invoice 
    };

  } catch (error) {
    console.error('Erro no processamento:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
