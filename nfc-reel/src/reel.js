// ─────────────────────────────────────────────────────────────────────────────
// reel.js — the 17 s vertical reel. frame(t) draws one complete frame as a pure
// function of t (3D via three.js + 2D Google-Maps-style overlays).
//
// Attention design: the subject (blue dot → stand → phone → café) stays near
// the centre of the frame, captions appear right next to it, and every
// transition starts where the eye already is.
//
//  0.0–1.4  hook: Café Limon's Google card — 2.7★ ("your coffee is great… so why 2.7?")
//  1.4–2.4  the card lands on the map and the camera dives to the customer
//  2.4–4.0  the blue dot follows a growing route to the bakery
//  4.0–6.0  customers leave the bakery happy, the review count stays +0
//  6.0–7.5  route to Café Limon, camera swoops down to its terrace and door
//  7.5–11.1 inside: the dot walks to the counter, a phone taps the stand,
//           the review page fills in on the phone screen
// 11.1–13.9 zoom out: customers stream in, reviews flow up, 2.7 → 4.9
// 13.9–17.0 dark end card: stand, "One Tap. Instant 5-Star Reviews.", contact
// ─────────────────────────────────────────────────────────────────────────────
import { THREE, W, H, buildStand, buildDot } from './world.js';
import { buildCity, routeGeometry, HERO } from './city.js';
import { buildCafe2 } from './cafe.js';
import { RoundedBoxGeometry } from '../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from '../node_modules/three/examples/jsm/environments/RoomEnvironment.js';

const DUR = 17, FPS = 30;
const { E } = U, { prog, lerp, clamp } = U;
const CUES = {
  card: 0.06, why: 0.98, dive: 1.38, bakeryIn: 4.0, exits: [4.72, 5.04, 5.36], zero: 4.92, cafeDoor: 7.45,
  tap: 9.3, stars: [9.95, 10.06, 10.17, 10.28, 10.39], type: [10.42, 10.72], post: 10.78, posted: 10.84, up: 11.08,
  arrivals: [11.6, 11.85, 12.1, 12.35, 12.6, 12.85, 13.1, 13.35], wipe: 13.85, final: 14.6, contact: 15.0,
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
let cafe, cafeCam, cafeDot, standCafe, G_CAFE, phone, phoneEnv;
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
  P2 = [[bak.x + ASIDE, wz], [caf.x, wz], [caf.x, -8.7]];
  L1 = lenOf(P1); L2 = lenOf(P2);
  HERO_T = V3(caf.x - 0.6, 1.7, -8.9);
  cityCam = new THREE.PerspectiveCamera(40, W / H, 3, 1300);
}

