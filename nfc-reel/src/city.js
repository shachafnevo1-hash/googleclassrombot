// ─────────────────────────────────────────────────────────────────────────────
// city.js — a dense, lively low-poly city in the Google-Maps-3D style:
// a full street grid with blocks of buildings in every direction, procedural
// windows and storefronts (shader), cars/buses on every road, parked cars,
// trees, parks, a round plaza, crosswalks, rooftop solar water heaters, and
// the hero shopping street (bakery + Café Limon) with Hebrew signs.
// Deterministic (seeded); heavy parts use InstancedMesh.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from '../node_modules/three/build/three.module.js';
import { mergeGeometries } from '../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';

const rngOf = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const C = {
  road: 0xd5d9df, walk: 0xf3f4f6, block: 0xeceef1, line: 0xffffff,
  park: 0xcde8c2, path: 0xf1ebdf, plaza: 0xf2efe9, water: 0x8fc3ef,
  trees: [0x8cc985, 0x7dbe7a, 0x9dd292, 0x6fb572, 0x86c47c],
  bld: [0xeeebe6, 0xe6e8ec, 0xf1eee9, 0xe2e5ea, 0xebe7e1, 0xe9ecef],
  pastel: [0xf4e2cd, 0xf6d6d9, 0xd8e7f3, 0xdcefe2, 0xe7dff3, 0xf7ebcf, 0xf1dccb, 0xd9ecec],
  cars: [0xffffff, 0xf4f4f4, 0xc9ced6, 0xa7adb6, 0x55606e, 0x2f3540, 0xe05a4f, 0x4f7fd8, 0xf2c94c, 0x7a8b99, 0xffffff, 0xd6dbe1],
};

// Building material: shader-driven windows (world-space grid), storefront glass at
// street level, soft darkening near the ground (fake AO) and slightly brighter roofs.
export function buildingMaterial(storefront = true) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wpp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpp = instanceMatrix * wpp;
        #endif
        wpp = modelMatrix * wpp; vWP = wpp.xyz;
        vec3 wnn = objectNormal;
        #ifdef USE_INSTANCING
          wnn = mat3(instanceMatrix) * wnn;
        #endif
        vWN = normalize(mat3(modelMatrix) * wnn);`);
    sh.fragmentShader = (storefront ? '#define STOREFRONT\n' : '') + sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float vert = 1.0 - step(0.5, abs(vWN.y));
          vec2 tg = normalize(vec2(-vWN.z, vWN.x) + vec2(1e-5));
          float u = dot(vWP.xz, tg);
          float fu = fract(u / 3.2 + 0.5), fv = fract(vWP.y / 3.3);
          float aw = fwidth(u / 3.2) * 1.2 + 0.015, av = fwidth(vWP.y / 3.3) * 1.2 + 0.015;
          float win = smoothstep(0.24 - aw, 0.24 + aw, fu) * (1.0 - smoothstep(0.76 - aw, 0.76 + aw, fu))
                    * smoothstep(0.30 - av, 0.30 + av, fv) * (1.0 - smoothstep(0.80 - av, 0.80 + av, fv))
                    * step(3.7, vWP.y);
          float far = 1.0 - smoothstep(220.0, 420.0, distance(vWP, cameraPosition));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.50, 0.58, 0.69), win * 0.40 * vert * far);
          #ifdef STOREFRONT
            float fs = fract(u / 5.0);
            float sf = vert * step(0.45, vWP.y) * (1.0 - step(2.9, vWP.y))
                     * smoothstep(0.08, 0.12, fs) * (1.0 - smoothstep(0.88, 0.92, fs));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.44, 0.52), sf * 0.72);
            float band = vert * step(2.95, vWP.y) * (1.0 - step(3.45, vWP.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.86, band);
          #endif
          diffuseColor.rgb *= mix(1.0, mix(0.80, 1.0, smoothstep(0.0, 7.0, vWP.y)), vert);
          diffuseColor.rgb *= mix(1.0, 1.05, step(0.6, vWN.y));
        }`);
  };
  m.customProgramCacheKey = () => 'bld-' + (storefront ? 's' : 'n');
  return m;
}

