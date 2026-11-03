// ─────────────────────────────────────────────────────────────────────────────
// util.js — pure math, easing, keyframes and 2D drawing primitives.
// Everything here is stateless: output depends only on the arguments.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const U = (window.U = {});
  const PI = Math.PI;

  U.W = 1920;
  U.H = 1080;
  // Stage: ~80% width, ~75% height, centred horizontally, slightly below centre.
  U.STAGE = { x: 192, y: 158, w: 1536, h: 810, r: 44 };
  U.STAGE.cx = U.STAGE.x + U.STAGE.w / 2; // 960
  U.STAGE.cy = U.STAGE.y + U.STAGE.h / 2; // 563

  U.C = {
    stage: '#0B0D11',
    white: '#FFFFFF',
    gray: '#9AA0A6',
    blue: '#4285F4',
    brandBlue: '#1A73E8',
    gold: '#FBBC04',
    red: '#EA4335',
    green: '#34A853',
    panel: '#161920',
    border: '#2A2F3A',
    card: '#14171D',
  };

  U.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.prog = (t, a, b) => U.clamp((t - a) / (b - a));
  U.inWin = (t, a, b) => t >= a && t < b;

  // ── Easing ────────────────────────────────────────────────────────────────
  U.cubicBezier = function (x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        if (sx(t) < x) lo = t; else hi = t;
      }
      return sy(t);
    };
  };

  const E = (U.E = {});
  E.linear = (x) => U.clamp(x);
  E.out = U.cubicBezier(0.16, 1, 0.3, 1);       // expo-like deceleration
  E.outSoft = U.cubicBezier(0.22, 1, 0.36, 1);  // quint-out
  E.inOut = U.cubicBezier(0.65, 0, 0.35, 1);    // continuous accel / decel
  E.smooth = U.cubicBezier(0.4, 0, 0.2, 1);     // material standard
  E.in = U.cubicBezier(0.55, 0, 0.85, 0.35);
  E.inStrong = U.cubicBezier(0.7, 0, 0.84, 0);
  // Critically damped spring, normalised to land exactly on 1 at x=1.
  E.spring = (x, w = 8) => {
    x = U.clamp(x);
    const f = (s) => 1 - (1 + w * s) * Math.exp(-w * s);
    return f(x) / f(1);
  };
  // Lightly under-damped spring (zeta .8) – ~1% single overshoot, no repeat bounce.
  E.arrive = (x) => {
    x = U.clamp(x);
    const z = 0.8, w = 10, wd = w * Math.sqrt(1 - z * z);
    const f = (s) => 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * s));
    const e1 = 1 - f(1);
    return f(x) + e1 * x;
  };
  // A single smooth bump 0 → 1 → 0.
  E.bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(PI * x));

  // ── Keyframes ─────────────────────────────────────────────────────────────
  // KF([[t, {props}, ease?], ...]) → (t) => props. Missing props inherit from
  // the previous key, so every key is complete. Pure function of t.
  U.KF = function (keys) {
    const ks = [];
    let acc = {};
    for (const k of keys) {
      acc = Object.assign({}, acc, k[1]);
      ks.push([k[0], acc, k[2] || E.inOut]);
    }
    return (t) => {
      if (t <= ks[0][0]) return Object.assign({}, ks[0][1]);
      for (let i = 1; i < ks.length; i++) {
        if (t < ks[i][0]) {
          const [t0, a] = ks[i - 1];
          const [t1, b, e] = ks[i];
          const p = e((t - t0) / (t1 - t0));
          const o = {};
          for (const key in b) o[key] = typeof b[key] === 'number' ? U.lerp(a[key], b[key], p) : b[key];
          return o;
        }
      }
      return Object.assign({}, ks[ks.length - 1][1]);
    };
  };

  // Deterministic PRNG (mulberry32)
  U.rng = function (seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ── Colour ────────────────────────────────────────────────────────────────
  U.hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgba = (h, a = 1) => {
    const [r, g, b] = U.hex(h);
    return `rgba(${r},${g},${b},${a})`;
  };
  U.mix = (h1, h2, t, a = 1) => {
    const c1 = U.hex(h1), c2 = U.hex(h2);
    return `rgba(${Math.round(U.lerp(c1[0], c2[0], t))},${Math.round(U.lerp(c1[1], c2[1], t))},${Math.round(U.lerp(c1[2], c2[2], t))},${a})`;
  };

  // ── Paths ─────────────────────────────────────────────────────────────────
  U.rr = function (ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  U.starPath = function (ctx, cx, cy, R, inner = 0.48) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -PI / 2 + (i * PI) / 5;
      const r = i % 2 === 0 ? R : R * inner;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // fill: 0..1 (0 = outline only, 1 = fully gold)
  U.star = function (ctx, cx, cy, R, fill = 1, color = U.C.gold, outline = '#5F6368', lw) {
    ctx.save();
    ctx.lineJoin = 'round';
    U.starPath(ctx, cx, cy, R * 0.94);
    if (fill < 1) {
      ctx.lineWidth = lw || Math.max(1.2, R * 0.12);
      ctx.strokeStyle = outline;
      ctx.stroke();
    }
    if (fill > 0) {
      ctx.globalAlpha *= U.clamp(fill * 1.4);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = Math.max(1, R * 0.12);
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    ctx.restore();
  };

  U.stars = function (ctx, cx, cy, R, gap, n = 5, fill = 1, color) {
    const x0 = cx - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) U.star(ctx, x0 + i * gap, cy, R, typeof fill === 'function' ? fill(i) : fill, color);
  };

  // Four-colour Google "G" mark, drawn procedurally. R = outer radius.
  U.gLogo = function (ctx, cx, cy, R) {
    const th = R * 0.4;
    const rm = R - th / 2;
    const seg = (a0, a1, col) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rm, (a0 * PI) / 180, (a1 * PI) / 180);
      ctx.strokeStyle = col;
      ctx.lineWidth = th;
      ctx.lineCap = 'butt';
      ctx.stroke();
    };
    ctx.save();
    seg(-2, 46, '#4285F4');
    seg(45, 136, '#34A853');
    seg(135, 216, '#FBBC04');
    seg(215, 316, '#EA4335');
    // Cross bar
    ctx.fillStyle = '#4285F4';
    ctx.fillRect(cx - R * 0.02, cy - th * 0.5, R * 1.0, th * 0.98);
    ctx.restore();
  };

  // White circular badge with the G (flat, for UI)
  U.gBadge = function (ctx, cx, cy, r, shadow = true) {
    ctx.save();
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = r * 0.5;
      ctx.shadowOffsetY = r * 0.12;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
    U.gLogo(ctx, cx, cy, r * 0.58);
  };

  U.avatar = function (ctx, cx, cy, r, color, label, txtColor = '#fff') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI * 2);
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, U.mix(color, '#ffffff', 0.18));
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fill();
    U.text(ctx, label, cx, cy + r * 0.02, { size: r * (label.length > 1 ? 0.72 : 0.95), weight: 600, color: txtColor, align: 'center', baseline: 'middle' });
    ctx.restore();
  };

  U.verified = function (ctx, cx, cy, r, color = U.C.blue) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.36);
    ctx.lineTo(cx + r * 0.48, cy - r * 0.32);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = r * 0.26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };

  // NFC wireless glyph: three arcs
  U.nfcWaves = function (ctx, x, y, s, color, lw) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || s * 0.13;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x - s * 0.4, y, s * (0.28 + i * 0.3), -0.75, 0.75);
      ctx.stroke();
    }
    ctx.restore();
  };

  // ── Text ──────────────────────────────────────────────────────────────────
  U.font = (o) => `${o.italic ? 'italic ' : ''}${o.weight || 500} ${o.size}px ${o.family || 'Inter'}`;

  U.text = function (ctx, str, x, y, o) {
    ctx.save();
    ctx.font = U.font(o);
    ctx.fillStyle = o.color || '#fff';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.direction = o.dir || 'ltr';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.ls || 0) + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  U.measure = function (ctx, str, o) {
    ctx.save();
    ctx.font = U.font(o);
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.ls || 0) + 'px';
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  };

  // Rich line: segments [[text, color], ...] drawn left→right, aligned as a whole.
  U.richText = function (ctx, segs, x, y, o) {
    const widths = segs.map((s) => U.measure(ctx, s[0], o));
    const total = widths.reduce((a, b) => a + b, 0);
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    segs.forEach((s, i) => {
      U.text(ctx, s[0], cx, y, Object.assign({}, o, { color: s[1], align: 'left' }));
      cx += widths[i];
    });
    return total;
  };

  // Masked vertical reveal of a single line. pin/pout are eased 0..1 values.
  // The line slides up from below its mask on entry and continues up on exit.
  U.maskLine = function (ctx, segs, x, y, o, pin, pout = 0) {
    if (pin <= 0 || pout >= 1) return;
    if (typeof segs === 'string') segs = [[segs, o.color || '#fff']];
    const s = o.size;
    const top = y - s * 1.08, bot = y + s * 0.34;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, U.W, bot - top);
    ctx.clip();
    const dy = (1 - pin) * s * 1.35 - pout * s * 1.35;
    ctx.globalAlpha *= U.clamp(pin * 1.6) * (1 - U.clamp(pout * 1.3 - 0.3));
    U.richText(ctx, segs, x, y + dy, o);
    ctx.restore();
  };

  // Headline helper: two masked lines with timing [inStart, outStart]
  U.headline = function (ctx, t, lines, opts) {
    // lines: [{segs, y, size, weight, color, tin, tout}]
    for (const L of lines) {
      const pin = E.out(U.prog(t, L.tin, L.tin + (L.din || 0.55)));
      const pout = L.tout != null ? E.in(U.prog(t, L.tout, L.tout + (L.dout || 0.22))) : 0;
      U.maskLine(ctx, L.segs, L.x != null ? L.x : U.STAGE.cx, L.y, {
        size: L.size || 56, weight: L.weight || 600, align: L.align || 'center', ls: L.ls != null ? L.ls : -1.2, family: 'Inter', color: L.color,
      }, pin, pout);
    }
  };
})();
