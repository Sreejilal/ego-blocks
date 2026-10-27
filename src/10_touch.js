/* =====================================================================
   Touch controls: floating move stick, drag to look, action buttons.
   On for touch screens; touching a mouse or a controller hides it again.
   ===================================================================== */
const TOUCH_SHORT = { quickShot: 'QUICK', cutInside: 'CUT IN', snapPass: 'SNAP', armSwipe: 'SWIPE', pinpointPass: 'PINPOINT', lockdown: 'LOCKDOWN', undeadShuffle: 'SHUFFLE', graveGrab: 'GRAB', skyTrap: 'SKY TRAP', fakeVolley: 'FAKE', impactShot: 'IMPACT', overhead: 'OVERHEAD',
  oneTouch: 'ONE TOUCH', rainbow: 'RAINBOW', whiplash: 'WHIP', longBomb: 'BOMB', knuckle: 'KNUCKLE' };
const ITEM_SHORT = { fist: 'FIST', boom: 'BOOM', slime: 'SLIME', jet: 'JETPACK', snow: 'SNOW', magnet: 'MAGNET', bubble: 'BUBBLE', wall: 'WALL', mine: 'MINE', bolt: 'SUPER' };
const T_LOOK_X = 0.0064, T_LOOK_Y = 0.0042;

