// ─────────────────────────────────────────────────────────────────────────────
// audio.js — cinematic score + precise SFX for the stand film, rendered
// deterministically with an OfflineAudioContext. Cue times come from FILM.CUES.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const SR = 48000;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  async function render() {
    const DUR = window.FILM.DUR, CUES = window.FILM.CUES;
    const ac = new OfflineAudioContext(2, Math.round(SR * DUR), SR);
    const rnd = U.rng(42);

    // ── Bus ─────────────────────────────────────────────────────────────────
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
    const master = ac.createGain();
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(0.9, 0.06);
    master.gain.setValueAtTime(0.9, DUR - 0.8);
    master.gain.linearRampToValueAtTime(0.0, DUR);
    master.connect(comp); comp.connect(ac.destination);
    const music = ac.createGain(); music.gain.value = 0.7; music.connect(master);
    const sfx = ac.createGain(); sfx.gain.value = 0.6; sfx.connect(master);
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

    // haptic buzz: a few short low pulses, like a phone's vibration motor
    function haptic(t, g = 0.16) {
      [0, 0.11].forEach((o) => {
        const osc = ac.createOscillator(), a = ac.createGain(), f = ac.createBiquadFilter();
        osc.type = 'square'; osc.frequency.value = 160;
        f.type = 'lowpass'; f.frequency.value = 420;
        a.gain.setValueAtTime(0.0001, t + o);
        a.gain.linearRampToValueAtTime(g, t + o + 0.008);
        a.gain.setValueAtTime(g, t + o + 0.06);
        a.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.085);
        osc.connect(f); f.connect(a); a.connect(sfx); osc.start(t + o); osc.stop(t + o + 0.1);
      });
    }
    function softClick(t, g = 0.1, f0 = 2400) {
      const s = noise(t, 0.03), f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = f0; f.Q.value = 2.2;
      env(a, t, 0.0006, g, 0.018);
      s.connect(f); f.connect(a); a.connect(sfx);
      const o = ac.createOscillator(), b = ac.createGain();
      o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.025);
      env(b, t, 0.0006, g * 0.5, 0.03); o.connect(b); b.connect(sfx); o.start(t); o.stop(t + 0.05);
    }
    function pop(t, m, g = 0.12) { // bubbly UI pop
      const o = ac.createOscillator(), a = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(midi(m) * 0.7, t); o.frequency.exponentialRampToValueAtTime(midi(m), t + 0.05);
      env(a, t, 0.003, g, 0.16); o.connect(a); a.connect(sfx); o.start(t); o.stop(t + 0.22);
      const sv = ac.createGain(); sv.gain.value = 0.3; a.connect(sv); sv.connect(verb);
    }

    // ── Score: dark, warm, 100 BPM (beat 0.6 s); cuts land on beats ─────────
    const BEAT = 0.6, END = DUR;
    // deep, low "boom" on every cut
    function boom(t, g = 0.55) {
      const o = ac.createOscillator(), a = ac.createGain();
      o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
      env(a, t, 0.004, g, 1.1); o.connect(a); a.connect(music); o.start(t); o.stop(t + 1.3);
      const s = noise(t, 0.4), f = ac.createBiquadFilter(), b = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 900;
      env(b, t, 0.002, g * 0.25, 0.25); s.connect(f); f.connect(b); b.connect(music); b.connect(verb);
    }
    // a soft analog-ish riser
    function riser(t0, t1, g = 0.06) {
      const s = noise(t0, t1 - t0), f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'bandpass'; f.Q.value = 2.2; f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(5200, t1);
      a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g, t1 - 0.02); a.gain.linearRampToValueAtTime(0.0001, t1);
      s.connect(f); f.connect(a); a.connect(sfx); a.connect(verb);
    }
    // mechanical flap clack
    function clack(t, g = 0.07, p = 0) {
      const s = noise(t, 0.05), f = ac.createBiquadFilter(), a = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = 2600 + rnd() * 900; f.Q.value = 3;
      env(a, t, 0.0008, g, 0.028); s.connect(f); f.connect(a); pan(a, p, sfx);
      const o = ac.createOscillator(), b = ac.createGain(); o.type = 'square'; o.frequency.value = 180 + rnd() * 60;
      env(b, t, 0.0005, g * 0.25, 0.02); o.connect(b); pan(b, p, sfx); o.start(t); o.stop(t + 0.05);
    }
    const CH = [
      { n: [45, 52, 57, 60, 64], r: 33 },   // Am(add9)
      { n: [41, 48, 53, 57, 64], r: 29 },   // Fmaj7
      { n: [43, 50, 55, 59, 62], r: 31 },   // G
      { n: [40, 47, 52, 55, 59], r: 28 },   // Em7
    ];
    const chordAt = (t) => CH[Math.floor(t / (BEAT * 4)) % 4];
    // pads: one chord per bar (4 beats = 2.4 s), brighter after the tap
    for (let k = 0; k * BEAT * 4 < END - 3.2; k++) {
      const t0 = k * BEAT * 4, t1 = Math.min(t0 + BEAT * 4, END - 3.2);
      pad(t0, chordAt(t0).n, t1 - t0 + 0.4, t0 < 7 ? 0.026 : 0.032, t0 < 7 ? 900 : 1500, 0.4, 0.8);
    }
    // pulse: half-time kick, sub bass, soft 1/8 hats; drops out for the tagline, returns
    for (let i = 0; i * BEAT < END - 3.3; i++) {
      const t = i * BEAT, beat = i % 4, ch = chordAt(t);
      const calm = t >= 11.4 && t < 12.6;
      if (t >= 1.2 && !calm && (beat === 0 || beat === 2)) kick(t, beat === 0 ? 0.62 : 0.42);
      if (t >= 1.2 && !calm) bass(t, ch.r, 0.5, 0.22);
      if (t >= 2.4 && !calm) { hat(t + BEAT / 2, 0.035, false, 0.2); if (t >= 7.2) hat(t + BEAT / 4, 0.02, false, -0.25); }
      if (t >= 7.2 && t < 11.4) pluck(t + BEAT / 2, ch.n[(i % 3) + 2] + 12, 0.035, 0.5, i % 2 ? 0.3 : -0.3);
    }

    // ── SFX on the picture ──────────────────────────────────────────────────
    CUES.cuts.forEach((t) => boom(t, 0.42));
    whoosh(0.05, 0.9, 300, 1400, 0.03);                         // open: air
    CUES.whips.forEach((t) => whoosh(t - 0.18, 0.42, 900, 4200, 0.06));
    CUES.stars.forEach((t, i) => sparkle(t, [79, 83, 86, 91, 95][i], 0.1, -0.4 + i * 0.2));
    for (let k = 0; k < 18; k++) uiTap(CUES.count[0] + k * ((CUES.count[1] - CUES.count[0]) / 18), 0.025);   // rating ticks
    CUES.flips.forEach((t, i) => clack(t, 0.06 + 0.03 * (i % 3 === 0), (i % 3 - 1) * 0.3));
    CUES.lamps.forEach((t, i) => chime(t, [76, 79, 83, 86, 88][i], 0.05, -0.3 + i * 0.15));
    riser(CUES.tap - 1.0, CUES.tap, 0.05);
    chime(CUES.tap + 0.005, 88, 0.13, -0.1); chime(CUES.tap + 0.1, 95, 0.1, 0.1); haptic(CUES.tap + 0.02, 0.2);
    whoosh(CUES.tap + 0.05, 0.7, 2600, 500, 0.035);
    CUES.branches.forEach((t, i) => pluck(t, [69, 72, 76, 79][i], 0.07, 0.8, -0.35 + i * 0.23));
    CUES.typing.forEach((t) => keyTick(t, 0.05));
    const tf = CUES.final;
    boom(tf, 0.5);
    pad(tf, [45, 52, 57, 64, 67, 71], DUR - tf - 0.2, 0.05, 1700, 0.15, 0.9);
    bass(tf, 33, 2.0, 0.26);
    [69, 72, 76, 79, 83].forEach((m, i) => pluck(tf + 0.35 + i * 0.09, m, 0.04, 0.8, -0.3 + i * 0.15));
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
