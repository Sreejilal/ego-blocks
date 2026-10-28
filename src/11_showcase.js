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

const Showcase = {
  p: null, key: '', hidePlayer: false, on: false, t: 0, turn: SHOW_FACE, turnTo: SHOW_FACE, drag: null, dragX: 0, rect: null, stageId: 'lob-stage', mode: 'lobby', spec: null, j: { i: 0, t: 0 }, sparkT: 0, css: '',
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
    const key = [style, flow || '', club, SKIN_SLOTS.map((s) => look[s.id]).join(',')].join('|');
    if (this.p && this.key === key) return;
    if (this.p) this.p.dispose();
    this.key = key; this.flow = flow;
    this.p = new Player({ scene: World.scene, ball: { owner: null } }, { team: 0, role: 'ST', human: true, style, flow, look, side: sideFor(club), number: 10, name: 'YOU', skin: SKIN_TONES[1] });
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
  /** Locker pose: stand still with the ball at your feet, so the whole outfit is in view */
  idle(dt) {
    const p = this.p, P = p.P;
    if (p.state !== 'free') p.setState('free');
    this.turn = damp(this.turn, this.turnTo, 6, dt);
    const yaw = SHOW_YAW + this.turn, b = Math.sin(this.t * 2.1);
    P.root.position.set(0, 0, 0); P.root.rotation.y = yaw;
    P.body.position.y = 0.72 + b * 0.012; P.body.rotation.set(0.02, 0, Math.sin(this.t * 1.1) * 0.015);
    P.legL.rotation.set(0, 0, 0.04); P.legR.rotation.set(-0.08, 0, -0.06);
    P.armL.rotation.set(Math.sin(this.t * 1.3) * 0.05, 0, 0.12 + b * 0.02); P.armR.rotation.set(-Math.sin(this.t * 1.3) * 0.05, 0, -0.12 - b * 0.02);
    P.headP.rotation.set(0.04 + Math.sin(this.t * 0.7) * 0.03, -this.turn * 0.25, 0);
    P.eyes.visible = !!this.flow;
    p.blob.position.set(0, 0.025, 0); p.blob.scale.set(1, 1, 1);
    const sy = Math.sin(yaw), cy = Math.cos(yaw), fwd = 0.34, side = -0.44;
    this.ball.position.set(sy * fwd + cy * side, BALL_R * SHOW_BALL, cy * fwd - sy * side);
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
    const p = this.p, P = p.P, j = this.j, n = JUGGLE.length;
    if (p.state !== 'free') { p.setState('free'); P.body.position.y = 0.72; }
    j.t += dt;
    let a = JUGGLE[j.i], b = JUGGLE[(j.i + 1) % n], s = this.segment(a, b);
    while (j.t >= s.dur) { j.t -= s.dur; j.i = (j.i + 1) % n; a = b; b = JUGGLE[(j.i + 1) % n]; s = this.segment(a, b); if (this.on && !this.hidePlayer) Sfx.juggle(a[0]); } // each touch: a thump
    const t = j.t, k = smooth(t / s.dur);
    const by = a[1] + s.v0 * t - SHOW_G * t * t / 2, fwd = lerp(a[2], b[2], k), side = lerp(a[3], b[3], k);
    // how far into a touch each body part is (just hit it, or about to)
    const near = (part) => Math.max(a[0] === part ? Math.exp(-Math.pow(t / 0.12, 2)) : 0, b[0] === part ? Math.exp(-Math.pow((s.dur - t) / 0.15, 2)) : 0);
    const R = near('R'), L = near('L'), K = near('K'), H = near('H');
    this.turn = damp(this.turn, this.turnTo, 5, dt);
    const yaw = SHOW_YAW + this.turn;
    P.root.position.set(0, 0, 0); P.root.rotation.y = yaw;
    const breathe = Math.sin(this.t * 2.1) * 0.012;
    P.body.position.y = 0.72 - 0.06 * H - 0.02 * (R + L) + breathe;
    P.body.rotation.set(-0.05 * (R + L + K) + 0.03, 0, Math.sin(this.t * 1.3) * 0.02);
    P.legR.rotation.set(-0.82 * R - 1.25 * K, 0, 0);
    P.legL.rotation.set(-0.82 * L, 0, 0);
    P.armL.rotation.set(Math.sin(this.t * 1.7) * 0.12, 0, 0.3 + 0.22 * (R + K) + Math.sin(this.t * 2.3) * 0.04);
    P.armR.rotation.set(-Math.sin(this.t * 1.7) * 0.12, 0, -0.3 - 0.22 * L - Math.sin(this.t * 2.1) * 0.04);
    const look = clamp(Math.atan2(1.68 - by, Math.max(0.2, fwd)) * 0.45, -0.5, 0.55);
    P.headP.rotation.set(look - 0.3 * H, (this.turn - SHOW_FACE) * 0.3, 0);
    P.eyes.visible = !!this.flow;
    p.blob.position.set(0, 0.025, 0); p.blob.scale.set(1, 1, 1);
    // ball in the player's frame: forward is (sin yaw, cos yaw), side is (cos yaw, -sin yaw)
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    this.ball.position.set(sy * fwd + cy * side, by - SHOW_DROP, cy * fwd - sy * side); // touches land on the smaller ball's edge
    this.ball.rotation.x += dt * 7; this.ball.rotation.z += dt * 2;
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
