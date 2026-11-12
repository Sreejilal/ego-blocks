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

/** pictures of the controls, shared by the tutorial and the first-match tips */
const KeyPics = {
  cap(c, lb) { return `<span class="kc" data-code="${c}">${lb || KeyNames.of(c)}</span>`; },
  mouse(side) { return `<span class="mouse ${side}"><i></i><i></i></span>`; },
  pad(b) { return `<span class="kc pad">${b}</span>`; },
  /** the keys and mouse buttons inside `el` light up while held */
  light(el) {
    el.querySelectorAll('.kc[data-code]').forEach((k) => k.classList.toggle('on', Input.down.has(k.dataset.code)));
    const m = el.querySelector('.mouse'); if (m) m.classList.toggle('on', m.classList.contains('l') ? Input.mouseL : Input.mouseR);
  },
  /** on phones, the touch button to press glows */
  glow(act) {
    document.querySelectorAll('#touch .tb.tut-glow').forEach((b) => b.classList.remove('tut-glow'));
    if (act) { const b = document.querySelector('#touch [data-act="' + act + '"]'); if (b) b.classList.add('tut-glow'); }
  },
};

/* First-match tips (CrazyGames: "focus on the core, avoid explaining every feature", "make sure the UI is clear"):
   while you are new, the match screen shows only what you need (move, pass, shoot). Each extra part of the HUD comes
   in the first time it matters, with one short tip and a picture of the key. Seen tips are kept (Save.data.tips);
   after ROOKIE_MATCHES matches, or once every tip has been seen, the whole HUD shows. Not online, not in tests. */
const ROOKIE_MATCHES = 6;
const TIP_LIST = [
  { id: 'shoot', title: 'SHOOT', k: () => KeyPics.mouse('l'), pad: 'RT', touch: 'shoot', text: 'HOLD TO POWER UP, LET GO TO SHOOT', tText: 'HOLD SHOOT, LET GO', when: (c) => c.own },
  { id: 'pass', title: 'PASS', k: () => KeyPics.mouse('r'), pad: 'LT', touch: 'pass', text: 'PASS TO A TEAMMATE. HOLD IT FOR A HIGH BALL', tText: 'TAP PASS. HOLD IT FOR A HIGH BALL', when: (c) => c.own && c.since('shoot') > 6 },
  { id: 'sprint', title: 'SPRINT', k: () => KeyPics.cap('ShiftLeft', 'SHIFT'), pad: 'LB', touch: null, text: 'HOLD TO RUN FAST. IT USES STAMINA', tText: 'PUSH THE STICK ALL THE WAY TO RUN FAST', when: (c) => c.walkT > 2.5 },
  { id: 'tackle', title: 'TACKLE', k: () => KeyPics.cap('KeyF'), pad: 'X', touch: 'dt', text: 'GET CLOSE AND SLIDE IN TO WIN THE BALL', tText: 'GET CLOSE AND TAP TACKLE', when: (c) => c.theirs && c.near < 7 },
  { id: 'feint', title: 'FEINT', k: () => KeyPics.cap('KeyC'), pad: 'B', touch: 'dt', text: 'STEP PAST THEM. TAP IT TWICE FOR SLOW-MO', tText: 'TAP FEINT. TWICE FOR SLOW-MO', reveal: 'moves', when: (c) => c.own && c.near < 4.5 },
  { id: 'ability', title: 'YOUR POWERS', k: () => KeyPics.cap('KeyQ') + KeyPics.cap('KeyE') + KeyPics.cap('KeyR'), pad: 'D-PAD', touch: 'ab0', text: 'YOUR STYLE HAS 3 POWERS. TRY THEM', tText: 'YOUR STYLE HAS 3 POWERS. TRY THEM', reveal: 'abil', when: (c) => c.playT > 25 },
  { id: 'flow', title: 'FLOW', k: () => KeyPics.cap('KeyG'), pad: 'Y', touch: 'flow', text: 'BIG PLAYS FILL THE FLOW BAR. WHEN IT IS FULL, PRESS IT', tText: 'BIG PLAYS FILL FLOW. TAP IT WHEN FULL', reveal: 'flow', when: (c) => c.flow >= 40 },
];
const Tips = {
  shownAt: {}, t: 0, gap: 0, playT: 0, walkT: 0, cur: null,
  seen(id) { return Save.data.tips.includes(id); },
  /** still new: some parts of the HUD wait for their tip */
  rookie() { return !navigator.webdriver && Save.data.stats.played < ROOKIE_MATCHES && TIP_LIST.some((t) => !this.seen(t.id)); },
  /** a fresh match: hide what has not been shown yet */
  start(m) {
    this.t = 0; this.gap = 4; this.playT = 0; this.walkT = 0; this.cur = null; this.shownAt = {};
    this.active = !m.online && !m.tut && !m.fk && this.rookie();
    $('tipbox').hidden = true;
    this.applyHud();
  },
  applyHud() {
    const B = document.body.classList, on = this.active;
    for (const t of TIP_LIST) if (t.reveal) B.toggle('rk-' + t.reveal, on && !this.seen(t.id));
  },
  update(m, dt) {
    if (!this.active || m.phase !== 'play' || !m.human) { if (this.cur && m.phase !== 'play') this.hide(); return; }
    const h = m.human, b = m.ball, me = this;
    this.playT += dt; this.gap -= dt;
    this.walkT = len2D(h.mx, h.mz) > 0.5 && !h.sprint && b.owner !== h ? this.walkT + dt : 0;
    if (this.cur) { this.t -= dt; KeyPics.light($('tip-keys')); if (this.t <= 0) this.hide(); return; }
    if (this.gap > 0) return;
    let near = 99;
    for (const o of m.opponents(h)) if (!o.isGK) near = Math.min(near, dist2D(o.pos, h.pos));
    const c = { own: b.owner === h, theirs: !!(b.owner && b.owner.team !== h.team && !b.owner.isGK), near: b.owner && b.owner.team !== h.team ? dist2D(b.owner.pos, h.pos) : near, flow: h.flow, playT: this.playT, walkT: this.walkT, since: (id) => (me.shownAt[id] != null ? me.playT - me.shownAt[id] : me.seen(id) ? 99 : -1) };
    const tip = TIP_LIST.find((t) => !this.seen(t.id) && t.when(c));
    if (tip) this.show(tip);
  },
  show(tip) {
    const d = Save.data, how = Touch.on && !Input.usingPad ? 'touch' : Input.usingPad ? 'pad' : 'k';
    d.tips.push(tip.id); Save.save();
    this.shownAt[tip.id] = this.playT; this.cur = tip; this.t = 4.5; this.gap = 7;
    const keys = how === 'k' ? tip.k() : how === 'pad' ? KeyPics.pad(tip.pad) : '';
    $('tip-keys').innerHTML = keys; $('tip-keys').hidden = !keys;
    UI.setText('tip-title', tip.title); UI.setText('tip-text', how === 'touch' ? tip.tText : tip.text);
    const box = $('tipbox'); box.hidden = false; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    if (how === 'touch') KeyPics.glow(tip.touch);
    this.applyHud(); Sfx.coin();
    if (tip.reveal === 'abil' && Touch.on) Touch.layout();
  },
  hide() { this.cur = null; $('tipbox').hidden = true; KeyPics.glow(null); },
};

