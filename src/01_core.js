
/* =====================================================================
   EGO BLOCKS  |  core utilities, field constants, save data, audio
   ===================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const sgn = (v) => (v < 0 ? -1 : 1);
const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const dampAngle = (a, b, k, dt) => a + wrapA(b - a) * (1 - Math.exp(-k * dt));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _m1 = new THREE.Matrix4(), _e1 = new THREE.Euler(), _s1 = new THREE.Vector3();
const _c1 = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
function dist2D(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
function len2D(x, z) { return Math.sqrt(x * x + z * z); }
function yawTo(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
function fwdX(yaw) { return Math.sin(yaw); }
function fwdZ(yaw) { return Math.cos(yaw); }
/** distance from point p to segment a-b on the ground plane */
function segDist2D(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const l2 = abx * abx + abz * abz || 1e-6;
  const t = clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / l2, 0, 1);
  const cx = a.x + abx * t, cz = a.z + abz * t;
  return { d: Math.hypot(p.x - cx, p.z - cz), t };
}
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/* ---------- pitch geometry (1 unit = 1 block) ----------
   Blue team defends -Z and attacks +Z. Orange is the mirror. */
const F = {
  W: 20.5,          // touchline outer edge (x)
  L: 32.5,          // goal line outer edge (z)
  GW: 4.5,          // half width of the goal mouth (inner)
  GH: 3.0,          // goal mouth height (inner, crossbar underside)
  GD: 2.5,          // net depth behind the goal line
  POST: 0.5,        // post / bar thickness
  BOARD_X: 24.0,    // advertising boards (ball bounces off these)
  BOARD_Z: 36.5,
  BOX_W: 9.5,       // penalty box half width (outer edge)
  BOX_D: 7.5,       // penalty box depth from goal line
};
const BALL_R = 0.3;
const BALL_G = 16;
const P_R = 0.42;
const P_H = 1.9;
const GRAV = 22;

/* ---------- save data ---------- */
const Save = {
  key: 'egoblocks.save.v1',
  data: null,
  ok: true,
  defaults() {
    return {
      v: 1, emeralds: 500, styles: ['ROOKIE'], flows: [], style: 'ROOKIE', flow: null,
      rp: 0, pity: { style: 0, flow: 0 },
      stats: { played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, spins: 0 },
      settings: { mute: false, quality: 'auto', sens: 1, invertY: false, btn: 1, assist: true },
      howto: false,
    };
  },
  load() {
    let d = null;
    try { const raw = window.localStorage.getItem(this.key); if (raw) d = JSON.parse(raw); }
    catch (e) { this.ok = false; }
    const def = this.defaults();
    const out = Object.assign({}, def, d && typeof d === 'object' ? d : {});
    out.pity = Object.assign({}, def.pity, out.pity || {});
    out.stats = Object.assign({}, def.stats, out.stats || {});
    out.settings = Object.assign({}, def.settings, out.settings || {});
    const st = out.settings;
    if (!['auto', 'low', 'med', 'high'].includes(st.quality)) st.quality = 'auto';
    st.sens = clamp(Number(st.sens) || 1, 0.3, 2.5);
    st.btn = [0.85, 1, 1.15].includes(Number(st.btn)) ? Number(st.btn) : 1;
    st.assist = st.assist !== false; st.mute = !!st.mute; st.invertY = !!st.invertY;
    if (!Array.isArray(out.styles)) out.styles = ['ROOKIE'];
    if (!Array.isArray(out.flows)) out.flows = [];
    out.styles = out.styles.filter((s) => typeof s === 'string');
    if (!out.styles.includes('ROOKIE')) out.styles.unshift('ROOKIE');
    out.emeralds = Math.max(0, Math.floor(Number(out.emeralds) || 0));
    out.rp = Math.max(0, Math.floor(Number(out.rp) || 0));
    this.data = out;
  },
  validate() {
    const d = this.data;
    d.styles = d.styles.filter((s) => STYLES[s]);
    if (!d.styles.includes('ROOKIE')) d.styles.unshift('ROOKIE');
    d.flows = d.flows.filter((f) => FLOWS[f]);
    if (!STYLES[d.style] || !d.styles.includes(d.style)) d.style = 'ROOKIE';
    if (d.flow && (!FLOWS[d.flow] || !d.flows.includes(d.flow))) d.flow = null;
  },
  save() {
    try { window.localStorage.setItem(this.key, JSON.stringify(this.data)); this.ok = true; }
    catch (e) { this.ok = false; }
  },
};

