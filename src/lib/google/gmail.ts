/**
 * GOOGLE GMAIL SERVICE
 * Responsável por ler emails e extrair anexos (faturas)
 * 
 * REQUISITOS:
 * - Provider Token do Supabase Auth (OAuth Google)
 * - Scope: https://www.googleapis.com/auth/gmail.readonly
 */

import { google } from 'googleapis';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  hasAttachments: boolean;
}

export interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  data?: string; // Base64 encoded
}

/**
 * Cria cliente do Gmail autenticado
 */
export function createGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.gmail({ version: 'v1', auth });
}

/**
 * Lista emails com filtro (ex: label:INBOX, has:attachment)
 * @param accessToken - Token OAuth
 * @param query - Query de pesquisa (ex: "subject:fatura has:attachment")
 * @param maxResults - Número máximo de resultados
 */
export async function listEmails(
  accessToken: string,
  query: string = 'has:attachment',
  maxResults: number = 10
): Promise<GmailMessage[]> {
  try {
    const gmail = createGmailClient(accessToken);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxResults,
    });

    if (!response.data.messages) {
      console.log('📧 Nenhum email encontrado com a query:', query);
      return [];
    }

    // Buscar detalhes de cada mensagem
    const messages: GmailMessage[] = [];

    for (const message of response.data.messages) {
      const details = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = details.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(sem assunto)';
      const from = headers.find(h => h.name === 'From')?.value || '(desconhecido)';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      messages.push({
        id: message.id!,
        threadId: message.threadId!,
        subject,
        from,
        date,
        snippet: details.data.snippet || '',
        hasAttachments: !!(details.data.payload?.parts?.some(p => p.filename)),
      });
    }

    console.log(`✅ ${messages.length} emails encontrados`);
    return messages;
  } catch (error) {
    console.error('❌ Erro ao listar emails:', error);
    throw error;
  }
}

/**
 * Obtém anexos de um email específico
 * @param accessToken - Token OAuth
 * @param messageId - ID da mensagem
 */
export async function getEmailAttachments(
  accessToken: string,
  messageId: string
): Promise<GmailAttachment[]> {
  try {
    const gmail = createGmailClient(accessToken);

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    const parts = message.data.payload?.parts || [];
    const attachments: GmailAttachment[] = [];

    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }
    }

    console.log(`📎 ${attachments.length} anexos encontrados no email ${messageId}`);
    return attachments;
  } catch (error) {
    console.error('❌ Erro ao buscar anexos:', error);
    throw error;
  }
}

/**
 * Download de anexo específico
 * @param accessToken - Token OAuth
 * @param messageId - ID da mensagem
 * @param attachmentId - ID do anexo
 */
export async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ data: string; mimeType: string }> {
  try {
    const gmail = createGmailClient(accessToken);

    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });

    if (!attachment.data.data) {
      throw new Error('Anexo vazio');
    }

    // O Gmail retorna em base64url, precisamos converter para base64 normal
    const base64Data = attachment.data.data
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    console.log('✅ Anexo baixado com sucesso');
    return {
      data: base64Data,
      mimeType: 'application/pdf', // Assumindo PDF por padrão
    };
  } catch (error) {
    console.error('❌ Erro ao baixar anexo:', error);
    throw error;
  }
}

// TODO (Fase 2 - Automação):
// - Marcar emails como lidos após processar
// - Filtrar emails por remetente específico (ex: fornecedores conhecidos)
// - Webhook/Polling para emails novos
// - Gestão de erros de rate limit do Gmail API
