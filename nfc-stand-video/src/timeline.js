// ─────────────────────────────────────────────────────────────────────────────
// timeline.js — the film. TL.frame(t) renders one complete frame as a pure
// function of absolute time t (seconds). No state carries between calls, so
// frames can be rendered in any order.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const TL = (window.TL = {});
  const { E, C, STAGE } = U;
  const { prog, lerp, clamp } = U;
  const PI = Math.PI, DEG = PI / 180;
  const D = R3.D;

  TL.DURATION = 18;
  TL.FPS = 60;
  let ctx, bgCanvas, stageCanvas, phoneCv;

  // ── Shared timing data (also used by the soundtrack) ──────────────────────
  TL.QUERY = 'Bistro 42 Kfar Saba reviews...';
  TL.typeTimes = () => {
    const n = TL.QUERY.length;
    return Array.from({ length: n }, (_, i) => 0.86 + (0.86 * (i + 0.3 * Math.sin(i * 2.3))) / n);
  };
  const TYPE = TL.typeTimes();
  TL.CUES = {
    taps: [2.74, 3.13, 9.04], nfc: 5.9, stars: [8.1, 8.25, 8.4, 8.55, 8.7], pivot: 4.2,
    brand: 9.2, zoom: [10.92, 11.78], statement: 11.8, final: 15.8,
  };

  // ── Setup ─────────────────────────────────────────────────────────────────
  TL.init = function (mainCtx) {
    ctx = mainCtx;
    bgCanvas = buildBackground();
    stageCanvas = buildStage();
    phoneCv = Art.canvas(Art.PHONE_TEX.w, Art.PHONE_TEX.h);
    R3.setTexture('stand', Art.standFace());
    R3.setTexture('badge', Art.badgeTex());
    Art.phoneFace(phoneCv, {});
    R3.setTexture('phone', phoneCv);
  };

  function buildBackground() {
    const cv = Art.canvas(U.W, U.H), x = cv.getContext('2d');
    x.fillStyle = '#04060A'; x.fillRect(0, 0, U.W, U.H);
    let g = x.createRadialGradient(0, 0, 0, 0, 0, 1500);
    g.addColorStop(0, 'rgba(66,133,244,0.95)'); g.addColorStop(0.28, 'rgba(38,92,190,0.65)');
    g.addColorStop(0.55, 'rgba(13,37,76,0.55)'); g.addColorStop(1, 'rgba(13,37,76,0)');
    x.fillStyle = g; x.fillRect(0, 0, U.W, U.H);
    for (const [cx, a] of [[-100, 0.55], [2020, 0.5]]) {
      g = x.createRadialGradient(cx, 520, 0, cx, 520, 900);
      g.addColorStop(0, `rgba(13,37,76,${a})`); g.addColorStop(1, 'rgba(13,37,76,0)');
      x.fillStyle = g; x.fillRect(0, 0, U.W, U.H);
    }
    g = x.createRadialGradient(1700, 60, 0, 1700, 60, 900);
    g.addColorStop(0, 'rgba(70,90,120,0.22)'); g.addColorStop(1, 'rgba(70,90,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, U.W, U.H);
    g = x.createLinearGradient(0, 560, 0, U.H);
    g.addColorStop(0, 'rgba(2,3,5,0)'); g.addColorStop(1, 'rgba(2,3,5,0.94)');
    x.fillStyle = g; x.fillRect(0, 0, U.W, U.H);
    // stage drop shadow + faint rim glow
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 90; x.shadowOffsetY = 24;
    U.rr(x, STAGE.x, STAGE.y, STAGE.w, STAGE.h, STAGE.r); x.fillStyle = C.stage; x.fill();
    x.restore();
    // subtle dither to avoid banding in the glow
    const id = x.getImageData(0, 0, U.W, U.H), d = id.data, rnd = U.rng(7);
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 3; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(id, 0, 0);
    return cv;
  }
  function buildStage() {
    const cv = Art.canvas(U.W, U.H), x = cv.getContext('2d');
    x.fillStyle = C.stage; x.fillRect(0, 0, U.W, U.H);
    let g = x.createRadialGradient(STAGE.cx, STAGE.y - 120, 0, STAGE.cx, STAGE.y - 120, 1100);
    g.addColorStop(0, 'rgba(120,150,210,0.07)'); g.addColorStop(1, 'rgba(120,150,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, U.W, U.H);
    g = x.createLinearGradient(0, STAGE.y + STAGE.h - 260, 0, STAGE.y + STAGE.h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = g; x.fillRect(0, 0, U.W, U.H);
    const id = x.getImageData(0, 0, U.W, U.H), d = id.data, rnd = U.rng(11);
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 2.2; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(id, 0, 0);
    return cv;
  }

  // ── Hero product pose ─────────────────────────────────────────────────────
  const standA = U.KF([
    [4.36, { sx: 960, sy: 1200, scale: 0.92, yaw: -58 }],
    [5.16, { sx: 960, sy: 878, scale: 1.0, yaw: 22 }, E.out],
    [5.24, {}],
    [5.86, { sx: 985, sy: 1020, scale: 1.36, yaw: 12 }, E.inOut],
    [6.48, {}],
    [7.3, { sx: 520, sy: 812, scale: 0.95, yaw: 26 }, E.inOut],
  ]);
  const standB = U.KF([
    [10.46, { sx: 820, sy: 1190, scale: 0.95, yaw: -32 }],
    [10.95, { sx: 820, sy: 840, scale: 1.0, yaw: 16 }, E.out],
  ]);
  const standC = U.KF([
    [14.66, { sx: 960, sy: 1200, scale: 0.94, yaw: -36 }],
    [15.3, { sx: 960, sy: 872, scale: 1.02, yaw: 6 }, E.out],
    [15.8, { yaw: 8 }, E.smooth],
    [16.65, { sx: 690, sy: 872, scale: 1.04, yaw: 22 }, E.inOut],
    [18.0, { yaw: 24.5 }, E.smooth],
  ]);
  function standPose(t) {
    let p = null;
    if (t >= 4.36 && t < 8.06) p = standA(t);
    else if (t >= 10.46 && t < 11.8) p = standB(t);
    else if (t >= 14.66) p = standC(t);
    if (!p) return null;
    p.yaw *= DEG;
    // gloss sweeps: on NFC contact, and on the final hero pose
    const g1 = prog(t, 5.92, 6.6), g2 = prog(t, 16.3, 17.2);
    if (g1 > 0 && g1 < 1) { p.glossPos = lerp(-0.4, 1.9, E.inOut(g1)); p.glossAmt = 1; }
    else if (g2 > 0 && g2 < 1) { p.glossPos = lerp(-0.4, 1.9, E.inOut(g2)); p.glossAmt = 0.65; }
    else p.glossAmt = 0;
    return p;
  }
  TL.standPose = standPose;

  function glAlpha(t) {
    if (t < 8.06) return 1 - E.inOut(prog(t, 7.8, 8.02));
    if (t < 11.8) return 1 - E.in(prog(t, 11.46, 11.78));
    return 1;
  }

  // ── Smartphone pose ───────────────────────────────────────────────────────
  function lerpPose(a, b, p) {
    const o = {};
    for (const k in b) o[k] = lerp(a[k], b[k], p);
    return o;
  }
  function attachPose(sp, gap) {
    const Mp = R3.panelMatrix(R3.standMatrix(sp));
    const w = R3.M.apply(Mp, [0.016, D.badgeY + 0.052, D.badgeT + D.phoneT / 2 + 0.002 + gap]);
    return { x: w[0], y: w[1], z: w[2], yaw: sp.yaw, pitch: -D.tilt, roll: -0.1, scale: sp.scale };
  }
  function phonePose(t) {
    if (t < 5.3 || t >= 8.06) return null;
    const sp = standPose(t);
    const s0 = R3.screenToWorld(2350, 280, 0.4);
    const from = { x: s0[0], y: s0[1], z: s0[2], yaw: 0.75, pitch: -0.08, roll: -0.42, scale: sp.scale };
    const gap = lerp(0.11, 0, E.inOut(prog(t, 5.76, 5.9))) + 0.04 * E.out(prog(t, 5.9, 6.25));
    let p = lerpPose(from, attachPose(sp, gap), E.out(prog(t, 5.3, 5.8)));
    const c = R3.screenToWorld(948, 540, 0.32);
    p = lerpPose(p, { x: c[0], y: c[1], z: c[2], yaw: 0, pitch: 0, roll: 0, scale: 2.0 }, E.inOut(prog(t, 6.45, 7.3)));
    p.glossAmt = 0;
    return p;
  }
  function phoneState(t) {
    return {
      nfc: prog(t, 5.9, 6.55),
      banner: E.out(prog(t, 6.6, 6.9)),
      morph: E.inOut(prog(t, 6.98, 7.38)),
      dim: E.inOut(prog(t, 6.98, 7.38)),
    };
  }
  let modalRect0 = null;
  function phoneModalRect() {
    if (modalRect0) return modalRect0;
    const p = phonePose(7.8), M = Art.PHONE_MODAL, PT = Art.PHONE_TEX, I = PT.inset;
    const mh = (M.w * 293) / 324;
    const a = R3.project(R3.phoneUVWorld(p, (I + M.x) / PT.w, (I + M.y) / PT.h));
    const b = R3.project(R3.phoneUVWorld(p, (I + M.x + M.w) / PT.w, (I + M.y + mh) / PT.h));
    modalRect0 = { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] };
    return modalRect0;
  }
  TL.phonePose = phonePose;

  // ── Camera (dramatic dolly at 10.9–11.8) ──────────────────────────────────
  const zoomEase = U.cubicBezier(0.55, 0, 0.8, 0.45);
  const zoomP = (t) => zoomEase(prog(t, 10.98, 11.78));
  function cameraAt(t) {
    const C0 = R3.CAM;
    const pz = zoomP(t);
    if (pz <= 0 || t >= 11.8) return C0;
    const sp = standPose(t);
    const b = R3.badgeWorld(sp), n = R3.standNormal(sp);
    const endPos = [b[0] + n[0] * 0.34, b[1] + n[1] * 0.34, b[2] + n[2] * 0.34];
    return {
      pos: C0.pos.map((v, i) => lerp(v, endPos[i], pz)),
      target: C0.target.map((v, i) => lerp(v, b[i], pz)),
      fov: C0.fov,
    };
  }

  // ── Layers ────────────────────────────────────────────────────────────────
  function drawGL(t) {
    const sp = standPose(t), pp = phonePose(t);
    if (!sp && !pp) return;
    const a = glAlpha(t);
    if (a <= 0.001) return;
    if (pp) { Art.phoneFace(phoneCv, phoneState(t)); R3.setTexture('phone', phoneCv); }
    const cam = cameraAt(t);
    // soft royal-blue floor pool under the stand
    if (sp) {
      const base = R3.project(R3.M.apply(R3.standMatrix(sp), [0, 0, 0.05]).slice(0, 3), cam);
      if (base[2] > 0.3) {
        const k = (R3.CAM.pos[2] / base[2]) * sp.scale;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(base[0], base[1]);
        ctx.scale(1, 0.2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 520 * k);
        g.addColorStop(0, 'rgba(66,133,244,0.20)'); g.addColorStop(0.5, 'rgba(26,115,232,0.07)'); g.addColorStop(1, 'rgba(26,115,232,0)');
        ctx.fillStyle = g; ctx.fillRect(-600 * k, -600 * k, 1200 * k, 1200 * k);
        ctx.restore();
      }
    }
    const glc = R3.render({ cam, stand: sp, phone: pp });
    ctx.save();
    ctx.globalAlpha = a;
    ctx.drawImage(glc, 0, 0);
    // controlled zoom blur at the fastest part of the dolly
    const v = (zoomP(t + 0.008) - zoomP(t - 0.008)) / 0.016;
    if (v > 0.2 && sp) {
      const k = Math.min(0.16, v * 0.03);
      const o = R3.project(R3.badgeWorld(sp), cam);
      for (let i = 1; i <= 5; i++) {
        const s = 1 + (k * i) / 5;
        ctx.globalAlpha = a * 0.15 * (1 - i / 6.5);
        ctx.setTransform(s, 0, 0, s, o[0] * (1 - s), o[1] * (1 - s));
        ctx.drawImage(glc, 0, 0);
      }
    }
    ctx.restore();
  }

  // Touch indicator
  function touch(x, y, alpha, press, ripple) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (ripple > 0 && ripple < 1) {
      ctx.beginPath(); ctx.arc(x, y, 24 + 46 * E.out(ripple), 0, PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - ripple)})`; ctx.lineWidth = 2; ctx.stroke();
    }
    const r = 24 * (1 - 0.16 * press);
    ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.16 + 0.22 * press})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  // ── 0.0 – 4.5  The old way: search → friction → hunting → drop-off ────────
  const RESULTS = [
    { kind: 'link', h: 96, d: { site: 'CityBites', url: 'citybites.example › kfar-saba › restaurants', title: 'Top 10 Restaurants in Kfar Saba (2026 Guide)', snip: 'Updated list · prices, menus, opening hours, parking and more…', fav: '#E37400', ad: true } },
    { kind: 'map', h: 150 },
    { kind: 'link', h: 96, d: { site: 'FoodGuide', url: 'foodguide.example › bistro-42', title: 'Bistro 42 – Menu, Prices & Opening Hours', snip: 'See photos, menu, directions, delivery options and 42 reviews…', fav: '#1E8E3E' } },
    { kind: 'link', h: 96, d: { site: 'LocalForum', url: 'localforum.example › threads › 8812', title: 'Bistro 42 Kfar Saba reviews? (forum thread)', snip: '“Anyone been lately? And where do I even leave a review…”', fav: '#5F6368' } },
  ];
  const COL_X = 580, COL_W = 760, PROFILE_Y = 1040;
  const scrollAt = (t) => 650 * E.inOut(prog(t, 2.0, 2.48)) + 300 * E.inOut(prog(t, 2.88, 3.06));

  let tabsCache = null;
  function tabs() { return tabsCache || (tabsCache = Art.profileTabX(ctx, COL_X)); }
  let touchKF = null;
  function touchPath() {
    if (touchKF) return touchKF;
    const tb = tabs();
    const tabY = PROFILE_Y - 650 + Art.PROFILE.tabsY - 5;
    const wb = { x: COL_X + 26 + 105, y: PROFILE_Y - 950 + Art.PROFILE.writeY - 1 };
    touchKF = U.KF([
      [2.22, { x: 1250, y: 840, a: 0 }],
      [2.34, { x: 1170, y: 770, a: 1 }, E.out],
      [2.46, { x: tb[0].c + 4, y: tabY + 14 }, E.smooth],
      [2.57, { x: tb[1].c - 2, y: tabY + 22 }, E.smooth],
      [2.66, { x: tb[2].c + 2, y: tabY + 8 }, E.smooth],
      [2.74, { x: tb[3].c, y: tabY }, E.smooth],
      [2.8, {}],
      [2.88, { x: 930, y: 800 }, E.smooth],
      [3.06, { x: 930, y: 500 }, E.inOut],
      [3.13, { x: wb.x, y: wb.y }, E.smooth],
      [3.24, {}],
      [3.38, { a: 0 }, E.smooth],
    ]);
    return touchKF;
  }

  function drawBrowser(t) {
    if (t >= 4.48) return;
    const S = scrollAt(t);
    const rec = E.inOut(prog(t, 3.22, 3.66));
    const fold = E.in(prog(t, 4.16, 4.46));
    ctx.save();
    const cx = STAGE.cx, cy = STAGE.cy;
    const sx = (1 - 0.1 * rec) * (1 - 0.22 * fold), sy = (1 - 0.1 * rec) * (1 - 0.08 * rec) * (1 - 0.985 * fold);
    ctx.translate(cx, cy + 26 * rec);
    ctx.scale(sx, sy);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = (1 - 0.8 * rec) * (1 - fold);
    ctx.translate(0, -S);

    // search bar
    const grow = E.arrive(prog(t, 0.02, 0.62));
    if (t >= 0.0) {
      const typed = TL.QUERY.slice(0, TYPE.filter((x) => x <= t).length);
      const cursor = t < 1.78 ? t >= 0.5 : Math.floor((t - 1.78) / 0.27) % 2 === 1;
      ctx.save();
      ctx.globalAlpha *= clamp(prog(t, 0, 0.14));
      const bw = lerp(84, COL_W, grow), bh = lerp(64, 72, grow);
      A_searchBar(STAGE.cx, 470, bw, bh, typed, cursor && t < 2.3);
      ctx.restore();
    }
    // results cascade
    let y = 540;
    RESULTS.forEach((r, i) => {
      const a0 = 1.02 + i * 0.12;
      const p = E.out(prog(t, a0, a0 + 0.42));
      if (p > 0) {
        ctx.save();
        ctx.globalAlpha *= clamp(p * 1.3);
        ctx.translate(0, (1 - p) * 30);
        if (r.kind === 'link') Art.linkResult(ctx, COL_X, y, COL_W, r.d);
        else Art.mapResult(ctx, COL_X, y, COL_W);
        ctx.restore();
      }
      y += r.h + 14;
    });
    // business profile (below the fold until we scroll)
    if (S > 1) {
      Art.profileCard(ctx, COL_X, PROFILE_Y, COL_W, {
        tab: 3 * E.inOut(prog(t, 2.76, 2.92)),
        reviews: prog(t, 2.78, 2.9),
        press: E.bump(prog(t, 3.13, 3.3)),
      });
    }
    ctx.restore();

    // touch indicator (screen space)
    if (t > 2.2 && t < 3.4) {
      const k = touchPath()(t);
      const press = Math.max(E.bump(prog(t, 2.74, 2.86)), E.bump(prog(t, 3.13, 3.25)), t > 2.88 && t < 3.06 ? 1 : E.bump(prog(t, 2.84, 2.92)) * 0.6);
      const rip = t < 3.0 ? prog(t, 2.74, 3.04) : prog(t, 3.13, 3.42);
      touch(k.x, k.y, k.a * (1 - rec * 0.6), press, rip);
    }
  }
  function A_searchBar(cx, cy, w, h, text, cursor) { Art.searchBar(ctx, cx, cy, w, h, text, cursor); }

  function drawDropScrim(t) {
    const p = E.inOut(prog(t, 3.22, 3.7)) * (1 - E.inOut(prog(t, 4.18, 4.5)));
    if (p <= 0) return;
    const g = ctx.createRadialGradient(STAGE.cx, 560, 0, STAGE.cx, 560, 720);
    g.addColorStop(0, `rgba(11,13,17,${0.94 * p})`); g.addColorStop(0.55, `rgba(11,13,17,${0.8 * p})`); g.addColorStop(1, 'rgba(11,13,17,0)');
    ctx.fillStyle = g; ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
  }

  // ── 4.2 – 5.2  Pivot ripple ───────────────────────────────────────────────
  function drawRipple(t) {
    const p = prog(t, 4.36, 5.2);
    if (p <= 0 || p >= 1) return;
    const r = 40 + 1150 * E.out(p);
    const a = 0.55 * (1 - p) * clamp(p * 8);
    const cx = STAGE.cx, cy = 760;
    const g = ctx.createRadialGradient(cx, cy, Math.max(0, r - 160), cx, cy, r);
    g.addColorStop(0, 'rgba(66,133,244,0)');
    g.addColorStop(0.82, `rgba(66,133,244,${a * 0.6})`);
    g.addColorStop(0.97, `rgba(160,195,255,${a})`);
    g.addColorStop(1, 'rgba(66,133,244,0)');
    ctx.fillStyle = g; ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 700);
    g2.addColorStop(0, `rgba(26,115,232,${0.18 * E.bump(p)})`); g2.addColorStop(1, 'rgba(26,115,232,0)');
    ctx.fillStyle = g2; ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
  }

  // ── 5.9  NFC pulse ────────────────────────────────────────────────────────
  let tapPoint = null;
  function drawPulse(t) {
    if (t < 5.86 || t > 6.95) return;
    if (!tapPoint) tapPoint = R3.project(R3.badgeWorld(standPose(5.9)));
    const [x, y] = tapPoint;
    const fl = E.bump(prog(t, 5.88, 6.25));
    if (fl > 0) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 260);
      g.addColorStop(0, `rgba(138,180,248,${0.35 * fl})`); g.addColorStop(1, 'rgba(138,180,248,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 260, y - 260, 520, 520);
    }
    for (let k = 0; k < 3; k++) {
      const p = prog(t, 5.9 + k * 0.11, 5.9 + k * 0.11 + 0.8);
      if (p <= 0 || p >= 1) continue;
      const r = 50 + 330 * E.out(p);
      ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2);
      ctx.strokeStyle = U.mix('#FFFFFF', C.blue, p, Math.pow(1 - p, 1.4) * 0.85);
      ctx.lineWidth = 2.6 * (1 - p * 0.5);
      ctx.stroke();
    }
  }

  // ── 7.8 – 11.6  Review card → glass badge → rating card ──────────────────
  const HERO = { x: 960 - 324, y: 258, w: 648, h: 586 };
  const GLASS = { cx: 960, cy: 468, w: 520, h: 144 };
  const RCARD = { cx: 1352, cy: 372, w: 520 * 0.78, h: 144 * 0.78 };
  const G_ID = { x: 960, y: 640 };
  function starState(t) {
    const fills = [], pulses = [];
    TL.CUES.stars.forEach((s) => {
      fills.push(E.out(prog(t, s, s + 0.1)));
      pulses.push(E.bump(prog(t, s, s + 0.24)));
    });
    return { fills, pulses, post: E.smooth(prog(t, 8.86, 9.02)), press: E.bump(prog(t, 9.04, 9.2)) };
  }
  function drawBlue(t) {
    if (t < 9.18 || t > 10.52) return;
    const grow = E.out(prog(t, 9.2, 9.64));
    const shrink = E.inOut(prog(t, 10.26, 10.5));
    const postC = { x: HERO.x + (Art.modalPost.x + Art.modalPost.w / 2) * 2, y: HERO.y + (Art.modalPost.y + Art.modalPost.h / 2) * 2 };
    const cx = lerp(postC.x, G_ID.x, clamp(shrink * 4)), cy = lerp(postC.y, G_ID.y, clamp(shrink * 4));
    const R = 1900 * grow * (1 - shrink);
    if (R <= 0.5) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, PI * 2);
    const g = ctx.createRadialGradient(STAGE.cx, STAGE.y, 0, STAGE.cx, STAGE.y, 1200);
    g.addColorStop(0, '#2A7FF0'); g.addColorStop(1, C.brandBlue);
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }
  function drawGlassContent(cx, cy, sc, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy); ctx.scale(sc, sc);
    U.text(ctx, '5.0', -160, 27, { size: 76, weight: 700, color: '#fff', align: 'center', ls: -2 });
    for (let i = 0; i < 5; i++) U.star(ctx, -46 + i * 54, 0, 22, 1, C.gold);
    ctx.restore();
  }
  function drawCards(t) {
    // 7.8–9.3: hero review card (handed off from the phone screen)
    if (t >= 7.8 && t < 9.4) {
      const r0 = phoneModalRect();
      const p = E.inOut(prog(t, 7.8, 8.12));
      const x = lerp(r0.x, HERO.x, p), y = lerp(r0.y, HERO.y, p), w = lerp(r0.w, HERO.w, p);
      const st = starState(t);
      if (t < 9.28) {
        // soft glow under the active card
        const gl = E.smooth(prog(t, 8.0, 8.4));
        if (gl > 0) {
          const g = ctx.createRadialGradient(960, 560, 0, 960, 560, 560);
          g.addColorStop(0, `rgba(66,133,244,${0.12 * gl})`); g.addColorStop(1, 'rgba(66,133,244,0)');
          ctx.fillStyle = g; ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
        }
        Art.reviewModal(ctx, x, y, w, st);
        // tap on Post
        const tp = { x: HERO.x + (Art.modalPost.x + Art.modalPost.w / 2) * 2, y: HERO.y + (Art.modalPost.y + Art.modalPost.h / 2) * 2 };
        const ta = clamp(prog(t, 8.88, 9.0)) * (1 - prog(t, 9.16, 9.28));
        const mv = E.out(prog(t, 8.88, 9.04));
        touch(lerp(tp.x + 120, tp.x, mv), lerp(tp.y + 90, tp.y, mv), ta, E.bump(prog(t, 9.04, 9.2)), prog(t, 9.04, 9.4));
      }
    }
    // 9.28–11.6: morph container (card → glass → rating card)
    if (t >= 9.28 && t < 11.62) {
      const m = E.inOut(prog(t, 9.28, 9.66));
      const q = E.inOut(prog(t, 10.32, 10.86));
      const g0 = { cx: HERO.x + HERO.w / 2, cy: HERO.y + HERO.h / 2, w: HERO.w, h: HERO.h, r: 44 };
      const g1 = { cx: GLASS.cx, cy: GLASS.cy, w: GLASS.w, h: GLASS.h, r: 72 };
      const g2 = { cx: RCARD.cx, cy: RCARD.cy, w: RCARD.w, h: RCARD.h, r: 56 };
      let r = lerpPose(lerpPose(g0, g1, m), g2, q);
      // dramatic zoom: rating card rushes toward camera (faster parallax than the stand)
      const zs = 1 + 2.6 * zoomEase(prog(t, 10.98, 11.6));
      r = { cx: STAGE.cx + (r.cx - STAGE.cx) * zs, cy: 560 + (r.cy - 560) * zs, w: r.w * zs, h: r.h * zs, r: r.r * zs };
      const alpha = 1 - E.in(prog(t, 11.28, 11.58));
      const glass = m * (1 - q);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${0.3 + 0.2 * q})`; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
      U.rr(ctx, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h, r.r);
      // dark card ↔ frosted glass ↔ dark rating card, as layered crossfades
      const dark = Math.max(1 - m, q);
      ctx.fillStyle = `rgba(${q > 0 ? '22,25,32' : '27,30,36'},${q > 0 ? 0.9 * q : dark})`;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = `rgba(255,255,255,${0.16 * glass})`;
      ctx.fill();
      ctx.restore();
      // glass highlight + border
      ctx.save();
      U.rr(ctx, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h, r.r); ctx.clip();
      const hg = ctx.createLinearGradient(0, r.cy - r.h / 2, 0, r.cy);
      hg.addColorStop(0, `rgba(255,255,255,${0.22 * glass})`); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h);
      // outgoing review content
      const ca = 1 - E.smooth(prog(t, 9.26, 9.36));
      if (ca > 0) Art.reviewModal(ctx, r.cx - r.w / 2, r.cy - r.h / 2, r.w, Object.assign(starState(t), { noCard: true, content: ca }));
      ctx.restore();
      U.rr(ctx, r.cx - r.w / 2 + 0.5, r.cy - r.h / 2 + 0.5, r.w - 1, r.h - 1, r.r);
      ctx.strokeStyle = `rgba(255,255,255,${lerp(0.08, 0.42, glass) + 0.1 * q})`; ctx.lineWidth = 1.2; ctx.stroke();
      const ba = E.out(prog(t, 9.38, 9.66));
      drawGlassContent(r.cx, r.cy + (1 - ba) * 14, r.w / GLASS.w, ba);
      if (q > 0) {
        U.text(ctx, '128 reviews · Google', r.cx, r.cy + r.h / 2 + 30 * (r.w / RCARD.w), { size: 15 * (r.w / RCARD.w), weight: 500, color: C.gray, align: 'center', alpha: E.smooth(prog(t, 10.6, 10.9)) });
      }
      ctx.restore();
    }
    // G identity under the glass badge
    if (t >= 9.58 && t < 10.55) {
      const s = E.arrive(prog(t, 9.6, 10.0)) * (1 - E.in(prog(t, 10.24, 10.46)));
      if (s > 0.001) {
        ctx.save();
        ctx.translate(G_ID.x, G_ID.y); ctx.scale(s, s);
        U.gBadge(ctx, 0, 0, 50, true);
        ctx.restore();
        U.text(ctx, 'Google Reviews', G_ID.x, G_ID.y + 92, { size: 22, weight: 500, color: '#fff', align: 'center', alpha: 0.9 * E.smooth(prog(t, 9.72, 10.0)) * (1 - prog(t, 10.22, 10.36)) });
      }
    }
  }

  // ── 13.0 – 15.3  Social proof wall ────────────────────────────────────────
  const CARDS = [
    { kind: 'review', d: { name: 'Noa K.', initial: 'N', color: '#34A853', meta: 'Local Guide · 2 days ago', text: 'Tapped the stand. Review done in seconds!', biz: 'Cafe Aroma', bizColor: '#7B4B2A' } },
    { kind: 'review', d: { name: 'Daniel R.', initial: 'D', color: '#4285F4', meta: '12 reviews · 1 week ago', text: 'Easiest review I’ve ever left. Love it!', biz: 'Studio Aura', bizColor: '#8E44AD' } },
    { kind: 'review', d: { name: 'Maya S.', initial: 'M', color: '#EA4335', meta: 'Local Guide · yesterday', text: 'One tap and the five stars were right there.', biz: 'Bistro 42', bizColor: '#B3261E' } },
    { kind: 'rating' }, { kind: 'growth' }, { kind: 'biz' },
  ];
  function drawWall(t) {
    if (t < 13.0 || t > 15.3) return;
    const spread = E.inOut(prog(t, 13.72, 14.14));
    const metric = E.inOut(prog(t, 14.0, 14.45));
    const list = [];
    CARDS.forEach((c, i) => {
      let x, y, s, rot, a, sy = 1;
      if (i < 3) {
        const p = E.out(prog(t, 13.08 + i * 0.09, 13.68 + i * 0.09));
        if (p <= 0) return;
        const ix = [500, 960, 1420][i], gx = [536, 960, 1384][i];
        const tilt = [-0.055, 0, 0.055][i];
        x = lerp(ix, gx, spread);
        y = lerp(540 + (1 - p) * 150, 450, spread);
        s = lerp(1.08 * (0.88 + 0.12 * p), 1.0, spread);
        sy = 0.72 + 0.28 * p;
        rot = lerp(tilt * (1 + (1 - p) * 1.4), tilt * 0.3, spread);
        a = clamp(p * 1.6);
      } else {
        const j = i - 3;
        const p = E.out(prog(t, 13.9 + j * 0.08, 14.4 + j * 0.08));
        if (p <= 0) return;
        x = [536, 960, 1384][j];
        y = 642 + (1 - p) * 70;
        s = 0.94 + 0.06 * p;
        rot = [0.016, 0, -0.016][j] * (1 + (1 - p) * 2);
        a = clamp(p * 1.5);
        sy = 0.85 + 0.15 * p;
      }
      // convergence: fold toward the centre, behind the rising stand
      const order = [0, 2, 1, 3, 5, 4].indexOf(i);
      const cv = E.inOut(prog(t, 14.5 + order * 0.035, 14.98 + order * 0.035));
      x = lerp(x, 960, cv); y = lerp(y, 610, cv);
      s *= 1 - 0.68 * cv; sy *= 1 - 0.45 * cv; rot *= 1 - cv;
      a *= 1 - E.in(cv);
      list.push({ c, x, y, s, sy, rot, a, depth: s });
    });
    list.sort((p, q) => p.depth - q.depth);
    for (const it of list) {
      if (it.a <= 0.002) continue;
      ctx.save();
      ctx.globalAlpha = it.a;
      ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.scale(it.s, it.s * it.sy); ctx.translate(-200, -85);
      if (it.c.kind === 'review') Art.reviewCard(ctx, it.c.d);
      else if (it.c.kind === 'rating') Art.ratingMetricCard(ctx, 4.2 + 0.7 * metric);
      else if (it.c.kind === 'growth') Art.growthCard(ctx, metric);
      else Art.bizCard(ctx);
      ctx.restore();
    }
  }

  // ── Persistent status bar ─────────────────────────────────────────────────
  const statusKF = U.KF([
    [5.2, { r: 4.6, c: 42 }], [6.3, { r: 4.6, c: 47 }], [9.0, { r: 4.7, c: 64 }],
    [11.2, { r: 4.7, c: 81 }], [12.8, { r: 4.8, c: 104 }], [14.2, { r: 4.9, c: 128 }],
  ]);
  function drawStatus(t) {
    let a = 0, dy = 0;
    if (t >= 5.2 && t < 9.4) {
      const i = E.out(prog(t, 5.22, 5.6)), o = E.in(prog(t, 9.16, 9.36));
      a = i * (1 - o); dy = (1 - i) * 26 + o * 26;
    } else if (t >= 10.4 && t < 14.85) {
      const i = E.out(prog(t, 10.56, 10.9)), o = E.in(prog(t, 14.5, 14.8));
      a = i * (1 - o); dy = (1 - i) * 26 + o * 26;
    }
    if (a <= 0.001) return;
    const k = statusKF(t);
    const r = Math.round(k.r * 10) / 10, c = Math.round(k.c);
    ctx.save();
    ctx.globalAlpha = a;
    Art.statusBar(ctx, STAGE.cx, 914 + dy, r, c, clamp((k.c - 30) / 100));
    ctx.restore();
  }

  // ── Typography ────────────────────────────────────────────────────────────
  const W_ = '#FFFFFF', G_ = C.gray;
  const HEADLINES = [
    { segs: 'Want a review?', y: 304, size: 52, color: W_, tin: 0.14, tout: 1.9 },
    { segs: 'Watch the struggle.', y: 370, size: 52, color: G_, tin: 0.26, tout: 1.94 },
    { segs: 'Too many steps.', y: 530, size: 60, color: W_, tin: 3.32, tout: 4.16 },
    { segs: 'Customers give up.', y: 602, size: 60, color: C.red, tin: 3.44, tout: 4.2 },
    { segs: 'There is a faster way.', y: 270, size: 52, color: W_, tin: 4.56, tout: 5.2 },
    { segs: 'One Tap.', x: 1214, align: 'left', y: 510, size: 54, color: W_, tin: 6.78, tout: 7.74 },
    { segs: 'Straight to 5 stars.', x: 1214, align: 'left', y: 576, size: 50, color: C.blue, tin: 6.9, tout: 7.78 },
    { segs: 'More reviews.', y: 528, size: 64, color: W_, tin: 11.86, tout: 12.8 },
    { segs: 'Higher ranking.', y: 604, size: 64, color: C.gold, tin: 11.97, tout: 12.84 },
    { segs: 'Turn every visit into trust', y: 272, size: 46, color: W_, tin: 13.02, tout: 14.48 },
    { segs: 'Effortless for customers. Powerful for you.', y: 806, size: 25, weight: 400, ls: -0.2, color: G_, tin: 14.04, tout: 14.48 },
  ];

  // ── 15.8 – 18.0  Final lockup ─────────────────────────────────────────────
  function drawLockup(t) {
    if (t < 15.9) return;
    const X = 1080;
    // G badge with masked rise
    const pb = E.out(prog(t, 15.98, 16.5));
    if (pb > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(X - 40, 360, 200, 140); ctx.clip();
      ctx.globalAlpha = clamp(pb * 1.5);
      U.gBadge(ctx, X + 40, 432 + (1 - pb) * 90, 40, true);
      ctx.restore();
    }
    for (let i = 0; i < 5; i++) {
      const p = E.arrive(prog(t, 16.1 + i * 0.055, 16.48 + i * 0.055));
      if (p <= 0) continue;
      ctx.save();
      ctx.globalAlpha = clamp(p * 2);
      ctx.translate(X + 16 + i * 40, 518); ctx.scale(p, p);
      U.star(ctx, 0, 0, 16, 1, C.gold);
      ctx.restore();
    }
    U.maskLine(ctx, 'One Tap.', X - 3, 622, { size: 74, weight: 700, align: 'left', ls: -2, color: W_ }, E.out(prog(t, 16.2, 16.8)));
    U.maskLine(ctx, [['Instant ', C.blue], ['5-Star', C.gold], [' Reviews.', C.blue]], X, 690, { size: 46, weight: 600, align: 'left', ls: -0.8 }, E.out(prog(t, 16.34, 16.94)));
  }

  // ── Frame ─────────────────────────────────────────────────────────────────
  TL.frame = function (t) {
    t = clamp(t, 0, TL.DURATION - 1e-6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.save();
    U.rr(ctx, STAGE.x, STAGE.y, STAGE.w, STAGE.h, STAGE.r);
    ctx.clip();
    ctx.drawImage(stageCanvas, 0, 0);
    drawBlue(t);
    drawRipple(t);
    drawBrowser(t);
    drawDropScrim(t);
    drawWall(t);
    drawGL(t);
    drawPulse(t);
    drawCards(t);
    U.headline(ctx, t, HEADLINES);
    drawLockup(t);
    drawStatus(t);
    ctx.restore();
    // hairline stage rim
    U.rr(ctx, STAGE.x + 0.5, STAGE.y + 0.5, STAGE.w - 1, STAGE.h - 1, STAGE.r);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
  };
})();
