// ─────────────────────────────────────────────────────────────────────────────
// reel.js — the 17 s vertical reel. frame(t) draws one complete frame as a pure
// function of t (3D world via three.js + 2D Google-Maps-style overlays).
//
//  0.0–1.6  map pin drops, camera dives into the city
//  1.6–4.0  the customer (blue dot) follows a growing route to the bakery
//  4.0–6.0  in and out of the bakery — happy, but no review
//  6.0–7.5  route to Café Limon, camera swoops down behind the dot
//  7.5–11.0 inside the café: dot reaches the stand, taps it, 5 stars
// 11.0–14.0 zoom out: customers stream in, reviews rise, 2.7 → 4.9
// 14.0–17.0 stand hero + "One Tap. Instant 5-Star Reviews."
// ─────────────────────────────────────────────────────────────────────────────
import { THREE, W, H, buildCafe, buildStand, buildDot } from './world.js';
import { buildCity, routeGeometry, HERO } from './city.js';

const DUR = 17, FPS = 30;
const { E } = U, { prog, lerp, clamp } = U;
const CUES = {
  pin: 0.12, dive: 0.55, bakeryIn: 4.0, smile: 4.95, sad: 5.25, cafeDoor: 7.45, tap: 9.6,
  stars: [9.95, 10.1, 10.25, 10.4, 10.55], posted: 10.68, up: 10.88,
  arrivals: [11.55, 11.85, 12.15, 12.45, 12.75, 13.05, 13.35, 13.62], wipe: 13.85, final: 14.6,
};
window.REEL = { DUR, FPS, CUES };

// ── fonts ────────────────────────────────────────────────────────────────────
const F = '../nfc-stand-video/fonts/';
const HEB = 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F';
const LAT = 'U+0000-00FF, U+2000-206F, U+2122, U+FEFF, U+FFFD';
async function fonts() {
  const fs = [];
  for (const w of [400, 500, 600, 700, 800]) for (const [s, r] of [['hebrew', HEB], ['latin', LAT]]) fs.push(new FontFace('Rubik', `url(${F}rubik-${s}-${w}-normal.woff2)`, { weight: String(w), unicodeRange: r }));
  for (const w of [400, 600, 700]) for (const [s, r] of [['hebrew', HEB], ['latin', LAT]]) fs.push(new FontFace('Open Sans', `url(${F}open-sans-${s}-${w}-normal.woff2)`, { weight: String(w), unicodeRange: r }));
  for (const w of [600, 700]) for (const [s, r] of [['hebrew', HEB], ['latin', LAT]]) fs.push(new FontFace('Open Sans', `url(${F}open-sans-${s}-${w}-italic.woff2)`, { weight: String(w), style: 'italic', unicodeRange: r }));
  for (const w of [400, 500, 600, 700]) fs.push(new FontFace('Inter', `url(${F}inter-latin-${w}-normal.woff2)`, { weight: String(w) }));
  await Promise.all(fs.map((f) => f.load().then((x) => document.fonts.add(x))));
}

const out = document.getElementById('out'), ctx = out.getContext('2d', { willReadFrequently: true });
const he = (o) => Object.assign({ family: 'Rubik', dir: 'rtl', align: 'center' }, o);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let renderer;

// ── scenes ───────────────────────────────────────────────────────────────────
const STORES = [
  { id: 'bakery', slot: 1, name: 'מאפיית בוקר', color: 0xf6dcc2, awning: 0xc96f4a, signBg: '#fff7ee', signFg: '#a0522d' },
  { id: 'cafe', slot: 4, name: 'קפה לימון', color: 0xfbe7a6, awning: 0x2f9e6a, signBg: '#ffffff', signFg: '#2f7d55' },
];
let city, cm, cityCam, sun, heroDot, routeFill, routeEdge, crowd = [], bak, caf, P1, P2, L1, L2;
let cafe, cafeCam, cafeDot, G_CAFE, N_CAFE;
let endScene, endCam, standEnd;

function lenOf(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function pathAt(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + L || i === pts.length - 1) {
      const f = clamp((s - acc) / L);
      return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L };
    }
    acc += L;
  }
}
function subPolyline(pts, s0, s1) {
  const res = []; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lo = Math.max(s0, acc), hi = Math.min(s1, acc + L);
    if (hi > lo) {
      const p = (s) => [a[0] + ((b[0] - a[0]) * (s - acc)) / L, a[1] + ((b[1] - a[1]) * (s - acc)) / L];
      if (!res.length) res.push(p(lo));
      res.push(p(hi));
    }
    acc += L;
  }
  return res;
}

