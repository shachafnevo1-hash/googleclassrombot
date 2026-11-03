// ─────────────────────────────────────────────────────────────────────────────
// art.js — procedural artwork: product textures and UI components.
// All drawers take explicit state; nothing here reads the clock.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const A = (window.Art = {});
  const { C, E } = U;
  const PI = Math.PI;

  A.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  // ── Hero product: printed face of the acrylic stand (920 × 1400) ──────────
  // Matched to the real product: satin indigo-navy print, small orange stars,
  // Open Sans Hebrew headline, thin light-blue wave band, printed G disc,
  // regular/bold mixed RTL body line and a thin grey NFC pictogram.
  A.STAND_TEX = { w: 920, h: 1400 };
  A.STAND_LAYOUT = { badgeV: 0.528, badgeR: 0.122 }; // fractions of H / W
  A.standFace = function () {
    const W = 920, H = 1400, R = 46;
    const cv = A.canvas(W, H), x = cv.getContext('2d');
    x.beginPath();
    x.moveTo(0, H); x.lineTo(0, R); x.arcTo(0, 0, R, 0, R); x.lineTo(W - R, 0); x.arcTo(W, 0, W, R, R); x.lineTo(W, H); x.closePath();
    x.save();
    x.clip();
    x.fillStyle = '#FFFFFF';
    x.fillRect(0, 0, W, H);

    // wave: left high, dips under the badge, lower on the right
    const waveY = (k) => [H * 0.497, H * 0.522, H * 0.534, H * 0.556].map((v) => v + k);
    const wavePath = (ctx, k, close) => {
      const [y0, y1, y2, y3] = waveY(k);
      if (close) { ctx.moveTo(-2, -2); ctx.lineTo(W + 2, -2); ctx.lineTo(W + 2, y3); }
      else ctx.moveTo(W + 2, y3);
      ctx.bezierCurveTo(W * 0.78, y3 + 2, W * 0.66, y2 - 4, W * 0.5, y2 - 6);
      ctx.bezierCurveTo(W * 0.3, y1 - 6, W * 0.18, y0 - 2, -2, y0);
      if (close) ctx.closePath();
    };
    // light-blue band (fades into white)
    x.save();
    x.beginPath(); wavePath(x, 24, true);
    let g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#5B97DE'); g.addColorStop(0.5, '#3F80D6'); g.addColorStop(1, '#2F6FCB');
    x.fillStyle = g; x.fill();
    x.restore();
    x.save();
    x.beginPath(); wavePath(x, 24, false);
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 6; x.filter = 'blur(3px)'; x.stroke();
    x.restore();
    // navy print
    x.beginPath(); wavePath(x, 0, true);
    g = x.createLinearGradient(0, 0, W * 0.3, H * 0.56);
    g.addColorStop(0, '#24277A'); g.addColorStop(0.55, '#1E2066'); g.addColorStop(1, '#1A1B58');
    x.fillStyle = g; x.fill();

    // small orange stars
    for (let i = 0; i < 5; i++) U.star(x, W / 2 + (i - 2) * 52, H * 0.107, 15, 1, '#F2701F');

    // headline (Open Sans semi-bold italic, white), RTL paragraph
    const head = { size: 118, weight: 700, family: 'Open Sans', italic: true, color: '#FFFFFF', align: 'center', dir: 'rtl', ls: 0 };
    U.text(x, 'Tap אחד', W / 2, H * 0.236, head);
    U.text(x, 'ושימו דירוג!', W / 2, H * 0.33, head);

    // printed G disc with soft drop shadow
    const bY = H * A.STAND_LAYOUT.badgeV, bR = W * A.STAND_LAYOUT.badgeR;
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.38)'; x.shadowBlur = 26; x.shadowOffsetY = 10;
    x.beginPath(); x.arc(W / 2, bY, bR, 0, Math.PI * 2); x.fillStyle = '#FFFFFF'; x.fill();
    x.restore();
    U.gLogo(x, W / 2, bY, bR * 0.6);

    // body line: regular grey with bold "להצמיד" and "זהו!" — laid out right→left
    const segs = [['פשוט רק ', 400], ['להצמיד', 700], [' את הטלפון, ', 400], ['זהו!', 700]];
    const base = { size: 57, family: 'Open Sans', color: '#2E2F33', dir: 'rtl', align: 'right' };
    const ws = segs.map(([t, w]) => U.measure(x, t, Object.assign({}, base, { weight: w })));
    const tot = ws.reduce((a, b) => a + b, 0);
    let rx = W / 2 + tot / 2;
    segs.forEach(([t, w], i) => { U.text(x, t, rx, H * 0.705, Object.assign({}, base, { weight: w })); rx -= ws[i]; });

    // NFC pictogram: [NFC] tag + two arcs + phone outline, thin grey strokes
    x.save();
    const ink = '#3A3B40';
    x.strokeStyle = ink; x.lineWidth = 6; x.lineJoin = 'round'; x.lineCap = 'round';
    const cy = H * 0.872;
    x.translate(W / 2, cy); x.scale(1.2, 1.2); x.translate(-W / 2 - 3, -cy);
    U.rr(x, 316, cy - 26, 100, 52, 14); x.stroke();
    U.text(x, 'NFC', 366, cy + 2, { size: 30, weight: 700, family: 'Open Sans', color: ink, align: 'center', baseline: 'middle' });
    for (let i = 0; i < 2; i++) { x.beginPath(); x.arc(432 + i * 2, cy, 22 + i * 20, -0.9, 0.9); x.stroke(); }
    U.rr(x, 500, cy - 88, 98, 176, 18); x.stroke();
    U.rr(x, 530, cy - 74, 38, 8, 4); x.fillStyle = ink; x.fill();
    x.restore();
    x.restore();
    return cv;
  };

  // Badge cap (512²): printed white disc + four-colour G (thin epoxy dome)
  A.badgeTex = function () {
    const S = 512, cv = A.canvas(S, S), x = cv.getContext('2d');
    const g = x.createRadialGradient(S * 0.42, S * 0.36, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.85, '#FAFAFB'); g.addColorStop(1, '#ECEEF1');
    x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, PI * 2); x.fillStyle = g; x.fill();
    U.gLogo(x, S / 2, S / 2, S * 0.3);
    return cv;
  };

  // ── Review modal (design unit 324 × 293) ──────────────────────────────────
  A.MODAL = { w: 324, h: 293 };
  A.modalPost = { x: 228, y: 246, w: 78, h: 30 };
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
    U.avatar(ctx, 38, 40, 18, '#B3261E', 'B42');
    U.text(ctx, 'Bistro 42', 66, 38, { size: 17, weight: 600, color: '#fff', ls: -0.2 });
    U.text(ctx, 'Kfar Saba · Restaurant', 66, 55, { size: 11.5, weight: 400, color: C.gray });
    // close glyph
    ctx.strokeStyle = '#7C828A'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(296, 32); ctx.lineTo(306, 42); ctx.moveTo(306, 32); ctx.lineTo(296, 42); ctx.stroke();
    ctx.fillStyle = '#2A2F3A'; ctx.fillRect(18, 72, 288, 1);
    U.avatar(ctx, 34, 99, 13, '#4285F4', 'D');
    U.text(ctx, 'Dana Levi', 54, 96, { size: 13, weight: 500, color: '#E8EAED' });
    U.text(ctx, 'Posting publicly across Google', 54, 111, { size: 10.5, weight: 400, color: C.gray });
    for (let i = 0; i < 5; i++) {
      const cx = 162 + (i - 2) * 46, cy = 152;
      const s = 1 + 0.24 * pulses[i];
      if (pulses[i] > 0.01) { // soft gold glow behind a popping star
        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
        gg.addColorStop(0, U.rgba(C.gold, 0.28 * pulses[i])); gg.addColorStop(1, U.rgba(C.gold, 0));
        ctx.fillStyle = gg; ctx.fillRect(cx - 30, cy - 30, 60, 60);
      }
      U.star(ctx, cx, cy, 16.5 * s, fills[i], C.gold, '#6B7079', 1.6);
    }
    U.rr(ctx, 18, 182, 288, 44, 10); ctx.strokeStyle = '#3C4043'; ctx.lineWidth = 1; ctx.stroke();
    U.text(ctx, 'Share details of your own experience', 30, 208, { size: 11, weight: 400, color: '#7C828A' });
    const p = st.post || 0;
    U.text(ctx, 'Cancel', 188, 266, { size: 12.5, weight: 500, color: '#8AB4F8', align: 'center' });
    const b = A.modalPost;
    U.rr(ctx, b.x, b.y, b.w, b.h, 15);
    ctx.fillStyle = U.mix('#2A2F3A', C.blue, p); ctx.fill();
    if (st.press) { U.rr(ctx, b.x, b.y, b.w, b.h, 15); ctx.fillStyle = `rgba(255,255,255,${0.18 * st.press})`; ctx.fill(); }
    U.text(ctx, 'Post', b.x + b.w / 2, b.y + 20, { size: 13, weight: 600, color: U.mix('#6B7079', '#FFFFFF', p), align: 'center' });
    ctx.restore();
  };

  // ── Smartphone face texture (760 × 1600) ──────────────────────────────────
  A.PHONE_TEX = { w: 760, h: 1600, inset: 22 };
  A.PHONE_MODAL = { x: 34, y: 520, w: 648 }; // in screen coords (716 × 1556)
  A.phoneFace = function (cv, st) {
    const W = 760, H = 1600, x = cv.getContext('2d');
    x.clearRect(0, 0, W, H);
    U.rr(x, 0, 0, W, H, 118); x.fillStyle = '#07080A'; x.fill();
    const I = A.PHONE_TEX.inset, SW = W - 2 * I, SH = H - 2 * I;
    x.save();
    x.translate(I, I);
    U.rr(x, 0, 0, SW, SH, 98); x.clip();
    // wallpaper
    let g = x.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, '#0E1F4A'); g.addColorStop(0.55, '#081129'); g.addColorStop(1, '#040507');
    x.fillStyle = g; x.fillRect(0, 0, SW, SH);
    let rg = x.createRadialGradient(SW * 0.8, SH * 0.25, 0, SW * 0.8, SH * 0.25, SW * 1.1);
    rg.addColorStop(0, 'rgba(66,133,244,0.35)'); rg.addColorStop(1, 'rgba(66,133,244,0)');
    x.fillStyle = rg; x.fillRect(0, 0, SW, SH);
    U.text(x, 'Tuesday, 3 November', SW / 2, 196, { size: 36, weight: 500, color: 'rgba(255,255,255,0.85)', align: 'center' });
    U.text(x, '9:41', SW / 2, 392, { size: 196, weight: 600, color: 'rgba(255,255,255,0.95)', align: 'center', ls: -4 });
    // NFC read glow (after tap)
    if (st.nfc > 0) {
      const a = U.E.bump(st.nfc);
      rg = x.createRadialGradient(SW / 2, 0, 0, SW / 2, 0, SW * 0.9);
      rg.addColorStop(0, `rgba(138,180,248,${0.45 * a})`); rg.addColorStop(1, 'rgba(138,180,248,0)');
      x.fillStyle = rg; x.fillRect(0, 0, SW, SH);
    }
    // dim behind modal
    if (st.dim > 0) { x.fillStyle = `rgba(0,0,0,${0.55 * st.dim})`; x.fillRect(0, 0, SW, SH); }
    // notification banner → modal morph
    if (st.banner > 0) {
      const by = U.lerp(-200, 64, st.banner);
      const bR = { x: 22, y: by, w: SW - 44, h: 164 };
      const M = A.PHONE_MODAL, mh = (M.w * 293) / 324;
      const m = st.morph || 0;
      const r = { x: U.lerp(bR.x, M.x, m), y: U.lerp(bR.y, M.y, m), w: U.lerp(bR.w, M.w, m), h: U.lerp(bR.h, mh, m) };
      x.save();
      x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 40; x.shadowOffsetY = 12;
      U.rr(x, r.x, r.y, r.w, r.h, 44);
      x.fillStyle = U.mix('#2B2E36', '#1B1E24', m); x.fill();
      x.restore();
      U.rr(x, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 44); x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 2; x.stroke();
      const ba = 1 - U.clamp(m * 3.2);
      if (ba > 0) {
        x.save(); x.globalAlpha = ba;
        U.gBadge(x, r.x + 76, r.y + 82, 44, false);
        U.text(x, 'Google Reviews', r.x + 140, r.y + 70, { size: 37, weight: 600, color: '#FFFFFF', ls: -0.4 });
        U.text(x, 'Open link', r.x + 140, r.y + 118, { size: 31, weight: 500, color: '#8AB4F8' });
        U.text(x, 'NFC · now', r.x + r.w - 28, r.y + 66, { size: 26, weight: 400, color: C.gray, align: 'right' });
        x.restore();
      }
      const ca = U.clamp((m - 0.45) / 0.55);
      if (ca > 0) A.reviewModal(x, r.x, r.y, r.w, { noCard: true, content: ca, fills: st.fills, pulses: st.pulses, post: st.post });
    }
    x.restore();
    // dynamic island
    U.rr(x, W / 2 - 92, 46, 184, 54, 27); x.fillStyle = '#000'; x.fill();
    return cv;
  };

  // ── Search UI ─────────────────────────────────────────────────────────────
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
    const x0 = cx - w / 2;
    // magnifier
    ctx.strokeStyle = '#9AA0A6'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x0 + 38, cy - 3, 10, 0, PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + 45.5, cy + 4.5); ctx.lineTo(x0 + 53, cy + 12); ctx.stroke();
    U.text(ctx, text, x0 + 74, cy + 9, { size: 25, weight: 400, color: '#E8EAED' });
    if (cursor) {
      const tw = U.measure(ctx, text, { size: 25, weight: 400 });
      ctx.fillStyle = C.blue; ctx.fillRect(x0 + 76 + tw, cy - 15, 2.5, 30);
    }
    // right: mic + G
    const xr = cx + w / 2;
    ctx.strokeStyle = '#9AA0A6'; ctx.lineWidth = 2.4;
    U.rr(ctx, xr - 92, cy - 14, 12, 20, 6); ctx.stroke();
    ctx.beginPath(); ctx.arc(xr - 86, cy - 2, 11, 0.15, PI - 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xr - 86, cy + 9); ctx.lineTo(xr - 86, cy + 14); ctx.stroke();
    U.gLogo(ctx, xr - 40, cy, 13);
    ctx.restore();
  };

  A.linkResult = function (ctx, x, y, w, d) {
    U.rr(ctx, x, y, w, 96, 14); ctx.fillStyle = '#12151A'; ctx.fill();
    ctx.strokeStyle = '#1F232B'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 26, y + 24, 10, 0, PI * 2); ctx.fillStyle = d.fav || '#3C4043'; ctx.fill();
    U.text(ctx, d.site, x + 46, y + 22, { size: 13.5, weight: 500, color: '#DADCE0' });
    U.text(ctx, d.url, x + 46, y + 38, { size: 11.5, weight: 400, color: '#7C828A' });
    U.text(ctx, d.title, x + 18, y + 64, { size: 19, weight: 500, color: '#8AB4F8' });
    U.text(ctx, d.snip, x + 18, y + 85, { size: 12.5, weight: 400, color: '#7C828A' });
    if (d.ad) {
      U.text(ctx, 'Sponsored', x + w - 18, y + 22, { size: 11.5, weight: 600, color: '#9AA0A6', align: 'right' });
    }
  };

  A.mapResult = function (ctx, x, y, w) {
    U.rr(ctx, x, y, w, 150, 14); ctx.fillStyle = '#12151A'; ctx.fill();
    ctx.strokeStyle = '#1F232B'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save();
    U.rr(ctx, x + 12, y + 12, 250, 126, 10); ctx.clip();
    ctx.fillStyle = '#1A2230'; ctx.fillRect(x + 12, y + 12, 250, 126);
    ctx.fillStyle = '#1E3326'; ctx.fillRect(x + 150, y + 70, 80, 50);
    ctx.strokeStyle = '#2C3A50'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x + 10, y + 60); ctx.lineTo(x + 270, y + 92); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 90, y + 10); ctx.lineTo(x + 120, y + 140); ctx.moveTo(x + 200, y + 10); ctx.lineTo(x + 180, y + 140); ctx.moveTo(x + 10, y + 115); ctx.lineTo(x + 270, y + 120); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#243044';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + 10 + i * 48, y + 10); ctx.lineTo(x + 30 + i * 44, y + 140); ctx.stroke(); }
    const pin = (px, py, c) => {
      ctx.beginPath(); ctx.arc(px, py - 12, 8, PI * 0.8, PI * 2.2); ctx.lineTo(px, py); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.beginPath(); ctx.arc(px, py - 12, 3, 0, PI * 2); ctx.fillStyle = '#5c1410'; ctx.fill();
    };
    pin(x + 70, y + 66, '#EA4335'); pin(x + 160, y + 52, '#EA4335'); pin(x + 214, y + 104, '#EA4335'); pin(x + 120, y + 112, '#EA4335');
    ctx.restore();
    const ent = [['Bistro 42', '4.6', 'Restaurant · HaTa’as St'], ['Café Lumen', '4.3', 'Café · Weizmann St']];
    ent.forEach((e, i) => {
      const yy = y + 34 + i * 62;
      U.text(ctx, e[0], x + 282, yy, { size: 15, weight: 600, color: '#E8EAED' });
      U.text(ctx, e[1], x + 282, yy + 20, { size: 12, weight: 500, color: '#DADCE0' });
      for (let k = 0; k < 5; k++) U.star(ctx, x + 312 + k * 13, yy + 16, 5.2, k < 4 ? 1 : 0.4, C.gold, '#5F6368', 1);
      U.text(ctx, e[2], x + 282, yy + 38, { size: 11.5, weight: 400, color: '#7C828A' });
    });
  };

  // Business profile card (mobile-browser style), 760 wide.
  A.PROFILE_TABS = ['Overview', 'Menu', 'Updates', 'Reviews'];
  A.profileTabX = function (ctx, x) {
    const o = { size: 13.5, weight: 500 };
    const out = [];
    let cx = x + 26;
    for (const t of A.PROFILE_TABS) {
      const w = U.measure(ctx, t, o);
      out.push({ x: cx, w, c: cx + w / 2 });
      cx += w + 30;
    }
    return out;
  };
  A.PROFILE = { tabsY: 300, writeY: 600, h: 980 };
  A.profileCard = function (ctx, x, y, w, st) {
    const P = A.PROFILE;
    U.rr(ctx, x, y, w, P.h, 18); ctx.fillStyle = '#12151A'; ctx.fill();
    ctx.strokeStyle = '#1F232B'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save();
    U.rr(ctx, x, y, w, P.h, 18); ctx.clip();
    const cols = [['#5a3a22', '#2a1a10'], ['#6b4a2a', '#3a2412'], ['#40302a', '#1d1512']];
    for (let i = 0; i < 3; i++) {
      const g = ctx.createLinearGradient(0, y, 0, y + 132);
      g.addColorStop(0, cols[i][0]); g.addColorStop(1, cols[i][1]);
      ctx.fillStyle = g; ctx.fillRect(x + (i * w) / 3 + (i ? 2 : 0), y, w / 3 - 2, 132);
    }
    ctx.restore();
    U.text(ctx, 'Bistro 42', x + 26, y + 178, { size: 27, weight: 600, color: '#fff', ls: -0.4 });
    U.text(ctx, '4.6', x + 26, y + 206, { size: 14, weight: 500, color: '#DADCE0' });
    for (let k = 0; k < 5; k++) U.star(ctx, x + 58 + k * 15, y + 201, 6, k < 4 ? 1 : 0.55, C.gold, '#5F6368', 1);
    U.text(ctx, '(42) · Restaurant · ₪₪ · Kfar Saba', x + 136, y + 206, { size: 13, weight: 400, color: '#7C828A', family: 'Inter, Rubik' });
    const chips = ['Directions', 'Call', 'Website', 'Save', 'Share', 'Menu'];
    let cx = x + 26;
    chips.forEach((c) => {
      const tw = U.measure(ctx, c, { size: 12, weight: 500 });
      U.rr(ctx, cx, y + 228, tw + 26, 30, 15); ctx.strokeStyle = '#3C4043'; ctx.lineWidth = 1; ctx.stroke();
      U.text(ctx, c, cx + 13, y + 248, { size: 12, weight: 500, color: '#8AB4F8' });
      cx += tw + 34;
    });
    // tabs
    const tabs = A.profileTabX(ctx, x);
    const ty = y + P.tabsY;
    const act = st.tab; // 0 = Overview … 3 = Reviews (fractional while sliding)
    tabs.forEach((tb, i) => {
      const on = 1 - U.clamp(Math.abs(act - i));
      U.text(ctx, A.PROFILE_TABS[i], tb.x, ty, { size: 13.5, weight: 500, color: U.mix('#7C828A', '#FFFFFF', on) });
    });
    const i0 = Math.floor(act), i1 = Math.min(3, i0 + 1), f = act - i0;
    const ux = U.lerp(tabs[i0].x, tabs[i1].x, f), uw = U.lerp(tabs[i0].w, tabs[i1].w, f);
    ctx.fillStyle = '#8AB4F8'; U.rr(ctx, ux, ty + 10, uw, 3, 1.5); ctx.fill();
    ctx.fillStyle = '#23272F'; ctx.fillRect(x, ty + 13, w, 1);
    // content
    const c0 = 1 - st.reviews, c1 = st.reviews;
    if (c0 > 0) {
      ctx.save(); ctx.globalAlpha *= c0;
      const rows = [['HaTa’as St 42, Kfar Saba'], ['Open · Closes 23:00'], ['09-555-0142'], ['bistro42.example']];
      rows.forEach((r, i) => {
        const yy = y + 360 + i * 46;
        ctx.beginPath(); ctx.arc(x + 36, yy - 5, 8, 0, PI * 2); ctx.strokeStyle = '#8AB4F8'; ctx.lineWidth = 2; ctx.stroke();
        U.text(ctx, r[0], x + 62, yy, { size: 14.5, weight: 400, color: '#DADCE0' });
      });
      U.text(ctx, 'Popular times', x + 26, y + 570, { size: 15, weight: 600, color: '#E8EAED' });
      const hb = [12, 22, 40, 60, 48, 30, 55, 78, 90, 70, 40, 20];
      hb.forEach((h, i) => { ctx.fillStyle = i === 8 ? '#8AB4F8' : '#2F3542'; ctx.fillRect(x + 26 + i * 30, y + 680 - h, 22, h); });
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#1F232B'; ctx.fillRect(x + 26, y + 720 + i * 26, w - 52 - (i % 2) * 120, 10); }
      ctx.restore();
    }
    if (c1 > 0) {
      ctx.save(); ctx.globalAlpha *= c1;
      U.text(ctx, '4.6', x + 26, y + 392, { size: 46, weight: 500, color: '#fff' });
      for (let k = 0; k < 5; k++) U.star(ctx, x + 34 + k * 18, y + 414, 7, k < 4 ? 1 : 0.55, C.gold, '#5F6368', 1);
      U.text(ctx, '42 reviews', x + 26, y + 446, { size: 12.5, weight: 400, color: '#7C828A' });
      const hist = [0.72, 0.18, 0.05, 0.03, 0.02];
      hist.forEach((v, i) => {
        const yy = y + 360 + i * 20;
        U.text(ctx, String(5 - i), x + 200, yy + 4, { size: 11, weight: 500, color: '#7C828A' });
        U.rr(ctx, x + 216, yy - 4, 300, 8, 4); ctx.fillStyle = '#23272F'; ctx.fill();
        U.rr(ctx, x + 216, yy - 4, 300 * v, 8, 4); ctx.fillStyle = C.gold; ctx.fill();
      });
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#1F232B'; ctx.fillRect(x + 26, y + 486 + i * 22, w - 120 - i * 80, 9); }
      // Write a review button
      const bw = 210, bx = x + 26, by = y + P.writeY - 24;
      U.rr(ctx, bx, by, bw, 46, 23);
      ctx.fillStyle = U.rgba('#8AB4F8', 0.12 + 0.3 * (st.press || 0)); ctx.fill();
      ctx.strokeStyle = '#8AB4F8'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = '#8AB4F8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + 26, by + 31); ctx.lineTo(bx + 38, by + 17); ctx.stroke();
      U.text(ctx, 'Write a review', bx + 50, by + 29, { size: 15, weight: 600, color: '#8AB4F8' });
      for (let i = 0; i < 4; i++) {
        const yy = y + 690 + i * 70;
        ctx.beginPath(); ctx.arc(x + 42, yy, 15, 0, PI * 2); ctx.fillStyle = '#2A2F3A'; ctx.fill();
        ctx.fillStyle = '#23272F'; ctx.fillRect(x + 70, yy - 10, 160, 9); ctx.fillRect(x + 70, yy + 8, w - 160, 8);
      }
      ctx.restore();
    }
  };

  // ── Persistent status bar ────────────────────────────────────────────────
  A.statusBar = function (ctx, cx, cy, rating, count, track) {
    const w = 940, h = 54, x = cx - w / 2, y = cy - h / 2;
    ctx.save();
    U.rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(22,25,32,0.85)'; ctx.fill();
    U.rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    ctx.strokeStyle = '#2A2F3A'; ctx.lineWidth = 1; ctx.stroke();
    U.gBadge(ctx, x + 30, cy, 15, false);
    U.text(ctx, 'Google Business Profile', x + 56, cy + 6, { size: 16, weight: 600, color: '#FFFFFF', ls: -0.2 });
    const lw = U.measure(ctx, 'Google Business Profile', { size: 16, weight: 600, ls: -0.2 });
    // live pill
    const px = x + 56 + lw + 14;
    U.rr(ctx, px, cy - 11, 92, 22, 11); ctx.fillStyle = 'rgba(52,168,83,0.14)'; ctx.fill();
    ctx.beginPath(); ctx.arc(px + 13, cy, 3.5, 0, PI * 2); ctx.fillStyle = '#34A853'; ctx.fill();
    U.text(ctx, 'Live Rating', px + 23, cy + 4.5, { size: 12, weight: 500, color: '#81C995' });
    // stars + counter
    const sx = x + 470;
    for (let i = 0; i < 5; i++) {
      const f = U.clamp(rating - i - (i === 4 ? 0 : 0));
      U.star(ctx, sx + i * 20, cy, 7.5, i < 4 ? 1 : U.clamp((rating - 4) * 1.05), C.gold, '#5F6368', 1.2);
    }
    const txt = rating.toFixed(1);
    U.text(ctx, txt, sx + 100, cy + 6, { size: 17, weight: 600, color: '#FFFFFF' });
    U.text(ctx, `(${count})`, sx + 132, cy + 6, { size: 15, weight: 400, color: C.gray });
    // trust track
    const tx = x + 690, tw = 170;
    U.rr(ctx, tx, cy - 2, tw, 4, 2); ctx.fillStyle = '#262B35'; ctx.fill();
    U.rr(ctx, tx, cy - 2, Math.max(4, tw * track), 4, 2); ctx.fillStyle = C.blue; ctx.fill();
    ctx.beginPath(); ctx.arc(tx + tw * track, cy, 4.5, 0, PI * 2); ctx.fillStyle = '#8AB4F8'; ctx.fill();
    U.nfcWaves(ctx, x + w - 34, cy, 18, '#9AA0A6', 2.2);
    ctx.restore();
  };

  // ── Social proof cards (unit 400 × 170) ───────────────────────────────────
  A.cardFrame = function (ctx, glow) {
    ctx.save();
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 44; }
    U.rr(ctx, 0, 0, 400, 170, 20);
    const g = ctx.createLinearGradient(0, 0, 0, 170);
    g.addColorStop(0, '#191C23'); g.addColorStop(1, '#13161C');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    U.rr(ctx, 0.5, 0.5, 399, 169, 20); ctx.strokeStyle = '#2A2F3A'; ctx.lineWidth = 1; ctx.stroke();
  };
  A.reviewCard = function (ctx, d) {
    A.cardFrame(ctx, 'rgba(251,188,4,0.16)');
    U.avatar(ctx, 40, 40, 19, d.color, d.initial);
    U.text(ctx, d.name, 70, 37, { size: 16, weight: 600, color: '#fff' });
    const nw = U.measure(ctx, d.name, { size: 16, weight: 600 });
    U.verified(ctx, 70 + nw + 13, 31, 7.5);
    U.text(ctx, d.meta, 70, 56, { size: 12, weight: 400, color: C.gray });
    U.gLogo(ctx, 370, 36, 10);
    for (let i = 0; i < 5; i++) U.star(ctx, 32 + i * 22, 86, 9, 1, C.gold);
    U.text(ctx, d.text, 24, 122, { size: 14.5, weight: 400, color: '#E8EAED' });
    U.avatar(ctx, 32, 148, 8, d.bizColor, d.biz[0]);
    U.text(ctx, d.biz, 46, 152, { size: 12, weight: 500, color: C.gray });
  };
  A.ratingMetricCard = function (ctx, v) {
    A.cardFrame(ctx, 'rgba(66,133,244,0.2)');
    U.text(ctx, 'Average rating', 26, 40, { size: 13, weight: 500, color: C.gray });
    U.text(ctx, '4.2', 26, 100, { size: 40, weight: 600, color: '#7C828A' });
    U.star(ctx, 104, 86, 11, 1, '#7C828A');
    ctx.strokeStyle = C.gray; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(130, 86); ctx.lineTo(160, 86); ctx.moveTo(152, 79); ctx.lineTo(160, 86); ctx.lineTo(152, 93); ctx.stroke();
    U.text(ctx, v.toFixed(1), 176, 100, { size: 40, weight: 600, color: C.gold });
    U.star(ctx, 254, 86, 11, 1, C.gold);
    // sparkline
    const pts = [0.1, 0.18, 0.15, 0.32, 0.44, 0.5, 0.68, 0.8, 0.95];
    const vis = U.clamp((v - 4.2) / 0.7);
    ctx.save();
    ctx.beginPath(); ctx.rect(26, 110, 348 * Math.max(0.02, vis), 50); ctx.clip();
    ctx.beginPath();
    pts.forEach((p, i) => { const px = 26 + i * 43, py = 154 - p * 38; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.strokeStyle = C.blue; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  };
  A.growthCard = function (ctx, p) {
    A.cardFrame(ctx, 'rgba(66,133,244,0.2)');
    U.text(ctx, 'Google reviews', 26, 40, { size: 13, weight: 500, color: C.gray });
    U.text(ctx, `+${Math.round(140 * p)}%`, 26, 100, { size: 44, weight: 600, color: '#fff', ls: -1 });
    U.text(ctx, 'Reviews in 60 days', 26, 130, { size: 13, weight: 500, color: '#81C995' });
    const bars = [0.22, 0.3, 0.36, 0.5, 0.64, 0.82, 1];
    bars.forEach((b, i) => {
      const h = 96 * b * U.clamp(p * 1.4 - i * 0.06);
      U.rr(ctx, 236 + i * 21, 146 - h, 14, Math.max(0.1, h), 3);
      ctx.fillStyle = i === bars.length - 1 ? C.blue : '#2F3542'; ctx.fill();
    });
  };
  A.bizCard = function (ctx) {
    A.cardFrame(ctx, 'rgba(251,188,4,0.16)');
    U.avatar(ctx, 44, 52, 24, '#7B4B2A', 'CA');
    U.text(ctx, 'Cafe Aroma', 80, 48, { size: 17, weight: 600, color: '#fff' });
    U.text(ctx, 'Coffee shop · Kfar Saba', 80, 68, { size: 12, weight: 400, color: C.gray });
    U.text(ctx, '4.9', 26, 126, { size: 36, weight: 600, color: '#fff' });
    for (let i = 0; i < 5; i++) U.star(ctx, 100 + i * 22, 114, 9, 1, C.gold);
    U.text(ctx, '312 reviews', 100, 142, { size: 12, weight: 400, color: C.gray });
    U.rr(ctx, 262, 30, 112, 26, 13); ctx.fillStyle = 'rgba(251,188,4,0.14)'; ctx.fill();
    U.text(ctx, 'Top rated', 318, 48, { size: 12, weight: 600, color: C.gold, align: 'center' });
  };
})();
