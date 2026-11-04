// ─────────────────────────────────────────────────────────────────────────────
// phone.js — iPhone (15 Pro proportions, natural titanium) + its screens.
// Model shared with the v3 reel; here built at real size (cm by default).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from '../../nfc-reel/node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../../nfc-reel/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
const { E, prog, lerp, clamp } = U;
const he = (o) => Object.assign({ family: 'Rubik', dir: 'rtl', align: 'center' }, o);

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
export function buildPhone(env, MM = 0.1) {   // MM: scene units per millimetre (0.1 = cm)
  const g = new THREE.Group();
  const Wp = 70.6 * MM, Hp = 146.6 * MM, Dp = 8.25 * MM, R = 11.6 * MM, bs = 0.9 * MM, bt = 1.05 * MM;
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

export function statusBar(x, Wc, dark, time = true) {
  const c = dark ? '#111' : '#1f2937';
  if (time) U.text(x, '9:41', 118, 74, { size: 34, weight: 600, color: c, align: 'center', family: 'Inter' });
  x.fillStyle = c;
  for (let i = 0; i < 4; i++) U.rr(x, 584 + i * 13, 74 - 9 - i * 5, 9, 9 + i * 5, 2), x.fill();
  x.strokeStyle = c; x.lineWidth = 4.5; x.lineCap = 'round';
  for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(664, 76, 7 + i * 8, -Math.PI * 0.75, -Math.PI * 0.25); x.stroke(); }
  x.lineWidth = 2.5; U.rr(x, 690, 56, 50, 24, 7); x.globalAlpha *= 0.45; x.stroke(); x.globalAlpha /= 0.45;
  U.rr(x, 694, 60, 38, 16, 4); x.fill(); U.rr(x, 742, 63, 4, 10, 2); x.globalAlpha *= 0.45; x.fill(); x.globalAlpha /= 0.45;
}

