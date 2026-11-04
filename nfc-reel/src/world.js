// ─────────────────────────────────────────────────────────────────────────────
// world.js — the 3D world for the reel (three.js): a soft, low-poly street in
// the style of Google Maps 3D, a café interior, the real-proportioned acrylic
// stand, and customers shown as Google-Maps blue location dots.
// Everything is built once; poses are set per frame by the timeline.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from '../node_modules/three/build/three.module.js';

export const W = 1080, H = 1920;
const PAL = {
  ground: 0xeceef2, road: 0xd9dde3, walk: 0xf6f7f9, line: 0xffffff,
  park: 0xcfe9c6, tree: 0x86c98a, tree2: 0x6fb874, trunk: 0xb9a48c,
  pastel: [0xf3e3cf, 0xf6d5d8, 0xd9e8f3, 0xdff0e4, 0xe8e0f3, 0xf7ecd2, 0xe2e6ec, 0xf1dccb],
  blue: 0x4285f4,
};

// ── Canvas texture helpers ───────────────────────────────────────────────────
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function facadeTex(color) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(70,82,104,0.38)';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) x.fillRect(38 + c * 128, 40 + r * 128, 52, 64);
    x.fillStyle = 'rgba(255,255,255,0.35)';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) x.fillRect(38 + c * 128, 104 + r * 128, 52, 5);
  });
}
function signTex(text, bg, fg) {
  return canvasTex(1024, 256, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.font = '600 120px Rubik'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillText(text, w / 2, h / 2 + 6);
  });
}
function woodTex() {
  return canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) {
      const v = 180 + ((i * 37) % 30);
      x.fillStyle = `rgb(${v},${v - 40},${v - 85})`; x.fillRect(0, (i * h) / 8, w, h / 8);
      x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, (i * h) / 8, w, 2);
    }
  }, [4, 4]);
}

// ── Stand (real proportions, cm) ─────────────────────────────────────────────
export function buildStand(printCanvas) {
  const Wd = 10, Ht = 15.5, T = 0.3, tilt = THREE.MathUtils.degToRad(16), depth = 7, bendR = 0.25, rC = 0.5, rFoot = 0.8;
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xf7f8fa, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const g = new THREE.Group();
  const R = bendR + T / 2, phi = Math.PI / 2 + tilt, c = { y: T / 2 + R, z: 0 };
  const at = (th, r = R) => ({ y: c.y - r * Math.cos(th), z: c.z + r * Math.sin(th) });
  // foot (rounded at the back), lying flat and running backward
  const fs = new THREE.Shape();
  fs.moveTo(-Wd / 2, 0); fs.lineTo(Wd / 2, 0); fs.lineTo(Wd / 2, depth - rFoot); fs.quadraticCurveTo(Wd / 2, depth, Wd / 2 - rFoot, depth);
  fs.lineTo(-Wd / 2 + rFoot, depth); fs.quadraticCurveTo(-Wd / 2, depth, -Wd / 2, depth - rFoot); fs.closePath();
  const foot = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: T, bevelEnabled: false, curveSegments: 16 }), acrylic);
  foot.rotation.x = -Math.PI / 2; foot.castShadow = foot.receiveShadow = true; g.add(foot);
  // bend: annular sector extruded across the width
  const bs = new THREE.Shape(), N = 40;
  for (let i = 0; i <= N; i++) { const p = at((i / N) * phi, R + T / 2); i ? bs.lineTo(p.z, p.y) : bs.moveTo(p.z, p.y); }
  for (let i = N; i >= 0; i--) { const p = at((i / N) * phi, R - T / 2); bs.lineTo(p.z, p.y); }
  const bend = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: Wd, bevelEnabled: false }), acrylic);
  bend.rotation.y = -Math.PI / 2; bend.position.x = Wd / 2; bend.castShadow = true; g.add(bend);
  // face panel
  const P = at(phi);
  const panel = new THREE.Group(); panel.position.set(0, P.y, P.z); panel.rotation.x = -tilt; g.add(panel);
  const ps = new THREE.Shape();
  ps.moveTo(-Wd / 2, 0); ps.lineTo(Wd / 2, 0); ps.lineTo(Wd / 2, Ht - rC); ps.quadraticCurveTo(Wd / 2, Ht, Wd / 2 - rC, Ht);
  ps.lineTo(-Wd / 2 + rC, Ht); ps.quadraticCurveTo(-Wd / 2, Ht, -Wd / 2, Ht - rC); ps.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: T, bevelEnabled: false, curveSegments: 16 }), acrylic);
  body.position.z = -T / 2; body.castShadow = body.receiveShadow = true; panel.add(body);
  const pg = new THREE.ShapeGeometry(ps, 16), uv = pg.attributes.uv, pos = pg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + Wd / 2) / Wd, pos.getY(i) / Ht);
  const tex = new THREE.CanvasTexture(printCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  const print = new THREE.Mesh(pg, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }));
  print.position.z = T / 2 + 0.004; panel.add(print);
  g.userData = { panel, Wd, Ht, badgeLocal: new THREE.Vector3(0, Ht * (1 - 0.552), T / 2) };
  return g;
}

