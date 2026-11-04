// Key-frame stills for the reel concept (opening, entering the café, review wall).
import { THREE, W, H, buildStreet, buildCafe, buildStand, buildDot, lights } from './world.js';
import { buildCity, routeGeometry, HERO } from './city.js';

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

const out = document.getElementById('out'), ctx = out.getContext('2d');
let renderer;
function makeRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1.5); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
const he = (o) => Object.assign({ family: 'Rubik', dir: 'rtl', align: 'center' }, o);
const proj = (v, cam) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H]; };

// Google-Maps-style place label: red pin + name + rating pill
function placeLabel(x, y, name, rating, count, hi) {
  ctx.save();
  // pin
  ctx.translate(x, y);
  ctx.fillStyle = hi ? '#EA4335' : '#F28B30';
  ctx.beginPath(); ctx.arc(0, -46, 20, Math.PI * 0.82, Math.PI * 2.18); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -46, 7.5, 0, Math.PI * 2); ctx.fill();
  // label card
  const t1 = he({ size: 30, weight: 600, color: '#202124', align: 'left' });
  const w1 = U.measure(ctx, name, t1), w = Math.max(w1, 210) + 44;
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  U.rr(ctx, -w / 2, -160, w, 92, 20); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
  U.text(ctx, name, 0, -122, he({ size: 30, weight: 600, color: '#202124' }));
  const rx = 66;
  U.text(ctx, rating.toFixed(1), rx, -84, { size: 23, weight: 600, color: '#202124', align: 'right' });
  for (let i = 0; i < 5; i++) U.star(ctx, rx - 52 - i * 19, -92, 8.5, Math.min(1, Math.max(0, rating - i)), '#FBBC04', '#DADCE0', 1.2);
  U.text(ctx, `(${count})`, rx - 52 - 4 * 19 - 16, -84, { size: 22, weight: 500, color: '#70757A', align: 'right' });
  ctx.restore();
}
function caption(text, y, sub) {
  ctx.save();
  const o = he({ size: 62, weight: 700, color: '#202124' });
  const w = U.measure(ctx, text, o) + 80;
  ctx.shadowColor = 'rgba(0,0,0,0.16)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  U.rr(ctx, W / 2 - w / 2, y - 66, w, 100, 50); ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill();
  ctx.restore();
  U.text(ctx, text, W / 2, y + 4, o);
  if (sub) U.text(ctx, sub, W / 2, y + 90, he({ size: 36, weight: 500, color: '#3C4043' }));
}

// Google-Maps navigation header (green), RTL
function navCard(dist, to) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  U.rr(ctx, 40, 70, W - 80, 170, 34); ctx.fillStyle = '#137333'; ctx.fill();
  ctx.restore();
  // straight-ahead arrow on the right
  ctx.save(); ctx.translate(W - 130, 155); ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(34, -6); ctx.lineTo(12, -6); ctx.lineTo(12, 44); ctx.lineTo(-12, 44); ctx.lineTo(-12, -6); ctx.lineTo(-34, -6); ctx.closePath(); ctx.fill();
  ctx.restore();
  U.text(ctx, dist, W - 210, 140, he({ size: 60, weight: 700, color: '#fff', align: 'right' }));
  U.text(ctx, 'לכיוון ' + to, W - 210, 205, he({ size: 40, weight: 500, color: 'rgba(255,255,255,0.92)', align: 'right' }));
}

const STORES = [
  { slot: 4, name: 'מאפיית בוקר', color: 0xf6dcc2, awning: 0xc96f4a, signBg: '#fff7ee', signFg: '#a0522d' },
  { slot: 7, name: 'קפה לימון', color: 0xfbe7a6, awning: 0x2f9e6a, signBg: '#ffffff', signFg: '#2f7d55' },
];