function setupCity() {
  city = new THREE.Scene(); city.background = new THREE.Color(0xe8edf3);
  city.fog = new THREE.Fog(0xe8edf3, 320, 760);
  const g = buildCity({ stores: STORES }); city.add(g); cm = g.userData;
  city.add(new THREE.HemisphereLight(0xffffff, 0xd9dee6, 1.25));
  sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { near: 1, far: 800 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
  city.add(sun, sun.target);
  heroDot = buildDot(1); city.add(heroDot);
  routeFill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x4285f4, polygonOffset: true, polygonOffsetFactor: -2 }));
  routeEdge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x1a5bc9, polygonOffset: true, polygonOffsetFactor: -1 }));
  city.add(routeEdge, routeFill);
  for (let i = 0; i < CUES.arrivals.length; i++) { const d = buildDot(1); d.visible = false; city.add(d); crowd.push(d); }
  bak = cm.stores.bakery; caf = cm.stores.cafe;
  const wz = HERO.walkZ;
  P1 = [[-52, wz], [bak.x, wz], [bak.x, -8.7]];
  P2 = [[bak.x, wz], [caf.x, wz], [caf.x, -8.7]];
  L1 = lenOf(P1); L2 = lenOf(P2);
  cityCam = new THREE.PerspectiveCamera(40, W / H, 3, 1300);
}

function setupCafe() {
  cafe = new THREE.Scene(); cafe.background = new THREE.Color(0xf4ece0);
  const stand = buildStand(Art.standFace()); cafe.add(buildCafe(stand));
  cafe.add(new THREE.HemisphereLight(0xfff4e6, 0xb89a7a, 1.2));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(3, 6, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); key.shadow.radius = 5; cafe.add(key);
  cafeDot = buildDot(0.17); cafe.add(cafeDot);
  cafe.updateMatrixWorld(true);
  const panel = stand.userData.panel;
  G_CAFE = panel.localToWorld(stand.userData.badgeLocal.clone());
  const o = panel.localToWorld(V3(0, 0, 0)), z1 = panel.localToWorld(V3(0, 0, 1));
  N_CAFE = z1.sub(o).normalize();
  cafeCam = new THREE.PerspectiveCamera(46, W / H, 0.03, 80);
}

function mapFloorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#eef1f5'; x.fillRect(0, 0, 1024, 1024);
  x.fillStyle = '#e2f0dc'; x.fillRect(560, 120, 260, 200); x.fillRect(90, 640, 200, 230);
  x.fillStyle = '#ffffff';
  for (let i = 0; i < 1024; i += 256) { x.fillRect(i + 110, 0, 26, 1024); x.fillRect(0, i + 60, 1024, 26); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.anisotropy = 8;
  return t;
}
function setupEnd() {
  endScene = new THREE.Scene(); endScene.background = new THREE.Color(0xeef2f7);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: mapFloorTex(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; endScene.add(floor);
  endScene.fog = new THREE.Fog(0xeef2f7, 90, 220);
  endScene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ee, 1.25));
  const k = new THREE.DirectionalLight(0xffffff, 2.0); k.position.set(-30, 60, 45); k.castShadow = true;
  k.shadow.mapSize.set(2048, 2048); Object.assign(k.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
  k.shadow.bias = -0.0004; endScene.add(k);
  standEnd = buildStand(Art.standFace()); endScene.add(standEnd);
  endCam = new THREE.PerspectiveCamera(30, W / H, 1, 600);
}

// ── city timeline ────────────────────────────────────────────────────────────
const AZ = new THREE.Vector2(66, 184).normalize();
const DEG = Math.PI / 180;
const T0 = V3(-12, 0, -22), T1 = V3(-6, 0, -20);
function orbit(T, el, D) { const h = Math.cos(el) * D; return V3(T.x + AZ.x * h, T.y + Math.sin(el) * D, T.z + AZ.y * h); }
function cityCamera(t) {
  let pos, tgt, fov = 40;
  if (t < 1.6) {
    const p = prog(t, 0.35, 1.6);
    const el = lerp(89.5, 47.9, E.inOut(p)) * DEG, D = Math.exp(lerp(Math.log(1050), Math.log(291), E.out(p)));
    pos = orbit(T0, el, D); tgt = T0.clone();
  } else if (t < 4.0) {
    const q = E.inOut(prog(t, 1.6, 4.0));
    tgt = T0.clone().lerp(T1, q); pos = orbit(tgt, lerp(47.9, 49, q) * DEG, lerp(291, 268, q));
  } else if (t < 5.85) {
    tgt = T1.clone(); pos = orbit(tgt, 49 * DEG, lerp(268, 262, prog(t, 4.0, 5.85)));
  } else if (t < 10.8) {
    const P0 = orbit(T1, 49 * DEG, 262), Cc = V3(caf.x + 12, 70, 60), E1 = V3(caf.x - 11, 10.5, 13);
    const p = E.inOut(prog(t, 5.85, 7.45));
    pos = P0.clone().multiplyScalar((1 - p) * (1 - p)).add(Cc.clone().multiplyScalar(2 * p * (1 - p))).add(E1.clone().multiplyScalar(p * p));
    tgt = T1.clone().lerp(V3(caf.x + 0.5, 2.6, -9.2), E.inOut(prog(t, 5.85, 7.3)));
    fov = lerp(40, 46, p);
    const push = E.in(prog(t, 7.42, 7.64));
    pos.lerp(V3(caf.x, 2.6, -6.5), push * 0.6);
  } else {
    const TW = V3(caf.x - 3, 0, -16);
    const q = E.out(prog(t, 10.88, 12.3));
    tgt = TW; pos = orbit(TW, lerp(84, 50, q) * DEG, lerp(46, 168, q) + 14 * prog(t, 12.3, 14.2));
  }
  return { pos, tgt, fov };
}

