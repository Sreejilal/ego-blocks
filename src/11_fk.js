/* =====================================================================
   TutHud (the tutorial's instructions and gold square) and FKHud: free kick aids. A target on the goal where you aim, dots for the
   first part of the ball's path, and the panel (kick type, curve, power)
   ===================================================================== */
const FKHud = {
  built: false, on: false, target: null, dots: [],
  build() {
    if (this.built) return;
    this.built = true;
    // the target: a square frame that stands just in front of the goal mouth
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcb3d, transparent: true, opacity: 0.95, depthTest: false });
    const g = new THREE.Group(), s = 0.62, t = 0.09;
    for (const [w, h, x, y] of [[s * 2, t, 0, s], [s * 2, t, 0, -s], [t, s * 2, s, 0], [t, s * 2, -s, 0], [0.16, 0.16, 0, 0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, 0); m.renderOrder = 20; g.add(m);
    }
    g.visible = false; World.scene.add(g); this.target = g;
    const dg = new THREE.BoxGeometry(0.2, 0.2, 0.2), dm = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.9, depthTest: false });
    for (let i = 0; i < 30; i++) { const d = new THREE.Mesh(dg, dm); d.visible = false; d.renderOrder = 20; World.scene.add(d); this.dots.push(d); }
  },
  hide() {
    if (!this.on) return;
    this.on = false;
    if (this.target) this.target.visible = false;
    for (const d of this.dots) d.visible = false;
    $('fkpanel').hidden = true;
  },
  update(m) {
    const p = m && m.human, show = !!(m && m.fk && p && p.fkHold && m.phase === 'play' && m.ball.owner === p);
    $('hud').classList.toggle('fk', !!(m && m.fk)); // free kicks: the panel replaces the Flow bar and hotbar
    if (!show) { this.hide(); return; }
    this.build();
    if (!this.on) { this.on = true; $('fkpanel').hidden = false; }
    const s = p.fkShot, T = FK_TYPES[s.type], aim = p.aimV || m.aim, gz = m.oppGoalZ(p.team);
    // the target, a little in front of the goal line so it is never hidden by the net
    this.target.visible = true;
    this.target.position.set(aim.x, aim.y, aim.z - Math.sign(gz) * 0.15);
    this.target.rotation.y = gz > 0 ? Math.PI : 0;
    const path = m.fkPath(p, aim);
    this.dots.forEach((d, i) => { const q = path[i]; d.visible = !!q; if (q) d.position.set(q.x, q.y, q.z); });
    // the panel
    UI.setText('fk-type', T.name); UI.setText('fk-desc', T.desc);
    $('fk-cmark').style.left = (50 + s.curve * 50).toFixed(1) + '%';
    const D = Math.hypot(aim.x - m.ball.pos.x, aim.z - m.ball.pos.z), ideal = fkIdeal(D);
    const z = $('fk-zone'); z.style.left = ((ideal - FK_TOL) * 100).toFixed(1) + '%'; z.style.width = (FK_TOL * 200).toFixed(1) + '%';
    const f = $('fk-pfill'), ch = p.charging ? p.charge : 0;
    f.style.width = (ch * 100).toFixed(1) + '%';
    f.className = ch > ideal + FK_TOL ? 'over' : ch >= ideal - FK_TOL ? 'good' : '';
    const pad = Input.usingPad;
    UI.setText('fk-typekey', pad ? 'LT' : 'RMB'); UI.setText('fk-curvekey', pad ? 'L STICK' : 'A D'); UI.setText('fk-powkey', pad ? 'RT' : 'LMB');
  },
};

/** ShotHud: while you charge a curve shot (A/D or the stick), dots show how it bends: the first part of its path */
const ShotHud = {
  dots: [], on: false,
  build() {
    if (this.dots.length) return;
    const g = new THREE.BoxGeometry(0.13, 0.13, 0.13), mat = new THREE.MeshBasicMaterial({ color: 0x7cf2ff, transparent: true, opacity: 0.8, depthTest: false });
    for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(g, mat); d.visible = false; d.renderOrder = 20; World.scene.add(d); this.dots.push(d); }
  },
  hide() { if (!this.on) return; this.on = false; for (const d of this.dots) d.visible = false; },
  update(m) {
    const p = m && m.human;
    const show = !!(p && m.shotLaunch && !m.fk && m.phase === 'play' && p.charging && m.ball.owner === p && Math.abs(p.shotCurve || 0) >= CURVE_MIN);
    if (!show) { this.hide(); return; }
    this.build(); this.on = true;
    const L = m.shotLaunch(p, p.aimV || m.aim, Math.max(0.5, p.charge), { curveIn: p.shotCurve });
    if (!(L.T > 0)) { this.hide(); return; }
    const n = this.dots.length, sub = 6, h = L.T * 0.75 / ((n + 2) * sub); // the first 75% of the way, from a little in front of you
    let x = L.from.x, y = L.from.y, z = L.from.z, vx = L.v.x, vy = L.v.y, vz = L.v.z;
    for (let i = -2; i < n; i++) {
      for (let j = 0; j < sub; j++) { vx += L.cx * h; vz += L.cz * h; vy -= BALL_G * h; x += vx * h; y = Math.max(BALL_R, y + vy * h); z += vz * h; }
      if (i >= 0) { const d = this.dots[i]; d.visible = true; d.position.set(x, y, z); }
    }
  },
};

const TutHud = {
  mark: null, step: -2,
  update(m) {
    const T = m && m.tut, box = $('tutbox');
    if (!T || m.phase === 'end') { box.hidden = true; if (this.mark) this.mark.visible = false; this.step = -2; return; }
    if (!this.mark) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffcb3d, transparent: true, opacity: 0.9, depthTest: false });
      const g = new THREE.Group();
      for (const [w, h, x, z] of [[3, 0.3, 0, 1.35], [3, 0.3, 0, -1.35], [0.3, 3, 1.35, 0], [0.3, 3, -1.35, 0]]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); q.rotation.x = -Math.PI / 2; q.position.set(x, 0.05, z); q.renderOrder = 20; g.add(q); }
      World.scene.add(g); this.mark = g;
    }
    this.mark.visible = !!T.mark;
    if (T.mark) { this.mark.position.set(T.mark.x, 0, T.mark.z); this.mark.rotation.y = m.time * 1.5; }
    const S = TUT_STEPS[T.step], how = Touch.on && !Input.usingPad ? 'touch' : Input.usingPad ? 'pad' : 'k';
    box.hidden = false;
    UI.setText('tut-n', 'STEP ' + (T.step + 1) + ' OF ' + TUT_STEPS.length); UI.setText('tut-title', S.title); UI.setText('tut-text', S[how]);
    if (this.step !== T.step) { this.step = T.step; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); } // a little bounce for each new step
  },
};
