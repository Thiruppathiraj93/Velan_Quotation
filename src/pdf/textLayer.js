// Adds a selectable/searchable text layer to the rasterized quotation PDF.
//
// html2pdf renders the preview through html2canvas, which produces image-only
// pages: the PDF looks right, but no text can be selected, copied or searched.
// This module measures every line of text on the clone that html2pdf renders
// (after the pagebreak plugin has inserted its padding, so the geometry matches
// the raster exactly), then draws those lines into the generated PDF at
// opacity 0 — invisible on screen, yet fully selectable and searchable, the
// same technique used for the text layer on scanned documents.

import html2pdf from 'html2pdf.js';
import { StandardFonts } from 'pdf-lib';

// html2pdf hands out a new Worker promise at every chain step, so state has to
// live in module scope. PDF generation is serialised (the download button is
// disabled while one runs), so a single slot is enough. On dev HMR this module
// is re-evaluated and re-patches the prototype; the newer wrapper runs outside
// the older one and overwrites the slot last, so the freshest measurement wins.
let capture = null;
let installed = false;

export function resetTextLayerCapture() {
  capture = null;
}

export function installTextLayerCapture() {
  if (installed) return;
  const Worker = html2pdf && html2pdf.Worker;
  if (!Worker || !Worker.prototype || !Worker.prototype.toContainer) return;
  installed = true;

  // Wraps html2pdf's own toContainer — and its pagebreak plugin, which wrapped
  // the same method at import time — so this runs last and sees the clone
  // exactly as html2canvas will rasterize it.
  const origToContainer = Worker.prototype.toContainer;
  Worker.prototype.toContainer = function toContainerWithTextCapture() {
    const self = this;
    return origToContainer.call(self).then(function captureTextLines() {
      try {
        const container = self.prop && self.prop.container;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const htmlOpt = (self.opt && self.opt.html2canvas) || {};
        capture = {
          lines: collectTextLines(container, rect),
          width: rect.width,
          height: rect.height,
          scale:
            typeof htmlOpt.scale === 'number' && htmlOpt.scale > 0
              ? htmlOpt.scale
              : 2,
          pageSize: (self.prop && self.prop.pageSize) || null,
          canvas: null,
        };
      } catch (err) {
        console.warn('PDF text layer: could not measure preview', err);
        capture = null;
      }
    });
  };

  // The canvas (and with it the exact pixel size html2canvas produced) only
  // exists once toCanvas has rendered, and the overlay is detached right
  // after, so the geometry is captured above and the canvas read here.
  const origToCanvas = Worker.prototype.toCanvas;
  Worker.prototype.toCanvas = function toCanvasWithTextCapture() {
    const self = this;
    return origToCanvas.call(self).then(function captureCanvas() {
      try {
        if (capture) capture.canvas = (self.prop && self.prop.canvas) || null;
      } catch (err) {
        console.warn('PDF text layer: could not capture canvas', err);
      }
    });
  };
}

/* -------------------------------------------------------------------------- */
/* Measurement                                                                */
/* -------------------------------------------------------------------------- */

function collectTextLines(container, containerRect) {
  const lines = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  for (const textNode of textNodes) {
    const raw = textNode.nodeValue;
    if (!raw || !/\S/.test(raw)) continue;
    const parent = textNode.parentElement;
    if (!parent) continue;
    const style = getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const fontSize = parseFloat(style.fontSize);
    if (!fontSize || !isFinite(fontSize)) continue;

    const font = describeFont(style);
    for (const line of splitByLineBoxes(textNode, raw, range)) {
      const text = line.text.replace(/[\r\n\t]/g, ' ');
      if (!/\S/.test(text)) continue;
      lines.push({
        text,
        x: line.left - containerRect.left,
        y: line.top - containerRect.top,
        height: line.height,
        size: fontSize,
        font,
      });
    }
  }
  return lines;
}

function describeFont(style) {
  const family = String(style.fontFamily || '').toLowerCase();
  const sans = family.includes('sans');
  const serif =
    !sans &&
    (family.includes('times') ||
      family.includes('serif') ||
      family.includes('georgia') ||
      family.includes('roman'));
  const weight = String(style.fontWeight || '');
  const bold =
    weight === 'bold' ||
    weight === 'bolder' ||
    (parseInt(weight, 10) || 0) >= 600;
  const italic =
    style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  return { family: serif ? 'times' : 'helvetica', bold, italic };
}

// Split a text node into visual lines. A node that renders on a single line
// takes a fast path; wrapped or pre-formatted text is walked character by
// character so every line gets its own box. Two boxes belong to the same line
// when they overlap vertically by at least half the shorter one — that keeps
// runs with different font sizes (bold lead-ins, coloured numbering) together
// on one line instead of splitting them apart.
function splitByLineBoxes(textNode, text, range) {
  range.selectNodeContents(textNode);
  const whole = Array.from(range.getClientRects()).filter(
    (r) => r.height > 0
  );
  if (whole.length === 1 && !/[\n\r]/.test(text)) {
    return [
      { text, left: whole[0].left, top: whole[0].top, height: whole[0].height },
    ];
  }

  const lines = [];
  let cur = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') {
      cur = null;
      continue;
    }
    range.setStart(textNode, i);
    range.setEnd(textNode, i + 1);
    const rects = range.getClientRects();
    const r = rects.length ? rects[0] : null;
    if (!r || (r.width === 0 && r.height === 0)) continue;

    if (cur && overlapsLine(cur, r)) {
      if (r.right > cur.right) cur.right = r.right;
      if (r.left < cur.left) cur.left = r.left;
      const bottom = Math.max(cur.top + cur.height, r.top + r.height);
      cur.top = Math.min(cur.top, r.top);
      cur.height = bottom - cur.top;
      cur.text += ch;
    } else {
      cur = {
        text: ch,
        left: r.left,
        right: r.right,
        top: r.top,
        height: r.height,
      };
      lines.push(cur);
    }
  }
  return lines.map((l) => ({
    text: l.text,
    left: l.left,
    top: l.top,
    height: l.height,
  }));
}