function heroDotState(t) {
  if (t < 2.6) return { ...pathAt(P1, 0), s: 0, route: 1, k: 1 };
  if (t < 4.0) return { ...pathAt(P1, L1 * E.inOut(prog(t, 2.6, 4.0))), s: L1 * E.inOut(prog(t, 2.6, 4.0)), route: 1, k: 1 };
  if (t < 4.9) {
    const k = t < 4.25 ? 1 - E.in(prog(t, 4.0, 4.25)) : t < 4.65 ? 0 : E.out(prog(t, 4.65, 4.9));
    return { ...pathAt(P1, L1), s: L1, route: 0, k };
  }
  if (t < 6.1) {
    const f = E.inOut(prog(t, 4.9, 5.15));
    return { x: bak.x, z: lerp(-8.7, HERO.walkZ, f), dx: 1, dz: 0, s: 0, route: 2, k: 1 };
  }
  const s = L2 * E.inOut(prog(t, 6.1, 7.38));
  return { ...pathAt(P2, s), s, route: 2, k: 1 };
}

function placeDot(d, x, z, dx, dz, scale, camPos) {
  d.position.set(x, 0.5, z);
  d.rotation.set(0, Math.atan2(dx, dz), 0);
  d.scale.setScalar(scale);
  d.visible = scale > 0.01;
}

function updateCity(t) {
  cm.setTraffic(t);
  const cam = cityCamera(t);
  cityCam.position.copy(cam.pos); cityCam.lookAt(cam.tgt); cityCam.fov = cam.fov;
  const dist = cam.pos.distanceTo(cam.tgt);
  cityCam.near = clamp(dist * 0.01, 0.15, 3); cityCam.updateProjectionMatrix();
  // sun + shadow volume follow the action
  sun.position.set(cam.tgt.x - 160, 260, cam.tgt.z + 190); sun.target.position.copy(cam.tgt); sun.target.updateMatrixWorld();
  const S = clamp(dist * 0.7, 32, 190);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S }); sun.shadow.camera.updateProjectionMatrix();

  // hero dot (screen-constant size like a Maps marker)
  const st = heroDotState(t);
  const dDot = cam.pos.distanceTo(V3(st.x, 0, st.z));
  const k = Math.max(0.55, dDot * 0.0166);
  placeDot(heroDot, st.x, st.z, st.dx, st.dz, k * st.k, cam.pos);
  heroDot.visible = t < 7.62 && st.k > 0.01;
  // route ahead of the dot, growing toward the next destination
  routeFill.visible = routeEdge.visible = false;
  let pts = null, s0 = 0, s1 = 0;
  if (t >= 1.7 && t < 4.0) { pts = P1; s0 = st.s; s1 = L1 * E.inOut(prog(t, 1.7, 2.7)); }
  if (t >= 5.6 && t < 7.4) { pts = P2; s0 = st.route === 2 ? st.s : 0; s1 = L2 * E.inOut(prog(t, 5.6, 6.2)); }
  if (pts && s1 - s0 > 0.4) {
    const sub = subPolyline(pts, s0, s1);
    const wF = Math.max(0.7, dDot * 0.0103), wE = wF + Math.max(0.22, dDot * 0.0041);
    routeEdge.geometry.dispose(); routeFill.geometry.dispose();
    routeEdge.geometry = routeGeometry(sub, Infinity, wE, 0.3); routeFill.geometry = routeGeometry(sub, Infinity, wF, 0.45);
    routeFill.visible = routeEdge.visible = true;
  }
  // customers streaming into the café (wall segment)
  crowd.forEach((d, i) => {
    const a = CUES.arrivals[i], side = i % 2 ? 1 : -1, x0 = caf.x + side * (22 + 7 * (i % 3));
    const walk = Math.abs(x0 - caf.x) / 15, t0 = a - walk - 0.25;
    if (t < 10.9 || t < t0 - 0.2 || t > a + 0.3) { d.visible = false; return; }
    const z = HERO.walkZ + ((i % 3) - 1) * 0.5;
    let x = x0, zz = z, kk = 1;
    if (t < a - 0.25) x = lerp(x0, caf.x, prog(t, t0, a - 0.25));
    else { x = caf.x; zz = lerp(z, -8.8, prog(t, a - 0.25, a)); kk = 1 - E.in(prog(t, a - 0.1, a + 0.25)); }
    kk *= E.out(prog(t, t0 - 0.2, t0 + 0.1));
    const dd = cam.pos.distanceTo(V3(x, 0, zz));
    placeDot(d, x, zz, t < a - 0.25 ? -side : 0, t < a - 0.25 ? 0 : -1, Math.max(0.55, dd * 0.0155) * kk);
  });
  return { cam, dist };
}