// ── iPhone (15 Pro proportions, natural titanium) at the café's 2.6× scale ──────
const MM = 0.0026;
// rounded rectangle with Apple-style continuous corners (curvature starts at 1.28 r)
function sqRect(w, h, r) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2, a = 1.28 * r, c = 0.36 * r;
  s.moveTo(x0 + a, y0);
  s.lineTo(x1 - a, y0); s.bezierCurveTo(x1 - c, y0, x1, y0 + c, x1, y0 + a);
  s.lineTo(x1, y1 - a); s.bezierCurveTo(x1, y1 - c, x1 - c, y1, x1 - a, y1);
  s.lineTo(x0 + a, y1); s.bezierCurveTo(x0 + c, y1, x0, y1 - c, x0, y1 - a);
  s.lineTo(x0, y0 + a); s.bezierCurveTo(x0, y0 + c, x0 + c, y0, x0 + a, y0);
  return s;
}
function shapeUV(geo, w, h) {
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  return geo;
}
function sheenTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.42, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.58, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function buildPhone() {
  const g = new THREE.Group();
  const Wp = 70.6 * MM, Hp = 146.6 * MM, Dp = 8.25 * MM, R = 11.6 * MM, bs = 0.9 * MM, bt = 1.05 * MM;
  const env = phoneEnv;
  const ti = new THREE.MeshPhysicalMaterial({ color: 0xc8c2b6, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.15 });
  const tiDark = new THREE.MeshStandardMaterial({ color: 0x8f8a82, metalness: 0.6, roughness: 0.5, envMap: env });
  // titanium band: flat sides, softly rounded into the front and back glass
  const bodyGeo = new THREE.ExtrudeGeometry(sqRect(Wp - 2 * bs, Hp - 2 * bs, R - bs), { depth: Dp - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 6, curveSegments: 22 });
  bodyGeo.translate(0, 0, -(Dp - 2 * bt) / 2);
  const body = new THREE.Mesh(bodyGeo, ti); body.castShadow = true; g.add(body);
  // front: black glass with the display set inside a thin even bezel
  const gw = Wp - 2 * bs - 0.25 * MM, gh = Hp - 2 * bs - 0.25 * MM;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.06, clearcoat: 0.6, clearcoatRoughness: 0.04, envMap: env, envMapIntensity: 0.22 });
  const front = new THREE.Mesh(new THREE.ShapeGeometry(sqRect(gw, gh, R - bs - 0.12 * MM), 24), glassMat); front.position.z = Dp / 2 + 0.03 * MM; g.add(front);
  const bez = 1.5 * MM, sw = gw - 2 * bez, sh = gh - 2 * bez;
  const canvas = document.createElement('canvas'); canvas.width = 860; canvas.height = Math.round(860 * sh / sw);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const screen = new THREE.Mesh(shapeUV(new THREE.ShapeGeometry(sqRect(sw, sh, R - bs - bez), 24), sw, sh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.z = Dp / 2 + 0.06 * MM; g.add(screen);
  // a soft moving glass reflection on top of the display
  const st = sheenTex(); st.repeat.set(0.7, 1);
  const sheen = new THREE.Mesh(shapeUV(new THREE.ShapeGeometry(sqRect(gw, gh, R - bs), 24), gw, gh), new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sheen.position.z = Dp / 2 + 0.09 * MM; sheen.rotation.z = 0; g.add(sheen);
  // back: frosted glass + camera plateau (top-right when seen from the front)
  const backMat = new THREE.MeshPhysicalMaterial({ color: 0xd3cec5, roughness: 0.55, clearcoat: 0.25, envMap: env, envMapIntensity: 0.6 });
  const back = new THREE.Mesh(new THREE.ShapeGeometry(sqRect(gw, gh, R - bs - 0.12 * MM), 24), backMat); back.rotation.y = Math.PI; back.position.z = -Dp / 2 - 0.03 * MM; g.add(back);
  const pw = 36 * MM, pcx = Wp / 2 - 3.6 * MM - pw / 2, pcy = Hp / 2 - 3.6 * MM - pw / 2;
  const plateau = new THREE.Mesh(new THREE.ExtrudeGeometry(sqRect(pw, pw, 7.5 * MM), { depth: 0.7 * MM, bevelEnabled: true, bevelThickness: 0.35 * MM, bevelSize: 0.35 * MM, bevelSegments: 3, curveSegments: 14 }),
    new THREE.MeshPhysicalMaterial({ color: 0xcfc9bf, roughness: 0.12, clearcoat: 1, envMap: env }));
  plateau.rotation.y = Math.PI; plateau.position.set(pcx, pcy, -Dp / 2 - 0.05 * MM); g.add(plateau);
  const lensRing = new THREE.MeshPhysicalMaterial({ color: 0xbdb7ac, metalness: 1, roughness: 0.25, envMap: env });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, roughness: 0.05, clearcoat: 1, envMap: env, envMapIntensity: 1.4 });
  const lz = -Dp / 2 - 1.15 * MM;
  for (const [ox, oy] of [[8.6, 8.6], [8.6, -8.6], [-8.4, 0]]) {   // front-view coords (mirrored from the back)
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(7.4 * MM, 7.6 * MM, 1.6 * MM, 32), lensRing); ring.rotation.x = Math.PI / 2; ring.position.set(pcx + ox * MM, pcy + oy * MM, lz - 0.8 * MM); g.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(5.6 * MM, 32), lensGlass); lens.rotation.y = Math.PI; lens.position.set(pcx + ox * MM, pcy + oy * MM, lz - 1.62 * MM); g.add(lens);
  }
  const flash = new THREE.Mesh(new THREE.CircleGeometry(2.4 * MM, 20), new THREE.MeshStandardMaterial({ color: 0xf3efe2, roughness: 0.4 })); flash.rotation.y = Math.PI; flash.position.set(pcx - 8.6 * MM, pcy + 8.8 * MM, lz + 0.2 * MM); g.add(flash);
  const lidar = new THREE.Mesh(new THREE.CircleGeometry(2.6 * MM, 20), lensGlass); lidar.rotation.y = Math.PI; lidar.position.set(pcx - 8.6 * MM, pcy - 8.8 * MM, lz + 0.2 * MM); g.add(lidar);
  // side buttons: action + volume (left), side button (right)
  const btn = (x, y, len) => { const b = new THREE.Mesh(new RoundedBoxGeometry(1.5 * MM, len * MM, 2.7 * MM, 2, 0.6 * MM), ti); b.position.set(x, y, 0); g.add(b); };
  btn(-Wp / 2 + 0.2 * MM, Hp / 2 - 31 * MM, 6.5); btn(-Wp / 2 + 0.2 * MM, Hp / 2 - 45 * MM, 10.5); btn(-Wp / 2 + 0.2 * MM, Hp / 2 - 58 * MM, 10.5);
  btn(Wp / 2 - 0.2 * MM, Hp / 2 - 50 * MM, 17.5);
  // antenna bands + bottom port and speaker holes
  for (const sx of [-1, 1]) for (const yy of [Hp / 2 - 15 * MM, -Hp / 2 + 13 * MM]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.25 * MM, 1.0 * MM, Dp - 2 * bt), tiDark); a.position.set(sx * (Wp / 2 - 0.08 * MM), yy, 0); g.add(a);
  }
  const port = new THREE.Mesh(new RoundedBoxGeometry(8.6 * MM, 0.5 * MM, 2.6 * MM, 2, 1.2 * MM), new THREE.MeshBasicMaterial({ color: 0x111111 })); port.position.set(0, -Hp / 2 + 0.1 * MM, 0); g.add(port);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * MM, 0.45 * MM, 0.5 * MM, 10), new THREE.MeshBasicMaterial({ color: 0x141414 }));
    h.position.set(sx * (9 + i * 2.1) * MM, -Hp / 2 + 0.1 * MM, 0); g.add(h);
  }
  g.visible = false;
  return { g, canvas, tex, sheen: st, D: Dp, bump: 2.6 * MM };
}

