// ─────────────────────────────────────────────────────────────────────────────
// reel.js — the 17 s vertical reel. frame(t) draws one complete frame as a pure
// function of t (3D via three.js + 2D Google-Maps-style overlays).
//
// Attention design: the subject (blue dot → stand → phone → café) stays near
// the centre of the frame, captions appear right next to it, and every
// transition starts where the eye already is.
//
//  0.0–1.6  map pin lands on the customer, camera dives into the city
//  1.6–4.0  the blue dot follows a growing route to the bakery
//  4.0–6.0  in and out of the bakery — happy, but no review
//  6.0–7.5  route to Café Limon, camera lowers to the café door
//  7.5–11.1 inside: the dot walks to the counter, a phone taps the stand,
//           the review page fills in on the phone screen
// 11.1–13.9 zoom out: customers stream in, reviews flow up, 2.7 → 4.9
// 13.9–17.0 stand hero + "One Tap. Instant 5-Star Reviews." (single dark colour)
// ─────────────────────────────────────────────────────────────────────────────
import { THREE, W, H, buildStand, buildDot } from './world.js';
import { buildCity, routeGeometry, HERO } from './city.js';
import { buildCafe2 } from './cafe.js';
import { RoundedBoxGeometry } from '../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';

const DUR = 17, FPS = 30;
const { E } = U, { prog, lerp, clamp } = U;
const CUES = {
  pin: 0.12, dive: 0.55, bakeryIn: 4.0, smile: 4.95, sad: 5.25, cafeDoor: 7.45,
  tap: 9.3, stars: [9.95, 10.06, 10.17, 10.28, 10.39], type: [10.42, 10.72], post: 10.78, posted: 10.84, up: 11.08,
  arrivals: [11.6, 11.85, 12.1, 12.35, 12.6, 12.85, 13.1, 13.35], wipe: 13.85, final: 14.6,
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
const DEG = Math.PI / 180;
let renderer;

// ── scenes ───────────────────────────────────────────────────────────────────
const STORES = [
  { id: 'bakery', slot: 1, name: 'מאפיית בוקר', color: 0xf6dcc2, awning: 0xc96f4a, signBg: '#fff7ee', signFg: '#a0522d' },
  { id: 'cafe', slot: 4, name: 'קפה לימון', color: 0xfbe7a6, awning: 0x2f9e6a, signBg: '#ffffff', signFg: '#2f7d55' },
];
let city, cm, cityCam, sun, heroDot, routeFill, routeEdge, crowd = [], bak, caf, P1, P2, L1, L2;
let cafe, cafeCam, cafeDot, standCafe, G_CAFE, phone;
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
  P1 = [[-46, wz], [bak.x, wz], [bak.x, -8.7]];
  P2 = [[bak.x, wz], [caf.x, wz], [caf.x, -8.7]];
  L1 = lenOf(P1); L2 = lenOf(P2);
  cityCam = new THREE.PerspectiveCamera(40, W / H, 3, 1300);
}

function buildPhone() {
  const g = new THREE.Group();
  const Hh = 0.355, Ww = 0.186, D = 0.021;
  const body = new THREE.Mesh(new RoundedBoxGeometry(Ww, Hh, D, 4, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x2a2d33, roughness: 0.32, metalness: 0.6, clearcoat: 0.7 }));
  body.castShadow = true; g.add(body);
  const sw = Ww - 0.009, sh = Hh - 0.009, r = 0.019;
  const s = new THREE.Shape();
  s.moveTo(-sw / 2 + r, -sh / 2); s.lineTo(sw / 2 - r, -sh / 2); s.quadraticCurveTo(sw / 2, -sh / 2, sw / 2, -sh / 2 + r);
  s.lineTo(sw / 2, sh / 2 - r); s.quadraticCurveTo(sw / 2, sh / 2, sw / 2 - r, sh / 2); s.lineTo(-sw / 2 + r, sh / 2);
  s.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh / 2 - r); s.lineTo(-sw / 2, -sh / 2 + r); s.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2 + r, -sh / 2);
  const geo = new THREE.ShapeGeometry(s, 10), uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, (pos.getY(i) + sh / 2) / sh);
  const canvas = document.createElement('canvas'); canvas.width = 820; canvas.height = 1600;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const screen = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.z = D / 2 + 0.0008; g.add(screen);
  g.visible = false;
  return { g, canvas, tex };
}

