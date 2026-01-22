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
 * Critérios: supplier_name + doc_date + total_amount (+ doc_number se existir)
 */
async function checkDuplicateInvoice(geminiData: GeminiInvoiceData): Promise<void> {
  console.log(`🔍 Verificando duplicado: ${geminiData.supplier_name} - €${geminiData.total_amount}...`);

  let query = supabase
    .from('invoices')
    .select('id, doc_number')
    .eq('supplier_name', geminiData.supplier_name)
    .eq('doc_date', geminiData.doc_date)
    .eq('total_amount', geminiData.total_amount);

  // Se tiver número de documento, adicionar à query
  if (geminiData.doc_number) {
    query = query.eq('doc_number', geminiData.doc_number);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao verificar duplicado:', error);
    throw error;
  }

  if (data && data.length > 0) {
    console.warn('⚠️ Fatura DUPLICADA encontrada! ID:', data[0].id);
    throw new DuplicateInvoiceError(
      `Fatura duplicada: ${geminiData.supplier_name} - ${geminiData.doc_date} (${geminiData.doc_number || 'sem nº doc'})`
    );
  }

  console.log('✅ Fatura não é duplicada, pode prosseguir');
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
  duplicates: number; // NOVO: contador de duplicados
  errors: string[];
  invoices: Invoice[];
}

/**
 * FASE 2A: Sincronização completa do Gmail
 * @param accessToken - Provider token do Google (OAuth)
 * @param userId - ID do utilizador no Supabase
 * @param onProgress - Callback para atualizar UI
 */