function setupCafe() {
  const pm = new THREE.PMREMGenerator(renderer); phoneEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
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
  // the café's street windows show a real render of this interior
  const rt = new THREE.WebGLRenderTarget(2048, 1024, { type: THREE.HalfFloatType, samples: 4 });
  const wc = new THREE.PerspectiveCamera(40, 2, 0.05, 40); wc.position.set(0.4, 1.5, 4.3); wc.lookAt(0.5, 1.35, -5);
  cafeDot.visible = false; renderer.setRenderTarget(rt); renderer.render(cafe, wc); renderer.setRenderTarget(null); cafeDot.visible = true;
  for (const m of cm.cafeWindowMats || []) { m.map = rt.texture; m.emissiveMap = rt.texture; m.color.setHex(0x1a1714); m.emissiveIntensity = 0.62; m.needsUpdate = true; }
}

// dark studio floor: a soft pool of light under the stand that fades into the background
function spotFloorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  const g = x.createRadialGradient(512, 512, 0, 512, 512, 512);
  g.addColorStop(0, '#2a2e36'); g.addColorStop(0.16, '#15181d'); g.addColorStop(0.42, '#07080a'); g.addColorStop(1, '#040506');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const END_BG = 0x0d0f13;
function setupEnd() {
  endScene = new THREE.Scene(); endScene.background = new THREE.Color(END_BG);
  endScene.fog = new THREE.Fog(END_BG, 140, 300);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ map: spotFloorTex(), roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; endScene.add(floor);
  endScene.add(new THREE.HemisphereLight(0xe8eeff, 0x15171c, 0.9));
  const k = new THREE.DirectionalLight(0xffffff, 2.4); k.position.set(-30, 60, 55); k.castShadow = true;
  k.shadow.mapSize.set(2048, 2048); Object.assign(k.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
  k.shadow.bias = -0.0004; k.shadow.radius = 6; endScene.add(k);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 1.4); rim.position.set(25, 30, -60); endScene.add(rim);
  const fillL = new THREE.DirectionalLight(0xffffff, 0.6); fillL.position.set(40, 20, 40); endScene.add(fillL);
  standEnd = buildStand(Art.standFace()); endScene.add(standEnd);
  endCam = new THREE.PerspectiveCamera(30, W / H, 1, 600);
}

// ── city timeline ────────────────────────────────────────────────────────────
const AZ = new THREE.Vector2(66, 184).normalize(), AZH = new THREE.Vector2(6.3, 7.3).normalize();
const SW = [5.92, 7.0];           // swoop window
let HERO_T;                       // café entrance target (set in setupCity)
function orbit(T, el, D) { const h = Math.cos(el) * D; return V3(T.x + AZ.x * h, T.y + Math.sin(el) * D, T.z + AZ.y * h); }
const WALKS = [[2.4, 4.0], [6.0, 7.38]];
const walkF = (t) => Math.max(...WALKS.map(([a, b]) => E.smooth(prog(t, a, a + 0.35)) * (1 - E.smooth(prog(t, b - 0.45, b)))));

const WALK2 = U.cubicBezier(0.45, 0, 0.2, 1);   // long deceleration into the door
const ASIDE = 4.5;                                 // after the bakery the hero waits a little toward the café
function heroDotState(t) {
  if (t < 2.4) return { ...pathAt(P1, 0), s: 0, route: 1, k: 1 };
  if (t < 4.0) { const s = L1 * E.inOut(prog(t, 2.4, 4.0)); return { ...pathAt(P1, s), s, route: 1, k: 1 }; }
  if (t < 4.9) {
    const k = t < 4.25 ? 1 - E.in(prog(t, 4.0, 4.25)) : t < 4.65 ? 0 : E.out(prog(t, 4.65, 4.9));
    return { ...pathAt(P1, L1), s: L1, route: 0, k };
  }
  if (t < 6.0) {
    const f = E.inOut(prog(t, 4.9, 5.15)), g = E.inOut(prog(t, 5.0, 5.45));
    return { x: bak.x + ASIDE * g, z: lerp(-8.7, HERO.walkZ, f), dx: 1, dz: 0, s: 0, route: 2, k: 1 };
  }
  const s = L2 * WALK2(prog(t, 6.0, 7.36));
  return { ...pathAt(P2, s), s, route: 2, k: 1 - E.in(prog(t, 7.3, 7.46)) };
}

