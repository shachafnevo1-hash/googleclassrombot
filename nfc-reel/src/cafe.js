// ─────────────────────────────────────────────────────────────────────────────
// cafe.js — Café Limon interior, detailed but clean (stylised, Google-ish):
// oak slatted counter with quartz top, subway-tile backsplash, sage wall,
// espresso machine with group heads, grinder, pastry case with pastries,
// POS tablet, designed Hebrew menu board, shelves with jars / coffee bags /
// books, seating corner with tables, chairs and a cushioned bench, plants,
// a bright window, pendant lamps, framed lemon print. Meters.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from '../node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';

const std = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const rng = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

const COL = {
  wall: 0xf6f1e9, sage: 0xbccdb7, oak: 0xd9b48a, oakDark: 0xb98f63, quartz: 0xf7f6f2, charcoal: 0x2f3337,
  lemon: 0xf4d35e, green: [0x5fa36a, 0x4e8f5a, 0x74b97a, 0x3f7f4f], terracotta: 0xd9926a, brass: 0xc9a86a, steel: 0xd3d7dc,
};

function floorTex() {
  return canvasTex(1024, 1024, (x, w, h) => {
    const tones = ['#dcb98f', '#d3ae82', '#e1c29b', '#cfa77a', '#d8b58b'];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const pw = w / n;
      let y = -Math.floor(rng() * 300);
      while (y < h) {
        const L = 260 + rng() * 320;
        x.fillStyle = tones[Math.floor(rng() * tones.length)]; x.fillRect(i * pw, y, pw, L);
        x.globalAlpha = 0.07; x.fillStyle = '#6b4a2a';
        for (let k = 0; k < 6; k++) x.fillRect(i * pw + 6 + rng() * (pw - 12), y, 1.5, L);
        x.globalAlpha = 1; x.fillStyle = 'rgba(90,60,30,0.25)'; x.fillRect(i * pw, y, pw, 2);
        y += L;
      }
      x.fillStyle = 'rgba(90,60,30,0.22)'; x.fillRect(i * pw, 0, 2, h);
    }
  }, [5, 4]);
}
function tileTex() {
  return canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = '#e4e0d9'; x.fillRect(0, 0, w, h);
    const tw = 256, th = 85;
    for (let r = 0; r < h / th + 1; r++) for (let c = -1; c < w / tw + 1; c++) {
      const ox = (r % 2) * tw / 2;
      const g = x.createLinearGradient(0, r * th, 0, r * th + th);
      g.addColorStop(0, '#fdfcf9'); g.addColorStop(1, '#f2efe9');
      x.fillStyle = g; x.fillRect(c * tw + ox + 4, r * th + 4, tw - 8, th - 8);
    }
  }, [6, 3.2]);
}
function menuTex() {
  return canvasTex(2048, 1024, (x, w, h) => {
    x.fillStyle = '#2d3134'; x.fillRect(0, 0, w, h);
    const v = x.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(255,255,255,0.04)'); v.addColorStop(1, 'rgba(0,0,0,0.18)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
    const T = (s, px, py, o) => { x.font = `${o.w || 400} ${o.s}px Rubik`; x.fillStyle = o.c || '#f4f1ea'; x.textAlign = o.a || 'right'; x.direction = 'rtl'; x.fillText(s, px, py); };
    // title + lemon
    T('קפה לימון', w / 2 + 70, 170, { s: 132, w: 700, a: 'center' });
    const lx = w / 2 + 330, ly = 128;
    x.save(); x.translate(lx, ly); x.rotate(-0.3);
    x.fillStyle = '#f4d35e'; x.beginPath(); x.ellipse(0, 0, 58, 40, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#7bbf6a'; x.beginPath(); x.ellipse(36, -42, 26, 12, -0.7, 0, Math.PI * 2); x.fill();
    x.restore();
    T('קלוי טרי · כל יום', w / 2, 245, { s: 50, c: '#a9aeb3', a: 'center' });
    x.fillStyle = 'rgba(244,241,234,0.25)'; x.fillRect(w / 2 - 2, 320, 4, 600); x.fillRect(150, 290, w - 300, 3);
    const col = (title, items, xr) => {
      T(title, xr, 400, { s: 70, w: 600, c: '#f4d35e' });
      items.forEach(([n, p], i) => {
        const y = 500 + i * 100;
        T(n, xr, y, { s: 56 });
        T('₪' + p, xr - 760, y, { s: 56, w: 500, a: 'left', c: '#f4f1ea' });
        x.fillStyle = 'rgba(244,241,234,0.18)';
        for (let d = xr - 700; d < xr - x.measureText(n).width - 30; d += 22) x.fillRect(d, y - 14, 8, 4);
      });
    };
    col('קפה', [['אספרסו', 9], ['מקיאטו', 11], ['הפוך', 14], ['אמריקנו', 12], ['קר', 16]], w - 170);
    col('מאפים', [['קרואסון', 12], ['פאן שוקולד', 14], ['מאפין', 13], ['עוגיית חמאה', 8]], w / 2 - 90);
  });
}
function printTex() {
  return canvasTex(512, 640, (x, w, h) => {
    x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, w, h);
    const lemon = (cx, cy, r, a) => {
      x.save(); x.translate(cx, cy); x.rotate(a);
      x.fillStyle = '#f4d35e'; x.beginPath(); x.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#e9c13f'; x.beginPath(); x.ellipse(r * 0.95, 0, r * 0.14, r * 0.1, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#6fb06a'; x.beginPath(); x.ellipse(-r * 0.6, -r * 0.75, r * 0.5, r * 0.2, -0.6, 0, Math.PI * 2); x.fill();
      x.restore();
    };
    lemon(260, 250, 110, -0.3); lemon(170, 420, 70, 0.5); lemon(350, 440, 60, -0.9);
    x.fillStyle = '#5c5f63'; x.font = '500 40px Rubik'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('לימון', w / 2, 590);
  });
}
function bagTex(label) {
  return canvasTex(256, 384, (x, w, h) => {
    x.fillStyle = '#c8a27a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fffaf0'; x.fillRect(40, 130, w - 80, 150);
    x.fillStyle = '#2f3337'; x.font = '700 44px Rubik'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText(label, w / 2, 210);
    x.fillStyle = '#f4d35e'; x.beginPath(); x.ellipse(w / 2, 250, 22, 15, 0, 0, Math.PI * 2); x.fill();
  });
}

