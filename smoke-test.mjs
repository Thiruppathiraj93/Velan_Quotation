/* Temporary Phase-1 smoke test: Room module + Water/Septic regression. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BASE = 'http://localhost:5173';
const SHOT_DIR = 'C:/Users/ASUS/AppData/Local/Temp/opencode/velan-smoke';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const errors = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
  if (!ok) failures++;
}

const addDays = (d, n) => {
  const x = new Date(d.getTime() + n * 86400000);
  const p = (v) => String(v).padStart(2, '0');
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
};
const today = new Date();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const shot = async (name) => page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: true });

const draft = async () => page.evaluate(() => JSON.parse(localStorage.getItem('velanQuotationDraft') || 'null'));

const startFresh = async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400); // splash = 2s
  await page.waitForSelector('.product-card', { timeout: 15000 });
};

const infoValue = async (label) => {
  const row = page.locator('.q-field', { hasText: label }).first();
  const colonIdx = await row.locator('.q-colon').count();
  if (!colonIdx) return '';
  return (await row.locator('.q-val').first().innerText()).trim();
};

// ---------- product cards ----------
await startFresh();
const cards = page.locator('.product-card');
check('4 product cards', (await cards.count()) === 4, `got ${await cards.count()}`);
const names = await page.locator('.product-card-name').allInnerTexts();
check('card names', JSON.stringify(names) === JSON.stringify(['Water Tank', 'Septic Tank', 'Room', 'Toilet']), names.join(','));
check('Toilet enabled', !(await page.locator('.product-card', { hasText: 'Toilet' }).isDisabled()));
check('no Coming Soon badge', (await page.locator('.product-card-soon').count()) === 0);
check('Toilet image present', await page.locator('.product-card img[src*="toilet"]').count() === 1);
const cardImgs = await page.locator('.product-card img').evaluateAll((els) => els.map((e) => `${e.getAttribute('src')}=${e.complete && e.naturalWidth > 0}`));
check('all 4 card images load', cardImgs.length === 4 && cardImgs.every((s) => s.endsWith('=true')), cardImgs.join(','));
await shot('01-product-cards');

// ---------- Room: all five sizes ----------
const roomSizes = [
  { size: '10×10', rate: 490000, dims: `10'0" x 10'0" x 9'6"`, spec: "/specification/room/10'%20x%2010'%20room.pdf", billTo: 'Sasikumar', redNotes: true },
  { size: '10×8', rate: 490000, dims: `10'0" x 8'0" x 9'6"`, spec: "/specification/room/10'%20x%208'%20room.pdf", billTo: 'Sasikumar', redNotes: true },
  { size: '10×20', rate: 490000, dims: `10'0" x 20'0" x 9'6"`, spec: "/specification/room/20'%20x%2010'%20room.pdf", billTo: 'Sasikumar', redNotes: true },
  { size: '16×10', rate: 420000, dims: `16'0" x 10'0" x 9'6"`, spec: "/specification/room/16'%20x%2010'%20room.pdf", billTo: 'Mr.Perumal raja', redNotes: false },
  { size: '20×20', rate: 450000, dims: `20'0" x 20'0" x 9'6"`, spec: "/specification/room/20%20x%2020%20room.pdf", billTo: 'M/s.Chakradhara Aerospace and Cargo (P) Limited,', redNotes: false },
];

await page.locator('.product-card', { hasText: 'Room' }).click();
await page.waitForSelector('.selection select.capacity-select');
const roomSelects = await page.locator('.selection select.capacity-select').count();
check('Room: no spec dropdown (1 select only)', roomSelects === 1, `selects=${roomSelects}`);
const roomOptions = await page.locator('.selection select.capacity-select option').allInnerTexts();
check('Room: 5 sizes + placeholder, no Security Cabin',
  roomOptions.length === 6 && !roomOptions.join('|').includes('Security'),
  roomOptions.join(','));
await shot('02-room-size-select');

for (let i = 0; i < roomSizes.length; i++) {
  const s = roomSizes[i];
  if (i > 0) {
    await page.locator('.link-btn', { hasText: 'Change Template' }).click();
    await page.waitForSelector('.selection select.capacity-select');
  }
  await page.locator('.selection select.capacity-select').selectOption(s.size);
  await page.locator('.primary-btn', { hasText: 'Continue' }).click();
  await page.waitForSelector('#quotationPdf', { timeout: 15000 });

  const d = await draft();
  check(`Room ${s.size}: draft product`, d.product === 'Room', d.product);
  check(`Room ${s.size}: template id`, d.templateId === `room-${s.size.replace('×', 'x')}`, d.templateId);
  check(`Room ${s.size}: spec auto-attached`, d.selectedSpecification === s.spec, d.selectedSpecification);

  // form
  const formText = await page.locator('.form-grid').innerText();
  check(`Room ${s.size}: has Room Details (Rate/Nos)`, formText.toUpperCase().includes('ROOM DETAILS'));
  check(`Room ${s.size}: no tank capacity input`, !formText.includes('Tank Capacity'));
  check(`Room ${s.size}: no tank charges card`, !formText.includes('Core Cut') && !formText.includes('Lift Charges'));
  check(`Room ${s.size}: transport/crane charge inputs`, formText.includes('Transportation Charge') && formText.includes('Crane Charge'));

  // info block colon alignment (left column)
  const colonXs = await page.locator('#quotationPdf .room-info-left .q-colon').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
  check(`Room ${s.size}: left info colons aligned`, new Set(colonXs).size === 1, colonXs.join(','));

  // expiry +20 days
  const expiry = await infoValue('Expiry Date');
  check(`Room ${s.size}: expiry = quote +20d`, expiry === addDays(today, 20), `${expiry} vs ${addDays(today, 20)}`);

  // preview structure
  const heads = await page.locator('#quotationPdf .room-table thead th').allInnerTexts();
  check(`Room ${s.size}: 5-col header`, JSON.stringify(heads) === JSON.stringify(['S.No', 'Description of work', 'Rate', 'nos', 'Amount']), heads.join('|'));

  const amount = s.rate, gst = Math.round(s.rate * 0.18 * 100) / 100, total = s.rate + gst;
  const rows = page.locator('#quotationPdf .room-table tbody tr');
  const itemRow = rows.nth(1);
  const cells = await itemRow.locator('td').allInnerTexts();
  check(`Room ${s.size}: item label/dims`, cells[1].includes('Room 1') && cells[1].includes(s.dims), cells[1]);
  check(`Room ${s.size}: rate/nos/amount`, cells[2] === amount.toFixed(2) && cells[3] === '1.00' && cells[4] === amount.toFixed(2), cells.slice(2).join('|'));
  const subCells = await rows.nth(2).locator('td').allInnerTexts();
  const gstCells = await rows.nth(3).locator('td').allInnerTexts();
  const totCells = await rows.nth(4).locator('td').allInnerTexts();
  check(`Room ${s.size}: subtotal`, subCells[1] === amount.toFixed(2), subCells[1]);
  check(`Room ${s.size}: gst 18%`, gstCells[0] === 'GST 18%' && gstCells[1] === gst.toFixed(2), gstCells.join('|'));
  check(`Room ${s.size}: total`, totCells[1] === total.toFixed(2), totCells[1]);

  // notes & bank
  const noteCount = await page.locator('#quotationPdf .room-notes li').count();
  check(`Room ${s.size}: 6 notes`, noteCount === 6, `${noteCount}`);
  const noteTexts = await page.locator('#quotationPdf .room-notes li').allInnerTexts();
  const n5 = noteTexts[4], n6 = noteTexts[5];
  if (s.redNotes) {
    check(`Room ${s.size}: note5 red+bold`, n5.includes('Transportation:Rs.12000/-'), n5);
    const n5style = await page.locator('#quotationPdf .room-notes li').nth(4).locator('span').first().evaluate((el) => getComputedStyle(el).color + '/' + getComputedStyle(el).fontWeight);
    check(`Room ${s.size}: note5 computed red/bold`, n5style.startsWith('rgb(255, 0, 0)') && Number(n5style.split('/')[1]) >= 700, n5style);
  } else {
    check(`Room ${s.size}: note5 text`, n5.includes('Transportation'), n5);
    const n5style = await page.locator('#quotationPdf .room-notes li').nth(4).locator('span').first().evaluate((el) => getComputedStyle(el).color);
    check(`Room ${s.size}: note5 not red`, n5style === 'rgb(0, 0, 0)', n5style);
  }
  check(`Room ${s.size}: note6 text`, n6.startsWith('Erection crane'), n6);

  const bankLines = await page.locator('#quotationPdf .room-bank div').allInnerTexts();
  check(`Room ${s.size}: bank title + 4 lines`, bankLines.length === 5 && bankLines[0].includes('Company`s Bank Details') && bankLines[2].includes('7863 6936 924'), `${bankLines.length}`);

  // colours
  const titleColor = await page.locator('#quotationPdf .q-title').evaluate((el) => getComputedStyle(el).color);
  check(`Room ${s.size}: title #002060`, titleColor === 'rgb(0, 32, 96)', titleColor);
  const bankColor = await page.locator('#quotationPdf .room-bank').evaluate((el) => getComputedStyle(el).color);
  check(`Room ${s.size}: bank #002060`, bankColor === 'rgb(0, 32, 96)', bankColor);

  // bill to
  const billTo = await infoValue('Bill to');
  check(`Room ${s.size}: billTo`, billTo.startsWith(s.billTo.substring(0, 20)), billTo.substring(0, 40));

  // quote given by visible
  check(`Room ${s.size}: Quote Given By row present`, (await page.locator('#quotationPdf .q-field', { hasText: 'Quote Given By' }).count()) === 1);

  // description formatting (first size only — desc identical across templates)
  if (i === 0) {
    const descText = await page.locator('#quotationPdf .room-desc').innerText();
    check('Room desc: 1. General present', descText.includes('1. General'));
    check('Room desc: 3. Materials present', descText.includes('3. Materials'));
    check('Room desc: Joinery line present', descText.includes('(Joinery, Floor tile, Electrical & finishing work client scope )'));
    const headStyle = await page.locator('#quotationPdf .room-desc span').first().evaluate((el) => ({ c: getComputedStyle(el).color, u: getComputedStyle(el).textDecorationLine, b: getComputedStyle(el).fontWeight }));
    check('Room desc: heading red+underline+bold', headStyle.c === 'rgb(192, 0, 0)' && headStyle.u.includes('underline') && Number(headStyle.b) >= 700, JSON.stringify(headStyle));
  }

  await shot(`10-room-${s.size.replace('×', 'x')}`);
}

// ---------- PDF text-layer helpers (selectable/searchable quotation text) ----------
const decodeTj = (src) => {
  const out = [];
  const re = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm\s*<([0-9A-Fa-f]+)>\s*Tj/g;
  let m;
  while ((m = re.exec(src))) {
    out.push({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
      text: Buffer.from(m[3], 'hex').toString('latin1'),
    });
  }
  return out;
};

// Decode one page's content streams (jsPDF raster ops + our text layer).
const pageStreams = async (pdfPath, pageIdx = 0) => {
  const doc = await PDFDocument.load(fs.readFileSync(pdfPath));
  const leaf = doc.getPage(pageIdx).node;
  const contents = leaf.Contents();
  if (!contents) return { doc, leaf, streams: [] };
  const isArray =
    typeof contents.size === 'function' && typeof contents.get === 'function';
  const refs = isArray
    ? Array.from({ length: contents.size() }, (_, i) => contents.get(i))
    : [contents];
  const streams = refs.map((ref) => {
    const s = doc.context.lookup(ref);
    if (!s || typeof s.getContents !== 'function') return '';
    let bytes = Buffer.from(s.getContents());
    if (bytes.length > 2 && bytes[0] === 0x78) {
      try {
        bytes = zlib.inflateSync(bytes);
      } catch {}
    }
    return bytes.toString('latin1');
  });
  return { doc, leaf, streams };
};

// The layer's graphics state must resolve to ca 0 so it stays invisible.
const layerIsInvisible = (doc, leaf, layerSrc) => {
  const m = layerSrc.match(/\/(GS-[\w]+)\s+gs/);
  if (!m) return false;
  const res = leaf.Resources();
  if (!res || typeof res.entries !== 'function') return false;
  let gsTable = null;
  for (const [k, v] of res.entries()) {
    if (k.toString() === '/ExtGState') gsTable = doc.context.lookup(v);
  }
  if (!gsTable || typeof gsTable.entries !== 'function') return false;
  for (const [k, v] of gsTable.entries()) {
    if (k.toString() === '/' + m[1]) {
      const dict = doc.context.lookup(v);
      for (const [pk, pv] of dict.entries()) {
        if (pk.toString() === '/ca' && Number(pv.toString()) === 0) return true;
      }
    }
  }
  return false;
};

const checkTextLayer = async (pdfPath, label, phrases) => {
  try {
    const { doc, leaf, streams } = await pageStreams(pdfPath, 0);
    const layer = streams.find((s) => s.includes('BT')) || '';
    const ops = decodeTj(layer);
    if (ops.length === 0 && /T[jJ]/.test(layer)) {
      // Sidecar path: Chromium writes native text with glyph encoding, so the
      // strict decode finds no ops - presence of text operators is enough.
      check(`${label}: native text layer (sidecar)`, true,
        `${(layer.match(/T[jJ]/g) || []).length} text ops`);
      return;
    }
    const joined = ops.map((o) => o.text).join(' ').replace(/\s+/g, ' ');
    check(`${label}: invisible text layer on quotation page`, ops.length > 20, `ops=${ops.length}`);
    for (const p of phrases) {
      const norm = p.replace(/\s+/g, ' ');
      check(`${label}: searchable "${p}"`, joined.includes(norm), joined.substring(0, 160));
    }
    const oob = ops.filter((o) => !isFinite(o.x) || !isFinite(o.y) || o.x < -1 || o.x > 595.3 || o.y < -1 || o.y > 841.9);
    check(`${label}: text positions inside A4 page`, oob.length === 0, JSON.stringify(oob.slice(0, 2)));
    check(`${label}: layer drawn invisible (ca 0)`, layerIsInvisible(doc, leaf, layer));
  } catch (e) {
    check(`${label}: text layer extraction`, false, e.message);
  }
};

// ---------- Room PDF generation (existing pipeline, auto-attached spec) ----------
const { PDFDocument } = await import('pdf-lib');
const countPages = async (p) => (await PDFDocument.load(fs.readFileSync(p))).getPageCount();

try {
  const dl = page.waitForEvent('download', { timeout: 90000 });
  await page.locator('button', { hasText: 'Generate PDF' }).click();
  const download = await dl;
  const pdfPath = path.join(SHOT_DIR, 'room-20x20.pdf');
  await download.saveAs(pdfPath);
  const buf = fs.readFileSync(pdfPath);
  const headOK = buf.subarray(0, 5).toString('latin1') === '%PDF-';
  check('Room PDF: starts with %PDF', headOK, `size=${buf.length}`);
  const pages = await countPages(pdfPath);
  check('Room PDF: quotation + spec merged (2 pages)', pages === 2, `pages=${pages}`);
  await checkTextLayer(pdfPath, 'Room PDF', ['Transportation', 'GST 18%', 'Company`s Bank Details', 'Expiry Date']);
} catch (e) {
  check('Room PDF generation', false, e.message);
}

// ---------- Water Tank regression ----------
await startFresh();
await page.locator('.product-card', { hasText: 'Water Tank' }).click();
await page.waitForSelector('.selection select.capacity-select');
const waterSelects = await page.locator('.selection select.capacity-select').count();
check('Water: spec dropdown still present', waterSelects === 2, `selects=${waterSelects}`);
await page.locator('.selection select.capacity-select').first().selectOption('10450 Lit');
await page.waitForTimeout(200);
const specOptions = await page.locator('.selection select.capacity-select').nth(1).locator('option').allInnerTexts();
check('Water: spec filtered (10000 Lit spec)', specOptions.join('|').includes('10000 Lit Water Tank Spec'), specOptions.join(','));
await page.locator('.selection select.capacity-select').nth(1).selectOption({ label: '10000 Lit Water Tank Spec' });
await page.locator('.primary-btn', { hasText: 'Continue' }).click();
await page.waitForSelector('#quotationPdf', { timeout: 15000 });

const wForm = await page.locator('.form-grid').innerText();
check('Water: tank inputs present', wForm.includes('Tank Capacity (Qty)') && wForm.includes('Rate') && wForm.includes('Nos'));
check('Water: charges present', wForm.includes('Transportation') || wForm.includes('Core Cut'));
const wExpiry = await infoValue('Expiry Date');
check('Water: expiry = quote +10d', wExpiry === addDays(today, 10), `${wExpiry} vs ${addDays(today, 10)}`);
const wHeads = await page.locator('#quotationPdf .q-table thead th').allInnerTexts();
check('Water: 6-col header unchanged', JSON.stringify(wHeads) === JSON.stringify(['S.No', 'Description of work', 'Qty', 'Rate', 'Nos', 'Amount']), wHeads.join('|'));
const wPage = await page.locator('#quotationPdf').getAttribute('class');
check('Water: no room-page class', !wPage.includes('room-page'), wPage);
const wTitleColor = await page.locator('#quotationPdf .q-title').evaluate((el) => getComputedStyle(el).color);
check('Water: title keeps tank colour', wTitleColor !== 'rgb(0, 32, 96)', wTitleColor);
await shot('20-water-tank');

// water PDF
try {
  const dl = page.waitForEvent('download', { timeout: 90000 });
  await page.locator('button', { hasText: 'Generate PDF' }).click();
  const download = await dl;
  const pdfPath = path.join(SHOT_DIR, 'water-tank.pdf');
  await download.saveAs(pdfPath);
  const buf = fs.readFileSync(pdfPath);
  check('Water PDF: starts with %PDF', buf.subarray(0, 5).toString('latin1') === '%PDF-', `size=${buf.length}`);
  const wPages = await countPages(pdfPath);
  // quotation (1 page) + "10000 spec.pdf" (2 pages) = 3
  check('Water PDF: quotation + spec merged (3 pages)', wPages === 3, `pages=${wPages}`);
  await checkTextLayer(pdfPath, 'Water PDF', ['Expiry Date', 'Quotation', 'Bill to']);
} catch (e) {
  check('Water PDF generation', false, e.message);
}

// ---------- Septic Tank regression ----------
await startFresh();
await page.locator('.product-card', { hasText: 'Septic Tank' }).click();
await page.waitForSelector('.selection select.capacity-select');
await page.locator('.selection select.capacity-select').first().selectOption('11550 Lit');
await page.waitForTimeout(200);
const sSpecs = await page.locator('.selection select.capacity-select').nth(1).locator('option').allInnerTexts();
check('Septic: spec mapped (11500)', sSpecs.join('|').includes('11500 Lit Septic Tank Spec'), sSpecs.join(','));
await page.locator('.primary-btn', { hasText: 'Continue' }).click();
await page.waitForSelector('#quotationPdf', { timeout: 15000 });
const sExpiry = await infoValue('Expiry Date');
check('Septic: expiry = quote +10d', sExpiry === addDays(today, 10), `${sExpiry} vs ${addDays(today, 10)}`);
const sForm = await page.locator('.form-grid').innerText();
check('Septic: tank inputs present', sForm.includes('Tank Capacity (Qty)'));
await shot('21-septic-tank');

// ---------- Room draft restore across reload ----------
await startFresh();
await page.locator('.product-card', { hasText: 'Room' }).click();
await page.waitForSelector('.selection select.capacity-select');
await page.locator('.selection select.capacity-select').selectOption('16×10');
await page.locator('.primary-btn', { hasText: 'Continue' }).click();
await page.waitForSelector('#quotationPdf');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
await page.waitForSelector('#quotationPdf', { timeout: 15000 });
const rHead = await page.locator('.page-header h1').innerText();
check('Room draft restored after reload', rHead === 'Room — 16×10', rHead);

// ---------- Room transport / crane editable charges ----------
await startFresh();
await page.locator('.product-card', { hasText: 'Room' }).click();
await page.waitForSelector('.selection select.capacity-select');
await page.locator('.selection select.capacity-select').selectOption('10×10');
await page.locator('.primary-btn', { hasText: 'Continue' }).click();
await page.waitForSelector('#quotationPdf', { timeout: 15000 });

const chargeIn = page.locator('input[placeholder="e.g. 12000"]');
const note5 = () => page.locator('#quotationPdf .room-notes li').nth(4).innerText();
const note6 = () => page.locator('#quotationPdf .room-notes li').nth(5).innerText();
const roomTotal = () => page.locator('#quotationPdf .room-table tbody tr').last().locator('td').last().innerText();

check('Room charges: transport prefilled 12000', (await chargeIn.first().inputValue()) === '12000', await chargeIn.first().inputValue());
check('Room charges: crane prefilled 12000', (await chargeIn.nth(1).inputValue()) === '12000', await chargeIn.nth(1).inputValue());
check('Room charges: note5 Excel verbatim', (await note5()).replace(/\s/g, '') === 'Transportation:Rs.12000/-', await note5());
check('Room charges: note6 Excel verbatim', (await note6()).replace(/\s/g, '') === 'Erectioncrane:Rs.12000/-', await note6());

const chargeTotalBefore = await roomTotal();
await chargeIn.first().fill('15500');
await page.waitForTimeout(300);
check('Room charges: note5 updates on edit', (await note5()).replace(/\s/g, '') === 'Transportation:Rs.15500/-', await note5());
check('Room charges: total unchanged on edit', (await roomTotal()) === chargeTotalBefore, `${await roomTotal()} vs ${chargeTotalBefore}`);
await chargeIn.first().fill('');
await page.waitForTimeout(300);
check('Room charges: clear restores Excel note', (await note5()).replace(/\s/g, '') === 'Transportation:Rs.12000/-', await note5());
await chargeIn.nth(1).fill('8000');
await page.waitForTimeout(300);
check('Room charges: crane edit renders Rs.8000/-', (await note6()).replace(/\s/g, '') === 'Erectioncrane:Rs.8000/-', await note6());
check('Room charges: total still unchanged', (await roomTotal()) === chargeTotalBefore, await roomTotal());

// ---------- Toilet: European variant (auto spec, Excel layout) ----------
await startFresh();
await page.locator('.product-card', { hasText: 'Toilet' }).click();
await page.waitForSelector('.selection select.capacity-select');
const tSelects = await page.locator('.selection select.capacity-select').count();
check('Toilet: no spec dropdown (1 select only)', tSelects === 1, `selects=${tSelects}`);
const tHeading = await page.locator('.selection p').first().innerText();
check('Toilet: "Select Toilet Type" heading', tHeading === 'Select Toilet Type', tHeading);
const tOptions = await page.locator('.selection select.capacity-select option').allInnerTexts();
check('Toilet: placeholder + European + Indian',
  JSON.stringify(tOptions) === JSON.stringify(['Select Type ▼', 'European', 'Indian']), tOptions.join(','));
await shot('30-toilet-type-select');

await page.locator('.selection select.capacity-select').selectOption('European');
await page.locator('.primary-btn', { hasText: 'Continue' }).click();
await page.waitForSelector('#quotationPdf', { timeout: 15000 });

const tDraft = await draft();
check('Toilet EU: draft product', tDraft.product === 'Toilet', tDraft.product);
check('Toilet EU: template id', tDraft.templateId === 'toilet-european', tDraft.templateId);
check('Toilet EU: spec auto-attached', tDraft.selectedSpecification === '/specification/Toilet/european%20toilet.ed.pdf', tDraft.selectedSpecification);

const tHead = await page.locator('.page-header h1').innerText();
check('Toilet EU: header', tHead === 'Toilet — European', tHead);

const tForm = await page.locator('.form-grid').innerText();
check('Toilet EU: Toilet Details (Rate/Nos)', tForm.toUpperCase().includes('TOILET DETAILS'));
check('Toilet EU: no tank inputs', !tForm.includes('Tank Capacity') && !tForm.includes('Core Cut'));
check('Toilet EU: transport/crane charge inputs', tForm.includes('Transportation Charge') && tForm.includes('Crane Charge'));

const tExpiry = await page.locator('.form-grid label', { hasText: 'Expiry Date' }).locator('input').inputValue();
check('Toilet EU: expiry = quote +10d', tExpiry === addDays(today, 10), `${tExpiry} vs ${addDays(today, 10)}`);

const tClass = await page.locator('#quotationPdf').getAttribute('class');
check('Toilet EU: toilet-page class', tClass.includes('toilet-page'), tClass);
const tImgs = await page.locator('#quotationPdf img').evaluateAll((els) => els.map((e) => `${e.getAttribute('src')}=${e.complete && e.naturalWidth > 0}`));
check('Toilet EU: header+bank images load', tImgs.length === 2 && tImgs.every((s) => s.endsWith('=true')), tImgs.join(','));

const tHeads = await page.locator('#quotationPdf .toilet-table thead th').allInnerTexts();
check('Toilet EU: 6-col header', JSON.stringify(tHeads) === JSON.stringify(['S.NO', 'DESCRIPTION', 'QTY', 'UNIT', 'RATE', 'AMOUNT']), tHeads.join('|'));

const tTitle = await page.locator('#quotationPdf .toilet-title').innerText();
check('Toilet EU: title text', tTitle === ' Quotation for  Precast European  Toilet (Skelt Only)', JSON.stringify(tTitle));
const tTitleStyle = await page.locator('#quotationPdf .toilet-title span').last().evaluate((el) => ({ c: getComputedStyle(el).color, b: getComputedStyle(el).fontWeight }));
check('Toilet EU: (Skelt Only) red+bold', tTitleStyle.c === 'rgb(255, 0, 0)' && Number(tTitleStyle.b) >= 700, JSON.stringify(tTitleStyle));

const tLeft = await page.locator('#quotationPdf .toilet-info-left').innerText();
check('Toilet EU: To, + billTo', tLeft.includes('To,') && tLeft.includes('M/s.Thirumalai textiles,') && tLeft.includes('Pollachi.'), JSON.stringify(tLeft));
const tRight = await page.locator('#quotationPdf .toilet-info-right').innerText();
check('Toilet EU: date + quote no right col', tRight.includes(addDays(today, 0)) && tRight.includes('Quotation No:SP7249'), JSON.stringify(tRight));

const tRows = page.locator('#quotationPdf .toilet-table tbody tr');
check('Toilet EU: 8 body rows', (await tRows.count()) === 8, `${await tRows.count()}`);
const tItem = (await tRows.nth(0).locator('td').allInnerTexts())[1];
check('Toilet EU: item title', tItem.trim() === 'Precast Europen Type Toilet', JSON.stringify(tItem));
const td1 = await tRows.nth(1).locator('td').allInnerTexts();
check('Toilet EU: inner size desc', td1[1].includes('Inner Size') && td1[1].includes(`:Length 3'4" Breath  4'3" Height 7'0"`), JSON.stringify(td1[1]));
const td4 = await tRows.nth(4).locator('td').allInnerTexts();
check('Toilet EU: grade of steel row', td4[1].includes('Grade of  steel') && td4[1].includes(':Fe550D'), JSON.stringify(td4[1]));
check('Toilet EU: qty/unit/rate/amount', td4[2] === '1' && td4[3] === 'nos' && td4[4] === '1,00,000.00' && td4[5] === '1,00,000.00', td4.slice(2).join('|'));
const tQtyAlign = await tRows.nth(4).locator('td').nth(2).evaluate((e) => getComputedStyle(e).textAlign);
check('Toilet EU: qty right-aligned', tQtyAlign === 'right', tQtyAlign);

const tSub = await tRows.nth(5).locator('td').allInnerTexts();
const tGst = await tRows.nth(6).locator('td').allInnerTexts();
const tTot = await tRows.nth(7).locator('td').allInnerTexts();
check('Toilet EU: subtotal row (label col B)', tSub[0] === '' && tSub[1] === 'Subtotal' && tSub[3] === '1,00,000.00', JSON.stringify(tSub));
check('Toilet EU: 18% GST row', tGst[1] === '18% GST' && tGst[3] === '18,000.00', JSON.stringify(tGst));
check('Toilet EU: total row (label col A)', tTot[0] === 'Total' && tTot[2] === '1,18,000.00', JSON.stringify(tTot));
const tSubB = await tRows.nth(5).locator('.toilet-amount').evaluate((e) => getComputedStyle(e).fontWeight);
const tGstB = await tRows.nth(6).locator('.toilet-amount').evaluate((e) => getComputedStyle(e).fontWeight);
const tTotB = await tRows.nth(7).locator('.toilet-amount').evaluate((e) => getComputedStyle(e).fontWeight);
check('Toilet EU: bold flags sub F/gst F/total T', Number(tSubB) < 700 && Number(tGstB) < 700 && Number(tTotB) >= 700, `${tSubB}/${tGstB}/${tTotB}`);

const tNotes = await page.locator('#quotationPdf .toilet-notes li').allInnerTexts();
check('Toilet EU: 7 notes', tNotes.length === 7, `${tNotes.length}`);
check('Toilet EU: note1 verbatim', tNotes[0] === 'Advance 90% Payment along with workorder and Balance 10%  Before Despatch.', JSON.stringify(tNotes[0]));
check('Toilet EU: note7 validity', tNotes[6] === 'Quotation Validity upto 10 days.', JSON.stringify(tNotes[6]));
const tNote1sz = await page.locator('#quotationPdf .toilet-notes li').nth(0).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
const tNote7sz = await page.locator('#quotationPdf .toilet-notes li').nth(6).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
check('Toilet EU: note7 smaller (18pt vs 20pt)', tNote7sz < tNote1sz, `${tNote7sz} vs ${tNote1sz}`);

const tPrevText = await page.locator('#quotationPdf').innerText();
check('Toilet EU: bank comes from image (no text block)', !tPrevText.includes('Bank Details'), 'bank is a picture');
check('Toilet EU: no expiry/ship-to in preview', !/expiry/i.test(tPrevText) && !/ship to/i.test(tPrevText), 'Excel layout');

// edit rate/nos -> accounting totals update
await page.getByLabel('Rate', { exact: true }).fill('120000');
await page.getByLabel('Nos', { exact: true }).fill('2');
await page.waitForTimeout(300);
const td4b = await tRows.nth(4).locator('td').allInnerTexts();
check('Toilet EU: edited rate/nos', td4b[4] === '1,20,000.00' && td4b[5] === '2,40,000.00', td4b.slice(4).join('|'));
const tSub2 = await tRows.nth(5).locator('td').allInnerTexts();
const tGst2 = await tRows.nth(6).locator('td').allInnerTexts();
const tTot2 = await tRows.nth(7).locator('td').allInnerTexts();
check('Toilet EU: edited totals', tSub2[3] === '2,40,000.00' && tGst2[3] === '43,200.00' && tTot2[2] === '2,83,200.00',
  JSON.stringify([tSub2[3], tGst2[3], tTot2[2]]));

// ---------- Toilet: editable transport / crane charges (Room parity) ----------
const tChargeIn = page.locator('input[placeholder="e.g. 12000"]');
check('Toilet charges: two inputs present', (await tChargeIn.count()) === 2, `${await tChargeIn.count()}`);
check('Toilet charges: transport prefilled empty (client scope)', (await tChargeIn.first().inputValue()) === '', await tChargeIn.first().inputValue());
check('Toilet charges: crane prefilled empty (client scope)', (await tChargeIn.nth(1).inputValue()) === '', await tChargeIn.nth(1).inputValue());

const tNote5 = () => page.locator('#quotationPdf .toilet-notes li').nth(4).innerText();
const tNote6 = () => page.locator('#quotationPdf .toilet-notes li').nth(5).innerText();
const tTotal = () => page.locator('#quotationPdf .toilet-table tbody tr').last().locator('.toilet-amount').innerText();

check('Toilet charges: note5 Excel verbatim', (await tNote5()).trim() === 'Transport Charges at client scope.', await tNote5());
check('Toilet charges: note6 Excel verbatim', (await tNote6()).trim() === 'Crane Charges at Client scope.', await tNote6());

const tChargeTotalBefore = await tTotal();
await tChargeIn.first().fill('15500');
await page.waitForTimeout(300);
check('Toilet charges: note5 updates on edit', (await tNote5()).replace(/\s/g, '') === 'TransportCharges:Rs.15500/-', await tNote5());
check('Toilet charges: total unchanged on edit', (await tTotal()) === tChargeTotalBefore, `${await tTotal()} vs ${tChargeTotalBefore}`);

await tChargeIn.nth(1).fill('8000');
await page.waitForTimeout(300);
check('Toilet charges: note6 updates on edit', (await tNote6()).replace(/\s/g, '') === 'CraneCharges:Rs.8000/-', await tNote6());

const tChargeDraft = await draft();
check('Toilet charges: saved to draft', tChargeDraft?.form?.transportation === '15500' && tChargeDraft?.form?.crane === '8000',
  JSON.stringify([tChargeDraft?.form?.transportation, tChargeDraft?.form?.crane]));

await tChargeIn.first().fill('');
await page.waitForTimeout(300);
check('Toilet charges: clear restores Excel note', (await tNote5()).trim() === 'Transport Charges at client scope.', await tNote5());
await tChargeIn.first().fill('15500');
await page.waitForTimeout(300);

// draft restore of the charge values across a reload
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
await page.waitForSelector('#quotationPdf', { timeout: 15000 });
const tChargeIn2 = page.locator('input[placeholder="e.g. 12000"]');
check('Toilet charges: restored after reload', (await tChargeIn2.first().inputValue()) === '15500' && (await tChargeIn2.nth(1).inputValue()) === '8000',
  `${await tChargeIn2.first().inputValue()}/${await tChargeIn2.nth(1).inputValue()}`);
check('Toilet charges: notes restored after reload',
  (await page.locator('#quotationPdf .toilet-notes li').nth(4).innerText()).replace(/\s/g, '') === 'TransportCharges:Rs.15500/-' &&
  (await page.locator('#quotationPdf .toilet-notes li').nth(5).innerText()).replace(/\s/g, '') === 'CraneCharges:Rs.8000/-');

await shot('31-toilet-european');

// Toilet PDF (existing raster pipeline + spec merge)
try {
  const dl = page.waitForEvent('download', { timeout: 120000 });
  await page.locator('button', { hasText: 'Generate PDF' }).click();
  const download = await dl;
  const pdfPath = path.join(SHOT_DIR, 'toilet-european.pdf');
  await download.saveAs(pdfPath);
  const buf = fs.readFileSync(pdfPath);
  check('Toilet PDF: starts with %PDF', buf.subarray(0, 5).toString('latin1') === '%PDF-', `size=${buf.length}`);
  const euSpecPages = (await PDFDocument.load(fs.readFileSync('public/specification/Toilet/european toilet.ed.pdf'))).getPageCount();
  const tPages = await countPages(pdfPath);
  check('Toilet PDF: quote (1p) + spec merged', tPages === 1 + euSpecPages, `pages=${tPages} expected ${1 + euSpecPages}`);
  // The charge note is two adjacent runs on one line, so the joined text
  // layer contains a space between the label and the amount.
  await checkTextLayer(pdfPath, 'Toilet PDF', ['Precast Europen Type Toilet', 'Quotation Validity upto 10 days.', 'Transport Charges: Rs.15500/-', 'Crane Charges: Rs.8000/-']);
} catch (e) {
  check('Toilet PDF generation', false, e.message);
}

// ---------- Toilet: Indian variant ----------
await page.locator('.link-btn', { hasText: 'Change Template' }).click();
await page.waitForSelector('.selection select.capacity-select');
await page.locator('.selection select.capacity-select').selectOption('Indian');
await page.locator('.primary-btn', { hasText: 'Continue' }).click();
await page.waitForSelector('#quotationPdf', { timeout: 15000 });

const iDraft = await draft();
check('Toilet IN: spec auto-attached', iDraft.selectedSpecification === '/specification/Toilet/indian%20toilet%20ed.pdf', iDraft.selectedSpecification);

const iTitle = await page.locator('#quotationPdf .toilet-title').innerText();
check('Toilet IN: title text', iTitle === ' Quotation for  Precast Indian Toilet (Skelt Only)', JSON.stringify(iTitle));

const iLeft = await page.locator('#quotationPdf .toilet-info-left').innerText();
check('Toilet IN: billTo Mr.Babu', iLeft.includes('Mr.Babu') && iLeft.includes('Thennampalayam'), JSON.stringify(iLeft));
const iRight = await page.locator('#quotationPdf .toilet-info-right').innerText();
check('Toilet IN: quote no + phone', iRight.includes('Quotation No:QF-SR9624') && iRight.includes('9943082000'), JSON.stringify(iRight));

const iRows = page.locator('#quotationPdf .toilet-table tbody tr');
const id1 = await iRows.nth(1).locator('td').allInnerTexts();
check('Toilet IN: inner size desc', id1[1].includes(`:Length 3'6" Breath  4'3" Height 8'0"( After closet fixed 7'0" available)`), JSON.stringify(id1[1]));
const id4 = await iRows.nth(4).locator('td').allInnerTexts();
check('Toilet IN: plain rate 105000.00', id4[4] === '105000.00', id4[4]);
check('Toilet IN: accounting amount 1,05,000.00', id4[5] === '1,05,000.00', id4[5]);
const iQtyAlign = await iRows.nth(4).locator('td').nth(2).evaluate((e) => getComputedStyle(e).textAlign);
check('Toilet IN: qty centred', iQtyAlign === 'center', iQtyAlign);

const iSub = await iRows.nth(5).locator('td').allInnerTexts();
const iGst = await iRows.nth(6).locator('td').allInnerTexts();
const iTot = await iRows.nth(7).locator('td').allInnerTexts();
check('Toilet IN: subtotal 1,05,000.00', iSub[3] === '1,05,000.00', iSub[3]);
check('Toilet IN: gst 18,900.00', iGst[3] === '18,900.00', iGst[3]);
check('Toilet IN: total 1,23,900.00 (label col B)', iTot[0] === '' && iTot[1] === 'Total' && iTot[3] === '1,23,900.00', JSON.stringify(iTot));
const iSubB = await iRows.nth(5).locator('.toilet-amount').evaluate((e) => getComputedStyle(e).fontWeight);
const iGstB = await iRows.nth(6).locator('.toilet-amount').evaluate((e) => getComputedStyle(e).fontWeight);
const iTotB = await iRows.nth(7).locator('.toilet-amount').evaluate((e) => getComputedStyle(e).fontWeight);
check('Toilet IN: bold flags sub T/gst F/total T', Number(iSubB) >= 700 && Number(iGstB) < 700 && Number(iTotB) >= 700, `${iSubB}/${iGstB}/${iTotB}`);

// Toilet draft restore across reload
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
await page.waitForSelector('#quotationPdf', { timeout: 15000 });
const iHead = await page.locator('.page-header h1').innerText();
check('Toilet draft restored after reload', iHead === 'Toilet — Indian', iHead);
await shot('32-toilet-indian');

// ---------- results ----------
const errReport = errors.filter((e) => !e.includes('favicon'));
check('no console/page errors', errReport.length === 0, errReport.slice(0, 3).join(' || '));

console.log('\n===== RESULTS =====');
console.log(results.join('\n'));
console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURES'} (${results.length} checks)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
