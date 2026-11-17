// Local sidecar that renders quotation HTML to a text-selectable PDF using
// headless Chromium (Playwright). Start it manually with `npm run pdf-server`.
//
// The app probes http://127.0.0.1:3199/health before generating a PDF and
// silently falls back to the existing raster (html2pdf) pipeline when this
// server is not running, so nothing breaks when it is stopped.
//
// Protocol:
//   GET  /health        -> 200 "ok"
//   POST /render-pdf    -> JSON { html, width, height } -> application/pdf
import http from 'node:http';
import { chromium } from 'playwright';

const PORT = 3199;
const HOST = '127.0.0.1';

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err) => {
      browserPromise = null; // allow a later retry
      throw err;
    });
  }
  return browserPromise;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function renderPdf({ html, width, height }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
    // Embedded data-URI images resolve immediately; still wait so a slow
    // decode can never produce a blank page.
    await page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      { timeout: 15000 }
    );
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      width: width || '794px',
      height: height || '1123px', // A4 at 96dpi
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      scale: 1,
    });
  } finally {
    await page.close();
  }
}

const server = http.createServer((req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Clean exit (closes the browser too) - used by tests and Ctrl alternatives.
  if (req.method === 'GET' && req.url === '/shutdown') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('bye');
    setTimeout(shutdown, 100);
    return;
  }

  if (req.method === 'POST' && req.url === '/render-pdf') {
    readJson(req)
      .then(renderPdf)
      .then((pdf) => {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        res.end(Buffer.from(pdf));
      })
      .catch((err) => {
        console.error('[pdf-server] render failed:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(String((err && err.message) || err));
      });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`[pdf-server] selectable-text PDF sidecar on http://${HOST}:${PORT}`);
  console.log('[pdf-server] leave it running while generating PDFs; stop it any time - the app falls back to raster PDFs.');
});

function shutdown() {
  // Stop accepting AND drop existing keep-alive connections immediately:
  // browsers pool connections, and a pooled socket would otherwise keep
  // answering /health and /render-pdf long after the listener is gone.
  try {
    server.closeAllConnections?.();
  } catch {
    /* older Node: close() below still stops new connections */
  }
  server.close();
  const exit = () => process.exit(0);
  if (browserPromise) {
    browserPromise
      .then((b) => b.close())
      .catch(() => {})
      .finally(exit);
  } else {
    exit();
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
