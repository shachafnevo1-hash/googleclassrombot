// ─────────────────────────────────────────────────────────────────────────────
// main.js — boot: load fonts, build textures, expose the deterministic API:
//   await window.seek(t)                → draw a single sample at time t
//   await window.renderFrame(i, opts)   → PNG data URL of output frame i with
//                                         temporal sub-frame motion blur
//   await window.Soundtrack.wavBase64() → soundtrack as a base64 WAV
// ─────────────────────────────────────────────────────────────────────────────
(async function () {
  const HEB = 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F';
  const LAT = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
  const faces = [];
  for (const w of [400, 500, 700, 800]) for (const [s, r] of [['hebrew', HEB], ['latin', LAT]])
    faces.push(new FontFace('Rubik', `url(fonts/rubik-${s}-${w}-normal.woff2)`, { weight: String(w), style: 'normal', unicodeRange: r }));
  for (const w of [700, 800]) for (const [s, r] of [['hebrew', HEB], ['latin', LAT]])
    faces.push(new FontFace('Rubik', `url(fonts/rubik-${s}-${w}-italic.woff2)`, { weight: String(w), style: 'italic', unicodeRange: r }));
  for (const w of [400, 500, 600, 700])
    faces.push(new FontFace('Inter', `url(fonts/inter-latin-${w}-normal.woff2)`, { weight: String(w), style: 'normal' }));
  await Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff))));
  await document.fonts.ready;

  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d', { alpha: false, willReadFrequently: true });
  R3.init(U.W, U.H);
  TL.init(ctx);

  window.seek = async (t) => { TL.frame(t); };

  const N = U.W * U.H * 4;
  let acc = null;
  window.renderFrame = async (i, opts = {}) => {
    const samples = opts.samples || 4, shutter = opts.shutter == null ? 0.5 : opts.shutter;
    const fps = TL.FPS, maxT = TL.DURATION - 1e-4;
    if (samples === 1) {
      TL.frame(Math.min(maxT, i / fps));
    } else {
      if (!acc) acc = new Float32Array(N);
      acc.fill(0);
      for (let k = 0; k < samples; k++) {
        const off = ((k + 0.5) / samples - 0.5) * shutter;
        TL.frame(U.clamp((i + off) / fps, 0, maxT));
        const d = ctx.getImageData(0, 0, U.W, U.H).data;
        for (let j = 0; j < N; j++) acc[j] += d[j];
      }
      const img = ctx.createImageData(U.W, U.H), o = img.data, inv = 1 / samples;
      for (let j = 0; j < N; j++) o[j] = acc[j] * inv + 0.5;
      ctx.putImageData(img, 0, 0);
    }
    return opts.noData ? null : cv.toDataURL('image/png');
  };
  window.ready = true;
  if (window.onReady) window.onReady();
})();
