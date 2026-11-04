// ─────────────────────────────────────────────────────────────────────────────
// storefront.js — detailed street-level fronts for the hero street, in the
// clean Google-Maps-3D look: framed shop windows with a lit interior behind the
// glass, glass doors, striped awnings, signs, planters, and for Café Limon an
// outdoor terrace (bistro tables, olive trees, flower boxes, string lights,
// chalkboard A-frame) plus balconies on the floors above.
// Units are metres; the facade faces +z (the road). Ground level = 0.18.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from '../node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';

const GY = 0.18;
const std = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const add = (g, geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };

// ── textures ─────────────────────────────────────────────────────────────────
function stripeTex(a, b, n, scallop = false) {
  return tex(1024, scallop ? 128 : 256, (x, w, h) => {
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * w) / n, 0, w / n + 1, h); }
    const sh = x.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.12)');
    x.fillStyle = sh; x.fillRect(0, 0, w, h);
    if (scallop) {   // cut a scalloped lower edge (one scallop per stripe)
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < n; i++) { const cx = ((i + 0.5) * w) / n, r = w / n / 2; x.beginPath(); x.rect(cx - r, h * 0.62, 2 * r, h); x.fill(); }
      x.globalCompositeOperation = 'destination-over';
      for (let i = 0; i < n; i++) { const cx = ((i + 0.5) * w) / n, r = w / n / 2; x.fillStyle = i % 2 ? b : a; x.beginPath(); x.ellipse(cx, h * 0.62, r, h * 0.3, 0, 0, Math.PI); x.fill(); }
    }
  });
}
function lemon(x, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.rotate(-0.5);
  x.fillStyle = '#F4C430'; x.beginPath(); x.ellipse(0, 0, 0.5 * s, 0.36 * s, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(0.5 * s, 0, 0.09 * s, 0.07 * s, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(-0.14 * s, -0.12 * s, 0.18 * s, 0.08 * s, -0.3, 0, Math.PI * 2); x.fill();
  x.restore();
  x.save(); x.translate(cx - 0.1 * s, cy - 0.33 * s); x.rotate(-0.9);
  x.fillStyle = '#3E8E5A'; x.beginPath(); x.ellipse(0, 0, 0.24 * s, 0.1 * s, 0, 0, Math.PI * 2); x.fill(); x.restore();
}
function cafeSignTex() {
  return tex(2048, 300, (x, w, h) => {
    x.fillStyle = '#1F5640'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#D9B865'; x.lineWidth = 6; x.strokeRect(22, 22, w - 44, h - 44);
    x.fillStyle = '#FFF6DE'; x.font = '700 168px Rubik'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillText('קפה לימון', w / 2 - 90, h / 2 + 10);
    lemon(x, w / 2 + 470, h / 2 + 4, 190);
  });
}
function plainSignTex(text, bg, fg) {
  return tex(2048, 300, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.font = '700 160px Rubik'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillText(text, w / 2, h / 2 + 10);
  });
}
function bladeTex() {
  return tex(512, 512, (x, w) => {
    x.fillStyle = '#1F5640'; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#FFF6DE'; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 26, 0, Math.PI * 2); x.fill();
    lemon(x, w / 2, w / 2 + 6, 300);
  });
}
function chalkTex() {
  return tex(320, 480, (x, w, h) => {
    x.fillStyle = '#9b7653'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2B302D'; x.fillRect(18, 18, w - 36, h - 36);
    x.textAlign = 'center'; x.direction = 'rtl'; x.textBaseline = 'middle';
    x.fillStyle = '#F3F1EA'; x.font = '700 54px Rubik'; x.fillText('קפה טרי', w / 2, 110);
    x.fillStyle = '#F4D35E'; x.font = '500 40px Rubik'; x.fillText('מאפים חמים', w / 2, 178);
    x.strokeStyle = '#F3F1EA'; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(110, 260); x.lineTo(122, 350); x.lineTo(198, 350); x.lineTo(210, 260); x.closePath(); x.stroke();
    x.beginPath(); x.arc(222, 292, 22, -1.2, 1.3); x.stroke();
    for (const sx of [140, 160, 180]) { x.beginPath(); x.moveTo(sx, 240); x.quadraticCurveTo(sx + 10, 225, sx, 210); x.stroke(); }
    x.fillStyle = '#F3F1EA'; x.font = '400 30px Rubik'; x.fillText('ברוכים הבאים', w / 2, 410);
  });
}
// painted interiors for shops we never enter (the café uses a real render of its interior)
function paintedInterior(kind) {
  return tex(1024, 640, (x, w, h) => {
    const bake = kind === 'bakery';
    const g = x.createLinearGradient(0, 0, 0, h);
    if (bake) { g.addColorStop(0, '#f1dfc4'); g.addColorStop(1, '#d9bd96'); } else { g.addColorStop(0, '#c9d0d8'); g.addColorStop(1, '#aab3bd'); }
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 0, w, 60);
    for (const sy of [200, 300, 400]) {
      x.fillStyle = bake ? '#b48a5e' : '#e9edf1'; x.fillRect(60, sy, w - 120, 10);
      for (let i = 0; i < 14; i++) {
        if (bake) { x.fillStyle = i % 3 ? '#d4964f' : '#b9743a'; x.beginPath(); x.ellipse(100 + i * 62, sy - 18, 26, 16, 0, 0, Math.PI * 2); x.fill(); }
        else { x.fillStyle = ['#8fa3b8', '#d7c6a5', '#9fb7a3', '#c2a9b8'][i % 4]; x.fillRect(90 + i * 62, sy - 44, 40, 44); }
      }
    }
    for (const lx of [220, 512, 804]) {
      const gl = x.createRadialGradient(lx, 90, 0, lx, 90, 170);
      gl.addColorStop(0, bake ? 'rgba(255,220,160,0.8)' : 'rgba(255,255,255,0.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gl; x.fillRect(lx - 170, 0, 340, 300);
    }
    x.fillStyle = bake ? '#a8774d' : '#8d97a3'; x.fillRect(0, 480, w, 160);
    x.fillStyle = bake ? '#f6efe4' : '#e3e7eb'; x.fillRect(0, 470, w, 16);
  });
}
function reflTex() {
  return tex(64, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(235,244,255,0.75)'); g.addColorStop(0.45, 'rgba(235,244,255,0.15)'); g.addColorStop(1, 'rgba(235,244,255,0.05)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

// ── pieces ───────────────────────────────────────────────────────────────────
// steel window/door frame: outer frame + mullions + transom
function frame(g, mat, cx, y0, w, h, cols, transom, z, t = 0.07) {
  add(g, new THREE.BoxGeometry(w + t, t, 0.1), mat, cx, y0, z);
  add(g, new THREE.BoxGeometry(w + t, t, 0.1), mat, cx, y0 + h, z);
  add(g, new THREE.BoxGeometry(t, h, 0.1), mat, cx - w / 2, y0 + h / 2, z);
  add(g, new THREE.BoxGeometry(t, h, 0.1), mat, cx + w / 2, y0 + h / 2, z);
  for (let i = 1; i < cols; i++) add(g, new THREE.BoxGeometry(t * 0.7, transom ? transom - y0 : h, 0.08), mat, cx - w / 2 + (i * w) / cols, transom ? (y0 + transom) / 2 : y0 + h / 2, z);
  if (transom) add(g, new THREE.BoxGeometry(w, t * 0.8, 0.09), mat, cx, transom, z);
}
// a glass pane that shows part of an interior texture (u0..u1, v0..v1)
function pane(g, map, refl, cx, y0, w, h, z, uv, glowK = 0.8) {
  const geo = new THREE.PlaneGeometry(w, h), a = geo.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[1] - uv[0]), uv[2] + a.getY(i) * (uv[3] - uv[2]));
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2620, map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: glowK, roughness: 0.25, metalness: 0 });
  const m = add(g, geo, mat, cx, y0 + h / 2, z, false); m.receiveShadow = false;
  const r = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: refl, transparent: true, opacity: 0.42, depthWrite: false }));
  r.position.set(cx, y0 + h / 2, z + 0.006); g.add(r);
  return mat;
}
function bistroTable(g, x, z) {
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.035, 28), std(0xf6f4ef, 0.35), x, GY + 0.74, z);
  add(g, new THREE.CylinderGeometry(0.025, 0.03, 0.72, 10), std(0x22262b, 0.4, 0.5), x, GY + 0.37, z);
  add(g, new THREE.CylinderGeometry(0.2, 0.23, 0.03, 20), std(0x22262b, 0.4, 0.5), x, GY + 0.015, z);
  add(g, new THREE.CylinderGeometry(0.04, 0.032, 0.075, 16), std(0xffffff, 0.3), x + 0.09, GY + 0.795, z + 0.05);
  add(g, new THREE.CylinderGeometry(0.065, 0.06, 0.01, 20), std(0xffffff, 0.3), x + 0.09, GY + 0.762, z + 0.05);
  add(g, new THREE.CylinderGeometry(0.025, 0.03, 0.12, 12), std(0xe9f2f5, 0.15), x - 0.1, GY + 0.82, z - 0.06);
  add(g, new THREE.SphereGeometry(0.045, 10, 8), std(0xf4c430, 0.5), x - 0.1, GY + 0.9, z - 0.06);
}
function bistroChair(g, x, z, rot) {
  const c = new THREE.Group(); c.position.set(x, GY, z); c.rotation.y = rot; g.add(c);
  const cane = std(0xc9a26b, 0.7), black = std(0x22262b, 0.45, 0.4);
  add(c, new THREE.CylinderGeometry(0.2, 0.2, 0.045, 22), cane, 0, 0.46, 0);
  // curved back band behind the seat (horizontal half-ring on the -z side) on three posts
  const back = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 6, 20, Math.PI), black); back.rotation.x = -Math.PI / 2; back.position.set(0, 0.8, 0); c.add(back);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 4, 20, Math.PI), cane); band.rotation.x = -Math.PI / 2; band.scale.set(1, 1, 1.6); band.position.set(0, 0.71, 0); c.add(band);
  for (const [px, pz] of [[-0.19, 0], [0.19, 0], [0, -0.19]]) add(c, new THREE.CylinderGeometry(0.011, 0.011, 0.34, 6), black, px, 0.63, pz);
  for (const [lx, lz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) add(c, new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6), black, lx, 0.23, lz);
}
function olivePlanter(g, x, z, s = 1) {
  add(g, new RoundedBoxGeometry(0.5 * s, 0.6 * s, 0.5 * s, 2, 0.03), std(0x3a3f45, 0.7), x, GY + 0.3 * s, z);
  add(g, new THREE.BoxGeometry(0.44 * s, 0.02, 0.44 * s), std(0x5a4632), x, GY + 0.6 * s, z, false);
  add(g, new THREE.CylinderGeometry(0.025 * s, 0.04 * s, 0.85 * s, 7), std(0x7a6450), x, GY + 1.0 * s, z);
  const leaf = [std(0x8aa06e, 0.8), std(0x7c9463, 0.8), std(0x9db27f, 0.8)];
  for (let i = 0; i < 8; i++) {
    const a = i * 0.8 + rnd(), r = (0.1 + rnd() * 0.16) * s;
    add(g, new THREE.IcosahedronGeometry((0.17 + rnd() * 0.08) * s, 0), leaf[i % 3], x + Math.cos(a) * r, GY + (1.35 + rnd() * 0.4) * s, z + Math.sin(a) * r);
  }
}
function flowerBox(g, x, z, w) {
  add(g, new THREE.BoxGeometry(w, 0.3, 0.3), std(0x8f6c4a, 0.75), x, GY + 0.15, z);
  const greens = [std(0x5f9e5c, 0.8), std(0x76b06a, 0.8)], fl = [std(0xf2a5c0, 0.6), std(0xffffff, 0.6), std(0xb49ad8, 0.6), std(0xf4c430, 0.6)];
  const n = Math.round(w / 0.16);
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + 0.08 + (i * (w - 0.16)) / (n - 1);
    add(g, new THREE.IcosahedronGeometry(0.1 + rnd() * 0.04, 0), greens[i % 2], px, GY + 0.36 + rnd() * 0.05, z + (rnd() - 0.5) * 0.1, false);
    if (i % 2 === 0) add(g, new THREE.SphereGeometry(0.035, 8, 6), fl[(i / 2) % 4], px + 0.03, GY + 0.46 + rnd() * 0.04, z + 0.06, false);
  }
}
function aFrame(g, x, z, rot) {
  const m = new THREE.MeshStandardMaterial({ map: chalkTex(), roughness: 0.9 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.84, 0.025), [std(0x9b7653), std(0x9b7653), std(0x9b7653), std(0x9b7653), m, std(0x9b7653)]);
    p.position.set(x + Math.sin(rot) * s * 0.12, GY + 0.41, z + Math.cos(rot) * s * 0.12); p.rotation.set(-s * 0.26, rot + (s < 0 ? Math.PI : 0), 0);
    p.castShadow = true; g.add(p);
  }
}
function sconce(g, x, y, z) {
  add(g, new THREE.BoxGeometry(0.08, 0.14, 0.04), std(0x22262b, 0.4, 0.5), x, y, z + 0.02);
  add(g, new THREE.CylinderGeometry(0.07, 0.05, 0.16, 14), std(0x22262b, 0.4, 0.5), x, y + 0.02, z + 0.16);
  add(g, new THREE.SphereGeometry(0.045, 10, 8), glow(0xffe2a8), x, y - 0.06, z + 0.16, false);
}
function balconies(g, hm, fz) {
  // light Mediterranean balconies: white slab, clear glass front, slim black rail and posts
  const slab = std(0xf5f2ec, 0.85), rail = std(0x2c3036, 0.5, 0.4);
  const glass = new THREE.MeshStandardMaterial({ color: 0xdcecf4, roughness: 0.08, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const pot = std(0xd08a5f, 0.8), leaf = [std(0x6fb572, 0.8), std(0x5f9e5c, 0.8)];
  for (let n = 1; 3.3 * n + 2.7 < hm.h; n++) {
    const yb = 3.3 * n + 0.93, dep = n === 1 ? 0.45 : 0.7;   // slab top meets the shader window's sill
    for (let k = Math.ceil((hm.x - hm.w / 2 + 1.0) / 3.2); k * 3.2 <= hm.x + hm.w / 2 - 1.0; k++) {
      const xw = k * 3.2;
      add(g, new THREE.BoxGeometry(2.2, 0.1, dep), slab, xw, yb - 0.05, fz + dep / 2);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 0.86), glass); gl.position.set(xw, yb + 0.45, fz + dep - 0.02); g.add(gl);
      add(g, new THREE.BoxGeometry(2.22, 0.04, 0.04), rail, xw, yb + 0.9, fz + dep - 0.02);
      for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.03, 0.9, 0.03), rail, xw + sx * 1.09, yb + 0.45, fz + dep - 0.02);
      if ((n + k) % 2 === 1) for (const px of [-0.62, 0.6]) {
        add(g, new THREE.CylinderGeometry(0.11, 0.085, 0.2, 12), pot, xw + px, yb + 0.1, fz + dep * 0.5);
        add(g, new THREE.IcosahedronGeometry(0.16, 0), leaf[(n + k) % 2], xw + px, yb + 0.32, fz + dep * 0.5);
      }
    }
  }
}

