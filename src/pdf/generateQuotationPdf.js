
import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib';
import {
  installTextLayerCapture,
  resetTextLayerCapture,
  drawCapturedTextLayer,
} from './textLayer';

// Wrap html2pdf's worker so the raster pages get an invisible, selectable
// text layer when the sidecar is not available. Safe to call repeatedly.
installTextLayerCapture();

// Local sidecar (start with `npm run pdf-server`) renders the quotation with
// headless Chromium, so the generated PDF has selectable / copyable text.
// When the sidecar is not running - or fails for any reason - the existing
// raster (html2pdf) pipeline below is used instead, silently.
const SIDECAR_URL = 'http://127.0.0.1:3199';

// Per the PDF spec, a "%PDF-" header must appear within the first 1024 bytes.
function looksLikePdf(bytes) {
  const view = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 1024));
  return new TextDecoder('latin1').decode(view).includes('%PDF-');
}

async function sidecarAvailable() {
  try {
    const res = await fetch(`${SIDECAR_URL}/health`, {
      signal: AbortSignal.timeout(700),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Serialize the live preview element into a standalone HTML document: all
// applied CSS plus every image as a data URI (the sidecar page runs on its
// own origin and cannot resolve the app's asset paths).
async function buildRenderHtml(el) {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + '\n';
    } catch {
      // Cross-origin stylesheet - not needed for the quotation preview.
    }
  }

  const clone = el.cloneNode(true);
  const sourceImgs = Array.from(el.querySelectorAll('img'));
  const clonedImgs = Array.from(clone.querySelectorAll('img'));

  await Promise.all(
    sourceImgs.map(async (img, i) => {
      try {
        const src = img.currentSrc || img.src;
        if (!src || src.startsWith('data:')) return;
        const response = await fetch(src);
        if (!response.ok) return;
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        if (clonedImgs[i]) clonedImgs[i].setAttribute('src', dataUrl);
      } catch {
        // Keep the original src; worst case one image spot stays blank.
      }
    })
  );

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html, body { margin: 0; padding: 0; background: #fff; }
${css}
</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>`;
}

async function renderViaSidecar(el) {
  const html = await buildRenderHtml(el);
  const response = await fetch(`${SIDECAR_URL}/render-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, width: '794px', height: '1123px' }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`PDF sidecar HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Existing raster pipeline: html2canvas renders the preview to an image and
// html2pdf wraps it into PDF pages. The pages themselves stay image-based, so
// drawCapturedTextLayer() overlays the same lines at opacity 0 - invisible,
// but selectable and searchable like the text layer of a scanned document.
async function renderViaRaster(el) {
  resetTextLayerCapture();
  const opt = {
    margin: 0,
    filename: 'Quotation_draft.pdf', // unused: we take the blob output
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

  const quotationBlob = await html2pdf()
    .set(opt)
    .from(el)
    .outputPdf('blob');

  const quotationBytes = await quotationBlob.arrayBuffer();

  // Overlay the invisible text layer. Any failure here falls back to the
  // plain raster PDF rather than breaking the download.
  try {
    const pdf = await PDFDocument.load(quotationBytes);
    await drawCapturedTextLayer(pdf);
    return await pdf.save();
  } catch (err) {
    console.warn('PDF text layer skipped:', err);
    return new Uint8Array(quotationBytes);
  }
}

// Append the specification pages when one is selected. Returns final bytes.
async function mergeSpecification(bytes, specificationUrl) {
  const finalPdf = await PDFDocument.load(bytes);

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

    const specificationPdf = await PDFDocument.load(specificationBytes);

    const pages = await finalPdf.copyPages(
      specificationPdf,
      specificationPdf.getPageIndices()
    );

    pages.forEach((page) => finalPdf.addPage(page));
  }

  return finalPdf.save();
}

function downloadPdf(bytes, quoteNo) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = `Quotation_${quoteNo || 'draft'}.pdf`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(downloadUrl);
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
    // Preferred: selectable-text PDF via the local sidecar.
    let bytes = null;
    if (await sidecarAvailable()) {
      try {
        bytes = await renderViaSidecar(el);
      } catch (err) {
        console.warn('PDF sidecar failed, falling back to raster PDF:', err);
      }
    }

    // Fallback: the original raster pipeline (works fully offline).
    if (!bytes) {
      bytes = await renderViaRaster(el);
    }

    const finalBytes = await mergeSpecification(bytes, specificationUrl);
    downloadPdf(finalBytes, quoteNo);
  } catch (error) {
    console.error('PDF generation failed:', error);

    alert(
      `PDF Error: ${error?.message || String(error)}`
    );
  } finally {
    el.style.zoom = savedZoom;
  }
}