function signTex(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 256);
  x.fillStyle = fg; x.font = '700 124px Rubik'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.fillText(text, 512, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ── Layout ─────────────────────────────────────────────────────────────────
// E-W roads (z) and N-S roads (x). The main shopping street is the E-W road at z = 0.
export const ROADS_EW = [-250, -186, -124, -62, 0, 58, 120, 182, 244].map((z) => ({ z, w: z === 0 ? 12 : 10 }));
export const ROADS_NS = [-330, -270, -210, -150, -90, -30, 30, 90, 150, 210, 270, 330].map((x) => ({ x, w: 10 }));
const EXT = { x0: -380, x1: 380, z0: -300, z1: 300 };
export const HERO = { walkZ: -7.4, frontZ: -9 };

export function buildCity(opts = {}) {
  const rnd = rngOf(opts.seed || 20261104);
  const g = new THREE.Group();
  const flat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
  const meta = { stores: {}, lanes: [], carSlots: [] };

  // ground (asphalt colour everywhere; blocks are raised slabs on top)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), flat(C.road));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);

  // collect blocks between roads (plus outer ring to the extent)
  const xs = [EXT.x0, ...ROADS_NS.flatMap((r) => [r.x - r.w / 2, r.x + r.w / 2]), EXT.x1];
  const zs = [EXT.z0, ...ROADS_EW.flatMap((r) => [r.z - r.w / 2, r.z + r.w / 2]), EXT.z1];
  const blocks = [];
  for (let i = 0; i < xs.length; i += 2) for (let j = 0; j < zs.length; j += 2) blocks.push({ x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] });

  const bldInst = [], heroMeshes = [];
  const treePts = [], solar = [], parkedCars = [];
  const blockGeo = [];
  const kind = (b) => {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (cx > -30 && cx < 30 && cz > 0 && cz < 58) return 'park';        // opposite the hero shops
    if (cx > -150 && cx < -90 && cz > -124 && cz < -62) return 'park';
    if (cx > 150 && cx < 210 && cz > 58 && cz < 120) return 'park';
    if (cx > 30 && cx < 90 && cz > 58 && cz < 120) return 'parking';
    if (cx > -270 && cx < -210 && cz > 120 && cz < 182) return 'parking';
    return 'city';
  };

  const clearWalk = (x, z) => z < -5.5 && z > -9.5 && x > -92 && x < 32;
  for (const b of blocks) {
    const k = kind(b);
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    // raised slab = sidewalk + block interior
    const slab = new THREE.BoxGeometry(w, 0.18, d); slab.translate(cx, 0.09, cz);
    blockGeo.push({ geo: slab, color: k === 'park' ? C.park : k === 'parking' ? 0xdde1e6 : C.walk });
    const ix0 = b.x0 + 3, ix1 = b.x1 - 3, iz0 = b.z0 + 3, iz1 = b.z1 - 3;
    // street trees around the block
    for (let x = ix0 + 4; x < ix1 - 2; x += 9 + rnd() * 3) { treePts.push([x, iz0 - 1.4, 0.8 + rnd() * 0.25]); if (!clearWalk(x, iz1 + 1.4)) treePts.push([x + 2, iz1 + 1.4, 0.8 + rnd() * 0.25]); }
    for (let z = iz0 + 4; z < iz1 - 2; z += 9 + rnd() * 3) { treePts.push([ix0 - 1.4, z, 0.8 + rnd() * 0.25]); treePts.push([ix1 + 1.4, z + 2, 0.8 + rnd() * 0.25]); }
    if (k === 'park') {
      const isHeroPark = cx > -30 && cx < 30 && cz > 0 && cz < 58;
      // paths
      const p1 = new THREE.BoxGeometry(ix1 - ix0, 0.05, 3); p1.translate(cx, 0.2, cz); blockGeo.push({ geo: p1, color: C.path });
      const p2 = new THREE.BoxGeometry(3, 0.05, iz1 - iz0); p2.translate(cx, 0.2, cz); blockGeo.push({ geo: p2, color: C.path });
      if (isHeroPark) {
        const pl = new THREE.CylinderGeometry(13, 13, 0.06, 64); pl.translate(cx, 0.21, cz); blockGeo.push({ geo: pl, color: C.plaza });
        const ring = new THREE.TorusGeometry(10, 0.55, 12, 80); ring.rotateX(Math.PI / 2); ring.translate(cx, 0.75, cz); blockGeo.push({ geo: ring, color: 0xe6dcc7 });
        const fw = new THREE.CylinderGeometry(4, 4, 0.12, 48); fw.translate(cx, 0.3, cz); blockGeo.push({ geo: fw, color: C.water });
      }
      for (let n = 0; n < 46; n++) {
        const tx = ix0 + 2 + rnd() * (ix1 - ix0 - 4), tz = iz0 + 2 + rnd() * (iz1 - iz0 - 4);
        if (Math.abs(tx - cx) < 3 || Math.abs(tz - cz) < 3) continue;
        if (isHeroPark && Math.hypot(tx - cx, tz - cz) < 15) continue;
        treePts.push([tx, tz, 0.9 + rnd() * 0.7]);
      }
      continue;
    }
    if (k === 'parking') {
      for (let r = 0; r < 4; r++) for (let c = 0; c < Math.floor((ix1 - ix0) / 2.8); c++) {
        if (rnd() < 0.22) continue;
        parkedCars.push({ x: ix0 + 1.6 + c * 2.8, z: iz0 + 6 + r * ((iz1 - iz0 - 12) / 3), rot: Math.PI / 2 });
      }
      continue;
    }
    // city block: buildings along the south and north edges, small ones on the sides, courtyard trees
    const isHeroBlock = b.z1 <= -5.9 && b.z1 >= -6.1 && cx > -95 && cx < 30;
    const rows = [
      { front: iz1, dir: -1, face: 'south' },  // buildings whose front faces the road to the south
      { front: iz0, dir: 1, face: 'north' },
    ];
    for (const row of rows) {
      let x = ix0;
      const heroRow = isHeroBlock && row.face === 'south';
      const widths = heroRow && cx > -30 ? [8, 9, 8, 9, 8, 8] : null; // hero block slots
      let slot = 0;
      while (x < ix1 - 4) {
        let bw = widths ? widths[slot] : 9 + Math.floor(rnd() * 9);
        if (x + bw > ix1) bw = ix1 - x;
        if (bw < 5) break;
        const depth = heroRow ? 13 : 13 + Math.floor(rnd() * 6);
        const distC = Math.hypot(cx, cz);
        let h = 9 + Math.floor(rnd() * 15);
        if (rnd() < (distC > 120 ? 0.22 : 0.08)) h = 32 + Math.floor(rnd() * 34);
        // keep the blocks between the camera and the hero street low
        if (cz > 0 && cz < 130 && cx > -100 && cx < 100) h = Math.min(h, 13);
        const z0 = row.dir < 0 ? row.front - depth : row.front, zc = z0 + depth / 2;
        const bcx = x + bw / 2;
        if (heroRow) {
          heroMeshes.push({ x: bcx, w: bw, h: 11 + Math.floor(rnd() * 8), d: depth, z: zc, slot: cx > -30 ? slot : 10 + slot, front: row.front });
        } else {
          const col = rnd() < 0.18 ? C.pastel[Math.floor(rnd() * C.pastel.length)] : C.bld[Math.floor(rnd() * C.bld.length)];
          bldInst.push({ x: bcx, z: zc, w: bw - (rnd() < 0.3 ? 0.6 : 0.15), h, d: depth, col });
          if (bw * depth > 90 && rnd() < 0.55) solar.push({ x: bcx, z: zc, y: h, w: bw, d: depth });
        }
        x += bw; slot++;
      }
    }
    // a few courtyard trees
    for (let n = 0; n < 6; n++) treePts.push([ix0 + 6 + rnd() * (ix1 - ix0 - 12), cz + (rnd() - 0.5) * 6, 0.8 + rnd() * 0.4]);
  }

  // merge slabs/paths by colour
  const byCol = {};
  for (const s of blockGeo) (byCol[s.color] ||= []).push(s.geo);
  for (const [col, geos] of Object.entries(byCol)) {
    const m = new THREE.Mesh(mergeGeometries(geos), flat(Number(col)));
    m.receiveShadow = true; m.castShadow = Number(col) === 0xe6dcc7; g.add(m);
  }

  // instanced generic buildings
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const bm = new THREE.InstancedMesh(box, buildingMaterial(true), bldInst.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  bldInst.forEach((b, i) => {
    mx.compose(new THREE.Vector3(b.x, 0.18, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    bm.setMatrixAt(i, mx); bm.setColorAt(i, col.setHex(b.col));
  });
  bm.castShadow = bm.receiveShadow = true; g.add(bm);

  // hero street buildings (west block = generic shops, east block = our two stores)
  const stores = opts.stores || [];
  const signs = { 0: ['פרחים', '#ffffff', '#c2185b', 0xd77fa1], 2: ['ספרים', '#fffaf0', '#5d4037', 0x8d6e63], 3: ['אופטיקה', '#ffffff', '#1e3a5f', 0x5b7db1], 5: ['פיצה', '#fff8e1', '#c62828', 0xd35400] };
  for (const hm of heroMeshes) {
    const st = stores.find((s) => s.slot === hm.slot);
    const pastel = C.pastel[(hm.slot * 3 + 1) % C.pastel.length];
    const mat = buildingMaterial(false); mat.color.setHex(st ? st.color : pastel);
    const upper = new THREE.Mesh(box, mat); upper.scale.set(hm.w - 0.2, hm.h - 3.6, hm.d); upper.position.set(hm.x, 3.78, hm.z);
    upper.castShadow = upper.receiveShadow = true; g.add(upper);
    const base = new THREE.Mesh(box, flat(st ? st.color : pastel)); base.scale.set(hm.w - 0.2, 3.6, hm.d); base.position.set(hm.x, 0.18, hm.z);
    base.castShadow = base.receiveShadow = true; g.add(base);
    const fz = hm.front + 0.02;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(hm.w - 2.4, 2.3), new THREE.MeshStandardMaterial({ color: 0x5f6f84, roughness: 0.15, metalness: 0.15, emissive: 0xffd7a0, emissiveIntensity: st ? 0.22 : 0.12 }));
    glass.position.set(hm.x, 1.55, fz); g.add(glass);
    const sg = signs[hm.slot];
    const awCol = st ? st.awning : sg ? sg[3] : [0xb0bec5, 0x9fb7a8, 0xc7a89a][hm.slot % 3];
    const awn = new THREE.Mesh(new THREE.BoxGeometry(hm.w - 1.2, 0.2, 1.6), flat(awCol)); awn.position.set(hm.x, 3.0, fz + 0.8); awn.castShadow = true; g.add(awn);
    const label = st ? [st.name, st.signBg, st.signFg] : sg;
    if (label) {
      const sw = hm.w - 1.6;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 4), new THREE.MeshBasicMaterial({ map: signTex(label[0], label[1], label[2]) }));
      sign.position.set(hm.x, 3.55 + sw / 8, fz + 0.01); g.add(sign);
    }
    if (st) {
      meta.stores[st.id] = { door: new THREE.Vector3(hm.x, 0.2, hm.front), top: new THREE.Vector3(hm.x, hm.h + 1.5, hm.z), x: hm.x, h: hm.h };
    }
  }

  // rooftop solar water heaters (Israeli rooftops)
  const nSolar = solar.reduce((a, s) => a + 3, 0);
  const panelGeo = new THREE.BoxGeometry(1.1, 0.06, 2.0), tankGeo = new THREE.CylinderGeometry(0.33, 0.33, 1.6, 12);
  tankGeo.rotateZ(Math.PI / 2);
  const panels = new THREE.InstancedMesh(panelGeo, new THREE.MeshStandardMaterial({ color: 0x2c4a7c, roughness: 0.35, metalness: 0.3 }), nSolar);
  const tanks = new THREE.InstancedMesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.5 }), nSolar);
  let si = 0;
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0, 0));
  for (const s of solar) for (let k = 0; k < 3; k++) {
    const px = s.x - s.w / 2 + 2 + ((k * 1.5 + rnd() * 2) % (s.w - 3)), pz = s.z + (rnd() - 0.5) * (s.d - 5);
    mx.compose(new THREE.Vector3(px, s.y + 0.18 + 0.65, pz), tilt, new THREE.Vector3(1, 1, 1)); panels.setMatrixAt(si, mx);
    mx.compose(new THREE.Vector3(px, s.y + 0.18 + 1.25, pz - 1.0), q, new THREE.Vector3(1, 1, 1)); tanks.setMatrixAt(si, mx);
    si++;
  }
  panels.castShadow = tanks.castShadow = true; g.add(panels, tanks);

  // trees
  const crown = new THREE.IcosahedronGeometry(2.1, 1), trunk = new THREE.CylinderGeometry(0.18, 0.24, 2.4, 6);
  trunk.translate(0, 1.2, 0); crown.translate(0, 3.6, 0);
  const tc = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), treePts.length);
  const tt = new THREE.InstancedMesh(trunk, flat(0xb9a48c), treePts.length);
  treePts.forEach(([x, z, s], i) => {
    mx.compose(new THREE.Vector3(x, 0.18, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(s, s * (0.9 + rnd() * 0.25), s));
    tc.setMatrixAt(i, mx); tt.setMatrixAt(i, mx); tc.setColorAt(i, col.setHex(C.trees[Math.floor(rnd() * C.trees.length)]));
  });
  tc.castShadow = tt.castShadow = true; tc.receiveShadow = true; g.add(tc, tt);

  // road markings: centre dashes + crosswalks
  const marks = [];
  for (const r of ROADS_EW) for (let x = EXT.x0; x < EXT.x1; x += 7) {
    if (ROADS_NS.some((n) => Math.abs(x + 1.5 - n.x) < 10)) continue;
    marks.push([x + 1.5, r.z, 3, 0.22]);
  }
  for (const r of ROADS_NS) for (let z = EXT.z0; z < EXT.z1; z += 7) {
    if (ROADS_EW.some((n) => Math.abs(z + 1.5 - n.z) < 10)) continue;
    marks.push([r.x, z + 1.5, 0.22, 3]);
  }
  for (const e of ROADS_EW) for (const n of ROADS_NS) {
    for (const sx of [-1, 1]) for (let k = 0; k < e.w - 1; k += 1.1) marks.push([n.x + sx * (n.w / 2 + 2.2), e.z - e.w / 2 + 0.9 + k, 3, 0.5]);
    for (const sz of [-1, 1]) for (let k = 0; k < n.w - 1; k += 1.1) marks.push([n.x - n.w / 2 + 0.9 + k, e.z + sz * (e.w / 2 + 2.2), 0.5, 3]);
  }
  const mk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.03, 1), flat(C.line), marks.length);
  marks.forEach(([x, z, sx, sz], i) => { mx.compose(new THREE.Vector3(x, 0.02, z), q, new THREE.Vector3(sx, 1, sz)); mk.setMatrixAt(i, mx); });
  mk.receiveShadow = true; g.add(mk);

  // traffic lanes (right-hand traffic) for moving cars + parked cars along some curbs
  for (const r of ROADS_EW) {
    meta.lanes.push({ axis: 'x', c: r.z + 2.1, dir: 1, a: EXT.x0, b: EXT.x1 });
    meta.lanes.push({ axis: 'x', c: r.z - 2.1, dir: -1, a: EXT.x0, b: EXT.x1 });
    for (let x = EXT.x0 + 4; x < EXT.x1; x += 5.6) {
      if (ROADS_NS.some((n) => Math.abs(x - n.x) < 12)) continue;
      if (r.z === 0) { if (rnd() < 0.45) parkedCars.push({ x, z: r.z + r.w / 2 - 0.9, rot: 0 }); continue; }
      if (rnd() < 0.5) parkedCars.push({ x, z: r.z + (rnd() < 0.5 ? 1 : -1) * (r.w / 2 - 0.9), rot: 0 });
    }
  }
  for (const r of ROADS_NS) {
    meta.lanes.push({ axis: 'z', c: r.x + 2.1, dir: -1, a: EXT.z0, b: EXT.z1 });
    meta.lanes.push({ axis: 'z', c: r.x - 2.1, dir: 1, a: EXT.z0, b: EXT.z1 });
  }
  // moving traffic: seeded slots along each lane
  for (const ln of meta.lanes) {
    let p = ln.a + rnd() * 20;
    while (p < ln.b) {
      const inX = ln.axis === 'z' && ROADS_EW.some((e) => Math.abs(p - e.z) < e.w / 2 + 4.5);
      if (!inX) meta.carSlots.push({ ln, s0: p, speed: ln.axis === 'x' ? 9 * (0.85 + rnd() * 0.3) : 0, color: C.cars[Math.floor(rnd() * C.cars.length)], bus: ln.axis === 'x' && Math.abs(ln.c) > 8 && rnd() < 0.05, taxi: rnd() < 0.05 });
      p += (ln.axis === 'x' ? 10 : 8) + rnd() * 20;
    }
  }

  // car meshes (instanced): bodies, cabins, taxi signs; buses separate
  const nCars = meta.carSlots.length + parkedCars.length;
  const bodyG = new THREE.BoxGeometry(4.4, 0.95, 1.9); bodyG.translate(0, 0.72, 0);
  const cabG = new THREE.BoxGeometry(2.3, 0.62, 1.66); cabG.translate(-0.25, 1.5, 0);
  const glassG = new THREE.BoxGeometry(2.36, 0.4, 1.72); glassG.translate(-0.25, 1.46, 0);
  const bodies = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.15 }), nCars);
  const cabs = new THREE.InstancedMesh(cabG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.15 }), nCars);
  const glasses = new THREE.InstancedMesh(glassG, new THREE.MeshStandardMaterial({ color: 0x2a323d, roughness: 0.18, metalness: 0.35 }), nCars);
  const busG = new THREE.BoxGeometry(12, 2.6, 2.55); busG.translate(0, 1.7, 0);
  const busWin = new THREE.BoxGeometry(11.6, 0.8, 2.6); busWin.translate(0, 2.25, 0);
  const nBus = meta.carSlots.filter((c) => c.bus).length;
  const buses = new THREE.InstancedMesh(busG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), Math.max(1, nBus));
  const busW = new THREE.InstancedMesh(busWin, new THREE.MeshStandardMaterial({ color: 0x2a323d, roughness: 0.2 }), Math.max(1, nBus));
  bodies.castShadow = cabs.castShadow = buses.castShadow = true;
  g.add(bodies, cabs, glasses, buses, busW);
  parkedCars.forEach((p, i) => {
    mx.compose(new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rot, 0)), new THREE.Vector3(1, 1, 1));
    bodies.setMatrixAt(i, mx); cabs.setMatrixAt(i, mx); glasses.setMatrixAt(i, mx);
    col.setHex(C.cars[Math.floor(rnd() * C.cars.length)]); bodies.setColorAt(i, col); cabs.setColorAt(i, col);
  });
  meta.traffic = { bodies, cabs, buses, busW, parked: parkedCars.length };
  meta.setTraffic = (t) => {
    let ci = parkedCars.length, bi = 0;
    for (const s of meta.carSlots) {
      const ln = s.ln, L = ln.b - ln.a;
      const p = ln.dir > 0 ? ln.a + ((s.s0 - ln.a + s.speed * t) % L + L) % L : ln.a + ((s.s0 - ln.a - s.speed * t) % L + L) % L;
      const pos = ln.axis === 'x' ? new THREE.Vector3(p, 0, ln.c) : new THREE.Vector3(ln.c, 0, p);
      const yaw = ln.axis === 'x' ? (ln.dir > 0 ? 0 : Math.PI) : (ln.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      mx.compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
      if (s.bus) { buses.setMatrixAt(bi, mx); busW.setMatrixAt(bi, mx); buses.setColorAt(bi, col.setHex(bi % 2 ? 0x2e7d32 : 0xd84315)); bi++; continue; }
      bodies.setMatrixAt(ci, mx); cabs.setMatrixAt(ci, mx); glasses.setMatrixAt(ci, mx);
      col.setHex(s.taxi ? 0xf6c445 : s.color); bodies.setColorAt(ci, col); cabs.setColorAt(ci, col); ci++;
    }
    bodies.count = cabs.count = glasses.count = ci; buses.count = busW.count = Math.max(0, bi);
    for (const m of [bodies, cabs, glasses, buses, busW]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  };
  meta.setTraffic(0);
  g.userData = meta;
  return g;
}

// Google-Maps navigation route: a blue ribbon with a darker border and round caps.
// points: [[x, z], ...]; draws from the start up to `len` metres along the path.
export function routeGeometry(points, len, width, y) {
  const out = [];
  let acc = 0;
  const pts = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1], [x1, z1] = points[i], L = Math.hypot(x1 - x0, z1 - z0);
    if (acc + L >= len) { const f = (len - acc) / L; pts.push([x0 + (x1 - x0) * f, z0 + (z1 - z0) * f]); break; }
    pts.push([x1, z1]); acc += L;
  }
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 0.01) continue;
    const seg = new THREE.PlaneGeometry(L, width); seg.rotateX(-Math.PI / 2);
    seg.rotateY(-Math.atan2(z1 - z0, x1 - x0)); seg.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    out.push(seg);
  }
  for (const [x, z] of pts) { const c = new THREE.CircleGeometry(width / 2, 32); c.rotateX(-Math.PI / 2); c.translate(x, y, z); out.push(c); }
  return mergeGeometries(out.map((gg) => gg.index ? gg.toNonIndexed() : gg));
}
