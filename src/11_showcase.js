/* =====================================================================
   Showcase: your player on a lit spot in the stadium for the start
   screen and the Locker. Juggles a ball (or plays a goal celebration)
   and turns toward the mouse, or spins when you drag it in the Locker.
   The page decides where the player goes: the camera fits the player
   into the box of the current "stage" element (#lob-stage, #lk-fit).
   ===================================================================== */
const SHOW_FOV = 34, SHOW_H = 2.55, SHOW_MID = 1.08, SHOW_CAM_Y = 1.2, SHOW_YAW = Math.PI + 0.3, SHOW_G = 13;
const SHOW_FACE = -0.55; // the player stands turned a little toward the menu, so the ball never hides the face
const SHOW_FACE_LOCKER = -0.2;
const SHOW_BALL = 0.65, SHOW_DROP = BALL_R * (1 - SHOW_BALL); // the ball on the start screen is smaller than the match ball
// each touch: [body part, ball height, reach in front, side, how high it pops above the next touch]
const JUGGLE = [
  ['R', 0.55, 0.5, -0.12, 0.7], ['L', 0.55, 0.5, 0.12, 0.65], ['R', 0.55, 0.5, -0.12, 0.75], ['K', 0.86, 0.62, -0.12, 0.45],
  ['L', 0.55, 0.5, 0.12, 0.7], ['R', 0.55, 0.5, -0.12, 1.95], ['H', 2.32, 0.1, 0, 0.55], ['L', 0.55, 0.5, 0.12, 0.75],
];

/* each character's own pose (owner, Nov 2026: "make each character have its own poses"): the Locker, the spin reveal,
   and on the start screen your player stops juggling now and then to strike it. Angles: arms x below 0 lift forward and
   up, arms z out to the side (left +, right -), legs x below 0 forward, body x above 0 leans forward, head x below 0
   looks up. ball: [forward, side (right is -), height] in the player's frame, or the default spot at the feet */
