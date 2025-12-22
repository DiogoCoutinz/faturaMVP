import { useState, useCallback } from "react";
import { Upload, CheckCircle2, FileText, Mail, Loader2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const WEBHOOK_URL = "https://n8n.diogocoutinho.cloud/webhook/faturapdf";

type FileStatus = "pending" | "uploading" | "success" | "error";

interface UploadedFile {
  id: string;
  name: string;
  status: FileStatus;
  error?: string;
}

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

  const uploadFile = async (file: File, fileId: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("origem", "upload");
    formData.append("app", "FaturaAI");

    try {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "uploading" as FileStatus } : f));

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "success" as FileStatus } : f));
      toast({ title: "Sucesso", description: `${file.name} enviado para processamento.` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha de rede";
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "error" as FileStatus, error: errorMessage } : f));
      toast({ title: "Erro", description: `Falha ao enviar ${file.name}: ${errorMessage}`, variant: "destructive" });
    }
  };

  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = [];

    Array.from(fileList).forEach((file) => {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const validationError = validateFile(file);

      if (validationError) {
        newFiles.push({ id: fileId, name: file.name, status: "error", error: validationError });
        toast({ title: "Ficheiro rejeitado", description: `${file.name}: ${validationError}`, variant: "destructive" });
      } else {
        newFiles.push({ id: fileId, name: file.name, status: "pending" });
        // Upload each valid file
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

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "uploading":
      case "pending":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusText = (file: UploadedFile) => {
    switch (file.status) {
      case "pending":
      case "uploading":
        return "A enviar...";
      case "success":
        return "Enviado";
      case "error":
        return file.error || "Erro";
    }
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

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-card-foreground">Ficheiros</h4>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                  file.status === "error" ? "border-destructive/50 bg-destructive/5" :
                  file.status === "success" ? "border-success/50 bg-success/5" :
                  "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getStatusIcon(file.status)}
                  <span className="truncate text-sm text-card-foreground">{file.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-xs",
                    file.status === "error" ? "text-destructive" :
                    file.status === "success" ? "text-success" :
                    "text-muted-foreground"
                  )}>
                    {getStatusText(file)}
                  </span>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Import Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-card-foreground">Importar do Email</h4>
            <p className="text-sm text-muted-foreground">
              Liga a tua conta de email para importar faturas automaticamente
            </p>
          </div>
          <Button variant="outline">Ligar Email</Button>
        </div>
      </div>

      {/* Info Footer */}
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          As faturas serão processadas automaticamente e extraídos os dados relevantes.
        </p>
      </div>
    </div>
  );
}