function plantMonstera(g, x, z, s = 1, y0 = 0) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.2 * s, 0.46 * s, 24), std(0xf1ece4, 0.6)); pot.position.set(x, y0 + 0.23 * s, z); pot.castShadow = true; g.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.24 * s, 24), std(0x5a4632)); soil.rotation.x = -Math.PI / 2; soil.position.set(x, y0 + 0.455 * s, z); g.add(soil);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng() * 0.4, h = (0.55 + rng() * 0.6) * s, r = (0.18 + rng() * 0.22) * s;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * s, 0.01 * s, h, 6), std(0x4f7f45));
    stem.position.set(x + Math.cos(a) * r * 0.4, y0 + 0.46 * s + h / 2, z + Math.sin(a) * r * 0.4); stem.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 18, 10), new THREE.MeshStandardMaterial({ color: COL.green[i % 4], roughness: 0.55 }));
    leaf.scale.set(1.1, 0.07, 0.8); leaf.position.set(x + Math.cos(a) * r, y0 + 0.46 * s + h, z + Math.sin(a) * r);
    leaf.rotation.set(Math.sin(a) * 0.6, -a, -Math.cos(a) * 0.6); leaf.castShadow = true; g.add(leaf);
  }
}
function plantTall(g, x, z) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.5, 24), std(COL.terracotta, 0.8)); pot.position.set(x, 0.25, z); pot.castShadow = true; g.add(pot);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.5, 8), std(0x7a5a3c)); trunk.position.set(x, 1.2, z); g.add(trunk);
  for (let i = 0; i < 26; i++) {
    const h = 1.0 + rng() * 0.95, a = rng() * Math.PI * 2, r = 0.12 + rng() * 0.28;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: COL.green[i % 4], roughness: 0.5 }));
    leaf.scale.set(1, 0.12, 0.75); leaf.position.set(x + Math.cos(a) * r, h, z + Math.sin(a) * r); leaf.rotation.set(rng() - 0.5, rng() * 6, rng() - 0.5); leaf.castShadow = true; g.add(leaf);
  }
}
function succulent(g, x, y, z, s = 1) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.05 * s, 0.08 * s, 16), std(0xffffff, 0.5)); pot.position.set(x, y + 0.04 * s, z); g.add(pot);
  for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 10, 8), std(0x7fb98a, 0.6)); l.scale.set(0.6, 1.4, 0.6); const a = i * 0.9; l.position.set(x + Math.cos(a) * 0.025 * s, y + 0.1 * s, z + Math.sin(a) * 0.025 * s); l.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); g.add(l); }
}
function pothos(g, x, y, z, s = 1, vines = 5, len = 0.5) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * s, 0.06 * s, 0.11 * s, 18), std(0xf1ece4, 0.6));
  pot.position.set(x, y + 0.055 * s, z); pot.castShadow = true; g.add(pot);
  const leafG = new THREE.SphereGeometry(0.034 * s, 10, 6), mats = COL.green.map((c) => std(c, 0.55));
  for (let i = 0; i < 10; i++) {
    const a = i * 0.68 + rng(), l = new THREE.Mesh(leafG, mats[i % 4]); l.scale.set(1, 0.35, 0.8);
    l.position.set(x + Math.cos(a) * 0.055 * s, y + 0.13 * s + rng() * 0.04, z + Math.sin(a) * 0.055 * s); l.rotation.set(rng() - 0.5, a, rng() - 0.5); l.castShadow = true; g.add(l);
  }
  // vines spill over the shelf's front edge and hang down
  for (let v = 0; v < vines; v++) {
    const ox = (v - (vines - 1) / 2) * 0.05 * s, n = Math.round((len * (0.55 + rng() * 0.6)) / 0.042);
    for (let k = 0; k < n; k++) {
      const l = new THREE.Mesh(leafG, mats[(v + k) % 4]); l.scale.set(0.85, 0.3, 0.72);
      l.position.set(x + ox + Math.sin(k * 0.8 + v * 1.7) * 0.022, y + 0.09 * s - k * 0.042, z + 0.14 + Math.min(k, 3) * 0.012);
      l.rotation.set(1.15 + rng() * 0.35, rng() * 0.6 - 0.3, k % 2 ? 0.55 : -0.55); g.add(l);
    }
  }
}
function chair(g, x, z, rot) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rot; g.add(c);
  const wood = std(COL.oak, 0.55), metal = std(0x2b2e33, 0.4, 0.6);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.05, 0.42, 3, 0.02), wood); seat.position.y = 0.46; seat.castShadow = true; c.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.26, 0.035, 3, 0.015), wood); back.position.set(0, 0.74, -0.2); back.castShadow = true; c.add(back);
  for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.46, 8), metal); l.position.set(lx, 0.23, lz); c.add(l); }
  for (const lx of [-0.18, 0.18]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), metal); l.position.set(lx, 0.63, -0.2); c.add(l); }
}
function table(g, x, z) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 40), std(0xf5f3ef, 0.3)); top.position.set(x, 0.74, z); top.castShadow = top.receiveShadow = true; g.add(top);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 12), std(0x2b2e33, 0.4, 0.6)); ped.position.set(x, 0.37, z); g.add(ped);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 24), std(0x2b2e33, 0.4, 0.6)); base.position.set(x, 0.015, z); g.add(base);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.085, 20), std(0xffffff, 0.3)); cup.position.set(x + 0.1, 0.8, z - 0.05); g.add(cup);
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.01, 24), std(0xffffff, 0.3)); saucer.position.set(x + 0.1, 0.762, z - 0.05); g.add(saucer);
}

