// WebGL2 driver for the hero render: builds the scene, accumulates samples
// tile by tile (so a slow software GPU never stalls), then runs the post chain.
// The resolved HDR buffer can be saved and re-loaded, so the post-processing
// can be tuned without re-rendering the scene.
import { SCENE_FS } from './scene.glsl.js';
import { VS, RESOLVE_FS, PREFILTER_FS, DOWN_FS, UP_FS, STREAK_FS, COMPOSITE_FS } from './post.glsl.js';
import { buildTextSdf } from './textsdf.js';

const deg = (d) => (d * Math.PI) / 180;

// Row-major 3x3 helpers. A local->world rotation M uploaded as-is (GLSL is
// column-major) arrives in the shader as M^T, i.e. world->local.
const mul = (a, b) => a.map((_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
});
const rx = (t) => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const ry = (t) => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
const rz = (t) => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];
const worldToLocal = (M) => new Float32Array(M);

export const SCENE = {
  cam: { pos: [0, 2.9, 12.5], target: [0, 2.15, 0], fov: deg(27.5), aperture: 0.08 },
  product: { height: 2.45, base: 0.33 },
  text: {
    str: 'TAP!', font: (px) => `900 ${px}px Unbounded`, width: 3.5, pos: [0, 4.33, 0],
    rot: mul(ry(deg(-9)), mul(rx(deg(-4)), rz(deg(-2)))), depth: 0.22, bevel: 0.085,
  },
  ring: { pos: [0, 0.95, 0], size: [1.92, 0.045], rot: mul(rz(deg(-8)), rx(deg(13))) },
  stars: { center: [0, 2.42, 0.35], radius: 1.12, size: 0.23, angles: [154, 122, 90, 58, 26] },
  blobs: [
    [-2.0, 1.2, 1.2, 0.34], [-1.72, 0.92, 1.55, 0.2], [-2.32, 1.5, 1.0, 0.21], [-2.18, 0.86, 1.5, 0.13],
    [2.0, 2.78, -0.9, 0.45], [2.36, 3.22, -1.2, 0.28], [1.72, 2.42, -0.6, 0.2], [2.42, 2.5, -0.5, 0.18],
  ],
  blobBounds: [[-2.0, 1.18, 1.25, 0.8], [2.1, 2.8, -0.9, 1.05]],
  drops: [
    [-0.92, 0.09, 2.65, 0.09], [1.18, 0.07, 2.95, 0.07], [1.62, 1.05, 1.9, 0.1],
    [-2.6, 2.9, 0.4, 0.07], [0.35, 0.06, 3.3, 0.06], [0, -50, 0, 0.01],
  ],
  bubbles: [
    [-1.95, 2.35, 0.7, 0.4], [1.98, 1.45, 1.25, 0.3], [-2.5, 4.45, -0.6, 0.2],
    [1.42, 0.55, 2.4, 0.16], [-2.6, 3.35, -0.5, 0.24], [0, -50, 0, 0.01],
  ],
  twinkles: [[-2.05, 3.55, 0.4, 0.26, 14], [2.1, 0.7, 2.0, 0.24, -18]],
  sceneMin: [-3.4, 0.0, -2.2], sceneMax: [3.4, 5.6, 3.6],
};

export const POST = {
  bloomK: 0.05, threshold: 1.4, knee: 0.5,
  streakK: 0.08, streakThreshold: 3.2, streakAtten: 0.86,
  exposure: 1.0, grain: 0.016,
};

function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = new Proxy({}, { get: (c, k) => (k in c ? c[k] : (c[k] = gl.getUniformLocation(p, k))) });
  return { p, u };
}

// Textures are always created on a scratch unit so the scene's bindings on
// units 0..7 are never clobbered.
function texture(gl, w, h, internal, format, type, data, filter = gl.LINEAR) {
  gl.activeTexture(gl.TEXTURE15);
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

function target(gl, w, h, internal = gl.RGBA16F) {
  const tex = texture(gl, w, h, internal, gl.RGBA, gl.FLOAT, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, w, h };
}

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
});
const frame = () => new Promise((r) => setTimeout(r, 0));

