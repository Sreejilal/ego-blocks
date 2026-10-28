/* =====================================================================
   Players: blocky humanoid model, procedural animation, movement
   ===================================================================== */
// the two sides of the current match (club, kit, keeper kit, UI colour); Match sets them with matchSides()
const TEAM = [null, null];
const SKIN_TONES = ['#f1c7a0', '#e0ac85', '#c48b62', '#9a6643', '#6e4a32', '#f6d6b8'];
const EYE_COLS = ['#2b1d14', '#1d2b4a', '#2a3a1c', '#3a2a14'];
const RUN_SPEED = 6.9, SPRINT_SPEED = 10.4;

const PlayerGeo = {
  g: null,
  get() {
    if (this.g) return this.g;
    const eyes = new VoxBuilder();
    eyes.box(-0.18, -0.03, 0, -0.06, 0.03, 0.03, '#ffffff', { ao: 1 });
    eyes.box(0.06, -0.03, 0, 0.18, 0.03, 0.03, '#ffffff', { ao: 1 });
    this.g = {
      head: boxAtlas(0.48, 0.48, 0.48, ATLAS.head),
      body: boxAtlas(0.48, 0.72, 0.26, ATLAS.body),
      arm: boxAtlas(0.22, 0.72, 0.22, ATLAS.arm),
      leg: boxAtlas(0.23, 0.72, 0.23, ATLAS.leg),
      eyes: eyes.geometry(),
      ring: (() => { const v = new VoxBuilder(); const r = 1.0, t = 0.16; v.box(-r, 0, -r, r, 0.06, -r + t); v.box(-r, 0, r - t, r, 0.06, r); v.box(-r, 0, -r + t, -r + t, 0.06, r - t); v.box(r - t, 0, -r + t, r, 0.06, r - t); return v.geometry(); })(),
      cube: new THREE.BoxGeometry(1, 1, 1),
      blob: (() => { const g = new THREE.PlaneGeometry(0.9, 0.9); g.rotateX(-Math.PI / 2); return g; })(),
      blobMat: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    };
    return this.g;
  },
};
const HAIR_SHAPES = {
  short: [[-0.26, -0.05, -0.26, 0.26, 0.09, 0.26]],
  crop: [[-0.255, -0.02, -0.255, 0.255, 0.035, 0.255], [-0.14, 0.035, 0.1, 0.14, 0.11, 0.27]], // buzz cut with a small quiff
  long: [[-0.27, -0.06, -0.27, 0.27, 0.1, 0.27], [-0.27, -0.66, -0.3, 0.27, 0.0, -0.17], [-0.28, -0.3, -0.27, -0.2, 0.0, 0.1], [0.2, -0.3, -0.27, 0.28, 0.0, 0.1]],
  bob: [[-0.27, -0.06, -0.27, 0.27, 0.1, 0.27], [-0.29, -0.34, -0.27, -0.2, 0.0, 0.2], [0.2, -0.34, -0.27, 0.29, 0.0, 0.2], [-0.27, -0.38, -0.3, 0.27, 0.0, -0.17], [-0.27, -0.12, 0.2, 0.27, 0.02, 0.3]],
  swept: [[-0.27, -0.06, -0.27, 0.27, 0.12, 0.27], [-0.27, -0.3, -0.3, 0.27, 0.0, -0.18], [-0.27, 0.02, 0.12, 0.27, 0.2, 0.32]],
  messy: [[-0.28, -0.06, -0.28, 0.28, 0.12, 0.28], [-0.3, -0.26, -0.2, -0.2, 0.02, 0.1], [0.2, -0.22, -0.24, 0.3, 0.02, 0.06], [-0.1, 0.1, -0.12, 0.08, 0.22, 0.06], [0.06, 0.1, 0.06, 0.2, 0.18, 0.2], [-0.24, -0.3, -0.31, 0.2, 0.0, -0.2]],
  fluffy: [[-0.31, -0.08, -0.31, 0.31, 0.17, 0.31], [-0.32, -0.3, -0.31, -0.22, 0.0, 0.16], [0.22, -0.3, -0.31, 0.32, 0.0, 0.16], [-0.3, -0.36, -0.33, 0.3, 0.0, -0.18]],
  spiky: [[-0.26, -0.06, -0.26, 0.26, 0.1, 0.26], [-0.2, 0.1, -0.16, -0.08, 0.26, -0.04], [0.02, 0.1, -0.06, 0.14, 0.3, 0.06], [-0.1, 0.1, 0.08, 0.02, 0.22, 0.2], [0.12, 0.1, -0.22, 0.24, 0.24, -0.1], [-0.22, 0.1, 0.02, -0.12, 0.2, 0.14], [-0.26, -0.24, -0.29, 0.26, 0.0, -0.18]],
  bun: [[-0.26, -0.05, -0.26, 0.26, 0.08, 0.26], [-0.26, -0.22, -0.29, 0.26, 0.0, -0.18], [-0.11, 0.08, -0.24, 0.11, 0.27, -0.04]],
  flattop: [[-0.27, -0.06, -0.27, 0.27, 0.27, 0.27], [-0.27, -0.16, -0.29, 0.27, 0.0, -0.18]],
  mohawk: [[-0.25, -0.03, -0.25, 0.25, 0.02, 0.25], [-0.06, 0.0, -0.29, 0.06, 0.14, 0.25], [-0.05, 0.14, 0.1, 0.05, 0.25, 0.21], [-0.05, 0.14, -0.07, 0.05, 0.31, 0.05], [-0.05, 0.14, -0.25, 0.05, 0.24, -0.12]],
};
/** headband size: hug the head, or the hair where the band crosses it (head-local y 0.355 to 0.415) */
const _bandCache = {};
function bandGeo(shape) {
  if (_bandCache[shape]) return _bandCache[shape];
  let x = 0.25, zf = 0.25, zb = 0.25;
  for (const b of HAIR_SHAPES[shape] || HAIR_SHAPES.short) {
    if (b[4] + 0.48 < 0.355 || b[1] + 0.48 > 0.415) continue;
    x = Math.max(x, -b[0] + 0.012, b[3] + 0.012); zb = Math.max(zb, -b[2] + 0.012); zf = Math.max(zf, b[5] + 0.012);
  }
  const v = new VoxBuilder(); v.box(-x, 0.355, -zb, x, 0.415, zf, '#ffffff', { ao: 0.85 });
  return (_bandCache[shape] = v.geometry());
}
let _accGeo = null;
function accGeo() {
  if (_accGeo) return _accGeo;
  const mask = new VoxBuilder(); mask.box(-0.255, 0.0, -0.06, 0.255, 0.19, 0.258, '#ffffff', { ao: 0.8 });
  mask.box(-0.258, 0.07, 0.2, 0.258, 0.1, 0.262, '#9a9fb0', { ao: 1 });
  // a chain hangs from the collar in a V, with a square pendant
  const chain = new VoxBuilder(), c = 0.022;
  for (let i = 0; i <= 6; i++) { const t = i / 6, x = 0.14 * (1 - t), y = 0.71 - 0.19 * t; for (const s of [1, -1]) chain.box(s * x - c, y - c, 0.128, s * x + c, y + c, 0.155, '#ffffff', { ao: 0.9 }); }
  chain.box(-0.045, 0.43, 0.128, 0.045, 0.52, 0.17, '#ffffff', { ao: 0.9 });
  return (_accGeo = { mask: mask.geometry(), chain: chain.geometry() });
}
const _hairGeoCache = {}, _hairMatCache = {}, _eyeMatCache = {};
function hairGeo(shape) {
  if (_hairGeoCache[shape]) return _hairGeoCache[shape];
  const v = new VoxBuilder();
  for (const b of HAIR_SHAPES[shape] || HAIR_SHAPES.short) v.box(b[0], b[1], b[2], b[3], b[4], b[5], '#ffffff', { uv: 6, ao: 0.82 });
  return (_hairGeoCache[shape] = v.geometry());
}
function hairMat(hex) { return _hairMatCache[hex] || (_hairMatCache[hex] = new THREE.MeshLambertMaterial({ map: hex === 'prism' ? makePrismTexture() : makeHairTexture(hex, hex.length * 31 + parseInt(hex.slice(1, 3), 16)), vertexColors: true })); }
function eyeMat(hex) { return _eyeMatCache[hex] || (_eyeMatCache[hex] = new THREE.MeshBasicMaterial({ color: lin(hex), toneMapped: false })); }

