import { supabase } from '@/lib/supabase/client';
import { analyzeInvoiceWithGemini, fileToBase64, type GeminiInvoiceData } from '@/lib/gemini';
import type { Invoice } from '@/types/database';

export interface UploadResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

/**
 * FLUXO COMPLETO (FASE 1 - Supabase como Cache):
 * 1. Upload do ficheiro para Supabase Storage (bucket: invoices) [TEMPORÁRIO]
 * 2. Análise com Gemini Vision
 * 3. Inserção na tabela invoices (com storage_path)
 * 
 * FASE 2 (TODO):
 * 4. Upload para Google Drive
 * 5. Atualizar drive_file_id e drive_link na tabela
 * 6. Apagar ficheiro do Supabase Storage
 */
export async function processInvoiceUpload(
  file: File,
  userId: string | null = null
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

    // PASSO 1: UPLOAD PARA SUPABASE STORAGE (Cache Temporário)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `uploads/${userId || 'anonymous'}/${fileName}`;

    console.log('📤 Upload para Supabase Storage:', storagePath);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      return { 
        success: false, 
        error: `Erro ao fazer upload: ${uploadError.message}` 
      };
    }

    // Obter URL público (temporário, até migrar para Drive)
    const { data: publicUrlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(storagePath);

    const fileUrl = publicUrlData.publicUrl;
    console.log('✅ URL público gerado:', fileUrl);

    // PASSO 2: ANÁLISE COM GEMINI
    console.log('🤖 Enviando para Gemini AI...');
    const base64Data = await fileToBase64(file);
    const geminiData: GeminiInvoiceData = await analyzeInvoiceWithGemini(base64Data, file.type);
    console.log('✅ Dados extraídos:', geminiData);

    // PASSO 3: INSERIR NO SUPABASE (com storage_path para referência futura)
    const invoiceData = {
      user_id: userId,
      
      // STORAGE (Cache temporário)
      file_url: fileUrl, // URL público do Supabase
      storage_path: storagePath, // Caminho interno no bucket
      
      // GOOGLE DRIVE (NULL por enquanto, será preenchido na Fase 2)
      drive_link: null, // TODO: Será preenchido após upload para Drive
      drive_file_id: null, // TODO: ID do ficheiro no Google Drive
      
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
      // Rollback: Apagar o ficheiro do storage se o insert falhar
      console.log('🗑️ Removendo ficheiro do storage (rollback)...');
      await supabase.storage.from('invoices').remove([storagePath]);
      
      return { 
        success: false, 
        error: `Erro ao guardar dados: ${insertError.message}` 
      };
    }

    console.log('✅ Fatura processada com sucesso! ID:', invoice.id);
    
    // TODO (FASE 2): Migrar ficheiro para Google Drive
    // 1. Upload do ficheiro para Google Drive usando a Google Drive API
    // 2. Obter drive_file_id e drive_link
    // 3. UPDATE invoices SET drive_file_id = ?, drive_link = ?, status = 'migrated' WHERE id = ?
    // 4. DELETE ficheiro do Supabase Storage: supabase.storage.from('invoices').remove([storagePath])
    
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