function cityCamera(t) {
  let pos, tgt, fov = 40;
  if (t < 10.8) {
    // look a little ahead of the dot *along its path* (smooth around corners)
    const st = heroDotState(t), lf = walkF(t) * 5;
    const ahead = lf > 1e-4 && st.route ? pathAt(st.route === 1 ? P1 : P2, Math.min(st.route === 1 ? L1 : L2, st.s + lf)) : st;
    const track = V3(ahead.x, 0, ahead.z);
    if (t < 2.4) {
      const p = prog(t, CUES.dive, 2.4);
      pos = orbit(track, lerp(89.5, 52, E.inOut(p)) * DEG, Math.exp(lerp(Math.log(1050), Math.log(230), E.inOut(p))));
      tgt = track;
    } else {
      pos = orbit(track, 52 * DEG, 230); tgt = track;
    }
    // swoop: log-distance glide from the map view to a street-level shot of the
    // café's entrance (terrace, awning, sign), then a slow push and through the door
    const sw = E.inOut(prog(t, SW[0], SW[1]));
    if (sw > 0) {
      const se = E.inOut(prog(t, SW[0] + 0.18, SW[1] + 0.04));
      const tg = track.clone().lerp(HERO_T, E.inOut(prog(t, SW[0], SW[1] - 0.08)));
      const az = AZ.clone().lerp(AZH, E.inOut(prog(t, SW[0] + 0.08, SW[1]))).normalize();
      const D = Math.exp(lerp(Math.log(230), Math.log(11.6), sw)), el = lerp(52, 12, se) * DEG, h = Math.cos(el) * D;
      pos = V3(tg.x + az.x * h, tg.y + Math.sin(el) * D, tg.z + az.y * h); tgt = tg;
      fov = lerp(40, 50, sw);
      const push = 1.0 * E.inOut(prog(t, SW[1], 7.42)) + 5.0 * E.in(prog(t, 7.4, 7.64));
      pos.addScaledVector(V3(HERO_T.x - pos.x, HERO_T.y - pos.y, HERO_T.z - pos.z).normalize(), push);
    }
  } else {
    const TW = V3(caf.x, 1, -9.5);
    const q = E.out(prog(t, 10.95, 12.3));
    tgt = TW; pos = orbit(TW, lerp(84, 56, q) * DEG, lerp(46, 150, q) + 12 * prog(t, 12.3, 14.2));
  }
  return { pos, tgt, fov };
}

function placeDot(d, x, z, dx, dz, scale) {
  d.position.set(x, 0.19 + Math.min(0.31, scale * 0.08), z);   // hugs the pavement in close-ups
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
  city.fog.near = Math.max(320, dist * 0.85); city.fog.far = Math.max(760, dist * 1.7);   // map stays readable from high up
  sun.position.set(cam.tgt.x - 160, 260, cam.tgt.z + 190); sun.target.position.copy(cam.tgt); sun.target.updateMatrixWorld();
  const S = clamp(dist * 0.7, 32, 190);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S }); sun.shadow.camera.updateProjectionMatrix();
  // hero dot (screen-constant size, like a Maps marker)
  const st = heroDotState(t);
  const dDot = cam.pos.distanceTo(V3(st.x, 0, st.z));
  placeDot(heroDot, st.x, st.z, st.dx, st.dz, Math.max(0.42, dDot * 0.0166) * st.k);
  heroDot.visible = t < 7.62 && st.k > 0.01;
  // route ahead of the dot, growing toward the next destination
  routeFill.visible = routeEdge.visible = false;
  let pts = null, s0 = 0, s1 = 0;
  if (t >= 2.0 && t < 4.0) { pts = P1; s0 = st.s; s1 = L1 * E.inOut(prog(t, 2.0, 2.6)); }
  if (t >= 5.55 && t < 7.4) { pts = P2; s0 = st.route === 2 ? st.s : 0; s1 = L2 * E.inOut(prog(t, 5.55, 6.1)); }
  if (pts && s1 - s0 > 0.4) {
    const sub = subPolyline(pts, s0, s1);
    const wF = Math.max(0.32, dDot * 0.0103), wE = wF + Math.max(0.14, dDot * 0.0041);
    routeEdge.geometry.dispose(); routeFill.geometry.dispose();
    const yF = 0.19 + Math.min(0.26, dDot * 0.0011), yE = yF - Math.min(0.15, dDot * 0.00065);
    routeEdge.geometry = routeGeometry(sub, Infinity, wE, yE); routeFill.geometry = routeGeometry(sub, Infinity, wF, yF);
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
  // more happy customers walk out of the bakery (and nobody leaves a review)
  [CUES.exits[1], CUES.exits[2]].forEach((t0, j) => {
    const d = crowd[j];
    if (t < t0 - 0.05 || t > t0 + 1.3) return;
    const step = E.out(prog(t, t0, t0 + 0.28)), walk = prog(t, t0 + 0.18, t0 + 1.25);
    const x = bak.x - 1.2 * step - 16 * walk, z = lerp(-8.7, HERO.walkZ + (j ? 0.6 : -0.5), step);
    const k = E.out(prog(t, t0, t0 + 0.16)) * (1 - E.in(prog(t, t0 + 0.95, t0 + 1.25)));
    placeDot(d, x, z, walk > 0 ? -1 : 0, walk > 0 ? 0 : 1, Math.max(0.55, cam.pos.distanceTo(V3(x, 0, z)) * 0.0155) * k);
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
  // phone back pressed to the acrylic (clears the camera plateau); panel units are cm at 2.6×
  const onStand = (gap) => panel.localToWorld(V3(0, 7.9, 0.15 + (phone.D / 2 + phone.bump) / 0.026 + gap));
  const startP = cafeCam.position.clone().addScaledVector(fwd, 0.42).addScaledVector(up, -0.48).addScaledVector(right, 0.32);
  const startQ = camQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0.2, -0.35)));
  const readP = cafeCam.position.clone().addScaledVector(fwd, 0.8);
  const readQ = camQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.04, 0, 0)));
  let p, q;
  const a1 = E.out(prog(t, 8.85, 9.22)), a2 = E.inOut(prog(t, 9.22, CUES.tap)), a3 = E.inOut(prog(t, 9.5, 9.9));
  if (t < 9.22) { p = startP.clone().lerp(onStand(4), a1); q = startQ.clone().slerp(pq, a1); }
  else if (t < 9.5) {
    p = onStand(lerp(4, 0.02, a2)); q = pq.clone();
    const hb = prog(t, CUES.tap, CUES.tap + 0.2);
    if (hb > 0 && hb < 1) p.addScaledVector(right, 0.0018 * Math.sin(2 * Math.PI * 23 * (t - CUES.tap)) * Math.sin(Math.PI * hb));
  } else {
    p = onStand(0.02).lerp(readP, a3); p.addScaledVector(up, Math.sin(Math.PI * a3) * 0.05);
    q = pq.clone().slerp(readQ, a3);
  }
  phone.g.position.copy(p); phone.g.quaternion.copy(q);
  const n = V3(0, 0, 1).applyQuaternion(q);
  phone.sheen.offset.x = 0.15 + 0.9 * n.dot(right) - 0.7 * n.dot(up);   // reflection slides as the phone turns
  drawPhoneScreen(t);
}

