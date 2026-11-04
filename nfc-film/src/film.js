// ─────────────────────────────────────────────────────────────────────────────
// film.js — cinematic product film for the NFC Google-review stand (9:16).
// Look: dark, warm, real materials, very shallow depth of field, one accent
// colour (blue light line) that threads the shots together, minimal in-scene
// text. Every frame is a pure function of t; DOF + motion blur come from
// accumulating many sub-frames (lens disc × shutter time) in renderFrame().
// Units: centimetres. The stand sits at the origin on a walnut counter (y = 0).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from '../../nfc-reel/node_modules/three/build/three.module.js';
import { RoomEnvironment } from '../../nfc-reel/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import { buildStand } from '../../nfc-reel/src/world.js';
import { counter, coffeeCup, flipCounter, lightLine, scissors, plateSet, shoppingBag, feltPad, croissantPlate, ACCENT } from './props.js';
import { buildPhone, drawPhone, pageLock, pageReview, pageProfile } from './phone.js';

const W = 1080, H = 1920, FPS = 30, DUR = 17;
const { E, prog, lerp, clamp } = U;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const he = (o) => Object.assign({ family: 'Rubik', dir: 'rtl', align: 'center' }, o);
// cut / sound cues (beat = 0.6 s, 100 BPM)
const CUES = {
  cuts: [1.2, 2.4, 5.4, 7.2, 9.6, 11.4], whips: [1.2, 2.4, 4.2, 5.4, 9.6],
  stars: [3.0, 3.12, 3.24, 3.36, 3.48], count: [4.35, 5.0], lamps: [6.05, 6.2, 6.35, 6.5, 6.65],
  tap: 8.4, branches: [10.15, 10.33, 10.51, 10.69], typing: [], flips: [], final: 13.8,
};
const flipVal = (t) => lerp(38, 241, E.out(prog(t, 5.55, 6.75)));
{ let last = -1, lt = -1; for (let t = 5.5; t < 6.9; t += 1 / 240) { const v = Math.floor(flipVal(t)); if (v !== last && t - lt >= 0.034) { CUES.flips.push(+t.toFixed(3)); lt = t; } last = v; } }
const TYPE1 = [11.8, 12.25], TYPE2 = [12.55, 13.15];
for (let i = 1; i <= 8; i++) CUES.typing.push(TYPE1[0] + (i / 8) * (TYPE1[1] - TYPE1[0]));
for (let i = 1; i <= 13; i++) CUES.typing.push(TYPE2[0] + (i / 13) * (TYPE2[1] - TYPE2[0]));
window.FILM = { W, H, FPS, DUR, CUES };

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
let renderer, scene, cam, env;
const P = {};   // props

