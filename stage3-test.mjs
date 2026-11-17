// Stage-3 test: selectable-text PDF via the local sidecar + raster fallback.
// Run: node stage3-test.mjs   (needs the dev server on :5173)
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const SHOT_DIR = 'C:/Users/ASUS/AppData/Local/Temp/opencode/velan-smoke';
fs.mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' [' + extra + ']' : '')); }
};

const HEALTH = 'http://127.0.0.1:3199/health';
const sidecarUp = async () => {
  try { return (await fetch(HEALTH, { signal: AbortSignal.timeout(500) })).ok; }
  catch { return false; }
};
const waitSidecar = async (wantUp, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if ((await sidecarUp()) === wantUp) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function openToiletEuropean() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);
  await page.waitForSelector('.product-card');
  await page.locator('.product-card', { hasText: 'Toilet' }).click();
  await page.waitForSelector('.selection select.capacity-select');
  await page.locator('.selection select.capacity-select').selectOption('European');
  await page.locator('.primary-btn', { hasText: 'Continue' }).click();
  await page.waitForSelector('#quotationPdf', { timeout: 15000 });
}

// Quote-only PDF through the app's own entry point (no spec merge).
async function saveQuoteOnly(name) {
  const dl = page.waitForEvent('download', { timeout: 90000 });
  await page.evaluate(async () => {
    const mod = await import('/src/pdf/generateQuotationPdf.js');
    await mod.default('T3-TEST', '');
  });
  const download = await dl;
  const file = path.join(SHOT_DIR, name);
  await download.saveAs(file);
  return fs.readFileSync(file);
}

const pageCount = async (buf) => (await PDFDocument.load(buf)).getPageCount();
const latin1 = (buf) => buf.toString('latin1');

// pdf-lib packs dictionaries into compressed object streams by default, so
// re-save without them to make font dictionaries greppable.
async function plainText(buf) {
  const doc = await PDFDocument.load(buf);
  const plain = await doc.save({ useObjectStreams: false });
  return Buffer.from(plain).toString('latin1');
}
const hasFonts = async (buf) => (await plainText(buf)).includes('/BaseFont');

// The raster fallback draws its text layer with pdf-lib `opacity: 0`, which
// emits an ExtGState with the exact value /ca 0. Chromium's sidecar output
// only ever uses /ca 1 or fractional values, so an exact /ca 0 marks the
// invisible (but selectable) layer and separates it from visible text.
const hasInvisibleLayer = async (buf) => /\/ca 0(?![0-9.])/.test(await plainText(buf));

// True when a page content stream shows text (BT ... Tj/TJ). Raster PDFs
// draw one big image instead, so this separates selectable-text output
// from image-only output regardless of font objects in the file.
function hasTextContent(buf) {
  const s = buf.toString('latin1');
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) break;
    let chunk = buf.subarray(start, end);
    while (chunk.length && (chunk[chunk.length - 1] === 10 || chunk[chunk.length - 1] === 13)) {
      chunk = chunk.subarray(0, chunk.length - 1);
    }
    try {
      const out = zlib.inflateSync(chunk).toString('latin1');
      if (/BT[\s\S]{0,4096}?(Tj|TJ)/.test(out)) return true;
    } catch {
      /* not a Flate stream */
    }
    re.lastIndex = end + 9;
  }
  return false;
}

// ---------- Phase A: sidecar DOWN -> raster fallback still works ----------
check('phase A: sidecar not running', !(await sidecarUp()), 'precondition');
await openToiletEuropean();
const rasterBuf = await saveQuoteOnly('t3-raster.pdf');
check('A: raster PDF starts with %PDF', rasterBuf.subarray(0, 5).toString('latin1') === '%PDF-', `size=${rasterBuf.length}`);
check('A: raster quote = 1 page', (await pageCount(rasterBuf)) === 1, `${await pageCount(rasterBuf)}`);
check('A: raster has invisible selectable text layer', hasTextContent(rasterBuf) && (await hasInvisibleLayer(rasterBuf)), 'Tj ops + /ca 0');
check('A: raster contains image data', latin1(rasterBuf).includes('/Image'), 'has /Image');

// ---------- Phase B: start sidecar ----------
const sidecar = spawn(process.execPath, ['pdf-server.mjs'], { cwd: process.cwd(), stdio: 'ignore' });
check('B: sidecar starts', await waitSidecar(true), 'health ok');

// ---------- Phase C: sidecar UP -> selectable text ----------
await openToiletEuropean(); // fresh state after the fallback run
const textBuf = await saveQuoteOnly('t3-text.pdf');
check('C: text PDF starts with %PDF', textBuf.subarray(0, 5).toString('latin1') === '%PDF-', `size=${textBuf.length}`);
check('C: text quote = 1 page', (await pageCount(textBuf)) === 1, `${await pageCount(textBuf)}`);
check('C: fonts embedded (selectable text)', await hasFonts(textBuf), 'has /BaseFont');
check('C: page content shows text (Tj operators)', hasTextContent(textBuf), 'text operators');
const fontNames = ((await plainText(textBuf)).match(/\/BaseFont\s*\/([^\s/>]+)/g) || []).slice(0, 8);
const fontBlob = fontNames.join(' ').toLowerCase();
check('C: Times/Calibri font present', fontBlob.includes('times') || fontBlob.includes('calibri'), fontNames.join(','));
check('C: text is visible (sidecar, no invisible layer)', !(await hasInvisibleLayer(textBuf)), 'no /ca 0');

// ---------- Phase D: sidecar PDF merges with the spec PDF (button click) ----------
const dlD = page.waitForEvent('download', { timeout: 90000 });
await page.locator('button', { hasText: 'Generate PDF' }).click();
const downloadD = await dlD;
const mergedFile = path.join(SHOT_DIR, 't3-merged.pdf');
await downloadD.saveAs(mergedFile);
const mergedBuf = fs.readFileSync(mergedFile);
const specPages = (await PDFDocument.load(fs.readFileSync('public/specification/Toilet/european toilet.ed.pdf'))).getPageCount();
check('D: merged = quote (1p) + spec', (await pageCount(mergedBuf)) === 1 + specPages, `pages=${await pageCount(mergedBuf)} expected=${1 + specPages}`);
check('D: merged keeps quote text', hasTextContent(mergedBuf) && (await hasFonts(mergedBuf)), 'text + fonts');

// ---------- Phase E: stop sidecar -> silent raster fallback again ----------
await fetch('http://127.0.0.1:3199/shutdown');
check('E: sidecar stops', await waitSidecar(false), 'health down');
const againBuf = await saveQuoteOnly('t3-fallback.pdf');
check('E: fallback PDF works after stop', againBuf.subarray(0, 5).toString('latin1') === '%PDF-' && hasTextContent(againBuf) && (await hasInvisibleLayer(againBuf)), `size=${againBuf.length}`);

const errReport = errors.filter((e) => !e.includes('favicon'));
check('no console/page errors', errReport.length === 0, errReport.slice(0, 3).join(' || '));

try { sidecar.kill(); } catch {}

console.log(`\n${fail === 0 ? 'ALL PASSED' : 'FAILURES'} (${pass} passed, ${fail} failed)`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