class Player {
  constructor(match, o) {
    this.m = match;
    this.team = o.team; this.role = o.role; this.isGK = o.role === 'GK'; this.isHuman = !!o.human;
    this.name = o.name; this.number = o.number;
    this.styleId = o.style; this.style = STYLES[o.style];
    this.flowId = o.flow || null;
    this.skin = o.skin || pick(SKIN_TONES);
    this.side = o.side || TEAM[this.team];
    this.lookIds = o.look || {}; // the skin ids (online games send these so every screen builds the same player)
    this.look = lookFor(o.style, this.lookIds);
    this.pos = V3(); this.vel = V3(); this.yaw = 0; this.onGround = true; this.airT = 0;
    this.mx = 0; this.mz = 0; this.sprint = false; this.faceYaw = null; this.exhausted = false;
    this.stamina = 100; this.stamDelay = 0;
    this.dodgeCharges = 2; this.dodgeRe = 0; this.iframes = 0; this.tackleProof = 0;
    this.tackleCd = 0; this.pickBlock = 0; this.protect = 0;
    this.state = 'free'; this.stateT = 0; this.stateDur = 0;
    this.kickT = -1; this.kickDur = 0.34; this.charge = 0; this.charging = false;
    this.dash = null; this.slide = null; this.dive = null; this.fallDir = 1; this.flipT = -1;
    this.abil = this.style.abilities.map((id) => ({ id, def: ABILITIES[id], cd: 0 }));
    this.flow = 0; this.flowT = 0; this.gamble = null; this.awake = 0; this.awakeT = 0;
    this.fx = {}; this.item = null; this.callT = 0;
    this.speedMul = 1;
    this.mods = { speed: 1, shot: 1, stamRegen: 1, stamDrain: 1, cdRate: 1, tackleRange: 1, tackleCd: 1 };
    this.stats = { goals: 0, assists: 0, shots: 0, onTarget: 0, tackles: 0, saves: 0, passes: 0, steals: 0 };
    this.ai = { think: rand(0, 0.3), target: V3(), wantShot: null, runT: 0, runTarget: null, offU: rand(-2, 2), offV: rand(-2, 2), offT: 0, dodgeIn: -1, abilIn: rand(1, 3), mark: null, task: 'pos' };
    this.animPhase = rand(0, 6); this.dribblePhase = 0; this.celebrateT = 0;
    this.buildModel();
  }
  get flowActive() { return this.flowT > 0; }
  get free() { return this.state === 'free'; }
  get hasBall() { return this.m.ball.owner === this; }
  get aura() { return this.style.aura; }
  buildModel() {
    const side = this.side, L = this.look;
    let kit = this.isGK ? side.keeper : side.kit;
    if (!this.isGK && (L.kitPattern || L.kitTrim)) {
      kit = Object.assign({}, kit, { pattern: L.kitPattern || kit.pattern });
      if (L.kitTrim) Object.assign(kit, { collar: L.kitTrim, cuff: L.kitTrim, number: L.kitTrim, sockTrim: L.kitTrim, shortsTrim: L.kitTrim });
    }
    this.skinTex = makePlayerSkin({
      kit, crest: side.crest, boots: L.boots || (this.team === 0 ? '#1a1a1f' : '#f4efe0'), sparkle: L.sparkle,
      skin: this.skin, hair: L.hair, hairShape: L.hairShape, number: this.number, gloves: this.isGK ? '#f2f2ea' : L.gloves, eye: pick(EYE_COLS),
      seed: this.team * 97 + this.number * 13 + 7,
    });
    this.mat = new THREE.MeshLambertMaterial({ map: this.skinTex });
    const G = PlayerGeo.get();
    const mk = (geo, mat, parent, x, y, z) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
    const root = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 0.72; root.add(body);
    mk(G.body, this.mat, body, 0, 0.36, 0);
    const headP = new THREE.Group(); headP.position.y = 0.72; body.add(headP);
    mk(G.head, this.mat, headP, 0, 0.24, 0);
    mk(hairGeo(L.hairShape), hairMat(L.prism ? 'prism' : L.hair), headP, 0, 0.48, 0);
    if (L.acc) {
      const am = this.accMat = new THREE.MeshLambertMaterial({ color: lin(L.acc.hex), vertexColors: true, emissive: lin(L.acc.hex), emissiveIntensity: L.acc.glow || 0.08 });
      if (L.acc.kind === 'band') mk(bandGeo(L.hairShape), am, headP, 0, 0, 0);
      else if (L.acc.kind === 'mask') mk(accGeo().mask, am, headP, 0, 0, 0);
    }
    const eyes = new THREE.Mesh(G.eyes, eyeMat(this.flowId && FLOWS[this.flowId] ? FLOWS[this.flowId].color : this.style.aura)); // in Flow your eyes glow in its colour eyes.position.set(0, 0.21, 0.236); eyes.visible = false; headP.add(eyes);
    const armL = new THREE.Group(); armL.position.set(0.35, 0.68, 0); body.add(armL); mk(G.arm, this.mat, armL, 0, -0.3, 0);
    const armR = new THREE.Group(); armR.position.set(-0.35, 0.68, 0); body.add(armR); mk(G.arm, this.mat, armR, 0, -0.3, 0);
    const legL = new THREE.Group(); legL.position.set(0.12, 0, 0); body.add(legL); mk(G.leg, this.mat, legL, 0, -0.36, 0);
    const legR = new THREE.Group(); legR.position.set(-0.12, 0, 0); body.add(legR); mk(G.leg, this.mat, legR, 0, -0.36, 0);
    if (L.acc && L.acc.kind === 'chain') mk(accGeo().chain, this.accMat, body, 0, 0, 0);
    this.P = { root, body, headP, armL, armR, legL, legR, eyes };
    this.blob = new THREE.Mesh(G.blob, G.blobMat);
    this.m.scene.add(root, this.blob);
  }
  dispose() {
    this.m.scene.remove(this.P.root, this.blob);
    for (const k of ['ring', 'bubble', 'ice']) if (this[k]) { this.m.scene.remove(this[k]); this[k].material.dispose(); }
    this.skinTex.dispose(); this.mat.dispose();
    if (this.accMat) this.accMat.dispose();
  }
  setState(s, dur = 0) { this.state = s; this.stateT = 0; this.stateDur = dur; }
  computeMods() {
    const m = this.mods;
    m.speed = this.speedMul; m.shot = 1; m.stamRegen = 1; m.stamDrain = 1; m.cdRate = 1; m.tackleRange = 1; m.tackleCd = 1;
    if (this.flowT > 0) {
      const f = this.flowId ? FLOWS[this.flowId] : null;
      if (!f) m.speed *= 1.08;
      else if (f.gamble) {
        const g = this.gamble || {};
        if (g.speed) m.speed *= 1.25;
        if (g.shot) m.shot *= 1.25;
        if (g.stam) { m.stamRegen *= 2.5; m.stamDrain *= 0.4; }
      } else {
        const fm = f.mods;
        if (fm.speed) m.speed *= fm.speed;
        if (fm.shot) m.shot *= fm.shot;
        if (fm.stamRegen) m.stamRegen *= fm.stamRegen;
        if (fm.stamDrain) m.stamDrain *= fm.stamDrain;
        if (fm.cdRate) m.cdRate *= fm.cdRate;
        if (fm.tackleRange) m.tackleRange *= fm.tackleRange;
        if (fm.tackleCd) m.tackleCd *= fm.tackleCd;
      }
    }
    if (this.awakeT > 0 && this.style.awaken) {
      const am = this.style.awaken.mods || {};
      m.cdRate *= 2 * (am.cdRate || 1);
      if (am.speed) m.speed *= am.speed;
      if (am.huntSpeed && this.m.ball.owner !== this) m.speed *= am.huntSpeed;
      if (am.shot) m.shot *= am.shot;
      if (am.stamDrain != null) m.stamDrain *= am.stamDrain;
      if (am.tackleRange) m.tackleRange *= am.tackleRange;
      if (am.tackleCd) m.tackleCd *= am.tackleCd;
    }
    const fx = this.fx;
    if (fx.burst > 0) m.speed *= 1.45;
    if (fx.turbo > 0) { m.speed *= 1.75; m.stamDrain = 0; }
    if (fx.shuffle > 0) m.speed *= 0.95;
    if (fx.supercharge > 0) { m.speed *= 1.5; m.stamDrain = 0; }
    if (fx.jetpack > 0) m.speed *= 1.25;
    if (fx.lockdown > 0) m.tackleRange *= 2.3;
    if (fx.slimed > 0) m.speed *= 0.55;
    if (fx.scent > 0 && !this.m.ball.owner) m.speed *= 1.2;
    if (fx.loaded > 0) m.shot *= 1.2;
  }
  tickTimers(dt) {
    this.stateT += dt;
    for (const k in this.fx) if (this.fx[k] > 0) { this.fx[k] -= dt; if (this.fx[k] <= 0) this.fx[k] = 0; }
    const cdDt = dt * this.mods.cdRate;
    for (const a of this.abil) if (a.cd > 0) a.cd = Math.max(0, a.cd - cdDt);
    if (this.tackleCd > 0) this.tackleCd = Math.max(0, this.tackleCd - dt);
    if (this.iframes > 0) this.iframes -= dt;
    if (this.tackleProof > 0) this.tackleProof -= dt;
    if (this.pickBlock > 0) this.pickBlock -= dt;
    if (this.protect > 0) this.protect -= dt;
    if (this.callT > 0) this.callT -= dt;
    if (this.dodgeCharges < 2) { this.dodgeRe += dt; if (this.dodgeRe >= 4) { this.dodgeRe = 0; this.dodgeCharges++; } }
    if (this.flowT > 0) { this.flowT -= dt; if (this.flowT <= 0) { this.flowT = 0; this.gamble = null; this.P.eyes.visible = false; } }
    if (this.awakeT > 0) {
      this.awakeT = Math.max(0, this.awakeT - dt);
      const perk = this.style.awaken && this.style.awaken.perk;
      if (perk === 'dodge') { this.dodgeCharges = 2; this.dodgeRe = 0; }
      if (perk === 'tank') this.tackleProof = Math.max(this.tackleProof, 0.2);
    }
    if (this.kickT >= 0) { this.kickT += dt / this.kickDur; if (this.kickT >= 1) this.kickT = -1; }
    if (this.flipT >= 0) { this.flipT += dt / 0.55; if (this.flipT >= 1) this.flipT = -1; }
  }
  /** movement integration; desired direction (mx,mz) is set by AI or the human controller */
  physics(dt) {
    const m = this.mods;
    let maxSpeed = 0, accel = 58, friction = 0;
    const st = this.state;
    const ownsBall = this.m.ball.owner === this;
    if (st === 'free' || st === 'hold') {
      const moving = this.mx * this.mx + this.mz * this.mz > 0.01;
      if (this.exhausted && this.stamina > 25) this.exhausted = false;
      const sprinting = this.sprint && moving && !this.exhausted && this.stamina > 0 && !this.charging;
      let base = sprinting ? SPRINT_SPEED : RUN_SPEED;
      if (this.isGK) base *= 0.96;
      if (ownsBall) base *= 0.94;
      if (this.charging) base *= 0.62;
      if (st === 'hold') base *= 0.6;
      maxSpeed = base * m.speed;
      if (sprinting && m.stamDrain > 0) {
        this.stamina -= 19 * dt * m.stamDrain; this.stamDelay = 0.7;
        if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; }
      }
    } else if (st === 'dash') {
      const d = this.dash;
      d.t += dt;
      let dx = d.dx, dz = d.dz;
      if (d.zig) { const ph = Math.sin(d.t / d.dur * Math.PI * 4); dx = d.dx + (-d.dz) * ph * 1.4; dz = d.dz + d.dx * ph * 1.4; const l = len2D(dx, dz) || 1; dx /= l; dz /= l; }
      if (d.home && d.home.state !== undefined) { const hx = d.home.pos.x - this.pos.x, hz = d.home.pos.z - this.pos.z, hl = len2D(hx, hz); if (hl > 0.1) { dx = hx / hl; dz = hz / hl; } if (hl < 1.3) d.t = d.dur; }
      this.vel.x = dx * d.speed; this.vel.z = dz * d.speed;
      this.yaw = Math.atan2(dx, dz);
      if (d.t >= d.dur) { this.dash = null; this.setState('free'); if (d.onEnd) d.onEnd(); }
    } else if (st === 'slide') {
      const s = this.slide;
      const k = Math.max(0, 1 - this.stateT / this.stateDur);
      this.vel.x = s.dx * s.speed * (0.35 + 0.65 * k); this.vel.z = s.dz * s.speed * (0.35 + 0.65 * k);
      if (this.stateT >= this.stateDur) { this.slide = null; this.setState('free'); }
    } else if (st === 'dive') {
      const d = this.dive;
      if (this.stateT < d.dur) { this.vel.x = d.vx; this.vel.z = d.vz; }
      else friction = 10;
      if (this.stateT >= d.dur + d.rest) { this.dive = null; this.setState('free'); this.pos.y = Math.max(this.pos.y, 0); }
    } else {
      friction = 12;
      if ((st === 'down' || st === 'stun' || st === 'frozen' || st === 'celebrate' || st === 'kickoff') && this.stateDur > 0 && this.stateT >= this.stateDur) this.setState('free');
    }
    if (st !== 'dash' && st !== 'slide' && !(st === 'dive' && this.stateT < (this.dive ? this.dive.dur : 0))) {
      if (friction > 0) {
        const k = Math.exp(-friction * dt); this.vel.x *= k; this.vel.z *= k;
      } else {
        const tx = this.mx * maxSpeed, tz = this.mz * maxSpeed;
        const a = (this.onGround ? accel : 16) * dt;
        let dx = tx - this.vel.x, dz = tz - this.vel.z;
        const dl = len2D(dx, dz);
        if (dl > a) { dx *= a / dl; dz *= a / dl; }
        this.vel.x += dx; this.vel.z += dz;
      }
    }
    // stamina regen
    if (this.stamDelay > 0) this.stamDelay -= dt;
    else this.stamina = Math.min(100, this.stamina + 15 * dt * m.stamRegen);
    // vertical
    if (this.fx.jetpack > 0 && this.jetThrust) { this.vel.y = Math.min(this.vel.y + 30 * dt, 6); this.onGround = false; }
    if (!this.onGround) {
      const g = this.fx.hang > 0 ? GRAV * 0.25 : GRAV;
      this.vel.y -= g * dt; this.airT += dt;
    }
    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; this.pos.z += this.vel.z * dt;
    if (this.pos.y <= 0) { if (!this.onGround && this.vel.y < -6) FX.dust(this.pos.x, this.pos.z, 4); this.pos.y = 0; this.vel.y = 0; this.onGround = true; this.airT = 0; }
    else if (this.pos.y > 0.01 && this.state !== 'dive') this.onGround = false;
    if (this.fx.jetpack > 0 && this.pos.y > 7) { this.pos.y = 7; this.vel.y = Math.min(0, this.vel.y); }
    // bounds: boards, and keep out of the goal nets
    const bx = F.BOARD_X - 0.6, bz = F.BOARD_Z - 0.6;
    if (this.pos.x > bx) { this.pos.x = bx; this.vel.x = Math.min(0, this.vel.x); } else if (this.pos.x < -bx) { this.pos.x = -bx; this.vel.x = Math.max(0, this.vel.x); }
    if (this.pos.z > bz) { this.pos.z = bz; this.vel.z = Math.min(0, this.vel.z); } else if (this.pos.z < -bz) { this.pos.z = -bz; this.vel.z = Math.max(0, this.vel.z); }
    const az = Math.abs(this.pos.z), ax = Math.abs(this.pos.x);
    if (az > F.L - 0.45 && az < F.L + F.GD + 0.6 && ax < F.GW + F.POST + 0.45 && this.pos.y < F.GH + 0.6) {
      const s = sgn(this.pos.z);
      const inside = ax < F.GW + F.POST - 0.1;
      if (inside && az < F.L + 0.4) { this.pos.z = s * (F.L - 0.45); this.vel.z = 0; }
      else if (az >= F.L + 0.4) { this.pos.x = sgn(this.pos.x) * (F.GW + F.POST + 0.45); this.vel.x = 0; }
      else { this.pos.z = s * (F.L - 0.45); }
    }
    // facing
    let fy = this.faceYaw;
    const sp = len2D(this.vel.x, this.vel.z);
    if (fy == null && sp > 0.6 && (st === 'free' || st === 'hold')) fy = Math.atan2(this.vel.x, this.vel.z);
    if (fy != null && st !== 'dash' && st !== 'slide' && st !== 'dive' && st !== 'down') this.yaw = dampAngle(this.yaw, fy, this.charging ? 22 : 14, dt);
  }
  animate(dt) {
    const P = this.P, st = this.state;
    const sp = len2D(this.vel.x, this.vel.z);
    const run = clamp(sp / 9, 0, 1.25);
    this.animPhase += dt * (3 + sp * 1.3);
    const s = Math.sin(this.animPhase);
    // targets
    let bx = run * 0.14, bz = 0, by = 0.72 + Math.abs(Math.cos(this.animPhase)) * 0.05 * run;
    let lL = s * 0.9 * run, lR = -s * 0.9 * run, aL = -s * 0.8 * run, aR = s * 0.8 * run, aLz = 0.06, aRz = -0.06;
    let hx = 0, hy = 0, lRz = 0, snapX = false;
    if (!this.onGround && st === 'free') { lL = -0.55; lR = 0.35; aL = -0.5; aR = -0.3; aLz = 0.5; aRz = -0.5; }
    if (this.charging) { lR = 0.4 + this.charge * 0.8; aLz = 0.7; aRz = -0.35; bx = -0.05 - this.charge * 0.08; }
    if (this.kickT >= 0) {
      const t = this.kickT, ks = this.kickStyle, env = Math.sin(Math.PI * clamp(t, 0, 1));
      lR = t < 0.35 ? lerp(0.2, 1.1, t / 0.35) : t < 0.7 ? lerp(1.1, -1.45, (t - 0.35) / 0.35) : lerp(-1.45, 0, (t - 0.7) / 0.3);
      lL = 0.1; aLz = 0.75; aRz = -0.5; aL = -0.3; bx = -0.1;
      if (ks === 'backheel') { lR = t < 0.4 ? lerp(0, -0.7, t / 0.4) : t < 0.7 ? lerp(-0.7, 1.4, (t - 0.4) / 0.3) : lerp(1.4, 0, (t - 0.7) / 0.3); bx = 0.12; } // heel swings back
      else if (ks === 'rabona') { lRz = 0.55 * env; bz = -0.16 * env; aLz = 1.0; } // kicking leg wraps behind the standing leg
      else if (ks === 'outside') { lRz = -0.45 * env; lR *= 0.7; } // flick with the outside of the boot
      else if (ks === 'nolook') hy = 0.95 * (this.noLookSide || 1) * env; // eyes the other way
    }
    if (this.fx.shuffle > 0) { aL = aR = -1.45; aLz = 0.05; aRz = -0.05; bz = Math.sin(this.animPhase * 0.6) * 0.24; }
    if (st === 'hold') { aL = aR = -1.15; aLz = 0.15; aRz = -0.15; }
    if (this.fx.call > 0 || this.callT > 0) { aR = -2.9; aRz = -0.2; }
    switch (st) {
      case 'slide': bx = -1.12; by = 0.36; lR = -0.45; lL = 0.2; aL = -0.4; aR = 0.6; aLz = 1.0; aRz = -1.0; break;
      case 'down': {
        const t = this.stateT, D = this.stateDur;
        const k = t < 0.18 ? t / 0.18 : t > D - 0.3 ? Math.max(0, (D - t) / 0.3) : 1;
        bx = -1.5 * k * this.fallDir; by = lerp(0.72, 0.2, k); lL = lR = 0.1 * k; aLz = 0.6 * k; aRz = -0.6 * k; aL = aR = 0; break;
      }
      case 'stun': bz = Math.sin(this.stateT * 45) * 0.07; lL = lR = 0; aL = aR = 0.15; break;
      case 'frozen': break;
      case 'dive': {
        const d = this.dive; const k = Math.min(1, this.stateT / 0.12);
        bz = -d.side * 1.3 * k; by = 0.72 + (d.high ? 0.7 : 0.35) * k * (this.stateT < d.dur ? 1 : Math.max(0, 1 - (this.stateT - d.dur) / 0.25));
        aL = aR = 0; aLz = 2.9; aRz = -2.9; lL = 0.2; lR = -0.2; break;
      }
      case 'dash': bx = 0.32; aL = 0.7; aR = 0.7; lL = s * 1.1; lR = -s * 1.1; break;
      case 'windup': bx = 0.5; by = 0.6; aL = 0.9; aR = 0.9; aLz = 0.4; aRz = -0.4; lL = -0.5; lR = 0.4; break;
      case 'celebrate': {
        const t = this.stateT, c = this.look.celeb;
        lL = lR = 0; bx = 0; aL = aR = 0;
        if (c === 'plane') { aLz = 1.55; aRz = -1.55; bz = Math.sin(t * 3.2) * 0.38; bx = 0.18; lL = Math.sin(t * 9) * 0.5; lR = -lL; by = 0.72 + Math.abs(Math.cos(t * 9)) * 0.05; }
        else if (c === 'shush') { aR = -2.55; aRz = 0.35; aL = 0.1; aLz = 0.35; hx = -0.08 + Math.sin(t * 2.2) * 0.06; bz = Math.sin(t * 1.6) * 0.05; }
        else if (c === 'robot') {
          const q = Math.floor(t * 3.2) % 4, st4 = [[-1.5, 0, 0.3], [0, -1.5, -0.3], [-1.5, -1.5, 0.3], [0, 0, -0.3]][q];
          aL = st4[0]; aR = st4[1]; aLz = 0.1; aRz = -0.1; bz = st4[2] * 0.25; hx = q % 2 ? 0.15 : -0.1;
        } else if (c === 'knees') {
          const k = Math.min(1, t / 0.25);
          by = 0.72 - 0.42 * k; bx = -0.42 * k; lL = lR = 1.25 * k; aLz = 2.2 + Math.sin(t * 6) * 0.15; aRz = -2.2 - Math.sin(t * 6) * 0.15; aL = aR = 0.3; hx = -0.35 * k;
        } else if (c === 'flip') {
          const ph = (t % 1.3) / 1.3, f = clamp((ph - 0.12) / 0.5, 0, 1);
          snapX = true;
          by = 0.72 + Math.sin(Math.PI * f) * 1.0; bx = -TAU * smooth(f); lL = -1.1 * Math.sin(Math.PI * f); lR = 0.3; aLz = 2.4; aRz = -2.4;
        } else if (c === 'trophy') {
          const lift = Math.abs(Math.sin(t * 3.2));
          aL = aR = -2.6 - lift * 0.4; aLz = 0.22; aRz = -0.22; by = 0.72 + lift * 0.12; hx = -0.35;
        } else if (c === 'meteor') {
          const ph = (t % 1.7) / 1.7, up = ph < 0.55 ? Math.sin(ph / 0.55 * Math.PI / 2) : ph < 0.7 ? 1 : Math.max(0, 1 - (ph - 0.7) / 0.1);
          by = 0.72 + up * 2.4; aLz = 2.7; aRz = -2.7; lL = -0.4 * up; lR = 0.4 * up;
          if (ph > 0.8 && ph < 0.9) bx = 0.25;
          const k = Math.floor(t / 1.7);
          if (ph >= 0.8 && this._meteor !== k) { this._meteor = k; FX.ring(this.pos.x, 0.2, this.pos.z, this.aura, 1.6, 26); FX.sparks(this.pos.x, 0.4, this.pos.z, this.aura, 18, 7); Shake.add(this.isHuman ? 0.25 : 0); }
        } else { const j = Math.abs(Math.sin(t * 9)); by = 0.72 + j * 0.25; aLz = 2.6 + Math.sin(t * 14) * 0.3; aRz = -2.6 - Math.sin(t * 14) * 0.3; }
        break;
      }
    }
    if (this.flipT >= 0) { bx = -this.flipT * TAU; lL = -1.2; lR = 0.3; }
    const k = st === 'frozen' ? 0 : 1 - Math.exp(-22 * dt);
    const r = (o, prop, v) => { o.rotation[prop] += (v - o.rotation[prop]) * k; };
    r(P.body, 'x', bx); r(P.body, 'z', bz);
    if (snapX) P.body.rotation.x = bx; // full flips are set directly, easing would unwind them P.body.position.y += (by - P.body.position.y) * k;
    r(P.legL, 'x', lL); r(P.legR, 'x', lR); r(P.legR, 'z', lRz); r(P.headP, 'y', hy);
    r(P.armL, 'x', aL); r(P.armR, 'x', aR); r(P.armL, 'z', aLz); r(P.armR, 'z', aRz);
    r(P.headP, 'x', hx);
    P.root.position.copy(this.pos);
    P.root.rotation.y = this.yaw;
    const bs = clamp(1 - this.pos.y / 5, 0.3, 1) * (st === 'down' ? 1.6 : st === 'dive' ? 1.5 : 1);
    this.blob.position.set(this.pos.x, 0.025, this.pos.z); this.blob.scale.set(bs, 1, bs);
    P.eyes.visible = this.flowT > 0 || this.awakeT > 0;
    // awakened eyes glow in your style's colour, in Flow they glow in the Flow's
    const eyeHex = this.awakeT > 0 ? this.style.aura : this.flowId && FLOWS[this.flowId] ? FLOWS[this.flowId].color : this.style.aura;
    if (P.eyes.userData.hex !== eyeHex) { P.eyes.userData.hex = eyeHex; P.eyes.material = eyeMat(eyeHex); }
    // status meshes
    const viper = this.flowT > 0 && this.flowId === 'VIPER';
    if (this.fx.lockdown > 0 || viper) {
      if (!this.ring) { this.ring = new THREE.Mesh(PlayerGeo.get().ring, new THREE.MeshBasicMaterial({ color: lin('#ff3d52'), transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false })); this.m.scene.add(this.ring); }
      const rc = this.fx.lockdown > 0 ? '#ff3d52' : FLOWS.VIPER.color; // lockdown red, VIPER green
      if (this.ring.userData.c !== rc) { this.ring.userData.c = rc; this.ring.material.color.copy(lin(rc)); }
      this.ring.visible = true; this.ring.position.set(this.pos.x, 0.03, this.pos.z); const rs = 1.4 * this.mods.tackleRange * 0.9; this.ring.scale.set(rs, 1, rs); this.ring.rotation.y += dt * 2;
    } else if (this.ring) this.ring.visible = false;
    if (this.fx.bubble > 0) {
      if (!this.bubble) { this.bubble = new THREE.Mesh(PlayerGeo.get().cube, new THREE.MeshBasicMaterial({ color: lin('#8fd8ff'), transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })); this.m.scene.add(this.bubble); }
      this.bubble.visible = true; this.bubble.position.set(this.pos.x, this.pos.y + 1.0, this.pos.z); this.bubble.scale.set(1.5, 2.3, 1.5); this.bubble.rotation.y = this.yaw;
    } else if (this.bubble) this.bubble.visible = false;
    if (st === 'frozen') {
      if (!this.ice) { this.ice = new THREE.Mesh(PlayerGeo.get().cube, new THREE.MeshLambertMaterial({ map: World.T.ice, transparent: true, opacity: 0.62 })); this.m.scene.add(this.ice); }
      this.ice.visible = true; this.ice.position.set(this.pos.x, this.pos.y + 1.0, this.pos.z); this.ice.scale.set(1.2, 2.2, 1.2); this.ice.rotation.y = this.yaw;
    } else if (this.ice) this.ice.visible = false;
  }
}