// phone screen: lock screen → NFC banner → Google review page that fills in.
// Drawn in a logical 820-wide space; the canvas has the real iPhone display ratio.
function statusBar(x, Wc, dark, time = true) {
  const c = dark ? '#111' : '#1f2937';
  if (time) U.text(x, '9:41', 118, 74, { size: 34, weight: 600, color: c, align: 'center', family: 'Inter' });
  x.fillStyle = c;
  for (let i = 0; i < 4; i++) U.rr(x, 584 + i * 13, 74 - 9 - i * 5, 9, 9 + i * 5, 2), x.fill();
  x.strokeStyle = c; x.lineWidth = 4.5; x.lineCap = 'round';
  for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(664, 76, 7 + i * 8, -Math.PI * 0.75, -Math.PI * 0.25); x.stroke(); }
  x.lineWidth = 2.5; U.rr(x, 690, 56, 50, 24, 7); x.globalAlpha *= 0.45; x.stroke(); x.globalAlpha /= 0.45;
  U.rr(x, 694, 60, 38, 16, 4); x.fill(); U.rr(x, 742, 63, 4, 10, 2); x.globalAlpha *= 0.45; x.fill(); x.globalAlpha /= 0.45;
}
function drawPhoneScreen(t) {
  const x = phone.canvas.getContext('2d'), k = phone.canvas.width / 820, Wc = 820, Hc = phone.canvas.height / k;
  x.save(); x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, Wc, Hc);
  let g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, '#d6e4ff'); g.addColorStop(1, '#f3f6fd');
  x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
  const rg = x.createRadialGradient(Wc * 0.75, Hc * 0.3, 0, Wc * 0.75, Hc * 0.3, Wc);
  rg.addColorStop(0, 'rgba(66,133,244,0.25)'); rg.addColorStop(1, 'rgba(66,133,244,0)'); x.fillStyle = rg; x.fillRect(0, 0, Wc, Hc);
  statusBar(x, Wc, false, false);   // lock screen: the big clock replaces the status-bar time
  U.text(x, 'יום שלישי, 3 בנובמבר', Wc / 2, 268, he({ size: 40, weight: 500, color: '#3c4043' }));
  U.text(x, '9:41', Wc / 2, 478, { size: 210, weight: 600, color: '#1f2937', align: 'center', ls: -4, family: 'Inter' });
  // lock-screen quick buttons (flashlight, camera)
  for (const bx of [128, Wc - 128]) {
    x.beginPath(); x.arc(bx, Hc - 178, 50, 0, Math.PI * 2); x.fillStyle = 'rgba(31,41,55,0.18)'; x.fill();
    x.fillStyle = '#1f2937';
    if (bx < Wc / 2) { U.rr(x, bx - 10, Hc - 196, 20, 40, 5); x.fill(); U.rr(x, bx - 15, Hc - 206, 30, 14, 4); x.fill(); }
    else { U.rr(x, bx - 22, Hc - 192, 44, 30, 7); x.fill(); x.beginPath(); x.arc(bx, Hc - 177, 8, 0, Math.PI * 2); x.fillStyle = '#d9e4f7'; x.fill(); }
  }
  const nfc = prog(t, CUES.tap, CUES.tap + 0.6);
  if (nfc > 0 && nfc < 1) { const a = E.bump(nfc); const r2 = x.createRadialGradient(Wc / 2, 0, 0, Wc / 2, 0, Wc); r2.addColorStop(0, `rgba(66,133,244,${0.45 * a})`); r2.addColorStop(1, 'rgba(66,133,244,0)'); x.fillStyle = r2; x.fillRect(0, 0, Wc, Hc); }
  const bIn = E.out(prog(t, CUES.tap + 0.05, CUES.tap + 0.3)), m = E.inOut(prog(t, CUES.tap + 0.33, CUES.tap + 0.6));
  if (bIn > 0) {
    const R = { x: lerp(24, 0, m), y: lerp(lerp(-220, 124, bIn), 0, m), w: lerp(Wc - 48, Wc, m), h: lerp(176, Hc, m), r: lerp(44, 0, m) };
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
      statusBar(x, Wc, true);
      const Y = 66;   // review page sits below the status bar / Dynamic Island
      x.strokeStyle = '#5f6368'; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(58, 148 + Y); x.lineTo(92, 182 + Y); x.moveTo(92, 148 + Y); x.lineTo(58, 182 + Y); x.stroke();
      U.avatar(x, 740, 168 + Y, 44, '#F4D35E', 'ק', '#5f4b00');
      U.text(x, 'קפה לימון', 676, 160 + Y, he({ size: 52, weight: 700, color: '#202124', align: 'right' }));
      U.text(x, 'בית קפה · כפר סבא', 676, 210 + Y, he({ size: 32, weight: 400, color: '#5f6368', align: 'right' }));
      x.fillStyle = '#e8eaed'; x.fillRect(40, 262 + Y, Wc - 80, 2);
      U.avatar(x, 740, 336 + Y, 36, '#1A73E8', 'ד');
      U.text(x, 'דנה לוי', 684, 328 + Y, he({ size: 38, weight: 600, color: '#202124', align: 'right' }));
      U.text(x, 'הביקורת תפורסם באופן ציבורי', 684, 370 + Y, he({ size: 28, weight: 400, color: '#5f6368', align: 'right' }));
      CUES.stars.forEach((s0, i) => {
        const f = E.out(prog(t, s0, s0 + 0.1)), pu = E.bump(prog(t, s0, s0 + 0.24));
        const sx = Wc / 2 + (2 - i) * 138, sy = 540 + Y, Rr = 56 * (1 + 0.2 * pu);
        if (pu > 0.01) { const gg = x.createRadialGradient(sx, sy, 0, sx, sy, 110); gg.addColorStop(0, `rgba(251,188,4,${0.35 * pu})`); gg.addColorStop(1, 'rgba(251,188,4,0)'); x.fillStyle = gg; x.fillRect(sx - 110, sy - 110, 220, 220); }
        U.star(x, sx, sy, Rr, f, '#FBBC04', '#9AA0A6', 5);
      });
      const ex = E.out(prog(t, CUES.stars[4] + 0.05, CUES.stars[4] + 0.3));
      if (ex > 0) U.text(x, 'מעולה!', Wc / 2, 662 + Y, he({ size: 40, weight: 600, color: '#202124', alpha: ex }));
      U.rr(x, 50, 724 + Y, Wc - 100, 300, 26); x.strokeStyle = '#dadce0'; x.lineWidth = 3; x.stroke();
      const full = 'קפה מעולה ושירות מהיר!';
      const n = Math.floor(full.length * prog(t, CUES.type[0], CUES.type[1]));
      if (n === 0) U.text(x, 'שתפו פרטים על החוויה שלכם', Wc - 90, 814 + Y, he({ size: 34, weight: 400, color: '#9aa0a6', align: 'right' }));
      else {
        const s = full.slice(0, n); U.text(x, s, Wc - 90, 814 + Y, he({ size: 38, weight: 400, color: '#202124', align: 'right' }));
        const tw = U.measure(x, s, he({ size: 38, weight: 400 }));
        if (Math.floor(t * 4) % 2 === 0 || t < CUES.type[1]) { x.fillStyle = '#1A73E8'; x.fillRect(Wc - 96 - tw, 776 + Y, 4, 52); }
      }
      const pressed = E.bump(prog(t, CUES.post, CUES.post + 0.16));
      U.rr(x, 50, Hc - 236, Wc - 100, 112, 56); x.fillStyle = U.mix('#1A73E8', '#1558b8', pressed); x.fill();
      U.text(x, 'פרסום', Wc / 2, Hc - 164, he({ size: 46, weight: 700, color: '#ffffff' }));
      const ok = E.out(prog(t, CUES.posted, CUES.posted + 0.22));
      if (ok > 0) {
        x.save(); x.globalAlpha = ok; x.fillStyle = 'rgba(255,255,255,0.97)'; x.fillRect(0, 0, Wc, Hc);
        statusBar(x, Wc, true);
        const sc = 0.7 + 0.3 * E.arrive(prog(t, CUES.posted, CUES.posted + 0.35));
        x.translate(Wc / 2, 780); x.scale(sc, sc);
        x.beginPath(); x.arc(0, 0, 120, 0, Math.PI * 2); x.fillStyle = '#1e8e3e'; x.fill();
        x.strokeStyle = '#fff'; x.lineWidth = 22; x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath(); x.moveTo(-52, 4); x.lineTo(-14, 44); x.lineTo(56, -38); x.stroke();
        x.restore();
        U.text(x, 'הביקורת פורסמה', Wc / 2, 1010, he({ size: 58, weight: 700, color: '#202124', alpha: ok }));
        U.text(x, 'תודה, דנה!', Wc / 2, 1076, he({ size: 38, weight: 400, color: '#5f6368', alpha: ok }));
      }
      x.restore();
    }
  }
  // Dynamic Island + home indicator (always on top)
  U.rr(x, Wc / 2 - 131, 23, 262, 77, 38.5); x.fillStyle = '#000'; x.fill();
  U.rr(x, Wc / 2 - 140, Hc - 26, 280, 10, 5); x.fillStyle = 'rgba(17,17,17,0.82)'; x.fill();
  x.restore();
  phone.tex.needsUpdate = true;
}

