import { useState, useCallback } from "react";
import { Upload, CheckCircle2, FileText, Loader2, AlertCircle, X, FileWarning, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const WEBHOOK_URL = "https://n8n.diogocoutinho.cloud/webhook/faturapdf";

type ProcessingStep = 
  | "pending"
  | "uploading" 
  | "reading"      // A ler a fatura
  | "detected"     // Fatura detetada
  | "invalid"      // Isto não parece uma fatura
  | "checking"     // Verificar duplicada
  | "duplicate"    // Fatura duplicada detetada
  | "new"          // Nova fatura
  | "saving"       // A guardar...
  | "success"      // Concluído
  | "error";

interface UploadedFile {
  id: string;
  name: string;
  step: ProcessingStep;
  error?: string;
}

const STEP_CONFIG: Record<ProcessingStep, { label: string; color: string }> = {
  pending: { label: "Na fila...", color: "text-muted-foreground" },
  uploading: { label: "A enviar...", color: "text-primary" },
  reading: { label: "A ler a fatura...", color: "text-primary" },
  detected: { label: "Fatura detetada", color: "text-primary" },
  invalid: { label: "Isto não parece uma fatura", color: "text-destructive" },
  checking: { label: "A verificar duplicados...", color: "text-primary" },
  duplicate: { label: "Fatura duplicada detetada", color: "text-warning" },
  new: { label: "Nova fatura", color: "text-success" },
  saving: { label: "A guardar no sistema...", color: "text-primary" },
  success: { label: "Processado com sucesso", color: "text-success" },
  error: { label: "Erro", color: "text-destructive" },
};

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Tipo de ficheiro inválido. Apenas PDF, PNG e JPG são aceites.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Ficheiro demasiado grande. Máximo 10MB.`;
    }
    return null;
  };

  const updateFileStep = (fileId: string, step: ProcessingStep, error?: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, step, error } : f
    ));
  };

  const simulateProcessing = async (fileId: string) => {
    // Simula os passos do n8n enquanto o webhook processa
    const steps: { step: ProcessingStep; delay: number }[] = [
      { step: "reading", delay: 1500 },
      { step: "detected", delay: 1000 },
      { step: "checking", delay: 1500 },
      { step: "new", delay: 800 },
      { step: "saving", delay: 2000 },
    ];

    for (const { step, delay } of steps) {
      updateFileStep(fileId, step);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  };

  const uploadFile = async (file: File, fileId: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("origem", "upload");
    formData.append("app", "FaturaAI");

    try {
      updateFileStep(fileId, "uploading");

      // Inicia o upload e a simulação de estados em paralelo
      const uploadPromise = fetch(WEBHOOK_URL, {
        method: "POST",
        body: formData,
      });

      // Após envio bem sucedido, simula os passos do processamento
      const response = await uploadPromise;
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      // Simula os passos de processamento do n8n
      await simulateProcessing(fileId);

      updateFileStep(fileId, "success");
      toast({ title: "Sucesso", description: `${file.name} processado e guardado.` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha de rede";
      updateFileStep(fileId, "error", errorMessage);
      toast({ title: "Erro", description: `Falha ao processar ${file.name}: ${errorMessage}`, variant: "destructive" });
    }
  };

  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = [];

    Array.from(fileList).forEach((file) => {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const validationError = validateFile(file);

      if (validationError) {
        newFiles.push({ id: fileId, name: file.name, step: "error", error: validationError });
        toast({ title: "Ficheiro rejeitado", description: `${file.name}: ${validationError}`, variant: "destructive" });
      } else {
        newFiles.push({ id: fileId, name: file.name, step: "pending" });
        setTimeout(() => uploadFile(file, fileId), 0);
      }
    });

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = "";
  }, [processFiles]);

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getStatusIcon = (step: ProcessingStep) => {
    switch (step) {
      case "pending":
      case "uploading":
      case "reading":
      case "checking":
      case "saving":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "detected":
      case "new":
        return <FileText className="h-4 w-4 text-primary" />;
      case "invalid":
        return <FileWarning className="h-4 w-4 text-destructive" />;
      case "duplicate":
        return <Copy className="h-4 w-4 text-warning" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getFileRowStyle = (step: ProcessingStep) => {
    if (step === "error" || step === "invalid") return "border-destructive/50 bg-destructive/5";
    if (step === "duplicate") return "border-warning/50 bg-warning/5";
    if (step === "success") return "border-success/50 bg-success/5";
    return "border-border bg-card";
  };

  const isProcessing = (step: ProcessingStep) => {
    return ["pending", "uploading", "reading", "detected", "checking", "new", "saving"].includes(step);
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />

        <div className="animate-fade-in space-y-4">
          <div className={cn(
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full transition-colors",
            isDragging ? "bg-primary/20" : "bg-primary/10"
          )}>
            <Upload className={cn("h-8 w-8 text-primary", isDragging && "animate-bounce")} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">
              {isDragging ? "Larga para fazer upload" : "Arrasta faturas aqui"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              ou clica para selecionar ficheiros
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Suporta PDF, PNG, JPG até 10MB
          </p>
        </div>
      </div>

      {/* File List with Processing States */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-card-foreground">Ficheiros</h4>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3 transition-all duration-300",
                  getFileRowStyle(file.step)
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getStatusIcon(file.step)}
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-card-foreground">{file.name}</span>
                    {isProcessing(file.step) && (
                      <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-full bg-primary animate-pulse rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    STEP_CONFIG[file.step].color
                  )}>
                    {file.error || STEP_CONFIG[file.step].label}
                  </span>
                  {!isProcessing(file.step) && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          As faturas serão processadas automaticamente e os dados extraídos serão guardados no sistema.
        </p>
      </div>
    </div>
  );
}