export async function renderHero(canvas, opts = {}) {
  const { spp = 16, scale = 1, tile = 360, log = console.log, saveHdr = null, loadHdr = null } = opts;
  const P = { ...POST, ...(opts.post || {}) };
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(1080 * dpr * scale), H = Math.round(1350 * dpr * scale);
  canvas.width = W; canvas.height = H;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  gl.bindVertexArray(gl.createVertexArray());

  const quad = (prog, dst) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
    gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H);
    gl.useProgram(prog.p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const bind = (prog, name, tex, unit) => {
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u[name], unit);
  };

  const hdr = target(gl, W, H, gl.RGBA32F);
  if (loadHdr) {
    const buf = new Float32Array(await (await fetch(loadHdr)).arrayBuffer());
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, hdr.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, buf);
    gl.bindTexture(gl.TEXTURE_2D, null);
    log(`loaded HDR ${loadHdr}`);
  } else {
    await renderScene(gl, { W, H, spp, scale, tile, log, quad, bind, hdr });
    if (saveHdr) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, hdr.fbo);
      const px = new Float32Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px);
      await fetch(`/save?name=${encodeURIComponent(saveHdr)}`, { method: 'POST', body: px });
      log(`saved HDR ${saveHdr}`);
    }
  }
  postProcess(gl, { W, H, P, quad, bind, hdr });
  gl.finish();
  log(`done (${W}x${H}${loadHdr ? '' : `, ${spp} spp`})`);
}

