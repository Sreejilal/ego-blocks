/* =====================================================================
   Movie: the STORY scenes acted out in 3D (owner, Nov 26 2026: "the story is just like a text only, I want an actual
   animation of the characters moving and the story to follow that"). The real stadium, real player models (Player),
   a ball and a camera that cuts between shots like a film. Each event's scene is a script in STORY_FILMS (11_films.js):
   where everyone stands (set), an opening shot (open), what happens while each line is said (lines, in the same order
   as the event's intro / outro lines) and a closing shot (end). Cutscene (11_cutscene.js) still shows the lines, the
   CHAPTER card and JOINS YOUR TEAM on top, between black film bars.
   Cutscene calls Movie.start(ev, part, film), Movie.beat(open/end), Movie.line(i, speaker, extra), Movie.stop().
   Game.loop calls Movie.update(rdt) while Movie.on, instead of the menus or the paused match.
   Actions are [actor, verb, ...args]; each actor does its actions one after another. '*' is the world (crowd, fireworks,
   the ball, props): ['*', 'at', seconds, verb, ...args] waits first. A new line finishes whatever is left at once
   (flush), so tapping fast never leaves the scene behind the words.
   ===================================================================== */
const MV_SPEED = { walk: 2.3, jog: 4.6, run: 7.6, sprint: 11.5 };
const MV_G = 20; // the ball's gravity in the scenes
const MV_PLACES = { // each place: the sky (LOOKS), rain, how full the stadium is (TIER_FANS), and its name at the start
  backpitch: { look: 'sunset', tier: 0, name: 'THE BACK PITCH' },
  street: { look: 'night', tier: 0, name: 'EMBER CITY, AFTER DARK' },
  stadium: { look: 'day', tier: 3, name: 'THE CUP STADIUM' },
  city: { look: 'sunset', tier: 2, name: 'CITY ARENA' },
  training: { look: 'day', tier: 0, name: 'TRAINING GROUND' },
  night: { look: 'night', tier: 4, name: 'THE VOXEL CUP, NIGHT GAME' },
  storm: { look: 'day', rain: true, tier: 4, name: 'THE VOXEL CUP, IN A STORM' },
  final: { look: 'night', tier: 5, name: 'THE VOXEL CUP FINAL' },
};
const MV_COACH_KIT = mkKit('#2a2f45', '#3a405c', 'plain', '#2a2f45', '#ffcb3d', '#ffcb3d', '#ffcb3d', '#20243a', '#ffcb3d', '#2a2f45', '#ffcb3d'); // a dark tracksuit with gold trim
const MV_STREET_KIT = mkKit('#14161f', '#3dffb0', 'plain', '#14161f', '#3dffb0', '#3dffb0', '#3dffb0', '#14161f', '#3dffb0', '#14161f', '#3dffb0'); // ROGUE before joining: a street look
const MV_EXTRAS = ['SPRINTER', 'ENFORCER', 'PROWLER', 'THUNDER', 'WARDEN', 'SPARK', 'MAESTRO', 'KESTREL'];
const MV_NUM = { ROGUE: 11, IRONCLAD: 5, SOLARIS: 7 };
const _mvA = new THREE.Vector3(), _mvB = new THREE.Vector3(), _mvC = new THREE.Vector3(), _mvD = new THREE.Vector3(), _mvE = new THREE.Vector3();

