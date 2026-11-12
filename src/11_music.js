/* =====================================================================
   Music (Nov 2026, CrazyGames quality guidelines: "any music complements the visual experience"). Our own tune,
   played by the game itself like every other sound (no music files): drums, a synth bass, chord stabs and a lead,
   116 BPM, A minor (Am F C G), 16 bars that loop (a calm A half, then a fuller B half). It plays on the start screen,
   in the menus and on the results; in a match it fades out so you hear the crowd. Off with MUSIC OFF / SOUND OFF.
   ===================================================================== */
const MUSIC_BPM = 116, MUSIC_VOL = 1.1;
const MUSIC_CHORDS = [ // each bar: bass root (MIDI) and the chord stab
  [45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]],
];
/** the lead: per bar, [16th step, MIDI note, length in 16ths]. Bars 1-8 the A tune, 9-16 the B tune */
const MUSIC_LEAD = [
  [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 69, 4], [12, 72, 2], [14, 74, 2]],
  [[0, 72, 3], [3, 69, 3], [6, 65, 2], [8, 69, 4], [14, 72, 2]],
  [[0, 67, 2], [2, 72, 2], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 74, 4]],
  [[0, 71, 4], [4, 67, 2], [6, 71, 2], [8, 74, 6]],
  [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 69, 4], [12, 72, 2], [14, 74, 2]],
  [[0, 72, 3], [3, 69, 3], [6, 65, 2], [8, 69, 4], [14, 72, 2]],
  [[0, 79, 2], [2, 76, 2], [4, 72, 4], [8, 76, 2], [10, 79, 2], [12, 81, 4]],
  [[0, 79, 4], [4, 74, 4], [8, 71, 8]],
  [[0, 81, 2], [3, 81, 1], [4, 79, 2], [6, 76, 2], [8, 76, 2], [10, 79, 2], [12, 76, 4]],
  [[0, 77, 2], [3, 77, 1], [4, 76, 2], [6, 72, 2], [8, 72, 4], [12, 69, 4]],
  [[0, 79, 2], [2, 76, 2], [4, 79, 2], [6, 84, 4], [10, 83, 2], [12, 79, 4]],
  [[0, 83, 4], [4, 81, 2], [6, 79, 2], [8, 74, 8]],
  [[0, 81, 2], [3, 81, 1], [4, 79, 2], [6, 76, 2], [8, 76, 2], [10, 79, 2], [12, 76, 4]],
  [[0, 77, 2], [3, 77, 1], [4, 76, 2], [6, 72, 2], [8, 72, 4], [12, 69, 4]],
  [[0, 79, 2], [2, 76, 2], [4, 79, 2], [6, 84, 4], [10, 83, 2], [12, 79, 4]],
  [[0, 79, 2], [2, 81, 2], [4, 83, 4], [8, 84, 8]],
];
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const Music = {
  on: false, step: 0, next: 0, timer: null, out: null, ctx: null,
  /** the menus want music, a match does not (called from UI.show, the results and settings) */
  set(want) {
    this.want = !!want;
    this.apply();
  },
  allowed() { const s = Save.data.settings; return this.want && s.music !== false && !s.mute && !Sfx.muted && !document.hidden && (!navigator.webdriver || this.test); }, // automated tests and the video tools: no music unless a test asks
  apply() {
    const A = Sfx.music && Sfx.music(); // null until the first click or tap starts the sound
    if (!A) return;
    this.ctx = A.ctx; this.out = A.out;
    const t = A.ctx.currentTime, g = A.out.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t);
    if (this.allowed()) {
      g.exponentialRampToValueAtTime(MUSIC_VOL, t + 1.2);
      if (!this.timer) { this.next = t + 0.1; this.timer = setInterval(() => this.tick(), 50); }
      this.on = true;
    } else if (this.on) {
      g.exponentialRampToValueAtTime(0.0001, t + 0.9);
      this.on = false;
      clearTimeout(this.stopT); this.stopT = setTimeout(() => { if (!this.on) { clearInterval(this.timer); this.timer = null; } }, 1000);
    }
  },
  /** schedule the 16th notes due in the next quarter second */
  tick() {
    const ctx = this.ctx; if (!ctx) return;
    const s16 = 60 / MUSIC_BPM / 4;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.05; // the tab was asleep: start again from now
    while (this.next < ctx.currentTime + 0.25) { this.play(this.step, this.next); this.step = (this.step + 1) % 256; this.next += s16; }
  },
  play(step, t) {
    const bar = Math.floor(step / 16), s = step % 16, B = bar >= 8, [root, chord] = MUSIC_CHORDS[bar % 4];
    // drums: kick on 1 and 3 (every beat in the B half), clap on 2 and 4, hats on the 8ths (16ths in B)
    if (s % 8 === 0 || (B && s % 4 === 0)) this.kick(t);
    if (s === 4 || s === 12) this.clap(t, bar % 4 === 3 && s === 12 ? 1.3 : 1);
    if (s % 2 === 0 || B) this.hat(t, s % 4 === 2 ? 0.032 : 0.016);
    if (bar === 15 && s >= 12) this.clap(t, 0.6); // a little fill into the loop
    // bass: a bouncing root, an octave up on the offbeats
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.bass(midiHz(s === 6 || s === 14 ? root + 12 : root), t);
    // chord stabs on the offbeats; the B half adds a soft pad
    if (s % 4 === 2) for (const n of chord) this.stab(midiHz(n), t);
    if (B && s === 0) for (const n of chord) this.pad(midiHz(n - 12), t, 16 * 60 / MUSIC_BPM / 4);
    // the lead
    for (const [at, n, len] of MUSIC_LEAD[bar]) if (at === s) this.lead(midiHz(n), t, len * 60 / MUSIC_BPM / 4);
  },
  voice(type, f, t, dur, vol, cut, a = 0.005) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f, t);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    o.connect(lp); lp.connect(g); g.connect(this.out); o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  },
  kick(t) { const o = this.voice('sine', 150, t, 0.16, 0.5, 4000, 0.002); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); },
  clap(t, k) { this.hiss(t, 0.09, 0.09 * k, 'bandpass', 1700, 1.1); this.hiss(t + 0.012, 0.06, 0.06 * k, 'bandpass', 2300, 1.4); },
  hat(t, vol) { this.hiss(t, 0.03, vol, 'highpass', 7000, 0.8); },
  hiss(t, dur, vol, type, f, q) {
    const ctx = this.ctx, A = Sfx.music(), src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(this.out); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  bass(f, t) { this.voice('square', f, t, 0.13, 0.085, 520); this.voice('sine', f, t, 0.16, 0.09, 2000); },
  stab(f, t) { this.voice('sawtooth', f, t, 0.09, 0.022, 1900); },
  pad(f, t, dur) { this.voice('triangle', f, t, dur, 0.03, 1200, 0.25); },
  lead(f, t, dur) {
    const o = this.voice('square', f, t, Math.max(0.08, dur * 0.85), 0.045, 2600);
    const v = this.ctx.createOscillator(), vg = this.ctx.createGain(); // a little vibrato on long notes
    v.frequency.value = 5.5; vg.gain.value = dur > 0.3 ? f * 0.006 : 0; v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + dur + 0.1);
  },
};
document.addEventListener('visibilitychange', () => Music.apply()); // quiet while the tab is hidden
