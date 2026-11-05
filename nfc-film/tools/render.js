#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Film renderer (headless Chromium + three.js).
//   node tools/render.js stills 2.5,8.5,12.5   → out/stills/t_XX.XX.png
//   node tools/render.js video [--workers 3] [--samples 3]   → out/reel.mp4
// window.renderFrame(i) is a pure function of the frame index, so workers
// render disjoint frame ranges in parallel; segments are concatenated + muxed.
// ─────────────────────────────────────────────────────────────────────────────
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '../..'), ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2), mode = args[0] || 'video';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FPS = 30, DUR = 17, FRAMES = FPS * DUR;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };

const serve = () => new Promise((res) => {
  const srv = http.createServer((q, r) => {
    const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  srv.listen(0, '127.0.0.1', () => res(srv));
});
async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/nfc-film/film.html?render${opt('query', '') ? '&' + opt('query', '') : ''}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  return page;
}
const decode = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'inherit', 'inherit'] });
  return { p, done: new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))))) };
}
const write = async (s, b) => { if (!s.write(b)) await new Promise((r) => s.once('drain', r)); };

(async () => {
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    if (mode === 'stills') {
      const out = path.join(ROOT, 'out/stills'); fs.mkdirSync(out, { recursive: true });
      const page = await openPage(browser, port), samples = +opt('samples', 1);
      for (const t of (args[1] || '0').split(',').map(Number)) {
        const t0 = Date.now();
        const u = await page.evaluate(({ f, s }) => window.renderFrame(f, { samples: s }), { f: Math.round(t * FPS), s: samples });
        fs.writeFileSync(path.join(out, `t_${t.toFixed(2).padStart(5, '0')}.png`), decode(u));
        console.log('wrote', t, `${Date.now() - t0}ms`);
      }
    } else if (mode === 'audio') {
      const page = await openPage(browser, port);
      fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'out/reel_audio.wav'), Buffer.from(await page.evaluate(() => window.Soundtrack.wavBase64()), 'base64'));
      console.log('wrote out/reel_audio.wav');
    } else {
      const workers = +opt('workers', 3), samples = +opt('samples', 3);
      const tmp = path.join(ROOT, 'out/tmp'); fs.mkdirSync(tmp, { recursive: true });
      const outFile = path.join(ROOT, opt('out', 'out/reel.mp4'));
      const p0 = await openPage(browser, port);
      const wav = path.join(tmp, 'audio.wav');
      fs.writeFileSync(wav, Buffer.from(await p0.evaluate(() => window.Soundtrack.wavBase64()), 'base64'));
      await p0.close();
      // resumable: fixed-size chunks, each its own segment (written as .part then renamed);
      // chunks that already exist are skipped, so a restart only loses work in progress
      const first = +opt('from', 0), last = +opt('to', FRAMES), total = last - first, chunk = +opt('chunk', 15);
      const chunks = []; for (let a = first; a < last; a += chunk) chunks.push([a, Math.min(last, a + chunk)]);
      const segPath = ([a, b]) => path.join(tmp, `seg_${String(a).padStart(4, '0')}_${String(b).padStart(4, '0')}.mp4`);
      const todo = chunks.filter((c) => !fs.existsSync(segPath(c)));
      const left = todo.reduce((n, [a, b]) => n + b - a, 0);
      console.log(`${chunks.length - todo.length}/${chunks.length} chunks already rendered; ${left} frames to go`);
      const t0 = Date.now(); let done = 0; const segs = chunks.map(segPath);
      await Promise.all([...Array(Math.min(workers, todo.length))].map(async () => {
        const page = await openPage(browser, port);
        while (todo.length) {
          const [a, b] = todo.shift(), seg = segPath([a, b]), part = seg.replace(/\.mp4$/, '.part.mp4');
          const ff = ffmpeg(['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
            '-x264-params', `keyint=${FPS}:min-keyint=${FPS}:scenecut=0`, '-r', String(FPS), part]);
          for (let f = a; f < b; f++) {
            await write(ff.p.stdin, decode(await page.evaluate(({ f, s }) => window.renderFrame(f, { samples: s }), { f, s: samples })));
            if (++done % 15 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${left} frames  ${el.toFixed(0)}s  ~${((el / done) * (left - done)).toFixed(0)}s left`); }
          }
          ff.p.stdin.end(); await ff.done; fs.renameSync(part, seg);
        }
        await page.close();
      }));
      const list = path.join(tmp, 'list.txt');
      fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
      const mux = ffmpeg(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(first / FPS), '-i', wav, '-map', '0:v', '-map', '1:a',
        '-c:v', 'copy', '-af', 'volume=3.5dB,alimiter=limit=0.95', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', String(total / FPS), '-movflags', '+faststart', outFile]);
      mux.p.stdin.end(); await mux.done;
      console.log('wrote', outFile, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
