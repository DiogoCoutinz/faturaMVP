import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const N8N_ERROR_WEBHOOK = Deno.env.get("N8N_ERROR_WEBHOOK") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface OAuthToken {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  scopes: string[];
  email?: string;
  is_primary_storage?: boolean;
}

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

interface GeminiInvoiceData {
  is_valid_document: boolean;
  rejection_reason?: string | null;
  document_type: "fatura" | "nota_credito" | "recibo" | "outro" | null;
  cost_type: "custo_fixo" | "custo_variavel" | null;
  doc_year: number | null;
  doc_date: string | null;
  supplier_name: string | null;
  supplier_vat: string | null;
  doc_number: string | null;
  total_amount: number | null;
  tax_amount?: number | null;
  summary: string | null;
  confidence_score: number;
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) {
      console.error("Erro ao refreshar token:", await response.text());
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Erro no refresh:", error);
    return null;
  }
}

async function getValidAccessToken(token: OAuthToken): Promise<string | null> {
  const now = new Date();
  const expiry = new Date(token.token_expiry);
  if (expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
    return token.access_token;
  }
  console.log("Token expirado, refreshando...");
  const refreshed = await refreshGoogleToken(token.refresh_token);
  if (!refreshed) {
    console.error("Falha ao refreshar token");
    return null;
  }
  const newExpiry = new Date(now.getTime() + refreshed.expires_in * 1000);
  await supabase
    .from("user_oauth_tokens")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry.toISOString() })
    .eq("id", token.id);
  console.log("Token refreshado com sucesso");
  return refreshed.access_token;
}

async function listUnreadInvoices(accessToken: string, maxResults: number = 20): Promise<GmailMessage[]> {
  // Buscar emails das últimas 24 horas com anexos
  const query = "newer_than:1d has:attachment";
  console.log("Query Gmail:", query);
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=" + encodeURIComponent(query) + "&maxResults=" + maxResults,
    { headers: { Authorization: "Bearer " + accessToken } }
  );
  if (!response.ok) {
    throw new Error("Erro ao listar emails: " + response.status);
  }
  const data = await response.json();
  if (!data.messages) {
    console.log("Nenhum email encontrado");
    return [];
  }
  const messages: GmailMessage[] = [];
  for (const msg of data.messages) {
    const details = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + msg.id, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (details.ok) {
      const detailData = await details.json();
      const headers = detailData.payload?.headers || [];
      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: headers.find((h: { name: string }) => h.name === "Subject")?.value || "(sem assunto)",
        from: headers.find((h: { name: string }) => h.name === "From")?.value || "(desconhecido)",
        date: headers.find((h: { name: string }) => h.name === "Date")?.value || "",
        snippet: detailData.snippet || "",
      });
    }
  }
  return messages;
}

async function getEmailAttachments(accessToken: string, messageId: string): Promise<GmailAttachment[]> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + messageId, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!response.ok) {
    throw new Error("Erro ao buscar anexos: " + response.status);
  }
  const data = await response.json();
  const attachments: GmailAttachment[] = [];
  function findAttachments(parts: unknown[]): void {
    for (const part of parts) {
      const p = part as { filename?: string; mimeType?: string; body?: { attachmentId?: string; size?: number }; parts?: unknown[] };
      if (p.filename && p.filename.length > 0 && p.body?.attachmentId) {
        attachments.push({
          filename: p.filename,
          mimeType: p.mimeType || "application/pdf",
          size: p.body.size || 0,
          attachmentId: p.body.attachmentId,
        });
      }
      if (p.parts && Array.isArray(p.parts)) {
        findAttachments(p.parts);
      }
    }
  }
  if (data.payload?.parts) {
    findAttachments(data.payload.parts);
  }
  return attachments;
}