export async function syncGmailInvoices(
  accessToken: string,
  userId: string | null,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    processed: 0,
    duplicates: 0, // NOVO
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

    console.log(`📧 ${emails.length} emails encontrados`);

    // FASE 2: PROCESSAR CADA EMAIL
    let currentIndex = 0;

    for (const email of emails) {
      currentIndex++;
      
      console.log(`\n📧 [${currentIndex}/${emails.length}] Processando: ${email.subject}`);
      console.log(`   De: ${email.from}`);
      console.log(`   Data: ${email.date}`);

      try {
        onProgress?.({
          phase: 'processing',
          message: `Processando email ${currentIndex}/${emails.length}: ${email.subject}`,
          current: currentIndex,
          total: emails.length,
          errors: result.errors,
        });

        // 2a. Buscar anexos
        console.log(`   🔍 Buscando anexos...`);
        const attachments = await getEmailAttachments(accessToken, email.id);

        if (attachments.length === 0) {
          console.warn(`   ⚠️ Email sem anexos válidos: "${email.subject}"`);
          result.errors.push(`Email "${email.subject}" não tem anexos`);
          continue;
        }
        
        console.log(`   ✅ ${attachments.length} anexo(s) encontrado(s):`, attachments.map(a => a.filename).join(', '));

        // 2b. Processar cada anexo (normalmente 1 PDF por email)
        for (const attachment of attachments) {
          // Só processar PDFs
          if (!attachment.filename.toLowerCase().endsWith('.pdf')) {
            console.log(`   ⏭️ Ignorando não-PDF: ${attachment.filename}`);
            continue;
          }
          
          console.log(`   📄 Processando PDF: ${attachment.filename}`);

          try {
            // DOWNLOAD DO ANEXO (Direto)
            const { data, filename, mimeType } = await getAttachmentData(
              accessToken,
              email.id,
              attachment.attachmentId,
              attachment.filename,
              attachment.mimeType
            );

            // ANÁLISE COM GEMINI (converter Uint8Array → Base64)
            onProgress?.({
              phase: 'processing',
              message: `Analisando ${filename} com IA...`,
              current: currentIndex,
              total: emails.length,
              errors: result.errors,
            });

            // Converter Uint8Array para Base64 de forma compatível com browser
            const base64Data = btoa(
              data.reduce((acc, byte) => acc + String.fromCharCode(byte), '')
            );

            const geminiData: GeminiInvoiceData = await analyzeInvoiceWithGemini(
              base64Data,
              mimeType
            );

            // FASE 2B: VERIFICAR DUPLICADOS
            try {
              await checkDuplicateInvoice(geminiData);
            } catch (dupError) {
              if (dupError instanceof DuplicateInvoiceError) {
                console.log(`   ⚠️ DUPLICADO: ${geminiData.supplier_name}`);
                result.duplicates++;
                // Marcar email como lido para não processar de novo
                await markEmailAsRead(accessToken, email.id);
                continue; // Pular para próximo anexo
              } else {
                throw dupError; // Re-lançar outros erros
              }
            }

            // FASE 3: RESOLVER ESTRUTURA DE PASTAS HIERÁRQUICA
            onProgress?.({
              phase: 'uploading',
              message: `Organizando estrutura de pastas...`,
              current: currentIndex,
              total: emails.length,
              errors: result.errors,
            });

            // Garantir que year é sempre um número válido
            let year = geminiData.doc_year;
            if (!year || isNaN(year)) {
              try {
                const date = geminiData.doc_date ? new Date(geminiData.doc_date) : new Date();
                year = !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
              } catch {
                year = new Date().getFullYear();
              }
            }
            
            // 1. Pasta raiz "FATURAS"
            const rootFolderId = await ensureFolder(accessToken, 'FATURAS');
            
            // 2. Pasta do ano (ex: "2025")
            const yearFolderId = await ensureFolder(accessToken, year.toString(), rootFolderId);
            
            // 3. Sub-pasta baseada no cost_type
            let costTypeFolderName = 'Por Classificar';
            if (geminiData.cost_type === 'custo_fixo') {
              costTypeFolderName = 'Custos Fixos';
            } else if (geminiData.cost_type === 'custo_variavel') {
              costTypeFolderName = 'Custos Variáveis';
            }
            
            const costTypeFolderId = await ensureFolder(accessToken, costTypeFolderName, yearFolderId);
            
            console.log(`   📂 Estrutura: FATURAS/${year}/${costTypeFolderName}`);

            // FASE 3: GESTÃO DINÂMICA DO EXCEL (EXTRATO_YEAR) - À PROVA DE FALHAS
            const spreadsheetId = await getOrCreateYearlySheet(accessToken, year, yearFolderId);

            // FASE 3: UPLOAD DO PDF COM NOME ESTRUTURADO
            onProgress?.({
              phase: 'uploading',
              message: `Enviando ${filename} para Google Drive...`,
              current: currentIndex,
              total: emails.length,
              errors: result.errors,
            });

            const pdfFileName = `${geminiData.doc_date}_${geminiData.supplier_name}_${geminiData.total_amount?.toFixed(2) || '0.00'}.pdf`
              .replace(/[/\\?%*:|"<>]/g, '_'); // Limpar caracteres inválidos

            const driveFile = await uploadInvoiceToDrive(
              accessToken,
              data,
              pdfFileName,
              costTypeFolderId // Upload direto para a sub-pasta correta
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

              // STORAGE (Google Drive permanente)
              file_url: driveFile.webViewLink, // URL de visualização
              storage_path: null, // Não usamos Supabase Storage neste fluxo
              drive_link: driveFile.webViewLink,
              drive_file_id: driveFile.id,
              spreadsheet_id: spreadsheetId, // ID do Excel (EXTRATO_YEAR) para link direto

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
              throw new Error(`Erro ao salvar no DB: ${insertError.message}`);
            }

            result.invoices.push(invoice as Invoice);
            result.processed++;

            console.log(`   ✅ Fatura guardada no Supabase! ID: ${invoice.id}`);

            // FASE 3: ESCREVER NO GOOGLE SHEETS DINÂMICO
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
              
              console.log(`   ✅ Dados escritos no Google Sheets!`);
            } catch (sheetsError) {
              console.error('   ⚠️ Erro ao escrever no Sheets (não crítico):', sheetsError);
              // Não falha a sincronização se o Sheets falhar
            }

            console.log(`   ✅ Fatura processada COMPLETAMENTE: ${geminiData.supplier_name} (€${geminiData.total_amount})`);
          } catch (attachmentError) {
            const errorMsg = `Email "${email.subject}" → Anexo "${attachment.filename}": ${
              attachmentError instanceof Error ? attachmentError.message : 'Erro desconhecido'
            }`;
            console.error(`   ❌ ${errorMsg}`);
            result.errors.push(errorMsg);
            // CONTINUA para o próximo anexo (não para tudo)
          }
        }

        // MARCAR EMAIL COMO LIDO (apenas se processou com sucesso)
        try {
          await markEmailAsRead(accessToken, email.id);
          console.log(`   ✉️ Email marcado como lido`);
        } catch (markError) {
          console.warn(`   ⚠️ Não foi possível marcar como lido:`, markError);
          // Não adiciona aos erros críticos, pois o processamento foi bem-sucedido
        }
      } catch (emailError) {
        const errorMsg = `Email "${email.subject}" (${email.from}): ${
          emailError instanceof Error ? emailError.message : 'Erro desconhecido'
        }`;
        console.error(`   ❌ ERRO CRÍTICO: ${errorMsg}`);
        result.errors.push(errorMsg);
        // CONTINUA para o próximo email (não para a sincronização toda)
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
    console.error('❌ Erro crítico:', errorMsg);

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