async function main() {
  await fonts();
  makeRenderer();
  const print = Art.standFace();

  // ── street scene
  const street = new THREE.Scene(); street.background = new THREE.Color(0xeef1f5);
  street.fog = new THREE.Fog(0xeef1f5, 90, 190);
  street.add(buildStreet(STORES)); lights(street, 90);
  const [A, B] = STORES;
  const dot = buildDot(1.0); street.add(dot);
  const route = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.55), new THREE.MeshBasicMaterial({ color: 0x4285f4, transparent: true, opacity: 0.85 }));
  route.rotation.x = -Math.PI / 2; street.add(route);
  // many dots for the review-wall shot
  const crowd = [];
  for (let i = 0; i < 6; i++) { const d = buildDot(0.85); d.visible = false; street.add(d); crowd.push(d); }

  // ── café scene
  const cafe = new THREE.Scene(); cafe.background = new THREE.Color(0xf4ece0);
  const stand = buildStand(print); cafe.add(buildCafe(stand));
  cafe.add(new THREE.HemisphereLight(0xfff4e6, 0xb89a7a, 1.2));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(3, 6, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); key.shadow.radius = 5; cafe.add(key);
  const cafeDot = buildDot(0.28); cafe.add(cafeDot);

  // ── full city
  const CITY_STORES = [
    { id: 'bakery', slot: 1, name: 'מאפיית בוקר', color: 0xf6dcc2, awning: 0xc96f4a, signBg: '#fff7ee', signFg: '#a0522d' },
    { id: 'cafe', slot: 4, name: 'קפה לימון', color: 0xfbe7a6, awning: 0x2f9e6a, signBg: '#ffffff', signFg: '#2f7d55' },
  ];
  const city = new THREE.Scene(); city.background = new THREE.Color(0xe8edf3);
  city.fog = new THREE.Fog(0xe8edf3, 320, 720);
  const cityG = buildCity({ stores: CITY_STORES }); city.add(cityG);
  const cm = cityG.userData;
  city.add(new THREE.HemisphereLight(0xffffff, 0xd9dee6, 1.25));
  const sun2 = new THREE.DirectionalLight(0xffffff, 2.3);
  sun2.castShadow = true; sun2.shadow.mapSize.set(4096, 4096);
  Object.assign(sun2.shadow.camera, { left: -190, right: 190, top: 190, bottom: -190, near: 1, far: 700 });
  sun2.shadow.bias = -0.0005; sun2.shadow.normalBias = 0.06;
  city.add(sun2, sun2.target);
  const cdot = buildDot(4.8); city.add(cdot);
  const routeFill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x4285f4, polygonOffset: true, polygonOffsetFactor: -2 }));
  const routeEdge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x1a5bc9, polygonOffset: true, polygonOffsetFactor: -1 }));
  city.add(routeEdge, routeFill);

  const cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 900);
  const snap = () => { renderer.render(window.__scene, cam); ctx.drawImage(renderer.domElement, 0, 0, W, H); };

  window.shot = async (n) => {
    ctx.clearRect(0, 0, W, H);
    if (n === 1) {
      // Opening: aerial over the street, a customer (blue dot) walking past the bakery
      dot.position.set(A.door.x - 6, 0.2, -6); dot.rotation.y = Math.PI / 2;
      route.scale.x = 20; route.position.set(A.door.x + 4, 0.2, -5.2);
      cam.fov = 34; cam.updateProjectionMatrix();
      cam.position.set(A.door.x + 50, 92, 62); cam.lookAt(A.door.x + 10, 0, -14);
      window.__scene = street; snap();
      placeLabel(...proj(A.top, cam), A.name, 4.2, 31, false);
      placeLabel(...proj(B.top, cam), B.name, 4.3, 38, true);
      caption('הלקוחות שלך מרוצים...', 1560);
    } else if (n === 4) {
      // City establishing frame: the customer (blue dot) on the hero street, the route growing ahead
      const bak = cm.stores.bakery, caf = cm.stores.cafe;
      const start = [-52, HERO.walkZ];
      const pts = [start, [bak.x, HERO.walkZ], [bak.x, HERO.frontZ - 0.6]];
      const total = Math.abs(bak.x - start[0]) + Math.abs(HERO.frontZ - 0.6 - HERO.walkZ);
      const L = total * 0.68;
      routeEdge.geometry = routeGeometry(pts, L, 4.2, 0.32);
      routeFill.geometry = routeGeometry(pts, L, 3.0, 0.36);
      cdot.position.set(start[0], 0.5, start[1]); cdot.rotation.y = Math.PI / 2;
      cm.setTraffic(2.5);
      const T = new THREE.Vector3(-12, 0, -22);
      sun2.position.set(T.x - 160, 260, T.z + 190); sun2.target.position.copy(T); sun2.target.updateMatrixWorld();
      sun2.shadow.camera.updateProjectionMatrix();
      cam.fov = 40; cam.updateProjectionMatrix();
      cam.position.set(T.x + 66, 216, T.z + 184); cam.lookAt(T);
      window.__scene = city; snap();
      placeLabel(...proj(bak.top, cam), 'מאפיית בוקר', 3.2, 31, false);
      placeLabel(...proj(caf.top, cam), 'קפה לימון', 2.7, 38, true);
      navCard('50 מ׳', 'מאפיית בוקר');
    } else if (n === 2) {
      // Entering the café: from just behind the blue dot, the stand on the counter ahead
      cafeDot.scale.setScalar(0.17); cafeDot.position.set(0.8, 0.02, -0.55); cafeDot.rotation.y = Math.PI;
      cam.fov = 40; cam.updateProjectionMatrix();
      cam.position.set(0.5, 1.7, 3.4); cam.lookAt(1.0, 0.95, -1.6);
      window.__scene = cafe; snap();
      const sp = proj(new THREE.Vector3(1.15, 1.32, -1.8), cam);
      ctx.save(); ctx.strokeStyle = 'rgba(66,133,244,0.85)'; ctx.lineWidth = 4;
      for (let k = 0; k < 2; k++) { ctx.globalAlpha = 0.6 - k * 0.3; ctx.beginPath(); ctx.arc(sp[0], sp[1], 150 + k * 46, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      caption('נכנסים לקפה לימון', 1230, 'ועל הדלפק — המעמד');
    } else if (n === 3) {
      // Review wall: zoomed out over the café, customers streaming in, reviews rising
      cam.fov = 40; cam.updateProjectionMatrix();
      cam.position.set(B.door.x + 18, 62, 52); cam.lookAt(B.door.x - 2, 0, -2);
      dot.visible = false; route.visible = false;
      crowd.forEach((d, i) => { d.visible = true; d.position.set(B.door.x - 14 + i * 5.2, 0.2, -5.8 + (i % 2) * 0.7); d.rotation.y = i * 1.3; });
      window.__scene = street; snap();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, W, H);
      // floating "+★" over the crowd
      crowd.forEach((d, i) => { const [x, y] = proj(d.position.clone().add(new THREE.Vector3(0, 3 + (i % 3), 0)), cam); U.star(ctx, x, y - 20, 18, 1, '#FBBC04'); });
      caption('כל ביקור הופך לביקורת', 270);
      // Google-Maps bottom sheet with reviews stacking up
      const top = 1120;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = -6;
      U.rr(ctx, 30, top, W - 60, H - top + 60, 46); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      U.rr(ctx, W / 2 - 40, top + 18, 80, 9, 5); ctx.fillStyle = '#DADCE0'; ctx.fill();
      U.text(ctx, 'קפה לימון', W - 80, top + 95, he({ size: 52, weight: 700, color: '#202124', align: 'right' }));
      U.text(ctx, '4.9', W - 80, top + 160, { size: 38, weight: 600, color: '#202124', align: 'right' });
      for (let i = 0; i < 5; i++) U.star(ctx, W - 160 - i * 34, top + 147, 14, 1, '#FBBC04');
      U.text(ctx, '(126 ביקורות)', W - 340, top + 160, he({ size: 30, weight: 400, color: '#70757A', align: 'right' }));
      U.text(ctx, 'בית קפה · כפר סבא', W - 80, top + 210, he({ size: 30, weight: 400, color: '#70757A', align: 'right' }));
      const R = [['נועה כ.', 'נ', '#34A853', 'הצמדתי את הטלפון וזהו. הכי קל שיש!', 'לפני דקה'], ['אבי ל.', 'א', '#4285F4', 'קפה מעולה ושירות מהיר. חמישה כוכבים.', 'לפני 4 דקות'], ['מאיה ש.', 'מ', '#EA4335', 'טאפ אחד והביקורת נשלחה. מושלם.', 'לפני 12 דקות']];
      R.forEach(([n, ini, col, t, ago], i) => {
        const y = top + 250 + i * 170;
        U.rr(ctx, 60, y, W - 120, 150, 26); ctx.fillStyle = i === 0 ? '#EEF4FE' : '#F7F8FA'; ctx.fill();
        U.avatar(ctx, W - 110, y + 48, 26, col, ini);
        U.text(ctx, n, W - 152, y + 52, he({ size: 30, weight: 600, color: '#202124', align: 'right' }));
        U.text(ctx, ago, 100, y + 52, he({ size: 24, weight: 400, color: '#70757A', align: 'left' }));
        for (let k = 0; k < 5; k++) U.star(ctx, W - 160 - k * 26, y + 88, 10, 1, '#FBBC04');
        U.text(ctx, t, W - 96, y + 128, he({ size: 28, weight: 400, color: '#3C4043', align: 'right' }));
      });
    }
    return out.toDataURL('image/png');
  };
  window.ready = true;
}
main();
