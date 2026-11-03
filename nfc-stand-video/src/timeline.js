// ─────────────────────────────────────────────────────────────────────────────
// timeline.js — the film. TL.frame(t) renders one complete frame as a pure
// function of absolute time t (seconds); frames can be rendered in any order.
//
// Story (18 s, deliberately unhurried — one idea per beat):
//   0.0 – 3.8   The old way: searching Google is a hassle
//   3.8 – 5.5   The stand appears
//   5.5 – 7.9   The phone is pressed flat against the stand (NFC tap at 6.45)
//   7.7 – 9.6   Notification → Google review dialog
//   9.6 – 12.1  Five stars fill, Post
//  12.1 – 14.9  Hebrew customer reviews
//  14.9 – 18.0  Hero stand + "One Tap. Instant 5-Star Reviews."
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

  // ── Shared cue times (picture, SFX and voice-over all read these) ─────────
  TL.QUERY = 'ביסטרו 42 כפר סבא ביקורות';
  TL.typeTimes = () => {
    const n = TL.QUERY.length;
    return Array.from({ length: n }, (_, i) => 1.0 + (1.1 * (i + 0.3 * Math.sin(i * 2.3))) / n);
  };
  const TYPE = TL.typeTimes();
  TL.CUES = {
    nfc: 6.45, notify: 7.78, stars: [10.15, 10.35, 10.55, 10.75, 10.95], post: 11.5, final: 16.2,
  };
  // Narration script + start times: see voiceover/script.json (mixed in by tools/render.js).

  // ── Setup ─────────────────────────────────────────────────────────────────
  TL.init = function (mainCtx) {
    ctx = mainCtx;
    bgCanvas = buildBackground();
    stageCanvas = buildStage();
    phoneCv = Art.canvas(Art.PHONE_TEX.w, Art.PHONE_TEX.h);
    R3.setTexture('stand', Art.standFace());
    Art.phoneFace(phoneCv, {});
    R3.setTexture('phone', phoneCv);
  };

  function dither(x, amt, seed) {
    const id = x.getImageData(0, 0, U.W, U.H), d = id.data, rnd = U.rng(seed);
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(id, 0, 0);
  }
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
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 90; x.shadowOffsetY = 24;
    U.rr(x, STAGE.x, STAGE.y, STAGE.w, STAGE.h, STAGE.r); x.fillStyle = C.stage; x.fill();
    x.restore();
    dither(x, 3, 7);
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
    dither(x, 2.2, 11);
    return cv;
  }

  // ── Stand pose ────────────────────────────────────────────────────────────
  const standA = U.KF([
    [3.85, { sx: 960, sy: 1230, scale: 0.95, yaw: -50 }],
    [4.95, { sx: 960, sy: 862, scale: 1.0, yaw: 20 }, E.out],
    [5.45, { yaw: 17 }, E.smooth],
    [6.2, { sx: 960, sy: 975, scale: 1.3, yaw: 9 }, E.inOut],
    [7.0, {}],
    [7.9, { sx: 560, sy: 842, scale: 0.95, yaw: 24 }, E.inOut],
    [9.9, { yaw: 26 }, E.smooth],
  ]);
  const standC = U.KF([
    [14.9, { sx: 960, sy: 1230, scale: 0.95, yaw: -40 }],
    [15.75, { sx: 960, sy: 862, scale: 1.02, yaw: 6 }, E.out],
    [16.0, { yaw: 8 }, E.smooth],
    [16.85, { sx: 690, sy: 862, scale: 1.04, yaw: 22 }, E.inOut],
    [18.0, { yaw: 24 }, E.smooth],
  ]);
  function standPose(t) {
    let p = null;
    if (t >= 3.85 && t < 9.9) p = standA(t);
    else if (t >= 14.9) p = standC(t);
    if (!p) return null;
    p.yaw *= DEG;
    const g1 = prog(t, 6.5, 7.3), g2 = prog(t, 16.9, 17.8);
    if (g1 > 0 && g1 < 1) { p.glossPos = lerp(-0.4, 1.9, E.inOut(g1)); p.glossAmt = 0.8; }
    else if (g2 > 0 && g2 < 1) { p.glossPos = lerp(-0.4, 1.9, E.inOut(g2)); p.glossAmt = 0.5; }
    else p.glossAmt = 0;
    return p;
  }
  TL.standPose = standPose;
  const glAlpha = (t) => (t < 9.9 ? 1 - E.inOut(prog(t, 9.55, 9.82)) : 1);

  // ── Phone pose: pressed flat against the stand's face ─────────────────────
  function lerpPose(a, b, p) { const o = {}; for (const k in b) o[k] = lerp(a[k], b[k], p); return o; }
  function attachPose(sp, gap, shake) {
    const Mp = R3.panelMatrix(R3.standMatrix(sp));
    const w = R3.M.apply(Mp, [shake, D.panelH * 0.535, D.phoneT / 2 + 0.0015 + gap]);
    return { x: w[0], y: w[1], z: w[2], yaw: sp.yaw, pitch: -D.tilt, roll: 0, scale: sp.scale };
  }
  function phonePose(t) {
    if (t < 5.6 || t >= 9.9) return null;
    const sp = standPose(t);
    const s0 = R3.screenToWorld(2300, 420, 0.18);
    const from = { x: s0[0], y: s0[1], z: s0[2], yaw: 0.75, pitch: -0.05, roll: -0.3, scale: sp.scale };
    const gap = lerp(0.08, 0, E.inOut(prog(t, 6.2, 6.45))) + 0.07 * E.inOut(prog(t, 6.95, 7.25));
    // short haptic buzz right after contact
    const hb = prog(t, 6.46, 6.78);
    const shake = hb > 0 && hb < 1 ? 0.0016 * Math.sin(2 * PI * 23 * (t - 6.46)) * Math.sin(PI * hb) : 0;
    let p = lerpPose(from, attachPose(sp, gap, shake), E.out(prog(t, 5.6, 6.25)));
    const c = R3.screenToWorld(1000, 545, 0.55);
    p = lerpPose(p, { x: c[0], y: c[1], z: c[2], yaw: 0, pitch: 0, roll: 0, scale: 1 }, E.inOut(prog(t, 7.05, 7.9)));
    p.glossAmt = 0;
    return p;
  }
  function phoneState(t) {
    return {
      nfc: prog(t, 6.45, 7.1),
      banner: E.out(prog(t, TL.CUES.notify, TL.CUES.notify + 0.3)),
      morph: E.inOut(prog(t, 8.25, 8.7)),
      dim: E.inOut(prog(t, 8.25, 8.7)),
    };
  }
  let modalRect0 = null;
  function phoneModalRect() {
    if (modalRect0) return modalRect0;
    const p = phonePose(9.55), Mo = Art.PHONE_MODAL, PT = Art.PHONE_TEX, I = PT.inset;
    const mh = (Mo.w * 293) / 324;
    const a = R3.project(R3.phoneUVWorld(p, (I + Mo.x) / PT.w, (I + Mo.y) / PT.h));
    const b = R3.project(R3.phoneUVWorld(p, (I + Mo.x + Mo.w) / PT.w, (I + Mo.y + mh) / PT.h));
    modalRect0 = { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] };
    return modalRect0;
  }

  // ── 3D layer ──────────────────────────────────────────────────────────────
  function drawGL(t) {
    const sp = standPose(t), pp = phonePose(t);
    if (!sp && !pp) return;
    const a = glAlpha(t);
    if (a <= 0.001) return;
    if (pp) { Art.phoneFace(phoneCv, phoneState(t)); R3.setTexture('phone', phoneCv); }
    if (sp) { // soft blue floor pool
      const base = R3.project(R3.M.apply(R3.standMatrix(sp), [0, 0, -0.08]).slice(0, 3));
      const k = (R3.CAM.pos[2] / base[2]) * sp.scale;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(base[0], base[1]); ctx.scale(1, 0.2);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 520 * k);
      g.addColorStop(0, 'rgba(66,133,244,0.18)'); g.addColorStop(0.5, 'rgba(26,115,232,0.06)'); g.addColorStop(1, 'rgba(26,115,232,0)');
      ctx.fillStyle = g; ctx.fillRect(-600 * k, -600 * k, 1200 * k, 1200 * k);
      ctx.restore();
    }
    const glc = R3.render({ stand: sp, phone: pp });
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(glc, 0, 0, U.W, U.H);
    ctx.restore();
  }

  function touch(x, y, alpha, press, ripple) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (ripple > 0 && ripple < 1) {
      ctx.beginPath(); ctx.arc(x, y, 24 + 46 * E.out(ripple), 0, PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - ripple)})`; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, 24 * (1 - 0.16 * press), 0, PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.16 + 0.22 * press})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  // ── 0.0 – 3.8  The old way ────────────────────────────────────────────────
  const RESULTS = [
    { site: 'מדריך המסעדות', url: 'citybites.example › kfar-saba', title: '10 המסעדות הטובות בכפר סבא (2026)', snip: 'רשימה מעודכנת · מחירים, תפריטים ושעות פתיחה…', fav: '#E37400', ad: true },
    { site: 'FoodGuide', url: 'foodguide.example › bistro-42', title: 'ביסטרו 42 – תפריט, מחירים ושעות פתיחה', snip: 'תמונות, תפריט, הוראות הגעה ו־42 ביקורות…', fav: '#1E8E3E' },
    { site: 'פורום מקומי', url: 'localforum.example › threads', title: 'ביסטרו 42 כפר סבא – איפה משאירים ביקורת?', snip: '„מישהו יודע איך מגיעים בכלל לדף הביקורות?”', fav: '#5F6368' },
  ];
  const COL_X = 580, COL_W = 760;
  function drawBrowser(t) {
    if (t >= 3.8) return;
    const S = 120 * E.inOut(prog(t, 2.75, 3.4));
    const dim = E.inOut(prog(t, 2.85, 3.35));
    const fold = E.in(prog(t, 3.3, 3.75));
    ctx.save();
    const cx = STAGE.cx, cy = STAGE.cy;
    ctx.translate(cx, cy); ctx.scale(1 - 0.06 * dim - 0.2 * fold, (1 - 0.06 * dim) * (1 - 0.985 * fold)); ctx.translate(-cx, -cy);
    ctx.globalAlpha = (1 - 0.45 * dim) * (1 - fold);
    ctx.translate(0, -S);
    const grow = E.arrive(prog(t, 0.25, 0.85));
    ctx.save();
    ctx.globalAlpha *= clamp(prog(t, 0.25, 0.4));
    const typed = TL.QUERY.slice(0, TYPE.filter((x) => x <= t).length);
    const cursor = t < 2.15 ? t >= 0.75 : Math.floor((t - 2.15) / 0.3) % 2 === 1;
    Art.searchBar(ctx, STAGE.cx, 470, lerp(84, COL_W, grow), lerp(64, 72, grow), typed, cursor && t < 2.8);
    ctx.restore();
    RESULTS.forEach((r, i) => {
      const a0 = 2.0 + i * 0.16, p = E.out(prog(t, a0, a0 + 0.55));
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp(p * 1.3);
      ctx.translate(0, (1 - p) * 26);
      Art.linkResult(ctx, COL_X, 540 + i * 114, COL_W, r);
      ctx.restore();
    });
    ctx.restore();
  }

  // ── 3.8  Reveal ripple ────────────────────────────────────────────────────
  function drawRipple(t) {
    const p = prog(t, 3.85, 4.9);
    if (p <= 0 || p >= 1) return;
    const r = 40 + 1150 * E.out(p), a = 0.4 * (1 - p) * clamp(p * 8);
    const cx = STAGE.cx, cy = 760;
    const g = ctx.createRadialGradient(cx, cy, Math.max(0, r - 160), cx, cy, r);
    g.addColorStop(0, 'rgba(66,133,244,0)');
    g.addColorStop(0.82, `rgba(66,133,244,${a * 0.6})`);
    g.addColorStop(0.97, `rgba(160,195,255,${a})`);
    g.addColorStop(1, 'rgba(66,133,244,0)');
    ctx.fillStyle = g; ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
  }

  // ── 6.45  NFC pulse ───────────────────────────────────────────────────────
  let tapPoint = null;
  function drawPulse(t) {
    if (t < 6.4 || t > 7.6) return;
    if (!tapPoint) tapPoint = R3.project(R3.badgeWorld(standPose(TL.CUES.nfc)));
    const [x, y] = tapPoint;
    for (let k = 0; k < 2; k++) {
      const p = prog(t, TL.CUES.nfc + k * 0.16, TL.CUES.nfc + k * 0.16 + 0.95);
      if (p <= 0 || p >= 1) continue;
      ctx.beginPath(); ctx.arc(x, y, 60 + 330 * E.out(p), 0, PI * 2);
      ctx.strokeStyle = U.mix('#FFFFFF', C.blue, p, Math.pow(1 - p, 1.5) * 0.7);
      ctx.lineWidth = 2.4 * (1 - p * 0.5);
      ctx.stroke();
    }
  }

  // ── 9.55 – 12.2  Review dialog → five stars → Post ────────────────────────
  const HERO = { x: 960 - 324, y: 250, w: 648 };
  function starState(t) {
    const fills = [], pulses = [];
    TL.CUES.stars.forEach((s) => { fills.push(E.out(prog(t, s, s + 0.12))); pulses.push(E.bump(prog(t, s, s + 0.28))); });
    return { fills, pulses, post: E.smooth(prog(t, 11.15, 11.32)), press: E.bump(prog(t, TL.CUES.post, TL.CUES.post + 0.18)) };
  }
  function drawHeroCard(t) {
    if (t < 9.55 || t >= 12.25) return;
    const r0 = phoneModalRect();
    const p = E.inOut(prog(t, 9.55, 9.98));
    const out = E.inOut(prog(t, 11.85, 12.2));
    const w = lerp(r0.w, HERO.w, p) * (1 - 0.08 * out);
    const cx = lerp(r0.x + r0.w / 2, HERO.x + HERO.w / 2, p), cy = lerp(r0.y + r0.h / 2, HERO.y + HERO.w * 293 / 648, p) - 24 * out;
    const h = (w * 293) / 324;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    const gl = E.smooth(prog(t, 9.8, 10.2));
    if (gl > 0) {
      const g = ctx.createRadialGradient(960, 560, 0, 960, 560, 560);
      g.addColorStop(0, `rgba(66,133,244,${0.1 * gl})`); g.addColorStop(1, 'rgba(66,133,244,0)');
      ctx.fillStyle = g; ctx.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
    }
    Art.reviewModal(ctx, cx - w / 2, cy - h / 2, w, starState(t));
    ctx.restore();
    const tp = { x: HERO.x + (Art.modalPost.x + Art.modalPost.w / 2) * 2, y: HERO.y + (Art.modalPost.y + Art.modalPost.h / 2) * 2 };
    const ta = clamp(prog(t, 11.25, 11.4)) * (1 - prog(t, 11.75, 11.9));
    const mv = E.out(prog(t, 11.25, 11.5));
    touch(lerp(tp.x - 130, tp.x, mv), lerp(tp.y + 90, tp.y, mv), ta, E.bump(prog(t, TL.CUES.post, TL.CUES.post + 0.18)), prog(t, TL.CUES.post, TL.CUES.post + 0.4));
  }

  // ── 12.1 – 14.9  Customer reviews (Hebrew) ────────────────────────────────
  const REVIEWS = [
    { name: 'נועה כ.', initial: 'נ', color: '#34A853', meta: 'לפני יומיים', text: 'הצמדתי את הטלפון והביקורת נשלחה תוך שניות!', biz: 'קפה ארומה', bizInitial: 'ק', bizColor: '#7B4B2A' },
    { name: 'דניאל ר.', initial: 'ד', color: '#4285F4', meta: 'לפני שבוע', text: 'הכי פשוט שיש. ממליץ בחום!', biz: 'סטודיו אאורה', bizInitial: 'ס', bizColor: '#8E44AD' },
    { name: 'מאיה ש.', initial: 'מ', color: '#EA4335', meta: 'אתמול', text: 'טאפ אחד וחמישה כוכבים. מושלם.', biz: 'ביסטרו 42', bizInitial: 'ב', bizColor: '#B3261E' },
  ];
  function drawReviews(t) {
    if (t < 12.4 || t > 14.95) return;
    const X = [1424, 960, 496], TILT = [0.035, 0, -0.035];
    REVIEWS.forEach((d, i) => {
      const p = E.out(prog(t, 12.45 + i * 0.2, 13.2 + i * 0.2));
      const o = E.inOut(prog(t, 14.45 + i * 0.05, 14.85 + i * 0.05));
      if (p <= 0 || o >= 1) return;
      ctx.save();
      ctx.globalAlpha = clamp(p * 1.5) * (1 - o);
      ctx.translate(X[i], 585 + (1 - p) * 90 - 30 * o);
      ctx.rotate(TILT[i] * (0.4 + 0.6 * (1 - p)));
      const s = 1.06 * (0.92 + 0.08 * p);
      ctx.scale(s, s * (0.8 + 0.2 * p));
      ctx.translate(-200, -85);
      Art.reviewCard(ctx, d);
      ctx.restore();
    });
  }

  // ── Typography ────────────────────────────────────────────────────────────
  const W_ = '#FFFFFF', G_ = C.gray;
  const HEB = { family: 'Rubik', dir: 'rtl', weight: 600, ls: 0 };
  const HEADLINES = [
    Object.assign({ segs: 'רוצים ביקורת בגוגל?', y: 300, size: 54, color: W_, tin: 0.15, tout: 3.15 }, HEB),
    Object.assign({ segs: 'ללקוחות זה מסובך מדי.', y: 370, size: 54, color: G_, tin: 0.32, tout: 3.2 }, HEB),
    Object.assign({ segs: 'יש דרך פשוטה יותר.', y: 272, size: 54, color: W_, tin: 4.35, tout: 5.45 }, HEB),
    Object.assign({ segs: 'טאפ אחד.', x: 1660, align: 'right', y: 505, size: 58, color: W_, tin: 8.0, tout: 9.4 }, HEB),
    Object.assign({ segs: 'ישר לחמישה כוכבים.', x: 1660, align: 'right', y: 578, size: 50, color: C.blue, tin: 8.15, tout: 9.45 }, HEB),
    Object.assign({ segs: 'כל ביקור הופך לביקורת', y: 300, size: 52, color: W_, tin: 12.2, tout: 14.5 }, HEB),
  ];

  // ── 16.2 – 18.0  Final lockup (kept in English) ───────────────────────────
  function drawLockup(t) {
    if (t < 16.25) return;
    const X = 1080;
    const pb = E.out(prog(t, 16.3, 16.85));
    if (pb > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(X - 40, 360, 200, 140); ctx.clip();
      ctx.globalAlpha = clamp(pb * 1.5);
      U.gBadge(ctx, X + 40, 432 + (1 - pb) * 90, 40, true);
      ctx.restore();
    }
    for (let i = 0; i < 5; i++) {
      const p = E.arrive(prog(t, 16.45 + i * 0.07, 16.85 + i * 0.07));
      if (p <= 0) continue;
      ctx.save();
      ctx.globalAlpha = clamp(p * 2);
      ctx.translate(X + 16 + i * 40, 518); ctx.scale(p, p);
      U.star(ctx, 0, 0, 16, 1, C.gold);
      ctx.restore();
    }
    U.maskLine(ctx, 'One Tap.', X - 3, 622, { size: 74, weight: 700, align: 'left', ls: -2, color: W_, family: 'Inter' }, E.out(prog(t, 16.6, 17.25)));
    U.maskLine(ctx, [['Instant ', C.blue], ['5-Star', C.gold], [' Reviews.', C.blue]], X, 690, { size: 46, weight: 600, align: 'left', ls: -0.8, family: 'Inter' }, E.out(prog(t, 16.78, 17.4)));
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
    drawRipple(t);
    drawBrowser(t);
    drawGL(t);
    drawPulse(t);
    drawHeroCard(t);
    drawReviews(t);
    U.headline(ctx, t, HEADLINES);
    drawLockup(t);
    ctx.restore();
    U.rr(ctx, STAGE.x + 0.5, STAGE.y + 0.5, STAGE.w - 1, STAGE.h - 1, STAGE.r);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
  };
})();