function setupCafe() {
  cafe = new THREE.Scene(); cafe.background = new THREE.Color(0xf4ece0);
  standCafe = buildStand(Art.standFace()); cafe.add(buildCafe2(standCafe));
  cafe.add(new THREE.HemisphereLight(0xfff6ea, 0xc4a98a, 1.05));
  const win = new THREE.DirectionalLight(0xfff7ec, 1.7); win.position.set(-9, 5.5, 1.5); win.target.position.set(0, 0.8, -2); win.castShadow = true;
  win.shadow.mapSize.set(2048, 2048); Object.assign(win.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 30 }); win.shadow.bias = -0.0004; win.shadow.radius = 4;
  cafe.add(win, win.target);
  const fill = new THREE.DirectionalLight(0xffeedd, 0.55); fill.position.set(4, 4, 6); cafe.add(fill);
  cafeDot = buildDot(0.17); cafe.add(cafeDot);
  phone = buildPhone(); cafe.add(phone.g);
  cafe.updateMatrixWorld(true);
  const panel = standCafe.userData.panel;
  G_CAFE = panel.localToWorld(standCafe.userData.badgeLocal.clone());
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
function orbit(T, el, D) { const h = Math.cos(el) * D; return V3(T.x + AZ.x * h, T.y + Math.sin(el) * D, T.z + AZ.y * h); }
const WALKS = [[2.4, 4.0], [6.0, 7.38]];
const walkF = (t) => Math.max(...WALKS.map(([a, b]) => E.smooth(prog(t, a, a + 0.35)) * (1 - E.smooth(prog(t, b - 0.45, b)))));

function heroDotState(t) {
  if (t < 2.4) return { ...pathAt(P1, 0), s: 0, route: 1, k: 1 };
  if (t < 4.0) { const s = L1 * E.inOut(prog(t, 2.4, 4.0)); return { ...pathAt(P1, s), s, route: 1, k: 1 }; }
  if (t < 4.9) {
    const k = t < 4.25 ? 1 - E.in(prog(t, 4.0, 4.25)) : t < 4.65 ? 0 : E.out(prog(t, 4.65, 4.9));
    return { ...pathAt(P1, L1), s: L1, route: 0, k };
  }
  if (t < 6.0) { const f = E.inOut(prog(t, 4.9, 5.15)); return { x: bak.x, z: lerp(-8.7, HERO.walkZ, f), dx: 1, dz: 0, s: 0, route: 2, k: 1 }; }
  const s = L2 * E.inOut(prog(t, 6.0, 7.38));
  return { ...pathAt(P2, s), s, route: 2, k: 1 };
}

function cityCamera(t) {
  let pos, tgt, fov = 40;
  if (t < 10.8) {
    const st = heroDotState(t), lf = walkF(t) * 5;
    const track = V3(st.x + st.dx * lf, 0, st.z + st.dz * lf);
    if (t < 1.6) {
      const p = prog(t, 0.35, 1.6);
      pos = orbit(track, lerp(89.5, 52, E.inOut(p)) * DEG, Math.exp(lerp(Math.log(1050), Math.log(230), E.out(p))));
      tgt = track;
    } else {
      pos = orbit(track, 52 * DEG, 230); tgt = track;
    }
    const d = E.inOut(prog(t, 6.3, 7.45));
    if (d > 0) {
      const door = V3(caf.x, 2.4, -9.0), E1 = V3(caf.x - 9, 9, 10);
      pos = pos.clone().lerp(E1, d); tgt = tgt.clone().lerp(door, d);
      fov = lerp(40, 46, d);
      pos.lerp(V3(caf.x, 2.5, -5.8), E.in(prog(t, 7.42, 7.64)) * 0.6);
    }
  } else {
    const TW = V3(caf.x, 1, -9.5);
    const q = E.out(prog(t, 10.95, 12.3));
    tgt = TW; pos = orbit(TW, lerp(84, 56, q) * DEG, lerp(46, 150, q) + 12 * prog(t, 12.3, 14.2));
  }
  return { pos, tgt, fov };
}

