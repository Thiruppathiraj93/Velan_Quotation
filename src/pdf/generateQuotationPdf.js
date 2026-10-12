
import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib';

// Per the PDF spec, a "%PDF-" header must appear within the first 1024 bytes.
function looksLikePdf(bytes) {
  const view = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 1024));
  return new TextDecoder('latin1').decode(view).includes('%PDF-');
}

export default async function generateQuotationPdf(
  quoteNo,
  specificationUrl = ''
) {
  const el = document.getElementById('quotationPdf');

  if (!el) {
    alert('Quotation preview not found.');
    return;
  }

  const savedZoom = el.style.zoom;
  el.style.zoom = '1';

  try {
    const opt = {
      margin: 0,
      filename: `Quotation_${quoteNo || 'draft'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'],
      },
    };

    // Generate quotation PDF in memory
    const quotationBlob = await html2pdf()
      .set(opt)
      .from(el)
      .outputPdf('blob');

    const quotationBytes = await quotationBlob.arrayBuffer();

    const finalPdf = await PDFDocument.load(quotationBytes);

    // Append specification pages only when a PDF is selected
    if (specificationUrl) {
      const response = await fetch(specificationUrl);

      if (!response.ok) {
        throw new Error(
          `Specification PDF not found: ${specificationUrl}`
        );
      }

      const specificationBytes = await response.arrayBuffer();

      // A server (or SPA fallback) can answer 200 with an HTML page instead of
      // the PDF. Detect that here so we report the exact missing file instead
      // of letting PDF parsing fail with a cryptic error.
      if (!looksLikePdf(specificationBytes)) {
        throw new Error(
          `Specification PDF not found (server returned HTML, not a PDF): ${specificationUrl}`
        );
      }

      const specificationPdf = await PDFDocument.load(
        specificationBytes
      );

      const pages = await finalPdf.copyPages(
        specificationPdf,
        specificationPdf.getPageIndices()
      );

      pages.forEach((page) => finalPdf.addPage(page));
    }

    const finalBytes = await finalPdf.save();

    const blob = new Blob([finalBytes], {
      type: 'application/pdf',
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = downloadUrl;
    link.download = `Quotation_${quoteNo || 'draft'}.pdf`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);
  
  } catch (error) {
    console.error('PDF generation failed:', error);

    alert(
      `PDF Error: ${error?.message || String(error)}`
    );
  } finally {
    el.style.zoom = savedZoom;
  }

}