// ── Blue location dot (customer) ─────────────────────────────────────────────
export function buildDot(scale = 1) {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ color: PAL.blue, transparent: true, opacity: 0.16, depthWrite: false }));
  const beamTex = canvasTex(256, 256, (x, w, h) => {
    const gr = x.createRadialGradient(w / 2, h, 0, w / 2, h, h);
    gr.addColorStop(0, 'rgba(66,133,244,0.55)'); gr.addColorStop(1, 'rgba(66,133,244,0)');
    x.fillStyle = gr; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w * 0.12, 0); x.lineTo(w * 0.88, 0); x.closePath(); x.fill();
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false }));
  beam.position.set(0, 0.02, 1.3); beam.rotation.x = -Math.PI / 2; beam.rotation.z = Math.PI;
  const white = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  const blue = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.16, 48), new THREE.MeshStandardMaterial({ color: PAL.blue, roughness: 0.35, emissive: 0x1a4fd8, emissiveIntensity: 0.25 }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.01;
  white.position.y = 0.08; blue.position.y = 0.1; white.castShadow = true;
  g.add(halo, beam, white, blue);
  g.scale.setScalar(scale);
  g.userData = { halo, beam };
  return g;
}

// ── Street (meters) ──────────────────────────────────────────────────────────
export function buildStreet(stores) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(PAL.ground));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 9), mat(PAL.road)); road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true; g.add(road);
  for (let x = -96; x < 100; x += 6) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.22), mat(PAL.line)); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.02, 0); g.add(d);
  }
  // cross street
  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 200), mat(PAL.road)); road2.rotation.x = -Math.PI / 2; road2.position.set(-34, 0.011, 0); road2.receiveShadow = true; g.add(road2);
  for (const z of [-6, 6]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(200, 0.18, 3), mat(PAL.walk)); w.position.set(0, 0.09, z); w.receiveShadow = true; g.add(w);
  }
  // north buildings with shopfronts
  let x = -80;
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const storeMap = Object.fromEntries(stores.map((s) => [s.slot, s]));
  let slot = 0;
  while (x < 80) {
    const w = 7 + Math.floor(rnd() * 3), h = 9 + Math.floor(rnd() * 14), d = 11;
    const color = PAL.pastel[slot % PAL.pastel.length];
    const facade = facadeTex(color);
    facade.wrapS = facade.wrapT = THREE.RepeatWrapping; facade.repeat.set(w / 3.2, (h - 3.4) / 3.2);
    const side = mat(color);
    const front = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.9 });
    const top = mat(0xf2f3f5);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, h - 3.4, d), [side, side, top, side, front, side]);
    b.position.set(x + w / 2, 3.4 + (h - 3.4) / 2, -7.5 - d / 2); b.castShadow = b.receiveShadow = true; g.add(b);
    // ground floor shop
    const st = storeMap[slot];
    const shopCol = st ? st.color : PAL.pastel[(slot + 3) % PAL.pastel.length];
    const base = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 3.4, d), mat(shopCol)); base.position.set(x + w / 2, 1.7, -7.5 - d / 2); base.castShadow = base.receiveShadow = true; g.add(base);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 2.2, 2.2), new THREE.MeshStandardMaterial({ color: st ? 0x5b6b80 : 0x7d8796, roughness: 0.2, metalness: 0.1, emissive: st ? 0xffc98a : 0x000000, emissiveIntensity: st ? 0.18 : 0 }));
    glass.position.set(x + w / 2, 1.45, -7.49); g.add(glass);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w - 1.2, 0.18, 1.3), mat(st ? st.awning : 0xc9ced6)); awn.position.set(x + w / 2, 2.85, -6.85); awn.castShadow = true; g.add(awn);
    if (st) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, (w - 2) / 4), new THREE.MeshBasicMaterial({ map: signTex(st.name, st.signBg, st.signFg) }));
      sign.position.set(x + w / 2, 3.45 + (w - 2) / 8, -7.48); g.add(sign);
      st.door = new THREE.Vector3(x + w / 2, 0, -7.5); st.top = new THREE.Vector3(x + w / 2, h + 0.5, -12);
    }
    x += w; slot++;
  }
  // south side: low buildings + park
  for (let i = 0; i < 10; i++) {
    const w = 9, h = 5 + (i % 3) * 3, bx = -80 + i * 16;
    if (i === 5 || i === 6) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 9), mat(PAL.pastel[(i + 2) % PAL.pastel.length])); b.position.set(bx, h / 2, 13); b.castShadow = b.receiveShadow = true; g.add(b);
  }
  const park = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), mat(PAL.park)); park.rotation.x = -Math.PI / 2; park.position.set(8, 0.03, 14.5); park.receiveShadow = true; g.add(park);
  // trees
  const crown = new THREE.IcosahedronGeometry(1.2, 1), trunk = new THREE.CylinderGeometry(0.14, 0.18, 1.4, 8);
  const addTree = (tx, tz, s = 1, c = PAL.tree) => {
    const t = new THREE.Mesh(trunk, mat(PAL.trunk)); t.position.set(tx, 0.7 * s, tz); t.scale.setScalar(s); t.castShadow = true; g.add(t);
    const k = new THREE.Mesh(crown, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true })); k.position.set(tx, 1.9 * s, tz); k.scale.setScalar(s); k.castShadow = true; g.add(k);
  };
  for (let tx = -76; tx < 80; tx += 9) addTree(tx + 2, 7.1, 0.9);
  for (let i = 0; i < 14; i++) addTree(-4 + (i % 5) * 6 + (i % 2), 10 + Math.floor(i / 5) * 4, 1.1 + (i % 3) * 0.2, i % 2 ? PAL.tree : PAL.tree2);
  // a few cars
  const car = (cx, cz, c) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.0, 1.8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
    body.position.set(cx, 0.65, cz); body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.6), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.2 }));
    cab.position.set(cx - 0.2, 1.45, cz); cab.castShadow = true; g.add(cab);
  };
  car(-22, -2.2, 0xffffff); car(14, 2.2, 0xe57373); car(36, -2.2, 0x90a4ae);
  return g;
}