async function renderScene(gl, { W, H, spp, scale, tile, log, quad, bind, hdr }) {
  const S = SCENE;
  const floatBlend = !!gl.getExtension('EXT_float_blend');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  // ---- product texture (sRGB -> linear on sample)
  const img = await loadImage('../assets/product-hero.png');
  gl.activeTexture(gl.TEXTURE15);
  const prod = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, prod);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  gl.bindTexture(gl.TEXTURE_2D, null);

  // ---- per-column offsets that flatten the stand's base onto the pedestal
  const pc = document.createElement('canvas');
  pc.width = img.width; pc.height = img.height;
  const pctx = pc.getContext('2d');
  pctx.drawImage(img, 0, 0);
  const pa = pctx.getImageData(0, 0, img.width, img.height).data;
  const bottoms = new Float32Array(img.width).fill(-1);
  for (let x = 0; x < img.width; x++) {
    for (let y = img.height - 1; y >= 0; y--) {
      if (pa[(y * img.width + x) * 4 + 3] > 127) { bottoms[x] = (y + 0.5) / img.height; break; }
    }
  }
  const maxBottom = Math.max(...bottoms);
  const shift = bottoms.map((b) => (b < 0 ? 0 : maxBottom - b));
  const shiftSmooth = shift.map((_, x) => {
    let s = 0, n = 0;
    for (let k = -6; k <= 6; k++) { const xx = x + k; if (xx >= 0 && xx < img.width) { s += shift[xx]; n++; } }
    return s / n;
  });
  const shiftTex = texture(gl, img.width, 1, gl.R32F, gl.RED, gl.FLOAT, shiftSmooth);

  // ---- 3D text distance field (supersampled EDT, lightly smoothed)
  const T = S.text;
  const sdf = buildTextSdf(T.str, T.font, T.width, 1100, 170, 2.0);
  const sdfTex = texture(gl, sdf.width, sdf.height, gl.R32F, gl.RED, gl.FLOAT, sdf.data);

  // ---- scene uniforms
  const scene = compile(gl, VS, SCENE_FS), u = scene.u;
  gl.useProgram(scene.p);
  gl.uniform2f(u.uRes, W, H);
  gl.uniform3fv(u.uCamPos, S.cam.pos);
  gl.uniform3fv(u.uCamTarget, S.cam.target);
  gl.uniform1f(u.uFov, S.cam.fov);
  gl.uniform1f(u.uAperture, scale < 1 ? 0 : S.cam.aperture);
  const fw = S.cam.target.map((v, i) => v - S.cam.pos[i]);
  const fl = Math.hypot(...fw);
  gl.uniform1f(u.uFocus, [0, 1.5, 0].reduce((s, v, i) => s + ((v - S.cam.pos[i]) * fw[i]) / fl, 0));
  const glow = [0, 1.6, 0].map((v, i) => v - S.cam.pos[i]);
  const gn = Math.hypot(...glow);
  gl.uniform3fv(u.uGlowDir, glow.map((v) => v / gn));

  gl.uniform2f(u.uProdSize, S.product.height * (img.width / img.height), S.product.height);
  gl.uniform1f(u.uProdBase, S.product.base);

  gl.uniform4fv(u.uTextRect, sdf.rect);
  gl.uniform2f(u.uTextSdfSize, sdf.width, sdf.height);
  gl.uniform3f(u.uTextHalf, sdf.half[0] + 0.06, sdf.half[1] + 0.06, T.depth + 0.04);
  gl.uniform3fv(u.uTextPos, T.pos);
  gl.uniformMatrix3fv(u.uTextRot, false, worldToLocal(T.rot));
  gl.uniform2f(u.uTextShape, T.depth, T.bevel);

  gl.uniform3fv(u.uRingPos, S.ring.pos);
  gl.uniformMatrix3fv(u.uRingRot, false, worldToLocal(S.ring.rot));
  gl.uniform2fv(u.uRingSize, S.ring.size);

  // five gold stars fanned out on an arc above the stand
  const starPos = [], starRot = [];
  S.stars.angles.forEach((a, i) => {
    const t = deg(a);
    starPos.push(S.stars.center[0] + S.stars.radius * Math.cos(t), S.stars.center[1] + S.stars.radius * Math.sin(t), S.stars.center[2]);
    starRot.push(...mul(ry(deg((i - 2) * -9)), rz(t - Math.PI / 2)));
  });
  gl.uniform3fv(u.uStarPos, starPos);
  gl.uniformMatrix3fv(u.uStarRot, false, new Float32Array(starRot));
  gl.uniform1f(u.uStarSize, S.stars.size);

  gl.uniform4fv(u.uBlob, S.blobs.flat());
  gl.uniform4fv(u.uBlobBound, S.blobBounds.flat());
  gl.uniform4fv(u.uDrop, S.drops.flat());
  gl.uniform4fv(u.uBubble, S.bubbles.flat());
  gl.uniform4fv(u.uTwinkle, S.twinkles.map((t) => t.slice(0, 4)).flat());
  gl.uniformMatrix3fv(u.uTwinkleRot, false, new Float32Array(S.twinkles.flatMap((t) => mul(rz(deg(t[4])), ry(deg(t[4] * 0.8))))));
  gl.uniform3fv(u.uSceneMin, S.sceneMin);
  gl.uniform3fv(u.uSceneMax, S.sceneMax);

  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prod); gl.uniform1i(u.uProduct, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shiftTex); gl.uniform1i(u.uShift, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, sdfTex); gl.uniform1i(u.uTextSdf, 2);

  // ---- accumulate samples, tile by tile
  const accum = target(gl, W, H, floatBlend ? gl.RGBA32F : gl.RGBA16F);
  gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fbo);
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.enable(gl.SCISSOR_TEST);
  const tiles = [];
  for (let y = 0; y < H; y += tile) for (let x = 0; x < W; x += tile) tiles.push([x, y, Math.min(tile, W - x), Math.min(tile, H - y)]);
  for (let s = 0; s < spp; s++) {
    gl.uniform1i(u.uSample, s);
    for (const [x, y, w, h] of tiles) {
      gl.scissor(x, y, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
      await frame();
    }
    log(`queued sample ${s + 1}/${spp}`);
  }
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.BLEND);

  const resolve = compile(gl, VS, RESOLVE_FS);
  bind(resolve, 'uAccum', accum.tex, 0);
  quad(resolve, hdr);
}

