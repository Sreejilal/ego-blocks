/* =====================================================================
   FKHud: free kick aids. A target on the goal where you aim, dots for the
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