const Touch = {
  on: false, el: null, b: {}, parts: {}, st: null, ptrs: new Map(), stickId: null, lookId: null,
  moveX: 0, moveY: 0, sprint: false, lookDX: 0, lookDY: 0, held: new Set(),
  board: false, boardT: 0, lastTap: 0, s: 1, R: 56, W: 0, H: 0, sa: { l: 0, r: 0, t: 0, b: 0 },
  ghost: { x: 0, y: 0 }, zoneX: 0, portrait: false, visible: false, cache: {}, probe: null,
  mq(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } },
  /** first guess before any input arrives: phones and tablets report a coarse primary pointer */
  detect() {
    this.on = this.mq('(pointer: coarse)');
    document.body.classList.toggle('touch', this.on);
  },
  tpl() {
    const btn = (act, cls, lb, extra = '') => `<div class="tb ${cls}" data-act="${act}"><i class="ic"></i><b class="lb">${lb}</b><span class="cd"></span><span class="num"></span>${extra}</div>`;
    return `<div class="stick idle" id="t-stick"><div class="ring"></div><div class="base"></div><div class="knob"></div><b class="lb">MOVE</b></div>`
      + btn('shoot', 'big', 'SHOOT', '<span class="chg"></span>') + btn('pass', 'pass', 'PASS') + btn('dt', 'dt', 'TACKLE', '<span class="pips"><i></i><i></i></span>') + btn('jump', '', 'JUMP')
      + btn('ab0', 'ab', '') + btn('ab1', 'ab', '') + btn('ab2', 'ab', '') + btn('flow', 'flow off', 'FLOW') + btn('item', 'item off', 'ITEM')
      + `<div class="tb sm" data-act="pause" aria-label="Pause"><i class="ic"></i></div><div class="tb sm" data-act="chat" aria-label="Chat"><i class="ic"></i></div><div class="tboard" data-act="board" aria-label="Scoreboard"></div>`;
  },
  init() {
    const el = document.createElement('div');
    el.id = 'touch'; el.hidden = true;
    el.innerHTML = this.tpl();
    $('app').insertBefore(el, $('scr-pause'));
    this.el = el;
    el.querySelectorAll('[data-act]').forEach((b) => {
      const a = b.dataset.act;
      this.b[a] = b;
      this.parts[a] = { ic: b.querySelector('.ic'), lb: b.querySelector('.lb'), num: b.querySelector('.num'), pips: b.querySelectorAll('.pips i') };
    });
    this.st = $('t-stick');
    const icon = (a, url) => { if (this.parts[a].ic) this.parts[a].ic.style.backgroundImage = 'url(' + url + ')'; };
    icon('pause', iconURL('pause'));
    icon('chat', iconURL('chat'));
    icon('shoot', iconURL('shot', '#ffffff'));
    icon('pass', iconURL('pass', '#a9c7ff'));
    icon('jump', iconURL('jump'));
    icon('dt', iconURL('tackle', '#e8e1cf'));
    icon('flow', iconURL('flame', '#ffffff'));
    icon('item', iconURL('lock'));
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.end(e.pointerId, e));
    el.addEventListener('pointercancel', (e) => this.end(e.pointerId, null));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // switch layouts by whatever was used last
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') { Input.usingPad = false; if (!this.on) this.setOn(true); }
      else if (e.pointerType === 'mouse' && this.on) this.setOn(false);
    }, true);
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => { World.resize(); this.layout(); }, 300));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.layout());
    document.addEventListener('fullscreenchange', () => this.onFs());
    document.addEventListener('webkitfullscreenchange', () => this.onFs());
    this.layout();
  },
  setOn(v) {
    v = !!v;
    if (this.on === v) return;
    this.on = v;
    document.body.classList.toggle('touch', v);
    if (v) Input.releaseLock();
    this.sync(); this.layout();
    if (UI.cur === 'lobby') UI.renderLobby();
    if (Game.state === 'paused') UI.renderPause();
    if (Hud.lockHint) Hud.lockHint();
  },
  /** show the layer only while a match is being played by touch */
  sync() {
    const vis = this.on && Game.playing() && !Net.paused && !Input.usingPad;
    if (vis === this.visible) return;
    this.visible = vis;
    if (this.el) this.el.hidden = !vis;
    if (vis) this.layout(); else this.releaseAll();
  },
  safeArea() {
    let p = this.probe;
    if (!p) {
      p = this.probe = document.createElement('div');
      p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(p);
    }
    const cs = getComputedStyle(p);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  },
  /** thumb-arc layout around the shoot button, scaled to the screen */
  layout() {
    if (!this.el) return;
    const W = window.innerWidth || 800, H = window.innerHeight || 600;
    const raw = this.safeArea();
    const portrait = H > W;
    // iframes may not pass the notch insets through, so keep a margin on the long sides anyway
    const sa = { t: raw.t, b: raw.b, l: Math.max(raw.l, portrait ? 0 : 16), r: Math.max(raw.r, portrait ? 0 : 16) };
    this.W = W; this.H = H; this.sa = sa; this.portrait = portrait;
    const pref = clamp((Save.data && Save.data.settings.btn) || 1, 0.7, 1.4);
    let s = clamp(Math.min(W, H) / 390, 0.8, 1.2);
    if (portrait) s = Math.min(s, clamp(W / 430, 0.74, 1.05));
    s *= pref; this.s = s;
    const cx = W - sa.r - 70 * s, cy = H - sa.b - (portrait ? 84 : 68) * s;
    const R1 = (portrait ? 100 : 106) * s, R2 = (portrait ? 174 : 192) * s;
    const put = (act, x, y, size) => {
      const st = this.b[act].style;
      st.setProperty('--x', x.toFixed(1) + 'px'); st.setProperty('--y', y.toFixed(1) + 'px'); st.setProperty('--sz', size.toFixed(1) + 'px');
    };
    const pol = (deg, R) => [cx + Math.cos(deg * Math.PI / 180) * R, cy - Math.sin(deg * Math.PI / 180) * R];
    put('shoot', cx, cy, 94 * s);
    put('pass', ...pol(180, R1), 68 * s);
    put('dt', ...pol(135, R1), 64 * s);
    put('jump', ...pol(90, R1), 64 * s);
    const lawless = !!(Game.match && Game.match.cfg.items);
    const arc = lawless ? [['item', 180], ['ab0', 157.5], ['ab1', 135], ['ab2', 112.5], ['flow', 90]] : [['ab0', 170], ['ab1', 146], ['ab2', 122], ['flow', 98]];
    for (const [a, deg] of arc) put(a, ...pol(deg, R2), 58 * s);
    this.b.item.hidden = !lawless;
    put('pause', W - Math.max(raw.r, 8) - 30, raw.t + 30, 46);
    put('chat', W - Math.max(raw.r, 8) - 86, raw.t + 30, 46);
    this.b.chat.hidden = Game.state !== 'online';
    this.R = 58 * s;
    this.ghost.x = sa.l + (portrait ? 80 : 104) * s;
    this.ghost.y = H - sa.b - (portrait ? 150 : 100) * s;
    this.zoneX = W * (portrait ? 0.5 : 0.46);
    this.st.style.setProperty('--R', this.R.toFixed(1) + 'px');
    // tips sit just above the stick's sprint ring on a sideways phone
    document.documentElement.style.setProperty('--thb', Math.max(12, H - (this.ghost.y - this.R * 1.35) + 10).toFixed(0) + 'px');
    if (this.stickId == null) this.placeStick(this.ghost.x, this.ghost.y, this.ghost.x, this.ghost.y, true);
  },
  /* ---------- pointers ---------- */
  down(e) {
    if (e.pointerType === 'mouse') return;
    if (e.cancelable) e.preventDefault();
    Sfx.init();
    const id = e.pointerId, x = e.clientX, y = e.clientY;
    if (this.ptrs.has(id)) this.end(id, null);
    const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (btn && !btn.hidden && this.el.contains(btn)) { this.press(btn, id, x, y); return; }
    if (this.stickId == null && x < this.zoneX && y > this.sa.t + 48) { this.stickStart(id, x, y); return; }
    if (this.lookId == null) { this.lookId = id; this.ptrs.set(id, { kind: 'look', x0: x, y0: y, lx: x, ly: y, t0: performance.now(), moved: false }); }
  },
  press(btn, id, x, y) {
    let act = btn.dataset.act;
    const rec = { kind: 'btn', act, el: btn, x0: x, y0: y, lx: x, ly: y, looking: false };
    this.ptrs.set(id, rec);
    btn.classList.add('down');
    if (act === 'pause' || act === 'board' || act === 'chat') return; // these act on release
    if (act === 'dt') { const m = Game.match, p = m && m.human; act = p && m.ball.owner === p ? 'dodge' : 'tackle'; rec.act = act; }
    this.held.add(act);
    Input.edges.add('T_' + act);
  },
  move(e) {
    const r = this.ptrs.get(e.pointerId);
    if (!r) return;
    if (e.cancelable) e.preventDefault();
    const x = e.clientX, y = e.clientY;
    if (r.kind === 'stick') this.stickMove(r, x, y);
    else if (r.kind === 'look') {
      this.lookDX += x - r.lx; this.lookDY += y - r.ly; r.lx = x; r.ly = y;
      if (!r.moved && Math.hypot(x - r.x0, y - r.y0) > 10) r.moved = true;
    } else if (r.kind === 'btn' && (r.act === 'shoot' || r.act === 'pass')) {
      // dragging a held shoot or pass button aims the camera, so one thumb can charge and aim
      if (!r.looking && Math.hypot(x - r.x0, y - r.y0) > 9) { r.looking = true; r.lx = x; r.ly = y; }
      if (r.looking) { this.lookDX += x - r.lx; this.lookDY += y - r.ly; r.lx = x; r.ly = y; }
    }
  },
  end(id, e) {
    const r = this.ptrs.get(id);
    if (!r) return;
    this.ptrs.delete(id);
    if (r.kind === 'stick') {
      this.stickId = null; this.moveX = this.moveY = 0; this.sprint = false;
      this.placeStick(this.ghost.x, this.ghost.y, this.ghost.x, this.ghost.y, true);
    } else if (r.kind === 'look') {
      this.lookId = null;
      if (e && !r.moved && performance.now() - r.t0 < 260) {
        const now = performance.now();
        if (now - this.lastTap < 380) { this.lastTap = 0; this.faceGoal(); } else this.lastTap = now;
      }
    } else if (r.kind === 'btn') {
      r.el.classList.remove('down');
      if (r.act === 'pause') { if (e) Game.pause(); return; }
      if (r.act === 'chat') { if (e) Net.openChat(); return; }
      if (r.act === 'board') { if (e) { this.board = !this.board; this.boardT = 8; } return; }
      this.held.delete(r.act);
      Input.up.add('T_' + r.act);
      if (r.act === 'shoot' && e) this.buzz(12);
    }
  },
  releaseAll() {
    for (const id of Array.from(this.ptrs.keys())) this.end(id, null);
    this.ptrs.clear(); this.stickId = null; this.lookId = null; this.held.clear();
    this.moveX = this.moveY = 0; this.sprint = false; this.lookDX = this.lookDY = 0;
    if (this.st) this.placeStick(this.ghost.x, this.ghost.y, this.ghost.x, this.ghost.y, true);
  },
  stickStart(id, x, y) {
    const R = this.R, sa = this.sa;
    const bx = clamp(x, sa.l + R + 4, Math.max(sa.l + R + 4, this.zoneX)), by = clamp(y, sa.t + R + 4, this.H - sa.b - R - 4);
    const r = { kind: 'stick', bx, by };
    this.ptrs.set(id, r); this.stickId = id;
    this.st.classList.remove('idle');
    this.stickMove(r, x, y);
  },
  stickMove(r, x, y) {
    const R = this.R, dx = x - r.bx, dy = y - r.by, d = Math.hypot(dx, dy);
    const k = Math.min(1, d / R);
    // small dead zone, then a quick ramp so a short push already runs at full speed
    const mag = k <= 0.14 ? 0 : k >= 0.72 ? 1 : 0.4 + 0.6 * (k - 0.14) / 0.58;
    const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
    this.moveX = nx * mag; this.moveY = -ny * mag;
    this.sprint = d > R * 1.3;
    const kd = Math.min(d, R);
    this.placeStick(r.bx, r.by, r.bx + nx * kd, r.by + ny * kd, false);
    this.st.classList.toggle('sprint', this.sprint);
  },
  placeStick(bx, by, kx, ky, idle) {
    const s = this.st.style;
    s.setProperty('--bx', bx.toFixed(1) + 'px'); s.setProperty('--by', by.toFixed(1) + 'px');
    s.setProperty('--kx', kx.toFixed(1) + 'px'); s.setProperty('--ky', ky.toFixed(1) + 'px');
    if (idle) { this.st.classList.add('idle'); this.st.classList.remove('sprint'); }
  },
  /** double tap on the look side: swing the camera round to face the goal you attack */
  faceGoal(m = Game.match) {
    const p = m && m.human;
    if (!p) return;
    const gz = m.oppGoalZ(p.team);
    Cam.snapYaw = Math.atan2(-p.pos.x, gz - p.pos.z);
  },
  buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} },
  /* ---------- per match + per frame ---------- */
  build(m) {
    const p = m.human;
    if (!p || !this.el) return;
    p.abil.forEach((a, i) => {
      const k = 'ab' + i, P = this.parts[k];
      P.ic.style.backgroundImage = 'url(' + iconURL(a.def.icon, p.aura) + ')';
      this.fitLabel(P.lb, TOUCH_SHORT[a.id] || a.def.name);
      this.b[k].style.setProperty('--aura', p.aura);
    });
    this.parts.flow.ic.style.backgroundImage = 'url(' + iconURL('flame', p.aura) + ')';
    this.b.flow.style.setProperty('--aura', p.aura);
    this.cache = {}; this.board = false;
    this.layout();
  },
  tog(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); },
  setCd(act, frac, num) {
    const c = this.cache, q = Math.round(frac * 90);
    if (c['cd' + act] !== q) { c['cd' + act] = q; this.b[act].style.setProperty('--p', (frac * 360).toFixed(0) + 'deg'); }
    if (c['n' + act] !== num) { c['n' + act] = num; this.parts[act].num.textContent = num; }
  },
  setLabel(act, txt) { const c = this.cache; if (c['l' + act] !== txt) { c['l' + act] = txt; this.fitLabel(this.parts[act].lb, txt); } },
  /** long names get a smaller font so they fit the button */
  fitLabel(el, txt) { el.textContent = txt; el.style.setProperty('--lbk', Math.min(0.135, 0.8 / Math.max(1, txt.length)).toFixed(3)); },
  update(m, dt) {
    if (this.board) { this.boardT -= dt; if (this.boardT <= 0) this.board = false; }
    if (!this.visible || !m || !m.human) return;
    const p = m.human, c = this.cache, b = this.b;
    const own = m.ball.owner === p;
    if (c.own !== own) {
      c.own = own;
      this.parts.dt.ic.style.backgroundImage = 'url(' + (own ? iconURL('dash', '#ffffff') : iconURL('tackle', '#e8e1cf')) + ')';
      this.tog(b.dt, 'dodge', own);
    }
    this.setLabel('dt', own ? 'DODGE' : 'TACKLE');
    if (own) {
      this.setCd('dt', p.dodgeCharges >= 1 ? 0 : clamp(1 - p.dodgeRe / 4, 0, 1), '');
      this.parts.dt.pips.forEach((pip, i) => this.tog(pip, 'on', i < p.dodgeCharges));
    } else {
      const tf = p.tackleCd > 0 ? clamp(p.tackleCd / (2.2 * p.mods.tackleCd), 0, 1) : 0;
      this.setCd('dt', tf, p.tackleCd > 0 ? String(Math.ceil(p.tackleCd)) : '');
    }
    const pl = !own ? 'CALL' : p.passHold > 0.24 ? 'LOB' : 'PASS';
    if (c.pl !== pl) {
      c.pl = pl;
      this.parts.pass.lb.textContent = pl;
      this.parts.pass.ic.style.backgroundImage = 'url(' + iconURL(own ? 'pass' : 'call', '#a9c7ff') + ')';
    }
    for (let i = 0; i < 3; i++) {
      const a = p.abil[i];
      if (!a) continue;
      const k = 'ab' + i;
      this.setCd(k, a.cd > 0 ? clamp(a.cd / a.def.cd, 0, 1) : 0, a.cd > 0 ? String(Math.ceil(a.cd)) : '');
      this.tog(b[k], 'ready', a.cd <= 0);
    }
    const fr = p.flow >= 100 && p.flowT <= 0;
    this.tog(b.flow, 'ready', fr); this.tog(b.flow, 'active', p.flowT > 0); this.tog(b.flow, 'off', !fr && p.flowT <= 0);
    this.setLabel('flow', p.flowT > 0 ? Math.ceil(p.flowT) + 'S' : fr ? 'FLOW!' : Math.floor(p.flow) + '%');
    if (m.cfg.items) {
      const key = p.item || '';
      if (c.item !== key) {
        c.item = key;
        const it = key ? ITEMS[key] : null;
        this.parts.item.ic.style.backgroundImage = 'url(' + (it ? iconURL(it.icon) : iconURL('lock')) + ')';
        this.fitLabel(this.parts.item.lb, it ? (ITEM_SHORT[key] || it.name) : 'ITEM');
        this.tog(b.item, 'off', !it); this.tog(b.item, 'ready', !!it);
      }
    }
    this.tog(b.shoot, 'charging', !!p.charging);
    const chg = p.charging ? Math.round(Math.max(0.28, p.charge) * 100) : 0;
    if (c.chg !== chg) { c.chg = chg; b.shoot.style.setProperty('--c', chg + '%'); }
  },
  /* ---------- fullscreen (only where the page is allowed to) ---------- */
  fsAvailable() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); },
  isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  toggleFs() {
    const d = document, el = d.documentElement;
    try {
      if (this.isFs()) { const ex = d.exitFullscreen || d.webkitExitFullscreen; if (ex) { const r = ex.call(d); if (r && r.catch) r.catch(() => {}); } return; }
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) return;
      const lock = () => { try { const o = screen.orientation; if (o && o.lock) { const r = o.lock('landscape'); if (r && r.catch) r.catch(() => {}); } } catch (e) {} };
      const r = req.call(el);
      if (r && r.then) r.then(lock).catch(() => {}); else lock();
    } catch (e) {}
  },
  onFs() {
    setTimeout(() => { World.resize(); this.layout(); }, 150);
    if (UI.cur === 'lobby') UI.renderLobby();
    if (Game.state === 'paused') UI.renderPause();
  },
};
