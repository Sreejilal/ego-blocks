/* =====================================================================
   Match: rules, possession, kicking, tackling, abilities, goals,
   restarts, Flow, Lawless items
   ===================================================================== */
const Hud = { toast() {}, label() {}, banner() {}, goal() {}, flowReady() {} }; // filled in by the UI
const BOT_NAMES = ['BLOK', 'CUBO', 'PIXL', 'VOXX', 'CHUNK', 'BRIK', 'TILE', 'STAK', 'OBBY', 'GRAV', 'LOAM', 'SLAB', 'COBB', 'FLINT', 'QUARTZ', 'MOSS', 'DUSK', 'EMBR', 'RUNE', 'KRYS', 'BYTE', 'NOVA', 'REDS', 'TUFF'];
const MODES = {
  ranked: { name: 'RANKED', ranked: true, items: false },
  quick: { name: 'QUICK MATCH', ranked: false, items: false },
  lawless: { name: 'LAWLESS', ranked: false, items: true },
};
// kickoff spots on the first pitch's scale (see PITCH_KX / PITCH_KZ)
const FORM = { GK: [0, -31.0], DEF: [0, -18], MID: [7, -9], LW: [11, -7], RW: [-11, -7], ST: [0, -2.2] };
const MATCH_LEN = 240, GOLDEN_LEN = 120;

class Match {
  constructor(mode, d, opts = {}) {
    this.mode = mode; this.cfg = MODES[mode] || MODES.quick; this.d = d;
    this.size = ROSTERS[opts.size] ? opts.size : teamSizeFor(mode, Save.data.rp);
    this.scene = World.scene;
    this.time = 0; this.clock = opts.length || MATCH_LEN; this.golden = false; this.goldenClock = GOLDEN_LEN;
    this.phase = 'kickoff'; this.phaseT = 0; this.paused = false; this.kickDelay = 2.6;
    this.score = [0, 0]; this.players = []; this.teams = [[], []];
    this.ball = new Ball(this);
    this.items = []; this.projectiles = []; this.hazards = []; this.itemSpawnT = 5;
    this.lastPass = null; this.restart = null; this.result = null; this.endTimer = 0;
    this.teamState = ['loose', 'loose']; this.pred = [];
    this.aim = V3(0, 1, F.L); this.camYaw = 0; this.aimOnTarget = false;
    this.ctl = null; this.autopilot = !!opts.autopilot; this.lastGoal = null; this.pendingEnd = false;
    // your club at home against a random other club; the away side changes kit if the colours clash
    const home = opts.home || (opts.noHuman ? pick(CLUB_IDS) : Save.data.club);
    const away = opts.away || pick(CLUB_IDS.filter((c) => c !== home));
    [TEAM[0], TEAM[1]] = matchSides(home, away);
    this.buildTeams(opts);
    this.setupKickoff(0, true);
  }
  /* ---------- setup ---------- */
  buildTeams(opts) {
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const used = new Set([1, 10]);
    const roles = ROSTERS[this.size];
    for (let team = 0; team < 2; team++) {
      for (const role of roles) {
        const human = team === 0 && role === 'ST' && !opts.noHuman;
        let num = role === 'GK' ? 1 : human ? 10 : 0;
        if (!num) { do num = randi(2, 99); while (used.has(num)); used.add(num); }
        const style = human ? (opts.style || Save.data.style) : botStyle();
        const flow = human ? (opts.flow !== undefined ? opts.flow : Save.data.flow) : (chance(0.85) ? pick(FLOW_IDS) : null);
        const look = human ? (opts.look || Save.data.look) : botLook();
        const p = new Player(this, { team, role, human, style, flow, look, skin: human ? SKIN_TONES[1] : null, number: num, name: human ? 'YOU' : names.pop() });
        if (!human && team === 1) p.speedMul = 1 + 0.045 * this.d;
        this.players.push(p); this.teams[team].push(p);
        if (human) this.human = p;
      }
    }
    if (!this.human) this.human = null;
  }
  dispose() {
    for (const p of this.players) p.dispose();
    this.ball.dispose();
    for (const it of this.items) this.drop(it.mesh);
    for (const pr of this.projectiles) this.drop(pr.mesh);
    for (const h of this.hazards) this.drop(h.mesh, h.type === 'wall');
    FX.clear();
  }
  /** remove a transient mesh and free its material (and geometry when it is not shared) */
  drop(mesh, ownGeo = false) {
    if (!mesh) return;
    this.scene.remove(mesh);
    if (mesh.material) mesh.material.dispose();
    if (ownGeo && mesh.geometry) mesh.geometry.dispose();
  }
  dir(team) { return team === 0 ? 1 : -1; }
  oppGoalZ(team) { return this.dir(team) * F.L; }
  ownGoalZ(team) { return -this.dir(team) * F.L; }
  prog(team, pos) { return pos.z * this.dir(team); }
  skill(p) { const s = (this.human && p.team === this.human.team) ? Math.max(0.6, this.d) : this.d; return p.isGK ? Math.min(1.2, s + 0.08 + (5 - this.size) * 0.07) : s; } // keepers get a boost in small teams, where they face more shots
  opponents(p) { return this.teams[1 - p.team]; }
  inOwnBox(p, pos = p.pos) {
    const gz = this.ownGoalZ(p.team);
    return Math.abs(pos.x) < F.BOX_W && Math.abs(pos.z - gz) < F.BOX_D && Math.abs(pos.z) < F.L + 0.5;
  }
  canAct(p) { return (p.state === 'free' || p.state === 'hold') && this.phase === 'play'; }
  label(p, text, color) { Hud.label(p, text, color || p.aura); }
  toast(text, cls) { Hud.toast(text, cls); }
  involvesHuman(...ps) { return ps.some((q) => q && q.isHuman); }

