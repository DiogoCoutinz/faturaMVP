/**
 * SYNC ENGINE - Orquestrador de Sincronização Gmail → Drive → Supabase
 *
 * Fluxo Completo:
 * 1. Ler emails não lidos do Gmail (com anexos PDF)
 * 2. Download dos anexos
 * 3. Análise com Gemini AI (extração de dados)
 * 4. Upload para Google Drive
 * 5. Salvar no Supabase (com drive_file_id + drive_link)
 * 6. Marcar email como lido
 */

import { supabase } from '@/lib/supabase/client';
import {
  listUnreadInvoices,
  getEmailAttachments,
  getAttachmentData,
  markEmailAsRead
} from './google/gmail';
import { uploadInvoiceToDrive, ensureFolder, getOrCreateYearlySheet } from './google/drive';
import { appendInvoiceToSheet } from './google/sheets';
import { analyzeInvoiceWithGemini, type GeminiInvoiceData } from './gemini';
import type { Invoice } from '@/types/database';

// Erro personalizado para duplicados
class DuplicateInvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateInvoiceError';
  }
}

/**
 * FASE 2B: Verifica se uma fatura já existe no Supabase
 */
// Função para normalizar nomes de fornecedores
function normalizeSupplierName(name: string | null): string | null {
  if (!name) return null;
  const upperName = name.toUpperCase().trim();

  if (upperName.includes('INSTITUTO DOS REGISTOS') ||
      upperName.includes('NOTARIADO') ||
      upperName.includes('REGISTO PREDIAL')) {
    return 'IRN';
  } else if (upperName.includes('PETRÓLEOS DE PORTUGAL') ||
             upperName.includes('GALP ENERGIA')) {
    return 'GALP';
  } else if (upperName.includes('NOS COMUNICAÇÕES') ||
             upperName.includes('NOS SGPS')) {
    return 'NOS';
  }
  return upperName;
}

async function checkDuplicateInvoice(geminiData: GeminiInvoiceData): Promise<void> {
  // Normalizar nome do fornecedor
  geminiData.supplier_name = normalizeSupplierName(geminiData.supplier_name);

  // VERIFICAÇÃO 1: Se tem doc_number, verificar se já existe fatura com MESMO doc_number
  if (geminiData.doc_number) {
    const { data: docDups } = await supabase
      .from('invoices')
      .select('id')
      .ilike('doc_number', geminiData.doc_number);

    if (docDups && docDups.length > 0) {
      throw new DuplicateInvoiceError(
        `Fatura duplicada: ${geminiData.supplier_name} - ${geminiData.doc_date} (${geminiData.doc_number})`
      );
    }
    // Se tem doc_number único, não é duplicado - sair aqui
    return;
  }

  // VERIFICAÇÃO 2: Se não tem doc_number, verificar por fornecedor + data + valor + summary
  // Isto evita falsos positivos quando há múltiplas faturas do mesmo fornecedor no mesmo dia
  const { data, error } = await supabase
    .from('invoices')
    .select('id, summary')
    .ilike('supplier_name', geminiData.supplier_name || '')
    .eq('doc_date', geminiData.doc_date)
    .eq('total_amount', geminiData.total_amount)
    .is('doc_number', null);  // Só comparar com faturas que também não têm doc_number

  if (error) {
    throw error;
  }

  // Só é duplicado se também tiver o mesmo summary (ou ambos vazios)
  if (data && data.length > 0) {
    const summaryMatch = data.some(dup =>
      (dup.summary || '').toLowerCase().trim() === (geminiData.summary || '').toLowerCase().trim()
    );
    if (summaryMatch) {
      throw new DuplicateInvoiceError(
        `Fatura duplicada: ${geminiData.supplier_name} - ${geminiData.doc_date} (sem nº doc)`
      );
    }
  }
}

export interface SyncProgress {
  phase: 'idle' | 'fetching' | 'processing' | 'uploading' | 'saving' | 'done' | 'error';
  message: string;
  current: number;
  total: number;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  processed: number;
  duplicates: number;
  errors: string[];
  invoices: Invoice[];
}

/**
 * FASE 2A: Sincronização completa do Gmail
 */
