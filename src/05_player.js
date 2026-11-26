/* =====================================================================
   Players: blocky humanoid model, procedural animation, movement
   ===================================================================== */
// the two sides of the current match (club, kit, keeper kit, UI colour); Match sets them with matchSides()
const TEAM = [null, null];
const SKIN_TONES = ['#f1c7a0', '#e0ac85', '#c48b62', '#9a6643', '#6e4a32', '#f6d6b8', '#b07a52', '#4e3424']; // you pick yours in the Locker (Save.data.tone)
const EYE_COLS = ['#2b1d14', '#1d2b4a', '#2a3a1c', '#3a2a14'];
const RUN_SPEED = 7.6, SPRINT_SPEED = 11.4; // 10% up with the 35 x 55 pitch, so it never feels empty
// stamina: sprinting drains it (about 5s of full sprint), it comes back after a short wait (faster standing still), and running
// out leaves you out of breath: no sprint until it is back to STAM_BACK, and you jog a little slower until then
const STAM_DRAIN = 20, STAM_REGEN = 11, STAM_WAIT = 1.0, STAM_BACK = 35, OUT_OF_BREATH = 0.85;

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
  afro: [[-0.33, -0.12, -0.33, 0.33, 0.28, 0.33]],
  undercut: [[-0.255, -0.02, -0.255, 0.255, 0.04, 0.255], [-0.2, 0.04, -0.22, 0.2, 0.17, 0.27], [-0.16, 0.12, 0.2, 0.16, 0.19, 0.32]],
  ponytail: [[-0.26, -0.05, -0.26, 0.26, 0.09, 0.26], [-0.08, -0.36, -0.36, 0.08, 0.04, -0.24], [-0.1, -0.02, -0.33, 0.1, 0.08, -0.24]],
  mohawk: [[-0.25, -0.03, -0.25, 0.25, 0.02, 0.25], [-0.06, 0.0, -0.29, 0.06, 0.14, 0.25], [-0.05, 0.14, 0.1, 0.05, 0.25, 0.21], [-0.05, 0.14, -0.07, 0.05, 0.31, 0.05], [-0.05, 0.14, -0.25, 0.05, 0.24, -0.12]],
  fade: [[-0.252, -0.01, -0.252, 0.252, 0.025, 0.252], [-0.2, 0.025, -0.16, 0.2, 0.05, 0.24]], // very short on top
  topknot: [[-0.255, -0.02, -0.255, 0.255, 0.05, 0.255], [-0.09, 0.05, -0.12, 0.09, 0.2, 0.06], [-0.06, 0.2, -0.09, 0.06, 0.26, 0.03]],
  curtains: [[-0.27, -0.06, -0.27, 0.27, 0.12, 0.27], [-0.27, -0.2, 0.18, -0.03, 0.04, 0.3], [0.03, -0.2, 0.18, 0.27, 0.04, 0.3], [-0.27, -0.28, -0.3, 0.27, 0.0, -0.18]], // parted in the middle
  braids: [[-0.26, -0.05, -0.26, 0.26, 0.09, 0.26], [-0.2, -0.62, -0.3, -0.1, 0.0, -0.2], [0.1, -0.62, -0.3, 0.2, 0.0, -0.2], [-0.22, -0.68, -0.31, -0.08, -0.6, -0.19], [0.08, -0.68, -0.31, 0.22, -0.6, -0.19]],
  twintails: [[-0.26, -0.05, -0.26, 0.26, 0.1, 0.26], [-0.4, -0.52, -0.1, -0.26, -0.02, 0.06], [0.26, -0.52, -0.1, 0.4, -0.02, 0.06], [-0.27, -0.14, 0.18, 0.27, 0.0, 0.28]],
  wolf: [[-0.27, -0.06, -0.27, 0.27, 0.12, 0.27], [-0.27, -0.36, -0.33, 0.27, 0.0, -0.18], [-0.22, -0.48, -0.34, -0.06, -0.3, -0.22], [0.06, -0.48, -0.34, 0.22, -0.3, -0.22], [-0.3, -0.3, -0.2, -0.2, 0.0, 0.12], [0.2, -0.3, -0.2, 0.3, 0.0, 0.12], [-0.12, 0.12, -0.2, 0.12, 0.2, 0.04]],
  dreads: [[-0.27, -0.05, -0.27, 0.27, 0.1, 0.27], [-0.27, -0.55, -0.3, -0.17, 0.0, -0.2], [-0.06, -0.6, -0.3, 0.06, 0.0, -0.2], [0.17, -0.55, -0.3, 0.27, 0.0, -0.2], [-0.3, -0.45, -0.12, -0.22, 0.0, -0.02], [0.22, -0.45, -0.12, 0.3, 0.0, -0.02], [-0.3, -0.38, 0.08, -0.22, 0.0, 0.16], [0.22, -0.38, 0.08, 0.3, 0.0, 0.16]],
  blaze: [[-0.26, -0.06, -0.26, 0.26, 0.1, 0.26], [-0.18, 0.1, -0.14, -0.04, 0.36, 0.0], [0.04, 0.1, -0.12, 0.18, 0.42, 0.02], [-0.07, 0.1, 0.06, 0.07, 0.32, 0.2], [-0.24, 0.1, 0.0, -0.12, 0.26, 0.14], [0.12, 0.1, -0.24, 0.24, 0.3, -0.1], [-0.26, -0.24, -0.29, 0.26, 0.0, -0.18], [-0.27, -0.12, 0.2, 0.27, 0.02, 0.3]], // tall spikes up, like a flame
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
  // shades: two lenses on a bar across the eyes, with arms back to the ears
  const shades = new VoxBuilder();
  shades.box(-0.23, 0.17, 0.25, -0.02, 0.26, 0.285, '#ffffff', { ao: 0.9 }); shades.box(0.02, 0.17, 0.25, 0.23, 0.26, 0.285, '#ffffff', { ao: 0.9 });
  shades.box(-0.24, 0.24, 0.25, 0.24, 0.27, 0.29, '#9a9fb0', { ao: 1 });
  for (const s of [1, -1]) shades.box(s > 0 ? 0.25 : -0.265, 0.22, 0.0, s > 0 ? 0.265 : -0.25, 0.25, 0.27, '#9a9fb0', { ao: 1 });
  return (_accGeo = { mask: mask.geometry(), chain: chain.geometry(), shades: shades.geometry() });
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
const STEP_V = new THREE.Vector3(); // where the stepping foot is during a step-over (its white trail)

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
    this.look.skin = this.skin; // portraits and cut-ins show your skin colour too
    this.pos = V3(); this.vel = V3(); this.yaw = 0; this.onGround = true; this.airT = 0;
    this.mx = 0; this.mz = 0; this.sprint = false; this.faceYaw = null; this.exhausted = false;
    this.stamina = 100; this.stamDelay = 0;
    this.dodgeCharges = 1; this.dodgeRe = 0; this.feint = 0; this.iframes = 0; this.tackleProof = 0;
    this.slowRe = 0; this.cTapAt = -9;
    this.tackleCd = 0; this.pickBlock = 0; this.protect = 0;
    this.state = 'free'; this.stateT = 0; this.stateDur = 0;
    this.kickT = -1; this.kickDur = 0.34; this.charge = 0; this.charging = false;
    this.dash = null; this.slide = null; this.dive = null; this.fallDir = 1; this.flipT = -1;
    this.abil = this.style.abilities.map((id) => ({ id, def: ABILITIES[id], cd: 0 }));
    this.flow = 0; this.flowT = 0; this.gamble = null; this.awake = 0; this.awakeT = 0;
    this.fx = {}; this.item = null; this.corePow = null; this.callT = 0; // corePow: an OMEGA CORES power to use (CORE_POWERS index)
    this.speedMul = 1; this.fit = 1; // fit: sprint drain (bots: fitter with skill)
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
  /** the painted skin: kit (the keeper's own kit and gloves), number, face, hair, boots */
  paintSkin() {
    const side = this.side, L = this.look;
    let kit = this.isGK ? side.keeper : side.kit;
    // a keeper keeps the keeper's colours (so the sides stay readable) but wears your kit pattern, trim and gloves too
    // (owner, Nov 2026: a keeper preset's look did not show in goal: the pattern and the GLOVES skin were dropped)
    if (L.kitPattern || L.kitTrim) {
      kit = Object.assign({}, kit, { pattern: L.kitPattern || kit.pattern });
      if (L.kitTrim) Object.assign(kit, { collar: L.kitTrim, cuff: L.kitTrim, number: L.kitTrim, sockTrim: L.kitTrim, shortsTrim: L.kitTrim });
    }
    this.eyeCol = this.eyeCol || pick(EYE_COLS);
    return makePlayerSkin({
      kit, crest: side.crest, boots: L.boots || (this.team === 0 ? '#1a1a1f' : '#f4efe0'), sparkle: L.sparkle,
      skin: this.skin, hair: L.hair, hairShape: L.hairShape, face: L.face, number: this.number, gloves: this.isGK ? L.gloves || '#f2f2ea' : L.gloves, eye: this.eyeCol,
      seed: this.team * 97 + this.number * 13 + 7,
    });
  }
  /** paint again after a change of job (the intro's position picker: whoever goes in goal wears the keeper's kit) */
  repaint() {
    const old = this.skinTex;
    this.skinTex = this.paintSkin(); this.mat.map = this.skinTex; this.mat.needsUpdate = true;
    if (old) old.dispose();
  }
  buildModel() {
    const L = this.look;
    this.skinTex = this.paintSkin();
    this.mat = new THREE.MeshLambertMaterial({ map: this.skinTex });
    const G = PlayerGeo.get();
    const mk = (geo, mat, parent, x, y, z) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
    const root = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 0.72; root.add(body);
    mk(G.body, this.mat, body, 0, 0.36, 0);
    const headP = new THREE.Group(); headP.position.y = 0.72; body.add(headP);
    mk(G.head, this.mat, headP, 0, 0.24, 0);
    this.hairMesh = mk(hairGeo(L.hairShape), hairMat(L.prism ? 'prism' : L.hair), headP, 0, 0.48, 0);
    if (L.acc) {
      const am = this.accMat = new THREE.MeshLambertMaterial({ color: lin(L.acc.hex), vertexColors: true, emissive: lin(L.acc.hex), emissiveIntensity: L.acc.glow || 0.08 });
      if (L.acc.kind === 'band') mk(bandGeo(L.hairShape), am, headP, 0, 0, 0);
      else if (L.acc.kind === 'mask') mk(accGeo().mask, am, headP, 0, 0, 0);
      else if (L.acc.kind === 'shades') mk(accGeo().shades, am, headP, 0, 0, 0);
    }
    const eyes = new THREE.Mesh(G.eyes, eyeMat(this.flowId && FLOWS[this.flowId] ? FLOWS[this.flowId].color : this.style.aura)); // in Flow your eyes glow in its colour
    eyes.position.set(0, 0.21, 0.236); eyes.visible = false; headP.add(eyes);
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
    for (const k of ['ring', 'bubble', 'ice', 'ownRing', 'slowRing']) if (this[k]) { this.m.scene.remove(this[k]); this[k].material.dispose(); }
    this.skinTex.dispose(); this.mat.dispose();
    if (this.hairGlowMat) this.hairGlowMat.dispose();
    if (this.accMat) this.accMat.dispose();
  }
  setState(s, dur = 0) { this.state = s; this.stateT = 0; this.stateDur = dur; }
  /** LAWLESS: a blocky toy blaster in the right hand while you hold a gun item (barrel along the arm, past the hand) */
  showGun(on) {
    if (!on && !this.gunMesh) return;
    if (!this.gunMesh && this.P) {
      const M = Player.gunMats || (Player.gunMats = { dark: new THREE.MeshLambertMaterial({ color: lin('#2a2f45') }), light: new THREE.MeshLambertMaterial({ color: lin('#9aa1ad') }), glow: new THREE.MeshBasicMaterial({ color: lin('#ffe14d'), toneMapped: false }) });
      const g = new THREE.Group(), box = (m, sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(PlayerGeo.get().cube, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); g.add(b); };
      box(M.dark, 0.15, 0.5, 0.17, 0, -0.8, 0.02); box(M.light, 0.16, 0.36, 0.06, 0, -0.8, 0.1); box(M.dark, 0.1, 0.12, 0.22, 0, -0.62, -0.14); box(M.glow, 0.1, 0.06, 0.1, 0, -1.07, 0.02);
      this.P.armR.add(g); this.gunMesh = g;
    }
    if (this.gunMesh) this.gunMesh.visible = on;
  }
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
      m.speed *= 1.06; m.shot *= 1.1; // owner: "make the awakenings better": every Awakening is a real power-up on top of its own
      if (am.speed) m.speed *= am.speed;
      if (am.huntSpeed && this.m.ball.owner !== this) m.speed *= am.huntSpeed;
      if (am.shot) m.shot *= am.shot;
      if (am.stamDrain != null) m.stamDrain *= am.stamDrain;
      if (am.tackleRange) m.tackleRange *= am.tackleRange;
      if (am.tackleCd) m.tackleCd *= am.tackleCd;
    }
    const fx = this.fx;
    if (fx.burst > 0) m.speed *= 1.45;
    if (fx.turbo > 0) m.speed *= 1.3;
    if (fx.shuffle > 0) m.speed *= 0.95;
    if (fx.supercharge > 0) { m.speed *= 1.5; m.stamDrain = 0; }
    if (fx.jetpack > 0) m.speed *= 1.25;
    if (fx.lockdown > 0) m.tackleRange *= 2.3;
    if (fx.slimed > 0) m.speed *= 0.55;
    if (fx.slowed > 0) m.speed *= SLOWMO_SLOW; // inside someone's SLOW-MO
    if (fx.tempo > 0) m.speed *= 1.25; // MAESTRO's TEMPO
    if (fx.loaded > 0) m.speed *= 1.25; // THUNDER's LOADED
    if (fx.wind > 0) m.stamDrain *= 0.5; // SECOND WIND
    if (fx.hunt > 0 && this.m.ball.owner !== this) { m.speed *= 1.2; m.stamDrain = 0; } // BLITZ's HUNT
    if (fx.scent > 0 && !this.m.ball.owner) m.speed *= 1.2;
    if (fx.loaded > 0) m.shot *= 1.2;
    if (fx.giant > 0) { m.speed *= 1.2; m.shot *= 1.3; } // the GIANT core
    if (this.isHuman && this.m.adm && this.m.adm.shot) m.shot *= 1.8; // the owner's admin panel: MEGA SHOT
    const tw = this.m.twist ? this.m.twist() : null; if (tw && tw.shot) m.shot *= tw.shot; // CHAOS: ROCKET SHOTS
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
    if (this.slowRe > 0) this.slowRe = Math.max(0, this.slowRe - dt);
    if (this.dodgeCharges < 1) {
      const quick = this.awakeT > 0 && this.style.awaken && this.style.awaken.perk === 'dodge' ? 3 : 1; // NIGHTFALL and SHOWTIME
      this.dodgeRe += dt * quick; if (this.dodgeRe >= FEINT_CD) { this.dodgeRe = 0; this.dodgeCharges = 1; }
    }
    if (this.flowT > 0) { this.flowT -= dt; if (this.flowT <= 0) { this.flowT = 0; this.gamble = null; this.P.eyes.visible = false; } }
    if (this.awakeT > 0) {
      this.awakeT = Math.max(0, this.awakeT - dt);
      const perk = this.style.awaken && this.style.awaken.perk;
      if (perk === 'tank') this.tackleProof = Math.max(this.tackleProof, 0.2);
    }
    if (this.fx.giant > 0) this.tackleProof = Math.max(this.tackleProof, 0.2); // nobody can tackle a GIANT
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
      if (this.exhausted && this.stamina >= STAM_BACK) this.exhausted = false;
      const sprinting = this.sprint && moving && !this.exhausted && this.stamina > 0 && !this.charging;
      let base = sprinting ? SPRINT_SPEED : RUN_SPEED;
      if (this.isGK) base *= 0.96;
      if (this.exhausted) base *= OUT_OF_BREATH;
      if (ownsBall) base *= 0.94;
      if (this.charging) base *= lerp(0.5, 0.25, clamp(this.charge, 0, 1)); // winding up a shot: the bigger the shot, the more you plant your feet
      if (st === 'hold') base *= 0.6;
      maxSpeed = this.setPiece || this.fkHold || this.inWall ? 0 : base * m.speed; // a throw-in, corner or free kick taker stands still
      if (sprinting && m.stamDrain > 0) {
        this.stamina -= STAM_DRAIN * dt * m.stamDrain * this.fit; this.stamDelay = STAM_WAIT;
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
      if (d.ram) this.m.ramHits(this);
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
      if ((st === 'down' || st === 'stun' || st === 'frozen' || st === 'celebrate' || st === 'kickoff' || st === 'awaken' || st === 'emote') && this.stateDur > 0 && this.stateT >= this.stateDur) this.setState('free');
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
    else this.stamina = Math.min(100, this.stamina + STAM_REGEN * dt * m.stamRegen * (this.mx * this.mx + this.mz * this.mz < 0.01 ? 1.6 : 1)); // catch your breath standing still
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
      const side = F.GW + F.POST + 0.45 - ax, back = F.L + F.GD + 0.6 - az; // how far into the goal from the side and from behind
      if (inside && az < F.L + 0.4) { this.pos.z = s * (F.L - 0.45); this.vel.z = 0; }
      else if (az >= F.L + 0.4 && back < side) { this.pos.z = s * (F.L + F.GD + 0.6); if (this.vel.z * s < 0) this.vel.z = 0; } // behind the goal: the back of the net stops you (no jump to the side)
      else if (az >= F.L + 0.4) { this.pos.x = sgn(this.pos.x) * (F.GW + F.POST + 0.45); this.vel.x = 0; }
      else { this.pos.z = s * (F.L - 0.45); }
    }
    // facing
    let fy = this.faceYaw;
    const sp = len2D(this.vel.x, this.vel.z);
    if (fy == null && sp > 0.6 && (st === 'free' || st === 'hold')) fy = Math.atan2(this.vel.x, this.vel.z);
    if (fy != null && st !== 'dash' && st !== 'slide' && st !== 'dive' && st !== 'down') this.yaw = dampAngle(this.yaw, fy, this.charging ? 22 : this.shiftTurn ? 8 : 14, dt); // shift lock: a smoother turn after the camera
  }
  animate(dt) {
    if (this.fx.slowed > 0) dt *= SLOWMO_SLOW; // caught in someone's SLOW-MO: arms and legs move in slow motion too
    const P = this.P, st = this.state;
    const sp = len2D(this.vel.x, this.vel.z);
    const run = clamp(sp / 9, 0, 1.25);
    this.animPhase += dt * (3 + sp * 1.3);
    const s = Math.sin(this.animPhase);
    // targets
    let bx = run * 0.14, bz = 0, by = 0.72 + Math.abs(Math.cos(this.animPhase)) * 0.05 * run;
    let lL = s * 0.9 * run, lR = -s * 0.9 * run, aL = -s * 0.8 * run, aR = s * 0.8 * run, aLz = 0.06, aRz = -0.06;
    let hx = 0, hy = 0, lRz = 0, lLz = 0, snapX = false, spinY = 0, ease = 22; // ease: how fast joints reach their targets (quick moves need more)
    if (!this.onGround && st === 'free') { lL = -0.55; lR = 0.35; aL = -0.5; aR = -0.3; aLz = 0.5; aRz = -0.5; }
    if (this.charging) { // winding up: the kicking leg draws back, arms open for balance, body leans back and coils
      const c = this.charge; lR = 0.4 + c * 1.15; lL = -0.12 * c; aLz = 0.7 + 0.45 * c; aRz = -0.35 - 0.35 * c; aL = -0.35 * c; aR = 0.4 * c; bx = -0.05 - c * 0.14; bz = -0.1 * c;
    }
    if (this.kickT >= 0 && this.kickStyle !== 'throw') {
      const t = this.kickT, ks = this.kickStyle, env = Math.sin(Math.PI * clamp(t, 0, 1));
      lR = t < 0.35 ? lerp(0.2, 1.1, t / 0.35) : t < 0.7 ? lerp(1.1, -1.45, (t - 0.35) / 0.35) : lerp(-1.45, 0, (t - 0.7) / 0.3);
      lL = 0.1; aLz = 0.75; aRz = -0.5; aL = -0.3; bx = -0.1;
      if (ks === 'backheel') { lR = t < 0.4 ? lerp(0, -0.7, t / 0.4) : t < 0.7 ? lerp(-0.7, 1.4, (t - 0.4) / 0.3) : lerp(1.4, 0, (t - 0.7) / 0.3); bx = 0.12; } // heel swings back
      else if (ks === 'rabona') { lRz = 0.55 * env; bz = -0.16 * env; aLz = 1.0; } // kicking leg wraps behind the standing leg
      else if (ks === 'outside') { lRz = -0.45 * env; lR *= 0.7; } // flick with the outside of the boot
      else if (ks === 'nolook') hy = 0.95 * (this.noLookSide || 1) * env; // eyes the other way
      else if (ks === 'strike') { // plant, whip the leg through and follow through high; big shots lift you off your toes
        const k = clamp(this.kickPow == null ? 0.7 : this.kickPow, 0, 1.4);
        lR = t < 0.22 ? lerp(1.3, 1.5, t / 0.22) : t < 0.5 ? lerp(1.5, -1.6 - 0.5 * k, (t - 0.22) / 0.28) : lerp(-1.6 - 0.5 * k, 0, (t - 0.5) / 0.5);
        lL = t < 0.5 ? 0.15 : lerp(0.15, 0, (t - 0.5) / 0.5);
        bx = t < 0.22 ? -0.16 : t < 0.5 ? lerp(-0.16, 0.24, (t - 0.22) / 0.28) : lerp(0.24, 0, (t - 0.5) / 0.5);
        by = 0.72 + (t > 0.3 && t < 0.75 ? 0.12 * k * Math.sin(Math.PI * (t - 0.3) / 0.45) : 0);
        aL = t < 0.5 ? -0.5 : lerp(-0.5, 0, (t - 0.5) / 0.5); aR = t < 0.5 ? 0.6 : lerp(0.6, 0, (t - 0.5) / 0.5); aLz = 1.0; aRz = -0.75; bz = 0.12 * env;
      }
    }
    if (this.setPiece && this.setPiece.type === 'throw') { aL = aR = -2.85; aLz = 0.12; aRz = -0.12; lL = lR = 0; } // ball held over the head
    if (this.kickT >= 0 && this.kickStyle === 'throw') { const t = clamp(this.kickT, 0, 1); aL = aR = lerp(-2.85, -0.5, t); aLz = 0.12; aRz = -0.12; lR = 0.1; lL = -0.1; lRz = 0; bx = 0.12 * Math.sin(Math.PI * t); }
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
        aL = aR = 0; aLz = 2.9; aRz = -2.9; lL = 0.2; lR = -0.2;
        if (d.fwd) { bz = 0; bx = 1.3 * k; aL = aR = -2.9; aLz = 0.25; aRz = -0.25; } // a forward dive: flat out, arms reaching ahead
        break;
      }
      case 'awaken': { // the transformation (owner, Nov 2026: an animation you can see): crouch and gather with the arms crossed,
        // burst up with a full spin, arms flung wide and head thrown back, hang there, then land in a wide power stance
        const u = clamp(this.stateT / (this.stateDur || 1), 0, 1);
        const a = smooth(clamp(u / 0.26, 0, 1)), b = smooth(clamp((u - 0.26) / 0.34, 0, 1)), c = clamp((u - 0.6) / 0.4, 0, 1);
        const hang = u < 0.6 ? b : 1 - c * c;
        by = 0.72 - 0.12 * a * (1 - b) + 1.15 * hang - (c > 0.82 ? 0.14 * Math.sin(Math.PI * (c - 0.82) / 0.18) : 0);
        if (u < 0.26) { bx = 0.38 * a; aL = aR = -1.25 * a; aLz = 0.06 - 0.45 * a; aRz = -0.06 + 0.45 * a; hx = 0.5 * a; lL = lR = -0.3 * a; lLz = 0.3 * a; lRz = -0.3 * a; }
        else if (u < 0.6) {
          bx = lerp(0.38, -0.32, b); aL = aR = lerp(-1.25, -0.25, b); aLz = lerp(-0.39, 2.35, b); aRz = lerp(0.39, -2.35, b);
          hx = lerp(0.5, -0.6, b); lL = lerp(-0.3, 0.18, b); lR = lerp(-0.3, -0.12, b); lLz = 0.3 * (1 - b); lRz = -0.3 * (1 - b); spinY = TAU * b;
        } else {
          const s2 = smooth(c);
          bx = lerp(-0.32, 0.12, s2); aL = aR = lerp(-0.25, 0.3, s2); aLz = lerp(2.35, 0.6, s2); aRz = lerp(-2.35, -0.6, s2);
          hx = lerp(-0.6, -0.05, s2); lL = lerp(0.18, 0.05, s2); lR = lerp(-0.12, 0.05, s2); lLz = 0.28 * s2; lRz = -0.28 * s2;
        }
        ease = 30;
        if (u < 0.1) this._awFx = 0; // light at the top of the jump, a shockwave on landing
        if (this._awFx === 0 && u >= 0.6) { this._awFx = 1; FX.ring(this.pos.x, this.pos.y + 1.9, this.pos.z, this.aura, 1.4, 26); FX.sparks(this.pos.x, this.pos.y + 1.9, this.pos.z, '#ffffff', 22, 6, 0.12, 0.5); }
        if (this._awFx === 1 && c >= 0.9) { this._awFx = 2; FX.ring(this.pos.x, 0.15, this.pos.z, this.aura, 3.2, 40); FX.dust(this.pos.x, this.pos.z, 10); Shake.add(this.isHuman ? 0.3 : 0.05); }
        break;
      }
      case 'dash':
        if (this.feint) { // a step-over (owner, Nov 2026: one you can see): the leg on the fake side lifts and circles round the front
          // of the ball from inside to outside while the body dips, leans and looks that way; then you push off the way you cut (sd)
          const u = this.dash ? clamp(this.dash.t / this.dash.dur, 0, 1) : 1, sd = this.feint;
          const t1 = clamp(u / 0.62, 0, 1), t2 = clamp((u - 0.62) / 0.38, 0, 1);
          const loop = Math.sin(Math.PI * t1), sell = u < 0.62 ? Math.sin(Math.PI * 0.5 * t1) : 1 - smooth(t2), go = Math.sin(Math.PI * t2);
          const lift = -0.95 * loop + 0.2 * go;
          const sweep = sd * (u < 0.62 ? lerp(0.4, -0.85, smooth(t1)) : lerp(-0.85, 0, smooth(t2)));
          if (sd > 0) { lR = lift; lRz = sweep; lL = 0.18 - 0.3 * go; } else { lL = lift; lLz = sweep; lR = 0.18 - 0.3 * go; }
          bx = 0.12 + 0.08 * loop; bz = 0.42 * sd * sell - 0.3 * sd * go; by = 0.72 - 0.07 * loop - 0.04 * go;
          hy = -0.5 * sd * sell + 0.35 * sd * go;
          const out = 0.75 + 0.6 * sell; // the arm on the fake side flies out for balance
          if (sd > 0) { aRz = -out; aLz = 0.55; } else { aLz = out; aRz = -0.55; }
          aL = 0.1 - (sd > 0 ? 0.35 * go : 0); aR = 0.1 - (sd < 0 ? 0.35 * go : 0);
          ease = 46;
          if (u < 0.62) { // a short white trail behind the stepping foot
            const v = (sd > 0 ? P.legR : P.legL).localToWorld(STEP_V.set(0, -0.7, 0));
            FX.glow.spawn(v.x, v.y, v.z, 0, 0, 0, 0.09, 0.22, col('#ffffff'), 0, 0, 0);
          }
        } else { bx = 0.32; aL = 0.7; aR = 0.7; lL = s * 1.1; lR = -s * 1.1; }
        break;
      case 'windup': bx = 0.5; by = 0.6; aL = 0.9; aR = 0.9; aLz = 0.4; aRz = -0.4; lL = -0.5; lR = 0.4; break;
      case 'celebrate': case 'emote': {
        const t = this.stateT, c = st === 'emote' ? this.emote : this.look.celeb;
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
        } else if (c === 'wave') { aR = -2.75 + Math.sin(t * 11) * 0.2; aRz = -0.25 + Math.sin(t * 11) * 0.35; aLz = 0.1; hx = -0.1;
        } else if (c === 'clap') { const cl = Math.abs(Math.sin(t * 9)); aL = aR = -1.35; aLz = 0.15 + cl * 0.45; aRz = -aLz; by = 0.72 + cl * 0.02;
        } else if (c === 'flex') { aL = aR = -1.55; aLz = 1.45 + Math.sin(t * 5) * 0.08; aRz = -aLz; by = 0.72 - 0.04 * Math.abs(Math.sin(t * 5)); hx = 0.06;
        } else if (c === 'point') { aR = -3.0; aRz = -0.15; aL = 0.2; aLz = 0.3; hx = -0.4;
        } else if (c === 'salute') { aR = -2.2; aRz = 1.15; aL = 0; aLz = 0.05; hx = -0.05; by = 0.72 + Math.min(1, t / 0.2) * 0.03;
        } else if (c === 'bow') { const k = Math.min(1, t / 0.5) * (0.75 + 0.25 * Math.cos(t * 2)); bx = 0.85 * k; aR = -0.4 * k; aRz = 0.5 * k; aL = 0.6 * k; aLz = 0.6 * k; hx = 0.2 * k;
        } else if (c === 'drums') { const a = Math.sin(t * 16), b2 = Math.sin(t * 16 + Math.PI); aL = -1.2 + a * 0.45; aR = -1.2 + b2 * 0.45; aLz = 0.3; aRz = -0.3; hx = 0.15 + Math.abs(Math.sin(t * 8)) * 0.15; lL = Math.max(0, Math.sin(t * 8)) * -0.3;
        } else if (c === 'pump') { const u = Math.max(0, Math.sin(t * 7)); aR = -1.6 - u * 1.3; aRz = -0.1; aL = 0.2; aLz = 0.35; by = 0.72 + u * 0.08; hx = -0.15 * u;
        } else if (c === 'chill') { const k = Math.min(1, t / 0.35); by = 0.72 - 0.5 * k; bx = -0.3 * k; lL = lR = -1.45 * k; aL = aR = 0.9 * k; aLz = 0.3 * k; aRz = -0.3 * k; hx = -0.15 * k + Math.sin(t * 1.5) * 0.04;
        } else if (c === 'spin') { spinY = t * 9; aLz = 1.45; aRz = -1.45; by = 0.72 + Math.abs(Math.sin(t * 9)) * 0.06; hx = -0.15; lL = Math.sin(t * 9) * 0.25;
        } else if (c === 'dance') { const d = Math.sin(t * 8); bz = d * 0.16; aL = -2.4 + Math.max(0, d) * 0.5; aR = -2.4 + Math.max(0, -d) * 0.5; aLz = 0.5; aRz = -0.5; lL = Math.max(0, d) * -0.45; lR = Math.max(0, -d) * -0.45; by = 0.72 - Math.abs(d) * 0.05; hy = d * 0.3;
        } else if (c === 'heart') {
          aL = aR = -2.85; aLz = -0.32; aRz = 0.32; bz = Math.sin(t * 2.2) * 0.06; hx = -0.2; by = 0.72 + Math.abs(Math.sin(t * 4)) * 0.02; // hands meet over the head
          const k = Math.floor(t / 0.55);
          if (this._heart !== k) { this._heart = k; FX.sparks(this.pos.x, this.pos.y + 2.9, this.pos.z, '#ff4d6d', 8, 2.2, 0.2, 0.9); }
        } else if (c === 'fireworks') {
          const u = Math.abs(Math.sin(t * 4)); aL = aR = -2.8 + u * 0.25; aLz = 0.35; aRz = -0.35; by = 0.72 + u * 0.06; hx = -0.3;
          const k = Math.floor(t / 0.6);
          if (this._fw !== k) { this._fw = k; const hex = ['#ff4d5e', '#ffd54a', '#4aa8ff', '#7dff6a', '#ff5fb0'][k % 5]; FX.sparks(this.pos.x + rand(-1.5, 1.5), 4.5 + rand(0, 1.5), this.pos.z + rand(-1.5, 1.5), hex, 22, 5, 0.18, 0.8); }
        } else if (c === 'claim') { // OMEGA CORES: catch the core overhead, bring it down, lock it into the band on the left forearm, show it off
          if (t < 0.5) { const k = Math.min(1, t / 0.18); aR = -2.95 * k; aRz = 0.12; aL = 0.15; aLz = 0.2; hx = -0.4 * k; by = 0.72 + 0.06 * k; }
          else if (t < 0.95) { aR = -1.0; aRz = 0.7; aL = -1.05; aLz = -0.45; hx = 0.3; bx = 0.1; }
          else if (t < 1.2) { aR = -1.2; aRz = 0.6; aL = -1.35; aLz = -0.35; bx = 0.16; hx = 0.3; by = 0.69; }
          else { const k = Math.min(1, (t - 1.2) / 0.2); aL = -1.35 - 1.5 * k; aLz = -0.35 + 0.5 * k; aR = 0.25; aRz = -0.2; bx = -0.12 * k; hx = -0.25 * k; by = 0.72 + Math.sin(t * 5) * 0.015; }
        } else if (c === 'snap') { // the OMEGA SNAP: the arm with the band goes up with every core round the hand, one snap, and it stays up
          ease = 40; aR = 0.15; aRz = -0.25;
          if (t < SNAP_T - 0.14) { const k = Math.min(1, t / 0.3), q = t / SNAP_T; aL = -3.0 * k; aLz = -0.05; bx = -0.08 * k; hx = -0.35 * k; bz = Math.sin(t * 40) * 0.02 * q; by = 0.72 + 0.03 * k; }
          else if (t < SNAP_T) { aL = -2.7; aLz = -0.1; bx = -0.06; hx = -0.3; by = 0.75; } // the hand draws back a little
          else if (t < SNAP_T + 1.1) { const j = Math.max(0, 1 - (t - SNAP_T) / 0.12); aL = -3.05 - 0.15 * j; aLz = -0.05; bx = -0.1; hx = -0.4 + 0.1 * j; bz = 0.05 * j; by = 0.75; } // snap
          else { const k = Math.min(1, (t - SNAP_T - 1.1) / 0.9), e = k * k * (3 - 2 * k); aL = lerp(-3.05, 0.1, e); aLz = lerp(-0.05, 0.12, e); bx = lerp(-0.1, -0.04, e); hx = lerp(-0.4, -0.12, e); by = 0.74; } // the arm comes down slowly, standing tall
        } else if (c === 'sad') { // lost at full time: down on the knees, head down
          const k = Math.min(1, t / 0.5); by = 0.72 - 0.42 * k + Math.sin(t * 2) * 0.01; bx = 0.32 * k; lL = lR = 1.2 * k; aL = aR = 0.25 * k; aLz = 0.12; aRz = -0.12; hx = 0.5 * k;
        } else if (c === 'talk') { // STORY scenes (Movie): talking with the hands
          const g = Math.sin(t * 4.2), h2 = Math.sin(t * 2.7 + 1);
          aR = -0.5 - 0.4 * Math.max(0, g); aRz = -0.22 - 0.16 * h2; aL = -0.18 - 0.25 * Math.max(0, -g); aLz = 0.24; hx = -0.04 + Math.sin(t * 5.3) * 0.05; hy = Math.sin(t * 1.3) * 0.12; bz = Math.sin(t * 1.7) * 0.03;
        } else if (c === 'laugh') { const j = Math.abs(Math.sin(t * 13)); aL = aR = 0.3; aLz = 0.78; aRz = -0.78; hx = -0.38 - 0.08 * j; bx = -0.12 - 0.04 * j; by = 0.72 + j * 0.03; // hands on hips, head back
        } else if (c === 'fold') { aL = -1.3; aLz = -0.5; aR = -1.4; aRz = 0.55; hx = -0.1; lLz = 0.12; lRz = -0.12; // arms folded
        } else if (c === 'shrug') { const k = Math.min(1, t / 0.25); aL = aR = -0.6 * k; aLz = 0.9 * k; aRz = -0.9 * k; hx = 0.1; hy = 0.15 * Math.sin(t * 2); by = 0.72 + 0.03 * k;
        } else if (c === 'give') { aL = aR = -1.45; aLz = 0.12; aRz = -0.12; bx = 0.12; hx = 0.15; // both hands held out
        } else if (c === 'five') { const k = Math.min(1, t / 0.2); aR = -2.6 * k; aRz = -0.05; aL = 0.1; aLz = 0.3; bx = 0.1 * k; hx = -0.2 * k; // a high five
        } else if (c === 'aim') { aR = -1.55; aRz = -0.05; aL = 0.15; aLz = 0.3; hx = -0.05; bz = -0.04; // pointing straight ahead
        } else if (c === 'shock') { const k = Math.min(1, t / 0.15); aL = aR = -2.3 * k; aLz = -0.55 * k; aRz = 0.55 * k; bx = -0.2 * k; hx = -0.25 * k; by = 0.72 + 0.05 * k; // hands to the head
        } else if (c === 'listen') { aR = -1.9; aRz = 1.25; aL = 0.2; aLz = 0.3; hy = -0.35; hx = -0.15; bz = 0.08; // a hand to the ear: the crowd
        } else if (c === 'stance') { by = 0.66; bx = 0.12; aL = aR = -0.3; aLz = 0.5; aRz = -0.5; lLz = 0.25; lRz = -0.25; hx = -0.1; // ready
        } else { const j = Math.abs(Math.sin(t * 9)); by = 0.72 + j * 0.25; aLz = 2.6 + Math.sin(t * 14) * 0.3; aRz = -2.6 - Math.sin(t * 14) * 0.3; }
        break;
      }
    }
    if (this.flipT >= 0) { bx = -this.flipT * TAU; lL = -1.2; lR = 0.3; }
    const gun = !!(this.item === 'blaster' || this.item === 'scatter' || this.gun); // LAWLESS: holding a blaster
    if (gun && st === 'free' && !this.charging && this.kickT < 0) { aR = -1.45; aRz = 0.04; } // held up, ready to fire
    this.showGun(gun && P.root.visible);
    const k = st === 'frozen' ? 0 : 1 - Math.exp(-ease * dt);
    const r = (o, prop, v) => { o.rotation[prop] += (v - o.rotation[prop]) * k; };
    r(P.body, 'x', bx); r(P.body, 'z', bz);
    if (snapX) P.body.rotation.x = bx; // full flips are set directly, easing would unwind them
    P.body.position.y += (by - P.body.position.y) * k;
    r(P.legL, 'x', lL); r(P.legR, 'x', lR); r(P.legR, 'z', lRz); r(P.legL, 'z', lLz); r(P.headP, 'y', hy);
    r(P.armL, 'x', aL); r(P.armR, 'x', aR); r(P.armL, 'z', aLz); r(P.armR, 'z', aRz);
    r(P.headP, 'x', hx);
    P.root.position.copy(this.pos);
    P.root.rotation.y = this.yaw + spinY; // SPIN celebration turns you round
    const gs = this.fx.giant > 0 || this.fx.big > 0 ? GIANT_SIZE : 1, s0 = P.root.scale.x; // the GIANT core (and CHAOS GIANTS): grow, and shrink back after
    if (s0 !== gs) P.root.scale.setScalar(Math.abs(gs - s0) < 0.01 ? gs : s0 + (gs - s0) * Math.min(1, dt * 7));
    const bs = clamp(1 - this.pos.y / 5, 0.3, 1) * (st === 'down' ? 1.6 : st === 'dive' ? 1.5 : 1) * P.root.scale.x;
    this.blob.position.set(this.pos.x, 0.025, this.pos.z); this.blob.scale.set(bs, 1, bs);
    P.eyes.visible = this.flowT > 0 || this.awakeT > 0;
    // awakened, your hair glows in your style's colour
    if (this.hairMesh) {
      const glow = this.awakeT > 0;
      if (glow && !this.hairGlowMat) { this.hairBaseMat = this.hairMesh.material; this.hairGlowMat = this.hairBaseMat.clone(); this.hairGlowMat.emissive = lin(this.style.aura); this.hairGlowMat.emissiveIntensity = 0.7; }
      const want = glow ? this.hairGlowMat : this.hairBaseMat || this.hairMesh.material;
      if (want && this.hairMesh.material !== want) this.hairMesh.material = want;
    }
    // awakened eyes glow in your style's colour, in Flow they glow in the Flow's
    const eyeHex = this.awakeT > 0 ? this.style.aura : this.flowId && FLOWS[this.flowId] ? FLOWS[this.flowId].color : this.style.aura;
    if (P.eyes.userData.hex !== eyeHex) { P.eyes.userData.hex = eyeHex; P.eyes.material = eyeMat(eyeHex); }
    // status meshes
    // you have the ball: a bright ring round your feet, so you always know
    if (this.isHuman) {
      const has = this.m.ball.owner === this;
      if (has && !this.ownRing) { this.ownRing = new THREE.Mesh(PlayerGeo.get().ring, new THREE.MeshBasicMaterial({ color: lin('#ffe9a8'), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })); this.m.scene.add(this.ownRing); }
      if (this.ownRing) { this.ownRing.visible = has; if (has) { const k = 0.95 + Math.sin(this.animPhase * 0.5) * 0.06; this.ownRing.position.set(this.pos.x, 0.035, this.pos.z); this.ownRing.scale.set(k, 1, k); } }
    }
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
    if (this.fx.giant > 0 && !(this.fx.big > 0) && P.root.visible) { // a GIANT leaves a white shimmer (not CHAOS GIANTS: everyone at once)
      this.giantT = (this.giantT || 0) - dt;
      if (this.giantT <= 0) { this.giantT = 0.07; FX.trail(this.pos.x + rand(-0.4, 0.4), this.pos.y + rand(0.6, 2.6), this.pos.z + rand(-0.4, 0.4), '#ffffff', 0.5, 0.35); }
    }
    // SLOW-MO: a blue ring under everyone caught in it, and the player who used it leaves a ghost trail
    if (this.fx.slowed > 0) {
      if (!this.slowRing) { this.slowRing = new THREE.Mesh(PlayerGeo.get().ring, new THREE.MeshBasicMaterial({ color: lin('#9fb4ff'), transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false })); this.m.scene.add(this.slowRing); }
      this.slowRing.visible = true; this.slowRing.position.set(this.pos.x, 0.04, this.pos.z); this.slowRing.scale.set(1.15, 1, 1.15); this.slowRing.rotation.y -= dt * 2;
    } else if (this.slowRing) this.slowRing.visible = false;
    if (this.fx.slowmo > 0 && this.P.root.visible) {
      this.slowTrail = (this.slowTrail || 0) - dt;
      if (this.slowTrail <= 0) { this.slowTrail = 0.03; FX.trail(this.pos.x, this.pos.y + 1.0, this.pos.z, '#9fb4ff', 0.42, 0.45); FX.trail(this.pos.x, this.pos.y + 0.35, this.pos.z, '#ffffff', 0.2, 0.3); }
    }
    if (st === 'frozen') {
      if (!this.ice) { this.ice = new THREE.Mesh(PlayerGeo.get().cube, new THREE.MeshLambertMaterial({ map: World.T.ice, transparent: true, opacity: 0.62 })); this.m.scene.add(this.ice); }
      this.ice.visible = true; this.ice.position.set(this.pos.x, this.pos.y + 1.0, this.pos.z); this.ice.scale.set(1.2, 2.2, 1.2); this.ice.rotation.y = this.yaw;
    } else if (this.ice) this.ice.visible = false;
  }
}