// ── Café interior (meters) ───────────────────────────────────────────────────
export function buildCafe(stand) {
  const g = new THREE.Group();
  const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const wallM = mat(0xf4ece0);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), wallM); back.position.set(0, 2, -5); back.receiveShadow = true; g.add(back);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), wallM); w.position.set(sx * 6, 2, 1); w.rotation.y = -sx * Math.PI / 2; w.receiveShadow = true; g.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mat(0xfaf6ef)); ceil.position.y = 4; ceil.rotation.x = Math.PI / 2; g.add(ceil);
  // counter
  const ctr = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.05, 0.9), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.6 }));
  ctr.position.set(0.6, 0.525, -2.2); ctr.castShadow = ctr.receiveShadow = true; g.add(ctr);
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.06, 1.0), mat(0xffffff, 0.35)); top.position.set(0.6, 1.08, -2.2); top.castShadow = top.receiveShadow = true; g.add(top);
  // espresso machine + grinder + cups
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.25, metalness: 0.8 });
  const em = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.5), metal); em.position.set(-1.3, 1.385, -2.35); em.castShadow = true; g.add(em);
  const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.5, 16), mat(0x2e2f33, 0.4)); gr.position.set(-0.6, 1.36, -2.35); gr.castShadow = true; g.add(gr);
  for (let i = 0; i < 3; i++) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 16), mat(0xffffff, 0.3)); cup.position.set(-1.55 + i * 0.16, 1.16, -1.95); g.add(cup); }
  // pastry display
  const disp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.0, roughness: 0.05, transparent: true, opacity: 0.35 }));
  disp.position.set(2.4, 1.31, -2.2); g.add(disp);
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat(0xd9a45b, 0.7)); p.scale.y = 0.55; p.position.set(2.0 + i * 0.27, 1.15, -2.2); g.add(p); }
  // shelves + jars on back wall
  for (let r = 0; r < 2; r++) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.3), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.6 })); sh.position.set(-1.2, 2.0 + r * 0.6, -4.85); sh.castShadow = true; g.add(sh);
    for (let i = 0; i < 7; i++) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 12), mat([0xe7c79b, 0x9ccf9a, 0xf2a7a7, 0xa9c4ef][(i + r) % 4], 0.5)); j.position.set(-2.7 + i * 0.5, 2.15 + r * 0.6, -4.82); j.castShadow = true; g.add(j); }
  }
  // menu board
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.1), new THREE.MeshBasicMaterial({ map: canvasTex(800, 440, (x, w, h) => {
    x.fillStyle = '#2b2f33'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f3efe6'; x.font = '700 64px Rubik'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('קפה לימון', w / 2, 90);
    x.font = '400 40px Rubik'; x.globalAlpha = 0.8;
    ['אספרסו ............ 9', 'הפוך ............ 14', 'קרואסון ............ 12'].forEach((l, i) => x.fillText(l, w / 2, 190 + i * 70));
  }) }));
  menu.position.set(2.2, 2.6, -4.95); g.add(menu);
  // pendant lamps
  for (const lx of [-1.0, 0.6, 2.2]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.1, 6), mat(0x222222)); cord.position.set(lx, 3.45, -2.2); g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2e2f33, roughness: 0.5, side: THREE.DoubleSide })); shade.position.set(lx, 2.82, -2.2); g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe6b0 })); bulb.position.set(lx, 2.72, -2.2); g.add(bulb);
    const pl = new THREE.PointLight(0xffc98a, 6, 6, 1.6); pl.position.set(lx, 2.6, -2.2); g.add(pl);
  }
  // plants
  for (const [px, pz] of [[-4.8, -4.2], [4.8, -4.2]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 16), mat(0xe7e2d9)); pot.position.set(px, 0.25, pz); pot.castShadow = true; g.add(pot);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: PAL.tree2, flatShading: true, roughness: 0.8 })); leaf.position.set(px, 0.95, pz); leaf.castShadow = true; g.add(leaf);
  }
  // door frame (we look in from just behind it)
  const frameM = mat(0x3b3f45, 0.5);
  for (const fx of [-1.05, 1.05]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.2), frameM); f.position.set(fx, 1.3, 4.6); g.add(f); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.2), frameM); lintel.position.set(0, 2.62, 4.6); g.add(lintel);
  const frontWallM = mat(0xf7d9a8);
  for (const sx of [-1, 1]) { const fw = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), frontWallM); fw.position.set(sx * 3.6, 2, 4.62); fw.rotation.y = Math.PI; g.add(fw); }
  const fwTop = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), frontWallM); fwTop.position.set(0, 3.3, 4.62); fwTop.rotation.y = Math.PI; g.add(fwTop);
  // the stand on the counter, facing the door (stylised 1.8× so it reads on screen)
  stand.scale.setScalar(0.026);
  stand.position.set(1.15, 1.11, -1.8);
  stand.rotation.y = -0.22;
  g.add(stand);
  return g;
}

export function lights(scene, area = 80) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3ea, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-30, 60, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -area, right: area, top: area, bottom: -area, near: 1, far: 220 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun);
  return sun;
}

export { THREE };