function placeDot(d, x, z, dx, dz, scale) {
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
  sun.position.set(cam.tgt.x - 160, 260, cam.tgt.z + 190); sun.target.position.copy(cam.tgt); sun.target.updateMatrixWorld();
  const S = clamp(dist * 0.7, 32, 190);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S }); sun.shadow.camera.updateProjectionMatrix();
  // hero dot (screen-constant size, like a Maps marker)
  const st = heroDotState(t);
  const dDot = cam.pos.distanceTo(V3(st.x, 0, st.z));
  placeDot(heroDot, st.x, st.z, st.dx, st.dz, Math.max(0.55, dDot * 0.0166) * st.k);
  heroDot.visible = t < 7.62 && st.k > 0.01;
  // route ahead of the dot, growing toward the next destination
  routeFill.visible = routeEdge.visible = false;
  let pts = null, s0 = 0, s1 = 0;
  if (t >= 1.7 && t < 4.0) { pts = P1; s0 = st.s; s1 = L1 * E.inOut(prog(t, 1.7, 2.5)); }
  if (t >= 5.55 && t < 7.4) { pts = P2; s0 = st.route === 2 ? st.s : 0; s1 = L2 * E.inOut(prog(t, 5.55, 6.1)); }
  if (pts && s1 - s0 > 0.4) {
    const sub = subPolyline(pts, s0, s1);
    const wF = Math.max(0.7, dDot * 0.0103), wE = wF + Math.max(0.22, dDot * 0.0041);
    routeEdge.geometry.dispose(); routeFill.geometry.dispose();
    routeEdge.geometry = routeGeometry(sub, Infinity, wE, 0.3); routeFill.geometry = routeGeometry(sub, Infinity, wF, 0.45);
    routeFill.visible = routeEdge.visible = true;
  }
  // customers streaming into the café (zoom-out segment)
  crowd.forEach((d, i) => {
    const a = CUES.arrivals[i], side = i % 2 ? 1 : -1, x0 = caf.x + side * (20 + 6 * (i % 3));
    const walk = Math.abs(x0 - caf.x) / 15, t0 = a - walk - 0.25;
    if (t < 11.0 || t < t0 - 0.2 || t > a + 0.3) { d.visible = false; return; }
    const z = HERO.walkZ + ((i % 3) - 1) * 0.5;
    let x = x0, zz = z, kk = 1;
    if (t < a - 0.25) x = lerp(x0, caf.x, prog(t, t0, a - 0.25));
    else { x = caf.x; zz = lerp(z, -8.8, prog(t, a - 0.25, a)); kk = 1 - E.in(prog(t, a - 0.1, a + 0.25)); }
    kk *= E.out(prog(t, t0 - 0.2, t0 + 0.1));
    const dd = cam.pos.distanceTo(V3(x, 0, zz));
    placeDot(d, x, zz, t < a - 0.25 ? -side : 0, t < a - 0.25 ? 0 : -1, Math.max(0.55, dd * 0.0155) * kk);
  });
  return { cam, st };
}

// ── café timeline ────────────────────────────────────────────────────────────
const glide = U.cubicBezier(0.3, 0.45, 0.25, 1);   // keeps the entry's momentum, long settle
const cafeDotPos = (t) => { const p = glide(prog(t, 7.5, 8.75)); return V3(lerp(0.4, 1.0, p), 0.02, lerp(3.9, -1.12, p)); };
const STAND_CAM = { pos: V3(1.02, 1.45, -0.42), tgt: V3(1.15, 1.3, -1.83) };
function updateCafe(t) {
  const dp = cafeDotPos(t);
  // wide, slightly raised room view that follows the dot: menu board, shelves, plants, seating
  const wPos = dp.clone().add(V3(-0.55, 2.05, 3.3)), wTgt = dp.clone().add(V3(-0.1, 0.62, -2.6));
  const b = E.inOut(prog(t, 8.55, 9.05));
  const pos = wPos.lerp(STAND_CAM.pos, b), tgt = wTgt.lerp(STAND_CAM.tgt, b);
  const sh = prog(t, CUES.tap, CUES.tap + 0.25);
  if (sh > 0 && sh < 1) { const a = 0.004 * Math.sin(Math.PI * sh); pos.x += a * Math.sin(t * 160); pos.y += a * Math.cos(t * 210); }
  cafeCam.position.copy(pos); cafeCam.lookAt(tgt); cafeCam.fov = lerp(54, 40, b); cafeCam.updateProjectionMatrix();
  cafeCam.updateMatrixWorld();
  // the customer's dot walks to the counter, then the POV takes over
  cafeDot.position.copy(dp); cafeDot.rotation.set(0, Math.PI, 0);
  cafeDot.scale.setScalar(0.17 * (1 - E.in(prog(t, 8.8, 9.05))));
  cafeDot.visible = t < 9.05;
  // the phone: comes in, taps the stand flush, then turns to the viewer
  phone.g.visible = t >= 8.85;
  if (!phone.g.visible) return;
  const camQ = cafeCam.quaternion.clone();
  const fwd = V3(0, 0, -1).applyQuaternion(camQ), up = V3(0, 1, 0).applyQuaternion(camQ), right = V3(1, 0, 0).applyQuaternion(camQ);
  const panel = standCafe.userData.panel, pq = new THREE.Quaternion(); panel.getWorldQuaternion(pq);
  const onStand = (gap) => panel.localToWorld(V3(0, 8.0, 0.15 + 0.405 + gap));
  const startP = cafeCam.position.clone().addScaledVector(fwd, 0.42).addScaledVector(up, -0.48).addScaledVector(right, 0.32);
  const startQ = camQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0.2, -0.35)));
  const readP = cafeCam.position.clone().addScaledVector(fwd, 0.8);
  const readQ = camQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.04, 0, 0)));
  let p, q;
  const a1 = E.out(prog(t, 8.85, 9.22)), a2 = E.inOut(prog(t, 9.22, CUES.tap)), a3 = E.inOut(prog(t, 9.5, 9.9));
  if (t < 9.22) { p = startP.clone().lerp(onStand(4), a1); q = startQ.clone().slerp(pq, a1); }
  else if (t < 9.5) {
    p = onStand(lerp(4, 0.05, a2)); q = pq.clone();
    const hb = prog(t, CUES.tap, CUES.tap + 0.2);
    if (hb > 0 && hb < 1) p.addScaledVector(right, 0.0018 * Math.sin(2 * Math.PI * 23 * (t - CUES.tap)) * Math.sin(Math.PI * hb));
  } else {
    p = onStand(0.05).lerp(readP, a3); p.addScaledVector(up, Math.sin(Math.PI * a3) * 0.05);
    q = pq.clone().slerp(readQ, a3);
  }
  phone.g.position.copy(p); phone.g.quaternion.copy(q);
  drawPhoneScreen(t);
}

