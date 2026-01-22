/**
 * GOOGLE GMAIL REST API (Browser-Compatible)
 * Usa fetch direto para leitura de emails
 * Docs: https://developers.google.com/gmail/api/reference/rest
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
 * FASE 2A: Lista emails não lidos com anexos (faturas)
 * Query ESTRITA para evitar lixo: apenas emails recentes de 2026
 */
export async function listUnreadInvoices(
  accessToken: string,
  maxResults: number = 20
): Promise<GmailMessage[]> {
  const currentYear = new Date().getFullYear();
  
  const query = [
    'label:unread',
    'has:attachment',
    `subject:(fatura OR invoice OR recibo)`,
    `after:${currentYear}/01/01`, // Apenas emails do ano corrente
  ].join(' ');

  console.log('🔍 Query Gmail:', query);
  console.log('📅 Filtrando apenas emails de:', currentYear);

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
    console.log('📧 Nenhum email encontrado');
    return [];
  }

  // Buscar detalhes de cada mensagem (FORMATO COMPLETO, como no n8n)
  const messages: GmailMessage[] = [];

  for (const msg of data.messages) {
    const details = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, // SEM format=metadata (busca completo)
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
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '(sem assunto)',
        from: headers.find((h: any) => h.name === 'From')?.value || '(desconhecido)',
        date: headers.find((h: any) => h.name === 'Date')?.value || '',
        snippet: detailData.snippet || '',
        hasAttachments: !!(detailData.payload?.parts?.some((p: any) => p.filename)),
      });
    }
  }

  console.log(`✅ ${messages.length} emails encontrados`);
  return messages;
}

/**
 * Obtém anexos de um email específico
 * RECURSIVO para lidar com emails multipart/nested (IGUAL AO N8N)
 */
export async function getEmailAttachments(
  accessToken: string,
  messageId: string
): Promise<GmailAttachment[]> {
  // BUSCAR MENSAGEM COMPLETA (como n8n faz com "Get a message")
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, // SEM format=metadata
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

  console.log('🔍 DEBUG getEmailAttachments:');
  console.log('   - messageId:', messageId);
  console.log('   - payload.mimeType:', data.payload?.mimeType);
  console.log('   - payload.parts:', data.payload?.parts?.length || 0);
  console.log('📋 PAYLOAD COMPLETO (JSON):', JSON.stringify(data.payload, null, 2));

  // Função recursiva para encontrar anexos em parts aninhados
  function findAttachments(parts: any[], depth: number = 0): void {
    const indent = '  '.repeat(depth + 1);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`${indent}Part[${i}]: ${part.mimeType} | filename: ${part.filename || '(vazio)'} | attachmentId: ${part.body?.attachmentId ? 'SIM' : 'NÃO'}`);
      
      // Se tem filename E attachmentId → é anexo VÁLIDO
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        console.log(`${indent}✅ ANEXO ENCONTRADO: "${part.filename}"`);
        console.log(`${indent}   → Attachment ID COMPLETO: ${part.body.attachmentId}`);
        console.log(`${indent}   → MimeType: ${part.mimeType}`);
        console.log(`${indent}   → Size: ${part.body.size} bytes`);
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/pdf',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      } else {
        // Debug de parts que NÃO são anexos
        if (part.filename) {
          console.log(`${indent}⚠️ Part tem filename mas SEM attachmentId:`, part.filename);
        }
      }
      
      // Se tem sub-parts, procurar recursivamente
      if (part.parts && Array.isArray(part.parts)) {
        console.log(`${indent}↳ Entrando em ${part.parts.length} sub-parts...`);
        findAttachments(part.parts, depth + 1);
      }
    }
  }

  if (data.payload?.parts) {
    findAttachments(data.payload.parts);
  }

  console.log(`✅ Total de ${attachments.length} anexos encontrados no email ${messageId}`);
  
  if (attachments.length === 0) {
    console.warn('⚠️ NENHUM ANEXO ENCONTRADO! Payload completo:', JSON.stringify(data.payload, null, 2));
  }
  
  return attachments;
}

/**
 * FASE 2A: Download direto do anexo (Simplificado)
 * Confia no attachmentId recebido da listagem inicial
 */
export async function getAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string,
  filename: string = 'anexo.pdf',
  mimeType: string = 'application/pdf'
): Promise<{ data: Uint8Array; filename: string; mimeType: string }> {
  try {
    console.log(`📥 Download direto iniciado: ${filename}`);
    console.log(`   - ID Anexo: ${attachmentId.substring(0, 50)}...`);
    
    // Chamada direta ao endpoint de anexos do Gmail
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

    // Converter base64url → base64 → Uint8Array
    const base64Data = attachmentData.data
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Decode base64 para Uint8Array (compatível com browser e node)
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`✅ Download concluído: ${filename} (${(bytes.length / 1024).toFixed(2)} KB)`);

    return {
      data: bytes,
      filename,
      mimeType,
    };
  } catch (error) {
    console.error('❌ Erro crítico no download direto:', error);
    throw error;
  }
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

  console.log('✅ Email marcado como lido:', messageId);
}