// ── café timeline ────────────────────────────────────────────────────────────
const cafeKF = U.KF([
  [7.45, { px: 0.25, py: 1.8, pz: 5.4, tx: 0.8, ty: 1.15, tz: -1.8, fov: 48 }],
  [9.0, { px: 0.62, py: 1.62, pz: 1.9, tx: 1.05, ty: 1.15, tz: -1.8, fov: 44 }, E.inOut],
  [9.5, { px: 1.06, py: 1.4, pz: -0.5, tx: 1.15, ty: 1.27, tz: -1.8, fov: 38 }, E.inOut],
  [10.75, { px: 1.04, py: 1.43, pz: -0.4 }, E.smooth],
  [11.1, { px: 1.0, py: 2.6, pz: 0.6, tx: 1.15, ty: 1.0, tz: -1.8, fov: 46 }, E.in],
]);
function updateCafe(t) {
  const k = cafeKF(t);
  let px = k.px, py = k.py, pz = k.pz;
  const sh = prog(t, CUES.tap, CUES.tap + 0.28);
  if (sh > 0 && sh < 1) { const a = 0.006 * Math.sin(Math.PI * sh); px += a * Math.sin(t * 160); py += a * Math.cos(t * 210); }
  cafeCam.position.set(px, py, pz); cafeCam.lookAt(k.tx, k.ty, k.tz); cafeCam.fov = k.fov; cafeCam.updateProjectionMatrix();
  // the dot: walks to the counter, hops onto the stand's G, taps, drops back
  const floorP = V3(lerp(0.3, 0.95, E.out(prog(t, 7.5, 9.0))), 0.02, lerp(4.0, -1.25, E.out(prog(t, 7.5, 9.0))));
  const up = E.inOut(prog(t, 9.28, 9.6)), down = E.inOut(prog(t, 9.86, 10.16));
  const hop = up * (1 - down);
  const onStand = G_CAFE.clone().addScaledVector(N_CAFE, 0.006);
  const p = floorP.clone().lerp(onStand, hop); p.y += Math.sin(Math.PI * hop) * 0.18;
  cafeDot.position.copy(p);
  const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
  const qWall = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), N_CAFE);
  cafeDot.quaternion.copy(qFlat).slerp(qWall, hop);
  cafeDot.scale.setScalar(lerp(0.17, 0.05, hop));
  cafeDot.userData.halo.visible = cafeDot.userData.beam.visible = hop < 0.05;
}

// ── end timeline ─────────────────────────────────────────────────────────────
function updateEnd(t) {
  const rise = E.out(prog(t, 14.0, 14.7));
  standEnd.position.set(0, lerp(-7, 0, rise), 0);
  standEnd.rotation.y = lerp(-34, -18, E.out(prog(t, 14.0, 17.0))) * DEG;
  endCam.position.set(0, 10.5, 60); endCam.lookAt(0, 3.0, -2); endCam.updateProjectionMatrix();
}

// ── 2D overlays ──────────────────────────────────────────────────────────────
const proj = (v, cam) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H, p.z]; };

