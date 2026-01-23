import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.warn('⚠️ VITE_GEMINI_API_KEY não configurada no .env');
}

// Lazy initialization - só cria quando API key existir
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY não está configurada. Adicione ao ficheiro .env');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Prompt de sistema para análise contabilística
 */
const SYSTEM_PROMPT = `# ROLE
Atua como um CONTABILISTA SÉNIOR especializado em imobiliário e automação de dados. O teu objetivo é extrair dados com precisão cirúrgica de documentos financeiros para a empresa "Pirâmide Visionária".

# OBJECTIVO
Processar imagens/PDFs e devolver um JSON estruturado para classificação de custos (FIXOS vs VARIÁVEIS), garantindo que nada se perde.

# VALIDAÇÃO INICIAL (CRÍTICO)
Antes de tudo, verifica se a imagem/documento é realmente uma FATURA, RECIBO ou documento financeiro válido.
- Se for uma foto de pessoa, selfie, paisagem, objeto aleatório, meme, etc. → is_valid_document = false
- Se for um documento financeiro legível (fatura, recibo, nota de crédito) → is_valid_document = true
- Se for um documento mas ilegível/muito desfocado → is_valid_document = false, rejection_reason = "documento_ilegivel"

# REGRAS DE CLASSIFICAÇÃO (CRÍTICO)

1. TIPO DE DOCUMENTO (document_type):
   - "fatura": Comprovativo de despesa fiscal.
   - "nota_credito": Correção de valor (redução).
   - "recibo": Comprovativo de pagamento (se não houver fatura).
   - "outro": Documentos não fiscais.

2. TIPO DE CUSTO (cost_type):
   - "custo_fixo": Despesas recorrentes/estruturais.
     Examples: Seguros (Fidelidade, Ocidental), Rendas, Telecomunicações, Software (Canva, CapCut, CRM), Avenças mensais, Eletricidade/Água.
   - "custo_variavel": Despesas pontuais/operacionais.
     Examples: Refeições de negócios, Combustível, Estacionamento, Uber/Táxi, Brindes, Decoração pontual, Consultorias únicas.
   - null: Se não for uma despesa (ex: nota de crédito ou documento ilegível).

# EXTRAÇÃO DE DADOS
- doc_date: Formato YYYY-MM-DD. Se dia/mês for ambíguo, assume padrão PT (DD-MM-AAAA).
- supplier_name: Nome curto e limpo, SEMPRE EM MAIÚSCULAS (ex: "GALP" em vez de "Petróleos de Portugal, S.A.", "FIDELIDADE" em vez de "Fidelidade Seguros").
- total_amount: Valor total com impostos. Usa ponto para decimais (ex: 12.50). Nunca uses vírgulas.
- summary: Resumo telegráfico (Max 5 palavras). Ex: "Almoço cliente Braga" ou "Subscrição Canva".

# OUTPUT FORMAT (JSON ONLY)
Deves responder APENAS com este objeto JSON, sem markdown, sem texto antes ou depois:

{
  "is_valid_document": boolean,
  "rejection_reason": "nao_e_documento" | "documento_ilegivel" | "nao_e_fatura" | null,
  "document_type": "fatura" | "nota_credito" | "recibo" | "outro" | null,
  "cost_type": "custo_fixo" | "custo_variavel" | null,
  "doc_year": number | null,
  "doc_date": "YYYY-MM-DD" | null,
  "supplier_name": "string" | null,
  "supplier_vat": "string" | null,
  "doc_number": "string" | null,
  "total_amount": number | null,
  "tax_amount": number | null,
  "summary": "string" | null,
  "confidence_score": number (0-100)
}

Se is_valid_document = false, podes deixar os outros campos como null.`;

/**
 * Interface do resultado esperado do Gemini
 */
export interface GeminiInvoiceData {
  is_valid_document: boolean;
  rejection_reason?: 'nao_e_documento' | 'documento_ilegivel' | 'nao_e_fatura' | null;
  document_type: 'fatura' | 'nota_credito' | 'recibo' | 'outro' | null;
  cost_type: 'custo_fixo' | 'custo_variavel' | null;
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

/**
 * Analisa uma imagem/PDF de fatura usando Gemini Vision
 * @param fileData - Dados do ficheiro em base64
 * @param mimeType - Tipo MIME (image/jpeg, image/png, application/pdf)
 */
export async function analyzeInvoiceWithGemini(
  fileData: string,
  mimeType: string
): Promise<GeminiInvoiceData> {
  try {
    // Usar modelo Gemini 2.5 Pro (mais potente para análise de imagem)
    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.5-pro'
    });

    const imagePart = {
      inlineData: {
        data: fileData,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      imagePart,
      'Analisa este documento e devolve o JSON conforme o formato especificado.'
    ]);

    const response = await result.response;
    const text = response.text();

    // Limpar possível markdown (```json ... ```)
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse do JSON
    const data: GeminiInvoiceData = JSON.parse(cleanedText);

    // Verificar se é um documento válido
    if (!data.is_valid_document) {
      const errorMessages: Record<string, string> = {
        'nao_e_documento': 'Isto não parece ser uma fatura ou documento financeiro. Por favor, envie uma imagem de fatura, recibo ou nota de crédito.',
        'documento_ilegivel': 'O documento está ilegível ou muito desfocado. Por favor, envie uma imagem com melhor qualidade.',
        'nao_e_fatura': 'Este documento não é uma fatura de despesa. Apenas faturas de gastos/custos são aceites.',
      };
      const reason = data.rejection_reason || 'nao_e_documento';
      throw new Error(errorMessages[reason] || errorMessages['nao_e_documento']);
    }

    // Validação básica dos campos necessários
    if (!data.supplier_name || !data.doc_date || data.total_amount === undefined || data.total_amount === null) {
      throw new Error('Não foi possível extrair todos os dados da fatura. Verifique se a imagem está completa e legível.');
    }

    return data;
  } catch (error) {
    console.error('Erro ao analisar com Gemini:', error);
    throw new Error(
      error instanceof Error 
        ? `Falha na análise: ${error.message}` 
        : 'Erro desconhecido ao processar documento'
    );
  }
}

/**
 * Converte File para Base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remover o prefixo "data:image/jpeg;base64," para enviar só a string
      const parts = result.split(',');
      if (parts.length < 2 || !parts[1]) {
        reject(new Error('Formato de ficheiro inválido ou ficheiro corrompido'));
        return;
      }
      const base64 = parts[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}
