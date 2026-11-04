// ─────────────────────────────────────────────────────────────────────────────
// props.js — physical props for the cinematic stand film (units: cm).
// Dark walnut counter, coffee cup, split-flap review counter with star lamps,
// glowing light lines (tube + additive halo), miniature business props for the
// "every business" light tree, and the navy felt end pad.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from '../../nfc-reel/node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../../nfc-reel/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const ACCENT = 0x5aa2ff;           // the one accent colour (light lines, key word)
const std = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ── walnut counter ───────────────────────────────────────────────────────────
function walnutTex() {
  return tex(2048, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a2e1c'); g.addColorStop(0.5, '#3f2617'); g.addColorStop(1, '#4b301e');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // boards
    for (let b = 0; b < 4; b++) { x.fillStyle = `rgba(${b % 2 ? 20 : 70},${b % 2 ? 10 : 45},${b % 2 ? 5 : 25},0.10)`; x.fillRect(0, (b * h) / 4, w, h / 4); x.fillStyle = 'rgba(15,8,4,0.55)'; x.fillRect(0, (b * h) / 4, w, 2); }
    // grain: long wavy lines
    for (let i = 0; i < 420; i++) {
      const y0 = rnd() * h, amp = 4 + rnd() * 14, f = 0.002 + rnd() * 0.004, ph = rnd() * 6;
      const dark = rnd() < 0.62;
      x.strokeStyle = dark ? `rgba(22,12,6,${0.08 + rnd() * 0.22})` : `rgba(140,96,62,${0.05 + rnd() * 0.12})`;
      x.lineWidth = 0.6 + rnd() * 2.2; x.beginPath();
      for (let px = 0; px <= w; px += 16) { const py = y0 + Math.sin(px * f + ph) * amp + Math.sin(px * f * 3.1 + ph * 2) * amp * 0.25; px ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
    // pores
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(15,8,4,${0.1 + rnd() * 0.2})`; x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 1); }
  }, [1.4, 1]);
}
export function counter() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(260, 4, 120), [std(0x2a1a10, 0.5), std(0x2a1a10, 0.5),
    new THREE.MeshPhysicalMaterial({ map: walnutTex(), roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.22 }), std(0x2a1a10, 0.5), std(0x3a2416, 0.5), std(0x2a1a10, 0.5)]);
  top.position.set(0, -2, -30); top.receiveShadow = true; g.add(top);
  return g;
}

// ── coffee cup on a saucer (real size, ~8 cm tall) ───────────────────────────
export function coffeeCup() {
  const g = new THREE.Group(), cer = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.18, clearcoat: 0.8 });
  const prof = [[0, 0], [2.6, 0], [3.2, 0.4], [3.6, 3], [4.2, 7.2], [4.35, 7.6], [4.0, 7.6], [3.85, 7.2], [3.3, 3.2], [0, 3.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), cer); cup.position.y = 0.8; cup.castShadow = true; g.add(cup);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(3.95, 40), new THREE.MeshPhysicalMaterial({ color: 0x3a2213, roughness: 0.15, clearcoat: 1 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 7.6; g.add(coffee);
  const crema = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.9, 40), new THREE.MeshStandardMaterial({ color: 0xa8774d, roughness: 0.6 }));
  crema.rotation.x = -Math.PI / 2; crema.position.y = 7.62; g.add(crema);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.42, 12, 24, Math.PI * 1.2), cer); handle.position.set(4.3, 4.6, 0); handle.rotation.z = -Math.PI * 0.6; handle.castShadow = true; g.add(handle);
  const saucer = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [6.5, 0], [7.4, 0.9], [7.0, 1.0], [5.6, 0.45], [0, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 48), cer);
  saucer.castShadow = saucer.receiveShadow = true; g.add(saucer);
  return g;
}

// ── split-flap review counter with five star lamps ───────────────────────────
function digitAtlas() {
  // 10 digits side by side; each cell 256×384, dark card + warm white numeral, split line
  return tex(2560, 384, (x, w, h) => {
    for (let d = 0; d < 10; d++) {
      const cx = d * 256;
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#202020'); g.addColorStop(0.5, '#151515'); g.addColorStop(1, '#1d1d1d');
      x.fillStyle = g; x.fillRect(cx + 4, 4, 248, h - 8);
      x.fillStyle = '#ece6d8'; x.font = '700 300px Inter'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(d), cx + 128, h / 2 + 14);
      x.fillStyle = '#050505'; x.fillRect(cx, h / 2 - 3, 256, 6);
    }
  });
}
function starShape(R, r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  s.closePath(); return s;
}
export function flipCounter() {
  const g = new THREE.Group(), atlas = digitAtlas();
  const housing = new THREE.Mesh(new RoundedBoxGeometry(24, 12, 7, 4, 0.8), new THREE.MeshPhysicalMaterial({ color: 0x1b1c1e, roughness: 0.42, clearcoat: 0.4 }));
  housing.position.y = 7.2; housing.castShadow = housing.receiveShadow = true; g.add(housing);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(22.4, 10.2, 0.6, 3, 0.25), std(0x0c0c0d, 0.5)); bezel.position.set(0, 7.2, 3.3); g.add(bezel);
  // each digit: static top half, static bottom half, and a flap that rotates down
  const cells = [];
  const half = (d, top) => { const geo = new THREE.PlaneGeometry(6.2, 4.5), uv = geo.attributes.uv; const u0 = d / 10 + 0.002, u1 = (d + 1) / 10 - 0.002; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, top ? 0.5 + uv.getY(i) * 0.5 : uv.getY(i) * 0.5); return geo; };
  const mat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.55, side: THREE.DoubleSide });
  for (let k = 0; k < 3; k++) {
    const cx = (k - 1) * 7.0;
    const top = new THREE.Mesh(half(0, true), mat), bot = new THREE.Mesh(half(0, false), mat);
    top.position.set(cx, 7.2 + 2.3, 3.62); bot.position.set(cx, 7.2 - 2.3, 3.62);
    const hinge = new THREE.Group(); hinge.position.set(cx, 7.2, 3.66);
    const flapF = new THREE.Mesh(half(0, true), mat); flapF.position.y = 2.25; hinge.add(flapF);
    const flapB = new THREE.Mesh(half(0, false), mat); flapB.position.y = 2.25; flapB.rotation.x = Math.PI; flapB.position.z = -0.01; hinge.add(flapB);
    g.add(top, bot, hinge);
    cells.push({ top, bot, hinge, flapF, flapB, cur: 0 });
  }
  // star lamps on a small strip under the display
  const strip = new THREE.Mesh(new RoundedBoxGeometry(18, 2.2, 2.6, 2, 0.5), std(0x241c16, 0.5)); strip.position.set(0, 0.9, 1.0); strip.castShadow = true; g.add(strip);
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.85, 0.36), { depth: 0.25, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }),
      new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.4, emissive: 0xffb81c, emissiveIntensity: 0 }));
    s.position.set((i - 2) * 3.4, 1.0, 2.35); g.add(s); stars.push(s);
  }
  const setUV = (mesh, d, top) => { const uv = mesh.geometry.attributes.uv, u0 = d / 10 + 0.002, u1 = (d + 1) / 10 - 0.002; for (let i = 0; i < uv.count; i++) uv.setX(i, i % 2 ? u1 : u0); uv.needsUpdate = true; };
  // value may be fractional: the integer part shows, the fraction drives the flip of the changing digits
  function set(value, litStars) {
    const v = Math.max(0, value), n = Math.floor(v), f = v - n, nx = n + 1;
    const ds = (x) => [Math.floor(x / 100) % 10, Math.floor(x / 10) % 10, x % 10];
    const a = ds(n), b = ds(nx);
    cells.forEach((c, k) => {
      const flipping = a[k] !== b[k] && f > 0;
      setUV(c.top, flipping ? b[k] : a[k], true); setUV(c.bot, a[k], false);
      setUV(c.flapF, a[k], true); setUV(c.flapB, b[k], false);
      c.hinge.rotation.x = flipping ? Math.PI * f : 0;   // flap falls toward the viewer c.hinge.visible = flipping;
      if (flipping && f > 0.5) setUV(c.bot, a[k], false);
    });
    stars.forEach((s, i) => { const on = Math.max(0, Math.min(1, litStars - i)); s.material.emissiveIntensity = on * 2.2; s.material.color.setHex(on > 0.5 ? 0xffc23a : 0x3a3226); });
  }
  set(38, 0);
  g.userData = { set };
  return g;
}

// ── glowing light line: core tube + additive halo ribbon, grown by drawRange ─
function haloTex() {
  return tex(64, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}
const HALO = { t: null };
export function lightLine(points, { radius = 0.18, halo = 2.4, color = ACCENT, segs = 400, flat = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const core = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 8, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), toneMapped: false }));
  // halo ribbon lying on the surface (or facing up for vertical runs)
  HALO.t = HALO.t || haloTex();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    const side = flat ? new THREE.Vector3(-tg.z, 0, tg.x).normalize() : new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0, 0, 1)).normalize();
    pos.push(p.x - side.x * halo, p.y - side.y * halo + 0.02, p.z - side.z * halo, p.x + side.x * halo, p.y + side.y * halo + 0.02, p.z + side.z * halo);
    uv.push(0, u, 1, u);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hg.setIndex(idx);
  const haloM = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ map: HALO.t, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const g = new THREE.Group(); g.add(haloM, core, head);
  const coreIdx = core.geometry.index.count, haloIdx = hg.index.count;
  // grow from a to b (0..1 along the curve)
  function grow(b, a = 0) {
    b = Math.max(0, Math.min(1, b)); a = Math.max(0, Math.min(b, a));
    const c0 = Math.floor(a * segs) * 8 * 6, c1 = Math.floor(b * segs) * 8 * 6;
    core.geometry.setDrawRange(c0, Math.max(0, Math.min(coreIdx, c1) - c0));
    const h0 = Math.floor(a * segs) * 6, h1 = Math.floor(b * segs) * 6;
    hg.setDrawRange(h0, Math.max(0, Math.min(haloIdx, h1) - h0));
    head.visible = b > 0.001 && b < 0.999; head.position.copy(curve.getPointAt(b));
    g.visible = b > 0.001;
  }
  grow(1);
  g.userData = { curve, grow };
  return g;
}

// ── miniature business props (for the "every business" tree) ────────────────
export function scissors() {
  const g = new THREE.Group(), steel = new THREE.MeshPhysicalMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.22 }), grip = std(0x1d1f22, 0.45);
  const blade = new THREE.Shape(); blade.moveTo(0, -0.45); blade.lineTo(9.5, -0.1); blade.quadraticCurveTo(10.4, 0, 9.5, 0.25); blade.lineTo(0, 0.55); blade.closePath();
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.12, bevelEnabled: false }), steel); b.rotation.set(-Math.PI / 2, 0, s * 0.16); b.position.y = 0.3 + (s > 0 ? 0.13 : 0); b.castShadow = true; g.add(b);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.38, 10, 28), grip); ring.rotation.x = -Math.PI / 2; ring.position.set(-2.4, 0.4, s * 1.9); ring.castShadow = true; g.add(ring);
  }
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 16), steel); pivot.position.y = 0.4; g.add(pivot);
  return g;
}
export function plateSet() {
  const g = new THREE.Group(), cer = new THREE.MeshPhysicalMaterial({ color: 0xf6f3ec, roughness: 0.2, clearcoat: 0.8 }), steel = new THREE.MeshPhysicalMaterial({ color: 0xd4d8dd, metalness: 1, roughness: 0.25 });
  const plate = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [7, 0], [9.6, 1.0], [10.2, 1.3], [9.9, 1.4], [7.2, 0.5], [0, 0.55]].map(([r, y]) => new THREE.Vector2(r, y)), 56), cer);
  plate.castShadow = plate.receiveShadow = true; g.add(plate);
  const fork = new THREE.Shape(); fork.moveTo(-0.3, 0); fork.lineTo(0.3, 0); fork.lineTo(0.35, 11); fork.lineTo(0.9, 12); fork.lineTo(0.9, 15.5); fork.lineTo(-0.9, 15.5); fork.lineTo(-0.9, 12); fork.lineTo(-0.35, 11); fork.closePath();
  const f = new THREE.Mesh(new THREE.ExtrudeGeometry(fork, { depth: 0.15, bevelEnabled: false }), steel); f.rotation.x = -Math.PI / 2; f.position.set(-12.5, 0.1, 7.5); f.castShadow = true; g.add(f);
  const knife = new THREE.Shape(); knife.moveTo(-0.35, 0); knife.lineTo(0.35, 0); knife.lineTo(0.5, 9); knife.quadraticCurveTo(0.6, 15, 0, 16); knife.lineTo(-0.5, 15.5); knife.lineTo(-0.45, 9); knife.closePath();
  const k = new THREE.Mesh(new THREE.ExtrudeGeometry(knife, { depth: 0.15, bevelEnabled: false }), steel); k.rotation.x = -Math.PI / 2; k.position.set(12.5, 0.1, 7.5); k.castShadow = true; g.add(k);
  return g;
}
export function shoppingBag() {
  const g = new THREE.Group(), kraft = std(0xc39a6b, 0.85);
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 5), kraft); body.position.y = 6; body.castShadow = body.receiveShadow = true; g.add(body);
  const fold = new THREE.Mesh(new THREE.BoxGeometry(10.05, 1.2, 5.05), std(0xb48c5e, 0.85)); fold.position.y = 11.4; g.add(fold);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 24, Math.PI), std(0x2a2420, 0.6)); h.position.set(0, 12, s * 1.2); g.add(h); }
  return g;
}

// ── navy felt pad for the end card, with a printed texture (canvas) ──────────
export function feltPad(printCanvas) {
  const felt = tex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#16204a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60000; i++) { const v = rnd(); x.fillStyle = v < 0.5 ? `rgba(8,12,34,${0.25 * rnd()})` : `rgba(60,76,140,${0.12 * rnd()})`; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  });
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new RoundedBoxGeometry(36, 1.2, 34, 3, 0.5), new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 }));
  pad.position.y = 0.6; pad.receiveShadow = pad.castShadow = true; g.add(pad);
  if (printCanvas) {
    const t = new THREE.CanvasTexture(printCanvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(32, 32 * printCanvas.height / printCanvas.width), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, opacity: 0.92 }));
    p.rotation.x = -Math.PI / 2; p.position.set(0, 1.22, 8); g.add(p);
    g.userData.print = { mesh: p, tex: t };
  }
  return g;
}

// ── croissant on a small plate (for the tap scene) ───────────────────────────
export function croissantPlate() {
  const g = new THREE.Group(), cer = new THREE.MeshPhysicalMaterial({ color: 0xf6f3ec, roughness: 0.2, clearcoat: 0.8 });
  const plate = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [6, 0], [8.2, 0.8], [8.8, 1.1], [8.5, 1.2], [6.2, 0.45], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 48), cer);
  plate.castShadow = plate.receiveShadow = true; g.add(plate);
  const crust = new THREE.MeshPhysicalMaterial({ color: 0xc7832f, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4 });
  const N = 9;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1), a = lerpA(-1.15, 1.15, f), R = 4.2, w = 0.55 + Math.sin(f * Math.PI) * 1.25;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), crust);
    m.scale.set(w * 0.95, w * 0.78, w * 1.15); m.position.set(Math.sin(a) * R, 0.6 + w * 0.7, -Math.cos(a) * R + 3.2); m.rotation.y = -a;
    m.castShadow = true; g.add(m);
  }
  return g;
}
const lerpA = (a, b, t) => a + (b - a) * t;