  setupKickoff(team, first = false) {
    this.kickTeam = team; this.phase = 'kickoff'; this.phaseT = 0; this.kickDelay = first ? 2.6 : 1.7;
    this.ball.reset(0, 0); this.lastPass = null; this.pendingEnd = false;
    for (const p of this.players) {
      const f = FORM[p.role]; let u = f[0] * PITCH_KX, v = f[1] * PITCH_KZ;
      if (p.isGK) v = -(F.L - 1.5);
      if (p.role === 'ST') v = p.team === team ? -0.95 : -(F.CIRCLE + 1.2);
      if ((p.role === 'LW' || p.role === 'RW' || p.role === 'MID') && p.team === team) v = -3.5;
      const s = this.dir(p.team);
      p.pos.set(u * s, 0, v * s); p.vel.set(0, 0, 0); p.yaw = s > 0 ? 0 : Math.PI;
      p.dash = p.slide = p.dive = null; p.charging = false; p.charge = 0; p.kickT = -1; p.flipT = -1; p.pending = null;
      p.fx.hang = 0; p.fx.vision = 0; p.fx.jetpack = 0; p.fx.magnet = 0; p.fx.slimed = 0;
      p.setState('kickoff'); p.onGround = true;
      p.ai.wantShot = null; p.ai.dodgeIn = -1; p.ai.task = 'pos'; p.ai.receive = null; p.ai.runT = 0;
    }
    if (first) Hud.banner(this.cfg.name, this.mode === 'ranked' ? 'WIN +25 RP \u00b7 DRAW +5 \u00b7 LOSS -15' : this.mode === 'lawless' ? (Touch.on ? 'GRAB THE ? BLOCKS \u00b7 TAP ITEM TO USE' : 'GRAB THE ? BLOCKS \u00b7 X USES YOUR ITEM') : 'NO RANK ON THE LINE', TEAM[0].hex);
    else Hud.banner('KICKOFF', TEAM[team].name + ' BALL', TEAM[team].hex);
    if (!first && this.human && Touch.on) Touch.faceGoal(this);
  }
  startPlay() {
    this.phase = 'play'; this.phaseT = 0;
    for (const p of this.players) p.setState('free');
    const st = this.teams[this.kickTeam].find((p) => p.role === 'ST');
    this.possess(st, true);
    st.protect = 0.5;
    Sfx.whistle(1);
  }
  /* ---------- main update ---------- */
  update(dt) {
    if (this.paused) return;
    this.time += dt; this.phaseT += dt;
    const ph = this.phase;
    if (ph === 'kickoff' && this.phaseT >= this.kickDelay) this.startPlay();
    if (ph === 'goal' && this.phaseT >= 3.9) { if (this.pendingEnd) this.endMatch(); else this.setupKickoff(1 - this.lastGoal.team); }
    if (ph === 'out' && this.phaseT >= 1.05) this.doRestart();
    if (ph === 'play' || ph === 'out') this.tickClock(dt);

    for (const p of this.players) { p.tickTimers(dt); p.computeMods(); }
    if (ph === 'play' || ph === 'out' || ph === 'goal') AI.update(this, dt);
    if (this.human && !this.autopilot) this.updateHuman(dt, this.ctl);
    this.updatePending(dt);
    for (const p of this.players) p.physics(dt);
    this.separate();
    if (ph === 'play') { this.updateSlides(); this.updateMagnets(dt); }
    this.ball.update(dt);
    if (this.phase === 'play') { this.ballContacts(); this.checkGoalAndOut(); }
    if (this.cfg.items) this.updateItems(dt);
    this.updateFx(dt);
    for (const p of this.players) p.animate(dt);
  }
  tickClock(dt) {
    if (!this.golden) {
      this.clock -= dt;
      if (this.clock <= 0) {
        this.clock = 0;
        if (this.score[0] !== this.score[1]) this.endMatch();
        else { this.golden = true; this.goldenClock = GOLDEN_LEN; Hud.banner('GOLDEN GOAL', 'NEXT GOAL WINS', '#ffcb3d'); Sfx.whistle(2); Sfx.roar(0.5); }
      }
    } else {
      this.goldenClock -= dt;
      if (this.goldenClock <= 0) { this.goldenClock = 0; this.endMatch(); }
    }
  }
  endMatch() {
    if (this.phase === 'end') return;
    this.phase = 'end'; this.phaseT = 0;
    Sfx.whistle(3);
    const [a, b] = this.score;
    const humanTeam = this.human ? this.human.team : 0;
    const res = a === b ? 'draw' : ((a > b ? 0 : 1) === humanTeam ? 'win' : 'loss');
    this.result = { res, score: [a, b], human: this.human ? Object.assign({}, this.human.stats) : null, players: this.players.map((p) => ({ name: p.name, team: p.team, number: p.number, style: p.styleId, role: p.role, isHuman: p.isHuman, stats: Object.assign({}, p.stats) })) };
    Hud.banner('FULL TIME', a + ' : ' + b, res === 'win' ? '#2ee38f' : res === 'loss' ? '#ff4d5e' : '#ffcb3d');
    for (const p of this.players) {
      p.charging = false; p.mx = p.mz = 0;
      const won = a !== b && (a > b ? 0 : 1) === p.team;
      p.setState(won ? 'celebrate' : 'free', won ? 99 : 0);
    }
    World.excite[a > b ? 0 : 1] = a === b ? 0.3 : 1;
  }
  /* ---------- human control ---------- */
  updateHuman(dt, c) {
    const p = this.human;
    if (!p || !c) return;
    const cy = this.camYaw, fx = Math.sin(cy), fz = Math.cos(cy), rx = -fz, rz = fx;
    let mx = fx * c.moveY + rx * c.moveX, mz = fz * c.moveY + rz * c.moveX;
    const ml = len2D(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const live = this.phase === 'play' || this.phase === 'out' || this.phase === 'goal' || this.phase === 'end';
    p.mx = live ? mx : 0; p.mz = live ? mz : 0; p.sprint = c.sprint;
    p.faceYaw = p.charging ? cy : null;
    p.jetThrust = c.jumpHeld && p.fx.jetpack > 0;
    if (this.phase !== 'play') { p.charging = false; p.charge = 0; return; }
    if (!this.canAct(p)) { if (p.state !== 'dash') { p.charging = false; p.charge = 0; } return; }
    if (c.shootDown && !p.charging) { p.charging = true; p.charge = 0; }
    if (p.charging) {
      if (!c.shootHeld && !c.shootUp) { p.charging = false; p.charge = 0; }
      else p.charge = Math.min(1, p.charge + dt / 0.95);
    }
    if (c.shootUp && p.charging) {
      const power = Math.max(0.28, p.charge);
      p.charging = false; p.charge = 0;
      this.tryShoot(p, power, this.aim, { curveIn: c.moveX });
    }
    if (c.passDown) p.passHold = 0.0001;
    if (p.passHold > 0) p.passHold += dt;
    if (c.passUp && p.passHold > 0) {
      const lob = p.passHold > 0.24; p.passHold = 0;
      if (this.ball.owner === p) { const mate = this.pickPassTarget(p); if (mate) this.passTo(p, mate, { lob }); }
      else { p.callT = 1.6; this.label(p, 'PASS!', '#2ee38f'); }
    }
    if (c.jump) this.jump(p);
    if (c.dodge) this.dodge(p, mx, mz);
    if (c.tackle) {
      let tx = mx, tz = mz;
      if (len2D(tx, tz) < 0.2) { tx = Math.sin(p.yaw); tz = Math.cos(p.yaw); }
      this.tackle(p, tx, tz);
    }
    for (let i = 0; i < 3; i++) if (c.ab[i]) this.useAbility(p, i);
    if (c.flow) { if (!this.activateFlow(p) && p.flow < 100 && p.flowT <= 0) { this.toast('FLOW NOT READY', 'bad'); Sfx.deny(); } }
    if (c.item) this.useItem(p);
  }
  pickPassTarget(p) {
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    let best = null, bestS = -1e9;
    for (const t of this.teams[p.team]) {
      if (t === p) continue;
      const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.5) continue;
      const ang = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
      const sc = -ang * 3 - d * 0.012 - (t.isGK ? 0.9 : 0);
      if (sc > bestS) { bestS = sc; best = t; }
    }
    return best;
  }
  /* ---------- ball helpers ---------- */
  possess(p, silent = false) {
    const b = this.ball, k = b.kick;
    b.owner = p; b.held = false; b.inGoal = 0; b.vel.set(0, 0, 0); b.curve.set(0, 0, 0); b.straightT = 0; b.kick = null;
    b.touch(p);
    p.pickBlock = 0;
    if (k && k.by && k.by !== p) {
      if (k.type === 'pass' && k.by.team === p.team) {
        k.by.stats.passes++; this.flowAdd(k.by, 12);
        this.lastPass = { from: k.by, to: p, t: this.time };
      } else if (k.by.team !== p.team && (k.type === 'pass' || k.type === 'shot')) {
        this.flowAdd(p, 10);
        if (p.isHuman) this.toast('INTERCEPTED', 'good');
        if (k.type === 'shot' && !p.isGK) this.label(p, 'BLOCKED', p.aura);
      }
    }
    if (p.isGK && this.inOwnBox(p)) { b.held = true; p.setState('hold'); p.ai.holdT = rand(0.8, 1.4); }
    if (!silent) Sfx.touch();
    if (p.fx.skyTrap > 0 && b.pos.y > 1.2) { p.fx.skyTrap = 0; p.fx.hang = 0.45; if (!p.onGround) p.vel.y = Math.max(p.vel.y, 0); FX.ring(b.pos.x, b.pos.y, b.pos.z, p.aura, 0.9, 16); this.label(p, 'TRAPPED', p.aura); Sfx.zap(); }
  }
  kick(p, vx, vy, vz, o = {}) {
    const b = this.ball;
    if (b.owner && b.owner !== p) return false;
    const wasOwner = b.owner === p;
    b.release();
    if (p.state === 'hold') p.setState('free');
    const hl = len2D(vx, vz) || 1;
    if (wasOwner && !o.keepPos) { b.pos.x = p.pos.x + vx / hl * 0.6; b.pos.z = p.pos.z + vz / hl * 0.6; b.pos.y = Math.max(BALL_R, Math.min(b.pos.y, p.pos.y + BALL_R + 0.2)); }
    b.vel.set(vx, vy, vz);
    b.curve.set(o.cx || 0, 0, o.cz || 0); b.curveDecay = o.curveDecay == null ? 1.4 : o.curveDecay;
    b.straightT = o.straight || 0; b.inGoal = 0;
    b.kick = { by: p, type: o.type || 'shot', to: o.to || null, t: this.time, trail: o.trail || null, special: o.special || null, counted: false };
    b.lastKicker = p; b.touch(p);
    b.ignore = p; b.ignoreT = 0.22;
    p.pickBlock = o.selfBlock == null ? 0.32 : o.selfBlock;
    if (!o.noAnim) { p.kickT = 0; p.kickDur = o.kickDur || 0.32; }
    if (!o.keepYaw) p.yaw = Math.atan2(vx, vz);
    const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
    Sfx.kick(clamp(sp / 36, 0.15, 1));
    if (sp > 27 && this.involvesHuman(p)) Shake.add(0.22);
    return true;
  }
  shootAt(p, target, power, o = {}) {
    const b = this.ball;
    const speed = lerp(17, 36, clamp(power, 0, 1)) * p.mods.shot * (o.mult || 1);
    let from = b.pos;
    if (b.owner === p) { const dx = target.x - p.pos.x, dz = target.z - p.pos.z, l = len2D(dx, dz) || 1; from = V3(p.pos.x + dx / l * 0.6, b.pos.y, p.pos.z + dz / l * 0.6); }
    const v = solveLaunch(from, target, speed, BALL_G * 1.04);
    let cx = 0, cz = 0;
    if (o.curveIn) { const hl = len2D(v.x, v.z) || 1; const k = clamp(o.curveIn, -1, 1) * 7; cx = (-v.z / hl) * k; cz = (v.x / hl) * k; }
    p.stats.shots++;
    const trail = o.trail || (speed > 28 ? p.aura : null);
    return this.kick(p, v.x, v.y, v.z, Object.assign({ type: 'shot', trail, cx, cz }, o));
  }
  tryShoot(p, power, aim, o = {}) {
    const b = this.ball;
    if (b.owner === p) return this.shootAt(p, aim, power, o);
    if (!b.owner) {
      const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, hd = Math.hypot(dx, dz), relY = b.pos.y - p.pos.y;
      const air = !p.onGround;
      if (hd < (air ? 2.0 : 1.6) && relY < (air ? 2.6 : 1.6) && relY > -0.8 && p.pickBlock < 0.2) {
        const volley = air || relY > 0.9;
        if (volley) { FX.sparks(b.pos.x, b.pos.y, b.pos.z, p.aura, 10, 4); }
        return this.shootAt(p, aim, power, Object.assign({ mult: volley ? 1.08 : 1, keepPos: true }, o));
      }
    }
    p.kickT = 0; p.kickDur = 0.3;
    return false;
  }
  passTo(p, mate, o = {}) {
    const b = this.ball;
    if (b.owner !== p && !o.loose) return false;
    const from = b.owner === p ? V3(p.pos.x + Math.sin(p.yaw) * 0.6, BALL_R, p.pos.z + Math.cos(p.yaw) * 0.6) : b.pos.clone();
    let tx = mate.pos.x, tz = mate.pos.z, vx, vy, vz, extra = {};
    const D0 = Math.hypot(tx - from.x, tz - from.z);
    if (o.snap) {
      const sp = 38, t = D0 / sp;
      tx += mate.vel.x * t * 0.9; tz += mate.vel.z * t * 0.9;
      const D = Math.hypot(tx - from.x, tz - from.z) || 1;
      vx = (tx - from.x) / D * sp; vz = (tz - from.z) / D * sp; vy = 0.4;
      extra = { straight: D / sp + 0.08, trail: p.aura, special: 'snap' };
    } else if (o.lob) {
      const T = clamp(0.7 + D0 * 0.03, 0.8, 1.6);
      const lead = Math.min(7, len2D(mate.vel.x, mate.vel.z) * T * 0.85);
      const ml = len2D(mate.vel.x, mate.vel.z) || 1;
      tx += mate.vel.x / ml * lead; tz += mate.vel.z / ml * lead;
      tx = clamp(tx, -F.W + 1, F.W - 1); tz = clamp(tz, -F.L + 1, F.L - 1);
      const ty = 0.9;
      vx = (tx - from.x) / T; vz = (tz - from.z) / T; vy = (ty - from.y + 0.5 * BALL_G * T * T) / T;
    } else {
      let D = D0, v0 = 0;
      for (let i = 0; i < 2; i++) {
        v0 = groundSpeedFor(D, 7.5);
        const t = D / ((v0 + 7.5) / 2);
        tx = mate.pos.x + mate.vel.x * Math.min(t, 1.4) * 0.85; tz = mate.pos.z + mate.vel.z * Math.min(t, 1.4) * 0.85;
        D = Math.hypot(tx - from.x, tz - from.z);
      }
      v0 = Math.min(groundSpeedFor(D, 7.5), 30);
      vx = (tx - from.x) / (D || 1) * v0; vz = (tz - from.z) / (D || 1) * v0; vy = 0.5;
    }
    if (o.through) Object.assign(extra, o.through);
    const ok = this.kick(p, vx, vy, vz, Object.assign({ type: 'pass', to: mate, selfBlock: 0.45, kickDur: 0.28 }, extra));
    if (ok && !mate.isHuman) { mate.ai.receive = { t: this.time }; }
    return ok;
  }
  throughBall(p, mate) {
    const s = this.dir(p.team);
    const from = V3(p.pos.x + Math.sin(p.yaw) * 0.6, BALL_R, p.pos.z + Math.cos(p.yaw) * 0.6);
    let tx = mate.pos.x + mate.vel.x * 0.4 - mate.pos.x * 0.18, tz = mate.pos.z + s * 8 + mate.vel.z * 0.4;
    tx = clamp(tx, -F.W + 2.5, F.W - 2.5); tz = clamp(tz, -F.L + 3, F.L - 3);
    const dx = tx - from.x, dz = tz - from.z, D = Math.hypot(dx, dz) || 1;
    const sp = clamp(14 + D * 0.32, 16, 26), T = D / sp;
    const a = 0.2, sig = (dx * s < 0 ? 1 : -1);
    const nx = dz / D * sig, nz = -dx / D * sig;
    const c = Math.cos(a), si = Math.sin(a);
    const vx = (dx / D * c + nx * si) * sp, vz = (dz / D * c + nz * si) * sp;
    const acc = 2 * sp * si / T;
    this.kick(p, vx, 0.5 * BALL_G * T, vz, { type: 'pass', to: mate, selfBlock: 0.45, cx: -nx * acc, cz: -nz * acc, curveDecay: 0, trail: p.aura });
    mate.ai.runTo = V3(tx, 0, tz); mate.ai.runT = 1.8; mate.ai.receive = { t: this.time };
    this.ball.kick.passPoint = V3(tx, 0, tz);
  }
  curlShot(p, target) {
    const b = this.ball;
    const from = b.owner === p ? V3(p.pos.x + Math.sin(p.yaw) * 0.6, b.pos.y, p.pos.z + Math.cos(p.yaw) * 0.6) : b.pos.clone();
    const sp = 27 * p.mods.shot;
    const dx = target.x - from.x, dz = target.z - from.z, D = Math.hypot(dx, dz) || 1;
    const a = clamp(0.36 - D * 0.004, 0.18, 0.36);
    let sig = 1; const nx0 = dz / D, nz0 = -dx / D;
    if (nx0 * (target.x >= 0 ? 1 : -1) < 0) sig = -1;
    const nx = nx0 * sig, nz = nz0 * sig, c = Math.cos(a), si = Math.sin(a);
    const T = D / (sp * c);
    const vx = (dx / D * c + nx * si) * sp, vz = (dz / D * c + nz * si) * sp;
    const vy = clamp((target.y - from.y + 0.5 * BALL_G * T * T) / T, -2, 12);
    const acc = 2 * sp * si / T;
    p.stats.shots++;
    this.kick(p, vx, vy, vz, { type: 'shot', cx: -nx * acc, cz: -nz * acc, curveDecay: 0, trail: p.aura, special: 'curl' });
    FX.sparks(from.x, from.y, from.z, p.aura, 14, 5);
  }
  impactShot(p, target) {
    const b = this.ball;
    const from = b.owner === p ? V3(p.pos.x + Math.sin(p.yaw) * 0.6, Math.max(b.pos.y, 0.5), p.pos.z + Math.cos(p.yaw) * 0.6) : b.pos.clone();
    const d = V3(target.x - from.x, target.y - from.y, target.z - from.z).normalize();
    if (b.owner === p) b.pos.copy(from);
    p.stats.shots++;
    this.kick(p, d.x * 58, d.y * 58, d.z * 58, { type: 'shot', straight: 3, trail: p.aura, special: 'impact', keepPos: true });
    FX.beam(from, b, p.aura);
    if (this.involvesHuman(p)) { Shake.add(0.6); TimeCtl.hitStop(0.06); Hud.flash && Hud.flash(p.aura); }
    Sfx.beam(); FX.sparks(from.x, from.y, from.z, p.aura, 30, 9, 0.24);
  }
  jump(p) {
    if (!p.onGround || p.state !== 'free') return false;
    p.vel.y = 7.6; p.onGround = false;
    const b = this.ball;
    if (b.owner === p) {
      b.release();
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      b.vel.set(fx * 3 + p.vel.x * 0.65, 8.2, fz * 3 + p.vel.z * 0.65);
      b.kick = { by: p, type: 'flick', t: this.time }; b.touch(p);
      p.pickBlock = 0.22; b.ignore = p; b.ignoreT = 0.25;
      Sfx.touch(); FX.feathers(b.pos.x, 0.3, b.pos.z, '#ffffff', 5);
    }
    return true;
  }
  dodge(p, dx, dz) {
    if (p.dodgeCharges < 1 || p.stamina < 8 || p.state !== 'free') { if (p.isHuman && p.state === 'free') { Sfx.deny(); } return false; }
    if (len2D(dx, dz) < 0.2) { dx = -Math.cos(p.yaw); dz = Math.sin(p.yaw); }
    const l = len2D(dx, dz); dx /= l; dz /= l;
    p.dodgeCharges--; p.stamina -= 12; p.stamDelay = 0.6; p.iframes = 0.5;
    for (const o of this.opponents(p)) if ((o.state === 'windup' || o.state === 'slide') && dist2D(o.pos, p.pos) < 7) o.slideBeaten = p;
    const yawKeep = p.yaw;
    this.dashP(p, dx, dz, 15.5, 0.2, { onEnd: () => { if (this.ball.owner === p) p.yaw = yawKeep; } });
    FX.feathers(p.pos.x, p.pos.y + 0.3, p.pos.z, '#ffffff', 6); Sfx.dodge();
    return true;
  }
  dashP(p, dx, dz, speed, dur, o = {}) {
    p.charging = false; p.charge = 0;
    p.dash = { dx, dz, speed, dur, t: 0, zig: !!o.zig, home: o.home || null, onEnd: o.onEnd || null };
    p.setState('dash');
  }
  tackle(p, dx, dz) {
    if (p.tackleCd > 0 || p.state !== 'free' || this.ball.owner === p) return false;
    const l = len2D(dx, dz) || 1; dx /= l; dz /= l;
    p.charging = false; p.charge = 0;
    p.tackleCd = 2.2 * p.mods.tackleCd;
    p.slidePlan = { dx, dz }; p.slideBeaten = null;
    p.setState('windup', p.isHuman ? 0.07 : 0.15);
    p.yaw = Math.atan2(dx, dz);
    const c = this.ball.owner;
    if (c && c.team !== p.team) {
      if (!c.isHuman) AI.reactTackle(this, c, p);
      else if (dist2D(c.pos, p.pos) < 6) { this.label(p, '!', '#ff4d5e'); FX.ring(p.pos.x, 0.15, p.pos.z, '#ff4d5e', 0.8, 12); }
    }
    return true;
  }
  beginSlide(p) {
    let { dx, dz } = p.slidePlan || { dx: Math.sin(p.yaw), dz: Math.cos(p.yaw) };
    const c = this.ball.owner;
    if (c && c.team !== p.team) {
      const lead = p.isHuman ? 0.1 : 0.16;
      const cx = c.pos.x + c.vel.x * lead - p.pos.x, cz = c.pos.z + c.vel.z * lead - p.pos.z, cl = len2D(cx, cz) || 1;
      if (cl < 4.8 * p.mods.tackleRange && (cx * dx + cz * dz) / cl > 0.35) { const k = p.isHuman ? 0.6 : 0.85; dx = lerp(dx, cx / cl, k); dz = lerp(dz, cz / cl, k); const nl = len2D(dx, dz) || 1; dx /= nl; dz /= nl; }
    }
    p.setState('slide', 0.44);
    p.slide = { dx, dz, speed: 14.5 * Math.min(1.25, Math.sqrt(p.mods.tackleRange)), hit: false, hitBall: false };
    p.yaw = Math.atan2(dx, dz);
    Sfx.slide(); FX.dirt(p.pos.x, p.pos.z, -dx, -dz, 6, 0.6);
  }
  updateSlides() {
    const b = this.ball;
    for (const p of this.players) {
      if (p.state === 'windup' && p.stateT >= p.stateDur) this.beginSlide(p);
      if (p.state !== 'slide' || !p.slide || p.slide.hit) continue;
      const S = p.slide, R = 1.2 * p.mods.tackleRange;
      const hx = p.pos.x + S.dx * 0.7, hz = p.pos.z + S.dz * 0.7;
      if (Math.random() < 0.5) FX.dirt(p.pos.x, p.pos.z, -S.dx, -S.dz, 1, 0.5);
      if (!b.owner && !S.hitBall && Math.hypot(b.pos.x - hx, b.pos.z - hz) < R * 0.85 && b.pos.y < 1.0) {
        S.hitBall = true;
        b.vel.set(S.dx * 10.5 + p.vel.x * 0.15, 2.2, S.dz * 10.5 + p.vel.z * 0.15);
        b.kick = { by: p, type: 'tackle', t: this.time }; b.touch(p); p.pickBlock = 0;
        Sfx.kick(0.3);
      }
      for (const o of this.opponents(p)) {
        if (o.state === 'down' || (o.isGK && o.state === 'hold')) continue;
        if (Math.hypot(o.pos.x - hx, o.pos.z - hz) > R + P_R * 0.5 || Math.abs(o.pos.y - p.pos.y) > 1.3) continue;
        S.hit = true;
        if (o === b.owner) {
          if (o.iframes > 0 || o.tackleProof > 0 || o.fx.bubble > 0 || o.protect > 0 || p.slideBeaten === o) { this.ankleBreak(p, o); }
          else {
            b.release();
            b.pos.x = o.pos.x + S.dx * 0.5; b.pos.z = o.pos.z + S.dz * 0.5; b.pos.y = BALL_R;
            b.vel.set(S.dx * 7 + rand(-1.2, 1.2), 3, S.dz * 7 + rand(-1.2, 1.2));
            b.kick = { by: p, type: 'tackle', t: this.time }; b.touch(p);
            this.knockDown(o, 0.9, S.dx, S.dz, 3.5, p);
            o.pickBlock = Math.max(o.pickBlock, 0.9); p.pickBlock = 0;
            p.stats.tackles++; this.flowAdd(p, 15);
            this.label(p, 'TACKLE', p.aura);
            Sfx.tackle(); FX.dirt(o.pos.x, o.pos.z, S.dx, S.dz, 14, 1.1);
            if (this.involvesHuman(p, o)) { TimeCtl.hitStop(0.075); Shake.add(0.3); if (o.isHuman) this.toast('TACKLED', 'bad'); else this.toast('CLEAN TACKLE', 'good'); }
          }
        } else if (!(o.fx.bubble > 0)) {
          this.knockDown(o, 0.6, S.dx, S.dz, 3, p);
          Sfx.tackle();
          if (this.involvesHuman(p, o)) TimeCtl.hitStop(0.05);
        }
        break;
      }
    }
  }
  ankleBreak(tackler, carrier) {
    tackler.slide = null; tackler.setState('stun', 0.75);
    this.flowAdd(carrier, 15);
    this.label(carrier, 'ANKLES', carrier.aura);
    FX.feathers(carrier.pos.x, carrier.pos.y + 0.6, carrier.pos.z, carrier.aura, 8);
    Sfx.dodge();
    if (carrier.isHuman) this.toast('ANKLE BREAKER', 'good');
    else if (tackler.isHuman) this.toast('DODGED', 'bad');
    if (this.involvesHuman(tackler, carrier)) TimeCtl.slowMo(0.45, 0.35);
  }
  knockDown(t, dur, dx, dz, power = 3, by = null) {
    if (t.fx.bubble > 0 || (t.isGK && t.state === 'hold')) return false;
    const b = this.ball;
    if (b.owner === t) {
      b.release();
      b.vel.set(dx * 3 + rand(-1, 1), 2.4, dz * 3 + rand(-1, 1));
      b.kick = { by: by, type: 'loose', t: this.time };
      t.pickBlock = Math.max(t.pickBlock, dur);
    }
    t.charging = false; t.charge = 0; t.dash = null; t.slide = null; t.dive = null; t.kickT = -1; t.pending = null; t.ai.wantShot = null;
    t.setState('down', dur);
    t.fallDir = (dx * Math.sin(t.yaw) + dz * Math.cos(t.yaw)) > 0 ? -1 : 1;
    t.vel.x = dx * power; t.vel.z = dz * power;
    FX.dirt(t.pos.x, t.pos.z, dx, dz, 8, 0.8);
    return true;
  }
  stun(t, dur, kind = 'stun') {
    if (t.fx.bubble > 0) return false;
    if (t.state === 'hold') return false;
    t.charging = false; t.dash = null; t.slide = null; t.ai.wantShot = null;
    t.setState(kind, dur);
    return true;
  }
  steal(p, from) {
    const b = this.ball;
    if (b.owner !== from) return false;
    if (from.iframes > 0 || from.tackleProof > 0 || from.fx.bubble > 0 || from.protect > 0 || (from.isGK && from.state === 'hold')) { this.ankleBreak(p, from); return false; }
    b.release(); this.possess(p);
    from.pickBlock = 0.8; this.stun(from, 0.45);
    p.stats.tackles++; this.flowAdd(p, 15);
    this.label(p, 'STOLEN', p.aura); Sfx.tackle();
    if (this.involvesHuman(p, from)) { TimeCtl.hitStop(0.06); Shake.add(0.2); this.toast(from.isHuman ? 'ROBBED' : 'STOLEN', from.isHuman ? 'bad' : 'good'); }
    return true;
  }
  opponentInFront(p, range, cone = 1.0) {
    let best = null, bd = 1e9;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    for (const o of this.opponents(p)) {
      if (o.state === 'down') continue;
      const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > range) continue;
      const ang = Math.acos(clamp((dx * fx + dz * fz) / (d || 1), -1, 1));
      if (ang > cone && d > 1.6) continue;
      const sc = d + ang * 1.5 - (this.ball.owner === o ? 1.5 : 0);
      if (sc < bd) { bd = sc; best = o; }
    }
    return best;
  }
  feint(p, radius, dur) {
    let n = 0;
    for (const o of this.opponents(p)) {
      if (o.isGK) continue;
      if (dist2D(o.pos, p.pos) < radius && this.stun(o, dur)) { n++; FX.sparks(o.pos.x, 2.1, o.pos.z, '#ffffff', 6, 2, 0.12, 0.5); }
    }
    const gk = this.teams[1 - p.team][0];
    if (gk.state === 'free' && dist2D(gk.pos, p.pos) < 24 && chance(0.75 - 0.35 * this.skill(gk))) AI.keeperBite(this, gk);
    Sfx.swoosh();
    if (p.isHuman && n) this.toast('FROZE ' + n, 'good');
  }
  graveGrab(p, carrier) {
    const b = this.ball;
    const tgt = carrier ? carrier.pos : b.pos;
    const dx = tgt.x - p.pos.x, dz = tgt.z - p.pos.z, d = len2D(dx, dz) || 1;
    p.yaw = Math.atan2(dx, dz);
    this.dashP(p, dx / d, dz / d, 22, Math.min(0.34, d / 22), {
      home: carrier || null,
      onEnd: () => {
        if (carrier && b.owner === carrier && dist2D(carrier.pos, p.pos) < 2.6) this.steal(p, carrier);
      },
    });
    FX.feathers(p.pos.x, 0.6, p.pos.z, p.aura, 6);
  }
  callNow(p) {
    const c = this.ball.owner;
    if (c && c.team === p.team && c !== p && !c.isHuman && (c.state === 'free' || c.state === 'hold')) {
      const d = dist2D(c.pos, p.pos);
      this.passTo(c, p, { snap: d < 32, lob: d >= 32 });
      this.label(c, 'ON IT', c.aura);
    }
  }
  volley(p) {
    const b = this.ball;
    const near = !b.owner && dist2D(b.pos, p.pos) < 2.5 && b.pos.y - p.pos.y < 3;
    if ((!p.onGround || b.pos.y > 1.1) && (b.owner === p || near)) {
      this.shootAt(p, aimFor(p, this), 1, { mult: 1.32, trail: p.aura, special: 'volley', keepPos: !(b.owner === p) });
      FX.sparks(b.pos.x, b.pos.y, b.pos.z, p.aura, 22, 7);
      if (this.involvesHuman(p)) Shake.add(0.35);
      return true;
    }
    if (b.owner === p && p.onGround && p.state === 'free') {
      this.jump(p);
      p.pickBlock = 0.6;
      b.vel.set(Math.sin(p.yaw) * 1.2, 7.8, Math.cos(p.yaw) * 1.2);
      p.pending = { t: 0.36, fn: () => { if (dist2D(b.pos, p.pos) < 2.8 && !b.owner) { this.shootAt(p, aimFor(p, this), 1, { mult: 1.32, trail: p.aura, special: 'volley', keepPos: true }); FX.sparks(b.pos.x, b.pos.y, b.pos.z, p.aura, 22, 7); if (this.involvesHuman(p)) Shake.add(0.35); } } };
      return true;
    }
    return NEED_BALL;
  }
  overhead(p) {
    const b = this.ball;
    const near = !b.owner && dist2D(b.pos, p.pos) < 2.8 && b.pos.y > 0.9 && b.pos.y - p.pos.y < 3.2;
    const strike = () => {
      p.flipT = 0; p.vel.y = Math.max(p.vel.y, 3); p.onGround = false;
      this.shootAt(p, aimFor(p, this), 1, { mult: 1.2, trail: p.aura, special: 'overhead', keepPos: true, keepYaw: true });
      FX.sparks(b.pos.x, b.pos.y, b.pos.z, p.aura, 26, 8);
      if (this.involvesHuman(p)) { Shake.add(0.4); TimeCtl.slowMo(0.4, 0.4); }
    };
    if (near || (b.owner === p && !p.onGround)) { if (b.owner === p) b.release(); strike(); return true; }
    if (b.owner === p && p.onGround && p.state === 'free') {
      b.release();
      b.vel.set(Math.sin(p.yaw) * 0.8, 8.6, Math.cos(p.yaw) * 0.8);
      b.kick = { by: p, type: 'flick', t: this.time };
      p.vel.y = 8.2; p.onGround = false; p.pickBlock = 0.6;
      p.pending = { t: 0.38, fn: () => { if (!b.owner && dist2D(b.pos, p.pos) < 3) strike(); } };
      Sfx.touch();
      return true;
    }
    return 'NEED A HIGH BALL';
  }
  fakeVolley(p) {
    const b = this.ball;
    if (!(b.owner === p || (!b.owner && dist2D(b.pos, p.pos) < 2.4 && b.pos.y - p.pos.y < 2.8))) return NEED_BALL;
    if (b.owner !== p) this.possess(p);
    p.kickT = 0; p.kickDur = 0.26;
    this.feint(p, 6, 0.5);
    let nearest = null, nd = 1e9;
    for (const o of this.opponents(p)) { const d = dist2D(o.pos, p.pos); if (d < nd) { nd = d; nearest = o; } }
    let rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
    if (nearest && ((nearest.pos.x - p.pos.x) * rx + (nearest.pos.z - p.pos.z) * rz) > 0) { rx = -rx; rz = -rz; }
    if (Math.abs(p.pos.x + rx * 3.5) > F.W - 1) { rx = -rx; rz = -rz; }
    const keep = p.yaw;
    p.pending = { t: 0.22, fn: () => { if (p.state === 'free' && this.ball.owner === p) { this.dashP(p, rx, rz, 15, 0.26, { onEnd: () => { p.yaw = keep; } }); p.tackleProof = 0.4; FX.feathers(p.pos.x, 0.8, p.pos.z, p.aura, 8); } } };
    return true;
  }
  updatePending(dt) {
    for (const p of this.players) {
      if (!p.pending) continue;
      p.pending.t -= dt;
      if (p.pending.t <= 0) { const f = p.pending.fn; p.pending = null; if (this.phase === 'play' && p.state !== 'down' && p.state !== 'stun' && p.state !== 'frozen') f(); }
    }
  }
  useAbility(p, i) {
    const a = p.abil[i];
    if (!a || !this.canAct(p)) return false;
    if (a.cd > 0) { if (p.isHuman) Sfx.deny(); return false; }
    const res = a.def.use(p, this);
    if (res === true) {
      a.cd = a.def.cd;
      this.label(p, a.def.name, p.aura);
      Sfx.ability();
      return true;
    }
    if (p.isHuman && typeof res === 'string') { this.toast(res, 'bad'); Sfx.deny(); }
    return false;
  }
  flowAdd(p, amt) {
    if (!p || p.flowT > 0) return;
    const before = p.flow;
    p.flow = Math.min(100, p.flow + amt);
    if (p.isHuman && before < 100 && p.flow >= 100) { this.toast(Touch.on ? 'FLOW READY. TAP FLOW' : 'FLOW READY. PRESS G', 'gold'); Sfx.coin(); Hud.flowReady(); }
  }
  activateFlow(p) {
    if (p.flow < 100 || p.flowT > 0 || !this.canAct(p)) return false;
    p.flow = 0; p.flowT = 15;
    const f = p.flowId ? FLOWS[p.flowId] : null;
    if (f && f.gamble) {
      const r = Math.random();
      p.gamble = r < 0.1 ? { speed: 1, shot: 1, stam: 1 } : pick([{ speed: 1 }, { shot: 1 }, { stam: 1 }]);
      const what = p.gamble.speed && p.gamble.shot ? 'JACKPOT' : p.gamble.speed ? 'SPEED' : p.gamble.shot ? 'POWER' : 'STAMINA';
      this.label(p, 'GAMBLE: ' + what, '#ffcb3d');
      if (p.isHuman) this.toast('GAMBLE ROLLED ' + what, 'gold');
    } else this.label(p, f ? f.name : 'FLOW', p.aura);
    p.P.eyes.visible = true;
    FX.sparks(p.pos.x, 1, p.pos.z, p.aura, 40, 8, 0.2); FX.ring(p.pos.x, 0.2, p.pos.z, p.aura, 1.4, 24);
    Sfx.flow();
    if (p.isHuman) { TimeCtl.slowMo(0.3, 0.7); Shake.add(0.25); }
    return true;
  }
  /* ---------- contacts, keepers, goals ---------- */
  separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz, R = P_R * 2;
      if (d2 >= R * R || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), push = (R - d) / 2, nx = dx / d, nz = dz / d;
      const wa = a.state === 'dash' ? 0.25 : 1, wb = b.state === 'dash' ? 0.25 : 1, ws = wa + wb;
      a.pos.x -= nx * push * 2 * wa / ws; a.pos.z -= nz * push * 2 * wa / ws;
      b.pos.x += nx * push * 2 * wb / ws; b.pos.z += nz * push * 2 * wb / ws;
    }
  }
  canPick(p) { return p.pickBlock <= 0 && (p.state === 'free' || p.state === 'dash' || (p.state === 'dive' && p.isGK)); }
  ballContacts() {
    const b = this.ball;
    if (b.owner) return;
    for (const gk of [this.teams[0][0], this.teams[1][0]]) { this.keeperContact(gk); if (b.owner) return; }
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (!this.canPick(p) || p === b.ignore) continue;
      const hd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z), relY = b.pos.y - p.pos.y;
      const sky = p.fx.skyTrap > 0;
      const reach = sky ? 1.75 : p.isHuman ? 1.0 : 0.92;
      const rv = Math.hypot(b.vel.x - p.vel.x, b.vel.y - p.vel.y, b.vel.z - p.vel.z);
      const hMax = sky ? 3.4 : rv < 22 ? 1.75 : 1.15;
      if (hd < reach && relY < hMax && relY > -0.7) {
        const meant = b.kick && b.kick.type === 'pass' && b.kick.to === p;
        if (rv > 31 && !sky && !meant) continue;
        if (hd < bd) { bd = hd; best = p; }
      }
    }
    if (best) { this.possess(best); return; }
    for (const p of this.players) {
      if (p === b.ignore) continue;
      const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, hd = Math.hypot(dx, dz), relY = b.pos.y - p.pos.y;
      const R = P_R + BALL_R;
      if (hd >= R || relY > P_H || relY < -BALL_R || p.state === 'down') continue;
      const nx = dx / (hd || 1), nz = dz / (hd || 1);
      b.pos.x = p.pos.x + nx * R; b.pos.z = p.pos.z + nz * R;
      const rvx = b.vel.x - p.vel.x, rvz = b.vel.z - p.vel.z, vn = rvx * nx + rvz * nz;
      if (vn < 0) {
        b.vel.x -= 1.45 * vn * nx; b.vel.z -= 1.45 * vn * nz;
        if (relY > 1.35) b.vel.y = Math.max(b.vel.y, 2.5);
        b.straightT = 0; b.curve.set(0, 0, 0);
        if (b.kick && b.kick.by && b.kick.by.team !== p.team && b.kick.type === 'shot' && !p.isGK) this.label(p, 'BLOCK', p.aura);
        b.touch(p);
        if (-vn > 6) Sfx.thud(0.7);
      }
    }
  }
  keeperContact(gk) {
    const b = this.ball;
    if (!this.inOwnBox(gk) || gk.state === 'down' || gk.state === 'stun' || gk.state === 'frozen' || gk.pickBlock > 0) return;
    let ax, ay, az, bx, by, bz;
    if (gk.state === 'dive' && gk.dive) {
      const d = gk.dive;
      ax = gk.pos.x - d.ux * 0.4; ay = gk.pos.y + 0.55; az = gk.pos.z - d.uz * 0.4;
      bx = gk.pos.x + d.ux * 1.45; by = gk.pos.y + (d.high ? 1.5 : 1.0); bz = gk.pos.z + d.uz * 1.45;
    } else { ax = gk.pos.x; ay = gk.pos.y + 0.2; az = gk.pos.z; bx = gk.pos.x; by = gk.pos.y + 2.25; bz = gk.pos.z; }
    const abx = bx - ax, aby = by - ay, abz = bz - az, l2 = abx * abx + aby * aby + abz * abz;
    const t = clamp(((b.pos.x - ax) * abx + (b.pos.y - ay) * aby + (b.pos.z - az) * abz) / l2, 0, 1);
    const cx = ax + abx * t, cy = ay + aby * t, cz = az + abz * t;
    const dist = Math.hypot(b.pos.x - cx, b.pos.y - cy, b.pos.z - cz);
    const reach = (gk.state === 'dive' ? 0.62 : 0.58) + (5 - this.size) * 0.1; // longer reach in small teams, where keepers face more shots
    if (dist > BALL_R + reach) return;
    const k = b.kick;
    const shooter = k && k.by && k.by.team !== gk.team && k.type === 'shot' ? k.by : null;
    const speed = b.vel.length();
    const sk = this.skill(gk);
    const catchMax = 19 + 9 * sk;
    if (shooter && !k.counted) { k.counted = true; shooter.stats.onTarget++; this.flowAdd(shooter, 15); }
    if (speed < catchMax && !(k && k.special === 'impact')) {
      this.possess(gk);
      if (shooter) { gk.stats.saves++; this.label(gk, 'SAVE', TEAM[gk.team].hex); if (shooter.isHuman) this.toast('SAVED', 'bad'); Sfx.save(); Sfx.ooh(); }
    } else {
      const s = this.dir(gk.team);
      const out = Math.max(6, speed * 0.32);
      const side = gk.state === 'dive' && gk.dive ? sgn(gk.dive.ux || rand(-1, 1)) : (b.pos.x >= gk.pos.x ? 1 : -1);
      b.vel.set(side * rand(4, 9), rand(3.5, 7), s * out);
      b.curve.set(0, 0, 0); b.straightT = 0;
      b.touch(gk); b.kick = { by: gk, type: 'clear', t: this.time };
      gk.pickBlock = 0.5;
      if (shooter) { gk.stats.saves++; this.label(gk, 'PARRY', TEAM[gk.team].hex); if (shooter.isHuman) this.toast('PARRIED', 'bad'); Sfx.save(); Sfx.ooh(); }
      if (this.involvesHuman(shooter)) Shake.add(0.2);
    }
  }
  onWoodwork() {
    const k = this.ball.kick;
    if (k && k.type === 'shot') { Sfx.ooh(); this.label(k.by, 'WOODWORK', '#eef1f4'); if (k.by && k.by.isHuman) this.toast('OFF THE POST', 'gold'); }
  }
  checkGoalAndOut() {
    const b = this.ball, r = BALL_R;
    if (b.inGoal && Math.abs(b.pos.z) > F.L + r) { this.onGoal(b.inGoal); return; }
    if (b.inGoal) return;
    const ax = Math.abs(b.pos.x), az = Math.abs(b.pos.z);
    if (ax > F.W + r || az > F.L + r) this.onOut();
  }
  onGoal(side) {
    const b = this.ball, team = side > 0 ? 0 : 1, k = b.kick;
    this.score[team]++;
    this.phase = 'goal'; this.phaseT = 0;
    let scorer = b.lastKicker && b.lastKicker.team === team ? b.lastKicker : (b.lastTouch && b.lastTouch.team === team ? b.lastTouch : null);
    const own = !scorer;
    let assister = null;
    if (scorer) {
      scorer.stats.goals++;
      if (k && k.by === scorer && k.type === 'shot' && !k.counted) { k.counted = true; scorer.stats.onTarget++; }
      const lp = this.lastPass;
      if (lp && lp.to === scorer && lp.from.team === team && lp.from !== scorer && this.time - lp.t < 14) { assister = lp.from; assister.stats.assists++; this.flowAdd(assister, 15); }
      this.flowAdd(scorer, 35);
      scorer.setState('celebrate', 3.2); scorer.charging = false;
    }
    this.lastGoal = { team, scorer, assister, own };
    if (this.golden) this.pendingEnd = true;
    b.owner = null; b.kick = null;
    TimeCtl.slowMo(0.3, 1.5);
    Shake.add(0.55);
    Sfx.roar(1); Sfx.whistle(1);
    World.excite[team] = 1;
    const ez = side * (F.L + 6);
    const hexes = [TEAM[team].hex, '#ffffff', scorer ? scorer.aura : '#ffcb3d'];
    for (let i = 0; i < 6; i++) FX.rocket(rand(-10, 10), ez + side * rand(0, 6), hexes, 0.15 + i * 0.28);
    FX.sparks(b.pos.x, b.pos.y, b.pos.z, TEAM[team].hex, 40, 9, 0.28);
    Hud.goal(team, scorer, assister, own);
    for (const p of this.players) { p.charging = false; p.pending = null; p.ai.wantShot = null; if (p.state === 'windup') p.setState('free'); }
  }
  onOut() {
    const b = this.ball;
    const last = b.lastTeam < 0 ? (b.pos.z > 0 ? 0 : 1) : b.lastTeam;
    const award = 1 - last;
    let rs;
    const az = Math.abs(b.pos.z), sx = sgn(b.pos.x), sz = sgn(b.pos.z);
    if (az > F.L + BALL_R) {
      const defending = sz > 0 ? 1 : 0;
      if (award === defending) rs = { type: 'GOAL KICK', team: award, x: 0, z: sz * (F.L - 3.2) };
      else rs = { type: 'CORNER', team: award, x: sx * (F.W - 0.7), z: sz * (F.L - 0.7) };
    } else rs = { type: 'KICK-IN', team: award, x: sx * (F.W - 0.7), z: clamp(b.pos.z, -F.L + 1.5, F.L - 1.5) };
    this.restart = rs;
    this.phase = 'out'; this.phaseT = 0;
    if (b.owner) { const o = b.owner; b.release(); o.pickBlock = 0.4; }
    b.kick = null;
    for (const p of this.players) { p.charging = false; p.ai.wantShot = null; p.pending = null; if (p.state === 'windup') p.setState('free'); }
    Sfx.whistle(1);
    Hud.banner(rs.type, TEAM[rs.team].name + ' BALL', TEAM[rs.team].hex, true);
  }
  doRestart() {
    const rs = this.restart; if (!rs) return;
    this.restart = null;
    const b = this.ball;
    b.reset(rs.x, rs.z);
    this.phase = 'play'; this.phaseT = 0;
    if (rs.type === 'GOAL KICK') {
      const gk = this.teams[rs.team][0];
      gk.pos.set(0, 0, rs.z - sgn(rs.z) * 0.3); gk.vel.set(0, 0, 0); gk.setState('free'); gk.dive = null;
      gk.yaw = sgn(rs.z) > 0 ? Math.PI : 0;
      this.possess(gk, true);
    } else {
      let taker = null, bd = 1e9;
      for (const p of this.teams[rs.team]) { if (p.isGK) continue; const d = Math.hypot(p.pos.x - rs.x, p.pos.z - rs.z); if (d < bd) { bd = d; taker = p; } }
      const inX = -sgn(rs.x) * (Math.abs(rs.x) > F.W - 2 ? 1 : 0), inZ = rs.type === 'CORNER' ? -sgn(rs.z) : 0;
      const il = len2D(inX, inZ) || 1;
      taker.pos.set(rs.x - inX / il * 0.6, 0, rs.z - inZ / il * 0.6); taker.vel.set(0, 0, 0);
      taker.dash = taker.slide = null; taker.setState('free');
      taker.yaw = Math.atan2(-rs.x * 0.6, -rs.z * 0.25 + (rs.type === 'CORNER' ? -sgn(rs.z) * 4 : this.dir(taker.team) * 2));
      this.possess(taker, true);
      taker.protect = 1.0;
      for (const o of this.teams[1 - rs.team]) {
        const dx = o.pos.x - rs.x, dz = o.pos.z - rs.z, d = Math.hypot(dx, dz);
        if (d < 5) { const k = 5 / (d || 1); o.pos.x = rs.x + (d ? dx : 1) * k; o.pos.z = rs.z + (d ? dz : 0) * k; }
      }
    }
    Sfx.whistle(1);
  }
  /* ---------- Lawless: items, projectiles, hazards ---------- */
  updateItems(dt) {
    if (this.phase === 'play') {
      this.itemSpawnT -= dt;
      if (this.itemSpawnT <= 0 && this.items.length < 3) {
        this.itemSpawnT = rand(5, 8);
        const x = rand(-16, 16) * PITCH_KX, z = rand(-24, 24) * PITCH_KZ;
        const mesh = new THREE.Mesh(PlayerGeo.get().cube, new THREE.MeshLambertMaterial({ map: World.T.itemBox, emissive: lin('#5a3a00'), emissiveIntensity: 0.6 }));
        mesh.scale.set(0.8, 0.8, 0.8); mesh.castShadow = true;
        this.scene.add(mesh);
        this.items.push({ x, z, t: 0, mesh });
        FX.sparks(x, 1, z, '#ffcb3d', 12, 4);
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      it.mesh.position.set(it.x, 1.0 + Math.sin(it.t * 3) * 0.15, it.z); it.mesh.rotation.y += dt * 1.6; it.mesh.rotation.x = 0.3;
      if (this.phase !== 'play') continue;
      for (const p of this.players) {
        if (p.item || p.isGK || p.state === 'down') continue;
        if (Math.hypot(p.pos.x - it.x, p.pos.z - it.z) < 1.2 && p.pos.y < 2) {
          p.item = pick(ITEM_IDS);
          this.drop(it.mesh); this.items.splice(i, 1);
          FX.sparks(it.x, 1, it.z, '#ffcb3d', 16, 5);
          Sfx.pickup();
          this.label(p, ITEMS[p.item].name, '#ffcb3d');
          break;
        }
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.updateProjectile(this.projectiles[i], dt)) { this.drop(this.projectiles[i].mesh); this.projectiles.splice(i, 1); }
    for (let i = this.hazards.length - 1; i >= 0; i--) if (this.updateHazard(this.hazards[i], dt)) { this.drop(this.hazards[i].mesh, this.hazards[i].type === 'wall'); this.hazards.splice(i, 1); }
  }
  useItem(p) {
    if (!p.item || !this.canAct(p)) return false;
    const it = ITEMS[p.item];
    if (it.use(p, this)) { this.label(p, it.name, '#ffcb3d'); p.item = null; Sfx.zap(); return true; }
    return false;
  }
  fireProjectile(p, type) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let dx = p.isHuman ? Math.sin(this.camYaw) : fx, dz = p.isHuman ? Math.cos(this.camYaw) : fz;
    let target = null;
    if (type === 'fist' || type === 'snow') {
      let bd = 1e9;
      for (const o of this.opponents(p)) {
        const ox = o.pos.x - p.pos.x, oz = o.pos.z - p.pos.z, d = Math.hypot(ox, oz);
        if (d > 22 || o.state === 'down' || o.state === 'frozen') continue;
        const ang = Math.acos(clamp((ox * dx + oz * dz) / (d || 1), -1, 1));
        if (ang > 0.75) continue;
        const sc = d + ang * 8 - (this.ball.owner === o ? 4 : 0);
        if (sc < bd) { bd = sc; target = o; }
      }
      if (target) { const ox = target.pos.x - p.pos.x, oz = target.pos.z - p.pos.z, d = Math.hypot(ox, oz) || 1; dx = ox / d; dz = oz / d; }
    }
    const mat = type === 'boom' ? new THREE.MeshLambertMaterial({ map: World.T.boom }) : type === 'snow' ? new THREE.MeshLambertMaterial({ color: lin('#f4fbff') }) : new THREE.MeshLambertMaterial({ color: lin('#e0302a'), emissive: lin('#5a0000') });
    const mesh = new THREE.Mesh(PlayerGeo.get().cube, mat);
    const sz = type === 'boom' ? 0.7 : type === 'snow' ? 0.36 : 0.55; mesh.scale.set(sz, sz, sz); mesh.castShadow = true;
    this.scene.add(mesh);
    const pr = { type, owner: p, target, t: 0, mesh, pos: V3(p.pos.x + dx * 0.8, 1.3, p.pos.z + dz * 0.8), vel: V3() };
    if (type === 'boom') {
      const aimD = p.isHuman ? clamp(dist2D(this.aim, p.pos), 6, 16) : clamp(dist2D(this.ball.pos, p.pos), 5, 14);
      const T = 0.85; pr.vel.set(dx * aimD / T, (0 - 1.3 + 0.5 * GRAV * T * T) / T, dz * aimD / T); pr.fuse = 1.25;
    } else { const sp = type === 'snow' ? 30 : 24; pr.vel.set(dx * sp, 0, dz * sp); }
    this.projectiles.push(pr);
    p.kickT = 0; p.kickDur = 0.25;
    Sfx.swoosh();
    return true;
  }
  updateProjectile(pr, dt) {
    pr.t += dt;
    if (pr.type === 'boom') {
      pr.vel.y -= GRAV * dt; pr.pos.addScaledVector(pr.vel, dt);
      if (pr.pos.y < 0.35) { pr.pos.y = 0.35; pr.vel.set(pr.vel.x * 0.3, Math.abs(pr.vel.y) * 0.25, pr.vel.z * 0.3); }
      pr.fuse -= dt;
      pr.mesh.position.copy(pr.pos); pr.mesh.rotation.x += dt * 6; pr.mesh.rotation.z += dt * 4;
      const blink = Math.sin(pr.t * (8 + pr.t * 20)) > 0;
      pr.mesh.material.emissive = blink ? lin('#ffffff') : lin('#000000'); pr.mesh.material.emissiveIntensity = blink ? 0.6 : 0;
      if (pr.fuse <= 0) { this.explode(pr.pos.x, pr.pos.z, 5.2, pr.owner); return true; }
      return false;
    }
    if (pr.target && pr.type === 'fist' && pr.target.state !== 'down') {
      const tx = pr.target.pos.x - pr.pos.x, tz = pr.target.pos.z - pr.pos.z, l = Math.hypot(tx, tz) || 1;
      const sp = pr.vel.length();
      pr.vel.x = lerp(pr.vel.x, tx / l * sp, 1 - Math.exp(-5 * dt)); pr.vel.z = lerp(pr.vel.z, tz / l * sp, 1 - Math.exp(-5 * dt));
    }
    pr.pos.addScaledVector(pr.vel, dt);
    pr.mesh.position.copy(pr.pos); pr.mesh.rotation.y = Math.atan2(pr.vel.x, pr.vel.z);
    FX.trail(pr.pos.x, pr.pos.y, pr.pos.z, pr.type === 'snow' ? '#bfeaff' : '#ff6a3c', 0.16, 0.25);
    for (const o of this.opponents(pr.owner)) {
      if (o.state === 'down' || o.state === 'frozen') continue;
      if (Math.hypot(o.pos.x - pr.pos.x, o.pos.z - pr.pos.z) < 0.85 && pr.pos.y > o.pos.y && pr.pos.y < o.pos.y + 2.1) {
        const l = len2D(pr.vel.x, pr.vel.z) || 1, dx = pr.vel.x / l, dz = pr.vel.z / l;
        if (o.fx.bubble > 0) { FX.sparks(pr.pos.x, pr.pos.y, pr.pos.z, '#8fd8ff', 12, 4); Sfx.boing(); return true; }
        if (pr.type === 'snow') {
          if (this.ball.owner === o) { const b = this.ball; b.release(); b.vel.set(dx * 3, 2, dz * 3); b.kick = { by: pr.owner, type: 'loose' }; o.pickBlock = 2; }
          this.stun(o, 2, 'frozen'); Sfx.freeze(); FX.sparks(o.pos.x, 1, o.pos.z, '#bfeaff', 20, 5);
        } else {
          this.knockDown(o, 1.8, dx, dz, 9, pr.owner); Sfx.punch(); FX.sparks(o.pos.x, 1.2, o.pos.z, '#ff6a3c', 16, 6);
          if (this.involvesHuman(o, pr.owner)) { Shake.add(0.35); TimeCtl.hitStop(0.06); }
        }
        if (o.isHuman) this.toast(pr.type === 'snow' ? 'FROZEN' : 'KNOCKED OUT', 'bad');
        return true;
      }
    }
    return pr.t > 1.1 || Math.abs(pr.pos.x) > F.BOARD_X || Math.abs(pr.pos.z) > F.BOARD_Z;
  }
  explode(x, z, r, owner) {
    FX.explosion(x, 0.3, z); Sfx.boom(); Shake.add(0.6);
    for (const p of this.players) {
      const dx = p.pos.x - x, dz = p.pos.z - z, d = Math.hypot(dx, dz);
      if (d > r || p.fx.bubble > 0) continue;
      const l = d || 1;
      this.knockDown(p, 1.4, dx / l, dz / l, 9 * (1 - d / r) + 3, owner);
      p.vel.y = 7; p.onGround = false;
    }
    const b = this.ball, bd = Math.hypot(b.pos.x - x, b.pos.z - z);
    if (bd < r + 1) {
      if (b.owner) { b.owner.pickBlock = 0.6; b.release(); }
      const l = bd || 1;
      b.vel.set((b.pos.x - x) / l * 14, 9, (b.pos.z - z) / l * 14);
      b.kick = { by: owner, type: 'loose', t: this.time };
    }
  }
  dropHazard(p, type) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    if (type === 'slime') {
      const mesh = new THREE.Mesh(PlayerGeo.get().cube, new THREE.MeshLambertMaterial({ map: World.T.slime, transparent: true, opacity: 0.85 }));
      const x = p.pos.x - fx * 1.4, z = p.pos.z - fz * 1.4;
      mesh.scale.set(4.8, 0.06, 4.8); mesh.position.set(x, 0.04, z); this.scene.add(mesh);
      this.hazards.push({ type, x, z, r: 2.4, t: 8, team: p.team, mesh });
    } else if (type === 'wall') {
      const x = p.pos.x + fx * 2.2, z = p.pos.z + fz * 2.2;
      const vb = new VoxBuilder(); vb.box(-2, 0, -0.5, 2, 2, 0.5, '#ffffff', { uv: 1 });
      const mesh = vb.mesh(new THREE.MeshLambertMaterial({ map: World.T.stoneBrick, vertexColors: true }));
      mesh.position.set(x, -2, z); mesh.rotation.y = p.yaw; mesh.castShadow = true; this.scene.add(mesh);
      this.hazards.push({ type, x, z, yaw: p.yaw, t: 6, rise: 0, mesh });
      FX.shatter(x, 0.2, z, 12);
    } else if (type === 'mine') {
      const mesh = new THREE.Mesh(PlayerGeo.get().cube, new THREE.MeshLambertMaterial({ color: lin('#2a2d38'), emissive: lin('#ff1a1a'), emissiveIntensity: 0 }));
      mesh.scale.set(0.6, 0.18, 0.6); mesh.position.set(p.pos.x, 0.09, p.pos.z); this.scene.add(mesh);
      this.hazards.push({ type, x: p.pos.x, z: p.pos.z, t: 20, arm: 0.8, team: p.team, mesh });
    }
    Sfx.thud(0.8);
    return true;
  }
  updateHazard(h, dt) {
    h.t -= dt;
    if (h.type === 'slime') {
      for (const p of this.players) {
        if (p.team === h.team || !p.onGround || p.state !== 'free' || p.fx.bubble > 0 || (p.fx.slipCd > 0)) continue;
        if (Math.hypot(p.pos.x - h.x, p.pos.z - h.z) < h.r) {
          p.fx.slipCd = 2.2;
          const l = len2D(p.vel.x, p.vel.z) || 1;
          this.knockDown(p, 1.0, p.vel.x / l, p.vel.z / l, 6);
          p.fallDir = -1; Sfx.boing();
          FX.sparks(p.pos.x, 0.3, p.pos.z, '#4cd13f', 10, 3);
        }
      }
      if (h.t < 1) h.mesh.material.opacity = 0.85 * h.t;
    } else if (h.type === 'wall') {
      h.rise = Math.min(1, h.rise + dt * 6);
      h.mesh.position.y = lerp(-2, 0, h.rise) - (h.t < 0.4 ? (0.4 - h.t) * 5 : 0);
      const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
      const toLocal = (x, z) => { const dx = x - h.x, dz = z - h.z; return { lx: dx * c - dz * s, lz: dx * s + dz * c }; };
      const toWorld = (lx, lz) => ({ x: h.x + lx * c + lz * s, z: h.z - lx * s + lz * c });
      for (const p of this.players) {
        if (p.pos.y > 2) continue;
        const L = toLocal(p.pos.x, p.pos.z), hw = 2 + P_R, hd = 0.5 + P_R;
        if (Math.abs(L.lx) < hw && Math.abs(L.lz) < hd) {
          const px = hw - Math.abs(L.lx), pz = hd - Math.abs(L.lz);
          if (pz < px) L.lz = sgn(L.lz) * hd; else L.lx = sgn(L.lx) * hw;
          const W = toWorld(L.lx, L.lz); p.pos.x = W.x; p.pos.z = W.z;
        }
      }
      const b = this.ball;
      if (!b.owner && b.pos.y < 2 + BALL_R) {
        const L = toLocal(b.pos.x, b.pos.z), hw = 2 + BALL_R, hd = 0.5 + BALL_R;
        if (Math.abs(L.lx) < hw && Math.abs(L.lz) < hd) {
          const px = hw - Math.abs(L.lx), pz = hd - Math.abs(L.lz);
          const vl = { lx: b.vel.x * c - b.vel.z * s, lz: b.vel.x * s + b.vel.z * c };
          if (pz < px) { L.lz = sgn(L.lz) * hd; vl.lz = -vl.lz * 0.6; } else { L.lx = sgn(L.lx) * hw; vl.lx = -vl.lx * 0.6; }
          const W = toWorld(L.lx, L.lz); b.pos.x = W.x; b.pos.z = W.z;
          b.vel.x = vl.lx * c + vl.lz * s; b.vel.z = -vl.lx * s + vl.lz * c;
          b.curve.set(0, 0, 0); b.straightT = 0;
          Sfx.thud(0.7);
        }
      }
    } else if (h.type === 'mine') {
      h.arm -= dt;
      h.mesh.material.emissiveIntensity = h.arm > 0 ? 0 : (Math.sin(h.t * 10) > 0 ? 1.4 : 0.1);
      if (h.arm <= 0) {
        for (const p of this.players) {
          if (p.team === h.team || p.fx.bubble > 0 || p.pos.y > 1) continue;
          if (Math.hypot(p.pos.x - h.x, p.pos.z - h.z) < 1.1) {
            this.knockDown(p, 1.6, rand(-1, 1), rand(-1, 1), 2);
            p.vel.y = 12; p.onGround = false;
            FX.explosion(h.x, 0.1, h.z); Sfx.boom(); Shake.add(0.4);
            if (p.isHuman) this.toast('LANDMINE', 'bad');
            return true;
          }
        }
      }
    }
    return h.t <= 0;
  }
  updateMagnets(dt) {
    const b = this.ball;
    for (const p of this.players) {
      if (!(p.fx.magnet > 0)) continue;
      if (Math.random() < 0.6) FX.trail(lerp(p.pos.x, b.pos.x, Math.random()), lerp(1, b.pos.y, Math.random()), lerp(p.pos.z, b.pos.z, Math.random()), '#ff4d5e', 0.12, 0.25);
      if (b.owner && b.owner.team !== p.team && dist2D(b.owner.pos, p.pos) < 7.5 && !(b.owner.fx.bubble > 0) && !(b.owner.isGK && b.owner.state === 'hold')) {
        const o = b.owner; b.release(); o.pickBlock = 0.8;
        const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z, l = len2D(dx, dz) || 1;
        b.vel.set(dx / l * 12, 3, dz / l * 12); b.kick = { by: p, type: 'loose', t: this.time };
        this.label(o, 'YANKED', '#ff4d5e');
      } else if (!b.owner) {
        const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z, l = len2D(dx, dz);
        if (l < 13 && l > 0.5) { b.vel.x += dx / l * 34 * dt; b.vel.z += dz / l * 34 * dt; const hs = len2D(b.vel.x, b.vel.z); if (hs > 16) { b.vel.x *= 16 / hs; b.vel.z *= 16 / hs; } }
      }
    }
  }
  /* ---------- per-frame visual effects ---------- */
  updateFx(dt) {
    for (const p of this.players) {
      if (p.flowT > 0) FX.aura(p, p.aura, dt);
      if (p.fx.turbo > 0 && p.onGround && len2D(p.vel.x, p.vel.z) > 6 && Math.random() < 0.7) FX.dust(p.pos.x, p.pos.z, 1);
      if (p.fx.feathers > 0 && Math.random() < 0.8) FX.feathers(p.pos.x, p.pos.y + 0.4, p.pos.z, '#121018', 1);
      if (p.fx.shuffle > 0 && Math.random() < 0.4) FX.trail(p.pos.x + rand(-0.5, 0.5), rand(0.4, 1.6), p.pos.z + rand(-0.5, 0.5), p.aura, 0.12, 0.4);
      if (p.fx.jetpack > 0 && Math.random() < 0.9) { FX.trail(p.pos.x - Math.sin(p.yaw) * 0.3, p.pos.y + 0.6, p.pos.z - Math.cos(p.yaw) * 0.3, '#ffb02e', 0.2, 0.3); }
      if (p.fx.supercharge > 0 && Math.random() < 0.5) FX.trail(p.pos.x, p.pos.y + rand(0.2, 1.6), p.pos.z, '#ffd23d', 0.1, 0.3);
      if (p.fx.skyTrap > 0 && Math.random() < 0.3) FX.trail(p.pos.x + rand(-0.4, 0.4), 0.15, p.pos.z + rand(-0.4, 0.4), p.aura, 0.12, 0.4);
      if (p.state === 'dash' && Math.random() < 0.6) FX.dust(p.pos.x, p.pos.z, 1);
    }
    const h = this.human;
    if (h && h.fx.vision > 0 && this.phase === 'play') {
      FX.pathBegin();
      const a = V3(h.pos.x, 0.35, h.pos.z);
      for (const t of this.teams[h.team]) {
        if (t === h || t.isGK) continue;
        let open = 99; for (const o of this.opponents(h)) open = Math.min(open, dist2D(o.pos, t.pos));
        let blocked = false; for (const o of this.opponents(h)) { const sd = segDist2D(o.pos, h.pos, t.pos); if (sd.t > 0.1 && sd.t < 0.95 && sd.d < 1.4) blocked = true; }
        if (open > 3.2 && !blocked) FX.pathLine(a, V3(t.pos.x, 0.35, t.pos.z), '#4dff9a', 1.1, this.time);
      }
      const tgt = AI.bestShotPoint(this, h);
      FX.pathLine(V3(this.ball.pos.x, Math.max(0.35, this.ball.pos.y), this.ball.pos.z), tgt, '#ffd23d', 1.0, this.time);
      FX.pathEnd();
    } else if (FX.paths.count) { FX.paths.count = 0; }
  }
}
