import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.warn('⚠️ VITE_GEMINI_API_KEY não configurada no .env');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Prompt de sistema para análise contabilística
 */
const SYSTEM_PROMPT = `# ROLE
Atua como um CONTABILISTA SÉNIOR especializado em imobiliário e automação de dados. O teu objetivo é extrair dados com precisão cirúrgica de documentos financeiros para a empresa "Pirâmide Visionária".

# OBJECTIVO
Processar imagens/PDFs e devolver um JSON estruturado para classificação de custos (FIXOS vs VARIÁVEIS), garantindo que nada se perde.

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
- supplier_name: Nome curto e limpo (ex: "Galp" em vez de "Petróleos de Portugal, S.A.").
- total_amount: Valor total com impostos. Usa ponto para decimais (ex: 12.50). Nunca uses vírgulas.
- summary: Resumo telegráfico (Max 5 palavras). Ex: "Almoço cliente Braga" ou "Subscrição Canva".

# OUTPUT FORMAT (JSON ONLY)
Deves responder APENAS com este objeto JSON, sem markdown, sem texto antes ou depois:

{
  "document_type": "fatura" | "nota_credito" | "outro",
  "cost_type": "custo_fixo" | "custo_variavel" | null,
  "doc_year": number,
  "doc_date": "YYYY-MM-DD",
  "supplier_name": "string",
  "supplier_vat": "string" | null,
  "doc_number": "string",
  "total_amount": number,
  "tax_amount": number | null,
  "summary": "string",
  "confidence_score": number (0-100)
}`;

/**
 * Interface do resultado esperado do Gemini
 */
export interface GeminiInvoiceData {
  document_type: 'fatura' | 'nota_credito' | 'outro';
  cost_type: 'custo_fixo' | 'custo_variavel' | null;
  doc_year: number;
  doc_date: string;
  supplier_name: string;
  supplier_vat: string | null;
  doc_number: string;
  total_amount: number;
  tax_amount?: number | null;
  summary: string;
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
    // Usar modelo Gemini 2.0 Flash (mais rápido) ou 1.5 Pro
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp' // ou 'gemini-1.5-pro'
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

    // Validação básica
    if (!data.supplier_name || !data.doc_date || data.total_amount === undefined) {
      throw new Error('Dados incompletos extraídos pelo Gemini');
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
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}
