/* =====================================================================
   Reveal: the 3D spin. A block drops onto the lit spot, shakes and glows
   in the rarity colour (now and then teasing a better colour first),
   then cracks open on your player posing in what you won. Rarer pulls
   shake longer and burst bigger. The roll itself happens before this
   starts (UI.spin), so the odds and the pity never depend on it.
   ===================================================================== */
const REVEAL_DROP = 0.7, REVEAL_SHAKE = [1.0, 1.5, 2.1, 2.7, 3.3]; // seconds of shaking per rarity
const Reveal = {
  on: false, phase: 'idle', t: 0, res: null, plan: null, done: null, tickT: 0, sparkT: 0,
  init() {
    // a dark bevelled block; the glow map lights its seams and a ? on every face
    const base = Tex.pixels(16, 16, (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [12, 14, 26];
      if (x === 1 || y === 1 || x === 14 || y === 14) return [70, 78, 120];
      return shadeRGB([38, 44, 78], 0.92 + ((x * 7 + y * 3) % 5) * 0.03);
    });
    const Q = PF5['?'];
    const glow = Tex.pixels(16, 16, (x, y) => {
      const seam = x === 2 || x === 13 || y === 2 || y === 13, qx = x - 6, qy = y - 4;
      const q = qx >= 0 && qx < 5 && qy >= 0 && qy < 7 && (Q[qy] & (16 >> qx));
      return seam || q ? [255, 255, 255] : [0, 0, 0];
    });
    this.mat = new THREE.MeshLambertMaterial({ map: base, emissiveMap: glow, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.4 });
    this.block = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), this.mat);
    this.block.castShadow = true;
    this.haloMat = new THREE.SpriteMaterial({ map: World.T.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.halo = new THREE.Sprite(this.haloMat);
    this.group = new THREE.Group(); this.group.add(this.block, this.halo); this.group.visible = false;
    World.scene.add(this.group);
  },
  /** total time from SPIN to the crack, for a rarity */
  duration(r) { return REVEAL_DROP + REVEAL_SHAKE[r]; },
  /** the spin screen is open: a closed block waits on the spot */
  ready() {
    this.on = true; this.phase = 'idle'; this.t = 0; this.done = null; this.group.visible = true; this.block.visible = true;
    this.setGlow(lin('#a4a9cf'), 0.35, 0.2);
    Showcase.hidePlayer = true;
  },
  stop() { this.on = false; this.phase = 'idle'; this.group.visible = false; this.done = null; Showcase.hidePlayer = false; },
  /** res: { kind, id, r, dupe }; done() runs at the crack. opts.fake forces (true) or blocks (false) the tease */
  start(res, done, opts = {}) {
    this.ready();
    this.res = res; this.done = done; this.phase = 'drop'; this.t = 0; this.tickT = 0;
    // colour plan: climb through the rarities to the real one; sometimes climb one step too far, then fizzle back
    const r = res.r, fake = opts.fake != null ? opts.fake && r < 4 : r < 4 && chance(0.3);
    const steps = []; for (let i = 0; i <= r; i++) steps.push(i);
    if (fake) steps.push(r + 1, r);
    this.plan = { steps, fake, fizzleAt: fake ? 0.78 : 2 };
    Showcase.hidePlayer = true;
  },
  skip() { if (this.phase === 'drop' || this.phase === 'shake') this.open(); },
  /** a rarity's colour; Generational cycles the rainbow */
  colorOf(i, t) { return i >= 4 ? col(PRISM_COLS[Math.floor(t * 10) % PRISM_COLS.length]) : col(RARITY_HEX[RARITIES[i]]); },
  setGlow(c, intensity, halo) {
    this.mat.emissive.copy(c); this.mat.emissiveIntensity = intensity;
    this.haloMat.color.copy(c); this.haloMat.opacity = halo;
  },
  update(dt) {
    if (!this.on) return;
    this.t += dt;
    const b = this.block, r = this.res ? this.res.r : 0;
    if (this.phase === 'idle') {
      b.position.set(0, 0.85 + Math.sin(this.t * 1.6) * 0.08, 0); b.rotation.set(0, this.t * 0.6, 0);
    } else if (this.phase === 'drop') {
      const k = Math.min(1, this.t / (REVEAL_DROP * 0.8));
      let y = lerp(14, 0.65, k * k);
      if (k >= 1) { const bt = (this.t - REVEAL_DROP * 0.8) / (REVEAL_DROP * 0.2); y = 0.65 + Math.sin(Math.min(1, bt) * Math.PI) * 0.35; }
      if (k >= 1 && !this.landed) { this.landed = true; FX.dust(0, 0, 14); FX.ring(0, 0.1, 0, '#c9b590', 1.4, 20); Sfx.thud(1); Sfx.tackle(); Shake.add(0.35); }
      b.position.set(0, y, 0); b.rotation.set(0, this.t * 3, 0);
      if (this.t >= REVEAL_DROP) { this.phase = 'shake'; this.t = 0; this.landed = false; }
    } else if (this.phase === 'shake') {
      const dur = REVEAL_SHAKE[r], k = Math.min(1, this.t / dur), P = this.plan;
      // which colour step we are on; the tease fizzles back at fizzleAt
      const n = P.steps.length, fz = k >= P.fizzleAt;
      const idx = P.fake ? (fz ? P.steps[n - 1] : P.steps[Math.min(n - 2, Math.floor(k / P.fizzleAt * (n - 1)))]) : P.steps[Math.min(n - 1, Math.floor(k * n))];
      if (P.fake && fz && !P.fizzled) { P.fizzled = true; Sfx.fizzle(); FX.sparks(0, 0.7, 0, '#5a5f78', 14, 3); }
      const flick = P.fake && fz && k < P.fizzleAt + 0.06 ? (Math.random() < 0.5 ? 0.1 : 1) : 1;
      const amp = 0.02 + 0.11 * Math.pow(k, 1.6) * (1 + r * 0.15);
      b.position.set(rand(-amp, amp), 0.65 + Math.abs(rand(-amp, amp)) * 0.6, rand(-amp, amp));
      b.rotation.set(rand(-amp, amp) * 1.5, b.rotation.y + dt * (1 + k * 6), rand(-amp, amp) * 1.5);
      const c = this.colorOf(idx, this.t);
      this.setGlow(c, (0.5 + 1.6 * k) * flick, (0.15 + 0.6 * k) * flick);
      this.halo.position.copy(b.position); this.halo.scale.setScalar(3 + 2.5 * k + r * 0.4);
      // rising ticks, faster as it gets closer
      this.tickT -= dt;
      if (this.tickT <= 0) { this.tickT = lerp(0.3, 0.07, k); Sfx.charge(k); }
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = lerp(0.12, 0.025, k);
        const a = Math.random() * TAU, rr = rand(0.7, 1.4);
        FX.glow.spawn(Math.cos(a) * rr, rand(0.1, 1.4), Math.sin(a) * rr, -Math.sin(a) * 1.5, rand(0.8, 2.2), Math.cos(a) * 1.5, rand(0.07, 0.15), rand(0.4, 0.8), c, -0.03, 0.4, 0);
      }
      if (this.t >= dur) this.open();
    } else if (this.phase === 'done') {
      this.haloMat.opacity = Math.max(0, this.haloMat.opacity - dt * 0.5);
    }
  },
  /** crack it open: shards, a flash and fanfare in the rarity colour, then your player in the prize */
  open() {
    const res = this.res, r = res.r, hex = r >= 4 ? '#ffffff' : RARITY_HEX[RARITIES[r]];
    this.phase = 'done'; this.t = 0;
    this.block.visible = false;
    for (let i = 0; i < 26 + r * 10; i++) FX.lit.spawn(rand(-0.6, 0.6), rand(0.1, 1.3), rand(-0.6, 0.6), rand(-6, 6), rand(3, 9), rand(-6, 6), rand(0.12, 0.3), rand(0.8, 1.6), col(pick(['#262c4e', '#464e78', '#0c0e1a'])), 1, 0.4);
    const hexes = r >= 4 ? PRISM_COLS : [hex, '#ffffff'];
    FX.sparks(0, 0.8, 0, hexes[0], 40 + r * 20, 8 + r * 2, 0.22, 0.9);
    FX.ring(0, 0.2, 0, hexes[0], 1.8, 30);
    if (r >= 2) FX.ring(0, 1.0, 0, hexes[hexes.length > 2 ? 2 : 1], 2.4, 30);
    if (r >= 3) for (let i = 0; i < r; i++) FX.rocket(rand(-6, 6), rand(4, 9), hexes, 0.2 + i * 0.35);
    this.setGlow(this.colorOf(r, 0), 0, 0.9);
    Shake.add(0.25 + r * 0.12);
    Sfx.punch(); Sfx.fanfare(r);
    const fl = $('flash');
    fl.className = r === 4 ? 'rainbow' : ''; fl.style.background = r === 4 ? '' : hex;
    fl.animate([{ opacity: r >= 2 ? 0.75 : 0.4 }, { opacity: 0 }], { duration: 380 + r * 260, easing: 'steps(6)' });
    // the player strikes a pose in the new style, Flow or skin
    const spec = { look: {}, celebrate: true };
    if (res.kind === 'style') spec.style = res.id; else if (res.kind === 'flow') spec.flow = res.id; else spec.look[SKINS[res.id].slot] = res.id;
    Showcase.preview(spec);
    Showcase.hidePlayer = false;
    const d = this.done; this.done = null;
    if (d) d();
  },
};
