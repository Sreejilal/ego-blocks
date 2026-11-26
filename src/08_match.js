/* =====================================================================
   Match: rules, possession, kicking, tackling, abilities, goals,
   restarts, Flow, Lawless items
   ===================================================================== */
const Hud = { toast() {}, label() {}, banner() {}, goal() {}, flowReady() {}, cutin() {}, freeKick() {}, awaken() {}, lightning() {}, steal() {}, bomb() {}, switched() {} }; // filled in by the UI
const BOT_NAMES = ['BLOK', 'CUBO', 'PIXL', 'VOXX', 'CHUNK', 'BRIK', 'TILE', 'STAK', 'OBBY', 'GRAV', 'LOAM', 'SLAB', 'COBB', 'FLINT', 'QUARTZ', 'MOSS', 'DUSK', 'EMBR', 'RUNE', 'KRYS', 'BYTE', 'NOVA', 'REDS', 'TUFF'];
const MODES = {
  // rewards: offline, only these full-time matches give rewards (online with friends, every mode does)
  ranked: { name: 'RANKED', ranked: true, items: false, rewards: true },
  quick: { name: 'QUICK MATCH', ranked: false, items: false, rewards: true }, // 4v4: keeper, defender, midfielder, striker (owner: a midfielder that played up front like a striker was confusing)
  lawless: { name: 'LAWLESS', ranked: false, items: true, rewards: true },
  koth: { name: 'KING OF THE HILL', ranked: false, items: false, hill: true, tip: 'HOLD THE BALL IN THE RING FOR POINTS \u00b7 GOALS ARE WORTH 3' },
  volleys: { name: 'VOLLEYS ONLY', ranked: false, items: false, aerialOnly: true, tip: 'ONLY VOLLEYS AND HEADERS COUNT' },
  // more ways to play with friends (owner, Nov 2026); they also work against bots from MORE MODES
  golden: { name: 'GOLDEN GOAL', ranked: false, items: false, firstTo: 1, tip: 'NEXT GOAL WINS' },
  nokeep: { name: 'NO KEEPERS', ranked: false, items: false, noKeeper: true, tip: 'NO KEEPERS · SHOOT FROM ANYWHERE' },
  turbo: { name: 'TURBO', ranked: false, items: false, speed: 1.25, tip: 'EVERYTHING IS FASTER' },
  moon: { name: 'MOON BALL', ranked: false, items: false, ballG: 6.5, tip: 'THE BALL FLOATS · JUMP FOR IT' },
  // Nov 2026 (owner: "a gamemode where the goalpost is the entire field"; and one from the new trends: the steal games)
  mega: { name: 'MEGA GOAL', ranked: false, items: false, goalW: F.W - F.POST, tip: 'THE GOAL IS AS WIDE AS THE PITCH' },
  chaos: { name: 'CHAOS', ranked: false, items: false, chaos: true, tip: 'THE RULES CHANGE EVERY 25 SECONDS' },
  bomb: { name: 'BOMB BALL', ranked: false, items: false, bomb: true, tip: 'THE BALL IS A BOMB · IF IT GOES OFF IN YOUR HALF, THEY SCORE' },
  drillrun: { name: 'SPRINT DRILL', ranked: false, items: false, drill: 'run' },
  drilldef: { name: 'DEFENDING DRILL', ranked: false, items: false, drill: 'def' },
  tiny: { name: 'TINY GOALS', ranked: false, items: false, goalW: 1.5, goalH: 1.75, noKeeper: true, tip: 'TINY GOALS AND NO KEEPERS · AIM CAREFULLY' },
  heist: { name: 'OMEGA CORES', ranked: false, items: false, heist: true, tip: 'SCORE TO TAKE THEIR BEST CORE AND ITS POWER · WIN AND YOU SNAP THEM AWAY' },
  duel: { name: '1V1 DUEL', ranked: false, items: false, firstTo: 3, tip: 'FIRST TO 3 GOALS' },
  freekick: { name: 'FREE KICKS', ranked: false, items: false, practice: true },
  fkkeeper: { name: 'KEEPER PRACTICE', ranked: false, items: false, practice: true, keeper: true }, // owner: you in goal for their free kicks
  tutorial: { name: 'TUTORIAL', ranked: false, items: false, tutorial: true },
};
// kickoff spots on the first pitch's scale (see PITCH_KX / PITCH_KZ)
const FORM = { GK: [0, -31.0], DEF: [0, -18], DEF2: [-8, -17], MID: [7, -9], LW: [11, -7], RW: [-11, -7], ST: [0, -2.2], FW: [-7, -4] };
const MATCH_LEN = 240, GOLDEN_LEN = 45; // owner: a tighter golden goal ("gives you that stress"), then a free kick battle: no draws
const INTRO_FLY = 4, INTRO_AUTO = 10; // the match intro: the camera flight (s), and when the kickoff starts by itself if nobody presses PLAY

