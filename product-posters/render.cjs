// Renders every posters/NN-*.html to out/NN-*.png with headless Chromium.
// Usage: NODE_PATH=$(npm root -g) node render.cjs [filter...]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const W = 1080, H = 1350;
const DPR = Number(process.env.DPR || 2);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  const filters = process.argv.slice(2);
  const posters = fs.readdirSync(path.join(ROOT, 'posters'))
    .filter((f) => /^\d\d-.*\.html$/.test(f))
    .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
    .sort();

  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  for (const f of posters) {
    await page.goto(`http://127.0.0.1:${port}/posters/${f}`);
    await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
    const out = path.join(ROOT, 'out', f.replace('.html', '.png'));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
    console.log('rendered', path.relative(ROOT, out));
  }
  await browser.close();
  server.close();
});
