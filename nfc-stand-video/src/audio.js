// ─────────────────────────────────────────────────────────────────────────────
// audio.js — fully synthesized 120 BPM minimal tech soundtrack + UI/NFC sound
// effects, rendered deterministically with an OfflineAudioContext.
// Cue times come from TL.CUES / TL.typeTimes() so picture and sound stay locked.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const SR = 48000;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  async function render() {
    const DUR = TL.DURATION;
    const ac = new OfflineAudioContext(2, Math.round(SR * DUR), SR);
    const rnd = U.rng(42);

    // ── Bus ─────────────────────────────────────────────────────────────────
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
    const master = ac.createGain();
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(0.9, 0.06);
    master.gain.setValueAtTime(0.9, 17.2);
    master.gain.linearRampToValueAtTime(0.0, 18.0);
    master.connect(comp); comp.connect(ac.destination);
    const music = ac.createGain(); music.gain.value = 0.85; music.connect(master);
    const sfx = ac.createGain(); sfx.gain.value = 0.5; sfx.connect(master);
    // reverb
    const irLen = Math.round(SR * 2.4), ir = ac.createBuffer(2, irLen, SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    const verb = ac.createConvolver(); verb.buffer = ir;
    const verbOut = ac.createGain(); verbOut.gain.value = 0.32;
    verb.connect(verbOut); verbOut.connect(master);
    // noise
    const nb = ac.createBuffer(1, SR * 2, SR), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
    const noise = (t, dur) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t, rnd() * 1.5); s.stop(t + dur + 0.05); return s; };
    const env = (g, t, a, peak, d, floor = 0.0001) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(floor, t + a + d);
    };
    const pan = (node, p, dest) => { const pn = ac.createStereoPanner(); pn.pan.value = p; node.connect(pn); pn.connect(dest); return pn; };

    // ── Instruments ─────────────────────────────────────────────────────────
    function kick(t, g = 0.9) {
      const o = ac.createOscillator(), a = ac.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
      env(a, t, 0.003, g, 0.36);
      o.connect(a); a.connect(music); o.start(t); o.stop(t + 0.42);
    }
    function hat(t, g = 0.12, open = false, p = 0.2) {
      const s = noise(t, 0.3), f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'highpass'; f.frequency.value = 7600;
      env(a, t, 0.001, g, open ? 0.16 : 0.032);
      s.connect(f); f.connect(a); pan(a, p, music);
    }
    function clap(t, g = 0.22) {
      const s = noise(t, 0.3), f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.9;
      a.gain.setValueAtTime(0.0001, t);
      [0, 0.011, 0.022].forEach((o) => { a.gain.linearRampToValueAtTime(g, t + o + 0.001); a.gain.exponentialRampToValueAtTime(g * 0.3, t + o + 0.009); });
      a.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      s.connect(f); f.connect(a); a.connect(music);
      const sv = ac.createGain(); sv.gain.value = 0.35; a.connect(sv); sv.connect(verb);
    }
    function bass(t, m, dur, g = 0.36) {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), a = ac.createGain(), a2 = ac.createGain();
      o.type = 'sine'; o.frequency.value = midi(m);
      o2.type = 'triangle'; o2.frequency.value = midi(m + 12); a2.gain.value = 0.22;
      f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.6;
      a.gain.setValueAtTime(0.0001, t);
      a.gain.linearRampToValueAtTime(g, t + 0.012);
      a.gain.exponentialRampToValueAtTime(g * 0.55, t + dur * 0.7);
      a.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
      o.connect(f); o2.connect(a2); a2.connect(f); f.connect(a); a.connect(music);
      o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    }
    function pluck(t, m, g = 0.12, bright = 1, p = 0) {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), a = ac.createGain(), a2 = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sine'; o.frequency.value = midi(m);
      o2.type = 'sine'; o2.frequency.value = midi(m) * 3.98;
      env(a, t, 0.002, g, 0.42);
      env(a2, t, 0.001, g * 0.28 * bright, 0.06);
      f.type = 'lowpass'; f.frequency.value = 2400 + 3000 * bright;
      o.connect(a); o2.connect(a2); a.connect(f); a2.connect(f);
      const pn = pan(f, p, music);
      const sv = ac.createGain(); sv.gain.value = 0.3; pn.connect(sv); sv.connect(verb);
      o.start(t); o2.start(t); o.stop(t + 0.6); o2.stop(t + 0.2);
    }
    function pad(t, notes, dur, g = 0.05, cutoff = 1300, att = 0.35, rel = 0.9) {
      const f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.5;
      a.gain.setValueAtTime(0.0001, t);
      a.gain.linearRampToValueAtTime(g, t + att);
      a.gain.setValueAtTime(g, t + dur);
      a.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
      notes.forEach((m, i) => {
        [-7, 7].forEach((dt) => {
          const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(m); o.detune.value = dt + (i % 2) * 2;
          o.connect(f); o.start(t); o.stop(t + dur + rel + 0.05);
        });
      });
      f.connect(a); a.connect(music);
      const sv = ac.createGain(); sv.gain.value = 0.5; a.connect(sv); sv.connect(verb);
    }
    function whoosh(t, dur, f0, f1, g = 0.12, dest = sfx) {
      const s = noise(t, dur), f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'bandpass'; f.Q.value = 1.3;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      a.gain.setValueAtTime(0.0001, t);
      a.gain.exponentialRampToValueAtTime(g, t + dur * 0.85);
      a.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
      s.connect(f); f.connect(a); a.connect(dest);
      const sv = ac.createGain(); sv.gain.value = 0.4; a.connect(sv); sv.connect(verb);
    }
    function impact(t, g = 0.5) {
      const o = ac.createOscillator(), a = ac.createGain();
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.9);
      env(a, t, 0.005, g, 1.2);
      o.connect(a); a.connect(music); o.start(t); o.stop(t + 1.3);
      const s = noise(t, 0.8), f = ac.createBiquadFilter(), b = ac.createGain();
      f.type = 'lowpass'; f.frequency.value = 900;
      env(b, t, 0.003, g * 0.25, 0.5);
      s.connect(f); f.connect(b); b.connect(music);
      const sv = ac.createGain(); sv.gain.value = 0.6; b.connect(sv); sv.connect(verb);
    }
    function keyTick(t, g = 0.06) {
      const s = noise(t, 0.05), f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = 3000 + rnd() * 2200; f.Q.value = 1.6;
      env(a, t, 0.0008, g * (0.75 + rnd() * 0.5), 0.022);
      s.connect(f); f.connect(a); pan(a, (rnd() - 0.5) * 0.4, sfx);
    }
    function uiTap(t, g = 0.16) {
      const o = ac.createOscillator(), a = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(640, t + 0.05);
      env(a, t, 0.001, g, 0.06);
      o.connect(a); a.connect(sfx); o.start(t); o.stop(t + 0.1);
    }
    function chime(t, m, g = 0.2, p = 0) {
      const a = ac.createGain();
      env(a, t, 0.003, g, 0.9);
      [[1, 1], [2, 0.32], [3, 0.12], [4.2, 0.05]].forEach(([h, v]) => {
        const o = ac.createOscillator(), k = ac.createGain();
        o.type = 'sine'; o.frequency.value = midi(m) * h; k.gain.value = v;
        o.connect(k); k.connect(a); o.start(t); o.stop(t + 1.0);
      });
      const pn = pan(a, p, sfx);
      const sv = ac.createGain(); sv.gain.value = 0.6; pn.connect(sv); sv.connect(verb);
    }
    function sparkle(t, m, g = 0.16, p = 0) {
      const a = ac.createGain();
      env(a, t, 0.002, g, 0.7);
      [[1, 1, 0.7], [2.76, 0.35, 0.3], [5.4, 0.12, 0.15]].forEach(([h, v, d]) => {
        const o = ac.createOscillator(), k = ac.createGain();
        o.type = 'sine'; o.frequency.value = midi(m) * h;
        env(k, t, 0.002, v, d);
        o.connect(k); k.connect(a); o.start(t); o.stop(t + 0.8);
      });
      const s = noise(t, 0.2), f = ac.createBiquadFilter(), b = ac.createGain();
      f.type = 'highpass'; f.frequency.value = 9000;
      env(b, t, 0.002, g * 0.18, 0.12);
      s.connect(f); f.connect(b); b.connect(a);
      const pn = pan(a, p, sfx);
      const sv = ac.createGain(); sv.gain.value = 0.7; pn.connect(sv); sv.connect(verb);
    }

    // ── Arrangement ─────────────────────────────────────────────────────────
    // Grid offset 0.2 s puts downbeats on the pivot (4.2), groove (5.2) and brand hit (9.2).
    const OFF = 0.2, BEAT = 0.5;
    const CH = {
      Am: { n: [57, 60, 64], r: 45, arp: [57, 60, 64, 69, 72, 69, 64, 60] },
      F: { n: [53, 57, 60, 64], r: 41, arp: [53, 57, 60, 65, 69, 65, 60, 57] },
      C: { n: [55, 60, 64, 67], r: 36, arp: [60, 64, 67, 72, 76, 72, 67, 64] },
      G: { n: [55, 59, 62, 66], r: 43, arp: [55, 59, 62, 67, 71, 67, 62, 59] },
    };
    const barChord = (k) => ['Am', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'C'][k + 1] || 'C';

    // Pads per bar
    for (let k = -1; k <= 7; k++) {
      const t0 = Math.max(0, OFF + k * 2), t1 = OFF + (k + 1) * 2;
      const name = barChord(k);
      if (t0 >= 15.8) break;
      const end = Math.min(t1, 15.8);
      if (t0 < 3.2) pad(t0, CH[name].n, end - t0, 0.022, 700, 0.3, 0.6);
      else if (t0 < 4.2) pad(3.2, CH.F.n.map((m) => m - 12), 1.0, 0.03, 500, 0.2, 0.4);
      else pad(t0, CH[name].n, end - t0, t0 >= 9.2 && t0 < 10.4 ? 0.05 : 0.038, t0 >= 9.2 ? 1700 : 1300, 0.25, 0.7);
    }

    // Beats
    for (let i = 0; ; i++) {
      const t = OFF + i * BEAT - 0.5; // includes a pickup at -0.3 → skip negatives
      if (t >= 15.7) break;
      if (t < 0) continue;
      const k = Math.floor((t - OFF) / 2);
      const ch = CH[barChord(k)];
      const beatInBar = Math.round(((t - OFF) / BEAT) % 4 + 4) % 4;
      if (t < 3.2) {
        // the old way: thin, tense pulse
        if (beatInBar % 2 === 0) kick(t, 0.42);
        hat(t + 0.25, 0.05, false, 0.25);
        pluck(t + 0.25, ch.arp[(i * 3) % 8] - 12, 0.05, 0.2, -0.2);
      } else if (t < 4.2) {
        // drop-off: breathe out, only soft hats
        hat(t + 0.25, 0.035, false, -0.2);
      } else if (t < 5.2) {
        // pivot: plucks rise, no kick yet
        for (let e = 0; e < 2; e++) pluck(t + e * 0.25, ch.arp[(i * 2 + e) % 8], 0.07, 0.7, e ? 0.25 : -0.25);
        hat(t + 0.25, 0.05, false, 0.2);
      } else {
        const build = t >= 11.3 && t < 11.8;
        const thin = t >= 14.6;
        if (!build && !thin) kick(t, 0.8);
        if (!thin) {
          hat(t + 0.25, 0.08, beatInBar === 3, 0.22);
          hat(t + 0.125, 0.025, false, -0.3); hat(t + 0.375, 0.025, false, -0.3);
          if (beatInBar === 1 || beatInBar === 3) clap(t, build ? 0.12 : 0.18);
        }
        // sub-bass in eighths
        bass(t, ch.r, 0.22, thin ? 0.22 : 0.34);
        if (!thin) bass(t + 0.25, ch.r + (beatInBar === 3 ? 12 : 0), 0.2, 0.24);
        // marimba-like plucks
        for (let e = 0; e < 2; e++) pluck(t + e * 0.25, ch.arp[(i * 2 + e) % 8] + (t > 9.2 && t < 10.4 ? 12 : 0), thin ? 0.06 : 0.085, 0.9, e ? 0.3 : -0.3);
      }
    }

    // ── SFX ─────────────────────────────────────────────────────────────────
    TL.typeTimes().forEach((tt) => keyTick(tt, 0.07));
    TL.CUES.taps.forEach((tt) => uiTap(tt, 0.13));
    whoosh(3.7, 0.5, 400, 3200, 0.07);       // reverse swell into the pivot
    impact(4.2, 0.32);
    whoosh(4.36, 0.75, 2400, 500, 0.05);     // stand rises
    whoosh(5.3, 0.5, 900, 2600, 0.045);      // phone glides in
    // NFC tap: soft contact + crisp double chime
    (() => {
      const t = TL.CUES.nfc;
      const o = ac.createOscillator(), a = ac.createGain();
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.06);
      env(a, t, 0.001, 0.22, 0.08); o.connect(a); a.connect(sfx); o.start(t); o.stop(t + 0.15);
      chime(t + 0.005, 88, 0.2, -0.1);
      chime(t + 0.095, 95, 0.17, 0.1);
    })();
    whoosh(6.6, 0.3, 1500, 4200, 0.04);      // banner slides in
    // five ascending star sparkles (G major, matching the bar)
    [79, 83, 86, 91, 95].forEach((m, i) => sparkle(TL.CUES.stars[i], m, 0.14, -0.4 + i * 0.2));
    impact(9.2, 0.34);                        // brand transformation
    whoosh(9.18, 0.45, 600, 5000, 0.05);
    whoosh(10.9, 0.88, 300, 6000, 0.09);     // dramatic zoom riser
    impact(11.8, 0.3);
    whoosh(14.55, 0.6, 3000, 600, 0.05);     // cards converge
    // Final resolve at 15.8: warm Cmaj9 + low C + bell
    const tf = TL.CUES.final;
    pad(tf, [48, 55, 64, 71, 74], 1.4, 0.06, 1500, 0.08, 0.9);
    bass(tf, 36, 1.8, 0.4);
    impact(tf, 0.22);
    [60, 64, 67, 71, 74].forEach((m, i) => pluck(tf + 0.04 + i * 0.07, m + 12, 0.06, 0.8, -0.3 + i * 0.15));
    chime(tf + 0.02, 84, 0.1);

    return ac.startRendering();
  }

  function toWav(buf) {
    const n = buf.length, ch = buf.numberOfChannels;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true);
    out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Uint8Array(out.buffer);
  }

  window.Soundtrack = {
    render,
    async wavBase64() {
      const bytes = toWav(await render());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
})();