const SHOW_POSE_HOLD = 3.4, SHOW_POSE_EVERY = 2; // on the start screen: hold it this long, every this many juggling rounds
const POSE_REST = { by: 0.72, bx: 0.02, bz: 0, aL: 0, aLz: 0.12, aR: 0, aRz: -0.12, lL: 0, lLz: 0.04, lR: 0, lRz: -0.06, hx: 0.04, hy: 0, ball: null };
const POSES = {
  ROOKIE: (t) => ({ aL: 0.3, aLz: 0.6, aR: 0.3, aRz: -0.6, lR: -0.3, hy: 0.1, hx: 0.02 + Math.sin(t * 0.8) * 0.03, ball: [0.3, -0.12] }), // hands on hips, a foot on the ball
  SPRINTER: (t) => ({ by: 0.6, bx: 0.45 + Math.sin(t * 3) * 0.02, lL: -0.65, lR: 0.75, aL: 0.9, aLz: 0.15, aR: -1.0, aRz: -0.15, hx: -0.35, ball: [0.62, 0.12] }), // on the blocks, ready to go
  PHANTOM: (t) => ({ aL: -1.3, aLz: -0.5, aR: -1.4, aRz: 0.55, hx: 0.28, bz: Math.sin(t * 0.9) * 0.04, hy: -0.18, lLz: 0.1, lRz: -0.02, ball: [0.25, 0.45] }), // arms folded, head down, a shadow
  TRICKSTER: (t) => ({ lR: -1.05 + Math.sin(t * 4) * 0.05, aL: -0.2, aLz: 1.0 + Math.sin(t * 3) * 0.1, aR: 0.2, aRz: -0.7, bz: Math.sin(t * 3) * 0.04, hx: 0.35, ball: [0.62, -0.14, 0.62 + Math.abs(Math.sin(t * 4)) * 0.05] }), // the ball balanced on a raised foot
  ENFORCER: () => ({ aL: -1.3, aLz: -0.5, aR: -1.4, aRz: 0.55, hx: -0.18, lLz: 0.2, lRz: -0.2, bx: -0.04, ball: [0.38, -0.32] }), // arms folded, chin up, feet wide
  SHAMBLER: (t) => ({ by: 0.7, aL: -1.45 + Math.sin(t * 1.3) * 0.08, aLz: 0.05, aR: -1.3 + Math.sin(t * 1.3 + 1) * 0.1, aRz: -0.05, bz: 0.12 + Math.sin(t * 0.8) * 0.05, bx: 0.12, hx: 0.15, hy: 0.25, lL: 0.15, lR: -0.1 }), // arms out like the undead
  PROWLER: (t) => ({ by: 0.56, bx: 0.38, aL: -0.35, aLz: 0.4, aR: -0.35, aRz: -0.4, lL: -0.45, lR: 0.35, hx: -0.4, hy: Math.sin(t * 0.7) * 0.25, ball: [0.72, 0] }), // low, hunting
  MAGNET: (t) => ({ aR: -2.3, aRz: -0.15, aL: 0.1, aLz: 0.3, hx: -0.5, hy: -0.1, ball: [0.45, -0.3, 2.15 + Math.sin(t * 2.4) * 0.08] }), // the ball floats over his hand
  THUNDER: () => ({ lR: 0.85, lL: -0.1, aL: -0.3, aLz: 1.1, aR: 0.5, aRz: -0.6, bx: -0.12, bz: -0.06, hx: 0.15, ball: [0.5, -0.05] }), // the leg cocked back for a bomb
  WARDEN: () => ({ by: 0.66, bx: 0.08, aL: -0.15, aLz: 1.45, aR: -0.15, aRz: -1.45, lLz: 0.22, lRz: -0.22, hx: -0.05, ball: [0.48, 0] }), // a wall: arms wide
  MAESTRO: (t) => ({ aR: -1.9 + Math.sin(t * 2.2) * 0.25, aRz: -0.25 + Math.sin(t * 1.1) * 0.2, aL: -0.5, aLz: 0.45, hx: -0.12, hy: -0.15, bz: Math.sin(t * 1.1) * 0.03, lR: -0.3, ball: [0.3, -0.12] }), // conducting the game
  BLITZ: (t) => ({ lL: Math.sin(t * 9) * 0.6, lR: -Math.sin(t * 9) * 0.6, aL: -Math.sin(t * 9) * 0.8, aR: Math.sin(t * 9) * 0.8, aLz: 0.15, aRz: -0.15, bx: 0.18, by: 0.72 + Math.abs(Math.sin(t * 9)) * 0.05, hx: -0.15, ball: [0.62, 0.38] }), // never stops running
  COMET: (t) => ({ by: 0.98 + Math.sin(t * 2) * 0.06, lL: -1.0, lR: 0.35, aL: -0.2, aLz: 1.2, aR: -3.0, aRz: -0.1, hx: -0.45, ball: [0.25, -0.3, 2.95 + Math.sin(t * 2 + 1) * 0.1] }), // floating, a hand to the sky and the ball above it
  RAILGUN: () => ({ aR: -1.57, aRz: 0.05, aL: -1.45, aLz: -0.3, hx: 0.02, hy: 0.12, bx: 0.05, lL: -0.2, lR: 0.15, ball: [0.3, 0.32] }), // taking aim
  KESTREL: (t) => ({ lL: Math.sin(t * 6) * 0.35, lR: -Math.sin(t * 6) * 0.35, aL: -Math.sin(t * 6) * 0.4, aR: Math.sin(t * 6) * 0.4, aLz: 0.18, aRz: -0.18, by: 0.72 + Math.abs(Math.sin(t * 6)) * 0.03, hy: Math.sin(t * 0.6) * 0.4, ball: [0.4, -0.42] }), // jogging, looking for the pass
  ANCHOR: (t) => ({ by: 0.42, bx: 0.1, lL: -1.35, lR: -1.25, aL: -0.95, aLz: 0.2, aR: -0.95, aRz: -0.2, hx: 0.05 + Math.sin(t * 0.6) * 0.04, ball: [-0.05, 0, 0.2] }), // sitting on the ball, never tired
  FEATHER: (t) => ({ lR: 0.95, aL: -0.2, aLz: 1.25, aR: -0.2, aRz: -1.25, bx: 0.35, hx: -0.25, by: 0.72 + Math.sin(t * 1.6) * 0.02, bz: Math.sin(t * 1.2) * 0.03, ball: [0.55, 0.28] }), // balanced on one leg
  CAPTAIN: () => ({ aR: -1.62, aRz: -0.08, aL: -1.0, aLz: -0.65, bx: -0.08, hx: -0.12, hy: 0.1, lL: -0.15, ball: [0.38, 0.32] }), // a hand on the heart, pointing the way
  GLACIER: (t) => ({ aL: 0.6, aLz: -0.25, aR: 0.6, aRz: 0.25, bx: -0.04, bz: 0.04, hx: 0.08, hy: Math.sin(t * 0.5) * 0.3, ball: [0.42, -0.36] }), // hands behind the back, ice cool
  SPARK: (t) => ({ aL: -1.25 - Math.max(0, Math.sin(t * 7)) * 0.4, aLz: 0.3, aR: -1.25 - Math.max(0, -Math.sin(t * 7)) * 0.4, aRz: -0.3, by: 0.72 + Math.abs(Math.sin(t * 8)) * 0.045, lL: -0.15, lR: 0.15, hx: 0.1, ball: [0.42, 0.42] }), // fists up, bouncing
  TITAN: (t) => ({ by: 0.68, bx: -0.1, aL: -0.35, aLz: 2.35 + Math.sin(t * 3) * 0.06, aR: -0.35, aRz: -2.35 - Math.sin(t * 3) * 0.06, lLz: 0.24, lRz: -0.24, hx: -0.3, ball: [0.48, 0.28] }), // a roar: both arms up, feet wide
  FORTRESS: (t) => ({ by: 0.6, bx: 0.28, aL: -0.95, aLz: 0.85, aR: -0.95, aRz: -0.85, lL: -0.2, lLz: 0.25, lR: -0.2, lRz: -0.25, hx: -0.3 + Math.sin(t * 1.4) * 0.03, ball: [0.62, -0.42] }), // a keeper's set position, gloves up
  VORTEX: (t) => ({ lR: -0.45, aL: -1.0 + Math.sin(t * 4) * 0.6, aLz: 0.9, aR: -1.0 - Math.sin(t * 4) * 0.6, aRz: -0.9, bz: Math.sin(t * 2) * 0.12, hy: Math.sin(t * 2) * 0.3, hx: -0.05, ball: [0.45, 0.3] }), // mid-spin, arms swirling
  NOVA: (t) => ({ by: 0.95 + Math.sin(t * 2.4) * 0.05, aL: -0.3, aLz: 2.0, aR: -0.3, aRz: -2.0, lLz: 0.45, lRz: -0.45, hx: -0.4, ball: [0.3, 0, 2.9 + Math.sin(t * 2.4 + 1) * 0.08] }), // a star jump in the air
  SENTINEL: (t) => ({ aR: -2.6, aRz: 0.9, aL: 0.3, aLz: 0.2, hy: Math.sin(t * 0.6) * 0.5, hx: -0.05, lLz: 0.12, lRz: -0.12, ball: [0.4, -0.35] }), // a hand over the eyes, scanning the pitch
  JESTER: (t) => ({ bx: 0.6 + Math.sin(t * 1.6) * 0.1, aR: -0.6, aRz: 0.8, aL: 0.8, aLz: 0.9, hx: 0.25, lR: 0.3, ball: [0.5, 0.35] }), // taking a bow
  TEMPEST: (t) => ({ by: 0.8 + Math.sin(t * 1.8) * 0.04, aL: -2.8, aLz: 0.5, aR: -2.8, aRz: -0.5, hx: -0.5, bz: Math.sin(t * 1.1) * 0.04, ball: [0.42, -0.36] }), // arms up, calling the storm
  ZENITH: (t) => ({ aL: -2.2, aLz: -0.2, aR: 0.5, aRz: -0.9, lL: -0.35, bz: -0.08, hx: -0.15, hy: -0.35 + Math.sin(t * 1.2) * 0.05, ball: [0.5, 0.15] }), // one arm across the sky, looking away: alone at the top
  BASTION: () => ({ aL: -0.9, aLz: 0.2, aR: -0.9, aRz: -0.2, lLz: 0.3, lRz: -0.3, by: 0.68, bx: 0.15, hx: 0.12, ball: [0.42, 0.45] }), // both arms forward like a shield, low and wide
  AEGIS: (t) => ({ aL: -2.4, aLz: 0.9, aR: -2.4, aRz: -0.9, by: 0.72 + Math.sin(t * 1.6) * 0.02, hx: -0.2, lL: 0.1, lR: -0.1, ball: [0.3, -0.4] }), // gloves up wide: the whole goal is covered
  ROGUE: (t) => ({ by: 0.62, bx: 0.32, aL: -1.7, aLz: 0.3, aR: 0.7, aRz: -0.5, lL: -0.5, lR: 0.55, hx: -0.25, hy: 0.3 + Math.sin(t * 2) * 0.05, ball: [0.45, 0.5] }), // low and ready to dart off, an arm out in front
  IRONCLAD: () => ({ by: 0.66, aL: 0.25, aLz: 1.0, aR: 0.25, aRz: -1.0, lLz: 0.38, lRz: -0.38, hx: 0.2, ball: [0.5, -0.45] }), // fists out at the sides, the widest stance there is
  SOLARIS: (t) => ({ aR: -3.0, aRz: 0.15, aL: -0.7, aLz: 1.1, bx: -0.22, hx: -0.5, lR: 0.35, lL: -0.15, by: 0.74 + Math.sin(t * 1.4) * 0.02, ball: [0.36, -0.2] }), // leaning back, a fist to the sky: the champion
  ACE: (t) => ({ aR: -1.5, aRz: 0.25, aL: 0.3, aLz: 0.6, bz: 0.06, hx: 0.02 + Math.sin(t * 0.9) * 0.03, hy: 0.15, lR: -0.25, ball: [0.3, -0.12] }), // a hand on the hip, pointing right at you
  LYNX: (t) => ({ by: 0.5, bx: 0.55, aL: -1.0, aLz: 0.25, aR: -0.85, aRz: -0.25, lL: -0.55, lR: 0.6, hx: -0.55, bz: Math.sin(t * 2.5) * 0.05, hy: Math.sin(t * 1.3) * 0.2, ball: [0.78, 0.2] }), // crouched to pounce
};
/** a style's pose at time t, every joint filled in */
function poseFor(styleId, t) { return Object.assign({}, POSE_REST, (POSES[styleId] || POSES.ROOKIE)(t)); }