async function getAttachmentData(accessToken: string, messageId: string, attachmentId: string): Promise<Uint8Array> {
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/" + messageId + "/attachments/" + attachmentId,
    { headers: { Authorization: "Bearer " + accessToken } }
  );
  if (!response.ok) {
    throw new Error("Erro ao baixar anexo: " + response.status);
  }
  const attachmentData = await response.json();
  const base64Data = attachmentData.data.replace(/-/g, "+").replace(/_/g, "/");
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function markEmailAsRead(accessToken: string, messageId: string): Promise<void> {
  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + messageId + "/modify", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

const GEMINI_PROMPT = "Atua como contabilista. Extrai dados de faturas. supplier_name deve ser nome curto e limpo SEMPRE EM MAIUSCULAS (ex: GALP, FIDELIDADE, WORTEN). cost_type: custo_fixo para despesas recorrentes (seguros, rendas, telecomunicacoes, software), custo_variavel para pontuais (refeicoes, combustivel, material). Responde APENAS com JSON: {is_valid_document: boolean, document_type: fatura|recibo|outro|null, cost_type: custo_fixo|custo_variavel|null, doc_year: number|null, doc_date: YYYY-MM-DD|null, supplier_name: string|null, supplier_vat: string|null, doc_number: string|null, total_amount: number|null, summary: string|null, confidence_score: number}";

async function analyzeWithGemini(pdfBase64: string, mimeType: string): Promise<GeminiInvoiceData> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: GEMINI_PROMPT }, { inlineData: { mimeType: mimeType, data: pdfBase64 } }, { text: "Analisa este documento." }] }],
      }),
    }
  );
  if (!response.ok) {
    throw new Error("Gemini API error: " + response.status);
  }
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleanedText);
}

async function ensureFolder(accessToken: string, folderName: string, parentId: string | null = null): Promise<string> {
  let query = "mimeType='application/vnd.google-apps.folder' and name='" + folderName + "' and trashed=false";
  if (parentId) {
    query += " and '" + parentId + "' in parents";
  }
  const searchResponse = await fetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id)", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  const searchData = await searchResponse.json();
  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }
  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder", parents: parentId ? [parentId] : undefined }),
  });
  const createData = await createResponse.json();
  return createData.id;
}

async function uploadToDrive(accessToken: string, fileData: Uint8Array, fileName: string, parentId: string): Promise<{ id: string; webViewLink: string }> {
  const metadata = { name: fileName, parents: [parentId], mimeType: "application/pdf" };
  const boundary = "-------314159265358979323846";
  let binary = "";
  for (let i = 0; i < fileData.length; i++) {
    binary += String.fromCharCode(fileData[i]);
  }
  const base64Data = btoa(binary);
  const multipartBody =
    "\r\n--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    "\r\n--" + boundary + "\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n" +
    base64Data +
    "\r\n--" + boundary + "--";
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "multipart/related; boundary=\"" + boundary + "\"" },
    body: multipartBody,
  });
  const result = await response.json();
  return { id: result.id, webViewLink: result.webViewLink || "https://drive.google.com/file/d/" + result.id + "/view" };
}

async function checkDuplicate(geminiData: GeminiInvoiceData): Promise<boolean> {
  // Normalizar nome
  geminiData.supplier_name = geminiData.supplier_name?.toUpperCase().trim() || null;

  // Verificar por doc_number primeiro (identificador unico)
  if (geminiData.doc_number) {
    const { data: docDups } = await supabase
      .from("invoices")
      .select("id")
      .ilike("doc_number", geminiData.doc_number);
    if ((docDups?.length || 0) > 0) return true;
  }

  // Verificar por combinacao de campos (case-insensitive)
  const { data } = await supabase
    .from("invoices")
    .select("id")
    .ilike("supplier_name", geminiData.supplier_name || "")
    .eq("doc_date", geminiData.doc_date)
    .eq("total_amount", geminiData.total_amount);
  return (data?.length || 0) > 0;
}

