#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Headless renderer.
//   node tools/render.js stills 0.5,5.0,5.9 [--samples 1] [--out out/stills]
//   node tools/render.js video [--workers 3] [--samples 4] [--out out/nfc-review-stand.mp4]
//   node tools/render.js audio
// Frames are produced by window.renderFrame(i) — a pure function of the frame
// index — so workers can render disjoint frame ranges in parallel.
// ─────────────────────────────────────────────────────────────────────────────
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const mode = args[0] || 'video';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FPS = 60, DUR = 18, FRAMES = FPS * DUR;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { resp.writeHead(404); return resp.end(); }
      resp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  return page;
}
const decode = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { p, done };
}
async function write(stream, buf) { if (!stream.write(buf)) await new Promise((r) => stream.once('drain', r)); }

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    if (mode === 'stills') {
      const times = (args[1] || '0').split(',').map(Number);
      const out = path.resolve(ROOT, opt('out', 'out/stills'));
      fs.mkdirSync(out, { recursive: true });
      const page = await openPage(browser, port);
      const samples = +opt('samples', 1);
      for (const t of times) {
        const url = await page.evaluate(({ f, s }) => window.renderFrame(f, { samples: s }), { f: Math.round(t * FPS), s: samples });
        const file = path.join(out, `t_${t.toFixed(2).padStart(5, '0')}.png`);
        fs.writeFileSync(file, decode(url));
        console.log('wrote', file);
      }
    } else if (mode === 'audio') {
      const page = await openPage(browser, port);
      const b64 = await page.evaluate(() => window.Soundtrack.wavBase64());
      fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'out/soundtrack.wav'), Buffer.from(b64, 'base64'));
      console.log('wrote out/soundtrack.wav');
    } else if (mode === 'video') {
      const workers = +opt('workers', 3), samples = +opt('samples', 4);
      const outFile = path.resolve(ROOT, opt('out', 'out/nfc-review-stand.mp4'));
      const tmp = path.join(ROOT, 'out/tmp');
      fs.mkdirSync(tmp, { recursive: true });
      const first = +opt('from', 0), last = +opt('to', FRAMES);
      // audio
      const p0 = await openPage(browser, port);
      const b64 = await p0.evaluate(() => window.Soundtrack.wavBase64());
      const wav = path.join(tmp, 'audio.wav');
      fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
      await p0.close();
      // video segments
      const total = last - first, per = Math.ceil(total / workers);
      const t0 = Date.now();
      let doneFrames = 0;
      const segs = [];
      await Promise.all([...Array(workers)].map(async (_, w) => {
        const a = first + w * per, b = Math.min(last, a + per);
        if (a >= b) return;
        const seg = path.join(tmp, `seg_${w}.mp4`);
        segs[w] = seg;
        const page = await openPage(browser, port);
        const ff = ffmpeg(['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
          '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'animation',
          '-x264-params', 'keyint=60:min-keyint=60:scenecut=0', '-r', String(FPS), seg]);
        for (let f = a; f < b; f++) {
          const url = await page.evaluate(({ f, s }) => window.renderFrame(f, { samples: s }), { f, s: samples });
          await write(ff.p.stdin, decode(url));
          doneFrames++;
          if (doneFrames % 30 === 0) {
            const el = (Date.now() - t0) / 1000;
            console.log(`${doneFrames}/${total} frames  ${el.toFixed(0)}s elapsed  ~${((el / doneFrames) * (total - doneFrames)).toFixed(0)}s left`);
          }
        }
        ff.p.stdin.end();
        await ff.done;
        await page.close();
      }));
      const list = path.join(tmp, 'list.txt');
      fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      const mux = ffmpeg(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
        '-t', String(total / FPS), '-movflags', '+faststart', outFile]);
      mux.p.stdin.end();
      await mux.done;
      console.log('wrote', outFile, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