// ── backdrop: an out-of-focus warm café, drawn in 2D behind the 3D layer ─────
// lamp positions live in 3D so they parallax with the camera; their blur is the
// circle of confusion of the current lens.
const LAMPS = [];
{ let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) LAMPS.push({ p: V3((r() - 0.5) * 900, 30 + r() * 170, -260 - r() * 420), k: 0.5 + r() * 0.8, c: r() < 0.82 ? [255, 176, 92] : [255, 214, 160] });
}
function coc(dist, lens) {   // CoC radius in px for a point at view distance dist
  if (!lens.ap) return 0;
  const pxPerUnit = H / (2 * lens.focus * Math.tan((cam.fov * Math.PI) / 360));
  return (lens.ap * Math.abs(dist - lens.focus) / dist) * pxPerUnit;
}
function backdrop(lens, mood) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (mood === 'void') { g.addColorStop(0, '#0b0806'); g.addColorStop(0.55, '#140d08'); g.addColorStop(1, '#070504'); }
  else { g.addColorStop(0, '#120c08'); g.addColorStop(0.45, '#2a1a10'); g.addColorStop(0.75, '#1a100a'); g.addColorStop(1, '#0d0806'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (mood === 'void') { const r = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.8); r.addColorStop(0, 'rgba(120,70,30,0.22)'); r.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); return; }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const vp = new THREE.Vector3();
  for (const L of LAMPS) {
    vp.copy(L.p).applyMatrix4(cam.matrixWorldInverse); if (vp.z > -1) continue;
    const d = -vp.z; vp.copy(L.p).project(cam);
    const x = (vp.x * 0.5 + 0.5) * W, y = (1 - (vp.y * 0.5 + 0.5)) * H, R = clamp(coc(d, lens) * L.k, 10, 260);
    if (x < -R || x > W + R || y < -R || y > H + R) continue;
    const a = 0.2 + 0.25 * L.k, [cr, cg, cb] = L.c;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.75})`); gr.addColorStop(0.82, `rgba(${cr},${cg},${cb},${a})`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── scene ────────────────────────────────────────────────────────────────────
function drawEndPrint(c, a1 = 1, a2 = 1, a3 = 1) {
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  x.save(); x.globalAlpha = Math.max(a1, a2, a3); x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(c.width / 2 - 160, 120, 320, 3); x.restore();
  U.text(x, 'שחף · בן 18, לפני צבא', c.width / 2, 300 + (1 - a1) * 30, he({ size: 96, weight: 500, color: `rgba(255,255,255,${0.86 * a1})` }));
  U.text(x, '054-817-6706', c.width / 2, 520 + (1 - a2) * 30, { size: 190, weight: 700, color: `rgba(255,255,255,${a2})`, align: 'center', family: 'Inter', ls: 4 });
  const po = he({ size: 82, weight: 500, color: `rgba(255,255,255,${0.9 * a3})` }), pw = U.measure(x, 'תשלום חד-פעמי', po) + 140;
  U.rr(x, c.width / 2 - pw / 2, 630 + (1 - a3) * 30, pw, 150, 75); x.strokeStyle = `rgba(255,255,255,${0.55 * a3})`; x.lineWidth = 5; x.stroke();
  U.text(x, 'תשלום חד-פעמי', c.width / 2, 735 + (1 - a3) * 30, po);
}
function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1.0); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environment = env; scene.environmentIntensity = 0.22;
  // warm, low-key light: soft key from above-left, amber rim from behind, faint fill
  const key = new THREE.SpotLight(0xfff0e2, 3.0, 0, 0.42, 0.9, 0); key.position.set(-45, 85, 60); key.target.position.set(0, 4, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0002; key.shadow.radius = 6; key.shadow.camera.near = 20; key.shadow.camera.far = 400;
  scene.add(key, key.target); P.key = key;
  const rim = new THREE.DirectionalLight(0xffb878, 1.6); rim.position.set(40, 45, -70); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x1a0f08, 0.32));
  // props
  P.counter = counter(); scene.add(P.counter);
  P.stand = buildStand(Art.standFace()); scene.add(P.stand);
  // keep the printed navy true under warm light: less clearcoat haze, a touch of cool tint, softer env
  P.stand.traverse((o) => { if (o.material && o.material.map) { const m = o.material; m.clearcoat = 0.1; m.roughness = 0.58; m.envMapIntensity = 0.1; m.specularIntensity = 0.35; m.color.setHex(0xe9eeff); } });
  P.cup = coffeeCup(); scene.add(P.cup);
  P.flip = flipCounter(); scene.add(P.flip);
  P.phone = buildPhone(env, 0.1); scene.add(P.phone.g);
  P.scissors = scissors(); P.plate = plateSet(); P.bag = shoppingBag(); P.cup2 = coffeeCup();
  scene.add(P.scissors, P.plate, P.bag, P.cup2);
  P.endCanvas = document.createElement('canvas'); P.endCanvas.width = 2048; P.endCanvas.height = 900; drawEndPrint(P.endCanvas);
  P.pad = feltPad(P.endCanvas); scene.add(P.pad);
  P.croissant = croissantPlate(); scene.add(P.croissant);
  // tap ripples: thin glowing rings that spread across the counter from the stand
  P.ripples = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.07; scene.add(m); return m; });
  // light lines
  P.lineIntro = lightLine([V3(0, 0.05, 6), V3(6, 0.05, -4), V3(-3, 0.05, -18), V3(9, 0.05, -32), V3(16, 0.05, -44), V3(20, 0.05, -52)], { radius: 0.16, halo: 1.6 });
  P.tagline = taglinePlane(); scene.add(P.tagline);
  P.linePhone = lightLine([V3(0, -60, -30), V3(0, -34, -14), V3(0, -18, -4), V3(0, -9.2, 0)], { radius: 0.16, halo: 1.4, flat: false });
  scene.add(P.lineIntro, P.linePhone);
  P.tree = [];
  P.treeTrunk = lightLine([V3(0, 0.05, 70), V3(-3, 0.05, 50), V3(2, 0.05, 30), V3(0, 0.05, 12), V3(0, 0.05, 4)], { radius: 0.2, halo: 2.0 });
  scene.add(P.treeTrunk);
  P.treeSpots = [];
  for (const [x, z] of TREE_AT) {
    const ln = lightLine([V3(0, 0.05, 4), V3(x * 0.35, 0.05, 4 + (z - 4) * 0.15), V3(x * 0.75, 0.05, z * 0.8 + 1), V3(x * 0.92, 0.05, z)], { radius: 0.18, halo: 1.8 });
    scene.add(ln); P.tree.push(ln);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshBasicMaterial({ map: spotTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spot.rotation.x = -Math.PI / 2; spot.position.set(x, 0.06, z); scene.add(spot); P.treeSpots.push(spot);
  }
  cam = new THREE.PerspectiveCamera(30, W / H, 1, 3000);
}
const TREE_AT = [[-15, -32], [15, -32], [-17, 24], [17, 24]];
// in-scene tagline printed on the counter, typed letter by letter
function taglinePlane() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 900;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(27, 27 * 900 / 2048), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.08, 13);
  m.userData.draw = (n1, n2) => {
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    const L1 = 'One tap.', L2a = 'Every ', L2b = 'review.';
    const o = { size: 230, weight: 700, color: '#ffffff', align: 'left', family: 'Inter', ls: -5 };
    const w1 = U.measure(x, L1, o), w2 = U.measure(x, L2a + L2b, o), wa = U.measure(x, L2a, o);
    x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 20;
    U.text(x, L1.slice(0, Math.round(n1 * L1.length)), c.width / 2 - w1 / 2, 330, o);
    const k = Math.round(n2 * (L2a.length + L2b.length));
    U.text(x, L2a.slice(0, k), c.width / 2 - w2 / 2, 640, o);
    if (k > L2a.length) U.text(x, L2b.slice(0, k - L2a.length), c.width / 2 - w2 / 2 + wa, 640, Object.assign({}, o, { color: '#6fb1ff' }));
    t.needsUpdate = true;
  };
  return m;
}
function spotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,214,150,0.55)'); g.addColorStop(0.6, 'rgba(255,190,120,0.18)'); g.addColorStop(1, 'rgba(255,190,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── shots ────────────────────────────────────────────────────────────────────
// TC: the frame's nominal time — screen/print content is evaluated once per frame (no
// need to motion-blur UI), and canvases are only re-uploaded when their content changes.
let TC = 0;
const memo = {};
const once = (id, key, fn) => { if (memo[id] !== key) { memo[id] = key; fn(); } };
const phonePages = (pages) => once('phone', pages.map(([fn, o, dy = 0]) => fn.name + JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)) + Math.round(dy)).join('|'), () => drawPhone(P.phone, pages));
// each returns { pos, tgt, fov, focus (distance), ap (lens radius, cm), mood, overlay(ctx) }
function hideAll() {
  for (const k of ['stand', 'cup', 'flip', 'scissors', 'plate', 'bag', 'cup2', 'pad', 'lineIntro', 'linePhone', 'treeTrunk', 'tagline', 'croissant']) P[k].visible = false;
  P.phone.g.visible = false; P.counter.visible = true;
  P.tree.forEach((l) => (l.visible = false)); P.treeSpots.forEach((s) => (s.visible = false)); P.ripples.forEach((r) => (r.visible = false));
}
const standBadge = () => { P.stand.updateMatrixWorld(true); return P.stand.userData.panel.localToWorld(P.stand.userData.badgeLocal.clone()); };
const shake = (t, a = 0.12) => V3(Math.sin(t * 1.31) * a + Math.sin(t * 2.97) * a * 0.4, Math.sin(t * 1.73 + 1) * a * 0.8, 0);
const phoneLH = () => (P.phone.canvas.height * 820) / P.phone.canvas.width;
const tmpCam = new THREE.PerspectiveCamera();
// S6: the phone glides in, presses flush onto the stand (tap), then lifts toward the viewer
function phonePoseTap(t, cpos, ctgt) {
  const ph = P.phone.g; ph.visible = t >= 7.45;
  const panel = P.stand.userData.panel; P.stand.updateMatrixWorld(true);
  const pq = new THREE.Quaternion(); panel.getWorldQuaternion(pq);
  const onStand = (gap) => panel.localToWorld(V3(0, 7.9, 0.15 + 0.4125 + 0.26 + gap));
  tmpCam.position.copy(cpos); tmpCam.lookAt(ctgt); const cq = tmpCam.quaternion;
  const fwd = V3(0, 0, -1).applyQuaternion(cq), up = V3(0, 1, 0).applyQuaternion(cq), right = V3(1, 0, 0).applyQuaternion(cq);
  const startP = cpos.clone().addScaledVector(fwd, 30).addScaledVector(up, -24).addScaledVector(right, 15);
  const startQ = cq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.75, 0.25, -0.45)));
  const readP = cpos.clone().addScaledVector(fwd, 37).addScaledVector(up, -1.0), readQ = cq.clone();
  const a1 = E.out(prog(t, 7.45, 8.1)), a2 = E.inOut(prog(t, 8.1, CUES.tap)), a3 = E.inOut(prog(t, 8.85, 9.35));
  let p, q;
  if (t < 8.1) { p = startP.lerp(onStand(6), a1); q = startQ.slerp(pq, a1); }
  else if (t < 8.85) {
    p = onStand(lerp(6, 0.02, a2)); q = pq.clone();
    const hb = prog(t, CUES.tap, CUES.tap + 0.22); if (hb > 0 && hb < 1) p.addScaledVector(right, 0.06 * Math.sin(2 * Math.PI * 23 * (t - CUES.tap)) * Math.sin(Math.PI * hb));
  } else { p = onStand(0.02).lerp(readP, a3); p.addScaledVector(up, Math.sin(Math.PI * a3) * 2); q = pq.clone().slerp(readQ, a3); }
  ph.position.copy(p); ph.quaternion.copy(q);
  const LH = phoneLH(), show = (1 - E.out(prog(TC, CUES.tap + 0.06, CUES.tap + 0.36))) * LH;
  phonePages([[pageLock, { wake: 1 }, 0], [pageReview, { stars: 5 * E.out(prog(TC, 9.0, 9.35)) }, show]]);
  // light spreading from the stand on contact
  P.ripples.forEach((r, k) => {
    const pr = prog(t, CUES.tap + k * 0.14, CUES.tap + k * 0.14 + 0.95);
    r.visible = pr > 0 && pr < 1; if (!r.visible) return;
    const rad = lerp(5, 46, E.out(pr)); r.scale.set(rad, rad, 1); r.position.set(0, 0.07, 1.5);
    r.material.opacity = Math.pow(1 - pr, 1.4) * 0.95;
  });
}
const SHOTS = [
  // 1 — macro hero: rack focus onto the stand's G, "One Tap." rises; whip down at the end
  { a: 0.0, b: 1.2, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, 0); P.stand.rotation.y = -0.32;
    P.cup.visible = true; P.cup.position.set(-10, 0, -22);
    const u = E.out(prog(t, 0, 1.2)), G = standBadge(), w = E.in(prog(t, 0.95, 1.2));
    const pos = V3(lerp(17, 13.5, u), lerp(6.5, 7.0, u) - 3 * w, lerp(60, 54, u) - 4 * w).add(shake(t, 0.08));
    const tgt = V3(0.4, 6.4, 0.5).lerp(V3(4, -8, 16), w);
    const focus = lerp(240, pos.distanceTo(G), E.inOut(prog(t, 0.05, 0.55)));
    return { pos, tgt, fov: 28, focus, ap: 1.5, mood: 'cafe',
      overlay() { title('One Tap.', E.out(prog(t, 0.2, 0.62)), 1 - E.in(prog(t, 0.92, 1.15))); } };
  } },
  // 2 — the light leaves the stand and races low across the counter to a phone; whip up
  { a: 1.2, b: 2.4, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, 0); P.stand.rotation.y = -0.32;
    P.lineIntro.visible = true; const g = E.out(prog(t, 1.2, 2.3)); P.lineIntro.userData.grow(g);
    P.phone.g.visible = true; P.phone.g.position.set(24, 0.45, -62); P.phone.g.rotation.set(-Math.PI / 2, 0, 0.6);
    phonePages([[pageLock, { wake: 0.2 + 0.8 * E.out(prog(TC, 2.16, 2.32)) }]]);
    const crv = P.lineIntro.userData.curve, head = crv.getPointAt(Math.max(0.02, g)), back = crv.getPointAt(Math.max(0, g - 0.18));
    const w = E.in(prog(t, 2.24, 2.4));
    const pos = V3(back.x - 2, 19 + 4 * w, back.z + 26).add(shake(t, 0.12));
    return { pos, tgt: V3(head.x + 2, 30 * w, head.z - 14), fov: 32, focus: pos.distanceTo(head), ap: 1.2, mood: 'cafe' };
  } },
  // 3+4 — the phone rises out of the dark on the line: review page, stars; swipe to the
  // business page, rating climbs 3.2 → 4.9 and the new review lands on top; whip left
  { a: 2.4, b: 5.4, f(t) {
    P.counter.visible = false; P.phone.g.visible = true; P.linePhone.visible = true;
    const r = E.out(prog(t, 2.4, 3.0)), drift = prog(t, 3.0, 4.2), back = E.inOut(prog(t, 4.2, 5.2));
    P.phone.g.position.set(0, lerp(-9, 2, r), lerp(0, -10, back));
    P.phone.g.rotation.set(lerp(-0.6, -0.2, r) + 0.06 * back, lerp(0.55, 0.2, r) - 0.12 * drift - 0.3 * back, lerp(0.1, 0.03, r));
    P.phone.g.updateMatrixWorld(true);
    const plug = P.phone.g.localToWorld(V3(0, -7.4, 0)); P.linePhone.position.copy(plug).sub(V3(0, -9.2, 0)); P.linePhone.userData.grow(1);
    const LH = phoneLH(), slide = (1 - E.out(prog(TC, 2.45, 2.85))) * LH, sw = E.inOut(prog(TC, 4.0, 4.24)) * LH;
    const stars = CUES.stars.reduce((n, s) => n + clamp((TC - s) / 0.1), 0);
    const k = E.inOut(prog(TC, CUES.count[0], CUES.count[1]));
    const pages = [];
    if (slide > 1) pages.push([pageLock, { wake: 1 }, 0]);
    pages.push([pageReview, { stars }, slide - sw]);
    if (sw > 1) pages.push([pageProfile, { rating: lerp(3.2, 4.9, k), count: lerp(38, 241, k), fresh: prog(TC, 4.6, 4.95) + prog(TC, 5.0, 5.35) }, LH - sw]);
    phonePages(pages);
    const u = prog(t, 2.4, 5.4);
    const pos = V3(lerp(4, 0, u), lerp(-2, 2, u), lerp(56, 54, u)).add(shake(t, 0.15));
    const tgt = V3(-22 * E.in(prog(t, 5.15, 5.4)), lerp(0, 1, u), lerp(0, -6, back));
    return { pos, tgt, fov: 30, focus: pos.distanceTo(P.phone.g.position), ap: 0.7, mood: 'void' };
  } },
  // 5 — mechanical review counter flips 038 → 241, star lamps light; focus breaks at the end
  { a: 5.4, b: 7.2, f(t) {
    P.flip.visible = true; P.flip.position.set(0, 0, 0); P.flip.rotation.y = 0.28;
    P.stand.visible = true; P.stand.position.set(19, 0, -24); P.stand.rotation.y = -0.4;
    P.cup.visible = true; P.cup.position.set(-26, 0, -34);
    P.flip.userData.set(flipVal(t), CUES.lamps.reduce((n, s) => n + clamp((t - s) / 0.08), 0));
    const u = E.out(prog(t, 5.4, 7.2));
    const pos = V3(lerp(-26, -20, u), lerp(16, 17, u), lerp(84, 74, u)).add(shake(t, 0.2));
    const tgt = V3(1 + 30 * (1 - E.out(prog(t, 5.4, 5.72))), 6.4, 1);
    const fd = pos.distanceTo(V3(0, 7, 3));
    return { pos, tgt, fov: 34, focus: lerp(fd, 420, E.in(prog(t, 6.95, 7.2))), ap: 2.4, mood: 'cafe' };
  } },
  // 6 — the tap: the phone touches the stand, light ripples across the counter; dive to black
  { a: 7.2, b: 9.6, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, 0); P.stand.rotation.y = 0;
    P.cup.visible = true; P.cup.position.set(-17, 0, 7);
    P.croissant.visible = true; P.croissant.position.set(16, 0, 9); P.croissant.rotation.y = 0.5;
    const u = prog(t, 7.2, 9.6), ang = lerp(0.42, 0.12, E.inOut(u)), Rr = lerp(66, 58, E.out(u));
    const pos = V3(Math.sin(ang) * Rr, lerp(40, 36, u), Math.cos(ang) * Rr).add(shake(t, 0.15));
    const tgt = V3(0, 6, 1);
    const fd = pos.distanceTo(V3(0, 7, 1));
    phonePoseTap(t, pos, tgt);
    const dive = E.in(prog(t, 9.28, 9.6));
    pos.lerp(tgt, dive * 0.04);
    // focus follows the phone as it lifts toward the viewer
    const focus = lerp(fd, pos.distanceTo(P.phone.g.position), E.inOut(prog(t, 8.8, 9.2)));
    return { pos, tgt, fov: 32, focus, ap: 1.2, mood: 'cafe', fade: E.inOut(prog(t, 9.3, 9.56)) };
  } },
  // 7 — out of the dark: the line rises to the stand and branches to every kind of business
  { a: 9.6, b: 11.4, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, -2); P.stand.rotation.y = 0;
    P.treeTrunk.visible = true; P.treeTrunk.userData.grow(E.inOut(prog(t, 9.62, 10.08)));
    const props = [P.cup2, P.scissors, P.plate, P.bag];
    props.forEach((o, i) => { o.visible = true; o.position.set(TREE_AT[i][0], 0, TREE_AT[i][1]); });
    P.scissors.rotation.y = 0.6; P.bag.rotation.y = -0.4; P.plate.rotation.y = 0.2;
    P.tree.forEach((l, i) => {
      const b = CUES.branches[i], g = E.inOut(prog(t, b - 0.4, b)); l.visible = true; l.userData.grow(g);
      P.treeSpots[i].visible = g > 0.97; P.treeSpots[i].material.opacity = E.out(prog(t, b - 0.02, b + 0.25));
    });
    const u = E.out(prog(t, 9.6, 11.4));
    const pos = V3(0, lerp(56, 104, u), lerp(44, 80, u)).add(shake(t, 0.2));
    const fd = pos.distanceTo(V3(0, 4, -2));
    return { pos, tgt: V3(0, 0, lerp(6, -2, u)), fov: 42, focus: lerp(fd, 420, E.in(prog(t, 11.2, 11.4))), ap: 1.6, mood: 'cafe',
      fade: 1 - E.out(prog(t, 9.6, 9.8)),
      overlay() {
        const names = ['בתי קפה', 'מספרות', 'מסעדות', 'חנויות'];
        props.forEach((o, i) => { const a = E.out(prog(t, CUES.branches[i] + 0.02, CUES.branches[i] + 0.3)) * (1 - E.in(prog(t, 11.15, 11.38))); if (a > 0) label(names[i], V3(o.position.x, 18, o.position.z - 6), a); });
      } };
  } },
  // 8 — the tagline types itself onto the counter in front of the stand; whip down at the end
  { a: 11.4, b: 13.8, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, 0); P.stand.rotation.y = 0;
    P.cup.visible = true; P.cup.position.set(-22, 0, -10);
    P.tagline.visible = true; const n1 = prog(TC, TYPE1[0], TYPE1[1]), n2 = prog(TC, TYPE2[0], TYPE2[1]);
    once('tag', `${Math.round(n1 * 8)}/${Math.round(n2 * 13)}`, () => P.tagline.userData.draw(n1, n2));
    const u = E.out(prog(t, 11.4, 13.8)), w = E.in(prog(t, 13.62, 13.8));
    const pos = V3(0, lerp(46, 40, u) - 6 * w, lerp(92, 84, u) - 6 * w).add(shake(t, 0.15));
    const fd = pos.distanceTo(V3(0, 2, 8));
    return { pos, tgt: V3(0, 3 - 14 * w, 6 + 10 * w), fov: 30, focus: lerp(420, fd, E.out(prog(t, 11.4, 11.7))), ap: 1.3, mood: 'cafe' };
  } },
  // 9 — end: the stand on navy felt, the contact prints in line by line; slow push-in
  { a: 13.8, b: 17.01, f(t) {
    P.pad.visible = true; P.pad.position.set(0, 0, 0);
    P.stand.visible = true; P.stand.position.set(0, 1.2, -9); P.stand.rotation.y = 0;
    const e1 = E.out(prog(TC, 14.05, 14.45)), e2 = E.out(prog(TC, 14.3, 14.7)), e3 = E.out(prog(TC, 14.55, 14.95));
    once('end', [e1, e2, e3].map((v) => v.toFixed(3)).join(), () => { drawEndPrint(P.endCanvas, e1, e2, e3); P.pad.userData.print.tex.needsUpdate = true; });
    const u = E.out(prog(t, 13.8, 17.0)), arrive = 1 - E.out(prog(t, 13.8, 14.25));
    const pos = V3(0, lerp(80, 70, u) + 6 * arrive, lerp(88, 78, u) + 4 * arrive).add(shake(t, 0.1));
    return { pos, tgt: V3(0, 2 + 6 * arrive, 1), fov: 30, focus: pos.distanceTo(V3(0, 4, -6)), ap: 1.0, mood: 'cafe' };
  } },
];
// ── 2D text helpers (crisp, not lens-blurred) ────────────────────────────────
function title(text, a, b) {
  const al = a * b; if (al <= 0) return;
  ctx.save(); ctx.globalAlpha = al; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30;
  U.text(ctx, text, W / 2, 1530 + (1 - a) * 40, { size: 128, weight: 700, color: '#ffffff', align: 'center', family: 'Inter', ls: -3 });
  ctx.restore();
}
function label(text, p, a) {
  const v = p.clone().project(cam), x = (v.x * 0.5 + 0.5) * W, y = (1 - (v.y * 0.5 + 0.5)) * H;
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 18;
  U.text(ctx, text, x, y - (1 - a) * 16, he({ size: 52, weight: 600, color: '#ffffff' }));
  ctx.restore();
}

// ── frame ────────────────────────────────────────────────────────────────────
let curShot = null;
function frame(t, lensK = [0, 0], tc = null, first = true, jit = [0, 0]) {
  t = clamp(t, 0, DUR - 1e-4); TC = clamp(tc == null ? t : tc, 0, DUR - 1e-4);
  if (first) renderer.shadowMap.needsUpdate = true;
  hideAll();
  const s = SHOTS.find((x) => t >= x.a && t < x.b) || SHOTS[SHOTS.length - 1];
  const c = s.f(t); curShot = c;
  cam.fov = c.fov; cam.position.copy(c.pos); cam.up.set(0, 1, 0); cam.lookAt(c.tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  backdrop(c, c.mood);
  // thin lens: shift the eye on the aperture disc and shear the frustum so the focal plane stays put
  {
    const dx = c.ap ? lensK[0] * c.ap : 0, dy = c.ap ? lensK[1] * c.ap : 0;
    const r = V3(1, 0, 0).applyQuaternion(cam.quaternion), u = V3(0, 1, 0).applyQuaternion(cam.quaternion);
    cam.position.addScaledVector(r, dx).addScaledVector(u, dy); cam.updateMatrixWorld();
    const e = cam.projectionMatrix.elements;
    e[8] = (-e[0] * dx) / c.focus + (jit[0] * 2) / W; e[9] = (-e[5] * dy) / c.focus + (jit[1] * 2) / H;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  renderer.render(scene, cam);
  ctx.drawImage(renderer.domElement, 0, 0, W, H);
  if (c.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${c.fade})`; ctx.fillRect(0, 0, W, H); }
  // overlays use the un-jittered camera so text stays crisp
  cam.position.copy(c.pos); cam.lookAt(c.tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  if (c.overlay) c.overlay();
}
function post(i) {
  // vignette + fine film grain (once per final frame)
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.22, W / 2, H * 0.5, H * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H), d = img.data; let s = (i + 1) * 9301;
  for (let j = 0; j < d.length; j += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 16) / 32768 - 0.5) * 9; d[j] += n; d[j + 1] += n; d[j + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

async function main() {
  await fonts();
  setup();
  const N = W * H * 4; let acc = null;
  window.seek = async (t) => { frame(t); };
  window.renderFrame = async (i, opts = {}) => {
    const n = Math.max(1, opts.samples || 24), shutter = opts.shutter == null ? 0.5 : opts.shutter;
    acc = acc || new Float32Array(N); acc.fill(0);
    for (let k = 0; k < n; k++) {
      // stratified shutter time + golden-angle lens disc, decorrelated by a stride
      const kt = (k * 7) % n, r = Math.sqrt((k + 0.5) / n), th = k * 2.399963;
      const halton = (j, b) => { let f = 1, v = 0; for (j += 1; j > 0; j = Math.floor(j / b)) { f /= b; v += f * (j % b); } return v; };
      frame((i + ((kt + 0.5) / n - 0.5) * shutter) / FPS, n > 1 ? [r * Math.cos(th), r * Math.sin(th)] : [0, 0], i / FPS, k === 0,
        n > 1 ? [halton(k, 2) - 0.5, halton(k, 3) - 0.5] : [0, 0]);
      const d = ctx.getImageData(0, 0, W, H).data;
      for (let j = 0; j < N; j++) acc[j] += d[j];
    }
    const img = ctx.createImageData(W, H), o = img.data, inv = 1 / n;
    for (let j = 0; j < N; j++) o[j] = acc[j] * inv + 0.5;
    ctx.putImageData(img, 0, 0);
    post(i);
    return opts.noData ? null : out.toDataURL('image/png');
  };
  window.ready = true;
}
main();
