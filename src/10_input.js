/* =====================================================================
   Input (keyboard, mouse + pointer lock, gamepad) and the camera
   ===================================================================== */
const GAME_KEYS = new Set(['Space', 'Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyG', 'KeyC', 'KeyX', 'ShiftLeft', 'ShiftRight']);
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const Input = {
  down: new Set(), edges: new Set(), up: new Set(),
  mdx: 0, mdy: 0, mouseL: false, mouseR: false,
  locked: false, lockFailed: false, releasing: false, canvas: null,
  pad: null, padPrev: [], padNow: [], usingPad: false,
  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      const inGame = Game.playing();
      if (inGame && GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.code === 'Tab' && Game.playing()) e.preventDefault();
      if (!e.repeat) { this.down.add(e.code); this.edges.add(e.code); }
      if (e.code === 'Escape') Game.onEscape();
      this.usingPad = false;
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); this.up.add(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); if (this.mouseL) this.up.add('Mouse0'); if (this.mouseR) this.up.add('Mouse2'); this.mouseL = this.mouseR = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!Game.playing() || Net.paused) return;
      e.preventDefault();
      Sfx.init();
      if (!this.locked && !this.lockFailed) { this.requestLock(); return; }
      if (e.button === 0) { this.mouseL = true; this.edges.add('Mouse0'); }
      if (e.button === 2) { this.mouseR = true; this.edges.add('Mouse2'); }
      this.usingPad = false;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.mouseL) { this.mouseL = false; this.up.add('Mouse0'); }
      if (e.button === 2 && this.mouseR) { this.mouseR = false; this.up.add('Mouse2'); }
    });
    window.addEventListener('mousemove', (e) => {
      if (!Game.playing()) return;
      if (this.locked) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; }
      else if (this.lockFailed) { this.mdx += (e.movementX || 0) * 0.8; this.mdy += (e.movementY || 0) * 0.8; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { this.everLocked = true; this.lockFailed = false; }
      if (was && !this.locked && Game.playing() && !Net.paused && !this.releasing) Game.pause();
      this.releasing = false;
      Hud.lockHint && Hud.lockHint();
    });
    document.addEventListener('pointerlockerror', () => this.lockError());
  },
  lockError() { if (!this.everLocked) this.lockFailed = true; Hud.lockHint && Hud.lockHint(); },
  requestLock() {
    if (Touch.on) return; // touch play never needs the mouse locked
    if (!this.canvas || !this.canvas.requestPointerLock) { this.lockFailed = true; return; }
    try {
      const r = this.canvas.requestPointerLock();
      if (r && typeof r.catch === 'function') r.catch(() => this.lockError());
    } catch (e) { this.lockError(); }
  },
  releaseLock() { if (document.pointerLockElement) { this.releasing = true; try { document.exitPointerLock(); } catch (e) {} } },
  pollPad() {
    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { pads = []; }
    const p = pads[0] || null;
    this.pad = p;
    this.padPrev = this.padNow;
    this.padNow = p ? p.buttons.map((b) => (typeof b === 'object' ? b.value > 0.5 || b.pressed : b > 0.5)) : [];
    if (p) {
      const any = this.padNow.some(Boolean) || p.axes.some((a) => Math.abs(a) > 0.3);
      if (any) this.usingPad = true;
      // pad edges feed the same edge set as keys
      const map = [[PAD.A, 'PadA'], [PAD.B, 'PadB'], [PAD.X, 'PadX'], [PAD.Y, 'PadY'], [PAD.LEFT, 'PadLeft'], [PAD.UP, 'PadUp'], [PAD.RIGHT, 'PadRight'], [PAD.DOWN, 'PadDown'], [PAD.RT, 'PadRT'], [PAD.LT, 'PadLT'], [PAD.RB, 'PadRB'], [PAD.START, 'PadStart'], [PAD.RS, 'PadRS']];
      for (const [i, name] of map) {
        if (this.padNow[i] && !this.padPrev[i]) { this.edges.add(name); if (name === 'PadStart') Game.onEscape(); }
        if (!this.padNow[i] && this.padPrev[i]) this.up.add(name);
      }
    }
  },
  padHeld(i) { return !!this.padNow[i]; },
  axis(i) { const p = this.pad; if (!p || !p.axes[i]) return 0; const v = p.axes[i]; return Math.abs(v) < 0.16 ? 0 : v; },
  controls() {
    const k = this.down, e = this.edges, u = this.up;
    let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let my = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const lx = this.axis(0), ly = this.axis(1);
    if (Math.abs(lx) > 0 || Math.abs(ly) > 0) { mx = lx; my = -ly; }
    const T = Touch, th = T.held;
    if (T.stickId != null) { mx = T.moveX; my = T.moveY; }
    return {
      moveX: mx, moveY: my,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight') || this.padHeld(PAD.LB) || this.padHeld(PAD.LS) || (T.stickId != null && T.sprint),
      jump: e.has('Space') || e.has('PadA') || e.has('T_jump'), jumpHeld: k.has('Space') || this.padHeld(PAD.A) || th.has('jump'),
      shootDown: e.has('Mouse0') || e.has('PadRT') || e.has('T_shoot'), shootHeld: this.mouseL || this.padHeld(PAD.RT) || th.has('shoot'), shootUp: u.has('Mouse0') || u.has('PadRT') || u.has('T_shoot'),
      passDown: e.has('Mouse2') || e.has('PadLT') || e.has('PadRB') || e.has('T_pass'), passUp: u.has('Mouse2') || u.has('PadLT') || u.has('PadRB') || u.has('T_pass'),
      dodge: e.has('KeyC') || e.has('PadB') || e.has('T_dodge'),
      tackle: e.has('KeyF') || e.has('PadX') || e.has('T_tackle'),
      ab: [e.has('KeyQ') || e.has('PadLeft') || e.has('T_ab0'), e.has('KeyE') || e.has('PadUp') || e.has('T_ab1'), e.has('KeyR') || e.has('PadRight') || e.has('T_ab2')],
      flow: e.has('KeyG') || e.has('PadY') || e.has('T_flow'),
      item: e.has('KeyX') || e.has('PadDown') || e.has('T_item'),
      board: k.has('Tab') || this.padHeld(PAD.BACK) || T.board,
    };
  },
  consumeEdges() { this.edges.clear(); this.up.clear(); },
  endFrame() { this.mdx = 0; this.mdy = 0; },
};

