// node tools/stills.js 1,2,3  → out/shot_N.png
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const REPO = path.resolve(__dirname, '../..'), OUT = path.resolve(__dirname, '../out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
}).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  pg.on('pageerror', (e) => console.error('[pageerror]', e.message));
  pg.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await pg.goto(`http://127.0.0.1:${srv.address().port}/nfc-reel/index.html`);
  await pg.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  fs.mkdirSync(OUT, { recursive: true });
  for (const n of (process.argv[2] || '1,2,3').split(',').map(Number)) {
    const url = await pg.evaluate((n) => window.shot(n), n);
    fs.writeFileSync(path.join(OUT, `shot_${n}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote shot', n);
  }
  await b.close(); srv.close();
});