export function buildCafe2(stand) {
  const g = new THREE.Group();
  // shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.62 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -0.2; floor.receiveShadow = true; g.add(floor);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.4), std(COL.sage, 0.9)); backWall.position.set(0, 1.7, -5); backWall.receiveShadow = true; g.add(backWall);
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.15), new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.35 })); tiles.position.set(0.3, 1.5, -4.99); tiles.receiveShadow = true; g.add(tiles);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.4), std(COL.wall, 0.9)); w.position.set(sx * 6, 1.7, -0.2); w.rotation.y = -sx * Math.PI / 2; w.receiveShadow = true; g.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), std(0xfbf8f2)); ceil.position.set(0, 3.4, -0.2); ceil.rotation.x = Math.PI / 2; g.add(ceil);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 0.02), std(0xe8e1d6)); skirt.position.set(0, 0.05, -4.98); g.add(skirt);
  // window (left wall) with mullions
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.7), new THREE.MeshBasicMaterial({ color: 0xeef6ff })); pane.position.set(-5.98, 1.85, -1.2); pane.rotation.y = Math.PI / 2; g.add(pane);
  const fr = std(0x2f3337, 0.5);
  for (const zz of [-2.8, -1.2, 0.4]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.76, 0.05), fr); m.position.set(-5.95, 1.85, zz); g.add(m); }
  for (const yy of [1.0, 2.7]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 3.25), fr); m.position.set(-5.95, yy, -1.2); g.add(m); }
  // ── front counter: oak slats + quartz top
  const cx0 = -1.9, cx1 = 3.1, cz = -2.15, cd = 0.75, ch = 1.05;
  const body = new THREE.Mesh(new THREE.BoxGeometry(cx1 - cx0, ch, cd), std(0x8a6a4a, 0.8)); body.position.set((cx0 + cx1) / 2, ch / 2, cz); body.castShadow = body.receiveShadow = true; g.add(body);
  const nS = Math.floor((cx1 - cx0) / 0.075);
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.058, ch - 0.12, 0.03), std(COL.oak, 0.55), nS);
  const mx = new THREE.Matrix4(), c3 = new THREE.Color();
  for (let i = 0; i < nS; i++) { mx.makeTranslation(cx0 + 0.04 + i * 0.075, (ch - 0.12) / 2 + 0.1, cz + cd / 2 + 0.016); slats.setMatrixAt(i, mx); slats.setColorAt(i, c3.setHex(i % 3 ? COL.oak : 0xd3ad82)); }
  slats.castShadow = slats.receiveShadow = true; g.add(slats);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(cx1 - cx0, 0.1, 0.02), std(0x3b3f45)); kick.position.set((cx0 + cx1) / 2, 0.05, cz + cd / 2 + 0.005); g.add(kick);
  const top = new THREE.Mesh(new RoundedBoxGeometry(cx1 - cx0 + 0.1, 0.05, cd + 0.08, 2, 0.012), std(COL.quartz, 0.28)); top.position.set((cx0 + cx1) / 2, ch + 0.025, cz + 0.02); top.castShadow = top.receiveShadow = true; g.add(top);
  // ── back counter + cabinets
  const bc = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.92, 0.6), std(0xf3efe8, 0.6)); bc.position.set(0.3, 0.46, -4.68); bc.castShadow = bc.receiveShadow = true; g.add(bc);
  for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.8, 0.01), std(0xece6dc, 0.55)); d.position.set(-2.2 + i * 1.0, 0.46, -4.375); g.add(d); const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.02), std(COL.brass, 0.35, 0.8)); hnd.position.set(-2.2 + i * 1.0, 0.8, -4.36); g.add(hnd); }
  const bct = new THREE.Mesh(new RoundedBoxGeometry(6.08, 0.04, 0.64, 2, 0.01), std(COL.quartz, 0.28)); bct.position.set(0.3, 0.94, -4.68); bct.receiveShadow = true; g.add(bct);
  // ── espresso machine on the back counter (facing the room)
  const steel = std(COL.steel, 0.22, 0.85), black = std(0x1f2124, 0.35, 0.2), chrome = std(0xe9ecef, 0.12, 0.95);
  const em = new THREE.Group(); em.position.set(-1.0, 0.96, -4.6); g.add(em);
  const emB = new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.5, 0.55, 3, 0.04), steel); emB.position.y = 0.25; emB.castShadow = true; em.add(emB);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.07, 0.01), std(COL.lemon, 0.5)); band.position.set(0, 0.42, 0.276); em.add(band);
  for (const gx of [-0.25, 0.25]) {
    const gh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 20), chrome); gh.position.set(gx, 0.22, 0.31); gh.rotation.x = Math.PI / 2; em.add(gh);
    const pf = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.05, 20), chrome); pf.position.set(gx, 0.17, 0.33); em.add(pf);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.2, 12), black); hd.position.set(gx, 0.17, 0.44); hd.rotation.x = Math.PI / 2; em.add(hd);
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 24), std(0xffffff, 0.3)); gauge.position.set(gx * 0.6, 0.34, 0.28); gauge.rotation.x = Math.PI / 2; em.add(gauge);
  }
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.2), black); tray.position.set(0, 0.012, 0.34); em.add(tray);
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8), chrome); wand.position.set(0.46, 0.2, 0.33); wand.rotation.z = 0.25; em.add(wand);
  for (let i = 0; i < 6; i++) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.07, 16), std(i % 2 ? 0xffffff : COL.lemon, 0.35)); cup.position.set(-0.35 + i * 0.14, 0.535, 0); em.add(cup); }
  // grinder
  const grB = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.36, 0.26, 2, 0.02), black); grB.position.set(-0.15, 0.96 + 0.18, -4.6); grB.castShadow = true; g.add(grB);
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.22, 20), new THREE.MeshPhysicalMaterial({ color: 0x6b4a2e, roughness: 0.15, transparent: true, opacity: 0.85 })); hop.position.set(-0.15, 0.96 + 0.47, -4.6); g.add(hop);
  // cup stack + coffee bags on the back counter
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.07, 16), std(0xffffff, 0.3)); c.position.set(0.4, 0.99 + i * 0.05, -4.55); g.add(c); }
  // ── menu board (designed) with oak frame
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: menuTex(), roughness: 0.85 })); menu.position.set(-0.2, 2.62, -4.98); g.add(menu);
  const mf = std(COL.oakDark, 0.6);
  for (const [w, h, x, y] of [[2.7, 0.05, -0.2, 3.295], [2.7, 0.05, -0.2, 1.945], [0.05, 1.4, -1.55, 2.62], [0.05, 1.4, 1.15, 2.62]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), mf); f.position.set(x, y, -4.97); g.add(f); }
  // ── shelves (right side of the back wall): jars, coffee bags, books, small plants
  const shelfM = std(COL.oak, 0.55);
  for (const sy of [1.95, 2.5]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.26), shelfM); sh.position.set(2.45, sy, -4.86); sh.castShadow = true; g.add(sh);
  }
  for (let i = 0; i < 5; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 18), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transparent: true, opacity: 0.35 }));
    jar.position.set(1.65 + i * 0.2, 2.07, -4.85); g.add(jar);
    const beans = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.13, 18), std(0x5b3a22, 0.8)); beans.position.set(1.65 + i * 0.2, 2.035, -4.85); g.add(beans);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.02, 18), std(COL.oak, 0.5)); lid.position.set(1.65 + i * 0.2, 2.18, -4.85); g.add(lid);
  }
  const bagM = new THREE.MeshStandardMaterial({ map: bagTex('לימון'), roughness: 0.85 });
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.08), [std(0xc8a27a), std(0xc8a27a), std(0xc8a27a), std(0xc8a27a), bagM, std(0xc8a27a)]); b.position.set(1.7 + i * 0.2, 2.64, -4.84); b.castShadow = true; g.add(b); }
  const bookC = [0x3d6b8f, 0xd27c5a, 0x6f9a6a, 0xe8c766, 0x8a6f9e, 0x2f3337];
  for (let i = 0; i < 7; i++) { const bk = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22 + (i % 3) * 0.025, 0.17), std(bookC[i % bookC.length], 0.7)); bk.position.set(2.45 + i * 0.05, 2.63 + (i % 3) * 0.012, -4.85); g.add(bk); }
  pothos(g, 3.2, 2.52, -4.85, 1.25, 6, 0.6); succulent(g, 2.78, 1.97, -4.85, 1.3);
  // ── pastry case on the front counter
  const pc = new THREE.Group(); pc.position.set(2.35, 1.1, -2.2); g.add(pc);
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.18 });
  const gbox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 0.6), glassM); gbox.position.y = 0.21; pc.add(gbox);
  const pcf = std(0x2f3337, 0.4, 0.5);
  for (const [w, h, d, x, y, z] of [[1.17, 0.02, 0.62, 0, 0.42, 0], [1.17, 0.03, 0.62, 0, 0.015, 0], [0.02, 0.42, 0.02, 0.575, 0.21, 0.3], [0.02, 0.42, 0.02, -0.575, 0.21, 0.3]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pcf); f.position.set(x, y, z); pc.add(f); }
  const shelfG = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.01, 0.56), glassM); shelfG.position.y = 0.21; pc.add(shelfG);
  const crust = std(0xd9a45b, 0.65), choc = std(0x6b4226, 0.7), muffinT = std(0xc98d4e, 0.75);
  for (let i = 0; i < 4; i++) { const cr = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.03, 10, 16, Math.PI * 1.25), crust); cr.rotation.set(-Math.PI / 2, 0, i); cr.position.set(-0.4 + i * 0.26, 0.06, 0.08); cr.castShadow = true; pc.add(cr); }
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.05, 16), std(0xf2e6d4, 0.7)); m.position.set(-0.4 + i * 0.26, 0.245, 0.05); pc.add(m); const t = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), i % 2 ? choc : muffinT); t.scale.y = 0.6; t.position.set(-0.4 + i * 0.26, 0.285, 0.05); t.castShadow = true; pc.add(t); }
  // POS tablet + small plant + napkin box on the front counter
  const pos = new THREE.Group(); pos.position.set(-1.35, 1.1, -2.25); pos.rotation.y = 0.35; g.add(pos);
  const st1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.02, 20), std(0xe9ecef, 0.3, 0.6)); pos.add(st1);
  const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), std(0xe9ecef, 0.3, 0.6)); st2.position.y = 0.08; pos.add(st2);
  const tab = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.21, 0.014, 2, 0.01), std(0x1f2124, 0.3)); tab.position.set(0, 0.2, 0); tab.rotation.x = -0.35; pos.add(tab);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.18), new THREE.MeshBasicMaterial({ map: canvasTex(270, 180, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8f0fe'; x.fillRect(0, 0, w, 40); x.fillStyle = '#1a73e8'; x.fillRect(150, 120, 100, 40); x.fillStyle = '#dadce0'; for (let i = 0; i < 3; i++) x.fillRect(20, 60 + i * 30, 110, 14); }) }));
  scr.position.set(0, 0.2, 0.008); scr.rotation.x = -0.35; pos.add(scr);
  succulent(g, 0.05, 1.1, -2.0, 1.3);
  // ── pendant lamps over the counter
  for (const lx of [-0.75, 0.7, 2.15]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.8, 6), std(0x222222)); cord.position.set(lx, 3.0, -2.15); g.add(cord);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: COL.charcoal, roughness: 0.45, side: THREE.DoubleSide }));
    dome.position.set(lx, 2.6, -2.15); g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 8, 40), std(COL.brass, 0.3, 0.9)); rim.rotation.x = Math.PI / 2; rim.position.set(lx, 2.6, -2.15); g.add(rim);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe9bd })); bulb.position.set(lx, 2.56, -2.15); g.add(bulb);
    const pl = new THREE.PointLight(0xffd59a, 3.2, 5, 1.8); pl.position.set(lx, 2.5, -2.15); g.add(pl);
  }
  // ── seating corner (left): bench with lemon cushions, tables + chairs, art, plants
  const bench = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.45, 3.0, 2, 0.02), std(COL.oak, 0.55)); bench.position.set(-5.7, 0.225, -1.0); bench.castShadow = bench.receiveShadow = true; g.add(bench);
  for (let i = 0; i < 4; i++) { const cu = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.1, 0.66, 3, 0.04), std(i % 2 ? COL.lemon : 0xf3eee4, 0.9)); cu.position.set(-5.7, 0.5, -2.2 + i * 0.75); cu.castShadow = true; g.add(cu); }
  table(g, -4.85, -1.9); table(g, -4.85, -0.1);
  chair(g, -4.2, -1.9, -Math.PI / 2); chair(g, -4.2, -0.1, -Math.PI / 2);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.88), new THREE.MeshStandardMaterial({ map: printTex(), roughness: 0.8 })); art.position.set(-5.97, 2.0, 1.4); art.rotation.y = Math.PI / 2; g.add(art);
  const artF = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.96, 0.78), std(COL.oakDark)); artF.position.set(-5.985, 2.0, 1.4); g.add(artF);
  plantMonstera(g, -5.4, -3.9, 1.1);
  // tables between the door and the counter (they slide past the frame edges as we walk in)
  table(g, -0.72, 1.25); chair(g, -1.34, 1.25, Math.PI / 2); chair(g, -0.1, 1.25, -Math.PI / 2);
  table(g, 1.78, 0.85); chair(g, 1.78, 0.23, 0); chair(g, 1.78, 1.47, Math.PI);
  // plants flanking the counter
  plantMonstera(g, -2.3, -1.4, 1.3);
  plantMonstera(g, 0.95, -4.6, 0.55, 0.96);   // leafy pot on the back counter
  plantTall(g, 3.72, -2.25);
  plantTall(g, 4.9, -4.2);
  plantMonstera(g, 5.1, 0.8, 0.9);
  // hanging plant by the window
  const hp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.18, 20), std(0xffffff, 0.5)); hp.position.set(-5.2, 2.55, 0.6); g.add(hp);
  for (const ccx of [-0.06, 0.06]) { const cd2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.8, 4), std(0x8a7a66)); cd2.position.set(-5.2 + ccx, 3.0, 0.6); g.add(cd2); }
  for (let v = 0; v < 6; v++) for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std(COL.green[(v + k) % 4], 0.6)); const a = v * 1.05; l.position.set(-5.2 + Math.cos(a) * 0.12, 2.5 - k * 0.09, 0.6 + Math.sin(a) * 0.12); l.scale.set(1, 0.6, 1); g.add(l); }
  // ── door frame (we enter from just behind it)
  const frameM = std(0x2f3337, 0.5);
  for (const fx of [-1.05, 1.05]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.18), frameM); f.position.set(fx + 0.4, 1.3, 4.6); g.add(f); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.18), frameM); lintel.position.set(0.4, 2.62, 4.6); g.add(lintel);
  const fwM = std(0xf6f1e9, 0.9);
  for (const sx of [-1, 1]) { const fw = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), fwM); fw.position.set(0.4 + sx * 3.6, 1.7, 4.62); fw.rotation.y = Math.PI; g.add(fw); }
  const fwTop = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.8), fwM); fwTop.position.set(0.4, 3.0, 4.62); fwTop.rotation.y = Math.PI; g.add(fwTop);
  // ── the NFC stand on the counter, facing the door (stylised 2.6× so it reads on screen)
  stand.scale.setScalar(0.026);
  stand.position.set(1.15, 1.105, -1.83);
  stand.rotation.y = -0.22;
  g.add(stand);
  return g;
}