function overlapsLine(line, r) {
  const overlap =
    Math.min(line.top + line.height, r.top + r.height) -
    Math.max(line.top, r.top);
  const minH = Math.min(line.height, r.height);
  return overlap >= minH * 0.5;
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

// Characters WinAnsi (the encoding of the PDF standard fonts) cannot hold,
// mapped to something searchable instead of dropping the line entirely.
const FALLBACK_CHARS = {
  '\u20b9': 'Rs.', // ₹
  '\u2713': 'v', // ✓
  '\u2717': 'x', // ✗
  '\u2192': '->', // →
  '\u2190': '<-', // ←
  '\u2264': '<=', // ≤
  '\u2265': '>=', // ≥
  '\u221e': 'inf', // ∞
};

function toSafeText(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x20 && cp <= 0x7e) {
      out += ch;
    } else if (FALLBACK_CHARS[ch]) {
      out += FALLBACK_CHARS[ch];
    } else {
      out += ch; // WinAnsi-safe Unicode (– × ' " …) or dropped below
    }
  }
  return out;
}

// Last resort for anything still unencodable: keep the line searchable as
// plain ASCII rather than failing the download.
function toAsciiOnly(text) {
  return text.replace(/[^\x20-\x7e]/g, ' ');
}

// Draw the captured lines as invisible text on the rasterized pages. Must be
// called after PDFDocument.load and before any specification pages are
// appended, so page indices 0..n-1 still line up with the raster.
export async function drawCapturedTextLayer(pdfDoc) {
  if (!capture || !capture.canvas || !capture.lines || !capture.lines.length) {
    return 0;
  }
  const { lines, canvas, pageSize, scale } = capture;
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  if (!canvasW || !canvasH || !pdfDoc.getPageCount()) return 0;

  // Same page slicing html2pdf applied (worker.js: pxPageHeight).
  const first = pdfDoc.getPage(0).getSize();
  const ratio =
    pageSize && pageSize.inner && pageSize.inner.ratio
      ? pageSize.inner.ratio
      : first.height / first.width;
  const pxPageHeight = Math.floor(canvasW * ratio);
  if (!pxPageHeight) return 0;
  const rasterPages = Math.min(
    Math.ceil(canvasH / pxPageHeight),
    pdfDoc.getPageCount()
  );

  const fonts = new Map();
  const getFont = async ({ family, bold, italic }) => {
    const key = `${family}|${bold ? 1 : 0}|${italic ? 1 : 0}`;
    if (!fonts.has(key)) {
      const name =
        family === 'times'
          ? bold
            ? italic
              ? StandardFonts.TimesRomanBoldItalic
              : StandardFonts.TimesRomanBold
            : italic
              ? StandardFonts.TimesRomanItalic
              : StandardFonts.TimesRoman
          : bold
            ? italic
              ? StandardFonts.HelveticaBoldOblique
              : StandardFonts.HelveticaBold
            : italic
              ? StandardFonts.HelveticaOblique
              : StandardFonts.Helvetica;
      fonts.set(key, await pdfDoc.embedFont(name));
    }
    return fonts.get(key);
  };

  let drawn = 0;
  for (const line of lines) {
    // DOM (CSS px) → html2canvas px → PDF pt, mirroring html2pdf's slicing:
    // every canvas row maps to page space at the same pt-per-canvas-px
    // factor, because each slice is drawn at full page width.
    const xCanvas = line.x * scale;
    const yCanvas = line.y * scale;
    const pageIdx = Math.floor(yCanvas / pxPageHeight);
    if (pageIdx < 0 || pageIdx >= rasterPages) continue;

    const page = pdfDoc.getPage(pageIdx);
    const { width: pageW, height: pageH } = page.getSize();
    const ptPerCanvasPx = pageW / canvasW;
    const xPt = xCanvas * ptPerCanvasPx;
    const yTopPt = (yCanvas - pageIdx * pxPageHeight) * ptPerCanvasPx;
    const sizePt = line.size * scale * ptPerCanvasPx;
    // Baseline sits about half the line box down plus the font's ascent bias.
    const lineHPt = line.height * scale * ptPerCanvasPx;
    const yPt = pageH - yTopPt - lineHPt / 2 - sizePt * 0.35;

    if (xPt < -1 || xPt > pageW + 1 || yPt < -1 || yPt > pageH + 1) continue;

    const font = await getFont(line.font);
    const text = toSafeText(line.text);
    if (!text.trim()) continue;
    try {
      page.drawText(text, { x: xPt, y: yPt, size: sizePt, font, opacity: 0 });
      drawn++;
    } catch (err) {
      try {
        page.drawText(toAsciiOnly(text), {
          x: xPt,
          y: yPt,
          size: sizePt,
          font,
          opacity: 0,
        });
        drawn++;
      } catch (err2) {
        // Unencodable line: drop it rather than fail the whole download.
      }
    }
  }
  return drawn;
}