// phone screen: lock screen → NFC banner → Google review page that fills in
function drawPhoneScreen(t) {
  const x = phone.canvas.getContext('2d'), Wc = 820, Hc = 1600;
  x.save(); x.clearRect(0, 0, Wc, Hc);
  let g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, '#d6e4ff'); g.addColorStop(1, '#f3f6fd');
  x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
  const rg = x.createRadialGradient(Wc * 0.75, Hc * 0.3, 0, Wc * 0.75, Hc * 0.3, Wc);
  rg.addColorStop(0, 'rgba(66,133,244,0.25)'); rg.addColorStop(1, 'rgba(66,133,244,0)'); x.fillStyle = rg; x.fillRect(0, 0, Wc, Hc);
  U.text(x, 'יום שלישי, 3 בנובמבר', Wc / 2, 230, he({ size: 40, weight: 500, color: '#3c4043' }));
  U.text(x, '9:41', Wc / 2, 430, { size: 200, weight: 600, color: '#1f2937', align: 'center', ls: -4, family: 'Inter' });
  const nfc = prog(t, CUES.tap, CUES.tap + 0.6);
  if (nfc > 0 && nfc < 1) { const a = E.bump(nfc); const r2 = x.createRadialGradient(Wc / 2, 0, 0, Wc / 2, 0, Wc); r2.addColorStop(0, `rgba(66,133,244,${0.45 * a})`); r2.addColorStop(1, 'rgba(66,133,244,0)'); x.fillStyle = r2; x.fillRect(0, 0, Wc, Hc); }
  const bIn = E.out(prog(t, CUES.tap + 0.05, CUES.tap + 0.3)), m = E.inOut(prog(t, CUES.tap + 0.33, CUES.tap + 0.6));
  if (bIn > 0) {
    const R = { x: lerp(24, 0, m), y: lerp(lerp(-220, 76, bIn), 0, m), w: lerp(Wc - 48, Wc, m), h: lerp(176, Hc, m), r: lerp(44, 0, m) };
    x.save(); x.shadowColor = `rgba(0,0,0,${0.22 * (1 - m)})`; x.shadowBlur = 40; x.shadowOffsetY = 10;
    U.rr(x, R.x, R.y, R.w, R.h, R.r); x.fillStyle = '#ffffff'; x.fill(); x.restore();
    const ba = 1 - clamp(m * 2.5);
    if (ba > 0) {
      x.save(); x.globalAlpha = ba;
      U.gBadge(x, R.x + R.w - 80, R.y + 88, 46, false);
      U.text(x, 'ביקורות Google', R.x + R.w - 150, R.y + 76, he({ size: 40, weight: 600, color: '#202124', align: 'right' }));
      U.text(x, 'לחצו כדי לדרג את קפה לימון', R.x + R.w - 150, R.y + 128, he({ size: 32, weight: 400, color: '#1A73E8', align: 'right' }));
      x.restore();
    }
    const pa = clamp((m - 0.35) / 0.65);
    if (pa > 0) {
      x.save(); x.globalAlpha = pa; x.translate(0, (1 - pa) * 40);
      U.text(x, '9:41', 60, 62, { size: 30, weight: 600, color: '#202124', align: 'left', family: 'Inter' });
      x.strokeStyle = '#5f6368'; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(58, 148); x.lineTo(92, 182); x.moveTo(92, 148); x.lineTo(58, 182); x.stroke();
      U.avatar(x, 740, 168, 44, '#F4D35E', 'ק', '#5f4b00');
      U.text(x, 'קפה לימון', 676, 160, he({ size: 52, weight: 700, color: '#202124', align: 'right' }));
      U.text(x, 'בית קפה · כפר סבא', 676, 210, he({ size: 32, weight: 400, color: '#5f6368', align: 'right' }));
      x.fillStyle = '#e8eaed'; x.fillRect(40, 262, Wc - 80, 2);
      U.avatar(x, 740, 336, 36, '#1A73E8', 'ד');
      U.text(x, 'דנה לוי', 684, 328, he({ size: 38, weight: 600, color: '#202124', align: 'right' }));
      U.text(x, 'הביקורת תפורסם באופן ציבורי', 684, 370, he({ size: 28, weight: 400, color: '#5f6368', align: 'right' }));
      CUES.stars.forEach((s0, i) => {
        const f = E.out(prog(t, s0, s0 + 0.1)), pu = E.bump(prog(t, s0, s0 + 0.24));
        const sx = Wc / 2 + (2 - i) * 138, sy = 520, Rr = 56 * (1 + 0.2 * pu);
        if (pu > 0.01) { const gg = x.createRadialGradient(sx, sy, 0, sx, sy, 110); gg.addColorStop(0, `rgba(251,188,4,${0.35 * pu})`); gg.addColorStop(1, 'rgba(251,188,4,0)'); x.fillStyle = gg; x.fillRect(sx - 110, sy - 110, 220, 220); }
        U.star(x, sx, sy, Rr, f, '#FBBC04', '#9AA0A6', 5);
      });
      const ex = E.out(prog(t, CUES.stars[4] + 0.05, CUES.stars[4] + 0.3));
      if (ex > 0) U.text(x, 'מעולה!', Wc / 2, 640, he({ size: 40, weight: 600, color: '#202124', alpha: ex }));
      U.rr(x, 50, 700, Wc - 100, 280, 26); x.strokeStyle = '#dadce0'; x.lineWidth = 3; x.stroke();
      const full = 'קפה מעולה ושירות מהיר!';
      const n = Math.floor(full.length * prog(t, CUES.type[0], CUES.type[1]));
      if (n === 0) U.text(x, 'שתפו פרטים על החוויה שלכם', Wc - 90, 790, he({ size: 34, weight: 400, color: '#9aa0a6', align: 'right' }));
      else {
        const s = full.slice(0, n); U.text(x, s, Wc - 90, 790, he({ size: 38, weight: 400, color: '#202124', align: 'right' }));
        const tw = U.measure(x, s, he({ size: 38, weight: 400 }));
        if (Math.floor(t * 4) % 2 === 0 || t < CUES.type[1]) { x.fillStyle = '#1A73E8'; x.fillRect(Wc - 96 - tw, 752, 4, 52); }
      }
      const pressed = E.bump(prog(t, CUES.post, CUES.post + 0.16));
      U.rr(x, 50, 1380, Wc - 100, 112, 56); x.fillStyle = U.mix('#1A73E8', '#1558b8', pressed); x.fill();
      U.text(x, 'פרסום', Wc / 2, 1452, he({ size: 46, weight: 700, color: '#ffffff' }));
      const ok = E.out(prog(t, CUES.posted, CUES.posted + 0.22));
      if (ok > 0) {
        x.save(); x.globalAlpha = ok; x.fillStyle = 'rgba(255,255,255,0.97)'; x.fillRect(0, 0, Wc, Hc);
        const sc = 0.7 + 0.3 * E.arrive(prog(t, CUES.posted, CUES.posted + 0.35));
        x.translate(Wc / 2, 700); x.scale(sc, sc);
        x.beginPath(); x.arc(0, 0, 120, 0, Math.PI * 2); x.fillStyle = '#1e8e3e'; x.fill();
        x.strokeStyle = '#fff'; x.lineWidth = 22; x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath(); x.moveTo(-52, 4); x.lineTo(-14, 44); x.lineTo(56, -38); x.stroke();
        x.restore();
        U.text(x, 'הביקורת פורסמה', Wc / 2, 930, he({ size: 58, weight: 700, color: '#202124', alpha: ok }));
        U.text(x, 'תודה, דנה!', Wc / 2, 996, he({ size: 38, weight: 400, color: '#5f6368', alpha: ok }));
      }
      x.restore();
    }
  }
  U.rr(x, Wc / 2 - 92, 26, 184, 54, 27); x.fillStyle = '#000'; x.fill();
  x.restore();
  phone.tex.needsUpdate = true;
}