/* ---------- WebAudio retro sound ---------- */
const Sfx = (() => {
  let ctx = null, master = null, bus = null, noiseBuf = null, crowdGain = null, crowdFilter = null;
  let muted = false, crowdBase = 0;
  const now = () => ctx.currentTime;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.75; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(master); bus = comp;
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // crowd bed: looping filtered noise with a slow wobble
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 650; crowdFilter.Q.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23; const lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG); lfoG.connect(crowdFilter.frequency); lfo.start();
    src.connect(crowdFilter); crowdFilter.connect(lp); lp.connect(crowdGain); crowdGain.connect(bus); src.start();
  }
  function env(g, t0, attack, peak, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
  }
  function tone(freq, dur, o = {}) {
    if (!ctx || muted) return;
    const t0 = now() + (o.delay || 0), a = o.attack || 0.004;
    const osc = ctx.createOscillator(); osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + a + dur);
    const g = ctx.createGain(); env(g, t0, a, o.vol == null ? 0.12 : o.vol, dur);
    osc.connect(g); g.connect(bus); osc.start(t0); osc.stop(t0 + a + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!ctx || muted) return;
    const t0 = now() + (o.delay || 0), a = o.attack || 0.004;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t0 + a + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); env(g, t0, a, o.vol == null ? 0.15 : o.vol, dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + a + dur + 0.05);
  }
  function whistleBlast(t0, len) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2700;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 31;
    const lg = ctx.createGain(); lg.gain.value = 130; lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
    g.gain.setValueAtTime(0.09, t0 + Math.max(0.03, len - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g); g.connect(bus);
    o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.05); lfo.stop(t0 + len + 0.05);
  }
  const NOTES = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0, 2637.0];
  return {
    init,
    get muted() { return muted; },
    setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.75; },
    kick(p = 0.5) {
      tone(150 + 70 * p, 0.11, { type: 'sine', vol: 0.32 + 0.3 * p, slide: 42 });
      noise(0.04 + 0.05 * p, { vol: 0.12 + 0.22 * p, type: 'highpass', freq: 1600 });
    },
    touch() { tone(220, 0.04, { type: 'sine', vol: 0.12, slide: 120 }); },
    thud(v = 0.5) { tone(95, 0.07, { type: 'sine', vol: 0.18 * v, slide: 45 }); },
    whistle(kind = 1) {
      if (!ctx || muted) return;
      const t = now();
      if (kind === 3) { whistleBlast(t, 0.32); whistleBlast(t + 0.42, 0.32); whistleBlast(t + 0.84, 0.95); }
      else if (kind === 2) { whistleBlast(t, 0.16); whistleBlast(t + 0.24, 0.36); }
      else whistleBlast(t, 0.38);
    },
    setCrowd(level) {
      crowdBase = level * 0.07;
      if (ctx && crowdGain) crowdGain.gain.setTargetAtTime(muted ? 0 : crowdBase, now(), 0.6);
    },
    roar(level = 1) {
      if (!ctx || muted || !crowdGain) return;
      const t = now();
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(Math.max(crowdGain.gain.value, 0.0001), t);
      crowdGain.gain.linearRampToValueAtTime(0.32 * level, t + 0.25);
      crowdGain.gain.linearRampToValueAtTime(0.22 * level, t + 1.6);
      crowdGain.gain.linearRampToValueAtTime(crowdBase, t + 4.5);
      noise(1.6, { vol: 0.2 * level, type: 'bandpass', freq: 900, q: 0.4, attack: 0.15 });
    },
    ooh() {
      if (!ctx || muted || !crowdGain) return;
      const t = now();
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(Math.max(crowdGain.gain.value, 0.0001), t);
      crowdGain.gain.linearRampToValueAtTime(0.18, t + 0.2);
      crowdGain.gain.linearRampToValueAtTime(crowdBase, t + 1.6);
      noise(0.9, { vol: 0.1, type: 'bandpass', freq: 420, slide: 280, q: 1.2, attack: 0.1 });
    },
    tick() { tone(1500 + Math.random() * 300, 0.018, { type: 'square', vol: 0.06 }); },
    click() { tone(660, 0.035, { type: 'square', vol: 0.05 }); },
    deny() { tone(180, 0.09, { type: 'square', vol: 0.07 }); tone(140, 0.12, { type: 'square', vol: 0.07, delay: 0.08 }); },
    fanfare(r) {
      const n = [3, 4, 5, 6, 8][r] || 3;
      for (let i = 0; i < n; i++) {
        tone(NOTES[i], 0.1 + 0.04 * r, { type: 'square', vol: 0.06, delay: i * (0.085 - r * 0.005) });
        tone(NOTES[i] / 2, 0.12 + 0.04 * r, { type: 'triangle', vol: 0.08, delay: i * (0.085 - r * 0.005) });
      }
      if (r >= 2) tone(NOTES[n - 1], 0.6, { type: 'triangle', vol: 0.1, delay: n * 0.08 });
      if (r >= 3) noise(0.8, { vol: 0.08, type: 'highpass', freq: 5000, delay: n * 0.08 });
      if (r >= 4) { tone(200, 1.2, { type: 'sawtooth', vol: 0.05, slide: 2400, delay: 0.05 }); tone(NOTES[7], 0.9, { type: 'square', vol: 0.05, delay: 0.9 }); }
    },
    dodge() { noise(0.14, { vol: 0.16, type: 'bandpass', freq: 900, slide: 3200, q: 2.5 }); },
    swoosh() { noise(0.22, { vol: 0.14, type: 'bandpass', freq: 500, slide: 2400, q: 1.6 }); },
    tackle() { noise(0.1, { vol: 0.28, type: 'lowpass', freq: 700 }); tone(80, 0.12, { type: 'sine', vol: 0.3, slide: 38 }); },
    slide() { noise(0.35, { vol: 0.12, type: 'lowpass', freq: 1400, slide: 300 }); },
    ability() { tone(330, 0.14, { type: 'sawtooth', vol: 0.06, slide: 990 }); tone(660, 0.1, { type: 'square', vol: 0.04, delay: 0.06 }); },
    flow() { for (let i = 0; i < 6; i++) tone(NOTES[i] * 0.75, 0.12, { type: 'square', vol: 0.06, delay: i * 0.05 }); noise(0.7, { vol: 0.1, type: 'bandpass', freq: 600, slide: 4000, q: 1.5 }); },
    clang() { tone(1250, 0.45, { type: 'triangle', vol: 0.13, slide: 1150 }); tone(1870, 0.3, { type: 'sine', vol: 0.07 }); },
    save() { tone(160, 0.08, { type: 'square', vol: 0.12, slide: 90 }); noise(0.08, { vol: 0.16, type: 'lowpass', freq: 900 }); },
    pickup() { tone(880, 0.05, { type: 'square', vol: 0.07 }); tone(1320, 0.08, { type: 'square', vol: 0.07, delay: 0.06 }); },
    coin() { tone(988, 0.06, { type: 'square', vol: 0.06 }); tone(1319, 0.14, { type: 'square', vol: 0.06, delay: 0.06 }); },
    boom() { noise(0.9, { vol: 0.45, type: 'lowpass', freq: 900, slide: 70 }); tone(62, 0.55, { type: 'sine', vol: 0.42, slide: 28 }); },
    zap() { tone(1800, 0.12, { type: 'sawtooth', vol: 0.06, slide: 300 }); noise(0.1, { vol: 0.1, type: 'highpass', freq: 3000 }); },
    freeze() { tone(2400, 0.25, { type: 'triangle', vol: 0.07, slide: 3600 }); noise(0.3, { vol: 0.1, type: 'highpass', freq: 4000 }); },
    punch() { noise(0.08, { vol: 0.3, type: 'lowpass', freq: 1200 }); tone(110, 0.1, { type: 'square', vol: 0.15, slide: 60 }); },
    boing() { tone(260, 0.22, { type: 'sine', vol: 0.15, slide: 620 }); },
    beam() { tone(90, 0.6, { type: 'sawtooth', vol: 0.1, slide: 40 }); noise(0.5, { vol: 0.2, type: 'bandpass', freq: 2500, slide: 400, q: 1 }); },
    countdown(hi) { tone(hi ? 1046 : 523, 0.12, { type: 'square', vol: 0.07 }); },
  };
})();