// ── storefronts ──────────────────────────────────────────────────────────────
// kind: 'cafe' | 'bakery' | 'plain'. Returns { windowMats } so the café can show its real interior.
export function storeFront(g, hm, kind, st) {
  const fz = hm.front + 0.02, X = hm.x, Wf = hm.w - 0.2;
  const steel = std(kind === 'plain' ? 0x6b737d : 0x23272c, 0.45, 0.45);
  const refl = reflTex();
  const interior = kind === 'cafe' ? null : paintedInterior(kind);
  const windowMats = [];
  const wallCol = kind === 'cafe' ? 0xf8f3e8 : kind === 'bakery' ? 0xf7efe4 : null;
  if (wallCol) add(g, new THREE.PlaneGeometry(Wf, 3.42), std(wallCol, 0.9), X, GY + 1.71, fz + 0.004, false);
  // plinth under the windows
  add(g, new THREE.BoxGeometry(Wf, 0.5, 0.1), std(kind === 'cafe' ? 0x2c6a4e : kind === 'bakery' ? 0x9c5a3c : 0xb9c0c8, 0.7), X, GY + 0.25, fz + 0.05);
  // windows either side of the door
  const dw = 1.3, ww = (Wf - dw) / 2 - 0.7, wy0 = GY + 0.52, wh = 2.2, wx = dw / 2 + 0.35 + ww / 2;
  for (const s of [-1, 1]) {
    const cx = X + s * wx;
    const u0 = s < 0 ? 0.06 : 0.6, u1 = s < 0 ? 0.4 : 0.94;
    windowMats.push(pane(g, interior, refl, cx, wy0, ww, wh, fz + 0.03, [u0, u1, 0.22, 0.74], kind === 'plain' ? 0.35 : 0.85));
    frame(g, steel, cx, wy0, ww, wh, 3, wy0 + 1.72, fz + 0.06);
    add(g, new THREE.BoxGeometry(ww + 0.2, 0.05, 0.22), std(0xe9e4da, 0.6), cx, wy0 - 0.02, fz + 0.12);   // sill
  }
  // glass door with handle + transom
  const dy0 = GY, dh = 2.45;
  windowMats.push(pane(g, interior, refl, X, dy0 + 0.22, dw - 0.16, dh - 0.3, fz + 0.03, [0.43, 0.57, 0.16, 0.66], kind === 'plain' ? 0.35 : 0.85));
  add(g, new THREE.BoxGeometry(dw - 0.1, 0.22, 0.06), steel, X, dy0 + 0.11, fz + 0.06);
  frame(g, steel, X, dy0, dw, dh + 0.42, 1, dy0 + dh, fz + 0.06, 0.09);
  add(g, new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8), std(0xc9a86a, 0.3, 0.9), X - dw / 2 + 0.2, dy0 + 1.15, fz + 0.14);
  add(g, new THREE.BoxGeometry(1.2, 0.012, 0.6), std(0x3b3f45, 0.95), X, GY + 0.006, fz + 0.4, false);   // doormat
  if (kind === 'plain') {
    add(g, new THREE.BoxGeometry(Wf - 0.6, 0.16, 0.45), std(0xd7dbe1, 0.8), X, GY + 3.0, fz + 0.22);
    olivePlanter(g, X + dw / 2 + 0.45, fz + 0.4, 0.8);
    return { windowMats };
  }
  // awning: striped canvas sloping to the street + scalloped valance + arms
  const aw = Wf - 0.4, out = 1.5, yWall = GY + 3.12, yOut = GY + 2.7;
  const [ca, cb] = kind === 'cafe' ? ['#F2CB45', '#FFF8E6'] : ['#C96F4A', '#FBEEE2'];
  const slope = Math.hypot(out, yWall - yOut);
  const can = new THREE.Mesh(new THREE.PlaneGeometry(aw, slope), new THREE.MeshStandardMaterial({ map: stripeTex(ca, cb, 22), roughness: 0.85, side: THREE.DoubleSide }));
  can.position.set(X, (yWall + yOut) / 2, fz + out / 2); can.rotation.x = -Math.PI / 2 + Math.atan2(yWall - yOut, out); can.castShadow = true; g.add(can);
  const val = new THREE.Mesh(new THREE.PlaneGeometry(aw, 0.3), new THREE.MeshStandardMaterial({ map: stripeTex(ca, cb, 22, true), roughness: 0.85, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  val.position.set(X, yOut - 0.15, fz + out); val.castShadow = true; g.add(val);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, aw, 8), steel); bar.rotation.z = Math.PI / 2; bar.position.set(X, yOut, fz + out); g.add(bar);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, slope, 6), steel); arm.position.set(X + s * (aw / 2 - 0.05), (yWall + yOut) / 2 - 0.03, fz + out / 2); arm.rotation.x = Math.PI / 2 + Math.atan2(yWall - yOut, out); g.add(arm); }
  // fascia sign above the awning
  const signW = Math.min(Wf - 1.2, 5.2);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signW * 300 / 2048, 0.08), [std(0x1f5640), std(0x1f5640), std(0x1f5640), std(0x1f5640),
    new THREE.MeshStandardMaterial({ map: kind === 'cafe' ? cafeSignTex() : plainSignTex(st.name, '#FFF7EE', '#9C5A3C'), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.08 }), std(0x1f5640)]);
  sign.position.set(X, GY + 3.62, fz + 0.06); sign.castShadow = true; g.add(sign);
  for (const s of [-1, 1]) sconce(g, X + s * (dw / 2 + 0.2), GY + 2.25, fz);
  if (kind === 'bakery') {
    olivePlanter(g, X - dw / 2 - 0.42, fz + 0.38, 0.85); olivePlanter(g, X + dw / 2 + 0.42, fz + 0.38, 0.85);
    add(g, new RoundedBoxGeometry(1.6, 0.08, 0.42, 2, 0.02), std(0xb98f63, 0.6), X + wx, GY + 0.46, fz + 0.5);
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.06, 0.42, 0.38), std(0x23272c, 0.5, 0.4), X + wx + s * 0.7, GY + 0.21, fz + 0.5);
    return { windowMats };
  }
  // ── Café Limon extras ──
  // round blade sign on a bracket at the left corner
  const bx = X - Wf / 2 + 0.35;
  add(g, new THREE.BoxGeometry(0.04, 0.04, 0.9), steel, bx, GY + 4.17, fz + 0.45);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 40), [std(0x1f5640), new THREE.MeshStandardMaterial({ map: bladeTex(), roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: bladeTex(), roughness: 0.6 })]);
  blade.rotation.z = Math.PI / 2; blade.position.set(bx, GY + 3.78, fz + 0.62); blade.castShadow = true; g.add(blade);
  // string lights along the awning's front bar
  for (let i = 0; i <= 18; i++) {
    const f = i / 18, px = X - aw / 2 + 0.1 + f * (aw - 0.2), sag = Math.sin(((f * 3) % 1) * Math.PI) * 0.1;
    add(g, new THREE.SphereGeometry(0.035, 8, 6), glow(0xffe6b0), px, yOut - 0.34 - sag, fz + out + 0.02, false);
  }
  // terrace: bistro tables + chairs in front of both windows
  const tz = fz + 0.78;
  for (const s of [-1, 1]) {
    const tx = X + s * (wx + 0.15);
    bistroTable(g, tx, tz); bistroChair(g, tx - 0.5, tz, Math.PI / 2); bistroChair(g, tx + 0.5, tz, -Math.PI / 2);
    flowerBox(g, tx, fz + 0.2, ww - 0.5);
  }
  olivePlanter(g, X - dw / 2 - 0.38, fz + 0.36); olivePlanter(g, X + dw / 2 + 0.38, fz + 0.36);
  aFrame(g, X + 1.25, fz + 1.25, 0.35);
  balconies(g, hm, fz);
  return { windowMats };
}