// ── end timeline ─────────────────────────────────────────────────────────────
function updateEnd(t) {
  const rise = E.out(prog(t, 14.0, 14.7));
  standEnd.position.set(0, lerp(-7, 0, rise), 0);
  standEnd.rotation.y = lerp(-34, -18, E.out(prog(t, 14.0, 17.0))) * DEG;
  endCam.position.set(0, 10.5, 60); endCam.lookAt(0, 3.0, -2); endCam.updateProjectionMatrix();
}

// ── 2D overlays ──────────────────────────────────────────────────────────────
const proj = (v, cam) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H]; };

function placeLabel(x, y, name, rating, count, hi, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
  ctx.fillStyle = hi ? '#EA4335' : '#F28B30';
  ctx.beginPath(); ctx.arc(0, -46, 20, Math.PI * 0.82, Math.PI * 2.18); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -46, 7.5, 0, Math.PI * 2); ctx.fill();
  const w = Math.max(U.measure(ctx, name, he({ size: 30, weight: 600 })), 210) + 44;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  U.rr(ctx, -w / 2, -160, w, 92, 20); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  U.text(ctx, name, 0, -122, he({ size: 30, weight: 600, color: '#202124' }));
  const rx = 66;
  U.text(ctx, rating.toFixed(1), rx, -84, { size: 23, weight: 600, color: '#202124', align: 'right' });
  for (let i = 0; i < 5; i++) U.star(ctx, rx - 52 - i * 19, -92, 8.5, clamp(rating - i), '#FBBC04', '#DADCE0', 1.2);
  U.text(ctx, `(${count})`, rx - 52 - 4 * 19 - 16, -84, { size: 22, weight: 500, color: '#70757A', align: 'right' });
  ctx.restore();
}
// caption pill next to the subject; y is chosen per scene to sit beside the focus point
function caption(text, y, pin, pout, sub) {
  const a = clamp(pin * 1.4) * (1 - clamp(pout));
  if (a <= 0) return;
  y = clamp(y, 260, 1560);
  ctx.save(); ctx.globalAlpha *= a;
  const dy = (1 - E.out(clamp(pin))) * 22 - clamp(pout) * 12;
  const o = he({ size: 56, weight: 700, color: '#202124' }), so = he({ size: 36, weight: 500, color: '#5F6368' });
  const w = Math.max(U.measure(ctx, text, o), sub ? U.measure(ctx, sub, so) : 0) + 80;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.16)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  U.rr(ctx, W / 2 - w / 2, y - 62 + dy, w, sub ? 150 : 94, sub ? 40 : 47); ctx.fillStyle = 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.restore();
  U.text(ctx, text, W / 2, y + 2 + dy, o);
  if (sub) U.text(ctx, sub, W / 2, y + 62 + dy, so);
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
function ripples(x, y, t0, t, n = 3, maxR = 300, fade = 1) {
  if (fade <= 0) return;
  for (let k = 0; k < n; k++) {
    const p = prog(t, t0 + k * 0.13, t0 + k * 0.13 + 0.8);
    if (p <= 0 || p >= 1) continue;
    ctx.beginPath(); ctx.arc(x, y, 40 + maxR * E.out(p), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(66,133,244,${Math.pow(1 - p, 1.3) * 0.85 * fade})`; ctx.lineWidth = 6 * (1 - p * 0.6); ctx.stroke();
  }
}
const REVIEWS = [
  ['נועה כ.', 'נ', '#34A853', 'הכי קל שיש!'], ['אבי ל.', 'א', '#4285F4', 'קפה מעולה'], ['מאיה ש.', 'מ', '#EA4335', 'טאפ אחד וזהו'],
  ['יוסי ב.', 'י', '#A142F4', 'הכי טעים בשכונה'], ['שירה מ.', 'ש', '#F29900', 'צוות מקסים'], ['דניאל ר.', 'ד', '#12B5CB', 'קרואסון מדהים'],
  ['תמר א.', 'ת', '#E52592', 'אווירה נעימה'], ['רון ג.', 'ר', '#1E8E3E', 'שירות מהיר'],
];
const merged = (t) => CUES.arrivals.reduce((n, a) => n + E.smooth(prog(t, a + 0.45, a + 0.7)), 0);
function cafeRating(t) { const f = merged(t) / CUES.arrivals.length; return { r: 2.7 + 2.2 * E.smooth(f), c: Math.round(38 + 203 * f), f }; }
// the café's place card (centre of attention) + review chips flowing up into it
function placeCard(t, x, y, doorY) {
  const a = E.out(prog(t, 11.2, 11.55)) * (1 - E.in(prog(t, 13.75, 13.95)));
  if (a <= 0) return;
  const { r, c, f } = cafeRating(t);
  CUES.arrivals.forEach((a0, i) => {
    const p = prog(t, a0 - 0.05, a0 + 0.6);
    if (p <= 0 || p >= 1) return;
    const cy = lerp(doorY - 40, y + 70, E.inOut(p)), cx = x + ((i % 3) - 1) * 150 * (1 - p);
    const s = 1 - 0.35 * E.in(prog(p, 0.65, 1));
    ctx.save(); ctx.globalAlpha *= clamp(p * 5) * (1 - E.in(prog(p, 0.75, 1)));
    ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    U.rr(ctx, -170, -40, 340, 80, 40); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    const [n, ini, col, txt] = REVIEWS[i];
    U.avatar(ctx, 128, 0, 24, col, ini);
    for (let k = 0; k < 5; k++) U.star(ctx, 82 - k * 22, -10, 9, 1, '#FBBC04');
    U.text(ctx, txt, 96, 26, he({ size: 22, weight: 500, color: '#3c4043', align: 'right' }));
    ctx.restore();
  });
  ctx.save(); ctx.globalAlpha *= a;
  const s = 0.9 + 0.1 * E.arrive(prog(t, 11.2, 11.6)), glow = clamp(f * 1.5);
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.save(); ctx.shadowColor = glow > 0.05 ? `rgba(30,142,62,${0.35 * glow})` : 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 30 + 20 * glow; ctx.shadowOffsetY = 8;
  U.rr(ctx, -250, -95, 500, 190, 34); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  U.avatar(ctx, 196, -42, 30, '#F4D35E', 'ק', '#5f4b00');
  U.text(ctx, 'קפה לימון', 150, -30, he({ size: 40, weight: 700, color: '#202124', align: 'right' }));
  U.text(ctx, r.toFixed(1), 210, 52, { size: 60, weight: 700, color: f > 0.4 ? '#188038' : '#202124', align: 'right', family: 'Inter' });
  for (let k = 0; k < 5; k++) U.star(ctx, 92 - k * 40, 32, 17, clamp(r - k), '#FBBC04', '#DADCE0', 2);
  U.text(ctx, `${c} ביקורות`, 108, 72, he({ size: 26, weight: 400, color: '#5f6368', align: 'right' }));
  ctx.restore();
}
function lockup(t) {
  const X = W / 2, INK = '#1F1F1F';
  const pb = E.out(prog(t, 14.55, 15.05));
  if (pb > 0) { ctx.save(); ctx.globalAlpha *= clamp(pb * 1.4); U.gBadge(ctx, X, 1296 + (1 - pb) * 40, 46, true); ctx.restore(); }
  for (let i = 0; i < 5; i++) {
    const p = E.arrive(prog(t, 14.7 + i * 0.07, 15.1 + i * 0.07));
    if (p <= 0) continue;
    ctx.save(); ctx.globalAlpha *= clamp(p * 2); ctx.translate(X + (i - 2) * 50, 1384); ctx.scale(p, p); U.star(ctx, 0, 0, 20, 1, '#FBBC04'); ctx.restore();
  }
  U.maskLine(ctx, 'One Tap.', X, 1510, { size: 104, weight: 700, align: 'center', ls: -3, color: INK, family: 'Inter' }, E.out(prog(t, 14.85, 15.5)));
  U.maskLine(ctx, 'Instant 5-Star Reviews.', X, 1600, { size: 60, weight: 600, align: 'center', ls: -1, color: INK, family: 'Inter' }, E.out(prog(t, 15.0, 15.65)));
}

// ── compositing ──────────────────────────────────────────────────────────────
function render3D(scene, cam, alpha) {
  renderer.render(scene, cam);
  ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderer.domElement, 0, 0, W, H); ctx.restore();
}
function drawCity(t, alpha) {
  const { st } = updateCity(t);
  render3D(city, cityCam, alpha);
  ctx.save(); ctx.globalAlpha = alpha;
  const [dx, dy] = proj(V3(st.x, 0.5, st.z), cityCam);
  // intro: washed map, the pin lands on the customer and we dive into it
  if (t < 1.5) {
    const wash = 1 - E.inOut(prog(t, 0.45, 1.35));
    if (wash > 0) { ctx.fillStyle = `rgba(244,246,249,${0.92 * wash})`; ctx.fillRect(0, 0, W, H); }
    const drop = E.arrive(prog(t, CUES.pin, CUES.pin + 0.4)), zoom = E.in(prog(t, 0.6, 1.25));
    mapPin(dx, lerp(dy - 200, dy, drop) + zoom * 160, (0.2 + 0.8 * drop) * (1 + zoom * 4), clamp(drop * 1.6) * (1 - zoom));
  }
  // place labels (only the two stores of the story)
  const labA = clamp(prog(t, 1.75, 2.1)) * (1 - prog(t, 6.3, 6.8));
  if (labA > 0) {
    const [bx, by] = proj(bak.top, cityCam), [cx, cy] = proj(caf.top, cityCam);
    placeLabel(bx, by, 'מאפיית בוקר', 3.2, 31, false, labA);
    placeLabel(cx, cy, 'קפה לימון', 2.7, 38, true, labA);
  }
  // bakery: happy, but no review — right above the dot
  if (t > 4.9 && t < 6.1) {
    const pin = E.arrive(prog(t, CUES.smile, CUES.smile + 0.35)), pout = E.in(prog(t, 5.75, 6.05));
    smiley(dx, dy - 130, pin, 1 - pout);
    const sp = prog(t, CUES.sad, CUES.sad + 0.7);
    if (sp > 0 && sp < 1) { ctx.save(); ctx.globalAlpha *= (1 - sp) * clamp(sp * 6); U.star(ctx, dx + 112, dy - 170 + sp * 70, 38 * (1 - 0.3 * sp), 0, '#FBBC04', '#80868B', 6); ctx.restore(); }
  }
  // captions sit just below the dot (the centre of attention)
  caption('הלקוחות שלך מרוצים...', dy + 250, prog(t, 1.9, 2.3), prog(t, 3.75, 3.95));
  caption('...אבל לא משאירים ביקורת', dy + 250, prog(t, 4.35, 4.75), prog(t, 5.8, 6.0));
  // zoom-out: the café's place card + reviews flowing in
  if (t > 11.0) {
    const [cx, cy] = proj(caf.top, cityCam), [, doorY] = proj(V3(caf.x, 1, -9), cityCam);
    const [bx, by] = proj(bak.top, cityCam);
    placeLabel(bx, by, 'מאפיית בוקר', 3.2, 31, false, clamp(prog(t, 11.4, 11.7)) * (1 - prog(t, 13.75, 13.9)) * 0.85);
    placeCard(t, cx, cy - 130, doorY);
    caption('כל ביקור הופך לביקורת', doorY + 230, prog(t, 11.45, 11.85), prog(t, 13.7, 13.9));
  }
  ctx.restore();
}
function drawCafe(t, alpha) {
  updateCafe(t);
  render3D(cafe, cafeCam, alpha);
  ctx.save(); ctx.globalAlpha = alpha;
  const [gx, gy] = proj(G_CAFE, cafeCam);
  const [ddx, ddy] = proj(cafeDotPos(t), cafeCam);
  ripples(gx, gy, CUES.tap, t, 3, 360, 1 - E.smooth(prog(t, 9.45, 9.62)));   // gone before the review page reads
  caption('נכנסים לקפה לימון', ddy - 300, prog(t, 7.7, 8.1), prog(t, 8.6, 8.8), 'ועל הדלפק — המעמד');
  const [, sby] = proj(V3(1.15, 1.1, -1.83), cafeCam);
  caption('טאפ אחד — ודף הביקורת נפתח', sby + 150, prog(t, 9.2, 9.45), prog(t, 9.62, 9.8));
  ctx.restore();
}
function drawEnd(t) {
  const wipe = E.inOut(prog(t, CUES.wipe, CUES.wipe + 0.35));
  if (t < 14.25) {
    const [x, y] = proj(caf.top, cityCam);
    ctx.save(); ctx.fillStyle = '#eef2f7'; ctx.beginPath(); ctx.arc(x, y - 130, wipe * 2400, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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
  if (t >= 7.45 && t < 11.25) drawCafe(t, t < 7.64 ? E.inOut(prog(t, 7.45, 7.64)) : 1);
  if (t >= 11.05 && t < 14.3) drawCity(t, t < 11.25 ? E.inOut(prog(t, 11.05, 11.25)) : 1);
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
