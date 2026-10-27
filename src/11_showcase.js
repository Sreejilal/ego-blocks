/* =====================================================================
   Showcase: your player on a lit spot in the stadium for the start
   screen. Juggles a ball and turns toward the mouse or a finger drag.
   The page decides where the player goes: the camera fits the player
   into the box of the current "stage" element (#lob-stage).
   ===================================================================== */
const SHOW_FOV = 34, SHOW_H = 2.55, SHOW_MID = 1.08, SHOW_CAM_Y = 1.2, SHOW_YAW = Math.PI + 0.3, SHOW_G = 13;
const SHOW_FACE = -0.55; // the player stands turned a little toward the menu, so the ball never hides the face
// each touch: [body part, ball height, reach in front, side, how high it pops above the next touch]
const JUGGLE = [
  ['R', 0.55, 0.5, -0.12, 0.7], ['L', 0.55, 0.5, 0.12, 0.65], ['R', 0.55, 0.5, -0.12, 0.75], ['K', 0.86, 0.62, -0.12, 0.45],
  ['L', 0.55, 0.5, 0.12, 0.7], ['R', 0.55, 0.5, -0.12, 1.95], ['H', 2.32, 0.1, 0, 0.55], ['L', 0.55, 0.5, 0.12, 0.75],
];

const Showcase = {
  p: null, key: '', on: false, t: 0, turn: SHOW_FACE, turnTo: SHOW_FACE, drag: null, rect: null, stageId: 'lob-stage', j: { i: 0, t: 0 }, sparkT: 0, css: '',
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
    this.ball.castShadow = true;
    g.add(glow, this.ring, beam, this.ball);
    g.visible = false;
    World.scene.add(g);
    // the player looks toward the mouse, or toward a finger dragged on the stage
    window.addEventListener('pointermove', (e) => {
      if (!this.on) return;
      if (e.pointerType === 'mouse' || e.pointerId === this.drag) this.point(e.clientX);
    });
    window.addEventListener('pointerdown', (e) => {
      if (!this.on || e.pointerType === 'mouse') return;
      const st = $(this.stageId);
      if (st && e.target && st.contains(e.target)) { this.drag = e.pointerId; this.point(e.clientX); }
    });
    const lift = (e) => { if (e.pointerId === this.drag) { this.drag = null; this.turnTo = SHOW_FACE; } };
    window.addEventListener('pointerup', lift);
    window.addEventListener('pointercancel', lift);
    document.addEventListener('mouseleave', () => { if (this.drag == null) this.turnTo = SHOW_FACE; });
  },
  point(x) {
    const cx = this.rect ? this.rect.cx : window.innerWidth / 2;
    this.turnTo = SHOW_FACE + clamp((x - cx) / (window.innerWidth || 1) * 1.7, -0.5, 0.8);
  },
  /** (re)build the model when the equipped style or Flow changed */
  ensure() {
    if (!this.group) return;
    const d = Save.data, key = d.style + '|' + (d.flow || '');
    if (this.p && this.key === key) return;
    if (this.p) this.p.dispose();
    this.key = key;
    this.p = new Player({ scene: World.scene, ball: { owner: null } }, { team: 0, role: 'ST', human: true, style: d.style, flow: d.flow, number: 10, name: 'YOU', skin: SKIN_TONES[1] });
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
    this.on = false; this.group.visible = false; this.drag = null; this.turn = this.turnTo = SHOW_FACE;
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
    this.animate(dt);
    this.frame();
  },
  animate(dt) {
    const p = this.p, P = p.P, j = this.j, n = JUGGLE.length;
    j.t += dt;
    let a = JUGGLE[j.i], b = JUGGLE[(j.i + 1) % n], s = this.segment(a, b);
    while (j.t >= s.dur) { j.t -= s.dur; j.i = (j.i + 1) % n; a = b; b = JUGGLE[(j.i + 1) % n]; s = this.segment(a, b); }
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
    P.eyes.visible = !!Save.data.flow;
    p.blob.position.set(0, 0.025, 0); p.blob.scale.set(1, 1, 1);
    // ball in the player's frame: forward is (sin yaw, cos yaw), side is (cos yaw, -sin yaw)
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    this.ball.position.set(sy * fwd + cy * side, by, cy * fwd - sy * side);
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
    cam.position.set(Math.sin(a) * D, SHOW_CAM_Y + Math.sin(this.t * 0.33) * 0.03, Math.cos(a) * D);
    cam.lookAt(0, SHOW_MID, 0);
    cam.fov = SHOW_FOV;
    cam.setViewOffset(W, H, W / 2 - r.cx, H / 2 - r.cy, W, H);
    // the screen darkens around the player, like a spotlight
    const css = (r.cx / W * 100).toFixed(1) + '%|' + (r.cy / H * 100).toFixed(1) + '%';
    if (css !== this.css) {
      this.css = css;
      const sec = $('scr-lobby'), [x, y] = css.split('|');
      sec.style.setProperty('--stx', x); sec.style.setProperty('--sty', y);
    }
  },
};