// ── screens (logical 820-wide space; the canvas has the real display ratio) ──
const BIZ = { name: 'קפה הפוך על הפוך', sub: 'בית קפה · תל אביב', avatar: '#B07A4E', letter: 'ק' };
export function pageLock(x, Wc, Hc, { wake = 1 } = {}) {
  const g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, '#1d2b4f'); g.addColorStop(0.6, '#2c2346'); g.addColorStop(1, '#141019');
  x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
  const r = x.createRadialGradient(Wc * 0.7, Hc * 0.35, 0, Wc * 0.7, Hc * 0.35, Wc); r.addColorStop(0, 'rgba(90,162,255,0.35)'); r.addColorStop(1, 'rgba(90,162,255,0)'); x.fillStyle = r; x.fillRect(0, 0, Wc, Hc);
  statusBar(x, Wc, false, false);
  U.text(x, 'יום שלישי, 3 בנובמבר', Wc / 2, 268, he({ size: 40, weight: 500, color: 'rgba(255,255,255,0.85)' }));
  U.text(x, '9:41', Wc / 2, 478, { size: 210, weight: 600, color: '#ffffff', align: 'center', ls: -4, family: 'Inter' });
  if (wake < 1) { x.fillStyle = `rgba(0,0,0,${1 - wake})`; x.fillRect(0, 0, Wc, Hc); }
}
export function pageReview(x, Wc, Hc, { stars = 0, typed = 0 } = {}) {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, Wc, Hc);
  statusBar(x, Wc, true);
  const Y = 66;
  x.strokeStyle = '#5f6368'; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(58, 148 + Y); x.lineTo(92, 182 + Y); x.moveTo(92, 148 + Y); x.lineTo(58, 182 + Y); x.stroke();
  U.avatar(x, 740, 168 + Y, 44, BIZ.avatar, BIZ.letter, '#ffffff');
  U.text(x, BIZ.name, 676, 160 + Y, he({ size: 50, weight: 700, color: '#202124', align: 'right' }));
  U.text(x, BIZ.sub, 676, 210 + Y, he({ size: 32, weight: 400, color: '#5f6368', align: 'right' }));
  x.fillStyle = '#e8eaed'; x.fillRect(40, 262 + Y, Wc - 80, 2);
  U.avatar(x, 740, 336 + Y, 36, '#1A73E8', 'ד');
  U.text(x, 'דנה לוי', 684, 328 + Y, he({ size: 38, weight: 600, color: '#202124', align: 'right' }));
  U.text(x, 'הביקורת תפורסם באופן ציבורי', 684, 370 + Y, he({ size: 28, weight: 400, color: '#5f6368', align: 'right' }));
  for (let i = 0; i < 5; i++) {
    const f = clamp(stars - i), pu = E.bump(clamp((stars - i) * 1.4));
    const sx = Wc / 2 + (2 - i) * 138, sy = 560 + Y, Rr = 58 * (1 + 0.18 * pu);
    if (f > 0.05) { const gg = x.createRadialGradient(sx, sy, 0, sx, sy, 120); gg.addColorStop(0, `rgba(251,188,4,${0.32 * f})`); gg.addColorStop(1, 'rgba(251,188,4,0)'); x.fillStyle = gg; x.fillRect(sx - 120, sy - 120, 240, 240); }
    U.star(x, sx, sy, Rr, f, '#FBBC04', '#9AA0A6', 5);
  }
  const ex = clamp((stars - 4.6) * 2.5);
  if (ex > 0) U.text(x, 'מעולה!', Wc / 2, 682 + Y, he({ size: 40, weight: 600, color: '#202124', alpha: ex }));
  U.rr(x, 50, 744 + Y, Wc - 100, 300, 26); x.strokeStyle = '#dadce0'; x.lineWidth = 3; x.stroke();
  const full = 'קפה מעולה ושירות מהיר!', n = Math.floor(full.length * clamp(typed));
  if (n === 0) U.text(x, 'שתפו פרטים על החוויה שלכם', Wc - 90, 834 + Y, he({ size: 34, weight: 400, color: '#9aa0a6', align: 'right' }));
  else U.text(x, full.slice(0, n), Wc - 90, 834 + Y, he({ size: 38, weight: 400, color: '#202124', align: 'right' }));
  U.rr(x, 50, Hc - 236, Wc - 100, 112, 56); x.fillStyle = '#1A73E8'; x.fill();
  U.text(x, 'פרסום', Wc / 2, Hc - 164, he({ size: 46, weight: 700, color: '#ffffff' }));
}
const REVS = [['יוסי ב.', 'י', '#A142F4', 'הקרואסון הכי טוב בעיר', 5], ['מאיה ש.', 'מ', '#E8710A', 'אווירה מהממת וצוות מקסים', 5], ['רון ג.', 'ר', '#1E8E3E', 'הפוך מושלם, חוזר כל בוקר', 5], ['נועה כ.', 'נ', '#D93025', 'שירות מהיר ומחייך', 5]];
function reviewCard(x, Wc, y, [name, ini, col, txt, st], hl = 0, when = 'לפני שבוע') {
  if (hl > 0) { U.rr(x, 24, y - 18, Wc - 48, 190, 22); x.fillStyle = `rgba(26,115,232,${0.1 * hl})`; x.fill(); }
  U.avatar(x, 744, y + 30, 34, col, ini);
  U.text(x, name, 690, y + 26, he({ size: 34, weight: 600, color: '#202124', align: 'right' }));
  U.text(x, when, 690, y + 64, he({ size: 26, weight: 400, color: '#5f6368', align: 'right' }));
  for (let k = 0; k < 5; k++) U.star(x, 760 - k * 34, y + 104, 14, clamp(st - k), '#FBBC04', '#DADCE0', 2);
  U.text(x, txt, 776, y + 152, he({ size: 32, weight: 400, color: '#3c4043', align: 'right' }));
}
export function pageProfile(x, Wc, Hc, { rating = 3.2, count = 38, fresh = 0 } = {}) {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, Wc, Hc);
  // header photo: latte art, top view, warm bokeh
  const g = x.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, '#3b2416'); g.addColorStop(1, '#6b4429'); x.fillStyle = g; x.fillRect(0, 0, Wc, 420);
  for (const [bx, by, br, a] of [[90, 90, 70, 0.25], [700, 70, 90, 0.2], [620, 330, 60, 0.18], [160, 340, 50, 0.2]]) { const r = x.createRadialGradient(bx, by, 0, bx, by, br); r.addColorStop(0, `rgba(255,200,130,${a})`); r.addColorStop(1, 'rgba(255,200,130,0)'); x.fillStyle = r; x.fillRect(bx - br, by - br, br * 2, br * 2); }
  x.beginPath(); x.arc(Wc / 2, 225, 150, 0, Math.PI * 2); x.fillStyle = '#f4efe8'; x.fill();
  x.beginPath(); x.arc(Wc / 2, 225, 122, 0, Math.PI * 2); x.fillStyle = '#b07a4e'; x.fill();
  x.fillStyle = '#f6eadb'; x.beginPath(); x.moveTo(Wc / 2, 300); x.bezierCurveTo(Wc / 2 - 110, 220, Wc / 2 - 70, 140, Wc / 2, 190); x.bezierCurveTo(Wc / 2 + 70, 140, Wc / 2 + 110, 220, Wc / 2, 300); x.fill();
  statusBar(x, Wc, false);
  U.text(x, BIZ.name, 776, 500, he({ size: 54, weight: 700, color: '#202124', align: 'right' }));
  U.text(x, rating.toFixed(1), 776, 566, { size: 38, weight: 600, color: '#202124', align: 'right', family: 'Inter' });
  for (let k = 0; k < 5; k++) U.star(x, 690 - k * 40, 553, 17, clamp(rating - k), '#FBBC04', '#DADCE0', 2.2);
  U.text(x, `(${Math.round(count)})`, 476, 566, { size: 32, weight: 500, color: '#70757A', align: 'right', family: 'Inter' });
  U.text(x, 'בית קפה · ₪₪ · ', 776, 622, he({ size: 30, weight: 400, color: '#5f6368', align: 'right' }));
  U.text(x, 'פתוח עכשיו', 776 - U.measure(x, 'בית קפה · ₪₪ · ', he({ size: 30 })), 622, he({ size: 30, weight: 500, color: '#188038', align: 'right' }));
  [['מסלול', true], ['התקשרות', false], ['שמירה', false]].forEach(([lb, fill], i) => {
    const bx = 776 - i * 236 - 216; U.rr(x, bx, 662, 216, 78, 39);
    if (fill) { x.fillStyle = '#1A73E8'; x.fill(); } else { x.strokeStyle = '#dadce0'; x.lineWidth = 3; x.stroke(); }
    U.text(x, lb, bx + 108, 713, he({ size: 30, weight: 600, color: fill ? '#ffffff' : '#1A73E8' }));
  });
  x.fillStyle = '#e8eaed'; x.fillRect(0, 790, Wc, 2);
  U.text(x, 'ביקורות', 776, 862, he({ size: 40, weight: 700, color: '#202124', align: 'right' }));
  // the fresh 5-star review drops in at the top and pushes the others down
  const f = E.out(clamp(fresh)), y0 = 910;
  REVS.forEach((r, i) => reviewCard(x, Wc, y0 + (i + f) * 214, r));
  if (f > 0) { x.save(); x.globalAlpha = f; reviewCard(x, Wc, y0 - (1 - f) * 120, ['דנה לוי', 'ד', '#1A73E8', 'קפה מעולה ושירות מהיר!', 5], 1 - clamp(fresh - 1), 'עכשיו'); x.restore(); }
}
// compose pages (each with a vertical offset in logical px) + Dynamic Island + home bar
export function drawPhone(phone, pages) {
  const x = phone.canvas.getContext('2d'), k = phone.canvas.width / 820, Wc = 820, Hc = phone.canvas.height / k;
  x.save(); x.setTransform(k, 0, 0, k, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, Wc, Hc);
  for (const [fn, o, dy = 0] of pages) { if (dy >= Hc || dy <= -Hc) continue; x.save(); x.translate(0, dy); x.beginPath(); x.rect(0, 0, Wc, Hc); x.clip(); fn(x, Wc, Hc, o); x.restore(); }
  U.rr(x, Wc / 2 - 131, 23, 262, 77, 38.5); x.fillStyle = '#000'; x.fill();
  U.rr(x, Wc / 2 - 140, Hc - 26, 280, 10, 5); x.fillStyle = 'rgba(17,17,17,0.82)'; x.fill();
  x.restore(); phone.tex.needsUpdate = true;
}
export function drawReview(phone, o) { drawPhone(phone, [[pageReview, o]]); }
