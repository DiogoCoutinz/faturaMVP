/**
 * GOOGLE GMAIL REST API (Browser-Compatible)
 * Usa fetch direto para leitura de emails
 */

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
}

/**
 * Lista emails não lidos com anexos (TODOS os anexos, não só faturas)
 */
export async function listUnreadInvoices(
  accessToken: string,
  maxResults: number = 20
): Promise<GmailMessage[]> {
  const currentYear = new Date().getFullYear();

  // Query simplificada: busca TODOS os emails com anexos
  const query = [
    'is:unread',
    'has:attachment',
    `after:${currentYear}/01/01`,
  ].join(' ');

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao listar emails: ${response.status}`);
  }

  const data = await response.json();

  if (!data.messages) {
    return [];
  }

  const messages: GmailMessage[] = [];

  for (const msg of data.messages) {
    const details = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (details.ok) {
      const detailData = await details.json();
      const headers = detailData.payload?.headers || [];

      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: headers.find((h: { name: string; value: string }) => h.name === 'Subject')?.value || '(sem assunto)',
        from: headers.find((h: { name: string; value: string }) => h.name === 'From')?.value || '(desconhecido)',
        date: headers.find((h: { name: string; value: string }) => h.name === 'Date')?.value || '',
        snippet: detailData.snippet || '',
        hasAttachments: !!(detailData.payload?.parts?.some((p: { filename?: string }) => p.filename)),
      });
    }
  }

  return messages;
}

interface PayloadPart {
  mimeType: string;
  filename?: string;
  body?: {
    attachmentId?: string;
    size?: number;
  };
  parts?: PayloadPart[];
}

/**
 * Obtém anexos de um email específico
 */
export async function getEmailAttachments(
  accessToken: string,
  messageId: string
): Promise<GmailAttachment[]> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar anexos: ${response.status}`);
  }

  const data = await response.json();
  const attachments: GmailAttachment[] = [];

  function findAttachments(parts: PayloadPart[]): void {
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/pdf',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }

      if (part.parts && Array.isArray(part.parts)) {
        findAttachments(part.parts);
      }
    }
  }

  if (data.payload?.parts) {
    findAttachments(data.payload.parts);
  }

  return attachments;
}

/**
 * FASE 2A: Download direto do anexo
 */
export async function getAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string,
  filename: string = 'anexo.pdf',
  mimeType: string = 'application/pdf'
): Promise<{ data: Uint8Array; filename: string; mimeType: string }> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao baixar anexo: ${response.status} - ${errorText}`);
  }

  const attachmentData = await response.json();

  if (!attachmentData.data) {
    throw new Error('Resposta da API não contém dados (base64)');
  }

  const base64Data = attachmentData.data
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    data: bytes,
    filename,
    mimeType,
  };
}

/**
 * FASE 2A: Marca email como lido
 */
export async function markEmailAsRead(
  accessToken: string,
  messageId: string
): Promise<void> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao marcar como lido: ${response.status}`);
  }
}