class Match {
  constructor(mode, d, opts = {}) {
    this.mode = mode; this.cfg = MODES[mode] || MODES.quick; this.d = d;
    this.tier = opts.tier != null ? opts.tier : tierOf(Save.data.rp);
    this.size = ROSTERS[opts.size] ? opts.size : teamSizeFor(mode, Save.data.rp);
    this.scene = World.scene;
    World.setGoal(this.cfg.goalW, this.cfg.goalH); // MEGA GOAL: the whole width of the pitch (set again every step)
    this.time = 0; this.clock = this.len = opts.length || MATCH_LEN; this.golden = false; this.goldenLen = opts.goldenLength || GOLDEN_LEN; this.goldenClock = this.goldenLen;
    this.phase = 'kickoff'; this.phaseT = 0; this.paused = false; this.kickDelay = 2.6;
    this.score = [0, 0]; this.players = []; this.teams = [[], []];
    this.ball = new Ball(this);
    this.items = []; this.projectiles = []; this.hazards = []; this.itemSpawnT = 5;
    this.lastPass = null; this.restart = null; this.result = null; this.endTimer = 0;
    this.teamState = ['loose', 'loose']; this.pred = [];
    this.aim = V3(0, 1, F.L); this.camYaw = 0; this.aimOnTarget = false;
    this.ctl = null; this.autopilot = !!opts.autopilot; this.thinkPass = opts.thinkPass !== false;
    this.online = !!opts.humans; this.humans = []; // online: every remote player, each with their own controls (p.ctl)
    this.feats = { curler: 0, volley: 0, longShot: 0, ankles: 0, awakens: 0, trailed: false }; // your moments, for the weekly challenges
    this.lastGoal = null; this.pendingEnd = false;
    this.story = opts.story || null; this.myGoals = 0;
    this.bench = opts.squad && Array.isArray(opts.squad.bench) ? opts.squad.bench.filter((id) => STYLES[id]) : []; this.subsLeft = SUBS_MAX; // MY TEAM: subs from the bench // STORY: the event being played, and the goals you scored (whoever you controlled)
    // your club at home against a random other club; the away side changes kit if the colours clash
    const home = opts.home || (opts.noHuman ? pick(CLUB_IDS) : Save.data.club);
    const away = opts.away || pick(CLUB_IDS.filter((c) => c !== home));
    [TEAM[0], TEAM[1]] = matchSides(home, away);
    if (this.cfg.hill) this.buildHill();
    if (this.cfg.heist) this.buildHeist();
    if (this.cfg.chaos) this.chaos = { on: null, t: CHAOS_FIRST, last: null };
    if (this.cfg.bomb) this.bomb = { t: BOMB_FUSE };
    this.buildTeams(opts);
    // whose PASS calls make teammates look up (the human; in a test match, a bot striker that calls like a human)
    this.caller = opts.caller ? this.teams[0].find((p) => p.role === leadRole(this.rolesFor(0))) : this.autopilot ? null : this.human;
    if (this.cfg.practice && this.human) this.startFreeKicks(); else if (this.cfg.tutorial && this.human) this.startTutorial(); else if (this.cfg.drill && this.human) this.startDrill(); else this.setupKickoff(0, true, !!opts.intro); // the intro (Game.beginIntro): no kickoff banner until it is over
  }
  /* ---------- setup ---------- */
  /** a team's line-up (opts.setups to choose). 5v5: ultra defensive, ultra attacking or wide; 4v4: classic or wide (a left
      winger instead of the midfielder). Your team plays wide when you start on a wing (a winger: Match option role) */
  pickSetups(opts) {
    const wing = opts.role === 'LW' || opts.role === 'RW';
    if (this.size === 5) return [0, 1].map((t) => (t === 0 && wing && !opts.humans ? 'wide' : t === 0 && !opts.humans ? pick(['defensive', 'attacking']) : pick(['defensive', 'attacking', 'wide'])));
    if (this.size === 4) return [0, 1].map((t) => (t === 0 && !opts.humans ? (wing ? 'wide' : 'classic') : Math.random() < 0.3 ? 'wide' : 'classic'));
    return [null, null];
  }
  setupOf(team) { const S = this.size === 5 ? SETUPS_5 : this.size === 4 ? SETUPS_4 : null; return S && S[this.setups[team]] || null; }
  rolesFor(team) {
    if (this.cfg.practice && this.cfg.keeper) return team === 0 ? ['GK', 'DEF', 'DEF2'] : ['GK', 'ST', 'MID']; // keeper practice: you in goal with two in your wall, their taker
    if (this.cfg.practice) return team === 0 ? ['ST'] : ['GK', 'DEF', 'DEF2', 'MID', 'ST']; // free kicks: you against a keeper, a wall and defenders in the box
    if (this.cfg.tutorial) return team === 0 ? ['ST', 'MID'] : ['DEF']; // the tutorial: you, a teammate and one defender (an empty goal)
    if (this.cfg.drill === 'run') return team === 0 ? ['ST'] : ['GK']; // TRAINING: the sprint drill, you alone (their keeper just stands there)
    if (this.cfg.drill === 'def') return team === 0 ? ['GK', 'DEF'] : ['ST', 'MID']; // the defending drill: you and your keeper against two attackers
    if (this.cfg.roster && this.cfg.roster.length === this.size) return this.cfg.roster; // a mode's own line-up (Quick Match: a winger)
    const S = this.setupOf(team);
    return S ? S.roles : ROSTERS[this.size];
  }
  buildTeams(opts) {
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const used = new Set([1, 10]);
    this.setups = opts.setups || this.pickSetups(opts);
    // online: each player takes an outfield role on their team, striker first
    const seat = {};
    if (opts.humans) for (const t of [0, 1]) {
      const order = this.rolesFor(t).filter((r) => r !== 'GK').sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
      opts.humans.filter((h) => h.team === t).slice(0, order.length).forEach((h, i) => { seat[t + order[i]] = h; });
    }
    for (let team = 0; team < 2; team++) {
      const roles = this.rolesFor(team), lead = leadRole(roles);
      const mine = this.cfg.keeper ? 'GK' : team === 0 && opts.role && !this.cfg.tutorial && !this.cfg.practice && !this.cfg.drill && roles.includes(opts.role) && !(opts.role === 'GK' && this.cfg.noKeeper) ? opts.role : lead; // the position you picked last time (in goal too), when this line-up has it; keeper practice: in goal
      for (const role of roles) {
        if (this.cfg.noKeeper && role === 'GK') continue; // No Keepers: open goals
        const net = opts.humans ? seat[team + role] : null;
        // online with bots off: only the friends play ('keepers': computer keepers stay, 'none': no keepers either)
        if (opts.humans && !net && opts.bots && opts.bots !== 'fill' && !(role === 'GK' && opts.bots === 'keepers')) continue;
        const human = opts.humans ? !!net : team === 0 && role === mine && !opts.noHuman; // you play the most attacking spot, or the one you picked
        let num = role === 'GK' ? 1 : human && !net ? 10 : 0;
        if (!num) { do num = randi(2, 99); while (used.has(num)); used.add(num); }
        const sq = !net && !human && team === 0 && opts.squad && opts.squad[SQUAD_OF[role]]; // STORY: the character you picked for this spot
        const style = net ? net.style : human ? (opts.style || Save.data.style) : sq && STYLES[sq] ? sq : opts.teamStyle ? opts.teamStyle[team] : botStyle(role); // teamStyle: [home, away] for balance tests; bots mostly play a character made for their spot
        const flow = net ? net.flow : human ? (opts.flow !== undefined ? opts.flow : Save.data.flow) : (chance(0.85) ? pick(FLOW_IDS) : null);
        const look = net ? net.look : human ? (opts.look || Save.data.look) : botLook();
        const tone = net ? net.tone : Save.data.tone;
        const p = new Player(this, { team, role, human, style, flow, look, skin: human ? SKIN_TONES[Number.isInteger(tone) ? tone : 1] || SKIN_TONES[1] : null, number: num, name: net ? net.name : human ? 'YOU' : names.pop() });
        if (!human && (team === 1 || opts.teamD)) { // bots are a little quicker and fitter with skill (both teams when each has its own skill)
          const sk = opts.teamD ? opts.teamD[team] : this.d;
          p.speedMul = 1 + 0.045 * sk; p.fit = 1.1 - 0.25 * sk;
        }
        this.players.push(p); this.teams[team].push(p);
        if (net) { p.netId = net.id; this.humans.push(p); } else if (human) this.human = p;
      }
    }
    if (!this.human) this.human = null;
    // bot skill for each side: your teammates are never hopeless; a test can set both (e.g. Wood vs Obsidian)
    this.teamD = opts.teamD || (this.human ? [Math.max(0.55, this.d), this.d] : [this.d, this.d]);
  }
  /** online: a friend arriving mid-match takes over a bot on `net.team` (never a keeper). The same player object stays
      (passes, restarts and marking keep pointing at it); only who controls it, the style, the look and the name change */
  joinLive(net) {
    const p = this.teams[net.team].find((q) => !q.isGK && !q.netId && !q.isHuman);
    if (!p) return null;
    const tone = Number.isInteger(net.tone) ? net.tone : 1;
    p.styleId = STYLES[net.style] ? net.style : 'ROOKIE'; p.style = STYLES[p.styleId]; p.flowId = net.flow || null;
    p.lookIds = net.look || {}; p.skin = SKIN_TONES[tone] || SKIN_TONES[1]; p.look = lookFor(p.styleId, p.lookIds); p.look.skin = p.skin;
    p.name = net.name; p.abil = p.style.abilities.map((id) => ({ id, def: ABILITIES[id], cd: 0 }));
    p.speedMul = 1; p.fit = 1; p.flow = 0; p.flowT = 0; p.awake = 0; p.awakeT = 0; p.gamble = null;
    p.isHuman = true; p.netId = net.id; p.botFor = false; p.ctl = null; p.idleT = 0;
    this.humans.push(p);
    return p;
  }
  dispose() {
    World.setGoal(); // the normal goals again
    if (this.vaultView) this.vaultView.dispose();
    if (this.hill) { this.scene.remove(this.hill.mesh); this.hill.mesh.children.forEach((c) => { c.geometry.dispose(); c.material.dispose(); }); }
    for (const p of this.players) p.dispose();
    this.ball.dispose();
    for (const it of this.items) this.drop(it.mesh);
    for (const pr of this.projectiles) this.drop(pr.mesh);
    for (const h of this.hazards) this.drop(h.mesh, h.type === 'wall');
    if (this.drill) for (const g of this.drill.meshes) { this.scene.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
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
  skill(p) { const s = this.teamD[p.team]; return p.isGK ? clamp(s + 0.08 + (5 - this.gkSize()) * 0.11 + Math.max(0, s - 0.6) * 0.8, 0.45, 1.5) : s; }
  /** a team's keeper (null when an online match is played with no keepers) */
  keeperOf(team) { return this.teams[team].find((p) => p.isGK) || null; }
  /** the keeper's ball is safe: a computer keeper's always, yours only inside your box (no running the length of the pitch untouchable) */
  safeGK(p) { return !!p && p.isGK && this.ball.owner === p && (!p.isHuman || this.inOwnBox(p)); }
  /** two players on one team trade positions (the intro's position picker). Whoever goes in goal gets the keeper's kit, gloves and number 1 */
  swapRoles(a, b) {
    [a.role, b.role] = [b.role, a.role];
    if (a.isGK === (a.role === 'GK') && b.isGK === (b.role === 'GK')) return;
    a.isGK = a.role === 'GK'; b.isGK = b.role === 'GK';
    [a.number, b.number] = [b.number, a.number];
    a.repaint(); b.repaint();
  }
  /** owner's rule (Nov 2026: "a bot just follows me around and I can't shoot"): once you are in their box, their outfield
      bots wait outside it for BOX_FREE seconds, so the one marking you cannot follow you in and block every shot. Their
      keeper plays as normal. Bot matches only (online stays the same for everyone), not free kicks or the tutorial */
  boxFree(dt) {
    const h = this.human, them = h ? 1 - h.team : 0;
    const inBox = !!h && !h.isGK && !this.online && !this.fk && !this.tut && !this.hill && this.phase === 'play' && this.inOwnBox({ team: them }, h.pos);
    this.boxT = inBox ? (this.boxT || 0) + dt : 0;
    if (!inBox || this.boxT >= BOX_FREE) return;
    if (!this.boxTold) { this.boxTold = true; this.toast('IN THEIR BOX: ' + BOX_FREE + 'S BEFORE THEIR DEFENDERS CAN COME IN', 'gold', h); }
    const gz = this.ownGoalZ(them), s = this.dir(them);
    for (const p of this.teams[them]) {
      if (p.isGK || p.isHuman || !this.inOwnBox(p)) continue;
      // step back out by the nearest edge, at a run (so they wait on the line, and anyone already inside backs out)
      const ez = F.BOX_D - Math.abs(p.pos.z - gz), ex = F.BOX_W - Math.abs(p.pos.x), step = 9 * dt;
      if (ez <= ex) { p.pos.z += s * Math.min(ez + 0.02, step); if (p.vel.z * s < 0) p.vel.z = 0; }
      else { const sx = sgn(p.pos.x) || 1; p.pos.x += sx * Math.min(ex + 0.02, step); if (p.vel.x * sx < 0) p.vel.x = 0; }
    }
  }
  boxBlocked(p) { return this.boxT > 0 && this.boxT < BOX_FREE && !!this.human && p.team !== this.human.team && !p.isGK && !p.isHuman; }
  /** owner: "thunder in rain, every couple of minutes it hits somewhere, not on purpose": in your bot matches when it rains, a
      lightning bolt strikes a random spot on the pitch every 70 to 150 seconds (the first one sooner). Anyone near is knocked
      flat and a ball close by jumps. Not online (the weather is your own setting) */
  weatherTick(dt) {
    if (!this.human || this.online || this.fk || this.tut || this.phase !== 'play' || typeof World === 'undefined' || World.weather !== 'rain') return;
    this.thunderT = (this.thunderT == null ? rand(25, 45) : this.thunderT) - dt;
    if (this.thunderT > 0) return;
    this.thunderT = rand(70, 150);
    this.lightning(rand(-F.W + 3, F.W - 3), rand(-F.L + 6, F.L - 6));
  }
  lightning(x, z) {
    Hud.lightning(x, z);
    for (const p of this.players) {
      const dx = p.pos.x - x, dz = p.pos.z - z, d = Math.hypot(dx, dz);
      if (d > 3.2) continue;
      if (this.knockDown(p, 1.4, dx / (d || 1), dz / (d || 1), 5)) { this.label(p, 'ZAPPED', '#c8e0ff', 1.2); if (p.isHuman) this.toast('STRUCK BY LIGHTNING!', 'bad', p); }
    }
    const b = this.ball;
    if (Math.hypot(b.pos.x - x, b.pos.z - z) < 3.5) { if (b.owner) b.release(); b.vel.set(rand(-6, 6), 9, rand(-6, 6)); b.kick = { by: null, type: 'loose', t: this.time }; }
  }
  /** CANNON KICK: a long kick to the teammate furthest up the pitch */
  cannonKick(p) {
    const t = this.teams[p.team].filter((q) => q !== p && q.state !== 'down').sort((a, b) => this.prog(b.team, b.pos) - this.prog(a.team, a.pos))[0];
    if (!t) return false;
    if (p.state === 'hold') p.setState('free');
    return this.passTo(p, t, { lob: true }) !== false;
  }
  /** SLOW SHOT: a shot coming into the box of a keeper who has it on slows right down, once */
  keeperFx() {
    const b = this.ball, k = b.kick;
    if (b.owner || !k || k.type !== 'shot' || k.slowed || !k.by) return;
    const g = this.keeperOf(1 - k.by.team);
    if (!g || !(g.fx.slowShot > 0) || !this.inOwnBox(g, b.pos)) return;
    k.slowed = true; b.vel.multiplyScalar(0.45); b.curve.multiplyScalar(0.45);
    this.label(g, 'SLOWED', g.aura); FX.ring(b.pos.x, b.pos.y, b.pos.z, g.aura, 1.2, 18);
  }
  gkSize() { return this.fk ? 5 : this.size; } // free kicks: no small-team keeper boost (one shot at a time) // keepers get a boost in small teams (they face more shots) and against very good bots (who shoot from far)
  opponents(p) { return this.teams[1 - p.team]; }
  inOwnBox(p, pos = p.pos) {
    const gz = this.ownGoalZ(p.team);
    return Math.abs(pos.x) < F.BOX_W && Math.abs(pos.z - gz) < F.BOX_D && Math.abs(pos.z) < F.L + 0.5;
  }
  canAct(p) { return (p.state === 'free' || p.state === 'hold') && this.phase === 'play'; }
  label(p, text, color, dur) { Hud.label(p, text, color || p.aura, dur); }
  toast(text, cls, to) { Hud.toast(text, cls, to); } // to: the player it is for (online sends it only to them)
  involvesHuman(...ps) { return ps.some((q) => q && q.isHuman); }

  setupKickoff(team, first = false, quiet = false) {
    this.kickTeam = team; this.phase = 'kickoff'; this.phaseT = 0; this.kickDelay = first ? 2.6 : 1.7;
    this.ball.reset(0, 0); this.lastPass = null; this.pendingEnd = false;
    if (this.bomb) this.bomb.t = BOMB_FUSE; // BOMB BALL: a new fuse at every kickoff
    for (const p of this.players) {
      const f = FORM[p.role]; let u = f[0] * PITCH_KX, v = f[1] * PITCH_KZ;
      if (p.isGK) v = -(F.L - 1.5);
      const lead = p.role === leadRole(this.rolesFor(p.team));
      if (lead) { v = p.team === team ? -0.95 : -(F.CIRCLE + 1.2); u = 0; } // the kickoff taker stands on the ball
      else if ((p.role === 'LW' || p.role === 'RW' || p.role === 'MID' || p.role === 'FW') && p.team === team) v = -3.5;
      const s = this.dir(p.team);
      p.pos.set(u * s, 0, v * s); p.vel.set(0, 0, 0); p.yaw = s > 0 ? 0 : Math.PI;
      p.dash = p.slide = p.dive = null; p.charging = false; p.charge = 0; p.kickT = -1; p.flipT = -1; p.pending = null;
      p.fx.hang = 0; p.fx.vision = 0; p.fx.jetpack = 0; p.fx.magnet = 0; p.fx.slimed = 0;
      p.setState('kickoff'); p.onGround = true;
      p.ai.wantShot = null; p.ai.dodgeIn = -1; p.ai.task = 'pos'; p.ai.receive = null; p.ai.runT = 0;
    }
    if (quiet) return;
    if (first && this.mode === 'ranked') Hud.banner('VS ' + TIER_NAMES[this.tier], TEAM[1].full + ' \u00b7 ' + TIER_NAMES[this.tier] + ' BOTS \u00b7 WIN +25 RP \u00b7 DRAW +5 \u00b7 LOSS -15', TIER_MATS[this.tier].a);
    else if (first && this.cfg.tip) Hud.banner(this.cfg.name, this.cfg.tip, '#b65cff');
    else if (first) Hud.banner(this.cfg.name, this.mode === 'ranked' ? 'WIN +25 RP \u00b7 DRAW +5 \u00b7 LOSS -15' : this.mode === 'lawless' ? (Touch.on ? 'GRAB THE ? BLOCKS \u00b7 TAP ITEM TO USE' : 'GRAB THE ? BLOCKS \u00b7 X USES YOUR ITEM') : 'NO RANK ON THE LINE', TEAM[0].hex);
    else Hud.banner('KICKOFF', TEAM[team].name + ' BALL', TEAM[team].hex);
    if (!first && this.human && Touch.on) Touch.faceGoal(this);
    if (first && this.size === 5 && this.human) this.toast('THEY PLAY ' + this.setupOf(1 - this.human.team).name + ' · YOU PLAY ' + this.setupOf(this.human.team).name, 'gold', this.human);
  }
  startPlay() {
    this.phase = 'play'; this.phaseT = 0;
    for (const p of this.players) p.setState('free');
    const T = this.teams[this.kickTeam], st = T.find((p) => p.role === leadRole(this.rolesFor(this.kickTeam))) || T.find((p) => !p.isGK) || T[0];
    this.possess(st, true);
    st.protect = 0.5;
    Sfx.whistle(1);
  }
  /* ---------- main update ---------- */
  update(dt) {
    if (this.paused) return;
    const tw = this.twist(); // CHAOS: the twist on now changes these too
    BALL_G = (tw && tw.ballG) || this.cfg.ballG || BALL_G0; // Moon Ball: a floaty ball (set every step: the server runs many rooms at once)
    World.setGoal((tw && tw.goalW) || this.cfg.goalW, (tw && tw.goalH) || this.cfg.goalH); // the same for MEGA GOAL's goals
    const speed = (this.cfg.speed || 1) * ((tw && tw.speed) || 1);
    if (speed !== 1) dt *= speed; // Turbo: the whole match runs faster, the clock too
    this.time += dt; this.phaseT += dt;
    const ph = this.phase;
    if (ph === 'kickoff' && this.phaseT >= this.kickDelay) this.startPlay();
    if (ph === 'goal' && this.tut && this.phaseT >= 2) { this.phase = 'play'; this.phaseT = 0; const h = this.human; this.ball.reset(clamp(h.pos.x, -F.W + 2, F.W - 2), clamp(h.pos.z, -F.L + 3, F.L - 3)); }
    if (ph === 'goal' && !this.tut && this.phaseT >= (this.fk ? 2.4 : 3.9)) { if (this.fk) this.nextFreeKick(); else if (this.pendingEnd) this.endMatch(); else this.setupKickoff(1 - this.lastGoal.team); }
    if (ph === 'out' && this.phaseT >= 1.05) this.doRestart();
    if ((ph === 'play' || ph === 'out') && !this.fk && !this.tut && !this.drill) this.tickClock(dt);
    if (this.drill) this.updateDrill(dt);
    if (this.hill && ph === 'play' && !this.fk) this.updateHill(dt);
    if (this.heist) this.updateHeist(dt);
    if (this.chaos) this.updateChaos(dt);
    if (this.bomb) this.updateBomb(dt);

    for (const p of this.players) { p.tickTimers(dt); p.computeMods(); }
    if (ph === 'play' || ph === 'out' || ph === 'goal') AI.update(this, dt);
    if (this.human && !this.autopilot) this.updateHuman(dt, this.ctl);
    for (const h of this.humans) if (h.ctl) this.updateHuman(dt, h.ctl, h);
    this.updateSetPiece(dt);
    if (this.fk) this.updateFreeKick(dt);
    if (this.tut) this.updateTutorial(dt);
    // the return half of a one-two: as soon as the teammate has it, it goes straight back into your run
    const ot = this.oneTwoBack;
    if (ot) {
      if (this.time - ot.t > 3 || this.ball.owner && this.ball.owner.team !== ot.to.team) this.oneTwoBack = null;
      else if (this.ball.owner === ot.from && this.canAct(ot.from)) { this.oneTwoBack = null; this.throughBall(ot.from, ot.to); this.label(ot.from, 'ONE-TWO', ot.to.aura); }
    }
    this.updateAwakening(dt);
    // the build-up: as the hidden Awakening meter fills, sparks in your colour start to crackle round you, more and more
    for (const p of this.players) if (p.awake > 40 && p.awakeT <= 0 && p.style.awaken && !(p.isGK && !p.isHuman) && Math.random() < (p.awake - 40) / 60 * dt * 6) FX.sparks(p.pos.x + rand(-0.4, 0.4), p.pos.y + rand(0.3, 1.7), p.pos.z + rand(-0.4, 0.4), p.aura, 3, 1.6, 0.12, 0.5);
    this.updatePending(dt);
    this.keeperFx();
    this.weatherTick(dt);
    for (const p of this.players) p.physics(dt);
    this.boxFree(dt);
    this.rocketLandings();
    this.slowZones();
    this.separate();
    if (ph === 'play') { this.updateSlides(); this.updateMagnets(dt); }
    this.updateBallSpecials(dt);
    this.ball.update(dt);
    this.updateBlocks();
    if (this.phase === 'play') { this.ballContacts(); this.checkGoalAndOut(); }
    if (this.cfg.items && !this.fk) this.updateItems(dt);
    this.updateFx(dt);
    for (const p of this.players) p.animate(dt);
  }
  tickClock(dt) {
    if (!this.golden) {
      this.clock -= dt;
      if (this.clock <= 0) {
        this.clock = 0;
        if (this.score[0] !== this.score[1]) this.endMatch();
        else { this.golden = true; this.goldenClock = this.goldenLen; Hud.banner(this.hill ? 'GOLDEN POINT' : 'GOLDEN GOAL', this.hill ? 'NEXT POINT WINS' : 'NEXT GOAL WINS', '#ffcb3d'); Sfx.whistle(2); Sfx.roar(0.5); }
      }
    } else {
      this.goldenClock -= dt;
      if (this.goldenClock <= 0) { this.goldenClock = 0; if (this.score[0] === this.score[1] && this.human && !this.online) this.startBattle(); else this.endMatch(); } // still level: a free kick battle
    }
  }
  /** how long the final whistle lasts before the results: the ending (Cine) for a real result, longer with an OMEGA SNAP */
  outroLen() {
    const r = this.result && this.result.res;
    if (r !== 'win' && r !== 'loss' && r !== 'draw') return 3.2;
    return this.heist && this.heist.cleaned != null ? 8.6 : 6.2;
  }
  endMatch() {
    if (this.phase === 'end') return;
    this.phase = 'end'; this.phaseT = 0;
    Sfx.whistle(3);
    const [a, b] = this.score;
    const humanTeam = this.human ? this.human.team : 0;
    const res = a === b ? 'draw' : ((a > b ? 0 : 1) === humanTeam ? 'win' : 'loss');
    this.result = { res, score: [a, b], human: this.human ? Object.assign({}, this.human.stats) : null, players: this.players.map((p) => ({ netId: p.netId, feats: p.feats, name: p.name, team: p.team, number: p.number, style: p.styleId, role: p.role, isHuman: p.isHuman, stats: Object.assign({}, p.stats) })) };
    const H = this.heist;
    if (H && a !== b && H.cleaned == null) { // OMEGA CORES: the winners take every core the other team has left (the score stays)
      const w = a > b ? 0 : 1; H.v[w].push(...H.v[1 - w]); H.v[1 - w] = []; H.cleaned = 1 - w; H.rest = true;
    }
    const snap = !!(H && H.cleaned != null); // one team holds every core: the OMEGA SNAP (Cine and VaultView)
    Hud.banner(snap ? 'OMEGA SNAP' : 'FULL TIME', snap ? (H.rest ? a + ' : ' + b + ' · THE WINNERS TAKE EVERY CORE' : 'THEY HAVE NO CORES LEFT') : a + ' : ' + b, snap ? '#ffffff' : res === 'win' ? '#2ee38f' : res === 'loss' ? '#ff4d5e' : '#ffcb3d', true);
    for (const p of this.players) {
      p.charging = false; p.mx = p.mz = 0;
      const won = a !== b && (a > b ? 0 : 1) === p.team, lost = a !== b && !won;
      if (lost) { p.emote = 'sad'; p.setState('emote', 99); } // the ending: the losers drop to their knees
      else p.setState(won ? 'celebrate' : 'free', won ? 99 : 0);
    }
    if (snap) { // the winner who snaps: you if you are on that team, else whoever took the last core, else their top scorer
      const w = 1 - H.cleaned, sc = this.lastGoal && this.lastGoal.scorer;
      const top = this.teams[w].filter((p) => !p.isGK).sort((x, y) => y.stats.goals - x.stats.goals)[0];
      const hero = (this.human && this.human.team === w && this.human) || (sc && sc.team === w && sc) || top || this.teams[w][0];
      if (hero) { hero.emote = 'snap'; hero.setState('emote', 99); }
    }
    World.excite[a > b ? 0 : 1] = a === b ? 0.3 : 1;
  }
  /* ---------- human control ---------- */
  updateHuman(dt, c, p = this.human) {
    if (!p || !c) return;
    if (p.passHold > 0 && c.passHeld === false && !c.passUp) p.passHold = 0; // let go while it was not listening (knocked down, a restart): no pass stuck down
    if (c.swap && !this.online && this.trySwitch(p)) return; // V: you are someone else from now
    // an online player sends their own camera direction and aim point
    if (c.camYaw != null) p.camYaw = c.camYaw;
    if (c.aim) p.aimV = c.aim;
    const cy = c.camYaw != null ? c.camYaw : this.camYaw, fx = Math.sin(cy), fz = Math.cos(cy), rx = -fz, rz = fx;
    let mx = fx * c.moveY + rx * c.moveX, mz = fz * c.moveY + rz * c.moveX;
    const ml = len2D(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const live = this.phase === 'play' || this.phase === 'out' || this.phase === 'goal' || this.phase === 'end';
    p.mx = live ? mx : 0; p.mz = live ? mz : 0; p.sprint = c.sprint;
    if (c.emote != null && c.emote >= 0 && live) this.emote(p, c.emote);
    p.faceYaw = p.charging || c.shiftLock || p.fkHold ? cy : null; // shift lock (and a free kick): always face where the camera looks
    p.jetThrust = c.jumpHeld && p.fx.jetpack > 0;
    if (this.phase !== 'play') { p.charging = false; p.charge = 0; p.shotBuffer = null; return; } // a shot pressed as play stopped never fires by itself at the restart
    if (p.setPiece) { // throw-in, corner: pass plays it to a teammate, shoot plays it where you aim
      p.faceYaw = cy; p.yaw = cy; p.charging = false; p.charge = 0;
      if (c.passDown) this.takeSetPiece(p, 'pass'); // only a fresh press: letting go of a button you held when the ball went out does not take it by accident
      else if (c.shootDown) this.takeSetPiece(p, 'shoot');
      p.passHold = 0; p.shotBuffer = null;
      return;
    }
    if (p.fkHold) { this.freeKickControls(dt, c, p, cy); return; }
    if (p.inWall) { p.mx = p.mz = 0; p.charging = false; p.charge = 0; if (c.jump) this.jump(p); return; } // in the wall for their free kick: jump to block it
    let dodge = c.dodge, jumpOk = true;
    if (p.isGK) { const k = this.keeperControls(dt, c, p, ml); if (!k.feint) dodge = false; jumpOk = k.jump; }
    if (dodge) { // C twice quickly (B, FEINT): SLOW-MO instead of a second feint. Checked here, so it works during the feint's step too
      if (this.time - p.cTapAt < SLOWMO_TAP) { p.cTapAt = -9; dodge = false; if (this.slowMo(p)) this.cutFeint(p); } else p.cTapAt = this.time;
    }
    if (!this.canAct(p)) { if (p.state !== 'dash') { p.charging = false; p.charge = 0; p.shotBuffer = null; } return; }
    if (c.shootDown && !p.charging) { p.charging = true; p.charge = 0; p.shotCurve = clamp(c.moveX || 0, -1, 1); }
    if (p.charging) {
      if (!c.shootHeld && !c.shootUp) { p.charging = false; p.charge = 0; }
      else { p.charge = p.fx.loaded > 0 ? 1 : Math.min(1, p.charge + dt / 0.8); if (c.shootHeld) p.shotCurve = damp(p.shotCurve || 0, clamp(c.moveX || 0, -1, 1), 12, dt); } // A/D (the stick) while you charge: the curve (letting go of both at once keeps it)
    }
    if (c.shootUp && p.charging) {
      const power = Math.max(0.5, p.charge), curveIn = p.shotCurve || 0; // a quick tap is still a proper shot
      p.charging = false; p.charge = 0; p.shotCurve = 0;
      if (!this.tryShoot(p, power, p.aimV || this.aim, { curveIn }) && this.ball.owner !== p) p.shotBuffer = { power, curveIn, t: 0.35 };
    }
    // pressed a moment before the ball reached you: it goes as soon as you have it
    if (p.shotBuffer) {
      p.shotBuffer.t -= dt;
      if (this.ball.owner === p) { const sb = p.shotBuffer; p.shotBuffer = null; this.shootAt(p, p.aimV || this.aim, sb.power, { curveIn: sb.curveIn }); }
      else if (p.shotBuffer.t <= 0) p.shotBuffer = null;
    }
    if (c.passDown) p.passHold = 0.0001;
    if (p.passHold > 0) p.passHold += dt;
    if (c.passUp && p.passHold > 0) {
      const lob = p.passHold > 0.24; p.passHold = 0;
      if (this.ball.owner === p) { const mate = this.pickPassTarget(p); if (mate) this.passTo(p, mate, { lob }); }
      else { p.callT = 1.6; this.label(p, 'PASS!', '#2ee38f'); }
    }
    if (c.jump && jumpOk) this.jump(p);
    if (dodge) this.dodge(p, mx, mz);
    if (c.tackle) {
      let tx = mx, tz = mz;
      if (len2D(tx, tz) < 0.2) { tx = Math.sin(p.yaw); tz = Math.cos(p.yaw); }
      this.tackle(p, tx, tz);
    }
    for (let i = 0; i < 3; i++) if (c.ab[i]) this.useAbility(p, i);
    if (c.awaken) { // Z: awakened, your style's signature move (once). Awakening itself comes by itself
      if (p.awakeT > 0) this.tryAwakenMove(p);
      else { this.toast('AWAKENING COMES BY ITSELF. BIG PLAYS BRING IT SOONER', 'bad', p); Sfx.deny(); }
    }
    // the Flow button also awakens you when the Awakening bar is full and Flow is not
    if (c.flow) { if (!this.activateFlow(p) && !(p.awakeT > 0 && !p.awakeMoveUsed && this.tryAwakenMove(p)) && p.flow < 100 && p.flowT <= 0) { this.toast('FLOW NOT READY', 'bad', p); Sfx.deny(); } }
    if (c.item) { if (this.heist) this.tryCore(p); else this.useItem(p); } // OMEGA CORES: the item button is your core power
  }
  /** you are the keeper. JUMP with the stick pushed left or right (A or D) dives that way, and the FEINT button (C, B,
      DIVE on a phone) dives too. At a shot coming in, the dive goes to where the ball is going (push the other way to
      guess the other side) and as high as the ball; pressed early, you shuffle across first and the dive goes at the
      right moment, so you are still in the air when it arrives. Where you stand is all yours: real keepers come off
      their line. The ball in your hands: walk with it in the box, PASS throws it, SHOOT kicks it long; held too long,
      or taken out of the box, it goes by itself. Returns { feint, jump }: false when that press was a dive */
  keeperControls(dt, c, p, ml) {
    const b = this.ball, out = { feint: true, jump: true };
    // a fresh push this frame (it was not pushed last frame): in the air, that is what dives
    const ix = c.moveX || 0, iy = c.moveY || 0, pv = p.inPrev || (p.inPrev = { x: 0, y: 0 });
    const sidePress = Math.abs(ix) > 0.4 && Math.abs(pv.x) <= 0.4, fwdPress = iy > 0.4 && pv.y <= 0.4 && Math.abs(ix) <= 0.4;
    pv.x = ix; pv.y = iy;
    if (p.state === 'hold') {
      p.holdFor = (p.holdFor || 0) + dt; p.diveQ = null;
      if (!this.inOwnBox(p)) { p.setState('free'); b.held = false; p.holdFor = 0; } // no hands outside the box: it drops to your feet
      else if (p.holdFor > KEEP_HOLD) { p.holdFor = 0; AI.distribute(this, p); this.toast('TOO LONG: IT WENT TO A TEAMMATE', 'bad', p); }
      out.feint = false;
      return out;
    }
    p.holdFor = 0;
    if (b.owner === p) { p.diveQ = null; return out; } // the ball at your feet: you play like anyone (FEINT is a feint, JUMP flicks it)
    if (ml < 0.12 && p.faceYaw == null) p.faceYaw = yawTo(p.pos, b.pos); // standing still: you watch the ball
    const q = p.diveQ;
    if (q) { // a dive pressed early: shuffle across, then go
      const K = this.shotAt(p);
      if (!K) p.diveQ = null; // it was blocked or stopped: no dive
      else if (this.time >= q.at) { p.diveQ = null; this.keeperDive(p, q.push, q.high, true); }
      else { const dx = K.x - p.pos.x; if (Math.abs(dx) > 0.35 && (!q.push || sgn(dx) === sgn(q.push))) { p.mx = sgn(dx) * Math.min(1, Math.abs(dx)); p.mz = 0; } }
    }
    out.feint = false; // without the ball the FEINT button only ever dives
    const sideways = Math.abs(c.moveX || 0) > 0.3;
    const push = Math.abs(p.mx) > 0.3 ? p.mx : 0, forward = iy > 0.4 && !sideways;
    if ((c.jump || c.dodge) && forward && p.onGround) { out.jump = false; this.keeperLunge(p); } // owner: "make it so you can dive forward": JUMP (or C) with W
    else if (c.dodge || (c.jump && sideways)) { if (c.jump) out.jump = false; this.keeperDive(p, push, !!c.dodge && c.jumpHeld); }
    else if (!p.onGround && p.state === 'free' && this.time - (p.jumpAt || -9) < 1.5 && (sidePress || fwdPress)) { // owner: "jump, and when you're in the air press A or D to dive ... you can dive forward": any time in the jump
      if (fwdPress) this.keeperLunge(p); else this.keeperDive(p, push, true, true, false, true);
    }
    return out;
  }
  /** W in the air: dive forward, the way the stick points (onto a ball at an attacker's feet) */
  keeperLunge(p) {
    if (p.state !== 'free' || (p.diveAt || -9) > this.time) return false;
    let dx = p.mx, dz = p.mz; const l = Math.hypot(dx, dz);
    if (l < 0.2) { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); } else { dx /= l; dz /= l; }
    p.yaw = Math.atan2(dx, dz);
    p.dive = { vx: dx * 11, vz: dz * 11, dur: 0.35, rest: 0.6, side: 0, high: !p.onGround, ux: dx, uz: dz, fwd: true };
    p.setState('dive'); p.diveAt = this.time + 1.1; Sfx.swoosh();
    return true;
  }
  /** a ball flying at your goal: where (and when) it passes the line you stand on */
  shotAt(p) { const b = this.ball; return !b.owner && b.vel.z * this.dir(p.team) < -0.5 && b.vel.lengthSq() > 49 ? AI.crossAt(b, p.pos.z) : null; }
  keeperDive(p, push, high, now = false, big = false, air = false) {
    if (p.state !== 'free' || (!p.onGround && !air) || (!big && (p.diveAt || -9) > this.time) || p.diveQ) return false;
    const b = this.ball, K = this.shotAt(p);
    let dx = 0, ky = high ? 2.3 : 0.7, tk = 0.4;
    const want = Math.abs(push) > 0.3 ? sgn(push) : 0;
    const aimed = K && Math.abs(K.x) < F.GW + 3 && (!want || sgn(K.x - p.pos.x) === want || Math.abs(K.x - p.pos.x) < 0.6);
    if (aimed && !now && K.t > 0.85) { p.diveQ = { at: this.time + K.t - 0.8, push, high }; return true; } // very early: a moment's wait (you shuffle across)
    if (aimed) { dx = K.x - p.pos.x; ky = Math.max(ky, K.y); tk = K.t; }
    else dx = (want || sgn(b.pos.x - p.pos.x) || 1) * (big ? 5.5 : 3.2);
    if (Math.abs(dx) < 0.5) dx = sgn(dx || 1) * 0.5;
    AI.dive(this, p, dx, ky, tk, Math.max(0.8, this.skill(p)));
    if (big && p.dive) { p.dive.vx = clamp(dx / clamp(tk, 0.25, 0.5), -24, 24); p.dive.dur = 0.5; p.dive.big = true; FX.ring(p.pos.x, 0.2, p.pos.z, p.aura, 2, 20); }
    else if (aimed && tk > 0.42 && p.dive) { // pressed early: it goes at once, a slower and floatier dive that is still stretched out when the ball gets there
      p.dive.dur = Math.min(tk, 0.85); p.dive.vx = clamp(dx / p.dive.dur, -16, 16);
      if (!p.onGround) { p.vel.y *= 0.5; p.fx.hang = p.dive.dur + 0.2; } // a high one: half the speed up at a quarter of the gravity, the same height for twice as long
    }
    p.diveAt = this.time + 1.1;
    return true;
  }
  pickPassTarget(p) {
    const yaw = p.camYaw != null ? p.camYaw : this.camYaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
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
    b.owner = p; b.held = false; b.inGoal = 0; b.vel.set(0, 0, 0); b.curve.set(0, 0, 0); b.straightT = 0; b.kick = null; b.gMul = 1;
    b.touch(p);
    p.pickBlock = 0; p.gotBallT = this.time; p.stats.touches = (p.stats.touches || 0) + 1;
    if (k && k.by && k.by !== p) {
      if (k.type === 'pass' && k.by.team === p.team) {
        k.by.stats.passes++; this.flowAdd(k.by, 12);
        this.lastPass = { from: k.by, to: p, t: this.time };
      } else if (k.by.team !== p.team && (k.type === 'pass' || k.type === 'shot')) {
        this.flowAdd(p, 10);
        if (p.isHuman) this.toast('INTERCEPTED', 'good', p);
        if (k.type === 'shot' && !p.isGK) this.label(p, 'BLOCKED', p.aura);
      }
    }
    if (p.isGK && this.inOwnBox(p)) { b.held = true; p.setState('hold'); p.ai.holdT = rand(0.8, 1.4); }
    if (this.story && !this.online && this.human && p.team === this.human.team && p !== this.human && !p.isGK) this.switchTo(p); // STORY: you always play the teammate with the ball (a pass, a tackle, an interception)
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
    b.straightT = o.straight || 0; b.inGoal = 0; b.gMul = o.gMul || 1;
    b.kick = { by: p, type: o.type || 'shot', to: o.to || null, t: this.time, trail: o.trail || null, special: o.special || null, counted: false,
      aerial: !!(o.aerial || o.special === 'volley' || o.special === 'overhead'), // struck in the air: counts in Volleys Only
      curved: !!(o.cx || o.cz), fx: b.pos.x, fz: b.pos.z };
    b.lastKicker = p; b.touch(p);
    b.ignore = p; b.ignoreT = 0.22;
    p.kickStyle = o.kickStyle || null;
    p.pickBlock = o.selfBlock == null ? 0.32 : o.selfBlock;
    if (!o.noAnim) { p.kickT = 0; p.kickDur = o.kickDur || 0.32; }
    if (!o.keepYaw) p.yaw = Math.atan2(vx, vz);
    const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
    Sfx.kick(clamp(sp / 36, 0.15, 1));
    if (sp > 27 && this.involvesHuman(p)) Shake.add(0.22);
    return true;
  }
  /** a shot's launch. With curve (`curveIn`, -1 left to 1 right: A/D or the stick while you charge) the ball starts out
      to the other side and bends back in, so it still ends up where you aimed, only round the keeper or a defender */
  shotLaunch(p, target, power, o = {}) {
    const b = this.ball;
    const ci = clamp(o.curveIn || 0, -1, 1), curl = Math.abs(ci) >= CURVE_MIN ? ci : 0;
    const speed = lerp(17, 36, clamp(power, 0, 1)) * p.mods.shot * (o.mult || 1) * (1 - CURVE_SLOW * Math.abs(curl)); // a curler is a little slower
    let from = b.pos;
    if (b.owner === p) { const dx = target.x - p.pos.x, dz = target.z - p.pos.z, l = len2D(dx, dz) || 1; from = V3(p.pos.x + dx / l * 0.6, b.pos.y, p.pos.z + dz / l * 0.6); }
    const v = solveLaunch(from, target, speed, BALL_G * 1.04);
    let cx = 0, cz = 0;
    const hs = len2D(v.x, v.z), D = len2D(target.x - from.x, target.z - from.z), T0 = hs > 1 ? D / hs : 0; // T0: about when it gets there
    if (curl && hs > 1 && D > 2) {
      // the same speed towards the target, plus a sideways part that the spin bends back to zero by the time it gets there
      const ux = v.x / hs, uz = v.z / hs, rx = -uz, rz = ux, T = D / hs; // r: right of the shot
      const side = hs * Math.tan(CURVE_ANGLE * Math.abs(curl)) * -Math.sign(curl), acc = -2 * side / T;
      v.x += rx * side; v.z += rz * side; cx = rx * acc; cz = rz * acc;
    }
    return { from, v, cx, cz, speed, curl, T: T0 };
  }
  shootAt(p, target, power, o = {}) {
    const b = this.ball;
    const L = this.shotLaunch(p, target, power, o), v = L.v, speed = L.speed;
    p.stats.shots++;
    const trail = o.trail || (speed > 28 ? p.aura : null);
    if (!o.kickStyle) { o.kickStyle = 'strike'; o.kickDur = lerp(0.36, 0.5, clamp(power, 0, 1)); } // a full strike, longer for big shots
    p.kickPow = clamp(power, 0, 1.4);
    if (power > 0.85 && b.pos.y < 1) FX.dirt(p.pos.x, p.pos.z, Math.sin(p.yaw), Math.cos(p.yaw), 6, 0.7); // turf flies on a big one
    if (L.curl && Math.abs(L.curl) > 0.6 && this.involvesHuman(p)) FX.sparks(b.pos.x, b.pos.y, b.pos.z, '#7cf2ff', 6, 3); // spin on it
    const ok = this.kick(p, v.x, v.y, v.z, Object.assign({ type: 'shot', trail: trail || (L.curl ? '#7cf2ff' : null), curveDecay: L.curl ? 0 : 1.4 }, o, { cx: L.cx, cz: L.cz }));
    if (ok && L.curl) this.ball.kick.curl = L.curl;
    return ok;
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
        return this.shootAt(p, aim, power, Object.assign({ mult: volley ? 1.08 : 1, keepPos: true, aerial: volley }, o));
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
    if (o.style === 'outside') {
      // a low chip that starts wide and bends back onto the runner
      const T = clamp(D0 / 17, 0.45, 1.2);
      tx += mate.vel.x * T * 0.85; tz += mate.vel.z * T * 0.85;
      const dx = tx - from.x, dz = tz - from.z, D = Math.hypot(dx, dz) || 1, sp = D / T, a = 0.22;
      const sig = chance(0.5) ? 1 : -1, nx = dz / D * sig, nz = -dx / D * sig;
      vx = (dx / D * Math.cos(a) + nx * Math.sin(a)) * sp; vz = (dz / D * Math.cos(a) + nz * Math.sin(a)) * sp;
      vy = (0.9 - from.y + 0.5 * BALL_G * T * T) / T;
      const acc = 2 * sp * Math.sin(a) / T;
      extra = { cx: -nx * acc, cz: -nz * acc, curveDecay: 0, trail: p.aura };
    } else if (o.snap) {
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
    if (!p.isHuman) { // low-skill bots misplace passes a little
      const e = 1 - Math.min(1, this.skill(p)), a = rand(-0.1, 0.1) * e, k = 1 + rand(-0.12, 0.12) * e, c = Math.cos(a), sn = Math.sin(a);
      const nx = (vx * c - vz * sn) * k, nz = (vx * sn + vz * c) * k; vx = nx; vz = nz;
    }
    if (o.style) {
      extra.kickStyle = o.style;
      if (o.style === 'backheel' || o.style === 'nolook') extra.keepYaw = true;
      if (o.style === 'rabona') extra.kickDur = 0.42;
      if (o.style === 'nolook') { const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); p.noLookSide = (fx * (tz - p.pos.z) - fz * (tx - p.pos.x)) > 0 ? 1 : -1; }
    }
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
  /** CHIP SHOT: a high, soft lob that drops in under the bar where you aim (best over a keeper off his line) */
  chipShot(p, target) {
    const b = this.ball;
    const from = b.owner === p ? V3(p.pos.x + Math.sin(p.yaw) * 0.6, b.pos.y, p.pos.z + Math.cos(p.yaw) * 0.6) : b.pos.clone();
    const tx = clamp(target.x, -F.GW + 0.7, F.GW - 0.7), ty = clamp(target.y + 0.6, 2.2, F.GH - 0.3); // drops in near the bar
    const dx = tx - from.x, dz = target.z - from.z, D = Math.hypot(dx, dz) || 1;
    const T = clamp(0.7 + D * 0.035, 0.9, 1.6); // it hangs in the air
    if (b.owner === p) b.pos.copy(from);
    p.stats.shots++;
    this.kick(p, dx / T, (ty - from.y + 0.5 * BALL_G * T * T) / T, dz / T, { type: 'shot', trail: p.aura, special: 'chip', keepPos: true, kickDur: 0.3 });
    FX.sparks(from.x, from.y, from.z, p.aura, 12, 4);
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
    p.vel.y = 9.4 * (p.isHuman && this.adm && this.adm.moon ? 2.1 : 1); p.onGround = false; p.jumpAt = this.time; // about 2 blocks high: up to headers and volleys (admin MOON JUMP: far higher)
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
  /** FEINT (C, B, the FEINT button): a step-over cut to the side, keeping the ball. Nobody can tackle you through it
      (a tackle that tries is an ankle breaker). One use, then FEINT_CD seconds to recharge, so it cannot be spammed */
  dodge(p, dx, dz) {
    if (p.dodgeCharges < 1 || p.state !== 'free') {
      if (p.isHuman && p.state === 'free') { this.toast('FEINT IN ' + Math.max(1, Math.ceil(FEINT_CD - p.dodgeRe)) + 'S', 'bad', p); Sfx.deny(); }
      return false;
    }
    // cut to the side you push towards; with no push, the other side from last time
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const push = dx * rx + dz * rz;
    const side = Math.abs(push) > 0.3 ? Math.sign(push) : (p.feintSide = -(p.feintSide || -1));
    let cx = rx * side * 0.85 + fx * 0.45, cz = rz * side * 0.85 + fz * 0.45;
    const l = len2D(cx, cz); cx /= l; cz /= l;
    p.dodgeCharges = 0; p.dodgeRe = 0; p.feintT = this.time; p.stamina = Math.max(0, p.stamina - 6); p.stamDelay = 0.4;
    p.iframes = 0.55; p.tackleProof = Math.max(p.tackleProof, 0.55); p.feint = side;
    for (const o of this.opponents(p)) if ((o.state === 'windup' || o.state === 'slide') && dist2D(o.pos, p.pos) < 7) o.slideBeaten = p;
    const yawKeep = p.yaw;
    this.dashP(p, cx, cz, 12.5, 0.3, { onEnd: () => { p.feint = 0; if (this.ball.owner === p) p.yaw = yawKeep; } });
    FX.feathers(p.pos.x, p.pos.y + 0.3, p.pos.z, '#ffffff', 6); Sfx.dodge();
    if (p.isHuman) this.label(p, 'FEINT', '#ffffff', 0.6);
    return true;
  }
  /** SLOW-MO (C twice, B twice, FEINT twice): with the ball, opponents near you slow right down and nobody can tackle you,
      for SLOWMO_TIME or until the ball leaves you (slowZones). Once every SLOWMO_CD seconds. Keepers are never slowed */
  slowMo(p) {
    const ok = p.state === 'free' || p.state === 'dash' || p.state === 'hold';
    if (p.slowRe > 0 || this.ball.owner !== p || p.isGK || !ok || this.phase !== 'play') {
      if (p.isHuman && ok && this.phase === 'play') { this.toast(p.slowRe > 0 ? 'SLOW-MO IN ' + Math.ceil(p.slowRe) + 'S' : 'SLOW-MO NEEDS THE BALL', 'bad', p); Sfx.deny(); }
      return false;
    }
    p.slowRe = SLOWMO_CD; p.fx.slowmo = SLOWMO_TIME;
    this.slowZones();
    FX.ring(p.pos.x, 0.3, p.pos.z, '#9fb4ff', SLOWMO_RANGE, 48); FX.ring(p.pos.x, 0.6, p.pos.z, '#ffffff', 2.2, 22);
    this.label(p, 'SLOW-MO', '#9fb4ff', 1.2);
    if (p === this.human) { TimeCtl.slowMo(0.3, 0.45); Cam.punch(0.5, 0.3); } // only a light zoom: a big one pulled the view about
    p.slowUses = (p.slowUses || 0) + 1;
    return true;
  }
  /** the second tap of C C: you wanted SLOW-MO, not the feint the first tap started. Its sideways step stops at once (it used to
      carry on through the slow motion and slide your view and aim away) and the feint is yours again */
  cutFeint(p) {
    if (p.state === 'dash' && p.feint && p.dash) {
      const d = p.dash; p.dash = null; p.setState('free'); p.vel.x *= 0.15; p.vel.z *= 0.15;
      if (d.onEnd) d.onEnd();
    }
    if (p.dodgeCharges < 1 && this.time - (p.feintT || -9) < SLOWMO_TAP + 0.05) { p.dodgeCharges = 1; p.dodgeRe = 0; }
  }
  /** every frame: a player in SLOW-MO cannot be tackled and opponents near them (not keepers) move slowly. It ends when the ball leaves them */
  slowZones() {
    for (const p of this.players) {
      if (!(p.fx.slowmo > 0)) continue;
      if (this.ball.owner !== p || this.phase !== 'play') { p.fx.slowmo = 0; continue; }
      p.tackleProof = Math.max(p.tackleProof, 0.15);
      for (const o of this.opponents(p)) if (!o.isGK && dist2D(o.pos, p.pos) < SLOWMO_RANGE) o.fx.slowed = Math.max(o.fx.slowed || 0, 0.2);
    }
  }
  dashP(p, dx, dz, speed, dur, o = {}) {
    p.charging = false; p.charge = 0;
    p.dash = { dx, dz, speed, dur, t: 0, zig: !!o.zig, ram: !!o.ram, home: o.home || null, onEnd: o.onEnd || null };
    p.setState('dash');
  }
  /** TITAN's RAM: anyone in the way goes flying (a carrier drops the ball) */
  /** COMET's ROCKET JUMP: landing next to an opponent with the ball pops it loose, up towards the lander */
  rocketLandings() {
    for (const p of this.players) {
      if (!p.rocketing || !p.onGround) continue;
      p.rocketing = false;
      if (this.phase !== 'play') continue;
      FX.ring(p.pos.x, 0.2, p.pos.z, p.aura, 3.5, 24); FX.dust(p.pos.x, p.pos.z, 10);
      const b = this.ball, o = b.owner;
      if (!o || o.team === p.team || o.isGK || dist2D(o.pos, p.pos) > 3.5) continue;
      if (o.tackleProof > 0 || o.iframes > 0 || o.protect > 0 || o.fx.bubble > 0) { this.label(o, 'KEPT IT', o.aura); continue; }
      const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z;
      b.release(); b.vel.set(dx * 1.6, 6, dz * 1.6);
      b.kick = { by: p, type: 'flick', t: this.time, trail: p.aura }; b.touch(p); b.ignore = o; b.ignoreT = 0.5;
      o.pickBlock = 0.6; p.stats.tackles++; this.flowAdd(p, 10);
      this.label(p, 'TOUCHDOWN', p.aura); Sfx.tackle();
      if (this.involvesHuman(p, o)) { Shake.add(0.25); if (o.isHuman) this.toast('KNOCKED LOOSE', 'bad', o); }
    }
  }
  ramHits(p) {
    for (const o of this.opponents(p)) {
      if (o.isGK || o.state === 'down' || dist2D(o.pos, p.pos) > 1.4) continue;
      if (!this.knockDown(o, 0.8, p.dash.dx, p.dash.dz, 5, p)) continue;
      FX.ring(o.pos.x, 0.3, o.pos.z, p.aura, 1.4, 16); Sfx.tackle();
      if (this.involvesHuman(p, o)) Shake.add(0.2);
    }
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
        b.curve.set(0, 0, 0); b.straightT = 0; b.gMul = 1; // a curler knocked away by the slide stops bending
        b.kick = { by: p, type: 'tackle', t: this.time }; b.touch(p); p.pickBlock = 0;
        Sfx.kick(0.3);
      }
      for (const o of this.opponents(p)) {
        if (o.state === 'down' || this.safeGK(o)) continue; // nobody takes the keeper's ball
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
            if (this.involvesHuman(p, o)) { TimeCtl.hitStop(0.075); Shake.add(0.3); if (o.isHuman) this.toast('TACKLED', 'bad', o); if (p.isHuman) this.toast('CLEAN TACKLE', 'good', p); }
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
    if (carrier.isHuman) { this.featsOf(carrier).ankles++; this.toast('ANKLE BREAKER', 'good', carrier); Replay.event(this, 'ANKLE BREAKER', carrier); }
    if (tackler.isHuman) this.toast('DODGED', 'bad', tackler);
    if (this.involvesHuman(tackler, carrier)) TimeCtl.slowMo(0.45, 0.35);
  }
  knockDown(t, dur, dx, dz, power = 3, by = null) {
    if (t.fx.bubble > 0 || this.safeGK(t)) return false;
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
    if (from.iframes > 0 || from.tackleProof > 0 || from.fx.bubble > 0 || from.protect > 0 || this.safeGK(from)) { this.ankleBreak(p, from); return false; } // the keeper's ball is safe
    b.release(); this.possess(p);
    from.pickBlock = 0.8; this.stun(from, 0.45);
    p.stats.tackles++; this.flowAdd(p, 15);
    this.label(p, 'STOLEN', p.aura); Sfx.tackle();
    if (this.involvesHuman(p, from)) { TimeCtl.hitStop(0.06); Shake.add(0.2); if (from.isHuman) this.toast('ROBBED', 'bad', from); if (p.isHuman) this.toast('STOLEN', 'good', p); }
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
      if (this.time - (o.feintAt == null ? -9 : o.feintAt) < 1.5) continue; // just fell for one: ready for the next, so nobody is frozen again and again
      if (dist2D(o.pos, p.pos) < radius && this.stun(o, dur)) { o.feintAt = this.time; n++; FX.sparks(o.pos.x, 2.1, o.pos.z, '#ffffff', 6, 2, 0.12, 0.5); }
    }
    const gk = this.keeperOf(1 - p.team);
    if (gk && gk.state === 'free' && dist2D(gk.pos, p.pos) < 24 && chance(0.6 - 0.35 * this.skill(gk))) AI.keeperBite(this, gk);
    Sfx.swoosh();
    if (p.isHuman && n) this.toast('FROZE ' + n, 'good', p);
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
      this.shootAt(p, aimFor(p, this, true), 1, { mult: 1.32, trail: p.aura, special: 'volley', keepPos: !(b.owner === p) });
      FX.sparks(b.pos.x, b.pos.y, b.pos.z, p.aura, 22, 7);
      if (this.involvesHuman(p)) Shake.add(0.35);
      return true;
    }
    if (b.owner === p && p.onGround && p.state === 'free') {
      this.jump(p);
      p.pickBlock = 0.6;
      b.vel.set(Math.sin(p.yaw) * 1.2, 7.8, Math.cos(p.yaw) * 1.2);
      p.pending = { t: 0.36, fn: () => { if (dist2D(b.pos, p.pos) < 2.8 && !b.owner) { this.shootAt(p, aimFor(p, this, true), 1, { mult: 1.32, trail: p.aura, special: 'volley', keepPos: true }); FX.sparks(b.pos.x, b.pos.y, b.pos.z, p.aura, 22, 7); if (this.involvesHuman(p)) Shake.add(0.35); } } };
      return true;
    }
    return NEED_BALL;
  }
  overhead(p) {
    const b = this.ball;
    const near = !b.owner && dist2D(b.pos, p.pos) < 2.8 && b.pos.y > 0.9 && b.pos.y - p.pos.y < 3.2;
    const strike = () => {
      p.flipT = 0; p.vel.y = Math.max(p.vel.y, 3); p.onGround = false;
      this.shootAt(p, aimFor(p, this, true), 1, { mult: 1.2, trail: p.aura, special: 'overhead', keepPos: true, keepYaw: true });
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
    const before = p.awakeT > 0 ? Object.assign({}, p.fx) : null;
    const res = a.def.use(p, this);
    if (res === true) {
      // awakened: whatever the ability switched on lasts 50% longer
      if (before) for (const k in p.fx) { const d = p.fx[k] - (before[k] || 0); if (d > 0) p.fx[k] = (before[k] || 0) + d * 1.5; }
      a.cd = a.def.cd;
      this.label(p, a.def.name + (before ? '+' : ''), p.aura);
      Sfx.ability();
      if (a.def.big) this.cinematic(p, a.def.name);
      return true;
    }
    if (p.isHuman && typeof res === 'string') { this.toast(res, 'bad', p); Sfx.deny(); }
    return false;
  }
  flowAdd(p, amt) {
    if (p && amt >= 10) this.awakeAdd(p, amt); // big plays fill the Awakening bar too
    if (!p || p.flowT > 0) return;
    const before = p.flow;
    p.flow = Math.min(100, p.flow + amt);
    if (p.isHuman && before < 100 && p.flow >= 100) { this.toast(Touch.on ? 'FLOW READY. TAP FLOW' : 'FLOW READY. PRESS G', 'gold', p); Sfx.coin(); Hud.flowReady(); }
  }
  awakeAdd(p, amt) {
    if (!p || (p.isGK && !p.isHuman) || p.awakeT > 0 || !p.style.awaken) return; // owner: "add awakening" for you in goal too
    const before = p.awake;
    p.awake = Math.min(100, p.awake + amt * 0.9); // a hidden meter: the fuller it is, the likelier you awaken any second
    if (p.isHuman && before < 70 && p.awake >= 70) this.label(p, 'POWER RISING', p.aura, 1.4); // owner: the effects show before it even happens
  }
  /** Awakening comes by itself: once a second each player may awaken. Big plays (p.awake) make it much likelier,
      and after one ends there is a rest before the next */
  updateAwakening(dt) {
    if (this.phase !== 'play' || this.fk || this.tut) return;
    this.awT = (this.awT || 0) + dt;
    if (this.awT < 1) return;
    this.awT -= 1;
    for (const p of this.players) {
      if ((p.isGK && !p.isHuman) || p.awakeT > 0 || !p.style.awaken || (p.awakeRest || 0) > this.time) continue;
      if (Math.random() < this.awakenChance(p)) this.activateAwaken(p);
    }
  }
  awakenChance(p) { const k = clamp(p.awake / 100, 0, 1); return 0.002 + Math.pow(k, 2) * 0.05; } // cold: about one in 8 minutes; after lots of big plays: one in about 20 seconds (owner: Awakenings should show up more)
  /** your style's Awakening: a burst of light, then AWAKEN_TIME seconds of its powers */
  activateAwaken(p) {
    const aw = p.style.awaken;
    if (!aw || (p.isGK && !p.isHuman) || p.awakeT > 0 || !this.canAct(p)) return false;
    p.awakeRest = this.time + AWAKEN_TIME + 25;
    p.awake = 0; p.awakeT = AWAKEN_TIME; p.awakeMoveUsed = false;
    for (const a of p.abil) a.cd = 0;
    // the transformation: a moment in the air that nobody can tackle (you keep the ball)
    p.charging = false; p.charge = 0; p.vel.x = p.vel.z = 0; p.setState('awaken', 0.9); p.tackleProof = Math.max(p.tackleProof, 1.0);
    if (p.isHuman) this.featsOf(p).awakens++;
    this.label(p, 'AWAKENED · ' + aw.name, p.aura, 2.4);
    FX.awakenBurst(p);
    Sfx.flow(); Sfx.cutin();
    if (p.isHuman && !this.online && !this.autopilot && Save.data.settings.cutins) { Hud.awaken(p); TimeCtl.slowMo(0.1, 2.7); Shake.add(0.4); } // the flashback (owner: like SPRINTER remembering the race he lost)
    else if (p.isHuman) { if (!this.cinematic(p, 'AWAKENING · ' + aw.name)) TimeCtl.slowMo(0.35, 0.8); Shake.add(0.4); }
    else Shake.add(0.12);
    return true;
  }
  /** an emote from the wheel: stand still for a moment and do it. Not with the ball, and once every 3 seconds */
  emote(p, i) {
    const em = EMOTES[i]; if (!em) return false;
    if (this.ball.owner === p) { if (p.isHuman) { this.toast('NOT WITH THE BALL', 'bad', p); Sfx.deny(); } return false; }
    if (p.state !== 'free' || (p.emoteCd || 0) > this.time) return false;
    p.emote = em.id; p.emoteCd = this.time + 3; p.charging = false; p.charge = 0;
    p.setState('emote', 1.6);
    this.label(p, em.name, '#ffffff', 1.3);
    return true;
  }
  /* ---------- free kick practice ---------- */
  startFreeKicks() {
    this.fk = { n: 0, total: FK_KICKS, log: [], state: 'aim', t: 0, x: 0, z: 0, keeper: !!this.cfg.keeper };
    this.fkWall = this.teams[this.cfg.keeper ? 0 : 1].filter((p) => !p.isGK);
    for (const w of this.fkWall) w.wall = true;
    if (this.cfg.keeper) for (const p of this.teams[1]) if (!p.isGK) p.wall = true; // their taker waits for his kick
    if (this.cfg.keeper) Hud.banner('KEEPER PRACTICE', Touch.on ? 'SAVE THEIR FREE KICKS: JUMP + STICK TO DIVE' : 'SAVE THEIR FREE KICKS: JUMP + A OR D TO DIVE', '#b65cff');
    else Hud.banner('FREE KICKS', 'AIM, THEN HOLD SHOOT FOR POWER', '#b65cff');
    this.nextFreeKick();
  }
  /** a new spot 16 to 27 blocks out. Like real football the wall covers the near-post half and the keeper the far
      half. Practice: always you. A free kick battle: the team whose turn it is, and the other team makes the wall */
  nextFreeKick() {
    const k = this.fk, h = this.human;
    let t = h.team;
    if (k.battle) { t = this.battleNext(); if (t < 0) { this.endBattle(); return; } }
    else if (k.n >= k.total) { this.endFreeKicks(); return; }
    if (k.keeper) t = 1 - h.team; // keeper practice: always their kick
    k.n++; k.state = 'aim'; k.t = 0; k.hit = null; k.dist = 0; k.botT = null;
    this.phase = 'play'; this.phaseT = 0; this.lastPass = null;
    const sh = t === h.team ? h : this.teams[t].find((p) => p.role === leadRole(this.rolesFor(t)));
    k.shooter = sh;
    const gz = this.oppGoalZ(t), s = sgn(gz);
    const dist = rand(16, 27), x = rand(-1, 1) * Math.min(F.W - 5, 4 + dist * 0.45), z = gz - s * dist;
    let dx = -x, dz = gz - z; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    const yaw = Math.atan2(dx, dz);
    k.x = x; k.z = z; k.dist = dist;
    sh.fkShot = { type: sh.fkShot ? sh.fkShot.type : 'curve', curve: 0 };
    for (const p of this.players) {
      p.dash = p.slide = p.dive = null; p.charging = false; p.charge = 0; p.kickT = -1; p.flipT = -1; p.pending = null; p.shotBuffer = null;
      p.vel.set(0, 0, 0); p.pos.y = 0; p.onGround = true; p.setState('free'); p.fkHold = false; p.inWall = false;
    }
    this.ball.reset(x, z);
    sh.yaw = yaw; sh.pos.set(x - dx * 0.62, 0, z - dz * 0.62); sh.fkHold = sh === h; // a bot takes it by itself (botFreeKick)
    this.possess(sh, true); sh.protect = 1;
    // the wall: the other team's outfield players, you first when it is their kick
    this.fkWall = this.teams[1 - t].filter((p) => !p.isGK).sort((a, b) => (b === h) - (a === h));
    this.teams[t].filter((p) => p !== sh && !p.isGK).forEach((p, i) => { p.pos.set(x + (i % 2 ? 1 : -1) * (3 + i), 0, z - s * (5 + i)); p.yaw = yaw; }); // your teammates stand back
    const og = this.teams[t].find((p) => p.isGK && p !== sh); if (og) { og.pos.set(0, 0, -gz + s * 1.2); og.yaw = s > 0 ? 0 : Math.PI; }
    const side = Math.abs(x) > 1 ? sgn(x) : pick([-1, 1]); // the near post (a kick from the middle: either one)
    let wx = side * F.GW * 0.5 - x, wz = gz - z; const wl = Math.hypot(wx, wz); wx /= wl; wz /= wl;
    const n = Math.min(this.fkWall.length, dist < 19 ? 4 : dist < 23 ? 3 : 2); // closer in, a bigger wall
    k.wallNow = this.fkWall.slice(0, n);
    this.fkWall.forEach((w, i) => {
      if (i < n) { const o = (i - (n - 1) / 2) * 0.85; w.pos.set(x + wx * 7 - wz * o, 0, z + wz * 7 + wx * o); w.yaw = yaw + Math.PI; if (w === h) w.inWall = true; }
      else { const j = i - n, sx = j % 2 ? -side : side; w.pos.set(sx * (F.GW + 2.2 + j), 0, gz - s * (3 + j * 1.5)); w.yaw = s > 0 ? Math.PI : 0; } // marking in the box, wide of the posts
    });
    const g = this.teams[1 - t].find((p) => p.isGK);
    if (g) { g.pos.set(-side * 0.9, 0, gz - s * 1.2); g.yaw = yaw + Math.PI; }
    if (k.keeper) this.toast('KICK ' + k.n + ' OF ' + k.total + ' · ' + Math.round(dist) + ' BLOCKS OUT · SAVE IT!', 'gold', h);
    else if (sh === h) { Hud.freeKick(yaw, dist); this.toast(k.battle ? 'YOUR KICK · ' + Math.round(dist) + ' BLOCKS OUT' : 'KICK ' + k.n + ' OF ' + k.total + ' · ' + Math.round(dist) + ' BLOCKS OUT', 'gold', h); }
    else if (h.inWall) { const yw = Math.atan2(x - h.pos.x, z - h.pos.z); h.yaw = yw; Hud.freeKick(yw, 7); this.toast(Touch.on ? 'THEIR KICK · YOU ARE IN THE WALL · TAP JUMP TO BLOCK IT' : 'THEIR KICK · YOU ARE IN THE WALL · SPACE TO JUMP AND BLOCK IT', 'gold', h); }
  }
  /* ---------- the tutorial: one step at a time on a quiet pitch ---------- */
  startTutorial() {
    this.tut = { step: -1, t: 0, t0: 0, yaw0: null, turned: 0, sprintT: 0, mark: null, goals0: 0, backT: 0 };
    for (const p of this.players) { if (!p.isHuman) p.wall = true; p.setState('free'); } // the others only do what the tutorial tells them
    const h = this.human, mate = this.teams[0].find((p) => p !== h), d = this.teams[1][0], s = this.dir(h.team);
    h.pos.set(0, 0, -12 * s); h.yaw = s > 0 ? 0 : Math.PI;
    mate.pos.set(10, 0, -4 * s); d.pos.set(-14, 0, 14 * s);
    this.ball.reset(-F.W + 1.5, -F.L + 3); // out of the way until you need it
    this.phase = 'play'; this.phaseT = 0;
    this.tutStep(0);
  }
  tutStep(i) {
    const T = this.tut, h = this.human, b = this.ball, s = this.dir(h.team), gz = this.oppGoalZ(h.team);
    const mate = this.teams[0].find((p) => p !== h), d = this.teams[1][0];
    T.step = i; T.t = 0; T.t0 = this.time; T.backT = 0;
    const id = TUT_STEPS[i].id, ahead = (k) => ({ x: clamp(h.pos.x + Math.sin(h.yaw) * k, -F.W + 3, F.W - 3), z: clamp(h.pos.z + Math.cos(h.yaw) * k, -F.L + 4, F.L - 4) });
    const give = () => { if (b.owner !== h) { b.reset(h.pos.x, h.pos.z); this.possess(h, true); } };
    if (id === 'move') T.mark = ahead(12);
    else T.mark = null;
    if (id === 'ball') { const q = ahead(5); b.reset(q.x, q.z); }
    if (id === 'pass') { give(); mate.pos.set(clamp(h.pos.x + 9, -F.W + 3, F.W - 3), 0, clamp(h.pos.z + 5 * s, -F.L + 4, F.L - 4)); mate.vel.set(0, 0, 0); }
    if (id === 'shoot') { h.pos.set(0, 0, gz - s * 15); h.yaw = s > 0 ? 0 : Math.PI; b.reset(0, gz - s * 14.4); this.possess(h, true); T.goals0 = this.score[h.team]; Hud.freeKick(h.yaw, 15); d.pos.set(-F.W + 3, 0, 0); }
    if (i > 0) Sfx.coin();
  }
  updateTutorial(dt) {
    const T = this.tut, h = this.human, b = this.ball;
    if (!T || !h || this.phase === 'end') return;
    T.t += dt;
    const d = this.teams[1][0], id = TUT_STEPS[T.step].id;
    let done = false;
    switch (id) {
      case 'move': done = Math.hypot(h.pos.x - T.mark.x, h.pos.z - T.mark.z) < 2; break;
      case 'ball': done = b.owner === h; break;
      case 'pass': done = !!(b.kick && b.kick.by === h && b.kick.type === 'pass') || !!(this.lastPass && this.lastPass.from === h && this.lastPass.t >= T.t0); break;
      case 'shoot':
        done = this.score[h.team] > T.goals0;
        if (!done && T.t > 3 && b.owner !== h && !b.owner && b.vel.lengthSq() < 0.5) { b.reset(h.pos.x, h.pos.z); this.possess(h, true); } // a miss: the ball comes back to you
        break;
      case 'done': if (T.t > 3) this.endTutorial(); break;
    }
    if (done) { d.speedMul = 1; this.tutStep(T.step + 1); }
  }
  endTutorial() {
    const h = this.human;
    this.phase = 'end'; this.phaseT = 0;
    this.result = { res: 'tutorial', score: this.score.slice(), human: Object.assign({}, h.stats), players: [] };
    h.setState('celebrate', 99); Sfx.whistle(3); Sfx.fanfare(2);
  }
  /* ---------- the free kick battle: still level after golden goal ---------- */
  startBattle() {
    this.fk = { battle: true, bs: [0, 0], kicks: [0, 0], log: [], n: 0, total: 3, state: 'done', t: -0.9, shooter: null, wallNow: [] };
    this.ball.release();
    for (const p of this.players) { p.wall = !p.isGK; p.charging = false; p.charge = 0; p.mx = p.mz = 0; }
    if (this.human) this.human.inWall = true; // you wait for the first kick
    Hud.banner('FREE KICK BATTLE', 'STILL LEVEL. 3 FREE KICKS EACH, THEN SUDDEN DEATH', '#b65cff');
    Sfx.whistle(2); Sfx.roar(0.6);
  }
  /** whose kick is next (you first), or -1 when it is decided: one side cannot catch up, or level kicks after 3 each */
  battleNext() {
    const k = this.fk, [a, b] = k.bs, [ka, kb] = k.kicks, R = k.total;
    if (ka === kb && ka >= R && a !== b) return -1;
    if (ka <= R && kb <= R && (a > b + Math.max(0, R - kb) || b > a + Math.max(0, R - ka))) return -1;
    return ka <= kb ? 0 : 1;
  }
  battleLine() { const [a, b] = this.fk.bs; return 'FREE KICK BATTLE · ' + TEAM[0].short + ' ' + a + ' : ' + b + ' ' + TEAM[1].short; }
  endBattle() {
    const k = this.fk, w = k.bs[0] > k.bs[1] ? 0 : 1, hum = this.human ? this.human.team : 0;
    k.state = 'end';
    for (const p of this.players) { p.fkHold = false; p.inWall = false; p.wall = false; }
    this.endMatch();
    this.result.res = w === hum ? 'win' : 'loss'; this.result.battle = k.bs.slice();
    Hud.banner(w === hum ? 'YOU WIN THE BATTLE' : 'THEY WIN THE BATTLE', this.battleLine(), w === hum ? '#2ee38f' : '#ff4d5e');
    for (const p of this.players) if (p.team === w) p.setState('celebrate', 99);
    World.excite[w] = 1;
  }
  /** a bot takes its free kick: mostly a curler round the wall, sometimes a dip or a power shot. Better bots are more exact */
  botFreeKick(p) {
    const b = this.ball, gz = this.oppGoalZ(p.team), sk = clamp(this.skill(p), 0, 1), wall = this.fk.wallNow || [];
    const wx = wall.length ? wall.reduce((a, w) => a + w.pos.x, 0) / wall.length : b.pos.x;
    const near = Math.abs(b.pos.x) > 1 ? sgn(b.pos.x) : (wx > b.pos.x ? 1 : -1), r = Math.random(), err = lerp(1.7, 0.5, sk);
    let type = 'curve', curve = -0.8 * near * sgn(gz), tx = -near * 6.5, ty = 2.0;
    if (r > 0.85) { type = 'power'; curve = 0; tx = -near * 3.6; ty = 2.4; } else if (r > 0.6) { type = 'dip'; curve = 0; tx = near * 3.2; ty = 2.4; }
    p.fkShot = { type, curve: clamp(curve + rand(-0.3, 0.3) * (1.2 - sk), -1, 1) };
    const t = V3(tx + rand(-err, err), ty + rand(-err, err) * 0.4, gz), D = Math.hypot(t.x - b.pos.x, t.z - b.pos.z);
    p.yaw = Math.atan2(t.x - b.pos.x, t.z - b.pos.z);
    return this.freeKickShot(p, fkIdeal(D) + rand(-1, 1) * lerp(0.16, 0.06, sk), t);
  }
  /** lining up a free kick: aim with the camera, A/D (stick) sets the curve, pass changes the kick type,
      hold shoot for power and let go. Abilities are off */
  freeKickControls(dt, c, p, cy) {
    const s = p.fkShot || (p.fkShot = { type: 'curve', curve: 0 });
    p.faceYaw = cy;
    if (Math.abs(c.moveX) > 0.15) s.curve = clamp(s.curve + c.moveX * dt * 1.4, -1, 1);
    if (c.passDown) { s.type = FK_TYPE_IDS[(FK_TYPE_IDS.indexOf(s.type) + 1) % FK_TYPE_IDS.length]; Sfx.click(); }
    for (let i = 0; i < 3; i++) if (c.ab[i]) { this.toast('ABILITIES ARE OFF ON FREE KICKS', 'bad', p); Sfx.deny(); }
    if (c.shootDown && !p.charging) { p.charging = true; p.charge = 0; }
    if (p.charging) {
      if (!c.shootHeld && !c.shootUp) { p.charging = false; p.charge = 0; }
      else p.charge = Math.min(1, p.charge + dt / 1.1); // a little slower than a normal shot, so you can hit the green zone
    }
    if (c.shootUp && p.charging) {
      const power = p.charge; p.charging = false; p.charge = 0;
      this.freeKickShot(p, power, p.aimV || this.aim);
    }
  }
  /** the launch for a free kick: towards your target, bending with the spin. Off the perfect power it flies too
      high (over the bar) or too low (into the wall) */
  fkLaunch(p, power, target) {
    const s = p.fkShot, T0 = FK_TYPES[s.type], b = this.ball;
    const fx = b.pos.x, fz = b.pos.z, fy = BALL_R;
    const dx = target.x - fx, dz = target.z - fz, D = Math.hypot(dx, dz) || 1, ux = dx / D, uz = dz / D;
    const err = power - fkIdeal(D), miss = Math.abs(err) > FK_TOL ? err - Math.sign(err) * FK_TOL : 0;
    const ty = target.y + miss * 9;
    const sp = lerp(T0.sp[0], T0.sp[1], clamp(power, 0, 1)) * p.mods.shot, g = BALL_G * T0.g, T = D / sp;
    const vy = clamp((ty - fy + 0.5 * g * T * T) / T, -3, 16);
    const acc = s.curve * T0.curve;
    return { fx, fy, fz, vx: ux * sp, vy, vz: uz * sp, cx: -uz * acc, cz: ux * acc, g: T0.g, T };
  }
  freeKickShot(p, power, target) {
    const L = this.fkLaunch(p, power, target), s = p.fkShot;
    p.stats.shots++;
    if (power > 0.8) FX.dirt(p.pos.x, p.pos.z, Math.sin(p.yaw), Math.cos(p.yaw), 6, 0.7);
    return this.kick(p, L.vx, L.vy, L.vz, { type: 'shot', cx: L.cx, cz: L.cz, curveDecay: 0, gMul: L.g, trail: p.aura, special: s.type === 'power' ? 'knuckle' : null, kickStyle: 'strike', kickDur: 0.45 });
  }
  /** the first part of the ball's path at perfect power (the dotted line): you see if it clears the wall, not where it ends */
  fkPath(p, target, frac = 0.42) {
    const L = this.fkLaunch(p, fkIdeal(Math.hypot(target.x - this.ball.pos.x, target.z - this.ball.pos.z)), target), out = [];
    let x = L.fx, y = L.fy, z = L.fz, vx = L.vx, vy = L.vy, vz = L.vz;
    const h = 1 / 60, steps = Math.ceil(L.T * frac / h);
    for (let i = 1; i <= steps; i++) {
      vy -= BALL_G * L.g * h; vx += L.cx * h; vz += L.cz * h;
      const k = 1 - 0.05 * h; vx *= k; vy *= k; vz *= k;
      x += vx * h; y += vy * h; z += vz * h;
      if (i % 3 === 0) out.push({ x, y, z });
    }
    return out;
  }
  updateFreeKick(dt) {
    const k = this.fk, b = this.ball;
    if (!k || this.phase !== 'play') return;
    k.t += dt;
    if (k.state === 'done') { if (k.t > 1.8) this.nextFreeKick(); return; }
    const sh = k.shooter; if (!sh) return;
    if (k.state === 'aim') {
      if (b.owner === sh) { // stand behind the ball as you turn, so it stays on its spot
        sh.pos.x = k.x - Math.sin(sh.yaw) * 0.62; sh.pos.z = k.z - Math.cos(sh.yaw) * 0.62; sh.vel.x = sh.vel.z = 0; sh.protect = Math.max(sh.protect, 0.3);
        if (!sh.isHuman) { if (k.botT == null) k.botT = rand(1.4, 2.3); if (k.t > k.botT) this.botFreeKick(sh); }
        return;
      }
      k.state = 'flight'; k.t = 0; sh.fkHold = false; // it is taken: the wall jumps (you jump yourself)
      if (k.battle) k.kicks[sh.team]++;
      for (const w of k.wallNow || this.fkWall) if (!w.isHuman && w.onGround && chance(0.6)) { w.vel.y = rand(6, 7.5); w.onGround = false; }
      return;
    }
    if (k.state === 'flight') {
      const o = b.owner, lt = b.lastTouch;
      if (lt && lt.team !== sh.team) k.hit = lt.isGK ? 'SAVED' : 'BLOCKED'; // the keeper or the wall got a touch on it
      if (o && o.team !== sh.team) this.fkResult(k.hit);
      else if (o && o.team === sh.team && k.hit) this.fkResult(k.hit); // it came back off the wall
      else if (k.t > 4.5 || (k.t > 1.2 && !o && b.vel.lengthSq() < 1)) this.fkResult(k.hit || 'MISS');
    }
  }
  fkResult(what) {
    const k = this.fk; if (!k || k.state !== 'flight') return;
    k.state = 'done'; k.t = 0; k.log.push(what);
    if (k.battle) {
      const mine = this.human && k.shooter.team === this.human.team;
      Hud.banner(what, this.battleLine(), mine ? '#ff4d5e' : '#2ee38f', true);
      if (mine) Sfx.deny(); else Sfx.coin();
      return;
    }
    this.score[1]++;
    Hud.banner(what, 'KICK ' + k.n + ' OF ' + k.total, what === 'MISS' ? '#ff4d5e' : '#ffcb3d', true);
    if (what === 'MISS') Sfx.deny();
  }
  endFreeKicks() {
    const k = this.fk, h = this.human, goals = k.log.filter((r) => r === 'GOAL').length;
    k.state = 'end'; h.fkHold = false;
    this.phase = 'end'; this.phaseT = 0;
    const saved = k.total - goals; // keeper practice counts what you kept out
    this.result = { res: 'practice', practice: { goals: k.keeper ? saved : goals, total: k.total, log: k.log.slice(), keeper: k.keeper }, score: [goals, k.total - goals], human: Object.assign({}, h.stats), players: [] };
    if (k.keeper) { Hud.banner('KEEPER PRACTICE', saved + ' OF ' + k.total + ' KEPT OUT', saved >= 7 ? '#2ee38f' : saved >= 4 ? '#ffcb3d' : '#ff4d5e'); Sfx.whistle(3); if (saved >= 7) h.setState('celebrate', 99); return; }
    Hud.banner('FREE KICKS', goals + ' OF ' + k.total + ' SCORED', goals >= 7 ? '#2ee38f' : goals >= 4 ? '#ffcb3d' : '#ff4d5e');
    Sfx.whistle(3);
    if (goals >= 7) h.setState('celebrate', 99);
  }
  /** WARDEN's BODY BLOCK: a shot or pass from the other team that comes close stops dead at your feet */
  updateBlocks() {
    const b = this.ball;
    for (const p of this.players) {
      if (p.starfall && p.onGround && p.vel.y <= 0) { // COMET's STARFALL lands
        p.starfall = false;
        for (const o of this.opponents(p)) if (!o.isGK && dist2D(o.pos, p.pos) < 4.5) this.knockDown(o, 1.3, o.pos.x - p.pos.x, o.pos.z - p.pos.z, 4, p);
        FX.ring(p.pos.x, 0.2, p.pos.z, p.aura, 4.5, 40); FX.sparks(p.pos.x, 0.4, p.pos.z, p.aura, 30, 8); Shake.add(this.involvesHuman(p) ? 0.4 : 0.1); Sfx.boom();
      }
      if (!(p.fx.block > 0) || p.state !== 'free' || b.owner || b.vel.lengthSq() < 36) continue;
      const k = b.kick; if (k && k.by && k.by.team === p.team) continue;
      if (dist2D(b.pos, p.pos) < 1.7 && b.pos.y < 2.3) {
        b.vel.set(0, 0, 0); this.possess(p); p.fx.block = 0;
        this.label(p, 'BLOCKED', p.aura); FX.ring(p.pos.x, 0.3, p.pos.z, p.aura, 1.8, 24); Sfx.save();
      }
    }
  }
  /** WARDEN's CLEARANCE: high and long up the pitch */
  clearance(p) {
    const s = this.dir(p.team), side = rand(-0.35, 0.35), l = Math.hypot(side, 1);
    return this.kick(p, side / l * 24, 12, s / l * 24, { type: 'clear', kickStyle: 'strike', kickDur: 0.4 });
  }
  /** MAESTRO's ONE-TWO: pass to a teammate, who plays it straight back into your run */
  oneTwo(p, mate) {
    if (!this.passTo(p, mate)) return false;
    this.oneTwoBack = { from: mate, to: p, t: this.time };
    return true;
  }
  /** a human asks for the move: say why when it cannot happen */
  tryAwakenMove(p) {
    if (p.awakeMoveUsed) { this.toast('MOVE ALREADY USED THIS AWAKENING', 'bad', p); Sfx.deny(); return false; }
    const r = this.awakenMove(p);
    if (typeof r === 'string') { this.toast(r, 'bad', p); Sfx.deny(); return false; }
    return r;
  }
  /** each style's signature move, once per Awakening. Returns true, or a reason it cannot happen now */
  awakenMove(p) {
    const aw = p.style.awaken, mv = aw && aw.move;
    if (!mv || p.awakeT <= 0 || p.awakeMoveUsed) return false;
    if (!this.canAct(p)) return 'NOT NOW';
    const r = this.powerMove(p, mv.kind, p.aura);
    if (r !== true) return r;
    p.awakeMoveUsed = true;
    this.label(p, mv.name, p.aura, 1.8);
    FX.sparks(p.pos.x, 1.2, p.pos.z, p.aura, 30, 8, 0.2); Sfx.cutin();
    if (p.isHuman) this.cinematic(p, mv.name);
    return true;
  }
  /** OMEGA CORES: a person presses the item button for their core power; say why when it cannot happen */
  tryCore(p) {
    if (p.corePow == null) { if (this.phase === 'play') { this.toast('SCORE TO TAKE A CORE AND ITS POWER', 'bad', p); Sfx.deny(); } return false; }
    const r = this.useCore(p);
    if (typeof r === 'string') { this.toast(r, 'bad', p); Sfx.deny(); return false; }
    return r;
  }
  /** use the power of the core you took (CORE_POWERS), once. Returns true, or a reason it cannot happen now */
  useCore(p) {
    if (p.corePow == null || this.phase !== 'play') return false;
    if (!this.canAct(p)) return 'NOT NOW';
    const cp = CORE_POWERS[p.corePow], hex = RARITY_HEX[RARITIES[p.corePow]];
    const r = this.powerMove(p, cp.kind, hex);
    if (r !== true) return r;
    p.corePow = null;
    this.label(p, cp.name, hex, 1.8);
    FX.sparks(p.pos.x, 1.2, p.pos.z, hex, 30, 8, 0.2); FX.ring(p.pos.x, 1.0, p.pos.z, hex, 1.2, 20); Sfx.cutin();
    if (p.isHuman) this.cinematic(p, cp.name);
    return true;
  }
  /** a goal in OMEGA CORES: the power of the best core it took goes to the scorer, or to a person on that team when a bot
      scored (playing with bots you get your team's powers); someone already holding a better power keeps theirs */
  heistPower(team, r, scorer) {
    if (r == null || r < 0) return null;
    const T = this.teams[team], mine = scorer && scorer.team === team ? scorer : null;
    const p = (mine && mine.isHuman && mine) || T.find((q) => q.isHuman && q.corePow == null) || mine || T.find((q) => !q.isGK && q.corePow == null);
    if (!p || (p.corePow != null && p.corePow > r)) return null;
    p.corePow = r;
    return p;
  }
  /** the big moves, shared by the Awakenings and the OMEGA CORES powers (hex: their colour). Returns true, or a reason it
      cannot happen now (false: no such move) */
  powerMove(p, kind, hex) {
    const b = this.ball, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const aim = p.isHuman ? p.aimV || this.aim : AI.shotTarget(p, this); // a bot aims for itself, not where you aim
    switch (kind) {
      case 'vision': p.fx.vision = Math.max(p.fx.vision || 0, 8); p.fx.burst = Math.max(p.fx.burst || 0, 3); break;
      case 'lightspeed': p.tackleProof = Math.max(p.tackleProof, 0.8); this.dashP(p, fx, fz, 30, 0.55); FX.ring(p.pos.x, 0.2, p.pos.z, hex, 1.6, 24); break;
      case 'shadow':
        p.tackleProof = Math.max(p.tackleProof, 0.6); this.dashP(p, fx, fz, 26, 0.32);
        for (const o of this.opponents(p)) if (!o.isGK && dist2D(o.pos, p.pos) < 5.5) this.stun(o, 1.1, 'frozen');
        FX.feathers(p.pos.x, 1, p.pos.z, '#121018', 16); break;
      case 'storm':
        for (const o of this.opponents(p)) if (!o.isGK && dist2D(o.pos, p.pos) < 7 && this.stun(o, 1.3)) this.label(o, 'ANKLES', hex);
        FX.ring(p.pos.x, 0.2, p.pos.z, hex, 4, 36); break;
      case 'shockwave':
        for (const o of this.opponents(p)) if (!o.isGK && dist2D(o.pos, p.pos) < 5.5) this.knockDown(o, 1.4, o.pos.x - p.pos.x, o.pos.z - p.pos.z, 4, p);
        FX.ring(p.pos.x, 0.3, p.pos.z, hex, 5, 40); FX.ring(p.pos.x, 0.3, p.pos.z, '#ffffff', 3, 30); Shake.add(0.3); break;
      case 'pull': {
        if (b.owner === p) return 'YOU HAVE THE BALL';
        if (b.owner && b.owner.team === p.team) return 'A TEAMMATE HAS IT';
        if (this.safeGK(b.owner)) return 'THE KEEPER HAS IT';
        if (dist2D(b.pos, p.pos) > 14) return 'THE BALL IS TOO FAR';
        if (b.owner) { const o = b.owner; b.release(); o.pickBlock = 0.6; }
        FX.trail(b.pos.x, b.pos.y, b.pos.z, hex, 0.4, 0.5); this.possess(p); break;
      }
      case 'pounce': {
        if (b.owner === p) return 'YOU HAVE THE BALL';
        if (b.owner && b.owner.team === p.team) return 'A TEAMMATE HAS IT';
        if (this.safeGK(b.owner)) return 'THE KEEPER HAS IT';
        const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z, d = len2D(dx, dz);
        if (d > 16) return 'THE BALL IS TOO FAR';
        p.tackleProof = Math.max(p.tackleProof, 0.6);
        this.dashP(p, dx / (d || 1), dz / (d || 1), Math.max(14, d / 0.35), 0.35, { onEnd: () => { const o = this.ball.owner; if ((!o || o.team !== p.team) && dist2D(this.ball.pos, p.pos) < 2.6) { if (o) { this.ball.release(); o.pickBlock = 0.6; } this.possess(p); } } });
        break;
      }
      case 'skycannon':
        if (b.owner !== p) return 'NEED THE BALL';
        this.shootAt(p, aim, 1.25, { aerial: true, mult: 1.1 }); FX.sparks(b.pos.x, 1.4, b.pos.z, hex, 24, 6); break;
      case 'bolt':
        if (b.owner !== p) return 'NEED THE BALL';
        this.impactShot(p, aim); Shake.add(0.35); break;
      case 'fortress':
        for (const o of this.opponents(p)) if (!o.isGK && dist2D(o.pos, p.pos) < 7) o.fx.slimed = 3;
        FX.ring(p.pos.x, 0.2, p.pos.z, hex, 7, 48); break;
      case 'symphony':
        for (const q of this.teams[p.team]) if (!q.isGK) q.fx.burst = Math.max(q.fx.burst || 0, 3);
        p.fx.vision = Math.max(p.fx.vision || 0, 6); FX.ring(p.pos.x, 0.2, p.pos.z, hex, 4, 36); break;
      case 'steal': {
        const o = b.owner;
        if (!o || o.team === p.team) return 'NO CARRIER NEAR';
        if (this.safeGK(o)) return 'THE KEEPER HAS IT';
        const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = len2D(dx, dz);
        if (d > 10) return 'TOO FAR';
        p.tackleProof = Math.max(p.tackleProof, 0.6);
        this.dashP(p, dx / (d || 1), dz / (d || 1), Math.max(16, d / 0.32), 0.32, { home: o, onEnd: () => { const c = this.ball.owner; if (c && c.team !== p.team && !this.safeGK(c) && dist2D(c.pos, p.pos) < 2.8 && !(c.fx.bubble > 0)) { this.ball.release(); c.pickBlock = 0.6; this.possess(p); this.label(p, 'STOLEN', hex); } } });
        break;
      }
      case 'worldstop': // ZENITH: the world stops around you, and you go
        for (const o of this.opponents(p)) if (!o.isGK && dist2D(o.pos, p.pos) < 12) this.stun(o, 1.5, 'frozen');
        p.fx.burst = Math.max(p.fx.burst || 0, 3); p.tackleProof = Math.max(p.tackleProof, 0.8);
        FX.ring(p.pos.x, 0.2, p.pos.z, '#ffffff', 6, 48); FX.ring(p.pos.x, 0.3, p.pos.z, hex, 10, 60); Shake.add(0.3); break;
      case 'starfall':
        if (!p.onGround) return 'ON THE GROUND ONLY';
        p.vel.y = 15; p.onGround = false; p.starfall = true; FX.ring(p.pos.x, 0.2, p.pos.z, hex, 1.6, 24); break;
      case 'giant': // the GIANT core: bigger, faster, harder shots, nobody can tackle you (Player.computeMods, animate)
        p.fx.giant = GIANT_TIME; p.tackleProof = Math.max(p.tackleProof, 0.5);
        FX.ring(p.pos.x, 0.2, p.pos.z, hex, 3, 36); FX.ring(p.pos.x, 0.3, p.pos.z, '#ffd54a', 2, 24); Shake.add(0.25); Sfx.punch(); break;
      default: return false;
    }
    return true;
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
      if (p.isHuman) this.toast('GAMBLE ROLLED ' + what, 'gold', p);
    } else this.label(p, f ? f.name : 'FLOW', f ? f.color : p.aura);
    if (f && f.start) {
      if (f.start.stamina) { p.stamina = 100; p.exhausted = false; }
      if (f.start.resetCd) for (const a of p.abil) a.cd = 0;
    }
    p.P.eyes.visible = true;
    const fc = f ? f.color : p.aura;
    FX.sparks(p.pos.x, 1, p.pos.z, fc, 40, 8, 0.2); FX.ring(p.pos.x, 0.2, p.pos.z, fc, 1.4, 24);
    Sfx.flow();
    if (p.isHuman) { if (!this.cinematic(p, 'FLOW · ' + (f ? f.name : 'RAW'))) TimeCtl.slowMo(0.3, 0.7); Shake.add(0.25); }
    return true;
  }
  /** the anime moment for your big moves: slow motion, a camera punch-in, and a comic cut-in with your face
      and the move name over speed lines. Under a second, then straight back to play. Off in the settings */
  cinematic(p, name) {
    if (this.online) { if (p.isHuman) Hud.cutin(p, name); return false; } // online: the cut-in plays on that player's screen only, no slow motion for everyone
    if (!p.isHuman || this.autopilot || !Save.data.settings.cutins) return false;
    TimeCtl.slowMo(0.3, 0.7); Cam.punch(0.75); Hud.cutin(p, name); Sfx.cutin();
    return true;
  }
  /** a human's moments for the weekly challenges (online each player has their own) */
  featsOf(p) { return this.online ? (p.feats || (p.feats = { curler: 0, volley: 0, longShot: 0, ankles: 0, awakens: 0, trailed: false })) : this.feats; }
  /* ---------- King of the Hill ---------- */
  buildHill() {
    const g = new THREE.Group();
    const mk = (geo, op) => { const me = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); me.rotation.x = -Math.PI / 2; g.add(me); return me; };
    const r = 5.2;
    mk(new THREE.RingGeometry(r - 0.45, r, 40, 1), 0.85); mk(new THREE.CircleGeometry(r - 0.45, 40), 0.14);
    g.position.y = 0.04;
    this.scene.add(g);
    this.hill = { x: 0, z: 0, r, tx: 0, tz: 0, moveT: 6, holdT: 0, holder: -1, mesh: g };
  }
  /** the ring drifts round the pitch; the team holding the ball inside it scores a point a second */
  updateHill(dt) {
    const H = this.hill, dx = H.tx - H.x, dz = H.tz - H.z, d = len2D(dx, dz);
    H.moveT -= dt;
    if (d < 0.5 || H.moveT <= 0) { H.tx = rand(-F.W + 8, F.W - 8); H.tz = rand(-F.L + 12, F.L - 12); H.moveT = 16; }
    else { H.x += dx / d * 2.2 * dt; H.z += dz / d * 2.2 * dt; }
    const o = this.ball.owner, team = o && !o.isGK && dist2D(o.pos, H) < H.r ? o.team : -1;
    if (team !== H.holder) { H.holder = team; H.holdT = 0; }
    if (team >= 0) {
      H.holdT += dt;
      if (H.holdT >= 1) { H.holdT -= 1; this.score[team]++; this.label(o, '+1', TEAM[team].hex, 0.8); Sfx.coin(); if (this.golden) this.endMatch(); }
    }
    H.mesh.position.set(H.x, 0.04, H.z);
    const c = H.mesh.children;
    c[0].material.color.copy(col(team >= 0 ? TEAM[team].hex : '#f5efe0'));
    c[1].material.color.copy(c[0].material.color);
    c[0].material.opacity = 0.7 + Math.sin(this.time * 6) * 0.15;
  }
  /** V (R3, SWITCH on a phone): take over the teammate with the ball, else the one nearest the ball. Offline matches, not in
      free kicks, the tutorial or the training drills (owner, Nov 2026: "a teammate has the ball but I still can't control him") */
  trySwitch(p) {
    if (this.online || this.fk || this.tut || this.drill || !p) return false;
    const b = this.ball, mates = this.teams[p.team].filter((q) => q !== p && !q.isGK);
    if (!mates.length) return false;
    const carrier = b.owner && b.owner.team === p.team && b.owner !== p && !b.owner.isGK ? b.owner : null;
    const t = carrier || mates.reduce((a, q) => (dist2D(q.pos, b.pos) < dist2D(a.pos, b.pos) ? q : a));
    this.switchTo(t); Sfx.click();
    return true;
  }
  /** MY TEAM: a substitution (pause menu SUBS). A bench character comes on in the same spot for one of your bots; the one
      coming off goes to the bench. SUBS_MAX a match */
  subIn(old, id) {
    const i = this.bench.indexOf(id), h = this.human;
    if (!old || old.isHuman || !h || old.team !== h.team || i < 0 || this.subsLeft <= 0 || !STYLES[id] || this.online) return false;
    const num = old.number; // the shirt number stays with the spot
    const p = new Player(this, { team: old.team, role: old.role, human: false, style: id, flow: chance(0.85) ? pick(FLOW_IDS) : null, look: botLook(), skin: null, number: num, name: pick(BOT_NAMES.filter((n) => !this.players.some((q) => q.name === n))) || old.name });
    p.pos.copy(old.pos); p.yaw = old.yaw;
    const b = this.ball, had = b.owner === old;
    this.players[this.players.indexOf(old)] = p; const T = this.teams[old.team]; T[T.indexOf(old)] = p;
    if (had) { b.owner = null; this.possess(p, true); }
    if (this.lastPass && (this.lastPass.from === old || this.lastPass.to === old)) this.lastPass = null;
    if (this.caller === old) this.caller = p;
    old.dispose();
    this.bench[i] = old.styleId; this.subsLeft--;
    this.label(p, 'SUB ON', '#2ee38f', 1.6); FX.ring(p.pos.x, 0.2, p.pos.z, '#2ee38f', 1.6, 24); Sfx.whistle(1);
    return p;
  }
  /** you take over a teammate (V, or in STORY whoever gets the ball); the player you left plays on as a bot */
  switchTo(p) {
    const h = this.human;
    if (!h || p === h || p.team !== h.team) return;
    h.isHuman = false; h.charging = false; h.charge = 0; h.passHold = 0; h.shotBuffer = null; h.mx = h.mz = 0; h.callT = 0;
    if (h.ai) h.ai.wantShot = null;
    p.isHuman = true; p.charging = false; if (p.ai) p.ai.wantShot = null;
    this.human = p; if (this.caller === h) this.caller = p;
    this.label(p, 'YOU', '#ffcb3d', 1.2);
    Hud.switched(p);
  }
  /* ---------- TRAINING drills (DRILLS in 07_data.js) ---------- */
  startDrill() {
    const kind = this.cfg.drill, h = this.human, s = this.dir(h.team);
    const D = this.drill = { kind, t: 0, n: 0, stops: 0, goals: 0, wait: 0, go: 1.4, done: false, gates: [], meshes: [], par: [0, 0, 0] };
    this.phase = 'play'; this.phaseT = 0;
    if (kind === 'run') {
      D.gates = DRILL_GATES.map(([x, z]) => ({ x, z: z * s }));
      let L = 0, px = DRILL_START[0], pz = DRILL_START[1] * s;
      for (const g of D.gates) { L += Math.hypot(g.x - px, g.z - pz); px = g.x; pz = g.z; }
      D.par = [L / 6.2, L / 7.6, L / 8.8]; // 1, 2 and 3 stars (a run is 7.6 blocks a second, a sprint 11.4 until the stamina runs out)
      h.pos.set(DRILL_START[0], 0, DRILL_START[1] * s); h.vel.set(0, 0, 0); h.yaw = s > 0 ? 0 : Math.PI;
      this.ball.reset(F.W - 2, -F.L * s + 2); // out of the way
      for (const p of this.players) if (p !== h) p.wall = true;
      if (World.renderer) D.gates.forEach((g, i) => {
        const grp = new THREE.Group(), ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.3, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; grp.add(ring);
        for (const sx of [-2.4, 2.4]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); pole.position.set(sx, 1.3, 0); grp.add(pole); }
        grp.position.set(g.x, 0, g.z); this.scene.add(grp); D.meshes.push(grp);
      });
      this.drillPaint();
      Hud.banner('SPRINT DRILL', 'RUN THROUGH THE 8 GATES IN ORDER', DRILLS.drillrun.hex, true);
    } else { this.drillAttack(); Hud.banner('DEFENDING DRILL', 'STOP ' + DRILL_ATTACKS + ' ATTACKS: WIN THE BALL OR PUT IT OUT', DRILLS.drilldef.hex, true); }
  }
  /** SPRINT: the next gate gold, the ones after it white, the ones done gone */
  drillPaint() {
    const D = this.drill;
    D.meshes.forEach((g, i) => { g.visible = i >= D.n; const c = i === D.n ? 0xffcb3d : 0xffffff; g.children.forEach((o) => o.material.color.setHex(c)); });
  }
  /** DEFENDING: a new attack from the halfway line, their striker with the ball */
  drillAttack() {
    const D = this.drill, h = this.human, s = this.dir(h.team), b = this.ball;
    D.t = 0; D.wait = 0;
    const st = this.teams[1].find((p) => p.role === 'ST'), mid = this.teams[1].find((p) => p.role === 'MID'), x = rand(-10, 10);
    for (const p of this.players) { p.setState('free'); p.vel.set(0, 0, 0); p.wall = false; p.charging = false; p.dash = null; p.slide = null; p.kickT = -1; }
    st.pos.set(x, 0, 0); mid.pos.set(x > 0 ? x - 12 : x + 12, 0, 6 * s); st.yaw = mid.yaw = s > 0 ? Math.PI : 0;
    h.pos.set(0, 0, -30 * s); h.yaw = s > 0 ? 0 : Math.PI;
    const gk = this.keeperOf(h.team); if (gk) gk.pos.set(0, 0, -(F.L - 2) * s);
    b.reset(st.pos.x, st.pos.z); b.kick = null; this.possess(st, true);
    this.phase = 'play';
  }
  updateDrill(dt) {
    const D = this.drill, h = this.human;
    if (!D || D.done || !h) return;
    if (D.kind === 'run') {
      if (D.go > 0) { // ready... GO!
        D.go -= dt; h.pos.set(DRILL_START[0], 0, DRILL_START[1] * this.dir(h.team)); h.vel.set(0, 0, 0);
        if (D.go <= 0) { Hud.banner('GO!', '', '#2ee38f', true); Sfx.whistle(1); }
        return;
      }
      D.t += dt;
      const g = D.gates[D.n];
      if (g && Math.hypot(h.pos.x - g.x, h.pos.z - g.z) < 2.5) {
        D.n++; FX.ring(g.x, 0.2, g.z, '#2ee38f', 2.4, 24); FX.sparks(g.x, 1.2, g.z, '#ffcb3d', 14, 5); Sfx.coin(); this.drillPaint();
        if (D.n >= D.gates.length) this.endDrill(); else this.label(h, D.n + ' / ' + D.gates.length, '#ffcb3d', 0.8);
      }
      const ng = D.meshes[D.n]; if (ng) ng.scale.setScalar(1 + Math.sin(this.time * 8) * 0.06);
      return;
    }
    if (D.wait > 0) { D.wait -= dt; if (D.wait <= 0) { if (D.n >= DRILL_ATTACKS) this.endDrill(); else this.drillAttack(); } return; }
    D.t += dt;
    const o = this.ball.owner;
    if ((o && o.team === h.team) || D.t > 25) this.drillEvent('won'); // you (or your keeper) have it, or they ran out of ideas
  }
  /** DEFENDING: one attack is over (won, put out or a goal) */
  drillEvent(kind) {
    const D = this.drill;
    if (!D || D.kind !== 'def' || D.wait > 0 || D.done) return;
    D.n++;
    if (kind === 'goal') { D.goals++; Hud.banner('GOAL', 'ATTACK ' + D.n + ' OF ' + DRILL_ATTACKS, '#ff4d5e', true); Sfx.deny(); }
    else { D.stops++; Hud.banner('STOPPED!', 'ATTACK ' + D.n + ' OF ' + DRILL_ATTACKS + ' · ' + D.stops + ' STOPPED', '#2ee38f', true); Sfx.coin(); }
    for (const p of this.teams[1]) { p.wall = true; p.mx = p.mz = 0; }
    D.wait = 1.4; this.phase = 'play';
  }
  endDrill() {
    const D = this.drill; if (D.done) return;
    D.done = true;
    const score = D.kind === 'run' ? Math.round(D.t * 100) / 100 : D.stops, stars = Drill.stars(D.kind, score, D.par);
    this.result = { res: 'drill', drill: { kind: D.kind, mode: this.mode, score, stars, par: D.par } };
    this.phase = 'end'; this.phaseT = 0; Sfx.whistle(3);
    Hud.banner(D.kind === 'run' ? score.toFixed(2) + ' SECONDS' : D.stops + ' OF ' + DRILL_ATTACKS + ' STOPPED', stars ? stars + (stars > 1 ? ' STARS' : ' STAR') : 'TRY AGAIN FOR A STAR', '#ffcb3d', true);
  }
  /** CHAOS: the twist on now (CHAOS_TWISTS), or null */
  twist() { return this.chaos && this.chaos.on ? CHAOS_TWISTS[this.chaos.on] : null; }
  /** CHAOS: a twist for CHAOS_LEN seconds, then CHAOS_GAP seconds of normal football, then another (never the same twice) */
  updateChaos(dt) {
    const C = this.chaos, T = this.twist();
    if (T && T.big) for (const p of this.players) p.fx.big = Math.max(p.fx.big || 0, 0.3); // GIANTS: everyone looks giant (no other change)
    if (this.phase !== 'play' && this.phase !== 'out') return;
    C.t -= dt;
    if (C.t > 0) return;
    if (C.on) { Hud.banner('NORMAL AGAIN', T.name + ' IS OVER', '#ffffff', true); C.on = null; C.t = CHAOS_GAP; return; }
    C.on = C.last = pick(Object.keys(CHAOS_TWISTS).filter((k) => k !== C.last)); C.t = CHAOS_LEN;
    const N = CHAOS_TWISTS[C.on];
    Hud.banner('CHAOS: ' + N.name, N.sub, N.hex, true); Sfx.whistle(2); Sfx.roar(0.5);
  }
  /** BOMB BALL: the fuse burns in open play; at zero the ball goes off */
  updateBomb(dt) {
    if (this.phase === 'play') { this.bomb.t -= dt; if (this.bomb.t <= 0) { this.bombGoesOff(); return; } }
    bombFx(this, dt);
  }
  /** the ball goes off: everyone near is knocked over and the team in whose half it was gives away a point (team 0 defends -Z) */
  bombGoesOff() {
    const b = this.ball, x = b.pos.x, z = b.pos.z, bombed = z < 0 ? 0 : 1, team = 1 - bombed;
    if (b.owner) b.release();
    for (const p of this.players) {
      const dx = p.pos.x - x, dz = p.pos.z - z, d = len2D(dx, dz);
      if (d < BOMB_R) this.knockDown(p, 1.6, dx / (d || 1), dz / (d || 1), 7);
    }
    b.vel.set(0, 7, 0); b.kick = null;
    Hud.bomb(x, z);
    this.score[team]++;
    Hud.banner('BOOM!', 'IT WENT OFF IN ' + TEAM[bombed].name + ' HALF · +1 ' + TEAM[team].name, TEAM[team].hex);
    this.lastGoal = { team, scorer: null, assister: null, own: false, bomb: true };
    this.phase = 'goal'; this.phaseT = 0; this.bomb.t = BOMB_FUSE;
    World.excite[team] = 1;
  }
  /** OMEGA CORES: both teams start with the same cores; the score is what each team's cores are worth */
  buildHeist() {
    this.heist = { v: [HEIST_START.slice(), HEIST_START.slice()], jack: 0, last: null, cleaned: null };
    this.score[0] = this.score[1] = heistValue(HEIST_START);
    if (World.renderer) this.vaultView = new VaultView(this); // the cores on the crossbars and the arm bands (screens only, not the server)
  }
  updateHeist(dt) {
    const H = this.heist;
    // half way through, the GENERATIONAL core drops over the centre spot: the next goal takes it as well
    if (H.jack === 0 && !this.golden && this.phase === 'play' && this.clock <= this.len / 2) {
      H.jack = 1;
      Hud.banner('JACKPOT!', 'A GENERATIONAL CORE DROPPED · THE NEXT GOAL TAKES IT (+' + HEIST_VAL[HEIST_JACK] + ')', '#c9d2dc');
      Sfx.roar(0.6); Sfx.coin();
    }
    if (this.vaultView) { this.vaultView.set(H.v, H.jack); this.vaultView.update(dt); }
  }
  /** a goal for team: take the other team's best core (and the GENERATIONAL one if it is out) */
  heistSteal(team) {
    const H = this.heist, from = H.v[1 - team], to = H.v[team];
    let r = -1;
    if (from.length) { let bi = 0; for (let i = 1; i < from.length; i++) if (from[i] > from[bi]) bi = i; r = from.splice(bi, 1)[0]; to.push(r); }
    const jack = H.jack === 1;
    if (jack) { H.jack = 2; to.push(HEIST_JACK); }
    H.last = { team, r, jack, t: this.time };
    this.score[0] = heistValue(H.v[0]); this.score[1] = heistValue(H.v[1]);
    if (!from.length) { H.cleaned = 1 - team; this.pendingEnd = true; } // they have no cores left: the OMEGA SNAP at the whistle
  }
  /** shots with a personality: the long bomb dips late, the knuckleball wobbles */
  updateBallSpecials(dt) {
    const b = this.ball, k = b.kick;
    if (b.owner || !k || k.type !== 'shot') return;
    const age = this.time - k.t;
    if (k.special === 'bomb' && age > 0.25 && b.pos.y > 0.5) b.vel.y -= 9 * dt;
    if (k.special === 'knuckle' && b.pos.y > 0.4 && age < 1.6) {
      if (k.wob == null) k.wob = rand(0, TAU);
      const hl = len2D(b.vel.x, b.vel.z) || 1, w = Math.sin(age * 19 + k.wob) * 10;
      b.curve.set(-b.vel.z / hl * w, 0, b.vel.x / hl * w); b.curveDecay = 0;
    }
  }
  /** through the legs of the defender in front, then round him to collect it */
  nutmeg(p) {
    if (this.ball.owner !== p) return NEED_BALL;
    const o = this.opponentInFront(p, 4.5, 0.8);
    if (!o || o.isGK) return 'NO DEFENDER IN FRONT';
    const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = len2D(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const tx = o.pos.x + ux * 2.6, tz = o.pos.z + uz * 2.6, D = len2D(tx - p.pos.x, tz - p.pos.z), sp = Math.min(groundSpeedFor(D, 4), 18);
    this.kick(p, ux * sp, 0.3, uz * sp, { type: 'flick', selfBlock: 0.35, kickDur: 0.24 });
    this.ball.ignore = o; this.ball.ignoreT = 0.7; // straight through his legs
    this.stun(o, 0.8);
    const side = (ux * Math.cos(p.yaw) - uz * Math.sin(p.yaw)) > 0 ? -1 : 1, sx = -uz * side, sz = ux * side;
    this.dashP(p, ux * 0.55 + sx * 0.8, uz * 0.55 + sz * 0.8, 15, 0.24, { onEnd: () => { if (p.state === 'free') this.dashP(p, ux * 0.8 - sx * 0.6, uz * 0.8 - sz * 0.6, 15, 0.2); } });
    p.tackleProof = 0.8; this.flowAdd(p, 10);
    if (!p.isHuman) { p.ai.runTo = V3(tx, 0, tz); p.ai.runT = 1.2; }
    this.label(o, 'NUTMEGGED', '#ff5fb0');
    if (p.isHuman) { this.toast('NUTMEG', 'good', p); Replay.event(this, 'NUTMEG', p); }
    Sfx.dodge();
    return true;
  }
  /** snap one way and back: defenders within 3 blocks slip over */
  whiplash(p) {
    if (this.ball.owner !== p) return NEED_BALL;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), side = chance(0.5) ? 1 : -1, sx = -fz * side, sz = fx * side;
    this.dashP(p, sx, sz, 13, 0.13, { onEnd: () => { if (p.state === 'free') this.dashP(p, fx * 0.7 - sx * 0.7, fz * 0.7 - sz * 0.7, 14, 0.2); } });
    p.tackleProof = 0.6;
    let n = 0;
    for (const o of this.opponents(p)) {
      if (o.isGK || dist2D(o.pos, p.pos) > 3) continue;
      if (this.stun(o, 0.6)) { n++; this.label(o, 'ANKLES', p.aura); FX.feathers(o.pos.x, 0.8, o.pos.z, p.aura, 5); }
    }
    if (n) this.flowAdd(p, 10 * n);
    if (p.isHuman) this.featsOf(p).ankles += n;
    if (p.isHuman && n) { this.toast('ANKLE BREAKER', 'good', p); Replay.event(this, 'ANKLE BREAKER', p); }
    Sfx.dodge();
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
    for (const gk of [this.keeperOf(0), this.keeperOf(1)]) { if (!gk) continue; this.keeperContact(gk); if (b.owner) return; }
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (!this.canPick(p) || p === b.ignore) continue;
      const hd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z), relY = b.pos.y - p.pos.y;
      const sky = p.fx.skyTrap > 0;
      const reach = sky ? 1.75 : p.isHuman ? 1.0 : 0.92;
      const rv = Math.hypot(b.vel.x - p.vel.x, b.vel.y - p.vel.y, b.vel.z - p.vel.z);
      const hMax = sky ? 3.4 : rv < 22 ? (p.isHuman ? 2.05 : 1.75) : 1.15; // you can take a slow ball on the chest or the head
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
      const top = p.wall || p.inWall || p.isGK ? P_H : P_H + BALL_R; // the ball's edge, not its middle: a ball at head height hits the head (keepers have their own hands, keeperContact, and a free kick wall keeps the height free kicks were tuned on) // the ball's edge, not its middle: a ball at head height hits the head (keepers have their own hands, keeperContact, and a free kick wall keeps the height free kicks were tuned on)
      if (hd >= R || relY > top || relY < -BALL_R || p.state === 'down') continue;
      const nx = dx / (hd || 1), nz = dz / (hd || 1);
      b.pos.x = p.pos.x + nx * R; b.pos.z = p.pos.z + nz * R;
      const rvx = b.vel.x - p.vel.x, rvz = b.vel.z - p.vel.z, vn = rvx * nx + rvz * nz;
      if (vn < 0) {
        b.vel.x -= 1.45 * vn * nx; b.vel.z -= 1.45 * vn * nz;
        if (relY > 1.35) {
          b.vel.y = Math.max(b.vel.y, 2.5);
          if (this.cfg.aerialOnly) { b.kick = { by: p, type: 'header', t: this.time, aerial: true }; b.lastKicker = p; } // a header
        }
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
    if (b.kick && b.kick.homing) return; // the owner's admin panel: HOMING SHOTS go past keepers
    let ax, ay, az, bx, by, bz;
    if (gk.state === 'dive' && gk.dive) {
      const d = gk.dive;
      ax = gk.pos.x - d.ux * 0.4; ay = gk.pos.y + 0.55; az = gk.pos.z - d.uz * 0.4;
      const far = d.big ? 2.0 : gk.isHuman ? 1.75 : 1.45; // CAT LEAP: stretched right out; you in goal reach a little further
      bx = gk.pos.x + d.ux * far; by = gk.pos.y + (d.high ? (gk.isHuman ? 1.5 : 1.15) + Math.max(0, F.GH - 3) : 1.0); bz = gk.pos.z + d.uz * far; // a computer keeper's high dive does not reach right up into the top corner (a taller goal than the first 3: the hands reach up that much more, so the top corners stay about as hard)
    } else { ax = gk.pos.x; ay = gk.pos.y + 0.2; az = gk.pos.z; bx = gk.pos.x; by = gk.pos.y + 2.25; bz = gk.pos.z; }
    const abx = bx - ax, aby = by - ay, abz = bz - az, l2 = abx * abx + aby * aby + abz * abz;
    const t = clamp(((b.pos.x - ax) * abx + (b.pos.y - ay) * aby + (b.pos.z - az) * abz) / l2, 0, 1);
    const cx = ax + abx * t, cy = ay + aby * t, cz = az + abz * t;
    const dist = Math.hypot(b.pos.x - cx, b.pos.y - cy, b.pos.z - cz);
    let reach = (gk.state === 'dive' ? 0.78 : 0.62) + (5 - this.gkSize()) * 0.14 + (gk.fx.gloves > 0 ? 0.75 : 0) + (gk.isHuman ? 0.3 : 0);
    if (!gk.isHuman && b.pos.y > F.GH - 1.2 && Math.abs(b.pos.x - gk.pos.x) > 0.9) reach -= 0.5; // a computer keeper stretching up into a top corner: fingertips at best // longer reach in small teams, where keepers face more shots; GIANT GLOVES; a little more for you in goal
    if (dist > BALL_R + reach) return;
    const k = b.kick;
    const shooter = k && k.by && k.by.team !== gk.team && k.type === 'shot' ? k.by : null;
    const speed = b.vel.length();
    const sk = this.skill(gk);
    const catchMax = 19 + 9 * sk;
    if (shooter && !k.counted) { k.counted = true; shooter.stats.onTarget++; this.flowAdd(shooter, 15); }
    if (gk.fx.iron > 0 || (speed < catchMax && !(k && (k.special === 'impact' || k.special === 'bomb')))) { // an impact shot or a long bomb can only be punched away (IRON HANDS holds anything)
      this.possess(gk);
      if (shooter) { gk.stats.saves++; this.label(gk, 'SAVE', TEAM[gk.team].hex); if (shooter.isHuman) this.toast('SAVED', 'bad', shooter); Sfx.save(); Sfx.ooh(); }
    } else {
      const s = this.dir(gk.team);
      const rocket = k && (k.special === 'impact' || k.special === 'bomb'); // too hard to hold: the punch only knocks it loose in the box
      const out = rocket ? rand(2.5, 5) : Math.max(6, speed * 0.32);
      const side = gk.state === 'dive' && gk.dive ? sgn(gk.dive.ux || rand(-1, 1)) : (b.pos.x >= gk.pos.x ? 1 : -1);
      b.vel.set(side * (rocket ? rand(2, 6) : rand(4, 9)), rand(3.5, 7), s * out);
      b.curve.set(0, 0, 0); b.straightT = 0;
      b.touch(gk); b.kick = { by: gk, type: 'clear', t: this.time };
      gk.pickBlock = 0.5;
      if (shooter) { gk.stats.saves++; this.label(gk, 'PARRY', TEAM[gk.team].hex); if (shooter.isHuman) this.toast('PARRIED', 'bad', shooter); Sfx.save(); Sfx.ooh(); }
      if (this.involvesHuman(shooter)) Shake.add(0.2);
    }
  }
  onWoodwork() {
    const k = this.ball.kick;
    if (k && k.type === 'shot') { Sfx.ooh(); this.label(k.by, 'WOODWORK', '#eef1f4'); if (k.by && k.by.isHuman) this.toast('OFF THE POST', 'gold', k.by); }
  }
  checkGoalAndOut() {
    const b = this.ball, r = BALL_R;
    if (b.inGoal && Math.abs(b.pos.z) > F.L + r) { this.onGoal(b.inGoal); return; }
    if (b.inGoal) return;
    if (b.owner && b.owner.setPiece) return; // held for a throw-in or corner, behind the line on purpose
    const ax = Math.abs(b.pos.x), az = Math.abs(b.pos.z);
    if (ax > F.W + r || az > F.L + r) this.onOut();
  }
  onGoal(side) {
    if (this.drill) { this.drillEvent('goal'); return; } // TRAINING: a goal ends that attack
    const b = this.ball, team = side > 0 ? 0 : 1, k = b.kick;
    if (this.fk && this.fk.battle) { this.battleGoal(team); return; }
    if (this.cfg.aerialOnly && !(k && k.aerial)) { // Volleys Only: a goal off the ground does not count
      b.inGoal = 0; this.onOut();
      Hud.banner('NO GOAL', 'ONLY VOLLEYS AND HEADERS COUNT', '#ff4d5e', true); Sfx.deny();
      return;
    }
    if (this.heist) this.heistSteal(team); else this.score[team] += this.cfg.hill ? 3 : 1;
    if (this.fk && this.fk.state === 'flight') { this.fk.state = 'goal'; this.fk.log.push('GOAL'); }
    if (this.cfg.firstTo && this.score[team] >= this.cfg.firstTo) this.pendingEnd = true;
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
      if (this.heist) { scorer.emote = 'claim'; scorer.setState('emote', 3.2); } // OMEGA CORES: catch their core and lock it into your band
      else scorer.setState('celebrate', 3.2);
      scorer.charging = false;
    }
    this.lastGoal = { team, scorer, assister, own };
    if (scorer && scorer === this.human) this.myGoals++; // STORY goals like "score 2 yourself"
    if (this.heist && this.heist.last && !this.pendingEnd) { const L = this.heist.last; this.heistPower(team, L.jack ? HEIST_JACK : L.r, scorer); } // the core's power
    if (scorer && scorer.isHuman && k && (k.type === 'shot' || k.type === 'header')) {
      const F = this.featsOf(scorer);
      if (k.special === 'curl' || k.curved) F.curler++;
      if (k.aerial) F.volley++;
      if (k.fx != null && Math.hypot(k.fx, this.oppGoalZ(scorer.team) - k.fz) >= 25) F.longShot++;
    }
    for (const h of this.human ? [this.human] : this.humans) if (this.score[h.team] < this.score[1 - h.team]) this.featsOf(h).trailed = true;
    if (!this.fk && !this.tut) Replay.event(this, 'GOAL', scorer);
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
  /** a goal in the free kick battle: it counts for the battle, not the match score */
  battleGoal(team) {
    const k = this.fk, b = this.ball;
    if (k.state !== 'flight') { b.reset(0, 0); return; } // not from a kick (a loose ball rolled in)
    k.state = 'goal'; k.log.push('GOAL'); k.bs[team]++;
    this.phase = 'goal'; this.phaseT = 0;
    if (k.shooter) { k.shooter.setState('celebrate', 2.2); k.shooter.fkHold = false; }
    const yours = this.human && team === this.human.team;
    Hud.banner('GOAL!', this.battleLine(), yours ? '#2ee38f' : '#ff4d5e');
    Sfx.roar(1); Sfx.whistle(1); World.excite[team] = 1; Shake.add(0.3);
    FX.sparks(b.pos.x, b.pos.y, b.pos.z, TEAM[team].hex, 30, 8, 0.28);
    b.owner = null; b.kick = null;
  }
  onOut() {
    if (this.drill) { this.drillEvent('out'); return; } // TRAINING: put out = stopped
    if (this.tut) { const h = this.human; this.ball.reset(clamp(h.pos.x, -F.W + 2, F.W - 2), clamp(h.pos.z, -F.L + 3, F.L - 3)); return; } // the tutorial: the ball comes back to you
    if (this.fk) { this.fkResult(this.fk.hit || 'MISS'); return; } // free kicks: no throw-ins, just the next kick
    const b = this.ball;
    const last = b.lastTeam < 0 ? (b.pos.z > 0 ? 0 : 1) : b.lastTeam;
    const award = 1 - last;
    let rs;
    const az = Math.abs(b.pos.z), sx = sgn(b.pos.x), sz = sgn(b.pos.z);
    if (az > F.L + BALL_R) {
      const defending = sz > 0 ? 1 : 0;
      if (award === defending || this.cfg.goalW) rs = { type: 'GOAL KICK', team: defending, x: 0, z: sz * (F.L - 3.2) }; // MEGA GOAL: no room for a corner (over the bar is always a goal kick)
      else rs = { type: 'CORNER', team: award, x: sx * (F.W - 0.7), z: sz * (F.L - 0.7) };
    } else rs = { type: 'THROW-IN', team: award, x: sx * (F.W + 0.35), z: clamp(b.pos.z, -F.L + 1.5, F.L - 1.5) };
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
    const gk = rs.type === 'GOAL KICK' && this.keeperOf(rs.team);
    if (gk) {
      gk.pos.set(0, 0, rs.z - sgn(rs.z) * 0.3); gk.vel.set(0, 0, 0); gk.setState('free'); gk.dive = null;
      gk.yaw = sgn(rs.z) > 0 ? Math.PI : 0;
      this.possess(gk, true);
      gk.setPiece = { type: 'goalkick', t: 0, wait: rand(0.9, 1.5) }; this.setPieceBy = gk;
    } else {
      let taker = null, bd = 1e9;
      for (const p of this.teams[rs.team]) { if (p.isGK) continue; const d = Math.hypot(p.pos.x - rs.x, p.pos.z - rs.z); if (d < bd) { bd = d; taker = p; } }
      const inX = -sgn(rs.x) * (Math.abs(rs.x) > F.W - 2 ? 1 : 0), inZ = rs.type === 'THROW-IN' ? 0 : -sgn(rs.z); // a goal kick with no keeper: someone else takes it
      const il = len2D(inX, inZ) || 1;
      taker.pos.set(rs.x - inX / il * 0.6, 0, rs.z - inZ / il * 0.6); taker.vel.set(0, 0, 0);
      taker.dash = taker.slide = null; taker.setState('free');
      taker.yaw = Math.atan2(-rs.x * 0.6, -rs.z * 0.25 + (rs.type === 'CORNER' ? -sgn(rs.z) * 4 : this.dir(taker.team) * 2));
      this.possess(taker, true);
      taker.protect = 1.0;
      taker.setPiece = { type: rs.type === 'CORNER' ? 'corner' : rs.type === 'GOAL KICK' ? 'goalkick' : 'throw', t: 0, wait: rand(0.7, 1.4) }; this.setPieceBy = taker;
      if (taker.isHuman) this.toast(rs.type === 'CORNER' ? (Touch.on ? 'CORNER: PASS TO CROSS IT, SHOOT TO AIM' : 'CORNER: RIGHT CLICK TO CROSS, LEFT CLICK TO AIM')
        : rs.type === 'GOAL KICK' ? (Touch.on ? 'GOAL KICK: PASS TO A TEAMMATE, SHOOT TO AIM' : 'GOAL KICK: RIGHT CLICK TO A TEAMMATE, LEFT CLICK TO AIM')
        : (Touch.on ? 'THROW-IN: PASS TO A TEAMMATE, SHOOT TO AIM' : 'THROW-IN: RIGHT CLICK TO A TEAMMATE, LEFT CLICK TO AIM'), 'gold', taker);
      for (const o of this.teams[1 - rs.team]) {
        const dx = o.pos.x - rs.x, dz = o.pos.z - rs.z, d = Math.hypot(dx, dz);
        if (d < 5) { const k = 5 / (d || 1); o.pos.x = rs.x + (d ? dx : 1) * k; o.pos.z = rs.z + (d ? dz : 0) * k; }
      }
    }
    Sfx.whistle(1);
  }
  /** a throw-in: from over your head, to a point. A throw cannot go far */
  throwBall(p, tx, tz, mate = null) {
    const b = this.ball; if (b.owner !== p) return false;
    const from = V3(clamp(p.pos.x + Math.sin(p.yaw) * 0.3, -F.W + 0.1, F.W - 0.1), p.pos.y + 2.2, clamp(p.pos.z + Math.cos(p.yaw) * 0.3, -F.L + 0.1, F.L - 0.1)); // released over the line, so it starts in play
    let dx = tx - from.x, dz = tz - from.z, D = Math.hypot(dx, dz) || 1;
    if (D > 18) { dx *= 18 / D; dz *= 18 / D; D = 18; }
    const T = clamp(0.45 + D * 0.035, 0.5, 1.1);
    b.pos.copy(from);
    p.setPiece = null;
    const ok = this.kick(p, dx / T, (0.9 - from.y + 0.5 * BALL_G * T * T) / T, dz / T, { type: 'pass', to: mate, keepPos: true, kickStyle: 'throw', kickDur: 0.35, selfBlock: 0.5 });
    if (ok && mate && !mate.isHuman) mate.ai.receive = { t: this.time }; // the teammate comes to meet it
    return ok;
  }
  /** set pieces: the taker stands still, opponents keep back, and the ball is played by hand (throw) or by foot */
  updateSetPiece(dt) {
    const p = this.setPieceBy; if (!p) return;
    const sp = p.setPiece;
    if (!sp || this.ball.owner !== p || this.phase !== 'play') { if (sp) p.setPiece = null; this.setPieceBy = null; return; }
    sp.t += dt; p.protect = Math.max(p.protect, 0.2); p.vel.x = p.vel.z = 0;
    const keep = sp.type === 'goalkick' ? 12 : 5; // opponents keep back until it is played
    for (const o of this.opponents(p)) {
      const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < keep) { const k = keep / (d || 1); o.pos.x = p.pos.x + (d ? dx : 1) * k; o.pos.z = p.pos.z + (d ? dz : 0) * k; }
    }
    // bots take it after a moment; you get 6 seconds, then it goes to a teammate by itself
    if (p.isHuman ? sp.t > 6 : sp.t > sp.wait) this.takeSetPiece(p, null);
  }
  /** play a set piece: how = 'pass' (to a teammate), 'shoot' (where you aim), or null (bots, or time is up) */
  takeSetPiece(p, how, power = 0.8) {
    const sp = p.setPiece; if (!sp) return false;
    const mates = this.teams[p.team].filter((q) => q !== p && !q.isGK && q.state === 'free');
    if (sp.type === 'goalkick') { p.setPiece = null; AI.distribute(this, p); return true; }
    if (how === 'shoot') {
      const aim = p.aimV || this.aim;
      if (sp.type === 'throw') return this.throwBall(p, aim.x, aim.z);
      p.setPiece = null; return this.shootAt(p, aim, power, { curveIn: 0 });
    }
    let mate = how === 'pass' ? this.pickPassTarget(p) : null;
    if (!mate || mate.isGK) {
      // the best target: for a corner the teammate nearest the penalty spot, for a throw the nearest teammate
      const gz = this.oppGoalZ(p.team), spot = { x: 0, z: gz - sgn(gz) * 7 };
      let best = 1e9;
      for (const q of mates) { const d = sp.type === 'corner' ? Math.hypot(q.pos.x - spot.x, q.pos.z - spot.z) : dist2D(q.pos, p.pos); if (d < best) { best = d; mate = q; } }
    }
    if (!mate) { p.setPiece = null; return false; }
    if (sp.type === 'throw') return this.throwBall(p, mate.pos.x + mate.vel.x * 0.5, mate.pos.z + mate.vel.z * 0.5, mate);
    p.setPiece = null;
    return this.passTo(p, mate, { lob: true });
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
    this.updateGuns(dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.updateProjectile(this.projectiles[i], dt)) { this.drop(this.projectiles[i].mesh); this.projectiles.splice(i, 1); }
    for (let i = this.hazards.length - 1; i >= 0; i--) if (this.updateHazard(this.hazards[i], dt)) { this.drop(this.hazards[i].mesh, this.hazards[i].type === 'wall'); this.hazards.splice(i, 1); }
  }
  useItem(p) {
    if (!p.item || !this.canAct(p)) return false;
    const it = ITEMS[p.item];
    if (it.use(p, this)) { this.label(p, it.name, '#ffcb3d'); p.item = null; Sfx.zap(); return true; }
    return false;
  }
  /** LAWLESS SCATTER BLASTER: six shots in a spread in front of you */
  fireScatter(p) {
    for (let i = 0; i < 6; i++) this.fireProjectile(p, 'pellet', (i - 2.5) * 0.11);
    if (this.involvesHuman(p)) Shake.add(0.25);
    return true;
  }
  /** LAWLESS BLASTER: its three shots, one after another (p.gun from the item) */
  updateGuns(dt) {
    for (const p of this.players) {
      if (!p.gun) continue;
      if (p.state === 'down' || p.state === 'frozen' || this.phase !== 'play') { p.gun = null; continue; }
      p.gun.t -= dt;
      if (p.gun.t <= 0) { this.fireProjectile(p, 'blast'); p.gun.t = 0.14; if (--p.gun.left <= 0) p.gun = null; }
    }
  }
  fireProjectile(p, type, spread = 0) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let dx = p.isHuman ? Math.sin(this.camYaw) : fx, dz = p.isHuman ? Math.cos(this.camYaw) : fz;
    let target = null;
    if (type === 'fist' || type === 'snow' || type === 'blast') {
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
    if (spread) { const c = Math.cos(spread), s = Math.sin(spread), x = dx * c + dz * s; dz = dz * c - dx * s; dx = x; }
    const gunShot = type === 'blast' || type === 'pellet';
    const mat = gunShot ? new THREE.MeshBasicMaterial({ color: lin('#ffe14d'), toneMapped: false }) : type === 'boom' ? new THREE.MeshLambertMaterial({ map: World.T.boom }) : type === 'snow' ? new THREE.MeshLambertMaterial({ color: lin('#f4fbff') }) : new THREE.MeshLambertMaterial({ color: lin('#e0302a'), emissive: lin('#5a0000') });
    const mesh = new THREE.Mesh(PlayerGeo.get().cube, mat);
    const sz = type === 'boom' ? 0.7 : type === 'snow' ? 0.36 : type === 'blast' ? 0.24 : type === 'pellet' ? 0.17 : 0.55; mesh.scale.set(sz, sz, gunShot ? sz * 2.2 : sz); mesh.castShadow = !gunShot;
    this.scene.add(mesh);
    const pr = { type, owner: p, target, t: 0, mesh, pos: V3(p.pos.x + dx * 0.8, 1.3, p.pos.z + dz * 0.8), vel: V3() };
    if (type === 'boom') {
      const aimD = p.isHuman ? clamp(dist2D(this.aim, p.pos), 6, 16) : clamp(dist2D(this.ball.pos, p.pos), 5, 14);
      const T = 0.85; pr.vel.set(dx * aimD / T, (0 - 1.3 + 0.5 * GRAV * T * T) / T, dz * aimD / T); pr.fuse = 1.25;
    } else { const sp = type === 'snow' ? 30 : type === 'blast' ? 44 : type === 'pellet' ? 34 : 24; pr.vel.set(dx * sp, 0, dz * sp); }
    pr.life = type === 'blast' ? 0.8 : type === 'pellet' ? 0.34 : 1.1; // how far it flies
    this.projectiles.push(pr);
    if (gunShot) { p.yaw = Math.atan2(dx, dz); if (type === 'blast' || spread < 0) Sfx.zap(); FX.sparks(pr.pos.x, pr.pos.y, pr.pos.z, '#ffe14d', 4, 3, 0.1, 0.2); } // the muzzle flash
    else { p.kickT = 0; p.kickDur = 0.25; Sfx.swoosh(); }
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
    const gunShot = pr.type === 'blast' || pr.type === 'pellet';
    FX.trail(pr.pos.x, pr.pos.y, pr.pos.z, pr.type === 'snow' ? '#bfeaff' : gunShot ? '#ffe14d' : '#ff6a3c', gunShot ? 0.1 : 0.16, gunShot ? 0.15 : 0.25);
    for (const o of this.opponents(pr.owner)) {
      if (o.state === 'down' || o.state === 'frozen') continue;
      if (Math.hypot(o.pos.x - pr.pos.x, o.pos.z - pr.pos.z) < 0.85 && pr.pos.y > o.pos.y && pr.pos.y < o.pos.y + 2.1) {
        const l = len2D(pr.vel.x, pr.vel.z) || 1, dx = pr.vel.x / l, dz = pr.vel.z / l;
        if (o.fx.bubble > 0) { FX.sparks(pr.pos.x, pr.pos.y, pr.pos.z, '#8fd8ff', 12, 4); Sfx.boing(); return true; }
        if (gunShot) { // a blaster shot: knocked over (the ball pops loose)
          this.knockDown(o, pr.type === 'blast' ? 1.3 : 1.0, dx, dz, pr.type === 'blast' ? 6 : 5, pr.owner); Sfx.punch(); FX.sparks(o.pos.x, 1.2, o.pos.z, '#ffe14d', 14, 6, 0.12, 0.35);
          if (this.involvesHuman(o, pr.owner)) Shake.add(0.2);
        } else if (pr.type === 'snow') {
          if (this.ball.owner === o) { const b = this.ball; b.release(); b.vel.set(dx * 3, 2, dz * 3); b.kick = { by: pr.owner, type: 'loose' }; o.pickBlock = 2; }
          this.stun(o, 2, 'frozen'); Sfx.freeze(); FX.sparks(o.pos.x, 1, o.pos.z, '#bfeaff', 20, 5);
        } else {
          this.knockDown(o, 1.8, dx, dz, 9, pr.owner); Sfx.punch(); FX.sparks(o.pos.x, 1.2, o.pos.z, '#ff6a3c', 16, 6);
          if (this.involvesHuman(o, pr.owner)) { Shake.add(0.35); TimeCtl.hitStop(0.06); }
        }
        if (o.isHuman) this.toast(pr.type === 'snow' ? 'FROZEN' : gunShot ? 'BLASTED' : 'KNOCKED OUT', 'bad', o);
        return true;
      }
    }
    return pr.t > (pr.life || 1.1) || Math.abs(pr.pos.x) > F.BOARD_X || Math.abs(pr.pos.z) > F.BOARD_Z;
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
      b.curve.set(0, 0, 0); b.straightT = 0; b.gMul = 1;
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
            if (p.isHuman) this.toast('LANDMINE', 'bad', p);
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
      if (b.owner && b.owner.team !== p.team && dist2D(b.owner.pos, p.pos) < 7.5 && !(b.owner.fx.bubble > 0) && !this.safeGK(b.owner)) {
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
      if (p.flowT > 0) FX.flow(p, p.flowId, dt);
      if (p.awakeT > 0) FX.awaken(p, dt);
      if (p.fx.turbo > 0 && p.onGround && len2D(p.vel.x, p.vel.z) > 6 && Math.random() < 0.7) FX.dust(p.pos.x, p.pos.z, 1);
      if (p.fx.feathers > 0 && Math.random() < 0.8) FX.feathers(p.pos.x, p.pos.y + 0.4, p.pos.z, '#121018', 1);
      if (p.fx.shuffle > 0 && Math.random() < 0.4) FX.trail(p.pos.x + rand(-0.5, 0.5), rand(0.4, 1.6), p.pos.z + rand(-0.5, 0.5), p.aura, 0.12, 0.4);
      if (p.fx.jetpack > 0 && Math.random() < 0.9) { FX.trail(p.pos.x - Math.sin(p.yaw) * 0.3, p.pos.y + 0.6, p.pos.z - Math.cos(p.yaw) * 0.3, '#ffb02e', 0.2, 0.3); }
      if (p.fx.supercharge > 0 && Math.random() < 0.5) FX.trail(p.pos.x, p.pos.y + rand(0.2, 1.6), p.pos.z, '#ffd23d', 0.1, 0.3);
      if (p.fx.skyTrap > 0 && Math.random() < 0.3) FX.trail(p.pos.x + rand(-0.4, 0.4), 0.15, p.pos.z + rand(-0.4, 0.4), p.aura, 0.12, 0.4);
      if (p.fx.loaded > 0 && Math.random() < 0.5) FX.trail(p.pos.x + rand(-0.4, 0.4), p.pos.y + rand(0.3, 1.6), p.pos.z + rand(-0.4, 0.4), p.aura, 0.1, 0.3);
      if (p.fx.scent > 0 && !this.ball.owner) { // the mark where you can win the loose ball
        p._scentT = (p._scentT || 0) - dt;
        if (p._scentT <= 0) { p._scentT = 0.12; const ip = AI.interceptPoint(this, p, 2.2); FX.ring(ip.x, 0.15, ip.z, p.aura, 0.7, 10); }
      }
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

/** BOMB BALL on screen: sparks from the lit fuse, faster and redder as it burns down, and a tick for the last 6 seconds
    (offline from Match.updateBomb, online from Net.frame with the fuse from the snapshots) */
function bombFx(m, dt) {
  const B = m.bomb, b = m.ball;
  if (!B || m.phase !== 'play') return;
  B.fx = (B.fx || 0) - dt; B.tk = (B.tk || 0) - dt;
  if (B.fx <= 0) { B.fx = B.t < 3 ? 0.04 : B.t < 7 ? 0.08 : 0.16; FX.sparks(b.pos.x, b.pos.y + 0.4, b.pos.z, B.t < 3 ? '#ff3d3d' : '#ffb02e', 3, 2.5, 0.08, 0.3); }
  if (B.tk <= 0 && B.t < 6) { B.tk = B.t < 3 ? 0.25 : 0.5; Sfx.tick(); }
}
/** BOMB BALL: the blast where the ball went off (offline Hud.bomb, online the 'bomb' event) */
function bombBlast(x, z) {
  FX.sparks(x, 0.8, z, '#ffb02e', 60, 12, 0.3, 0.9); FX.sparks(x, 0.8, z, '#ff3d3d', 40, 9, 0.25, 0.7);
  for (let i = 0; i < 3; i++) FX.after(i * 0.08, () => FX.ring(x, 0.25, z, i % 2 ? '#ffffff' : '#ffb02e', 2 + i * 2.5, 30 + i * 8));
  FX.dirt(x, z, 0, 0, 20, 1.4); Shake.add(0.7); Sfx.boom();
}
/** which team won the match that just ended (-1: a draw); a free kick battle's winner comes from the result */
function winnerOf(m) {
  const r = m.result && m.result.res, ht = m.human ? m.human.team : 0;
  if (r === 'win') return ht;
  if (r === 'loss') return 1 - ht;
  if (r === 'draw') return -1;
  return m.score[0] === m.score[1] ? -1 : m.score[0] > m.score[1] ? 0 : 1;
}
/** the player the ending is about: the one doing the OMEGA SNAP, else you if your team won or drew, else the winners' top scorer */
function pickHero(m, w = winnerOf(m)) {
  const snap = m.players.find((p) => p.state === 'emote' && p.emote === 'snap');
  if (snap) return snap;
  const h = m.human;
  if (h && (w < 0 || h.team === w)) return h;
  const T = m.players.filter((p) => p.team === (w < 0 ? 0 : w));
  return T.slice().sort((a, b) => (b.stats.goals - a.stats.goals) || ((a.isGK ? 1 : 0) - (b.isGK ? 1 : 0)))[0] || m.players[0];
}

const CORE_SOCKET = [0.16, -0.5, 0]; // where a core locks in: the outside of the left forearm, in the band
const SNAP_T = 1.8; // when the OMEGA SNAP happens (seconds into the final whistle); Cine shatters the other team soon after
const SNAP_FLY = 1.1; // the cores the winners take at the whistle fly across the pitch to the hand for this long
/** OMEGA CORES on screen: each team's cores stand on its crossbar (the best in the middle) and every player wears a band
    on the left forearm. A goal: the core flies to the scorer, who catches it overhead and locks it into the band
    (Match.onGoal plays the 'claim' pose, Cine cuts to a close-up), then at the kickoff it flies on to the crossbar.
    At the OMEGA SNAP the winners' cores (with the ones they took at the whistle, flying across the pitch) circle the
    hero's raised hand, the one with the band, and vanish into it at the snap; after it they ring the hero's head.
    set() takes the vaults (offline from the match, online from the snapshots) and works out what moved */
class VaultView {
  constructor(m) {
    this.m = m; this.scene = m.scene; this.blocks = []; this.key = null; this.time = 0; this.jackMesh = null; this.claim = null; this.fin = null; this._v = V3();
    this.geo = new THREE.BoxGeometry(0.95, 0.95, 0.95); this.edges = new THREE.EdgesGeometry(this.geo);
    this.lineMat = new THREE.LineBasicMaterial({ color: col('#14121c') });
    this.mats = RARITIES.map((r) => new THREE.MeshLambertMaterial({ color: col(RARITY_HEX[r]), emissive: col(RARITY_HEX[r]), emissiveIntensity: r === 'Generational' ? 0.75 : 0.55 }));
    this.glows = RARITIES.map((r) => new THREE.MeshBasicMaterial({ color: col(RARITY_HEX[r]), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.bandGeo = new THREE.BoxGeometry(0.27, 0.16, 0.27); this.stripGeo = new THREE.BoxGeometry(0.285, 0.035, 0.285);
    this.bandMat = new THREE.MeshLambertMaterial({ color: col('#1c1828') }); this.stripMats = [];
  }
  make(r, size = 1) {
    const mesh = new THREE.Mesh(this.geo, this.mats[r]); mesh.add(new THREE.LineSegments(this.edges, this.lineMat));
    const glow = new THREE.Mesh(this.geo, this.glows[r]); glow.scale.setScalar(1.32); mesh.add(glow); // a soft glow round the core
    mesh.scale.setScalar(size); this.scene.add(mesh);
    return { r, team: -1, mesh, from: V3(), to: V3(), t: 1, dur: 1, arc: 0, s0: null, claim: null, size };
  }
  /** every player wears a band on the left forearm (a dark band with stripes in the team colour); built again after a swap */
  bands() {
    for (const p of this.m.players) {
      if (!p.P || p.P.armL.userData.band) continue;
      const sm = this.stripMats[p.team] || (this.stripMats[p.team] = new THREE.MeshBasicMaterial({ color: col(TEAM[p.team].hex), toneMapped: false }));
      const g = new THREE.Group(); g.position.set(0, CORE_SOCKET[1], 0);
      g.add(new THREE.Mesh(this.bandGeo, this.bandMat));
      for (const y of [-0.06, 0.06]) { const st = new THREE.Mesh(this.stripGeo, sm); st.position.y = y; g.add(st); }
      p.P.armL.add(g); p.P.armL.userData.band = g;
    }
  }
  /** where block i of n stands on team's crossbar: the best one (first) in the middle, then right, left, right... */
  slot(team, i, n) {
    const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    return V3(off * 1.08, F.GH + F.POST + 0.5, (team === 0 ? -1 : 1) * (F.L - F.POST / 2)); // team 0 defends -Z
  }
  set(v, jack) {
    const key = v[0].join() + '|' + v[1].join() + '|' + jack;
    if (key === this.key) return;
    const first = this.key == null; this.key = key;
    const want = [0, 1].map((t) => v[t].slice().sort((a, b) => b - a));
    const pool = this.blocks; this.blocks = [];
    const sc = this.m.lastGoal && this.m.lastGoal.scorer, ending = this.m.phase === 'end'; // at the whistle the snap takes them
    let got = null; // what one team just took (a goal takes the best core, and the GENERATIONAL one when it is out)
    for (const team of [0, 1]) want[team].forEach((r, i) => {
      let k = pool.findIndex((b) => b.team === team && b.r === r), moved = false, b;
      if (k < 0) { k = pool.findIndex((q) => q.r === r); moved = k >= 0; }
      if (k >= 0) b = pool.splice(k, 1)[0];
      else { b = this.make(r); if (r === HEIST_JACK && this.jackMesh) { b.mesh.position.copy(this.jackMesh.position); moved = true; } }
      const to = this.slot(team, i, want[team].length);
      b.team = team; b.to.copy(to);
      if (first || (!moved && b.t >= 1 && !b.claim && b.mesh.position.distanceToSquared(to) < 1e-4)) { b.mesh.position.copy(to); b.t = 1; }
      else if (!moved && b.mesh.position.lengthSq() === 0) { b.mesh.position.copy(to); b.t = 1; }
      else if (!b.claim) { b.from.copy(b.mesh.position); b.t = 0; b.dur = moved ? 1.5 : 0.4; b.arc = moved ? 8 : 0.5; }
      if (moved && !first && !ending) {
        if (!got) got = { team, rs: [] };
        got.rs.push(r);
        if (sc && sc.team === team && sc.P) { b.claim = { p: sc, k: got.rs.length - 1 }; b.from.copy(b.mesh.position); } // the scorer catches it
      }
      this.blocks.push(b);
    });
    for (const b of pool) this.scene.remove(b.mesh);
    if (jack === 1 && !this.jackMesh) { this.jackMesh = this.make(HEIST_JACK, 1.5).mesh; this.jackMesh.position.set(0, 2.6, 0); }
    if (jack !== 1 && this.jackMesh) { this.scene.remove(this.jackMesh); this.jackMesh = null; }
    if (got) {
      if (this.blocks.some((b) => b.claim && b.claim.p === sc)) this.claim = { p: sc, t: 0, team: got.team, rs: got.rs, locked: false };
      else Hud.steal(got.team, got.rs, null);
    }
  }
  /** the OMEGA SNAP at the final whistle (offline from the match, online from the empty vault): { w, hero, list, t, ang } */
  finisher() {
    const m = this.m, H = m.heist;
    if (m.phase !== 'end' || !H || H.cleaned == null) { this.fin = null; return null; }
    const w = 1 - H.cleaned;
    if (!this.fin) {
      const hero = m.players.find((p) => p.team === w && p.state === 'emote' && p.emote === 'snap');
      if (!hero || !hero.P) return null;
      this.fin = { w, hero, list: this.blocks.filter((b) => b.team === w) };
      this.claim = null;
      for (const b of this.fin.list) { b.claim = null; b.f0 = b.mesh.position.clone(); b.far = dist2D(b.f0, hero.pos) > 6; } // far: across the pitch
    }
    this.fin.t = m.phaseT;
    return this.fin;
  }
  update(dt) {
    this.time += dt; this.bands();
    const m = this.m, C = this.claim, v = this._v;
    if (C) {
      C.t += dt;
      if (!C.locked && C.t >= 0.95) { // locked in: a flash at the band and the cut-in
        C.locked = true;
        if (C.p.P) {
          C.p.P.root.updateMatrixWorld(true); C.p.P.armL.localToWorld(v.set(CORE_SOCKET[0], CORE_SOCKET[1], CORE_SOCKET[2]));
          const hex = RARITY_HEX[RARITIES[Math.max(...C.rs)]];
          FX.ring(v.x, v.y, v.z, hex, 0.7, 18); FX.sparks(v.x, v.y, v.z, hex, 30, 5, 0.14, 0.5);
        }
        Sfx.punch(); Sfx.coin();
        Hud.steal(C.team, C.rs, C.p);
      }
      if (C.t > 3.6 || (m.phase !== 'goal' && C.t > 1.2)) this.claim = null;
    }
    const fin = this.finisher();
    if (fin) fin.ang = (fin.ang || 0) + dt * (fin.t < SNAP_T ? 2.5 + fin.t * 2.6 : 1.6); // the ring turns faster and faster until the snap
    for (const b of this.blocks) {
      const p = b.mesh.position;
      if (fin && b.team === fin.w) { this.snapBlock(b, fin, dt); continue; }
      if (b.claim && this.claimBlock(b)) continue;
      if (b.t < 1) {
        b.t = Math.min(1, b.t + dt / b.dur);
        const e = b.t * b.t * (3 - 2 * b.t), big = b.arc > 1;
        p.lerpVectors(b.from, b.to, e); p.y += Math.sin(Math.PI * b.t) * b.arc;
        b.mesh.rotation.set(big ? b.t * TAU * 2 : 0, big ? b.t * TAU : 0, 0);
        if (b.s0 != null) b.mesh.scale.setScalar(lerp(b.s0, b.size, e));
        if (b.t >= 1) { b.s0 = null; if (big) { FX.sparks(b.to.x, b.to.y, b.to.z, RARITY_HEX[RARITIES[b.r]], 24, 6); Sfx.coin(); } }
      } else {
        const shiny = b.r >= 3; // Mythic and Generational turn slowly and bob
        if (b.mesh.scale.x !== b.size) b.mesh.scale.setScalar(b.size);
        b.mesh.rotation.set(0, shiny ? this.time * 1.2 : 0, 0); p.copy(b.to); p.y += shiny ? Math.sin(this.time * 3 + b.to.x) * 0.07 : 0;
      }
    }
    if (this.jackMesh) { const j = this.jackMesh; j.rotation.set(0.3, this.time * 1.6, 0.2); j.position.y = 2.6 + Math.sin(this.time * 2.4) * 0.35; }
  }
  /** a core the scorer is taking: to the raised right hand, down to the band, locked in on the left forearm */
  claimBlock(b) {
    const C = this.claim, P = b.claim.p, p = b.mesh.position;
    if (!C || C.p !== P || !P.P) { b.claim = null; b.from.copy(p); b.t = 0; b.dur = 0.9; b.arc = 3; b.s0 = b.mesh.scale.x; return false; } // on to the crossbar
    P.P.root.updateMatrixWorld(true);
    const t = C.t;
    if (t < 0.45) {
      const hand = P.P.armR.localToWorld(this._v.set(0, -0.68, 0)), u = t / 0.45, e = u * u * (3 - 2 * u);
      p.lerpVectors(b.from, hand, e); p.y += Math.sin(Math.PI * e) * 2.5;
      b.mesh.rotation.set(t * 14, t * 9, 0); b.mesh.scale.setScalar(lerp(1, 0.2, e));
    } else if (t < 0.95) { P.P.armR.localToWorld(p.set(0, -0.74, 0.06)); b.mesh.scale.setScalar(0.2); b.mesh.rotation.set(0, t * 6, 0); } // small in the hand: the camera is close
    else { P.P.armL.localToWorld(p.set(CORE_SOCKET[0], CORE_SOCKET[1] + b.claim.k * 0.17, CORE_SOCKET[2])); b.mesh.scale.setScalar(0.17); P.P.armL.getWorldQuaternion(b.mesh.quaternion); }
    return true;
  }
  /** OMEGA SNAP: circle the hero's raised hand faster and faster, close in, vanish into it at the snap, then ring the hero.
      The cores taken at the whistle first fly across the pitch in a high arc */
  snapBlock(b, fin, dt) {
    const H = fin.hero, p = b.mesh.position, n = fin.list.length, i = fin.list.indexOf(b), t = fin.t;
    if (!H.P) return;
    H.P.root.updateMatrixWorld(true);
    const before = t < SNAP_T, c = before ? H.P.armL.localToWorld(this._v.set(0, -0.8, 0)) : this._v.set(H.pos.x, H.pos.y + 2.5, H.pos.z);
    const r = before ? (t < SNAP_T - 0.4 ? 1.0 : 1.0 * (SNAP_T - t) / 0.4) : 1.2;
    const a = fin.ang + i / n * TAU;
    // before the snap the ring stands up facing the camera (Cine films from the middle side), after it lies round the hero's head
    const l = Math.hypot(H.pos.x, H.pos.z) || 1, sx = before ? -H.pos.z / l : 1, sz = before ? H.pos.x / l : 0;
    const tx = c.x + (before ? sx * Math.cos(a) : Math.cos(a)) * r, ty = c.y + (before ? Math.sin(a) * r : 0), tz = c.z + (before ? sz * Math.cos(a) : Math.sin(a)) * r;
    if (b.far && t < SNAP_FLY) { // across the pitch to the hand
      const u = t / SNAP_FLY, e = u * u * (3 - 2 * u);
      p.set(lerp(b.f0.x, tx, e), lerp(b.f0.y, ty, e) + Math.sin(Math.PI * u) * 7, lerp(b.f0.z, tz, e));
      b.mesh.scale.setScalar(lerp(b.size, 0.32, e)); b.mesh.rotation.set(t * 9, t * 6, 0);
      return;
    }
    const k = 1 - Math.exp(-(t < 0.9 ? 5 : 18) * dt);
    p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.z += (tz - p.z) * k;
    b.mesh.scale.setScalar(before ? 0.32 : t < SNAP_T + 2.2 ? 0.01 : Math.min(0.35, (t - SNAP_T - 2.2) * 1.2)); // back as a halo once the other team is gone
    b.mesh.rotation.set(this.time * 3, this.time * 2, 0);
  }
  dispose() {
    for (const b of this.blocks) this.scene.remove(b.mesh);
    if (this.jackMesh) this.scene.remove(this.jackMesh);
    for (const p of this.m.players) if (p.P && p.P.armL.userData.band) { p.P.armL.remove(p.P.armL.userData.band); p.P.armL.userData.band = null; }
    this.blocks = []; this.jackMesh = null; this.claim = null;
    this.geo.dispose(); this.edges.dispose(); this.lineMat.dispose(); this.bandGeo.dispose(); this.stripGeo.dispose(); this.bandMat.dispose();
    this.mats.forEach((q) => q.dispose()); this.glows.forEach((q) => q.dispose()); this.stripMats.forEach((q) => q && q.dispose());
  }
}