const Cam = {
  yaw: 0, pitch: -0.13, dist: 6.4, pos: V3(0, 5, -10), pivotY: 1.7, aim: V3(), onTarget: false, fwd: V3(0, 0, 1), snapYaw: null, punchT: 0, punchDur: 1, punchK: 0,
  /** a quick zoom in and back out for the cut-ins */
  punch(dur) { this.punchT = this.punchDur = dur; },
  reset(yaw = 0) { this.yaw = yaw; this.pitch = -0.13; this.pos.set(0, 5, -10); this.pivotY = 1.7; this.snapYaw = null; },
  look(realDt) {
    const s = Save.data.settings, sens = s.sens || 1, inv = s.invertY ? -1 : 1;
    if (Input.mdx || Input.mdy) this.snapYaw = null;
    this.yaw -= Input.mdx * 0.0024 * sens;
    this.pitch -= Input.mdy * 0.0021 * sens * inv;
    if (Touch.lookDX || Touch.lookDY) {
      this.snapYaw = null;
      this.yaw -= Touch.lookDX * T_LOOK_X * sens;
      this.pitch -= Touch.lookDY * T_LOOK_Y * sens * inv;
      Touch.lookDX = 0; Touch.lookDY = 0;
    }
    if (this.snapYaw != null) {
      this.yaw = dampAngle(this.yaw, this.snapYaw, 13, realDt);
      this.pitch = damp(this.pitch, -0.13, 10, realDt);
      if (Math.abs(wrapA(this.snapYaw - this.yaw)) < 0.01) this.snapYaw = null;
    }
    const k = Input.down;
    this.yaw += ((k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)) * 2.5 * realDt * sens;
    this.pitch += ((k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0)) * 1.5 * realDt * sens * inv;
    this.yaw -= Input.axis(2) * 2.8 * realDt * sens;
    this.pitch -= Input.axis(3) * 1.9 * realDt * sens * inv;
    this.pitch = clamp(this.pitch, -0.66, 0.42);
    this.yaw = wrapA(this.yaw);
    const cp = Math.cos(this.pitch);
    this.fwd.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  },
  follow(realDt, m) {
    const cam = World.camera;
    const p = m.human || m.players[4];
    const wide = m.phase === 'goal' || m.phase === 'end';
    const tall = cam.aspect < 0.85; // phone held upright: sit further back and higher to see more pitch
    this.pivotY = damp(this.pivotY, p.pos.y + 1.7, 10, realDt);
    let pk = 0;
    if (this.punchT > 0) { this.punchT -= realDt; const u = 1 - Math.max(0, this.punchT) / this.punchDur; pk = u < 0.12 ? u / 0.12 : Math.max(0, 1 - (u - 0.12) / 0.88); }
    if (pk > 0 || this.punchK > 0) { cam.fov = World.baseFov - pk * 10; cam.updateProjectionMatrix(); }
    this.punchK = pk;
    const dist = this.dist + (wide ? 2.6 : 0) + (tall ? 1.7 : 0) - pk * 2;
    let tx = p.pos.x - this.fwd.x * dist, ty = this.pivotY - this.fwd.y * dist + 0.55 + (tall ? 0.7 : 0), tz = p.pos.z - this.fwd.z * dist;
    tx = clamp(tx, -F.BOARD_X - 1.2, F.BOARD_X + 1.2); tz = clamp(tz, -F.BOARD_Z - 2.1, F.BOARD_Z + 2.1); ty = Math.max(0.45, ty);
    const k = 1 - Math.exp(-20 * realDt);
    this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k;
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    cam.position.set(this.pos.x + rx * Shake.x, this.pos.y + Shake.y, this.pos.z + rz * Shake.x);
    _v1.copy(cam.position).add(this.fwd);
    cam.lookAt(_v1);
    this.computeAim(m, p);
  },
  computeAim(m, p) {
    const o = World.camera.position, d = this.fwd;
    const gz = m.oppGoalZ(p.team);
    let set = false;
    if (Math.abs(d.z) > 1e-4) {
      const plane = d.z * gz > 0 ? gz : -gz;
      const t = (plane - o.z) / d.z;
      if (t > 0 && t < 95) {
        const x = o.x + d.x * t, y = o.y + d.y * t;
        if (Math.abs(x) < F.W + 8 && y > -0.5) { this.aim.set(x, clamp(y, 0.25, 9), plane); set = true; }
      }
    }
    if (!set && d.y < -0.02) {
      const t = (0.3 - o.y) / d.y;
      if (t > 0 && t < 70) { this.aim.set(o.x + d.x * t, 0.3, o.z + d.z * t); set = true; }
    }
    if (!set) this.aim.set(o.x + d.x * 45, clamp(o.y + d.y * 45, 0.25, 9), o.z + d.z * 45);
    if (Touch.on && !Input.usingPad && Save.data.settings.assist !== false) this.assist(p, gz);
    this.onTarget = Math.abs(this.aim.z - gz) < 0.6 && Math.abs(this.aim.x) < F.GW && this.aim.y < F.GH;
    m.aim.copy(this.aim); m.camYaw = this.yaw; m.aimOnTarget = this.onTarget;
  },
  /** touch aim assist: a shot aimed just wide, just high or down at the grass is pulled inside the frame.
      Anything clearly wide (more than ~2 blocks past a post) is left alone so crosses still work. */
  assist(p, gz) {
    const o = World.camera.position, d = this.fwd;
    if ((gz - p.pos.z) * d.z <= 0 || Math.abs(d.z) < 0.25) return;
    const t = (gz - o.z) / d.z;
    if (!(t > 0)) return;
    let x = o.x + d.x * t, y = o.y + d.y * t;
    if (Math.abs(x) > F.GW + 1.9 || y > F.GH + 1.4) return;
    const M = F.GW - 0.6;
    if (Math.abs(x) > M) x = Math.sign(x) * M;
    y = y < 0.35 ? 0.8 : Math.min(y, F.GH - 0.5);
    this.aim.set(x, y, gz);
  },
};
