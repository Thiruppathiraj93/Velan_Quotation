import html2pdf from 'html2pdf.js';

export default async function generateQuotationPdf(quoteNo) {
  const el = document.getElementById('quotationPdf');
  if (!el) return;
  const savedZoom = el.style.zoom;
  el.style.zoom = '1';
  const opt = {
    margin: 0,
    filename: `Quotation_${quoteNo || 'draft'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };
  await html2pdf().set(opt).from(el).save();
  el.style.zoom = savedZoom;
}