const Movie = {
  on: false, t: 0, A: {}, film: null, ev: null, shot: null, timers: [], ball: null, props: null, saved: null, hid: [], speaker: null, listener: null,
  /** the 3D scenes need the real renderer (the page always has one; this guards odd cases) */
  ok() { return !!(World.renderer && World.scene && World.camera); },
  start(ev, part, film) {
    if (this.on) this.stop();
    this.ev = ev; this.part = part; this.film = film; this.t = 0; this.on = true; this.A = {}; this.timers = []; this.shot = null;
    this.speaker = this.listener = null; this.confT = 0; this.confAcc = 0;
    const d = Save.data, P = MV_PLACES[film.place || ev.place] || MV_PLACES.stadium, cam = World.camera;
    this.saved = { look: World.look, weather: World.weather, tier: World.tier, sun: World.sunRef, fov: cam.fov, pos: cam.position.clone(), quat: cam.quaternion.clone(), gw: F.GW, gh: F.GH, show: Showcase.on };
    Showcase.hide(); cam.clearViewOffset();
    const m = Game.match; this.hid = []; // the paused match (a scene over the results): its players and ball step aside
    if (m) {
      for (const o of m.players) if (o.P) for (const x of [o.P.root, o.blob, o.ownRing, o.ring]) if (x && x.visible) this.hid.push(x);
      if (m.ball && m.ball.mesh && m.ball.mesh.visible) this.hid.push(m.ball.mesh);
    }
    for (const x of this.hid) x.visible = false;
    FX.clear(); TimeCtl.reset();
    World.setWeather(P.rain ? 'rain' : 'clear'); World.setLook(P.look); World.setTier(film.tier != null ? film.tier : P.tier); World.setSun(SUN_MATCH);
    const foe = ev.foe !== d.club ? ev.foe : CLUB_IDS.find((c) => c !== d.club);
    [this.home, this.away] = matchSides(d.club, foe);
    World.paintCrowd(this.home, this.away);
    World.setGoal(...(film.goals || [GOAL_W0, GOAL_H0]));
    World.excite[0] = World.excite[1] = 0;
    Sfx.setCrowd(P.tier ? 0.45 : 0.12);
    this.makeBall(); this.makeProps();
    const set = Object.assign({}, film.set);
    for (const k of new Set((ev[part] || []).map((l) => l[0]))) { // anyone who talks in this scene is on stage
      if (set[k] || !(k === 'YOU' || k === 'COACH' || k === 'RIVAL' || STORY_CAST[k])) continue;
      const y = set.YOU || [0, 0]; set[k] = [y[0] + 3, y[1] + 3, 'YOU'];
    }
    for (const k in set) if (k !== 'ball') this.actor(k, set[k]);
    const b = set.ball;
    if (typeof b === 'string' && this.A[b]) this.give(this.A[b]); else if (Array.isArray(b)) this.place(b[0], b[1]); else this.ball.mesh.visible = false;
    for (const k in this.A) this.turnNow(this.A[k]);
    document.body.classList.add('movie');
    this.cut(['wide', 0, 0, 20, 8, 0.1]);
  },
  /** the story is over (or skipped): everything back the way it was */
  stop() {
    if (!this.on) return;
    this.on = false;
    for (const k in this.A) this.A[k].p.dispose();
    this.A = {}; this.timers = [];
    if (this.ball) this.ball.mesh.visible = false;
    if (this.props) for (const k in this.props) this.props[k].g.visible = false;
    FX.clear(); TimeCtl.reset();
    const s = this.saved, cam = World.camera;
    World.setWeather(s.weather); World.setLook(s.look); World.setTier(s.tier != null ? s.tier : tierOf(Save.data.rp)); if (s.sun) World.setSun(s.sun);
    World.setGoal(s.gw, s.gh);
    if (Game.match && TEAM[0] && TEAM[1]) World.paintCrowd(TEAM[0], TEAM[1]); else { const me = sideFor(Save.data.club); World.paintCrowd(me, me); }
    World.excite[0] = World.excite[1] = 0;
    cam.position.copy(s.pos); cam.quaternion.copy(s.quat); cam.fov = s.fov; cam.updateProjectionMatrix();
    for (const x of this.hid) x.visible = true;
    this.hid = [];
    document.body.classList.remove('movie');
    if (s.show && UI.cur === 'lobby') Showcase.show();
  },
  /* ---------- the cast ---------- */
  /** who someone is: YOU (your style, look and club), COACH BRICK (a tracksuit), RIVAL (the other club's captain), R1..R4
      (their team), M1..M3 (your team: ROGUE and IRONCLAD once they joined, then your MY TEAM picks), the story characters */
  cast(key) {
    const d = Save.data, ev = this.ev, home = this.home, away = this.away;
    if (key === 'YOU') return { team: 0, role: 'ST', style: d.style, flow: d.flow, look: d.look, side: home, number: 10, name: 'YOU', skin: SKIN_TONES[d.tone] || SKIN_TONES[1] };
    if (key === 'COACH') return { team: 0, role: 'MID', style: 'ANCHOR', side: Object.assign({}, home, { kit: MV_COACH_KIT }), number: '', name: 'COACH', skin: SKIN_TONES[3] };
    if (key === 'RIVAL') return { team: 1, role: 'ST', style: RIVAL_FACE[ev.foe] || 'BLITZ', side: away, number: 9, name: 'RIVAL' };
    if (/^R\d$/.test(key)) return { team: 1, role: 'MID', style: MV_EXTRAS[(+key[1] + ev.n) % MV_EXTRAS.length], side: away, number: 2 + +key[1] };
    if (/^M\d$/.test(key)) { const st = this.mate(+key[1]); return { team: 0, role: 'MID', style: st, side: home, number: MV_NUM[st] || [7, 4, 8][+key[1] - 1] || 6 }; }
    if (STYLES[key] && STYLES[key].story) {
      const side = key === 'ROGUE' ? Object.assign({}, home, { club: 'STREET', kit: MV_STREET_KIT, crest: ['#3dffb0', '#14161f', 'star'] }) : ev.foe === 'SUNSPIRE' ? away : sideFor('SUNSPIRE');
      return { team: 1, role: 'ST', style: key, side, number: MV_NUM[key] || 9 };
    }
    return null;
  },
  /** your teammates in the scenes: the story characters who already joined (from chapter 2 on), then MY TEAM */
  mate(i) {
    const d = Save.data, ch = this.ev.ch, own = (id) => d.styles.includes(id) && id !== d.style;
    const list = [];
    if (ch >= 1 && own('ROGUE')) list.push('ROGUE');
    if (ch >= 2 && own('IRONCLAD')) list.push('IRONCLAD');
    for (const k of ['WING', 'MID', 'DEF', 'ST']) { const id = d.squad[k]; if (id && STYLES[id] && !STYLES[id].gk && id !== d.style && !list.includes(id)) list.push(id); }
    for (const id of ['KESTREL', 'SENTINEL', 'SPARK', 'ROOKIE']) if (id !== d.style && !list.includes(id)) list.push(id);
    return list[i - 1] || 'ROOKIE';
  },
  actor(key, s) {
    const spec = this.cast(key); if (!spec) return null;
    const p = new Player({ scene: World.scene, ball: { owner: null } }, spec);
    p.pos.set(s[0], 0, s[1]);
    const a = { key, p, q: [], task: null, fixed: null, ov: null, vy: 0 };
    if (typeof s[2] === 'number') p.yaw = s[2]; else if (s[2]) a.fixed = s[2];
    this.A[key] = a;
    return a;
  },
  /** turn someone to face who they should (no easing: the first frame of a scene) */
  turnNow(a) { const y = this.yawTo(a, a.fixed); if (y != null) a.p.yaw = y; a.fixed = null; },
  /** the way from an actor to a target: another actor's key or [x, z] */
  yawTo(a, tg) {
    if (tg == null) return null;
    let x, z;
    if (typeof tg === 'string') { const o = this.A[tg]; if (!o || o === a) return null; x = o.p.pos.x; z = o.p.pos.z; } else { x = tg[0]; z = tg[1]; }
    const dx = x - a.p.pos.x, dz = z - a.p.pos.z;
    return dx * dx + dz * dz < 0.01 ? null : Math.atan2(dx, dz);
  },
  /* ---------- scripts ---------- */
  /** a beat (the opening, a line, the end): its actions and camera */
  beat(B) {
    if (!B) return;
    for (const act of B.do || []) this.act(act);
    if (B.cam) this.cut(B.cam);
    if (B.cams) for (const [t, s] of B.cams) { if (t > 0) this.later(t, () => this.cut(s), 'cam'); else this.cut(s); }
  },
  /** a line starts: finish what was left, who talks to whom, the line's actions and shot (or a good one picked for it) */
  line(i, key, extra) {
    const L = (this.film.lines && this.film.lines[i]) || {};
    this.flushAll();
    for (const k in this.A) { const a = this.A[k]; a.fixed = null; if (a.p.state === 'emote' && a.p.emote === 'talk') a.p.setState('free'); }
    const prev = this.speaker;
    this.speaker = this.A[key] ? key : null;
    this.listener = L.to || (prev && prev !== key && this.A[prev] ? prev : null) || (key !== 'YOU' && this.A.YOU ? 'YOU' : key !== 'COACH' && this.A.COACH ? 'COACH' : Object.keys(this.A).find((k) => k !== key) || null);
    this.beat(L);
    if (!L.cam && !L.cams) this.cut(this.autoShot(i, key));
    if (extra === 'join' && this.A[key]) this.A[key].q.push({ k: 'join' }); // after they walked over: the new kit
  },
  autoShot(i, key) {
    const L = this.listener;
    if (!this.A[key]) return ['wide', 0, 0, 14, 6, 0.1];
    if (!L || !this.A[L]) return ['close', key];
    return i % 2 ? ['close', key] : ['ots', key, L];
  },
  act(act) {
    const [who, verb, ...args] = act;
    if (who === '*') {
      if (verb === 'at') { const [t, v2, ...a2] = args; this.later(t, () => this.world(v2, a2), 'fx'); } else this.world(verb, args);
      return;
    }
    const a = this.A[who]; if (!a) return;
    const T = this.task(verb, args); if (T) a.q.push(T);
  },
  task(verb, a) {
    if (MV_SPEED[verb]) return { k: 'move', x: a[0], z: a[1], sp: MV_SPEED[verb] };
    switch (verb) {
      case 'dribble': return { k: 'move', x: a[0], z: a[1], sp: a[2] || MV_SPEED.run * 0.85, ball: true };
      case 'glide': return { k: 'move', x: a[0], z: a[1], sp: a[2] || MV_SPEED.jog, keep: true }; // moving without dropping the pose (the airplane run)
      case 'face': return { k: 'face', tg: typeof a[0] === 'string' ? a[0] : [a[0], a[1]] };
      case 'wait': return { k: 'wait', dur: a[0] || 0.5 };
      case 'emote': return { k: 'emote', name: a[0], dur: a[1] || 0 };
      case 'juggle': return { k: 'juggle', dur: a[0] || 2 };
      case 'trap': return { k: 'trap' };
      case 'shoot': return { k: 'kick', tx: a[1] || 0, ty: a[2] == null ? 1.2 : a[2], tz: (a[0] || 1) * (F.L + 1.2), pow: 1.15, cheer: true };
      case 'kick': return { k: 'kick', tx: a[0], ty: a[1], tz: a[2], T: a[3], pow: 0.9 };
      case 'pass': return { k: 'kick', to: a[0], pow: 0.6 };
      case 'slide': return { k: 'slide', x: a[0], z: a[1], win: a[2] === 'win' };
      case 'feint': return { k: 'feint', side: a[0] || 1 };
      case 'fall': return { k: 'fall', dir: a[0] || 1, dur: a[1] || 1.5 };
      case 'jump': return { k: 'jump' };
      case 'glow': return { k: 'glow' };
      case 'giant': return { k: 'giant', on: a[0] !== false };
      case 'join': return { k: 'join' };
      case 'hide': return { k: 'hide' };
      case 'show': return { k: 'show' };
    }
    return null;
  },
  later(t, fn, kind) { this.timers.push({ at: this.t + t, fn, kind }); },
  /** a new line: anything still going finishes at once, so the scene always matches the words */
  flushAll() {
    const left = this.timers; this.timers = [];
    for (const tm of left) if (tm.kind !== 'cam') tm.fn();
    for (const k in this.A) {
      const a = this.A[k], all = a.task ? [a.task, ...a.q] : a.q.slice();
      a.task = null; a.q = [];
      for (const T of all) this.finish(a, T);
    }
  },
  /** where a task would have left everyone */
  finish(a, T) {
    const p = a.p, B = this.ball;
    switch (T.k) {
      case 'move': p.pos.x = T.x; p.pos.z = T.z; if (T.ball) this.give(a); if (!T.keep && p.state !== 'free') p.setState('free'); break;
      case 'face': { const y = this.yawTo(a, T.tg); if (y != null) p.yaw = y; a.fixed = T.tg; break; }
      case 'emote': if (T.dur > 0) { if (p.state === 'emote') p.setState('free'); } else { p.emote = T.name; p.setState('emote', 0); } break;
      case 'juggle': if (B.jug === a) this.give(a); break;
      case 'trap': if (!B.own && !B.fly) this.give(a); break;
      case 'kick':
        if (!T.hit) {
          if (T.to && this.A[T.to]) this.give(this.A[T.to]);
          else if (T.cheer) { this.place(T.tx * 0.6, Math.sign(T.tz) * (F.L + 1.6)); B.inNet = true; }
          else this.place(T.tx, T.tz);
        }
        p.kickT = -1; break;
      case 'slide': p.pos.x = T.x; p.pos.z = T.z; p.setState('free'); if (T.win) this.give(a); break;
      case 'feint': p.setState('free'); p.dash = null; p.feint = 0; break;
      case 'fall': if (p.state === 'down') p.setState('free'); break;
      case 'jump': p.pos.y = 0; a.vy = 0; break;
      case 'join': this.join(a, true); break;
      case 'glow': case 'giant': case 'hide': case 'show': this.begin(a, T); break;
    }
  },
  /* ---------- the world ---------- */
  world(v, a) {
    const B = this.ball;
    switch (v) {
      case 'cheer': World.excite[0] = World.excite[1] = Math.max(World.excite[0], a[0] == null ? 1 : a[0]); Sfx.roar(a[0] == null ? 1 : a[0]); break;
      case 'whistle': Sfx.whistle(a[0] || 1); break;
      case 'sfx': if (Sfx[a[0]]) Sfx[a[0]](a[1]); break;
      case 'flash': this.flash(a[0] || '#ffffff'); break;
      case 'boom': this.boom(a[0], a[1]); break;
      case 'lightning': this.lightning(a[0], a[1]); break;
      case 'fireworks': { const n = a[0] || 4, hex = [this.home.hex, '#ffffff', '#ffd54a']; for (let i = 0; i < n; i++) FX.rocket(rand(-30, 30), (i % 2 ? 1 : -1) * rand(F.L + 2, F.L + 8), hex, i * 0.35); break; }
      case 'confetti': this.confT = this.t + (a[0] || 4); break;
      case 'ball': if (typeof a[0] === 'string') { if (this.A[a[0]]) this.give(this.A[a[0]]); } else this.place(a[0], a[1]); break;
      case 'ballup': this.place(a[0], a[1]); B.pos.y = 0.4; B.vel.set(a[3] || 0, Math.sqrt(2 * B.g * Math.max(0.5, a[2] || 6)), a[4] || 0); B.fly = true; Sfx.kick(0.6); break;
      case 'moon': B.g = a[0] === false ? MV_G : MV_G * 0.16; break;
      case 'goals': World.setGoal(a[0], a[1]); break;
      case 'crowd': World.setTier(a[0]); break;
      case 'cores': { const C = this.props.cores; C.g.visible = true; C.on = typeof a[0] === 'string' ? a[0] : null; if (!C.on) C.at.set(a[0] || 0, a[2] || 3, a[1] || 0); C.lerp = 0; break; }
      case 'snapfx': this.snapFx(a[0]); break;
      case 'trophy': { const T = this.props.trophy; T.g.visible = true; T.hold = null; T.at.set(a[0] || 0, 1.0, a[1] || 0); T.lerp = 1; this.props.plinth.g.visible = true; this.props.plinth.g.position.set(a[0] || 0, 0, a[1] || 0); break; }
      case 'prop': { const P = this.props[a[0]]; if (P) { P.g.visible = true; P.hold = a[1]; P.lerp = 1; } break; }
      case 'give': { const P = this.props[a[0]]; if (P) { P.g.visible = true; P.hold = a[1]; P.lerp = 0; Sfx.pickup(); } break; }
      case 'drop': { const P = this.props[a[0]]; if (P) P.g.visible = false; break; }
    }
  },
  flash(hex) { const f = $('cs-flash'); if (!f) return; f.style.background = hex; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); },
  /** BOOM: the bomb ball goes off. Anyone close falls, the ball flies up */
  boom(x, z) {
    FX.explosion(x, 0, z); FX.ring(x, 0.3, z, '#ffb02e', 2.5, 30); FX.dirt(x, z, 0, 0, 20, 1.6);
    Sfx.boom(); Shake.add(0.6); this.flash('#ffb02e');
    for (const k in this.A) { const a = this.A[k], dx = a.p.pos.x - x, dz = a.p.pos.z - z; if (dx * dx + dz * dz < 16 && a.p.state !== 'down') { a.task = null; a.q = [{ k: 'fall', dir: 1, dur: 1.6 }]; } }
    const B = this.ball; if (Math.hypot(B.pos.x - x, B.pos.z - z) < 3) { B.own = B.jug = null; B.vel.set(rand(-3, 3), 11, rand(-3, 3)); B.fly = true; }
  },
  /** a bolt of lightning from the sky (THE STORM) */
  lightning(x, z) {
    FX.beam(V3(x, 34, z), { pos: V3(x, 0, z) }, '#e8eeff'); FX.sparks(x, 0.3, z, '#e8eeff', 30, 8, 0.18, 0.6); FX.ring(x, 0.2, z, '#ffffff', 2, 24);
    this.flash('#e8eeff'); Shake.add(0.35); Sfx.boom(); Sfx.zap();
  },
  /* ---------- the ball ---------- */
  makeBall() {
    if (!this.ball) {
      if (!BALL_GEO) BALL_GEO = makeBallGeometry();
      const mesh = new THREE.Mesh(BALL_GEO, new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.castShadow = true;
      World.scene.add(mesh);
      this.ball = { mesh, pos: V3(), vel: V3(), own: null, jug: null, to: null, fly: false, inNet: false, g: MV_G, jt: 0 };
    }
    const B = this.ball; B.own = B.jug = B.to = null; B.fly = B.inNet = false; B.g = MV_G; B.vel.set(0, 0, 0); B.mesh.visible = true; B.mesh.scale.setScalar(1);
  },
  give(a) { const B = this.ball; B.own = a; B.jug = B.to = null; B.fly = false; B.inNet = false; B.vel.set(0, 0, 0); B.mesh.visible = true; this.feet(a, B.pos); },
  place(x, z) { const B = this.ball; B.own = B.jug = B.to = null; B.fly = false; B.inNet = false; B.vel.set(0, 0, 0); B.pos.set(x, BALL_R, z); B.mesh.visible = true; },
  /** the ball's spot just in front of someone's feet */
  feet(a, out) { const p = a.p; return out.set(p.pos.x + Math.sin(p.yaw) * 0.55, BALL_R, p.pos.z + Math.cos(p.yaw) * 0.55); },
  tickBall(dt) {
    const B = this.ball; if (!B || !B.mesh.visible) return;
    if (B.own) {
      const p = B.own.p, sp = len2D(p.vel.x, p.vel.z), lead = 0.55 + Math.min(0.35, sp * 0.04) * (0.6 + 0.4 * Math.sin(this.t * 9));
      _mvA.set(p.pos.x + Math.sin(p.yaw) * lead, BALL_R, p.pos.z + Math.cos(p.yaw) * lead);
      B.pos.x = damp(B.pos.x, _mvA.x, 22, dt); B.pos.z = damp(B.pos.z, _mvA.z, 22, dt); B.pos.y = BALL_R;
      B.mesh.rotation.x += dt * sp * 3;
    } else if (B.jug) { // keepy-uppies: the ball pops from foot to foot (the touching leg lifts, see tickActor)
      const a = B.jug, p = a.p, per = 0.56; B.jt += dt;
      const ph = (B.jt % per) / per, n = Math.floor(B.jt / per), side = n % 2 ? 1 : -1;
      const h = 0.45 + 1.15 * Math.sin(Math.PI * ph);
      const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), fw = 0.42, sd = 0.12 * side;
      B.pos.set(p.pos.x + sy * fw + cy * sd, h, p.pos.z + cy * fw - sy * sd);
      if (n !== B.jn) { B.jn = n; Sfx.juggle(side > 0 ? 'L' : 'R'); }
      B.mesh.rotation.x += dt * 8; B.mesh.rotation.z += dt * 2;
    } else if (B.fly || B.vel.lengthSq() > 0.01) {
      B.vel.y -= B.g * dt;
      B.pos.addScaledVector(B.vel, dt);
      if (B.pos.y < BALL_R) {
        B.pos.y = BALL_R;
        if (B.vel.y < -2) { B.vel.y *= -0.45; B.vel.x *= 0.78; B.vel.z *= 0.78; Sfx.thud(Math.min(0.5, -B.vel.y * 0.05)); } else { B.vel.y = 0; B.fly = false; }
      }
      if (B.pos.y <= BALL_R + 0.01) { const f = Math.max(0, 1 - 1.6 * dt); B.vel.x *= f; B.vel.z *= f; }
      const s = Math.sign(B.pos.z) || 1;
      if (!B.inNet && Math.abs(B.pos.z) > F.L && Math.abs(B.pos.x) < F.GW && B.pos.y < F.GH) { // in the net
        B.inNet = true; World.netBulge[s > 0 ? 0 : 1] = 1; B.vel.multiplyScalar(0.12); Sfx.swoosh();
        if (B.cheer) { World.excite[0] = World.excite[1] = 1; Sfx.roar(World.tier ? 1 : 0.35); FX.sparks(B.pos.x, B.pos.y, B.pos.z, '#ffffff', 16, 5, 0.14, 0.5); }
      }
      if (B.inNet) { const lim = F.L + F.GD - 0.4; if (Math.abs(B.pos.z) > lim) { B.pos.z = s * lim; B.vel.z = 0; } B.pos.x = clamp(B.pos.x, -F.GW + 0.4, F.GW - 0.4); }
      if (B.to) { // a pass: the one it is for takes it
        const r = this.A[B.to];
        if (r) { this.feet(r, _mvB); if (Math.hypot(_mvB.x - B.pos.x, _mvB.z - B.pos.z) < 1.1 && B.pos.y < 1.3) { this.give(r); Sfx.touch(); } }
      }
      B.mesh.rotation.x += dt * len2D(B.vel.x, B.vel.z) * 2.5;
    }
    B.mesh.position.copy(B.pos);
  },
  /* ---------- props: the shirt, the cup, the power cores ---------- */
  makeProps() {
    if (this.props) { for (const k in this.props) { const P = this.props[k]; P.g.visible = false; P.hold = null; } this.paintShirt(); this.props.cores.on = null; return; }
    const mk = (geo, mat) => { const g = new THREE.Mesh(geo, mat); g.castShadow = true; g.visible = false; World.scene.add(g); return g; };
    const gold = '#ffcf3a', dark = '#2a2140';
    const cup = new VoxBuilder();
    cup.box(-0.17, 0, -0.17, 0.17, 0.09, 0.17, dark, { ao: 0.9 }); cup.box(-0.13, 0.09, -0.13, 0.13, 0.13, 0.13, gold);
    cup.box(-0.05, 0.13, -0.05, 0.05, 0.32, 0.05, gold); cup.box(-0.1, 0.3, -0.1, 0.1, 0.36, 0.1, gold);
    cup.box(-0.19, 0.36, -0.19, 0.19, 0.68, 0.19, gold); cup.box(-0.23, 0.66, -0.23, 0.23, 0.72, 0.23, '#fff1b0');
    for (const s of [1, -1]) { cup.box(s * 0.19, 0.42, -0.03, s * 0.31, 0.47, 0.03, gold); cup.box(s * 0.27, 0.47, -0.03, s * 0.31, 0.62, 0.03, gold); cup.box(s * 0.19, 0.6, -0.03, s * 0.31, 0.64, 0.03, gold); }
    const trophy = mk(cup.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: lin('#3a2a00'), emissiveIntensity: 1 }));
    const pl = new VoxBuilder(); pl.box(-0.5, 0, -0.5, 0.5, 1.0, 0.5, '#1d1a2c', { ao: 0.8 }); pl.box(-0.56, 0.94, -0.56, 0.56, 1.0, 0.56, '#ffcf3a');
    const plinth = mk(pl.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    const shirt = mk(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    const cores = new THREE.Group(); cores.visible = false; World.scene.add(cores);
    RARITIES.forEach((r) => { const c = new THREE.Mesh(PlayerGeo.get().cube, new THREE.MeshBasicMaterial({ color: lin(RARITY_HEX[r]), toneMapped: false })); c.scale.setScalar(0.2); cores.add(c); });
    this.props = {
      trophy: { g: trophy, hold: null, at: V3(), lerp: 0, up: 0.05 },
      plinth: { g: plinth, hold: null, at: V3(), lerp: 0, fixed: true },
      shirt: { g: shirt, hold: null, at: V3(), lerp: 0, up: 0.1 },
      cores: { g: cores, hold: null, at: V3(), lerp: 0, on: null, fixed: true },
    };
    this.paintShirt();
  },
  /** the shirt COACH BRICK hands you: your club's colours with your number */
  paintShirt() {
    const k = this.home.kit, v = new VoxBuilder();
    v.box(-0.26, -0.36, -0.03, 0.26, 0.3, 0.03, k.shirt, { ao: 0.85 });
    v.box(-0.44, 0.06, -0.03, -0.26, 0.3, 0.03, k.sleeve, { ao: 0.85 }); v.box(0.26, 0.06, -0.03, 0.44, 0.3, 0.03, k.sleeve, { ao: 0.85 });
    v.box(-0.12, 0.26, -0.035, 0.12, 0.31, 0.035, k.collar, { ao: 1 });
    v.box(-0.09, -0.14, 0.03, -0.03, 0.12, 0.04, k.number, { ao: 1 }); v.box(0.01, -0.14, 0.03, 0.11, 0.12, 0.04, k.number, { ao: 1 }); v.box(0.03, -0.1, 0.035, 0.09, 0.08, 0.045, k.shirt, { ao: 1 }); // a 10
    const g = this.props.shirt.g; g.geometry.dispose(); g.geometry = v.geometry();
  },
  /** where someone's hands are (both hands' middle) */
  hands(a, out) {
    const P = a.p.P; P.armL.localToWorld(_mvC.set(0, -0.7, 0)); P.armR.localToWorld(_mvD.set(0, -0.7, 0));
    return out.addVectors(_mvC, _mvD).multiplyScalar(0.5);
  },
  tickProps(dt) {
    const S = this.props; if (!S) return;
    for (const k of ['trophy', 'shirt']) {
      const P = S[k]; if (!P.g.visible) continue;
      if (P.hold && this.A[P.hold]) {
        const a = this.A[P.hold]; this.hands(a, _mvA); _mvA.x += Math.sin(a.p.yaw) * 0.1; _mvA.z += Math.cos(a.p.yaw) * 0.1; _mvA.y += k === 'trophy' ? -0.15 : a.p.state === 'emote' && a.p.emote === 'trophy' ? 0.34 : 0; // a shirt held up goes over the head, not the face
        P.lerp = Math.min(1, P.lerp + dt * 2.5); const e = smooth(P.lerp);
        P.g.position.lerp(_mvA, P.lerp >= 1 ? 1 : Math.min(1, e * 0.6 + dt * 8));
        const c = World.camera.position, up = k === 'shirt' && a.p.state === 'emote' && a.p.emote === 'trophy';
        P.g.rotation.y = dampAngle(P.g.rotation.y, up ? Math.atan2(c.x - P.g.position.x, c.z - P.g.position.z) : a.p.yaw, 10, dt); // held up: shown to the camera
      } else P.g.position.copy(P.at);
      if (k === 'trophy' && !P.hold) P.g.rotation.y += dt * 0.6;
      if (k === 'trophy') { P.g.scale.setScalar(P.hold ? 1.15 : 1.5); P.sp = (P.sp || 0) - dt; if (P.sp <= 0) { P.sp = 0.12; FX.glow.spawn(P.g.position.x + rand(-0.3, 0.3), P.g.position.y + rand(0.2, 1), P.g.position.z + rand(-0.3, 0.3), 0, rand(0.3, 0.8), 0, rand(0.05, 0.1), 0.8, col('#ffe27a'), 0, 0.3, 0); } }
    }
    const C = S.cores;
    if (C.g.visible) { // the power cores circle a spot, or the raised hand of whoever has them (the SNAP pose)
      if (C.on && this.A[C.on]) { const P = this.A[C.on].p.P; P.armL.localToWorld(_mvA.set(0, -0.8, 0)); } else _mvA.copy(C.at);
      C.lerp = Math.min(1, C.lerp + dt * 1.8);
      C.g.position.lerp(_mvA, C.lerp >= 1 ? 1 : 0.12);
      const n = C.g.children.length, r = C.on ? 0.42 : 0.9;
      C.g.children.forEach((c, i) => { const a = this.t * 2.2 + i / n * TAU; c.position.set(Math.cos(a) * r, Math.sin(this.t * 3 + i) * 0.12, Math.sin(a) * r); c.rotation.set(this.t * 2 + i, this.t * 1.5, 0); });
    }
  },
  /** I SNAP YOU AWAY: a click, sparks in every core's colour, a white flash, and the cores vanish into the hand */
  snapFx(key) {
    const a = this.A[key]; if (!a) return;
    a.p.P.armL.localToWorld(_mvA.set(0, -0.8, 0));
    Sfx.snap(); Shake.add(0.3); this.flash('#ffffff');
    for (const r of RARITIES) FX.sparks(_mvA.x, _mvA.y, _mvA.z, RARITY_HEX[r], 10, 5, 0.1, 0.6);
    FX.ring(a.p.pos.x, 0.25, a.p.pos.z, '#ffffff', 2.5, 30);
    this.props.cores.g.visible = false;
  },
  /* ---------- the actors ---------- */
  begin(a, T) {
    const p = a.p, B = this.ball;
    T.t = 0;
    switch (T.k) {
      case 'move': if (!T.keep && p.state !== 'free') p.setState('free'); if (T.ball && B.own !== a) this.give(a); break;
      case 'emote': p.emote = T.name; p.setState('emote', T.dur); p._meteor = p._heart = p._fw = -1; break;
      case 'juggle': if (p.state !== 'free') p.setState('free'); B.own = null; B.jug = a; B.jt = 0; B.jn = -1; B.fly = false; B.mesh.visible = true; break;
      case 'kick': if (p.state !== 'free') p.setState('free'); break;
      case 'slide': p.setState('slide'); T.sx = p.pos.x; T.sz = p.pos.z; p.yaw = Math.atan2(T.x - p.pos.x, T.z - p.pos.z); Sfx.slide(); FX.dirt(p.pos.x, p.pos.z, Math.sin(p.yaw), Math.cos(p.yaw), 10); break;
      case 'feint': p.setState('dash'); p.feint = T.side; p.dash = { t: 0, dur: 0.34 }; Sfx.dodge(); break;
      case 'fall': p.fallDir = T.dir; p.setState('down', T.dur); Sfx.tackle(); if (B.own === a) { B.own = null; B.vel.set(Math.sin(p.yaw) * 4, 2, Math.cos(p.yaw) * 4); B.fly = true; } break;
      case 'jump': a.vy = 6.5; p.onGround = false; break;
      case 'glow': p.awakeT = 1e4; FX.awakenBurst(p); Sfx.ability(); Shake.add(0.2); break;
      case 'giant': p.fx.big = T.on ? 1e4 : 0; if (T.on) { Sfx.boing(); FX.ring(p.pos.x, 0.2, p.pos.z, '#ffffff', 1.6, 22); } break;
      case 'join': this.join(a); break;
      case 'hide': p.P.root.visible = p.blob.visible = false; break;
      case 'show': p.P.root.visible = p.blob.visible = true; break;
    }
  },
  /** JOINS YOUR TEAM: a flash of light in their colour and they are wearing your shirt */
  join(a, quiet) {
    const p = a.p;
    if (p.side !== this.home) { p.side = this.home; p.team = 0; p.repaint(); }
    if (quiet) return; // finished early: the new kit only (the card would cover the next line)
    FX.awakenBurst(p); this.flash(p.aura); Shake.add(0.25);
    World.excite[0] = World.excite[1] = 1;
    Cutscene.join(a.key);
  },
  /** one task, one frame. true when it is done */
  run(a, T, dt) {
    const p = a.p, B = this.ball;
    T.t += dt;
    switch (T.k) {
      case 'move': {
        const dx = T.x - p.pos.x, dz = T.z - p.pos.z, L = Math.hypot(dx, dz);
        if (L < 0.06) { p.pos.x = T.x; p.pos.z = T.z; return true; }
        const sp = Math.min(T.sp, L * 3.5 + 0.8), s = Math.min(L, sp * dt);
        p.vel.set(dx / L * sp, 0, dz / L * sp);
        p.pos.x += dx / L * s; p.pos.z += dz / L * s;
        p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 12, dt);
        if (T.sp >= MV_SPEED.sprint && Math.random() < dt * 40) FX.trail(p.pos.x, p.pos.y + rand(0.5, 1.5), p.pos.z, p.aura, 0.22, 0.4); // a streak of speed
        if (T.sp >= MV_SPEED.run && Math.random() < dt * 8) FX.dust(p.pos.x, p.pos.z, 1);
        return false;
      }
      case 'face': {
        const y = this.yawTo(a, T.tg); a.fixed = T.tg;
        if (y == null) return true;
        p.yaw = dampAngle(p.yaw, y, 11, dt);
        return Math.abs(wrapA(y - p.yaw)) < 0.06 || T.t > 0.6;
      }
      case 'wait': return T.t >= T.dur;
      case 'emote': return T.dur <= 0 || T.t >= T.dur;
      case 'juggle': if (B.jug !== a) return true; if (T.t >= T.dur) { this.give(a); return true; } return false;
      case 'trap': {
        if (B.own === a) return true;
        if (!B.own && !B.jug) { this.feet(a, _mvA); if (Math.hypot(_mvA.x - B.pos.x, _mvA.z - B.pos.z) < 1.6 && B.pos.y < 1.5) { this.give(a); Sfx.touch(); return true; } }
        if (T.t > 3) { this.give(a); return true; }
        return false;
      }
      case 'kick': {
        if (!T.go) { // turn to where it goes first
          if (T.to && this.A[T.to]) { const r = this.A[T.to].p; T.tx = r.pos.x + Math.sin(r.yaw) * 0.55; T.tz = r.pos.z + Math.cos(r.yaw) * 0.55; T.ty = BALL_R; }
          const want = Math.atan2(T.tx - p.pos.x, T.tz - p.pos.z);
          p.yaw = dampAngle(p.yaw, want, 16, dt);
          if (T.t > 0.24 || Math.abs(wrapA(want - p.yaw)) < 0.08) {
            T.go = true; p.kickT = 0; p.kickStyle = 'strike'; p.kickPow = T.pow; p.kickDur = 0.42;
            if (B.own !== a && B.jug !== a) { this.give(a); }
            if (B.jug === a) { B.jug = null; }
            B.own = null; this.feet(a, B.pos);
          }
          return false;
        }
        const k = p.kickT < 0 ? 1 : p.kickT;
        if (!T.hit && k >= 0.36) { // the boot meets the ball
          T.hit = true;
          const dx = T.tx - B.pos.x, dz = T.tz - B.pos.z, dist = Math.hypot(dx, dz);
          const Tf = T.T || (T.to ? clamp(dist / 15, 0.35, 1.1) : clamp(dist / 24, 0.4, 1.3));
          B.vel.set(dx / Tf, (T.ty - B.pos.y) / Tf + 0.5 * B.g * Tf, dz / Tf);
          B.fly = true; B.inNet = false; B.own = null; B.to = T.to || null; B.cheer = !!T.cheer;
          Sfx.kick(T.pow); if (T.cheer) { Shake.add(0.15); FX.sparks(B.pos.x, B.pos.y, B.pos.z, p.aura, 10, 4, 0.12, 0.35); }
        }
        return T.hit && p.kickT < 0;
      }
      case 'slide': {
        const u = Math.min(1, T.t / 0.55), e = 1 - (1 - u) * (1 - u);
        p.pos.x = lerp(T.sx, T.x, e); p.pos.z = lerp(T.sz, T.z, e); p.vel.set(0, 0, 0);
        if (T.win && !T.took && B.own && B.own !== a && Math.hypot(B.pos.x - p.pos.x, B.pos.z - p.pos.z) < 1.3) { T.took = true; Sfx.tackle(); FX.dirt(p.pos.x, p.pos.z, Math.sin(p.yaw), Math.cos(p.yaw), 12); this.give(a); }
        if (T.t >= 0.85) { p.setState('free'); if (T.win && !T.took) this.give(a); return true; }
        return false;
      }
      case 'feint': {
        p.dash.t += dt; const sx = Math.cos(p.yaw), sz = -Math.sin(p.yaw), go = p.dash.t > p.dash.dur * 0.62 ? 1 : 0;
        p.pos.x += (Math.sin(p.yaw) * 2 - sx * T.side * 4 * go) * dt; p.pos.z += (Math.cos(p.yaw) * 2 - sz * T.side * 4 * go) * dt;
        if (p.dash.t >= p.dash.dur) { p.setState('free'); p.dash = null; p.feint = 0; return true; }
        return false;
      }
      case 'fall': return p.state !== 'down';
      case 'jump': return a.vy === 0 && p.pos.y <= 0;
      default: return true; // instant ones (glow, giant, join, hide, show)
    }
  },
  tickActor(a, dt) {
    const p = a.p, B = this.ball;
    if (!a.task && a.q.length) { a.task = a.q.shift(); this.begin(a, a.task); }
    p.vel.set(0, 0, 0); a.ov = null;
    const T = a.task;
    if (T && this.run(a, T, dt)) a.task = null;
    if (!a.task && a.q.length) { a.task = a.q.shift(); this.begin(a, a.task); }
    // the talker gestures while the line types out; everyone else turns to them
    const talking = a.key === this.speaker && Cutscene.typing;
    if (talking && !a.task && !a.q.length && p.state === 'free') { p.emote = 'talk'; p.setState('emote', 0); }
    if (!talking && p.state === 'emote' && p.emote === 'talk') p.setState('free');
    const busy = a.task && (a.task.k === 'move' || a.task.k === 'kick' || a.task.k === 'slide' || a.task.k === 'feint' || a.task.k === 'face');
    const still = p.state === 'down' || p.state === 'slide' || p.state === 'dash' || (p.state === 'emote' && ['sad', 'chill', 'knees', 'snap', 'meteor', 'spin', 'flip'].includes(p.emote));
    if (!busy && !still && B.jug !== a) {
      const y = this.yawTo(a, a.fixed || (a.key === this.speaker ? this.listener : this.speaker));
      if (y != null) p.yaw = dampAngle(p.yaw, y, 5, dt);
    }
    // jumping, timers the match would run (Player.tickTimers is not used here)
    if (a.vy || p.pos.y > 0) { a.vy -= 22 * dt; p.pos.y += a.vy * dt; if (p.pos.y <= 0) { p.pos.y = 0; a.vy = 0; p.onGround = true; FX.dust(p.pos.x, p.pos.z, 3); } }
    p.stateT += dt;
    if (p.stateDur > 0 && p.stateT >= p.stateDur && (p.state === 'emote' || p.state === 'down')) p.setState('free');
    if (p.kickT >= 0) { p.kickT += dt / p.kickDur; if (p.kickT >= 1) p.kickT = -1; }
    p.animate(dt);
    if (B.jug === a) { // keepy-uppies: the leg that touches it lifts
      const per = 0.56, ph = (B.jt % per) / per, side = Math.floor(B.jt / per) % 2, w = Math.max(Math.exp(-Math.pow(ph / 0.14, 2)), Math.exp(-Math.pow((1 - ph) / 0.16, 2)));
      const P = p.P; (side ? P.legL : P.legR).rotation.x = -0.85 * w; P.armL.rotation.z = 0.35 + 0.15 * w; P.armR.rotation.z = -0.35 - 0.15 * w;
      P.headP.rotation.x = 0.25 - 0.3 * (1 - Math.sin(Math.PI * ph));
    }
    if (p.awakeT > 0) FX.awaken(p, dt);
    p.P.root.updateMatrixWorld(true);
  },
  update(rdt) {
    if (!this.on) return;
    const dt = Math.min(rdt, 0.05);
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; if (this.t >= tm.at) { this.timers.splice(i, 1); tm.fn(); } }
    for (const k in this.A) this.tickActor(this.A[k], dt);
    this.tickBall(dt);
    this.tickProps(dt);
    if (this.t < this.confT) { // confetti over everyone
      this.confAcc += dt * 70;
      const c = this.camL || _mvE.set(0, 0, 0), hexes = [this.home.hex, '#ffffff', '#ffd54a', '#ff5fb0', '#4aa8ff'];
      while (this.confAcc > 1) { this.confAcc -= 1; FX.lit.spawn(c.x + rand(-9, 9), rand(7, 10), c.z + rand(-9, 9), rand(-1, 1), rand(-1.5, 0), rand(-1, 1), rand(0.08, 0.14), rand(2.5, 3.5), col(pick(hexes)), 0.16, 1.4, 0); }
    }
    this.camera(dt);
  },
  /* ---------- the camera ---------- */
  cut(s) { this.shot = { s, t0: this.t, fresh: true, ang: null, side: null }; },
  head(key, out) {
    const a = this.A[key]; if (!a) return out.set(0, 1.6, 0);
    const P = a.p.P; P.headP.getWorldPosition(out); out.y += 0.22 * P.root.scale.x; return out;
  },
  fwd(key, out) { const a = this.A[key], y = a ? a.p.yaw : 0; return out.set(Math.sin(y), 0, Math.cos(y)); },
  /** which side of a line a camera goes: keep the side the camera is on now (films keep to one side of the action) */
  sideOf(M, dir) { const c = World.camera.position; const s = (c.x - M.x) * dir.z - (c.z - M.z) * dir.x; return s >= 0 ? 1 : -1; },
  /** the first frame of a shot picks its side: the one asked for, unless someone stands in the way and the other side is clearer */
  side(S, pref, make, skip) {
    if (S.side == null) {
      make(pref); const b1 = this.blocked(this._D, this._L, skip);
      if (b1) { make(-pref); S.side = this.blocked(this._D, this._L, skip) < b1 ? -pref : pref; } else S.side = pref;
    }
    make(S.side);
  },
  /** how many people stand between the camera and what it looks at (or right on top of the camera) */
  blocked(D, L, skip) {
    let n = 0;
    for (const k in this.A) {
      if (skip.includes(k) || !this.A[k].p.P.root.visible) continue;
      const p = this.A[k].p.pos, vx = L.x - D.x, vz = L.z - D.z, wx = p.x - D.x, wz = p.z - D.z, ll = vx * vx + vz * vz || 1;
      const len = Math.sqrt(ll), t = clamp((wx * vx + wz * vz) / ll, 0, 1), along = t * len, perp = Math.hypot(wx - vx * t, wz - vz * t);
      if (along < len - 0.5 && perp < 0.45 + 0.6 * along / len) n++; // in front of the people filmed
      else if (along < 3.2 && perp < 0.3 + along * 0.42) n++; // close to the lens: a big blur over the picture
    }
    return n;
  },
  /** the shot's camera [position, look-at, fov] for this frame */
  pose(S, u, D, L) {
    const s = S.s, k = s[0], A = this.A;
    const has = (key) => typeof key === 'string' && A[key];
    switch (k) {
      case 'close': { // head and shoulders from three quarters (never straight down the line to the listener), pushing in
        if (!has(s[1])) break;
        const h = this.head(s[1], _mvA), y = A[s[1]].p.yaw, d = lerp(3.1, 2.7, Math.min(1, u / 5));
        this.side(S, s[2] || 1, (sd) => { const g = y + 0.55 * sd; D.set(h.x + Math.sin(g) * d, h.y - 0.02, h.z + Math.cos(g) * d); L.set(h.x, h.y - 0.3, h.z); }, [s[1]]);
        return 38;
      }
      case 'ots': { // over the listener's shoulder at the talker
        if (!has(s[1]) || !has(s[2])) break;
        const ha = this.head(s[1], _mvA), hb = this.head(s[2], _mvB);
        let dx = ha.x - hb.x, dz = ha.z - hb.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        this.side(S, s[3] || 1, (sd) => { D.set(hb.x - dx * 1.7 + dz * 0.85 * sd, hb.y + 0.2, hb.z - dz * 1.7 - dx * 0.85 * sd); L.set(ha.x, ha.y - 0.25, ha.z); }, [s[1], s[2]]);
        return 38;
      }
      case 'two': { // both, from the side
        if (!has(s[1]) || !has(s[2])) break;
        const ha = this.head(s[1], _mvA), hb = this.head(s[2], _mvB);
        let dx = hb.x - ha.x, dz = hb.z - ha.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const M = _mvC.addVectors(ha, hb).multiplyScalar(0.5), d = Math.max(4.2, l + 2.6);
        this.side(S, s[3] || this.sideOf(M, _mvD.set(dx, 0, dz)), (sd) => { D.set(M.x + dz * d * sd + dx * u * 0.06, M.y - 0.1, M.z - dx * d * sd + dz * u * 0.06); L.set(M.x, M.y - 0.4, M.z); }, [s[1], s[2]]);
        return 40;
      }
      case 'low': { // a hero shot from down low, slowly going round
        if (!has(s[1])) break;
        const a = A[s[1]].p, h = this.head(s[1], _mvA), d = s[3] || 3.8, y0 = S.yaw0 == null ? (S.yaw0 = a.yaw) : S.yaw0;
        this.side(S, 1, (sd) => { const g = y0 + (s[2] || 0.45) * sd + u * 0.07 * sd; D.set(a.pos.x + Math.sin(g) * d, 0.6, a.pos.z + Math.cos(g) * d); L.set(h.x, h.y - 0.15, h.z); }, [s[1]]);
        return 44;
      }
      case 'orbit': { // round and round someone
        if (!has(s[1])) break;
        const a = A[s[1]].p, h = this.head(s[1], _mvA);
        if (S.ang == null) S.ang = a.yaw + 0.5;
        const g = S.ang + u * (s[4] == null ? 0.3 : s[4]), r = s[2] || 4.5;
        D.set(a.pos.x + Math.sin(g) * r, s[3] || 1.7, a.pos.z + Math.cos(g) * r); L.set(h.x, h.y - 0.4, h.z);
        return 46;
      }
      case 'track': // from the side, keeping up with someone running
      case 'follow': // from behind
      case 'lead': { // in front, walking toward the camera
        if (!has(s[1])) break;
        const a = A[s[1]].p, sp = len2D(a.vel.x, a.vel.z);
        if (!S.dir) S.dir = V3(Math.sin(a.yaw), 0, Math.cos(a.yaw));
        if (sp > 0.5) { S.dir.x = damp(S.dir.x, a.vel.x / sp, 3, 1 / 60); S.dir.z = damp(S.dir.z, a.vel.z / sp, 3, 1 / 60); const l = Math.hypot(S.dir.x, S.dir.z) || 1; S.dir.x /= l; S.dir.z /= l; }
        const dir = S.dir;
        if (k === 'track') { if (S.side == null) S.side = s[2] || this.sideOf(a.pos, dir); const d = s[3] || 5.5; D.set(a.pos.x + dir.z * d * S.side + dir.x * 1.4, 1.5, a.pos.z - dir.x * d * S.side + dir.z * 1.4); L.set(a.pos.x + dir.x * 1.2, 1.1, a.pos.z + dir.z * 1.2); return 46; }
        if (k === 'follow') { D.set(a.pos.x - dir.x * 4.4, 2.0, a.pos.z - dir.z * 4.4); L.set(a.pos.x + dir.x * 4, 1.0, a.pos.z + dir.z * 4); return 50; }
        const h = this.head(s[1], _mvA); D.set(a.pos.x + dir.x * 3.8, 1.55, a.pos.z + dir.z * 3.8); L.set(h.x, h.y - 0.25, h.z); return 42;
      }
      case 'wide': { // high and wide round a spot
        if (S.ang == null) { const c = World.camera.position; S.ang = Math.atan2(c.x - (s[1] || 0), c.z - (s[2] || 0)); if (!isFinite(S.ang)) S.ang = 0.6; }
        const g = S.ang + u * (s[5] == null ? 0.12 : s[5]), r = s[3] || 14;
        D.set((s[1] || 0) + Math.sin(g) * r, s[4] || 6, (s[2] || 0) + Math.cos(g) * r); L.set(s[1] || 0, 1, s[2] || 0);
        return 50;
      }
      case 'fly': { // a crane shot: from one spot to another, looking at someone or something
        const q = smooth(Math.min(1, u / (s[4] || 4))), a0 = s[1], a1 = s[2];
        D.set(lerp(a0[0], a1[0], q), lerp(a0[1], a1[1], q), lerp(a0[2], a1[2], q));
        if (typeof s[3] === 'string') { this.head(s[3], L); L.y -= 0.3; } else L.set(s[3][0], s[3][1], s[3][2]);
        return 48;
      }
      case 'goal': { // behind the net, looking out at the ball
        const sg = s[1] || 1, B = this.ball;
        D.set(clamp(B.pos.x * 0.35, -3, 3), 1.6, sg * (F.L + F.GD + 1.6)); L.set(B.pos.x, Math.max(0.6, B.pos.y), B.pos.z);
        return 50;
      }
      case 'group': { // a few people together, from the way they face
        const keys = (s[1] || []).filter(has); if (!keys.length) break;
        const C = _mvC.set(0, 0, 0); let fx = 0, fz = 0, spread = 0;
        for (const key of keys) { C.add(this.head(key, _mvA)); fx += Math.sin(A[key].p.yaw); fz += Math.cos(A[key].p.yaw); }
        C.multiplyScalar(1 / keys.length);
        for (const key of keys) spread = Math.max(spread, Math.hypot(A[key].p.pos.x - C.x, A[key].p.pos.z - C.z));
        if (!S.dir) { const l = Math.hypot(fx, fz); S.dir = l > 0.3 ? V3(fx / l, 0, fz / l) : V3(0, 0, 1); }
        const d = spread * 1.5 + 3.6 + u * 0.08;
        D.set(C.x + S.dir.x * d + S.dir.z * 0.8, C.y + 0.5, C.z + S.dir.z * d - S.dir.x * 0.8); L.set(C.x, C.y - 0.45, C.z);
        return 46;
      }
    }
    const y = this.A.YOU ? this.A.YOU.p.pos : _mvA.set(0, 0, 0); // a shot that cannot be taken (someone is missing): a wide one
    D.set(y.x + 9, 5, y.z - 9); L.set(y.x, 1, y.z);
    return 50;
  },
  camera(dt) {
    const S = this.shot; if (!S) return;
    const cam = World.camera, D = this._D || (this._D = V3()), L = this._L || (this._L = V3());
    const fov = this.pose(S, this.t - S.t0, D, L);
    D.x = clamp(D.x, -F.BOARD_X + 0.8, F.BOARD_X - 0.8); D.z = clamp(D.z, -F.BOARD_Z + 0.8, F.BOARD_Z - 0.8); D.y = Math.max(0.3, D.y);
    if (!this.camL) this.camL = V3();
    if (S.fresh || S.s[0] === 'fly') { cam.position.copy(D); this.camL.copy(L); S.fresh = false; }
    else { const r = S.s[0] === 'track' || S.s[0] === 'follow' || S.s[0] === 'lead' ? 5 : 7; cam.position.x = damp(cam.position.x, D.x, r, dt); cam.position.y = damp(cam.position.y, D.y, r, dt); cam.position.z = damp(cam.position.z, D.z, r, dt); this.camL.x = damp(this.camL.x, L.x, r + 2, dt); this.camL.y = damp(this.camL.y, L.y, r + 2, dt); this.camL.z = damp(this.camL.z, L.z, r + 2, dt); }
    cam.position.x += Shake.x; cam.position.y += Shake.y;
    cam.lookAt(this.camL);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  },
};
