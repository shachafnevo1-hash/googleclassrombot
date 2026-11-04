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
import { counter, coffeeCup, flipCounter, lightLine, scissors, plateSet, shoppingBag, feltPad, ACCENT } from './props.js';
import { buildPhone, drawReview } from './phone.js';

const W = 1080, H = 1920, FPS = 30, DUR = 17;
const { E, prog, lerp, clamp } = U;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const he = (o) => Object.assign({ family: 'Rubik', dir: 'rtl', align: 'center' }, o);
window.FILM = { W, H, FPS, DUR };

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
function endPrint() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 900; const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(c.width / 2 - 160, 120, 320, 3);
  U.text(x, 'שחף · בן 18, לפני צבא', c.width / 2, 300, he({ size: 96, weight: 500, color: 'rgba(255,255,255,0.86)' }));
  U.text(x, '054-817-6706', c.width / 2, 520, { size: 190, weight: 700, color: '#ffffff', align: 'center', family: 'Inter', ls: 4 });
  const po = he({ size: 82, weight: 500, color: 'rgba(255,255,255,0.9)' }), pw = U.measure(x, 'תשלום חד-פעמי', po) + 140;
  U.rr(x, c.width / 2 - pw / 2, 630, pw, 150, 75); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 5; x.stroke();
  U.text(x, 'תשלום חד-פעמי', c.width / 2, 735, po);
  return c;
}
function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1.25); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  P.pad = feltPad(endPrint()); scene.add(P.pad);
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
// each returns { pos, tgt, fov, focus (distance), ap (lens radius, cm), mood, overlay(ctx) }
function hideAll() {
  for (const k of ['stand', 'cup', 'flip', 'scissors', 'plate', 'bag', 'cup2', 'pad', 'lineIntro', 'linePhone', 'treeTrunk', 'tagline']) P[k].visible = false;
  P.phone.g.visible = false; P.counter.visible = true;
  P.tree.forEach((l) => (l.visible = false)); P.treeSpots.forEach((s) => (s.visible = false));
}
const standBadge = () => { P.stand.updateMatrixWorld(true); return P.stand.userData.panel.localToWorld(P.stand.userData.badgeLocal.clone()); };
const SHOTS = [
  // 1 — macro hero: rack focus from the cup to the stand's G; "One Tap." slides in
  { a: 0.0, b: 1.3, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, 0); P.stand.rotation.y = -0.32;
    P.cup.visible = true; P.cup.position.set(-10, 0, -22);
    const u = prog(t, 0, 1.3), G = standBadge();
    const pos = V3(lerp(17, 13, u), lerp(6.5, 7.2, u), lerp(60, 53, u));
    return { pos, tgt: V3(0.4, 6.4, 0.5), fov: 28, focus: pos.distanceTo(G), ap: 1.5, mood: 'cafe',
      overlay() { title('One Tap.', E.out(prog(t, 0.15, 0.6)), 1 - E.in(prog(t, 1.0, 1.3))); } };
  } },
  // 2 — the light leaves the stand and races low across the counter to a phone lying at the far end
  { a: 1.3, b: 2.6, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, 0); P.stand.rotation.y = -0.32;
    P.lineIntro.visible = true; const g = E.inOut(prog(t, 1.3, 2.45)); P.lineIntro.userData.grow(g);
    P.phone.g.visible = true; P.phone.g.position.set(24, 0.45, -62); P.phone.g.rotation.set(-Math.PI / 2, 0, 0.6);
    drawReview(P.phone, { stars: 0 });
    const head = P.lineIntro.userData.curve.getPointAt(Math.max(0.02, g));
    const back = P.lineIntro.userData.curve.getPointAt(Math.max(0, g - 0.18));
    const pos = V3(back.x - 2, 12, back.z + 24);
    return { pos, tgt: V3(head.x, 0, head.z - 10), fov: 32, focus: pos.distanceTo(head), ap: 1.2, mood: 'cafe' };
  } },
  // 3 — the phone rises out of the dark on the light line; the review page fills in
  { a: 2.6, b: 4.2, f(t) {
    P.counter.visible = false; P.phone.g.visible = true; P.linePhone.visible = true;
    const u = prog(t, 2.6, 4.2);
    P.phone.g.position.set(0, lerp(-4, 2, E.out(u)), 0); P.phone.g.rotation.set(lerp(-0.55, -0.22, E.out(u)), lerp(0.5, 0.22, E.out(u)), lerp(0.08, 0.03, u));
    P.phone.g.updateMatrixWorld(true);
    const plug = P.phone.g.localToWorld(V3(0, -7.4, 0)); P.linePhone.position.copy(plug).sub(V3(0, -9.2, 0));
    P.linePhone.userData.grow(1);
    drawReview(P.phone, { stars: clamp((t - 3.0) / 0.12, 0, 5) });
    const pos = V3(lerp(4, 2, u), lerp(-2, 1, u), lerp(56, 50, u));
    return { pos, tgt: V3(0, 0.5, 0), fov: 30, focus: pos.distanceTo(P.phone.g.position), ap: 0.7, mood: 'void' };
  } },
  // 5 — mechanical review counter flipping up; star lamps light one by one
  { a: 5.4, b: 7.2, f(t) {
    P.flip.visible = true; P.flip.position.set(0, 0, 0); P.flip.rotation.y = 0.28;
    P.stand.visible = true; P.stand.position.set(19, 0, -24); P.stand.rotation.y = -0.4;
    const u = prog(t, 5.4, 6.9);
    P.flip.userData.set(lerp(38, 241, E.inOut(u)), 5 * E.inOut(prog(t, 5.6, 6.8)));
    const pos = V3(lerp(-26, -20, u), lerp(16, 17, u), lerp(84, 74, u));
    return { pos, tgt: V3(1, 6.4, 1), fov: 34, focus: pos.distanceTo(V3(0, 7, 3)), ap: 2.4, mood: 'cafe' };
  } },
  // 7 — the light branches from the stand to every kind of business
  { a: 9.4, b: 11.6, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, -2); P.stand.rotation.y = 0;
    P.treeTrunk.visible = true; P.treeTrunk.userData.grow(E.inOut(prog(t, 9.5, 10.0)));
    const props = [P.cup2, P.scissors, P.plate, P.bag], spots = TREE_AT;
    props.forEach((o, i) => { o.visible = true; o.position.set(spots[i][0], 0, spots[i][1]); });
    P.scissors.rotation.y = 0.6; P.bag.rotation.y = -0.4; P.plate.rotation.y = 0.2;
    P.tree.forEach((l, i) => { const g = E.inOut(prog(t, 10.0 + i * 0.18, 10.5 + i * 0.18)); l.visible = true; l.userData.grow(g); P.treeSpots[i].visible = g > 0.95; P.treeSpots[i].material.opacity = E.out(prog(t, 10.45 + i * 0.18, 10.7 + i * 0.18)); });
    const u = prog(t, 9.4, 11.6);
    const pos = V3(0, lerp(96, 104, u), lerp(74, 80, u));
    return { pos, tgt: V3(0, 0, -2), fov: 42, focus: pos.distanceTo(V3(0, 4, -2)), ap: 1.6, mood: 'cafe',
      overlay() {
        const names = ['בתי קפה', 'מספרות', 'מסעדות', 'חנויות'];
        props.forEach((o, i) => { const a = E.out(prog(t, 10.5 + i * 0.18, 10.8 + i * 0.18)); if (a > 0) label(names[i], V3(o.position.x, 18, o.position.z - 6), a); });
      } };
  } },
  // 8 — wide: the stand under a warm lamp, the tagline types itself onto the counter
  { a: 11.6, b: 13.8, f(t) {
    P.stand.visible = true; P.stand.position.set(0, 0, 0); P.stand.rotation.y = 0;
    P.cup.visible = true; P.cup.position.set(-22, 0, -10);
    P.tagline.visible = true; P.tagline.userData.draw(clamp((t - 11.9) / 0.45), clamp((t - 12.55) / 0.6));
    const u = E.out(prog(t, 11.6, 13.8));
    const pos = V3(0, lerp(46, 40, u), lerp(92, 84, u));
    return { pos, tgt: V3(0, 3, 6), fov: 30, focus: pos.distanceTo(V3(0, 2, 8)), ap: 1.3, mood: 'cafe' };
  } },
  // 9 — end: the stand on navy felt; contact printed on the pad; slow push-in
  { a: 13.8, b: 17.0, f(t) {
    P.pad.visible = true; P.pad.position.set(0, 0, 0);
    P.stand.visible = true; P.stand.position.set(0, 1.2, -9); P.stand.rotation.y = 0;
    const u = E.out(prog(t, 13.8, 17.0));
    const pos = V3(0, lerp(78, 70, u), lerp(86, 78, u));
    return { pos, tgt: V3(0, 2, 1), fov: 30, focus: pos.distanceTo(V3(0, 4, -6)), ap: 1.0, mood: 'cafe' };
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
function frame(t, lensK = [0, 0]) {
  hideAll();
  const s = SHOTS.find((x) => t >= x.a && t < x.b) || SHOTS[SHOTS.length - 1];
  const c = s.f(t); curShot = c;
  cam.fov = c.fov; cam.position.copy(c.pos); cam.up.set(0, 1, 0); cam.lookAt(c.tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  backdrop(c, c.mood);
  // thin lens: shift the eye on the aperture disc and shear the frustum so the focal plane stays put
  if (c.ap) {
    const dx = lensK[0] * c.ap, dy = lensK[1] * c.ap;
    const r = V3(1, 0, 0).applyQuaternion(cam.quaternion), u = V3(0, 1, 0).applyQuaternion(cam.quaternion);
    cam.position.addScaledVector(r, dx).addScaledVector(u, dy); cam.updateMatrixWorld();
    const e = cam.projectionMatrix.elements; e[8] = (-e[0] * dx) / c.focus; e[9] = (-e[5] * dy) / c.focus;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  renderer.render(scene, cam);
  ctx.drawImage(renderer.domElement, 0, 0, W, H);
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
      frame((i + ((kt + 0.5) / n - 0.5) * shutter) / FPS, n > 1 ? [r * Math.cos(th), r * Math.sin(th)] : [0, 0]);
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