async function syncAccountEmails(
  gmailAccessToken: string,
  storageAccessToken: string,
  userId: string
): Promise<{ processed: number; duplicates: number; errors: string[] }> {
  const result = { processed: 0, duplicates: 0, errors: [] as string[] };
  try {
    const emails = await listUnreadInvoices(gmailAccessToken, 20);
    if (emails.length === 0) {
      console.log("Nenhum email novo");
      return result;
    }
    console.log(emails.length + " emails encontrados");
    for (const email of emails) {
      try {
        console.log("Processando: " + email.subject);
        const attachments = await getEmailAttachments(gmailAccessToken, email.id);
        const pdfAttachments = attachments.filter((a) => a.filename.toLowerCase().endsWith(".pdf"));
        if (pdfAttachments.length === 0) {
          result.errors.push("Email sem PDFs: " + email.subject);
          continue;
        }
        for (const attachment of pdfAttachments) {
          try {
            const pdfData = await getAttachmentData(gmailAccessToken, email.id, attachment.attachmentId);
            let binary = "";
            for (let i = 0; i < pdfData.length; i++) {
              binary += String.fromCharCode(pdfData[i]);
            }
            const base64Data = btoa(binary);
            const geminiData = await analyzeWithGemini(base64Data, "application/pdf");
            if (!geminiData.is_valid_document) {
              result.errors.push(attachment.filename + ": Documento invalido");
              continue;
            }
            const isDuplicate = await checkDuplicate(geminiData);
            if (isDuplicate) {
              console.log("Duplicado: " + geminiData.supplier_name);
              result.duplicates++;
              await markEmailAsRead(gmailAccessToken, email.id);
              continue;
            }
            const year = geminiData.doc_year || new Date().getFullYear();
            // Usar storageAccessToken para todas as operações no Drive (conta de armazenamento principal)
            const rootFolderId = await ensureFolder(storageAccessToken, "FATURAS");
            const yearFolderId = await ensureFolder(storageAccessToken, year.toString(), rootFolderId);
            let costTypeFolderName = "Por Classificar";
            if (geminiData.cost_type === "custo_fixo") costTypeFolderName = "Custos Fixos";
            else if (geminiData.cost_type === "custo_variavel") costTypeFolderName = "Custos Variaveis";
            const costTypeFolderId = await ensureFolder(storageAccessToken, costTypeFolderName, yearFolderId);
            const pdfFileName = (geminiData.doc_date + "_" + geminiData.supplier_name + "_" + (geminiData.total_amount?.toFixed(2) || "0.00") + ".pdf").replace(/[/\\?%*:|"<>]/g, "_");
            const driveFile = await uploadToDrive(storageAccessToken, pdfData, pdfFileName, costTypeFolderId);
            const { error: insertError } = await supabase.from("invoices").insert({
              user_id: userId,
              file_url: driveFile.webViewLink,
              drive_link: driveFile.webViewLink,
              drive_file_id: driveFile.id,
              document_type: geminiData.document_type,
              cost_type: geminiData.cost_type,
              doc_date: geminiData.doc_date,
              doc_year: geminiData.doc_year,
              supplier_name: geminiData.supplier_name?.toUpperCase().trim() || null,
              supplier_vat: geminiData.supplier_vat,
              doc_number: geminiData.doc_number,
              total_amount: geminiData.total_amount,
              summary: geminiData.summary,
              status: geminiData.confidence_score < 70 ? "review" : "processed",
              manual_review: geminiData.confidence_score < 70,
            });
            if (insertError) {
              throw new Error("DB: " + insertError.message);
            }
            result.processed++;
            console.log("Processada: " + geminiData.supplier_name);
          } catch (attachmentError) {
            const msg = attachmentError instanceof Error ? attachmentError.message : "Erro";
            result.errors.push(attachment.filename + ": " + msg);
          }
        }
        await markEmailAsRead(gmailAccessToken, email.id);
      } catch (emailError) {
        const msg = emailError instanceof Error ? emailError.message : "Erro";
        result.errors.push("Email " + email.subject + ": " + msg);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro critico";
    result.errors.push(msg);
  }
  return result;
}

async function sendErrorsToN8n(errors: Array<{ account: string; errors: string[] }>): Promise<void> {
  if (!N8N_ERROR_WEBHOOK || errors.length === 0) return;
  try {
    await fetch(N8N_ERROR_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestamp: new Date().toISOString(), type: "sync_errors", errors: errors }),
    });
    console.log("Erros enviados para n8n");
  } catch (error) {
    console.error("Falha ao enviar para n8n:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }
  console.log("Iniciando sincronizacao automatica...");
  const results: Array<{ user_id: string; email?: string; processed: number; duplicates: number; errors: string[] }> = [];
  try {
    const { data: tokens, error: tokensError } = await supabase.from("user_oauth_tokens").select("*").eq("provider", "google");
    if (tokensError) {
      throw new Error("Erro ao buscar tokens: " + tokensError.message);
    }
    if (!tokens || tokens.length === 0) {
      console.log("Nenhum token configurado");
      return new Response(JSON.stringify({ success: true, message: "Nenhum token configurado", accounts_processed: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Buscar a conta de armazenamento principal (onde os ficheiros serão guardados)
    const storageAccount = (tokens as OAuthToken[]).find(t => t.is_primary_storage);
    if (!storageAccount) {
      throw new Error("Nenhuma conta de armazenamento configurada. Defina uma conta como principal.");
    }

    // Obter token válido para a conta de armazenamento
    const storageAccessToken = await getValidAccessToken(storageAccount);
    if (!storageAccessToken) {
      throw new Error("Falha ao obter token da conta de armazenamento: " + (storageAccount.email || storageAccount.user_id));
    }
    console.log("Conta de armazenamento: " + (storageAccount.email || storageAccount.user_id));

    console.log(tokens.length + " conta(s) para sincronizar");
    for (const token of tokens as OAuthToken[]) {
      const accountLabel = token.email || token.user_id;
      console.log("Processando: " + accountLabel);
      const { data: logData } = await supabase.from("sync_logs").insert({ user_id: token.user_id, started_at: new Date().toISOString(), status: "running", processed_count: 0, duplicate_count: 0, error_count: 0, errors: [], metadata: { email: token.email } }).select("id").single();
      const logId = logData?.id;
      try {
        const accessToken = await getValidAccessToken(token);
        if (!accessToken) {
          const error = "Falha ao obter access token";
          results.push({ user_id: token.user_id, email: token.email, processed: 0, duplicates: 0, errors: [error] });
          if (logId) {
            await supabase.from("sync_logs").update({ completed_at: new Date().toISOString(), status: "failed", errors: [error], error_count: 1 }).eq("id", logId);
          }
          continue;
        }
        const syncResult = await syncAccountEmails(accessToken, storageAccessToken, token.user_id);
        results.push({ user_id: token.user_id, email: token.email, ...syncResult });
        if (logId) {
          await supabase.from("sync_logs").update({ completed_at: new Date().toISOString(), status: syncResult.errors.length > 0 ? (syncResult.processed > 0 ? "partial" : "failed") : "success", processed_count: syncResult.processed, duplicate_count: syncResult.duplicates, error_count: syncResult.errors.length, errors: syncResult.errors }).eq("id", logId);
        }
        console.log(accountLabel + ": " + syncResult.processed + " processadas, " + syncResult.duplicates + " duplicadas, " + syncResult.errors.length + " erros");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        results.push({ user_id: token.user_id, email: token.email, processed: 0, duplicates: 0, errors: [msg] });
        if (logId) {
          await supabase.from("sync_logs").update({ completed_at: new Date().toISOString(), status: "failed", errors: [msg], error_count: 1 }).eq("id", logId);
        }
      }
    }
    const accountsWithErrors = results.filter((r) => r.errors.length > 0).map((r) => ({ account: r.email || r.user_id, errors: r.errors }));
    await sendErrorsToN8n(accountsWithErrors);
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    console.log("Sincronizacao completa! Total: " + totalProcessed + " processadas, " + totalDuplicates + " duplicadas, " + totalErrors + " erros");
    return new Response(JSON.stringify({ success: true, accounts_processed: results.length, total_processed: totalProcessed, total_duplicates: totalDuplicates, total_errors: totalErrors, details: results }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro critico";
    console.error("Erro fatal:", msg);
    await sendErrorsToN8n([{ account: "SYSTEM", errors: [msg] }]);
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