const TutHud = {
  mark: null, step: -2,
  update(m) {
    const T = m && m.tut, box = $('tutbox');
    if (!T || m.phase === 'end') { box.hidden = true; if (this.mark) this.mark.visible = false; if (this.step !== -2) document.querySelectorAll('#touch .tb.tut-glow').forEach((b) => b.classList.remove('tut-glow')); this.step = -2; return; }
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
    if (this.step !== T.step || this.how !== how) { this.step = T.step; this.how = how; this.drawKeys(S.id, how); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); } // a little bounce for each new step
    this.lightKeys(how);
  },
  /** pictures of the controls for this step (CrazyGames: "show the user how to control the game with a keyboard overlay") */
  drawKeys(id, how) {
    const el = $('tut-keys'), cap = (c, lb) => KeyPics.cap(c, lb), mouse = (side) => KeyPics.mouse(side), pad = (b) => KeyPics.pad(b);
    let html = '';
    if (how === 'k') {
      if (id === 'move' || id === 'ball') html = `<span class="kcross">${cap('KeyW')}<span>${cap('KeyA')}${cap('KeyS')}${cap('KeyD')}</span></span>`;
      else if (id === 'pass') html = mouse('r') + '<span class="kl">PASS</span>';
      else if (id === 'shoot') html = mouse('l') + '<span class="kl">HOLD · LET GO</span>';
    } else if (how === 'pad') {
      html = { move: pad('L STICK'), ball: pad('L STICK'), pass: pad('LT'), shoot: pad('R STICK') + pad('RT') }[id] || '';
    }
    el.innerHTML = html; el.hidden = !html;
    KeyPics.glow(how === 'touch' ? { pass: 'pass', shoot: 'shoot' }[id] : null); // phones: the button to press glows
  },
  /** the keys light up while you hold them */
  lightKeys(how) { if (how === 'k') KeyPics.light($('tut-keys')); },
};