const Showcase = {
  p: null, key: '', hidePlayer: false, on: false, t: 0, turn: SHOW_FACE, turnTo: SHOW_FACE, drag: null, dragX: 0, rect: null, stageId: 'lob-stage', mode: 'lobby', spec: null, j: { i: 0, t: 0 }, sparkT: 0, css: '', loops: 0, pz: { on: false, t: 0, w: 0 },
  init() {
    const T = World.T;
    const g = this.group = new THREE.Group();
    this.glowMat = new THREE.MeshBasicMaterial({ map: T.glow, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), this.glowMat);
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03;
    this.ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    this.ring = new THREE.Mesh(PlayerGeo.get().ring, this.ringMat);
    this.ring.position.y = 0.012; this.ring.scale.set(1.2, 1, 1.2);
    // a square beam of light from high above, brightest just over the grass
    const beamTex = Tex.pixels(1, 16, (x, y) => [255, 255, 255, Math.round(255 * (y < 15 ? 0.6 * Math.pow(y / 14, 3) : 0.2))]);
    this.beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.35, 14, 4, 1, true), this.beamMat);
    beam.rotation.y = Math.PI / 4; beam.position.y = 7;
    if (!BALL_GEO) BALL_GEO = makeBallGeometry();
    this.ball = new THREE.Mesh(BALL_GEO, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.ball.castShadow = true; this.ball.scale.setScalar(SHOW_BALL);
    g.add(glow, this.ring, beam, this.ball);
    g.visible = false;
    World.scene.add(g);
    // the player looks toward the mouse, or toward a finger dragged on the stage
    // in the Locker a drag spins the player all the way round instead
    window.addEventListener('pointermove', (e) => {
      if (!this.on) return;
      if (this.mode === 'locker') { if (e.pointerId === this.drag) { this.turnTo += (e.clientX - this.dragX) * 0.012; this.dragX = e.clientX; } return; }
      if (e.pointerType === 'mouse' || e.pointerId === this.drag) this.point(e.clientX);
    });
    window.addEventListener('pointerdown', (e) => {
      if (!this.on || (e.pointerType === 'mouse' && this.mode !== 'locker')) return;
      const st = $(this.stageId);
      if (st && e.target && st.contains(e.target)) { this.drag = e.pointerId; this.dragX = e.clientX; if (this.mode !== 'locker') this.point(e.clientX); }
    });
    const lift = (e) => { if (e.pointerId === this.drag) { this.drag = null; if (this.mode !== 'locker') this.turnTo = SHOW_FACE; } };
    window.addEventListener('pointerup', lift);
    window.addEventListener('pointercancel', lift);
    document.addEventListener('mouseleave', () => { if (this.drag == null && this.mode !== 'locker') this.turnTo = SHOW_FACE; });
  },
  point(x) {
    const cx = this.rect ? this.rect.cx : window.innerWidth / 2;
    this.turnTo = SHOW_FACE + clamp((x - cx) / (window.innerWidth || 1) * 1.7, -0.5, 0.8);
  },
  /** which box the player stands in: 'lobby' follows the mouse, 'locker' spins on drag */
  setStage(id, mode) {
    if (this.stageId === id && this.mode === mode) return;
    this.stageId = id; this.mode = mode; this.rect = null; this.drag = null;
    this.turn = this.turnTo = mode === 'lobby' ? SHOW_FACE : SHOW_FACE_LOCKER;
    if (mode === 'lobby') this.spec = null;
  },
  /** try on a look before equipping it: { style, flow, look, celebrate }. null goes back to what is equipped */
  preview(spec) { this.spec = spec; this.ensure(); },
  /** (re)build the model when the style, Flow or skins changed */
  ensure() {
    if (!this.group) return;
    const d = Save.data, sp = this.spec || {};
    const style = sp.style || d.style, flow = sp.flow !== undefined ? sp.flow : d.flow, look = Object.assign({}, d.look, sp.look || {});
    const club = sp.club || d.club;
    const tone = sp.tone != null ? sp.tone : Save.data.tone;
    const pos = sp.pos !== undefined ? sp.pos : d.pos, gk = pos === 'GK' || (!pos && !!(STYLES[style] && STYLES[style].gk)); // in goal like Game.startMatch: keeper kit, number 1
    const num = sp.number || (gk ? 1 : d.capNum || 10); // MY CLUB: each character's own number
    const key = [style, flow || '', club, tone, SKIN_SLOTS.map((s) => look[s.id]).join(','), gk ? 'GK' : '', num].join('|');
    if (this.p && this.key === key) return;
    if (this.p) this.p.dispose();
    this.key = key; this.flow = flow;
    applyBallLook(look); // the Locker tries balls on too
    this.p = new Player({ scene: World.scene, ball: { owner: null } }, { team: 0, role: gk ? 'GK' : 'ST', human: true, style, flow, look, side: sideFor(club), number: num, name: 'YOU', skin: SKIN_TONES[tone] || SKIN_TONES[1] });
    const aura = col(this.p.aura);
    this.ringMat.color.copy(aura); this.glowMat.color.copy(aura); this.beamMat.color.copy(col('#fff1d6')).lerp(aura, 0.35);
    this.p.P.root.visible = this.p.blob.visible = this.on;
  },
  show() {
    this.ensure();
    this.on = true; this.group.visible = true;
    this.p.P.root.visible = this.p.blob.visible = true;
    this.rect = null;
  },
  hide() {
    if (!this.on) return;
    this.on = false; this.group.visible = false; this.drag = null; this.hidePlayer = false; this.turn = this.turnTo = SHOW_FACE;
    if (this.p) this.p.P.root.visible = this.p.blob.visible = false;
    World.camera.clearViewOffset();
    World.resize();
  },
  segment(a, b) {
    const apex = Math.max(a[1], b[1]) + a[4];
    const up = Math.sqrt(2 * (apex - a[1]) / SHOW_G), down = Math.sqrt(2 * (apex - b[1]) / SHOW_G);
    return { dur: up + down, v0: SHOW_G * up };
  },
  update(dt) {
    if (!this.on || !this.p) return;
    this.t += dt;
    if (this.spec && this.spec.celebrate) this.celebrate(dt); else if (this.mode !== 'lobby') this.idle(dt); else this.animate(dt);
    this.p.P.root.visible = this.p.blob.visible = !this.hidePlayer; // the spin hides you until the block cracks
    this.ball.visible = this.mode !== 'reveal';
    if (this.flow && !this.hidePlayer && FLOWS[this.flow]) FX.flow(this.p, this.flow, dt * 0.6);
    this.frame();
  },
  /** put the joints (and the ball) where a pose says, turned to `yaw` */
  applyPose(q, yaw) {
    const p = this.p, P = p.P;
    P.root.position.set(0, 0, 0); P.root.rotation.y = yaw;
    P.body.position.y = q.by; P.body.rotation.set(q.bx, 0, q.bz);
    P.legL.rotation.set(q.lL, 0, q.lLz); P.legR.rotation.set(q.lR, 0, q.lRz);
    P.armL.rotation.set(q.aL, 0, q.aLz); P.armR.rotation.set(q.aR, 0, q.aRz);
    P.headP.rotation.set(q.hx, q.hy, 0);
    P.eyes.visible = !!this.flow;
    p.blob.position.set(0, 0.025, 0); p.blob.scale.set(1, 1, 1);
  },
  /** where a pose puts the ball, in the world */
  poseBall(q, yaw, out) {
    const b = q.ball || [0.34, -0.44], fwd = b[0], side = b[1], y = b[2] != null ? b[2] : BALL_R * SHOW_BALL;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    return out.set(sy * fwd + cy * side, y, cy * fwd - sy * side);
  },
  /** Locker and spin reveal: the character's own pose (owner: "each character its own poses"), turned by a drag */
  idle(dt) {
    const p = this.p;
    if (p.state !== 'free') p.setState('free');
    this.turn = damp(this.turn, this.turnTo, 6, dt);
    const yaw = SHOW_YAW + this.turn, q = poseFor(p.styleId, this.t), b = Math.sin(this.t * 2.1);
    q.by += b * 0.012; q.hy -= this.turn * 0.25;
    this.applyPose(q, yaw);
    this.poseBall(q, yaw, this.ball.position);
  },
  /** loop the goal celebration in place, with the ball resting on the grass */
  celebrate(dt) {
    const p = this.p;
    if (p.state !== 'celebrate') { p.setState('celebrate', 0); p._meteor = -1; }
    p.stateT += dt;
    if (p.stateT > 6.8) { p.stateT = 0; p._meteor = -1; }
    p.pos.set(0, 0, 0); p.vel.set(0, 0, 0); p.onGround = true;
    this.turn = damp(this.turn, this.turnTo, 5, dt);
    p.yaw = SHOW_YAW + this.turn;
    p.animate(dt);
    p.P.eyes.visible = !!this.flow;
    this.ball.position.set(Math.sin(p.yaw + 1.2) * 0.9, BALL_R * SHOW_BALL, Math.cos(p.yaw + 1.2) * 0.9);
  },
  animate(dt) {
    const p = this.p, P = p.P, j = this.j, n = JUGGLE.length, pz = this.pz;
    if (p.state !== 'free') { p.setState('free'); P.body.position.y = 0.72; }
    // every few rounds of juggling: catch it at the feet and strike your character's pose for a moment
    if (pz.on) { pz.t += dt; if (pz.t >= SHOW_POSE_HOLD) { pz.on = false; this.loops = 0; } }
    else j.t += dt;
    pz.w = damp(pz.w, pz.on ? 1 : 0, 7, dt);
    let a = JUGGLE[j.i], b = JUGGLE[(j.i + 1) % n], s = this.segment(a, b);
    while (j.t >= s.dur) {
      j.t -= s.dur; j.i = (j.i + 1) % n; a = b; b = JUGGLE[(j.i + 1) % n]; s = this.segment(a, b);
      if (this.on && !this.hidePlayer) Sfx.juggle(a[0]); // each touch: a thump
      if (j.i === 0 && ++this.loops >= SHOW_POSE_EVERY) { pz.on = true; pz.t = 0; j.t = 0; break; } // the ball is back at the foot
    }
    const t = j.t, k = smooth(t / s.dur);
    const by = a[1] + s.v0 * t - SHOW_G * t * t / 2, fwd = lerp(a[2], b[2], k), side = lerp(a[3], b[3], k);
    // how far into a touch each body part is (just hit it, or about to)
    const near = (part) => Math.max(a[0] === part ? Math.exp(-Math.pow(t / 0.12, 2)) : 0, b[0] === part ? Math.exp(-Math.pow((s.dur - t) / 0.15, 2)) : 0);
    const R = near('R'), L = near('L'), K = near('K'), H = near('H');
    this.turn = damp(this.turn, this.turnTo, 5, dt);
    const yaw = SHOW_YAW + this.turn;
    const breathe = Math.sin(this.t * 2.1) * 0.012;
    const look = clamp(Math.atan2(1.68 - by, Math.max(0.2, fwd)) * 0.45, -0.5, 0.55);
    const q = { // the juggle
      by: 0.72 - 0.06 * H - 0.02 * (R + L) + breathe, bx: -0.05 * (R + L + K) + 0.03, bz: Math.sin(this.t * 1.3) * 0.02,
      lR: -0.82 * R - 1.25 * K, lRz: 0, lL: -0.82 * L, lLz: 0,
      aL: Math.sin(this.t * 1.7) * 0.12, aLz: 0.3 + 0.22 * (R + K) + Math.sin(this.t * 2.3) * 0.04,
      aR: -Math.sin(this.t * 1.7) * 0.12, aRz: -0.3 - 0.22 * L - Math.sin(this.t * 2.1) * 0.04,
      hx: look - 0.3 * H, hy: (this.turn - SHOW_FACE) * 0.3,
    };
    // ball in the player's frame: forward is (sin yaw, cos yaw), side is (cos yaw, -sin yaw)
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    this.ball.position.set(sy * fwd + cy * side, by - SHOW_DROP, cy * fwd - sy * side); // touches land on the smaller ball's edge
    if (pz.w > 0.001) { // blend into (and back out of) the pose
      const ps = poseFor(p.styleId, pz.t), w = pz.w;
      for (const k in q) q[k] += (ps[k] - q[k]) * w;
      q.hy += (this.turn - SHOW_FACE) * 0.3 * w;
      this.ball.position.lerp(this.poseBall(ps, yaw, _v1), w);
    }
    this.applyPose(q, yaw);
    if (!pz.on) { this.ball.rotation.x += dt * 7; this.ball.rotation.z += dt * 2; }
    this.ring.rotation.y += dt * 0.6;
    this.glowMat.opacity = 0.72 + Math.sin(this.t * 2.4) * 0.08;
    // slow blocks of light drift up from the spot
    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      this.sparkT = 0.07;
      const ang = Math.random() * TAU, r = rand(0.6, 1.25);
      FX.glow.spawn(Math.cos(ang) * r, 0.1, Math.sin(ang) * r, 0, rand(0.5, 1.1), 0, rand(0.06, 0.12), rand(1.2, 2.2), col(p.aura), -0.02, 0.2, 0);
    }
  },
  /** fit the player into the stage box: distance from its height, then a lens shift onto its centre */
  frame() {
    const cam = World.camera, W = window.innerWidth || 800, H = window.innerHeight || 600;
    const st = $(this.stageId);
    if (st && !st.closest('[hidden]')) {
      const b = st.getBoundingClientRect();
      if (b.width > 8 && b.height > 8) this.rect = { cx: b.left + b.width / 2, cy: b.top + b.height / 2, h: b.height };
    }
    const r = this.rect || { cx: W * 0.6, cy: H * 0.55, h: H * 0.8 };
    const frac = clamp(r.h / H, 0.12, 1);
    const D = clamp(SHOW_H / (frac * 2 * Math.tan(SHOW_FOV * Math.PI / 360)), 2.4, 40);
    const a = SHOW_YAW + Math.sin(this.t * 0.21) * 0.04;
    cam.position.set(Math.sin(a) * D + Shake.x, SHOW_CAM_Y + Math.sin(this.t * 0.33) * 0.03 + Shake.y, Math.cos(a) * D);
    cam.lookAt(0, SHOW_MID, 0);
    cam.fov = SHOW_FOV;
    cam.setViewOffset(W, H, W / 2 - r.cx, H / 2 - r.cy, W, H);
    // the screen darkens around the player, like a spotlight
    const css = (r.cx / W * 100).toFixed(1) + '%|' + (r.cy / H * 100).toFixed(1) + '%';
    if (css !== this.css) {
      this.css = css;
      const sec = st && st.closest('.screen'), [x, y] = css.split('|');
      if (sec) { sec.style.setProperty('--stx', x); sec.style.setProperty('--sty', y); }
    }
  },
};