// ── end timeline ─────────────────────────────────────────────────────────────
function updateEnd(t) {
  const rise = E.out(prog(t, 14.0, 14.7));
  standEnd.position.set(0, lerp(-7, 0, rise), 0);
  standEnd.rotation.y = lerp(-26, -14, E.out(prog(t, 14.0, 17.0))) * DEG;
  // stand centred, in the middle-lower part of the frame (text above, contact below)
  endCam.position.set(0, 15, 78); endCam.lookAt(0, 8.2, -2.5); endCam.updateProjectionMatrix();
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
// opening hook: Café Limon's Google card at 2.7★ — then it flies onto the map as its label
function hookCard(t, lx, ly) {
  const a = E.out(prog(t, CUES.card, CUES.card + 0.3)), fly = E.inOut(prog(t, 1.32, 1.72));
  if (a <= 0 || fly >= 1) return;
  ctx.save(); ctx.fillStyle = `rgba(238,241,245,${0.6 * a * (1 - fly)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  const x = lerp(W / 2, lx, fly), y = lerp(860, ly - 114, fly);
  const s = lerp(1.12, 0.4, fly) * (0.9 + 0.1 * E.arrive(prog(t, CUES.card, CUES.card + 0.45)));
  ctx.save(); ctx.globalAlpha *= a * (1 - E.in(prog(t, 1.6, 1.72))); ctx.translate(x, y); ctx.scale(s, s);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  U.rr(ctx, -330, -160, 660, 320, 40); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  U.avatar(ctx, 250, -76, 52, '#F4D35E', 'ק', '#5f4b00');
  U.text(ctx, 'קפה לימון', 176, -62, he({ size: 58, weight: 700, color: '#202124', align: 'right' }));
  U.text(ctx, 'בית קפה · כפר סבא', 176, -10, he({ size: 32, weight: 400, color: '#5f6368', align: 'right' }));
  ctx.fillStyle = '#e8eaed'; ctx.fillRect(-290, 30, 580, 2);
  U.text(ctx, '2.7', 290, 118, { size: 84, weight: 700, color: '#202124', align: 'right', family: 'Inter' });
  for (let k = 0; k < 5; k++) U.star(ctx, 112 - k * 50, 88, 21, clamp(2.7 - k), '#FBBC04', '#DADCE0', 2.4);
  U.text(ctx, '(38)', -150, 100, { size: 34, weight: 500, color: '#70757A', align: 'right', family: 'Inter' });
  ctx.restore();
  caption('הקפה שלך מעולה...', 1130, prog(t, 0.32, 0.6), prog(t, CUES.why - 0.08, CUES.why + 0.04));
  caption('אז למה 2.7?', 1130, prog(t, CUES.why, CUES.why + 0.22), prog(t, 1.3, 1.42));
}
// "+0 new reviews" chip above the bakery's label; it bumps every time a happy customer leaves
function zeroChip(x, y, a, hit) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); const s = (0.85 + 0.15 * a) * (1 + 0.14 * hit); ctx.scale(s, s);
  const ho = he({ size: 30, weight: 500, color: '#3C4043', align: 'right' }), no = { size: 40, weight: 700, color: '#202124', align: 'left', family: 'Inter' };
  const tw = U.measure(ctx, 'ביקורות חדשות', ho), nw = U.measure(ctx, '+0', no), w = tw + nw + 70;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
  U.rr(ctx, -w / 2, -36, w, 72, 36); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  // RTL reading order: "+0" first (right), then the words
  U.text(ctx, '+0', w / 2 - 26 - nw, 14, no);
  U.text(ctx, 'ביקורות חדשות', w / 2 - 26 - nw - 14, 11, ho);
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
  const X = W / 2, INK = '#FFFFFF';
  const pb = E.out(prog(t, 14.4, 14.9));
  if (pb > 0) { ctx.save(); ctx.globalAlpha *= clamp(pb * 1.4); U.gBadge(ctx, X, 262 + (1 - pb) * 30, 42, true); ctx.restore(); }
  for (let i = 0; i < 5; i++) {
    const p = E.arrive(prog(t, 14.52 + i * 0.07, 14.92 + i * 0.07));
    if (p <= 0) continue;
    ctx.save(); ctx.globalAlpha *= clamp(p * 2); ctx.translate(X + (i - 2) * 48, 346); ctx.scale(p, p); U.star(ctx, 0, 0, 19, 1, '#FBBC04'); ctx.restore();
  }
  U.maskLine(ctx, 'One Tap.', X, 478, { size: 104, weight: 700, align: 'center', ls: -3, color: INK, family: 'Inter' }, E.out(prog(t, 14.62, 15.25)));
  U.maskLine(ctx, 'Instant 5-Star Reviews.', X, 562, { size: 58, weight: 600, align: 'center', ls: -1, color: INK, family: 'Inter' }, E.out(prog(t, 14.78, 15.4)));
  // contact: name · age, phone, one-time payment — quiet, centred, all white
  const c = E.out(prog(t, CUES.contact, CUES.contact + 0.5));
  if (c > 0) {
    ctx.save(); ctx.globalAlpha *= c; const dy = (1 - c) * 24;
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(X - 70, 1382 + dy, 140, 2);
    U.text(ctx, 'שחף · בן 18, לפני צבא', X, 1446 + dy, he({ size: 38, weight: 500, color: 'rgba(255,255,255,0.78)' }));
    U.text(ctx, '054-817-6706', X, 1528 + dy, { size: 66, weight: 700, color: INK, align: 'center', ls: 1, family: 'Inter' });
    const po = he({ size: 32, weight: 500, color: 'rgba(255,255,255,0.88)' }), pw = U.measure(ctx, 'תשלום חד-פעמי', po) + 56;
    U.rr(ctx, X - pw / 2, 1562 + dy, pw, 58, 29); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    U.text(ctx, 'תשלום חד-פעמי', X, 1602 + dy, po);
    ctx.restore();
  }
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
  // place labels (only the two stores of the story); the hook card lands on the café's
  const lblOut = 1 - prog(t, 5.95, 6.2);
  const [bx, by] = proj(bak.top, cityCam), [cx, cy] = proj(caf.top, cityCam);
  if (lblOut > 0 && t > 1.5) {
    placeLabel(bx, by, 'מאפיית בוקר', 3.2, 31, false, clamp(prog(t, 1.9, 2.2)) * lblOut);
    placeLabel(cx, cy, 'קפה לימון', 2.7, 38, true, clamp(prog(t, 1.62, 1.72)) * lblOut);
  }
  if (t < 1.8) hookCard(t, cx, cy);
  // bakery: customers walk out happy — and the review count doesn't move (+0)
  if (t > 4.6 && t < 6.2) {
    const a = E.out(prog(t, CUES.zero, CUES.zero + 0.3)) * (1 - E.in(prog(t, 5.85, 6.1)));
    const hit = Math.max(...CUES.exits.map((e) => E.bump(prog(t, e + 0.04, e + 0.34))));
    zeroChip(bx, by - 200, a, hit);
  }
  // captions sit just below the dot (the centre of attention)
  caption('הלקוחות שלך מרוצים...', dy + 250, prog(t, 2.4, 2.75), prog(t, 3.75, 3.95));
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
    ctx.save(); ctx.fillStyle = '#0d0f13'; ctx.beginPath(); ctx.arc(x, y - 130, wipe * 2400, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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

// ── adaptive temporal sampling ───────────────────────────────────────────────
// Fast camera moves get more sub-frames so motion blur stays smooth (no ghost copies).
const _ca = new THREE.PerspectiveCamera(40, W / H, 0.1, 3000), _cb = _ca.clone();
function setPose(c, pose) { c.position.copy(pose.pos); c.lookAt(pose.tgt); c.fov = pose.fov; c.updateProjectionMatrix(); c.updateMatrixWorld(); }
function cityMotionPx(t0, t1) {
  setPose(_ca, cityCamera(t0)); setPose(_cb, cityCamera(t1));
  const dir = V3(0, 0, 0), v = V3(0, 0, 0), a = V3(0, 0, 0), b = V3(0, 0, 0);
  let m = 0;
  for (let iy = 0; iy < 5; iy++) for (let ix = 0; ix < 5; ix++) {
    dir.set(-0.9 + ix * 0.45, -0.9 + iy * 0.45, 0.5).unproject(_ca).sub(_ca.position).normalize();
    const d = dir.y < -1e-3 ? Math.min(-_ca.position.y / dir.y, 600) : 600;
    v.copy(_ca.position).addScaledVector(dir, d * 0.75);       // a bit nearer than the ground: buildings, trees
    a.copy(v).project(_ca); b.copy(v).project(_cb);
    m = Math.max(m, Math.hypot(((a.x - b.x) * W) / 2, ((a.y - b.y) * H) / 2));
  }
  return m;
}
const BOOST = [[8.5, 9.26, 6], [9.48, 9.92, 6], [13.84, 14.32, 5]];   // café push-in + phone moves, wipe
function samplesFor(t, base, shutter) {
  let n = base;
  for (const [a, b, k] of BOOST) if (t >= a && t <= b) n = Math.max(n, k);
  if (t < 7.66 || (t > 11.0 && t < 14.0)) { const h = shutter / 2 / FPS; n = Math.max(n, Math.ceil(cityMotionPx(t - h, t + h) / 6) + 1); }
  return Math.min(n, 32);
}
window.samplesFor = (t) => samplesFor(t, 3, 0.5);
window.motionPx = (t) => cityMotionPx(t - 0.25 / FPS, t + 0.25 / FPS);

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
    const shutter = opts.shutter == null ? 0.5 : opts.shutter;
    let n = opts.samples || 3;
    if (n > 1 && opts.adaptive !== false) n = samplesFor(i / FPS, n, shutter);
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
