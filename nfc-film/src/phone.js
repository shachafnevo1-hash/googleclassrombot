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

// Google review page for Café Limon. stars: 0..5 (fractional = popping), typed: 0..1, posted: 0..1
export function drawReview(phone, { stars = 0, typed = 0, posted = 0, glow = 0 } = {}) {
  const x = phone.canvas.getContext('2d'), k = phone.canvas.width / 820, Wc = 820, Hc = phone.canvas.height / k;
  x.save(); x.setTransform(k, 0, 0, k, 0, 0); x.fillStyle = '#ffffff'; x.fillRect(0, 0, Wc, Hc);
  statusBar(x, Wc, true);
  const Y = 66;
  x.strokeStyle = '#5f6368'; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(58, 148 + Y); x.lineTo(92, 182 + Y); x.moveTo(92, 148 + Y); x.lineTo(58, 182 + Y); x.stroke();
  U.avatar(x, 740, 168 + Y, 44, '#F4D35E', 'ק', '#5f4b00');
  U.text(x, 'קפה לימון', 676, 160 + Y, he({ size: 52, weight: 700, color: '#202124', align: 'right' }));
  U.text(x, 'בית קפה · כפר סבא', 676, 210 + Y, he({ size: 32, weight: 400, color: '#5f6368', align: 'right' }));
  x.fillStyle = '#e8eaed'; x.fillRect(40, 262 + Y, Wc - 80, 2);
  U.avatar(x, 740, 336 + Y, 36, '#1A73E8', 'ד');
  U.text(x, 'דנה לוי', 684, 328 + Y, he({ size: 38, weight: 600, color: '#202124', align: 'right' }));
  U.text(x, 'הביקורת תפורסם באופן ציבורי', 684, 370 + Y, he({ size: 28, weight: 400, color: '#5f6368', align: 'right' }));
  for (let i = 0; i < 5; i++) {
    const f = clamp(stars - i), pu = E.bump(clamp((stars - i) * 1.4));
    const sx = Wc / 2 + (2 - i) * 138, sy = 560 + Y, Rr = 58 * (1 + 0.18 * pu);
    if (f > 0.05) { const gg = x.createRadialGradient(sx, sy, 0, sx, sy, 120); gg.addColorStop(0, `rgba(251,188,4,${0.32 * f + glow * 0.2})`); gg.addColorStop(1, 'rgba(251,188,4,0)'); x.fillStyle = gg; x.fillRect(sx - 120, sy - 120, 240, 240); }
    U.star(x, sx, sy, Rr, f, '#FBBC04', '#9AA0A6', 5);
  }
  if (stars >= 4.99) U.text(x, 'מעולה!', Wc / 2, 682 + Y, he({ size: 40, weight: 600, color: '#202124' }));
  U.rr(x, 50, 744 + Y, Wc - 100, 300, 26); x.strokeStyle = '#dadce0'; x.lineWidth = 3; x.stroke();
  const full = 'קפה מעולה ושירות מהיר!', n = Math.floor(full.length * clamp(typed));
  if (n === 0) U.text(x, 'שתפו פרטים על החוויה שלכם', Wc - 90, 834 + Y, he({ size: 34, weight: 400, color: '#9aa0a6', align: 'right' }));
  else U.text(x, full.slice(0, n), Wc - 90, 834 + Y, he({ size: 38, weight: 400, color: '#202124', align: 'right' }));
  U.rr(x, 50, Hc - 236, Wc - 100, 112, 56); x.fillStyle = '#1A73E8'; x.fill();
  U.text(x, 'פרסום', Wc / 2, Hc - 164, he({ size: 46, weight: 700, color: '#ffffff' }));
  if (posted > 0) {
    x.save(); x.globalAlpha = posted; x.fillStyle = '#ffffff'; x.fillRect(0, 0, Wc, Hc); statusBar(x, Wc, true);
    x.translate(Wc / 2, 780); const sc = 0.7 + 0.3 * E.arrive(posted); x.scale(sc, sc);
    x.beginPath(); x.arc(0, 0, 120, 0, Math.PI * 2); x.fillStyle = '#1e8e3e'; x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 22; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-52, 4); x.lineTo(-14, 44); x.lineTo(56, -38); x.stroke(); x.restore();
    U.text(x, 'הביקורת פורסמה', Wc / 2, 1010, he({ size: 58, weight: 700, color: '#202124', alpha: posted }));
  }
  U.rr(x, Wc / 2 - 131, 23, 262, 77, 38.5); x.fillStyle = '#000'; x.fill();
  U.rr(x, Wc / 2 - 140, Hc - 26, 280, 10, 5); x.fillStyle = 'rgba(17,17,17,0.82)'; x.fill();
  x.restore(); phone.tex.needsUpdate = true;
}
