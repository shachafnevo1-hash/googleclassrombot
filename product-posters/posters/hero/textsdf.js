// Turn a line of text into a signed distance field (in world units) so the
// ray marcher can extrude it into real 3D letters.

// Felzenszwalb & Huttenlocher exact squared Euclidean distance transform.
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
function edt(grid, w, h) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  return grid;
}

// Separable Gaussian blur; a lightly blurred distance field is still a valid
// (slightly rounded) field, and it removes the EDT's stair-steps on diagonals.
function blur(src, w, h, sigma) {
  const r = Math.ceil(sigma * 3), k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += k[i + r] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
    tmp[y * w + x] = acc;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += k[i + r] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
    out[y * w + x] = acc;
  }
  return out;
}

export function buildTextSdf(text, font, worldWidth, fontPx = 520, pad = 90, smooth = 0) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font(fontPx);
  const m = g.measureText(text);
  const tw = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  const th = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  const W = tw + pad * 2, H = th + pad * 2;
  c.width = W; c.height = H;
  g.font = font(fontPx);
  g.fillStyle = '#fff';
  g.fillText(text, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  const px = g.getImageData(0, 0, W, H).data;

  const INF = 1e20, N = W * H;
  const outside = new Float64Array(N), inside = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const on = px[i * 4 + 3] >= 128;
    outside[i] = on ? 0 : INF;
    inside[i] = on ? INF : 0;
  }
  edt(outside, W, H);
  edt(inside, W, H);
  const scale = worldWidth / tw;
  const sdf = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = px[i * 4 + 3] / 255;
    const s = outside[i] > 0 ? Math.sqrt(outside[i]) - 0.5 : -(Math.sqrt(inside[i]) - 0.5);
    sdf[i] = (s + (0.5 - a) * 0.5) * scale;
  }
  return {
    data: smooth > 0 ? blur(sdf, W, H, smooth) : sdf, width: W, height: H,
    // text-local rectangle covered by the texture (origin = centre of the ink box, y up)
    rect: [-(pad + tw / 2) * scale, -(pad + th / 2) * scale, W * scale, H * scale],
    half: [(tw / 2) * scale, (th / 2) * scale],
  };
}