function postProcess(gl, { W, H, P, quad, bind, hdr }) {
  const prefilter = compile(gl, VS, PREFILTER_FS);
  const down = compile(gl, VS, DOWN_FS);
  const up = compile(gl, VS, UP_FS);
  const streak = compile(gl, VS, STREAK_FS);
  const comp = compile(gl, VS, COMPOSITE_FS);

  // bloom: soft-threshold, 13-tap downsample pyramid, tent upsample
  const levels = [];
  for (let i = 0, w = W >> 1, h = H >> 1; i < 7 && w > 8 && h > 8; i++, w >>= 1, h >>= 1) levels.push(target(gl, w, h));
  bind(prefilter, 'uSrc', hdr.tex, 0);
  gl.uniform2f(prefilter.u.uTexel, 1 / W, 1 / H);
  gl.uniform1f(prefilter.u.uThreshold, P.threshold);
  gl.uniform1f(prefilter.u.uKnee, P.knee);
  quad(prefilter, levels[0]);
  for (let i = 1; i < levels.length; i++) {
    bind(down, 'uSrc', levels[i - 1].tex, 0);
    gl.uniform2f(down.u.uTexel, 1 / levels[i - 1].w, 1 / levels[i - 1].h);
    quad(down, levels[i]);
  }
  const ups = levels.map((l) => target(gl, l.w, l.h));
  let low = levels[levels.length - 1];
  for (let i = levels.length - 2; i >= 0; i--) {
    bind(up, 'uLow', low.tex, 0);
    bind(up, 'uCur', levels[i].tex, 1);
    gl.uniform2f(up.u.uTexel, 1 / low.w, 1 / low.h);
    gl.uniform1f(up.u.uRadius, 1.0);
    quad(up, ups[i]);
    low = ups[i];
  }

  // four-point star glare from the brightest speculars (quarter res, Kawase streaks)
  const qW = W >> 2, qH = H >> 2;
  const bright = target(gl, qW, qH);
  bind(prefilter, 'uSrc', levels[0].tex, 0);
  gl.uniform2f(prefilter.u.uTexel, 1 / levels[0].w, 1 / levels[0].h);
  gl.uniform1f(prefilter.u.uThreshold, P.streakThreshold);
  gl.uniform1f(prefilter.u.uKnee, 0.4);
  quad(prefilter, bright);
  const streaks = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => {
    const ping = [target(gl, qW, qH), target(gl, qW, qH)];
    let src = bright;
    for (let p = 0; p < 3; p++) {
      const dst = ping[p % 2];
      bind(streak, 'uSrc', src.tex, 0);
      gl.uniform2f(streak.u.uDir, dx / qW, dy / qH);
      gl.uniform1f(streak.u.uB, Math.pow(4, p));
      gl.uniform1f(streak.u.uAtten, P.streakAtten);
      quad(streak, dst);
      src = dst;
    }
    return src;
  });

  bind(comp, 'uHdr', hdr.tex, 0);
  bind(comp, 'uBloom', ups[0].tex, 1);
  streaks.forEach((s, i) => bind(comp, `uS${i}`, s.tex, 2 + i));
  gl.uniform1f(comp.u.uBloomK, P.bloomK);
  gl.uniform1f(comp.u.uStreakK, P.streakK);
  gl.uniform1f(comp.u.uExposure, P.exposure);
  gl.uniform1f(comp.u.uGrain, P.grain);
  gl.uniform2f(comp.u.uRes, W, H);
  quad(comp, null);
}