function placeLabel(x, y, name, rating, count, hi, alpha = 1, glow = 0) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
  ctx.fillStyle = hi ? '#EA4335' : '#F28B30';
  ctx.beginPath(); ctx.arc(0, -46, 20, Math.PI * 0.82, Math.PI * 2.18); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -46, 7.5, 0, Math.PI * 2); ctx.fill();
  const w1 = U.measure(ctx, name, he({ size: 30, weight: 600 })), w = Math.max(w1, 210) + 44;
  ctx.save();
  ctx.shadowColor = glow > 0 ? `rgba(52,168,83,${0.55 * glow})` : 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 18 + 30 * glow; ctx.shadowOffsetY = 4;
  U.rr(ctx, -w / 2, -160, w, 92, 20); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  U.text(ctx, name, 0, -122, he({ size: 30, weight: 600, color: '#202124' }));
  const rx = 66;
  U.text(ctx, rating.toFixed(1), rx, -84, { size: 23, weight: 600, color: glow > 0.3 ? '#188038' : '#202124', align: 'right' });
  for (let i = 0; i < 5; i++) U.star(ctx, rx - 52 - i * 19, -92, 8.5, clamp(rating - i), '#FBBC04', '#DADCE0', 1.2);
  U.text(ctx, `(${count})`, rx - 52 - 4 * 19 - 16, -84, { size: 22, weight: 500, color: '#70757A', align: 'right' });
  ctx.restore();
}
function caption(text, y, pin, pout, sub) {
  const a = clamp(pin * 1.4) * (1 - clamp(pout));
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const dy = (1 - E.out(pin)) * 28 - pout * 16;
  const o = he({ size: 60, weight: 700, color: '#202124' });
  const w = U.measure(ctx, text, o) + 84;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.16)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  U.rr(ctx, W / 2 - w / 2, y - 66 + dy, w, 100, 50); ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.restore();
  U.text(ctx, text, W / 2, y + 4 + dy, o);
  if (sub) U.text(ctx, sub, W / 2, y + 86 + dy, he({ size: 36, weight: 500, color: '#3C4043' }));
  ctx.restore();
}
function navCard(alpha, big, small, arrived) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  U.rr(ctx, 40, 70, W - 80, 170, 34); ctx.fillStyle = '#137333'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(W - 130, 155); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  if (arrived) { ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-30, 2); ctx.lineTo(-8, 26); ctx.lineTo(32, -22); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(34, -6); ctx.lineTo(12, -6); ctx.lineTo(12, 44); ctx.lineTo(-12, 44); ctx.lineTo(-12, -6); ctx.lineTo(-34, -6); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  U.text(ctx, big, W - 210, 140, he({ size: 60, weight: 700, color: '#fff', align: 'right' }));
  U.text(ctx, small, W - 210, 205, he({ size: 40, weight: 500, color: 'rgba(255,255,255,0.92)', align: 'right' }));
  ctx.restore();
}
function mapPin(x, y, s, alpha) {
  if (alpha <= 0 || s <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#EA4335';
  ctx.beginPath(); ctx.arc(0, -70, 52, Math.PI * 0.8, Math.PI * 2.2); ctx.quadraticCurveTo(10, -20, 0, 0); ctx.quadraticCurveTo(-10, -20, -42, -100); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#B31412'; ctx.beginPath(); ctx.arc(0, -70, 19, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function smiley(x, y, s, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
  U.rr(ctx, -62, -62, 124, 112, 34); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, 48); ctx.lineTo(0, 70); ctx.lineTo(14, 48); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(0, -6, 38, 0, Math.PI * 2); ctx.fillStyle = '#FBBC04'; ctx.fill();
  ctx.fillStyle = '#5f3b00'; ctx.beginPath(); ctx.arc(-13, -16, 5.5, 0, Math.PI * 2); ctx.arc(13, -16, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5f3b00'; ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -6, 20, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
  ctx.restore();
}
function ripples(x, y, t0, t, n = 3, maxR = 300) {
  for (let k = 0; k < n; k++) {
    const p = prog(t, t0 + k * 0.14, t0 + k * 0.14 + 0.9);
    if (p <= 0 || p >= 1) continue;
    ctx.beginPath(); ctx.arc(x, y, 30 + maxR * E.out(p), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(66,133,244,${Math.pow(1 - p, 1.3) * 0.85})`; ctx.lineWidth = 6 * (1 - p * 0.6); ctx.stroke();
  }
}
function tapCard(t) {
  const pin = E.arrive(prog(t, 9.78, 10.15)), pout = E.in(prog(t, 10.82, 11.0));
  if (pin <= 0 || pout >= 1) return;
  ctx.save(); ctx.globalAlpha *= clamp(pin * 1.5) * (1 - pout);
  const cx = W / 2, cy = 470, s = (0.85 + 0.15 * pin) * 0.86;
  ctx.translate(cx, cy - 255); ctx.scale(s, s); ctx.translate(-cx, -cy);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 46; ctx.shadowOffsetY = 14;
  U.rr(ctx, 110, 250, W - 220, 420, 44); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  U.avatar(ctx, W - 186, 334, 42, '#2F9E6A', 'ק');
  U.text(ctx, 'קפה לימון', W - 250, 330, he({ size: 46, weight: 700, color: '#202124', align: 'right' }));
  U.text(ctx, 'בית קפה · כפר סבא', W - 250, 378, he({ size: 30, weight: 400, color: '#70757A', align: 'right' }));
  CUES.stars.forEach((s0, i) => {
    const f = E.out(prog(t, s0, s0 + 0.12)), pu = E.bump(prog(t, s0, s0 + 0.26));
    const x = W / 2 + (2 - i) * 120, y = 492, R = 44 * (1 + 0.22 * pu);
    if (pu > 0.01) { const gg = ctx.createRadialGradient(x, y, 0, x, y, 90); gg.addColorStop(0, `rgba(251,188,4,${0.3 * pu})`); gg.addColorStop(1, 'rgba(251,188,4,0)'); ctx.fillStyle = gg; ctx.fillRect(x - 90, y - 90, 180, 180); }
    U.star(ctx, x, y, R, f, '#FBBC04', '#DADCE0', 4);
  });
  const ok = E.out(prog(t, CUES.posted, CUES.posted + 0.25));
  if (ok > 0) {
    ctx.save(); ctx.globalAlpha *= ok;
    U.text(ctx, 'הביקורת פורסמה', W / 2 + 26, 614, he({ size: 34, weight: 600, color: '#188038' }));
    const tw = U.measure(ctx, 'הביקורת פורסמה', he({ size: 34, weight: 600 }));
    U.verified(ctx, W / 2 + 26 - tw / 2 - 30, 602, 17, '#188038');
    ctx.restore();
  }
  ctx.restore();
}
const REVIEWS = [
  ['נועה כ.', 'נ', '#34A853', 'הצמדתי את הטלפון וזהו. הכי קל שיש!'],
  ['אבי ל.', 'א', '#4285F4', 'קפה מעולה ושירות מהיר. חמישה כוכבים.'],
  ['מאיה ש.', 'מ', '#EA4335', 'טאפ אחד והביקורת נשלחה. מושלם.'],
  ['יוסי ב.', 'י', '#A142F4', 'המקום הכי טעים בשכונה!'],
  ['שירה מ.', 'ש', '#F29900', 'צוות מקסים, נחזור שוב.'],
  ['דניאל ר.', 'ד', '#12B5CB', 'הקרואסון פשוט מדהים.'],
  ['תמר א.', 'ת', '#E52592', 'אווירה נעימה וקפה מושלם.'],
  ['רון ג.', 'ר', '#1E8E3E', 'שירות מהיר ואדיב. ממליץ!'],
];
const arrived = (t) => CUES.arrivals.reduce((n, a) => n + E.smooth(prog(t, a, a + 0.25)), 0);
function cafeRating(t) {
  const f = arrived(t) / CUES.arrivals.length;
  return { r: 2.7 + 2.2 * E.smooth(f), c: Math.round(38 + 203 * f), f };
}
function sheet(t) {
  const sIn = E.out(prog(t, 11.35, 11.8)), sOut = E.in(prog(t, 13.85, 14.1));
  if (sIn <= 0) return;
  const top = lerp(H + 20, 1160, sIn) + sOut * 300;
  ctx.save();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = -6;
  U.rr(ctx, 30, top, W - 60, H - top + 80, 46); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  U.rr(ctx, W / 2 - 40, top + 18, 80, 9, 5); ctx.fillStyle = '#DADCE0'; ctx.fill();
  const { r, c, f } = cafeRating(t);
  U.text(ctx, 'קפה לימון', W - 80, top + 95, he({ size: 52, weight: 700, color: '#202124', align: 'right' }));
  U.text(ctx, r.toFixed(1), W - 80, top + 160, { size: 40, weight: 700, color: f > 0.5 ? '#188038' : '#202124', align: 'right' });
  for (let i = 0; i < 5; i++) U.star(ctx, W - 168 - i * 36, top + 146, 15, clamp(r - i), '#FBBC04', '#DADCE0', 2);
  U.text(ctx, `(${c} ביקורות)`, W - 360, top + 160, he({ size: 30, weight: 400, color: '#70757A', align: 'right' }));
  // reviews rise in, one per arriving customer
  const listTop = top + 200;
  ctx.save(); ctx.beginPath(); ctx.rect(30, listTop - 6, W - 60, H - listTop + 10); ctx.clip();
  const scroll = Math.max(0, arrived(t) - 3) * 168;
  CUES.arrivals.forEach((a, i) => {
    const pin = E.out(prog(t, a, a + 0.35));
    if (pin <= 0) return;
    const y = listTop + i * 168 - scroll + (1 - pin) * 120;
    ctx.save(); ctx.globalAlpha *= pin;
    const [n, ini, col, txt] = REVIEWS[i];
    U.rr(ctx, 60, y, W - 120, 150, 26); ctx.fillStyle = i === Math.floor(arrived(t) - 0.01) ? '#EEF4FE' : '#F7F8FA'; ctx.fill();
    U.avatar(ctx, W - 110, y + 48, 26, col, ini);
    U.text(ctx, n, W - 152, y + 52, he({ size: 30, weight: 600, color: '#202124', align: 'right' }));
    U.text(ctx, 'עכשיו', 100, y + 52, he({ size: 24, weight: 400, color: '#70757A', align: 'left' }));
    for (let k = 0; k < 5; k++) U.star(ctx, W - 160 - k * 26, y + 88, 10, 1, '#FBBC04');
    U.text(ctx, txt, W - 96, y + 128, he({ size: 28, weight: 400, color: '#3C4043', align: 'right' }));
    ctx.restore();
  });
  ctx.restore();
  ctx.restore();
}
function lockup(t) {
  const X = W / 2;
  const pb = E.out(prog(t, 14.55, 15.05));
  if (pb > 0) { ctx.save(); ctx.globalAlpha *= clamp(pb * 1.4); U.gBadge(ctx, X, 1296 + (1 - pb) * 40, 46, true); ctx.restore(); }
  for (let i = 0; i < 5; i++) {
    const p = E.arrive(prog(t, 14.7 + i * 0.07, 15.1 + i * 0.07));
    if (p <= 0) continue;
    ctx.save(); ctx.globalAlpha *= clamp(p * 2); ctx.translate(X + (i - 2) * 50, 1384); ctx.scale(p, p); U.star(ctx, 0, 0, 20, 1, '#FBBC04'); ctx.restore();
  }
  U.maskLine(ctx, 'One Tap.', X, 1510, { size: 104, weight: 700, align: 'center', ls: -3, color: '#202124', family: 'Inter' }, E.out(prog(t, 14.85, 15.5)));
  U.maskLine(ctx, [['Instant ', '#1A73E8'], ['5-Star', '#F29900'], [' Reviews.', '#1A73E8']], X, 1600, { size: 60, weight: 600, align: 'center', ls: -1, family: 'Inter' }, E.out(prog(t, 15.0, 15.65)));
}

// ── compositing ──────────────────────────────────────────────────────────────
function render3D(scene, cam, alpha) {
  renderer.render(scene, cam);
  ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, W, H); ctx.restore();
}
function drawCity(t, alpha) {
  const { cam, dist } = updateCity(t);
  render3D(city, cityCam, alpha);
  ctx.save(); ctx.globalAlpha = alpha;
  // intro: washed map, the pin lands and we dive into it
  if (t < 1.5) {
    const wash = 1 - E.inOut(prog(t, 0.45, 1.35));
    if (wash > 0) { ctx.fillStyle = `rgba(244,246,249,${0.92 * wash})`; ctx.fillRect(0, 0, W, H); }
    const drop = E.arrive(prog(t, CUES.pin, CUES.pin + 0.4)), zoom = E.in(prog(t, 0.6, 1.25));
    mapPin(W / 2, lerp(760, 960, drop) + zoom * 200, (0.2 + 0.8 * drop) * (1 + zoom * 5), clamp(drop * 1.6) * (1 - zoom));
  }
  const labA = clamp(prog(t, 1.75, 2.1)) * (1 - prog(t, 6.2, 6.7)) + (t > 11.1 ? clamp(prog(t, 11.4, 11.7)) * (1 - prog(t, 13.8, 13.95)) : 0);
  if (labA > 0) {
    const cr = t > 11 ? cafeRating(t) : { r: 2.7, c: 38, f: 0 };
    const [bx, by] = proj(bak.top, cityCam), [cx, cy] = proj(caf.top, cityCam);
    placeLabel(bx, by, 'מאפיית בוקר', 3.2, 31, false, labA);
    placeLabel(cx, cy, 'קפה לימון', cr.r, cr.c, true, labA, cr.f > 0.05 ? clamp(cr.f * 2) : 0);
  }
  // nav header
  if (t > 1.7 && t < 7.0) {
    const a = clamp(prog(t, 1.7, 2.05)) * (1 - prog(t, 6.6, 6.95));
    const st = heroDotState(t);
    if (t < 4.0) navCard(a, `${Math.max(0, Math.ceil((L1 - st.s) / 5) * 5)} מ׳`, 'לכיוון מאפיית בוקר', false);
    else if (t < 5.6) navCard(a, 'הגעת ליעד', 'מאפיית בוקר', true);
    else navCard(a, `${Math.max(0, Math.ceil((L2 - (st.route === 2 ? st.s : 0)) / 5) * 5)} מ׳`, 'לכיוון קפה לימון', false);
  }
  // bakery: happy, but no review
  if (t > 4.9 && t < 6.1) {
    const [x, y] = proj(V3(bak.x, 6, HERO.walkZ - 1), cityCam);
    const pin = E.arrive(prog(t, CUES.smile, CUES.smile + 0.35)), pout = E.in(prog(t, 5.75, 6.05));
    smiley(x, y - 150, pin, 1 - pout);
    const sp = prog(t, CUES.sad, CUES.sad + 0.7);
    if (sp > 0 && sp < 1) { ctx.save(); ctx.globalAlpha *= (1 - sp) * clamp(sp * 6); U.star(ctx, x + 128, y - 196 + sp * 80, 40 * (1 - 0.3 * sp), 0, '#FBBC04', '#80868B', 6); ctx.restore(); }
  }
  // wall: stars rise from the café as each customer walks in
  if (t > 11.3 && t < 14) {
    const [x, y] = proj(caf.top, cityCam);
    CUES.arrivals.forEach((a, i) => {
      const p = prog(t, a, a + 0.9);
      if (p <= 0 || p >= 1) return;
      ctx.save(); ctx.globalAlpha *= Math.sin(Math.PI * p);
      U.star(ctx, x + ((i % 3) - 1) * 70, y - 190 - 170 * E.out(p), 26 + 10 * E.bump(p), 1, '#FBBC04');
      ctx.restore();
    });
  }
  // captions
  caption('הלקוחות שלך מרוצים...', 1450, prog(t, 1.9, 2.3), prog(t, 3.75, 3.95));
  caption('...אבל לא משאירים ביקורת', 1450, prog(t, 4.35, 4.75), prog(t, 5.8, 6.0));
  caption('כל ביקור הופך לביקורת', 330, prog(t, 11.3, 11.7), prog(t, 13.75, 13.95));
  sheet(t);
  ctx.restore();
}
function drawCafe(t, alpha) {
  updateCafe(t);
  render3D(cafe, cafeCam, alpha);
  ctx.save(); ctx.globalAlpha = alpha;
  const [gx, gy] = proj(G_CAFE, cafeCam);
  if (t < 9.55) { // soft halo around the stand on approach
    const a = clamp(prog(t, 8.2, 8.6)) * (1 - prog(t, 9.3, 9.55));
    if (a > 0) { ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(66,133,244,0.7)'; ctx.lineWidth = 5;
      const R = 70 + 60 * E.inOut(prog(t, 8.2, 9.5)); ctx.beginPath(); ctx.arc(gx, gy, R, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  ripples(gx, gy, CUES.tap, t, 3, 380);
  tapCard(t);
  caption('נכנסים לקפה לימון', 300, prog(t, 7.75, 8.15), prog(t, 8.95, 9.15), 'ועל הדלפק — המעמד');
  caption('טאפ אחד — וזה נשלח', 1560, prog(t, 9.5, 9.9), prog(t, 10.7, 10.9));
  ctx.restore();
}
function drawEnd(t) {
  const wipe = E.inOut(prog(t, CUES.wipe, CUES.wipe + 0.35));
  if (t < 14.25) {
    const [x, y] = proj(caf.top, cityCam);
    ctx.save(); ctx.fillStyle = '#eef2f7'; ctx.beginPath(); ctx.arc(x, y, wipe * 2400, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if (t >= 14.0) {
    updateEnd(t);
    render3D(endScene, endCam, E.inOut(prog(t, 14.0, 14.3)));
    lockup(t);
  }
}
function frame(t) {
  t = clamp(t, 0, DUR - 1e-4);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = '#eef1f5'; ctx.fillRect(0, 0, W, H);
  if (t < 7.64) drawCity(t, 1);
  if (t >= 7.45 && t < 11.08) drawCafe(t, t < 7.64 ? E.inOut(prog(t, 7.45, 7.64)) : 1);
  if (t >= 10.85 && t < 14.3) drawCity(t, t < 11.08 ? E.inOut(prog(t, 10.85, 11.08)) : 1);
  if (t >= CUES.wipe) drawEnd(t);
}

// ── API ──────────────────────────────────────────────────────────────────────
async function main() {
  await fonts();
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1.5); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  setupCity(); setupCafe(); setupEnd();
  window.seek = async (t) => { frame(t); };
  const N = W * H * 4;
  let acc = null;
  window.renderFrame = async (i, opts = {}) => {
    const n = opts.samples || 3, shutter = opts.shutter == null ? 0.5 : opts.shutter;
    if (n === 1) frame(i / FPS);
    else {
      acc = acc || new Float32Array(N); acc.fill(0);
      for (let k = 0; k < n; k++) {
        frame((i + ((k + 0.5) / n - 0.5) * shutter) / FPS);
        const d = ctx.getImageData(0, 0, W, H).data;
        for (let j = 0; j < N; j++) acc[j] += d[j];
      }
      const img = ctx.createImageData(W, H), o = img.data, inv = 1 / n;
      for (let j = 0; j < N; j++) o[j] = acc[j] * inv + 0.5;
      ctx.putImageData(img, 0, 0);
    }
    return opts.noData ? null : out.toDataURL('image/png');
  };
  window.ready = true;
}
main();
