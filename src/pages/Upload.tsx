import { AppLayout } from "@/components/layout/AppLayout";
import { UploadZone } from "@/components/upload/UploadZone";

export default function Upload() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="animate-fade-in text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Upload de Faturas</h1>
          <p className="mt-2 text-muted-foreground">
            Adicione faturas manualmente ou configure a importação automática
          </p>
        </div>

        {/* Upload Zone */}
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <UploadZone />
        </div>
      </div>
    </AppLayout>
  );
}
