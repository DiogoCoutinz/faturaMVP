import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

interface InvoiceToExport {
  supplier_name: string | null;
  doc_date: string | null;
  total_amount: number | null;
  drive_file_id: string | null;
  drive_link: string | null;
}

export async function exportInvoicesToZip(
  invoices: InvoiceToExport[],
  accessToken: string,
  zipName: string = 'faturas.zip'
) {
  if (!invoices.length) {
    toast.error('Nenhuma fatura para exportar');
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder("faturas");
  
  toast.info(`A preparar exportação de ${invoices.length} faturas...`);

  let successCount = 0;
  let failCount = 0;

  // Process invoices in batches to avoid overwhelming Google API or browser memory
  const batchSize = 5;
  for (let i = 0; i < invoices.length; i += batchSize) {
    const batch = invoices.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (invoice) => {
      if (!invoice.drive_file_id) {
        failCount++;
        return;
      }

      try {
        // Download file from Google Drive
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${invoice.drive_file_id}?alt=media`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!response.ok) throw new Error('Falha no download do ficheiro');

        const blob = await response.blob();
        
        // Generate a clean filename
        const dateStr = invoice.doc_date || 'sem-data';
        const supplierStr = (invoice.supplier_name || 'desconhecido').replace(/[/\\?%*:|"<>]/g, '_');
        const amountStr = (invoice.total_amount || 0).toFixed(2);
        const fileName = `${dateStr}_${supplierStr}_${amountStr}.pdf`;

        folder?.file(fileName, blob);
        successCount++;
      } catch (error) {
        console.error(`Erro ao descarregar fatura ${invoice.drive_file_id}:`, error);
        failCount++;
      }
    }));
  }

  if (successCount === 0) {
    toast.error('Não foi possível descarregar nenhuma fatura.');
    return;
  }

  // Generate ZIP and download
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, zipName);

  if (failCount > 0) {
    toast.warning(`Exportação concluída: ${successCount} sucesso, ${failCount} falhas.`);
  } else {
    toast.success(`Exportação de ${successCount} faturas concluída com sucesso!`);
  }
}