export async function syncGmailInvoices(
  accessToken: string,
  userId: string | null,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    processed: 0,
    duplicates: 0,
    errors: [],
    invoices: [],
  };

  try {
    // FASE 1: LISTAR EMAILS NÃO LIDOS
    onProgress?.({
      phase: 'fetching',
      message: 'A procurar emails com faturas...',
      current: 0,
      total: 0,
      errors: [],
    });

    const emails = await listUnreadInvoices(accessToken, 20);

    if (emails.length === 0) {
      onProgress?.({
        phase: 'done',
        message: 'Nenhum email novo encontrado',
        current: 0,
        total: 0,
        errors: [],
      });
      return { ...result, success: true };
    }

    // FASE 2: PROCESSAR CADA EMAIL
    let currentIndex = 0;

    for (const email of emails) {
      currentIndex++;

      try {
        onProgress?.({
          phase: 'processing',
          message: `Processando email ${currentIndex}/${emails.length}: ${email.subject}`,
          current: currentIndex,
          total: emails.length,
          errors: result.errors,
        });

        // 2a. Buscar anexos
        const attachments = await getEmailAttachments(accessToken, email.id);

        if (attachments.length === 0) {
          result.errors.push(`Email "${email.subject}" não tem anexos`);
          continue;
        }

        // 2b. Processar cada anexo
        for (const attachment of attachments) {
          // Só processar PDFs
          if (!attachment.filename.toLowerCase().endsWith('.pdf')) {
            continue;
          }

          try {
            // DOWNLOAD DO ANEXO
            const { data, filename, mimeType } = await getAttachmentData(
              accessToken,
              email.id,
              attachment.attachmentId,
              attachment.filename,
              attachment.mimeType
            );

            // ANÁLISE COM GEMINI
            onProgress?.({
              phase: 'processing',
              message: `Analisando ${filename} com IA...`,
              current: currentIndex,
              total: emails.length,
              errors: result.errors,
            });

            const base64Data = btoa(
              data.reduce((acc, byte) => acc + String.fromCharCode(byte), '')
            );

            const geminiData: GeminiInvoiceData = await analyzeInvoiceWithGemini(
              base64Data,
              mimeType
            );

            // VERIFICAR DUPLICADOS
            try {
              await checkDuplicateInvoice(geminiData);
            } catch (dupError) {
              if (dupError instanceof DuplicateInvoiceError) {
                result.duplicates++;
                await markEmailAsRead(accessToken, email.id);
                continue;
              } else {
                throw dupError;
              }
            }

            // FASE 3: RESOLVER ESTRUTURA DE PASTAS
            onProgress?.({
              phase: 'uploading',
              message: `Organizando estrutura de pastas...`,
              current: currentIndex,
              total: emails.length,
              errors: result.errors,
            });

            let year = geminiData.doc_year;
            if (!year || isNaN(year)) {
              try {
                const date = geminiData.doc_date ? new Date(geminiData.doc_date) : new Date();
                year = !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
              } catch {
                year = new Date().getFullYear();
              }
            }

            const rootFolderId = await ensureFolder(accessToken, 'FATURAS');
            const yearFolderId = await ensureFolder(accessToken, year.toString(), rootFolderId);

            let costTypeFolderName = 'Por Classificar';
            if (geminiData.cost_type === 'custo_fixo') {
              costTypeFolderName = 'Custos Fixos';
            } else if (geminiData.cost_type === 'custo_variavel') {
              costTypeFolderName = 'Custos Variáveis';
            }

            const costTypeFolderId = await ensureFolder(accessToken, costTypeFolderName, yearFolderId);

            // GESTÃO DO EXCEL
            const spreadsheetId = await getOrCreateYearlySheet(accessToken, year, yearFolderId);

            // UPLOAD DO PDF
            onProgress?.({
              phase: 'uploading',
              message: `Enviando ${filename} para Google Drive...`,
              current: currentIndex,
              total: emails.length,
              errors: result.errors,
            });

            const pdfFileName = `${geminiData.doc_date}_${geminiData.supplier_name}_${geminiData.total_amount?.toFixed(2) || '0.00'}.pdf`
              .replace(/[/\\?%*:|"<>]/g, '_');

            const driveFile = await uploadInvoiceToDrive(
              accessToken,
              data,
              pdfFileName,
              costTypeFolderId
            );

            // SALVAR NO SUPABASE
            onProgress?.({
              phase: 'saving',
              message: `Guardando dados de ${geminiData.supplier_name}...`,
              current: currentIndex,
              total: emails.length,
              errors: result.errors,
            });

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
              supplier_name: normalizeSupplierName(geminiData.supplier_name),
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
              throw new Error(`Erro ao salvar no DB: ${insertError.message}`);
            }

            result.invoices.push(invoice as Invoice);
            result.processed++;

            // ESCREVER NO GOOGLE SHEETS
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
              // Não falha a sincronização se o Sheets falhar
            }
          } catch (attachmentError) {
            const errorMsg = `Email "${email.subject}" → Anexo "${attachment.filename}": ${
              attachmentError instanceof Error ? attachmentError.message : 'Erro desconhecido'
            }`;
            result.errors.push(errorMsg);
          }
        }

        // MARCAR EMAIL COMO LIDO
        try {
          await markEmailAsRead(accessToken, email.id);
        } catch {
          // Não adiciona aos erros críticos
        }
      } catch (emailError) {
        const errorMsg = `Email "${email.subject}" (${email.from}): ${
          emailError instanceof Error ? emailError.message : 'Erro desconhecido'
        }`;
        result.errors.push(errorMsg);
      }
    }

    // CONCLUÍDO
    onProgress?.({
      phase: 'done',
      message: `Sincronização completa! ${result.processed} faturas processadas.`,
      current: emails.length,
      total: emails.length,
      errors: result.errors,
    });

    result.success = result.processed > 0 || result.errors.length === 0;
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido na sincronização';

    onProgress?.({
      phase: 'error',
      message: `Erro: ${errorMsg}`,
      current: 0,
      total: 0,
      errors: [errorMsg],
    });

    result.errors.push(errorMsg);
    return result;
  }
}
