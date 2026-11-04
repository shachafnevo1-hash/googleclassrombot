// ─────────────────────────────────────────────────────────────────────────────
// art.js — procedural artwork: the stand's printed face (matched to the real
// product), the phone screen, and Hebrew (RTL) UI components.
// All drawers take explicit state; nothing here reads the clock.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const A = (window.Art = {});
  const { C } = U;
  const PI = Math.PI;
  const HE = { family: 'Rubik', dir: 'rtl', align: 'right' };
  const he = (o) => Object.assign({}, HE, o);

  A.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  // ── Hero product: printed face of the stand ──────────────────────────────
  // Layout units are 920 × 1400; the texture is rendered at 2× (1840 × 2800).
  // Matched to the real product photos: satin indigo-navy print, small orange
  // stars, Open Sans Hebrew headline, thin light-blue wave band, printed white
  // G disc with a soft shadow, regular/bold mixed body line, thin grey NFC icon.
  A.STAND_LAYOUT = { badgeV: 0.552, badgeR: 0.145 }; // fractions of H / W
  A.standFace = function () {
    const W = 920, H = 1400, R = 46, K = 2;
    const cv = A.canvas(W * K, H * K), x = cv.getContext('2d');
    x.scale(K, K);
    x.beginPath();
    x.moveTo(0, H); x.lineTo(0, R); x.arcTo(0, 0, R, 0, R); x.lineTo(W - R, 0); x.arcTo(W, 0, W, R, R); x.lineTo(W, H); x.closePath();
    x.save();
    x.clip();
    x.fillStyle = '#FFFFFF';
    x.fillRect(0, 0, W, H);

    // wave (measured from the real print): rises from the left edge toward the
    // G disc, then descends to the right. Navy above, a bright blue band, white below.
    const WV = (k) => {
      const p = (x, y) => [x * W, y * H + k];
      return { a: p(0, 0.536), c1: p(0.18, 0.528), c2: p(0.3, 0.508), m: p(0.5, 0.53), c3: p(0.68, 0.55), c4: p(0.82, 0.585), e: p(1, 0.593) };
    };
    const wavePath = (ctx, k, close) => {
      const w = WV(k);
      if (close) { ctx.moveTo(-2, -2); ctx.lineTo(W + 2, -2); ctx.lineTo(W + 2, w.e[1]); }
      else ctx.moveTo(W + 2, w.e[1]);
      ctx.bezierCurveTo(w.c4[0], w.c4[1], w.c3[0], w.c3[1], w.m[0], w.m[1]);
      ctx.bezierCurveTo(w.c2[0], w.c2[1], w.c1[0], w.c1[1], -2, w.a[1]);
      if (close) ctx.closePath();
    };
    const band = H * 0.0145;
    x.beginPath(); wavePath(x, band, true);
    let g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#3C84DE'); g.addColorStop(0.5, '#2F76D6'); g.addColorStop(1, '#2A6DCC');
    x.fillStyle = g; x.fill();
    x.beginPath(); wavePath(x, 0, true);
    g = x.createLinearGradient(0, 0, W * 0.3, H * 0.6);
    g.addColorStop(0, '#2B2E8E'); g.addColorStop(0.5, '#24277C'); g.addColorStop(1, '#1E206C');
    x.fillStyle = g; x.fill();

    // small orange stars
    for (let i = 0; i < 5; i++) U.star(x, W / 2 + (i - 2) * W * 0.076, H * 0.125, W * 0.022, 1, '#F2804A');

    // headline (measured): upright semi-bold Hebrew, only "Tap" in italic
    const hb = { size: 100, weight: 700, family: 'Open Sans', color: '#FFFFFF', dir: 'rtl', align: 'right' };
    const hs = (100 * W * 0.63) / U.measure(x, 'ושימו דירוג!', hb);
    const H1 = Object.assign({}, hb, { size: hs }), T1 = Object.assign({}, H1, { italic: true, dir: 'ltr' });
    const wTap = U.measure(x, 'Tap', T1), wSp = U.measure(x, ' ', H1), wHe = U.measure(x, 'אחד', H1);
    const r1 = W / 2 + (wTap + wSp + wHe) / 2;
    U.text(x, 'Tap', r1, H * 0.254, Object.assign({}, T1, { align: 'right' }));
    U.text(x, 'אחד', r1 - wTap - wSp, H * 0.254, H1);
    U.text(x, 'ושימו דירוג!', W / 2, H * 0.355, Object.assign({}, H1, { align: 'center' }));

    // printed G disc: white, hairline grey edge, darker printed drop shadow below
    const bY = H * A.STAND_LAYOUT.badgeV, bR = W * A.STAND_LAYOUT.badgeR;
    x.save();
    x.shadowColor = 'rgba(20,20,30,0.55)'; x.shadowBlur = bR * 0.16; x.shadowOffsetY = bR * 0.09;
    x.beginPath(); x.arc(W / 2, bY, bR, 0, PI * 2); x.fillStyle = '#FFFFFF'; x.fill();
    x.restore();
    const dg = x.createRadialGradient(W / 2, bY - bR * 0.3, bR * 0.2, W / 2, bY, bR);
    dg.addColorStop(0, '#FFFFFF'); dg.addColorStop(0.85, '#FAFAFA'); dg.addColorStop(1, '#EDEDED');
    x.beginPath(); x.arc(W / 2, bY, bR, 0, PI * 2); x.fillStyle = dg; x.fill();
    x.beginPath(); x.arc(W / 2, bY, bR - 1, 0, PI * 2); x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 2; x.stroke();
    U.gLogo(x, W / 2, bY, bR * 0.74);

    // body line: grey regular with bold "להצמיד" and "זהו!", right → left, measured width
    const segs = [['פשוט רק ', 400], ['להצמיד', 700], [' את הטלפון, ', 400], ['זהו!', 700]];
    const base0 = { size: 100, family: 'Open Sans', color: '#2A2B30', dir: 'rtl', align: 'right' };
    const w0 = segs.reduce((acc, [t, w]) => acc + U.measure(x, t, Object.assign({}, base0, { weight: w })), 0);
    const base = Object.assign({}, base0, { size: (100 * W * 0.84) / w0 });
    const ws = segs.map(([t, w]) => U.measure(x, t, Object.assign({}, base, { weight: w })));
    const tot = ws.reduce((a, b) => a + b, 0);
    let rx = W / 2 + tot / 2;
    segs.forEach(([t, w], i) => { U.text(x, t, rx, H * 0.742, Object.assign({}, base, { weight: w })); rx -= ws[i]; });

    // NFC pictogram (measured): [NFC] tag, two arcs, phone outline; thin dark strokes
    x.save();
    const ink = '#2E2F33', cy = H * 0.863, ph = H * 0.121, pw = W * 0.118;
    x.strokeStyle = ink; x.lineWidth = W * 0.0075; x.lineJoin = 'round'; x.lineCap = 'round';
    const tx = W / 2 - W * 0.072, tw = W * 0.106, th = W * 0.06;
    U.rr(x, tx - tw / 2, cy - th / 2, tw, th, th * 0.28); x.stroke();
    U.text(x, 'NFC', tx, cy + 1, { size: th * 0.55, weight: 700, family: 'Open Sans', color: ink, align: 'center', baseline: 'middle' });
    const ax = W / 2 + W * 0.012;
    for (let i = 0; i < 2; i++) { x.beginPath(); x.arc(ax - W * 0.03 + i * 2, cy, W * (0.022 + i * 0.022), -0.85, 0.85); x.stroke(); }
    const px = W / 2 + W * 0.134;
    U.rr(x, px - pw / 2, cy - ph / 2, pw, ph, pw * 0.2); x.stroke();
    U.rr(x, px - pw * 0.2, cy - ph / 2 + ph * 0.08, pw * 0.4, ph * 0.04, ph * 0.02); x.fillStyle = ink; x.fill();
    x.restore();
    x.restore();
    return cv;
  };

  // ── Review dialog (Hebrew, RTL) — design unit 324 × 293 ───────────────────
  A.MODAL = { w: 324, h: 293 };
  A.modalPost = { x: 18, y: 246, w: 78, h: 30 };
  // Star i (0 = first to fill) sits at the right in an RTL layout.
  A.modalStarX = (i) => 162 + (2 - i) * 46;
  A.reviewModal = function (ctx, x, y, w, st) {
    const u = w / 324;
    st = st || {};
    const fills = st.fills || [0, 0, 0, 0, 0];
    const pulses = st.pulses || [0, 0, 0, 0, 0];
    ctx.save();
    if (!st.noCard) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 14 * u;
      U.rr(ctx, x, y, w, 293 * u, 22 * u);
      ctx.fillStyle = '#1B1E24'; ctx.fill();
      ctx.restore();
      U.rr(ctx, x + 0.5, y + 0.5, w - 1, 293 * u - 1, 22 * u);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.translate(x, y); ctx.scale(u, u);
    ctx.globalAlpha *= st.content == null ? 1 : st.content;
    U.avatar(ctx, 286, 40, 18, '#B3261E', '42');
    U.text(ctx, 'ביסטרו 42', 258, 37, he({ size: 17, weight: 600, color: '#fff' }));
    U.text(ctx, 'מסעדה · כפר סבא', 258, 55, he({ size: 11.5, weight: 400, color: C.gray }));
    ctx.strokeStyle = '#7C828A'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(23, 32); ctx.lineTo(33, 42); ctx.moveTo(33, 32); ctx.lineTo(23, 42); ctx.stroke();
    ctx.fillStyle = '#2A2F3A'; ctx.fillRect(18, 72, 288, 1);
    U.avatar(ctx, 290, 99, 13, '#4285F4', 'ד');
    U.text(ctx, 'דנה לוי', 268, 96, he({ size: 13, weight: 500, color: '#E8EAED' }));
    U.text(ctx, 'הביקורת תפורסם באופן ציבורי', 268, 111, he({ size: 10.5, weight: 400, color: C.gray }));
    for (let i = 0; i < 5; i++) {
      const cx = A.modalStarX(i), cy = 152;
      const s = 1 + 0.2 * pulses[i];
      if (pulses[i] > 0.01) {
        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
        gg.addColorStop(0, U.rgba(C.gold, 0.25 * pulses[i])); gg.addColorStop(1, U.rgba(C.gold, 0));
        ctx.fillStyle = gg; ctx.fillRect(cx - 30, cy - 30, 60, 60);
      }
      U.star(ctx, cx, cy, 16.5 * s, fills[i], C.gold, '#6B7079', 1.6);
    }
    U.rr(ctx, 18, 182, 288, 44, 10); ctx.strokeStyle = '#3C4043'; ctx.lineWidth = 1; ctx.stroke();
    U.text(ctx, 'שתפו פרטים על החוויה שלכם', 294, 208, he({ size: 11, weight: 400, color: '#7C828A' }));
    const p = st.post || 0, b = A.modalPost;
    U.text(ctx, 'ביטול', 136, 266, he({ size: 12.5, weight: 500, color: '#8AB4F8', align: 'center' }));
    U.rr(ctx, b.x, b.y, b.w, b.h, 15);
    ctx.fillStyle = U.mix('#2A2F3A', C.blue, p); ctx.fill();
    if (st.press) { U.rr(ctx, b.x, b.y, b.w, b.h, 15); ctx.fillStyle = `rgba(255,255,255,${0.18 * st.press})`; ctx.fill(); }
    U.text(ctx, 'פרסום', b.x + b.w / 2, b.y + 20, he({ size: 13, weight: 600, color: U.mix('#6B7079', '#FFFFFF', p), align: 'center' }));
    ctx.restore();
  };

  // ── Smartphone face texture (840 × 1600) ──────────────────────────────────
  A.PHONE_TEX = { w: 840, h: 1600, inset: 22 };
  A.PHONE_MODAL = { x: 48, y: 560, w: 700 }; // in screen coords (796 × 1556)
  A.phoneFace = function (cv, st) {
    const W = 840, H = 1600, x = cv.getContext('2d');
    x.clearRect(0, 0, W, H);
    U.rr(x, 0, 0, W, H, 118); x.fillStyle = '#07080A'; x.fill();
    const I = A.PHONE_TEX.inset, SW = W - 2 * I, SH = H - 2 * I;
    x.save();
    x.translate(I, I);
    U.rr(x, 0, 0, SW, SH, 98); x.clip();
    let g = x.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, '#0E1F4A'); g.addColorStop(0.55, '#081129'); g.addColorStop(1, '#040507');
    x.fillStyle = g; x.fillRect(0, 0, SW, SH);
    let rg = x.createRadialGradient(SW * 0.8, SH * 0.25, 0, SW * 0.8, SH * 0.25, SW * 1.1);
    rg.addColorStop(0, 'rgba(66,133,244,0.32)'); rg.addColorStop(1, 'rgba(66,133,244,0)');
    x.fillStyle = rg; x.fillRect(0, 0, SW, SH);
    U.text(x, 'יום שלישי, 3 בנובמבר', SW / 2, 200, he({ size: 38, weight: 500, color: 'rgba(255,255,255,0.85)', align: 'center' }));
    U.text(x, '9:41', SW / 2, 400, { size: 200, weight: 600, color: 'rgba(255,255,255,0.95)', align: 'center', ls: -4 });
    if (st.nfc > 0) {
      const a = U.E.bump(st.nfc);
      rg = x.createRadialGradient(SW / 2, 0, 0, SW / 2, 0, SW * 0.9);
      rg.addColorStop(0, `rgba(138,180,248,${0.4 * a})`); rg.addColorStop(1, 'rgba(138,180,248,0)');
      x.fillStyle = rg; x.fillRect(0, 0, SW, SH);
    }
    if (st.dim > 0) { x.fillStyle = `rgba(0,0,0,${0.55 * st.dim})`; x.fillRect(0, 0, SW, SH); }
    if (st.banner > 0) {
      const by = U.lerp(-200, 64, st.banner);
      const bR = { x: 22, y: by, w: SW - 44, h: 168 };
      const Mo = A.PHONE_MODAL, mh = (Mo.w * 293) / 324;
      const m = st.morph || 0;
      const r = { x: U.lerp(bR.x, Mo.x, m), y: U.lerp(bR.y, Mo.y, m), w: U.lerp(bR.w, Mo.w, m), h: U.lerp(bR.h, mh, m) };
      x.save();
      x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 40; x.shadowOffsetY = 12;
      U.rr(x, r.x, r.y, r.w, r.h, 44);
      x.fillStyle = U.mix('#2B2E36', '#1B1E24', m); x.fill();
      x.restore();
      U.rr(x, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 44); x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 2; x.stroke();
      const ba = 1 - U.clamp(m * 3.2);
      if (ba > 0) {
        x.save(); x.globalAlpha = ba;
        U.gBadge(x, r.x + r.w - 78, r.y + 84, 46, false);
        U.text(x, 'ביקורות Google', r.x + r.w - 146, r.y + 74, he({ size: 38, weight: 600, color: '#FFFFFF' }));
        U.text(x, 'לחצו כדי לדרג', r.x + r.w - 146, r.y + 124, he({ size: 32, weight: 500, color: '#8AB4F8' }));
        U.text(x, 'NFC · עכשיו', r.x + 30, r.y + 70, { size: 26, weight: 400, color: C.gray, align: 'left', family: 'Inter, Rubik' });
        x.restore();
      }
      const ca = U.clamp((m - 0.45) / 0.55);
      if (ca > 0) A.reviewModal(x, r.x, r.y, r.w, { noCard: true, content: ca });
    }
    x.restore();
    U.rr(x, W / 2 - 96, 48, 192, 56, 28); x.fillStyle = '#000'; x.fill();
    return cv;
  };

  // ── Search UI (Hebrew, RTL) ───────────────────────────────────────────────
  A.searchBar = function (ctx, cx, cy, w, h, text, cursor) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    U.rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = '#1C1F26'; ctx.fill();
    ctx.restore();
    ctx.save();
    U.rr(ctx, cx - w / 2 + 0.5, cy - h / 2 + 0.5, w - 1, h - 1, h / 2);
    ctx.strokeStyle = '#30353F'; ctx.lineWidth = 1; ctx.stroke();
    U.rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.clip();
    const x0 = cx - w / 2, xr = cx + w / 2;
    // magnifier on the right (RTL)
    ctx.strokeStyle = '#9AA0A6'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(xr - 40, cy - 3, 10, 0, PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xr - 47.5, cy + 4.5); ctx.lineTo(xr - 55, cy + 12); ctx.stroke();
    const o = he({ size: 25, weight: 400, color: '#E8EAED' });
    U.text(ctx, text, xr - 74, cy + 9, o);
    if (cursor) {
      const tw = text ? U.measure(ctx, text, o) : 0;
      ctx.fillStyle = C.blue; ctx.fillRect(xr - 78 - tw, cy - 15, 2.5, 30);
    }
    // left: G + mic
    U.gLogo(ctx, x0 + 40, cy, 13);
    ctx.strokeStyle = '#9AA0A6'; ctx.lineWidth = 2.4;
    U.rr(ctx, x0 + 80, cy - 14, 12, 20, 6); ctx.stroke();
    ctx.beginPath(); ctx.arc(x0 + 86, cy - 2, 11, 0.15, PI - 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + 86, cy + 9); ctx.lineTo(x0 + 86, cy + 14); ctx.stroke();
    ctx.restore();
  };

  A.linkResult = function (ctx, x, y, w, d) {
    U.rr(ctx, x, y, w, 100, 14); ctx.fillStyle = '#12151A'; ctx.fill();
    ctx.strokeStyle = '#1F232B'; ctx.lineWidth = 1; ctx.stroke();
    const xr = x + w;
    ctx.beginPath(); ctx.arc(xr - 26, y + 26, 10, 0, PI * 2); ctx.fillStyle = d.fav || '#3C4043'; ctx.fill();
    U.text(ctx, d.site, xr - 46, y + 24, he({ size: 14, weight: 500, color: '#DADCE0' }));
    U.text(ctx, d.url, xr - 46, y + 41, { size: 11.5, weight: 400, color: '#7C828A', align: 'right' });
    U.text(ctx, d.title, xr - 18, y + 68, he({ size: 20, weight: 500, color: '#8AB4F8' }));
    U.text(ctx, d.snip, xr - 18, y + 89, he({ size: 13, weight: 400, color: '#7C828A' }));
    if (d.ad) U.text(ctx, 'ממומן', x + 18, y + 24, he({ size: 12, weight: 600, color: '#9AA0A6', align: 'left' }));
  };

  // ── Hebrew review card (unit 400 × 170, RTL) ──────────────────────────────
  A.reviewCard = function (ctx, d) {
    ctx.save();
    ctx.shadowColor = 'rgba(251,188,4,0.14)'; ctx.shadowBlur = 44;
    U.rr(ctx, 0, 0, 400, 170, 20);
    const g = ctx.createLinearGradient(0, 0, 0, 170);
    g.addColorStop(0, '#191C23'); g.addColorStop(1, '#13161C');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    U.rr(ctx, 0.5, 0.5, 399, 169, 20); ctx.strokeStyle = '#2A2F3A'; ctx.lineWidth = 1; ctx.stroke();
    U.avatar(ctx, 360, 40, 19, d.color, d.initial);
    const no = he({ size: 17, weight: 600, color: '#fff' });
    U.text(ctx, d.name, 330, 38, no);
    U.verified(ctx, 330 - U.measure(ctx, d.name, no) - 13, 32, 7.5);
    U.text(ctx, d.meta, 330, 57, he({ size: 12.5, weight: 400, color: C.gray }));
    U.gLogo(ctx, 32, 36, 11);
    for (let i = 0; i < 5; i++) U.star(ctx, 368 - i * 22, 88, 9, 1, C.gold);
    U.text(ctx, d.text, 376, 124, he({ size: 16, weight: 400, color: '#E8EAED' }));
    U.avatar(ctx, 368, 150, 8, d.bizColor, d.bizInitial);
    U.text(ctx, d.biz, 354, 154, he({ size: 12.5, weight: 500, color: C.gray }));
  };
})();
