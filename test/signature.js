// Signature moves (owner, Nov 26 2026: "actual new moves, not a different person with a combo of some random moves; if any
// character has the same moves replace them with a different move, if you can't at least change their animation"):
// every character has a move nobody else has, each new move does what it says in a real match, two characters that share a
// move never animate it the same way, and bots play whole matches with every character without an error.
// node test/signature.js   (run `npm run build` first)
const G = require('../server/headless').load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const STEP = 1 / 60, ids = Object.keys(G.STYLES);

// ---- every character has a move of its own; shared moves look different ----
const use = {};
for (const id of ids) for (const a of G.STYLES[id].abilities) (use[a] = use[a] || []).push(id);
const lonely = ids.filter((id) => G.STYLES[id].abilities.every((a) => use[a].length > 1));
check('every character has at least one move nobody else has', lonely.length === 0 && ids.length >= 35, { lonely, moves: Object.keys(G.ABILITIES).length });
const clash = [];
for (const [a, who] of Object.entries(use)) for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) if (G.STYLE_ANIM[who[i]] === G.STYLE_ANIM[who[j]]) clash.push(a + ':' + who[i] + '=' + who[j]);
check('two characters that share a move never move the same way doing it', clash.length === 0 && ids.every((id) => G.MOVE_ANIMS.includes(G.STYLE_ANIM[id])), clash.slice(0, 6));

// ---- each new move in a real match ----
const away = 'EMBER';
const setup = (style, gk) => {
  const m = new G.Match('quick', 0.5, { size: 4, home: 'ROVERS', away, role: gk ? 'GK' : 'ST', length: 200 });
  for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP);
  const h = m.human; h.styleId = style; h.style = G.STYLES[style]; h.abil = h.style.abilities.map((id) => ({ id, def: G.ABILITIES[id], cd: 0 }));
  for (const p of m.players) if (p !== h) { p.wall = true; p.pos.set(p.team ? 30 : -30, 0, p.team ? 40 : -40); p.vel.set(0, 0, 0); }
  h.pos.set(0, 0, 0); h.yaw = m.dir(h.team) > 0 ? 0 : Math.PI; h.vel.set(0, 0, 0); h.setState('free');
  m.ball.release(); m.ball.reset(30, -30 * m.dir(h.team));
  return m;
};
const fwd = (m, d) => m.dir(m.human.team) * d; // d blocks toward their goal
const foe = (m, i = 0) => m.teams[1 - m.human.team].filter((p) => !p.isGK)[i];
const mate = (m, i = 0) => m.teams[m.human.team].filter((p) => p !== m.human && !p.isGK)[i];
const act = (m, id) => { const i = m.human.abil.findIndex((a) => a.id === id); return m.useAbility(m.human, i); };
const run = (m, n) => { for (let i = 0; i < n; i++) m.update(STEP); };
const T = {};
let m, h, o;

m = setup('PHANTOM'); h = m.human; m.possess(h, true); o = foe(m); o.pos.set(0, 0, fwd(m, 3));
T.shadowStep = act(m, 'shadowStep') && m.prog(h.team, h.pos) > m.prog(h.team, o.pos) && m.ball.owner === h;
m = setup('ENFORCER'); h = m.human; o = foe(m); o.pos.set(0, 0, fwd(m, 4)); m.possess(o, true);
T.shoulderCharge = act(m, 'shoulderCharge') && (run(m, 30), o.state === 'down' || m.ball.owner !== o);
m = setup('MAGNET'); h = m.human; m.ball.reset(6, fwd(m, 5));
T.magnetPull = act(m, 'magnetPull') && (run(m, 60), m.ball.owner === h);
m = setup('WARDEN'); h = m.human; o = foe(m); o.pos.set(1, 0, fwd(m, 1)); m.possess(o, true);
T.sweepKick = act(m, 'sweepKick') && o.state === 'down' && m.ball.owner !== o;
m = setup('COMET'); h = m.human; m.possess(h, true); const s0 = h.stats.shots;
T.meteorStrike = act(m, 'meteorStrike') && (run(m, 40), h.stats.shots > s0);
m = setup('KESTREL'); h = m.human; m.possess(h, true); const mt = mate(m); mt.pos.set(4, 0, fwd(m, 18));
T.skyPass = act(m, 'skyPass') && m.ball.kick && m.ball.kick.type === 'pass' && m.ball.kick.to === mt;
m = setup('ANCHOR'); h = m.human; o = foe(m); o.pos.set(2, 0, fwd(m, 2));
T.anchorDrop = act(m, 'anchorDrop') && o.fx.slowed > 2;
m = setup('FEATHER'); h = m.human; h.pos.set(0, 0, fwd(m, 30)); m.possess(h, true);
T.dropShot = act(m, 'dropShot') && m.ball.gMul > 1.5 && m.ball.vel.y > 8;
m = setup('CAPTAIN'); h = m.human; const mt2 = mate(m); mt2.abil.forEach((a) => { a.cd = 9; });
T.command = act(m, 'command') && mt2.abil.every((a) => a.cd <= 4.01) && mt2.stamina === 100;
m = setup('SPARK'); h = m.human; m.possess(h, true); o = foe(m); o.pos.set(0.6, 0, fwd(m, 4));
T.sparkDash = act(m, 'sparkDash') && o.state === 'stun';
m = setup('VORTEX'); h = m.human; m.possess(h, true); o = foe(m); o.pos.set(1.5, 0, fwd(m, 1));
T.tornadoSpin = act(m, 'tornadoSpin') && o.state === 'down' && h.tackleProof > 0;
m = setup('NOVA'); h = m.human; o = foe(m); o.pos.set(0, 0, fwd(m, 5)); o.yaw = h.yaw + Math.PI;
T.supernova = act(m, 'supernova') && o.state === 'stun';
m = setup('SENTINEL'); h = m.human; o = foe(m); const o2 = foe(m, 1); o.pos.set(3, 0, fwd(m, 6)); o2.pos.set(-3, 0, fwd(m, -6)); m.possess(o, true);
T.intercept = act(m, 'intercept') && (m.passTo(o, o2), run(m, 50), m.ball.owner === h);
m = setup('JESTER'); h = m.human; m.possess(h, true); const mt3 = mate(m); mt3.pos.set(5, 0, fwd(m, 20)); const at = mt3.pos.clone();
T.jokerSwap = act(m, 'jokerSwap') && h.pos.distanceTo(at) < 0.01 && m.ball.owner === h;
m = setup('TEMPEST'); h = m.human; o = foe(m); o.pos.set(0, 0, fwd(m, 4)); m.possess(o, true);
T.gale = act(m, 'gale') && o.state === 'down';
m = setup('ACE'); h = m.human; h.pos.set(0, 0, fwd(m, 16)); m.possess(h, true); const k = m.keeperOf(1 - h.team); k.pos.x = 2.5;
T.aceShot = act(m, 'aceShot') && Math.sign(m.ball.vel.x) === -1;
m = setup('BASTION'); h = m.human; o = foe(m); o.pos.set(0, 0, fwd(m, 3)); m.possess(o, true);
T.shieldBash = act(m, 'shieldBash') && (run(m, 30), m.ball.owner === h);
m = setup('AEGIS', true); h = m.human;
T.lastStand = act(m, 'lastStand') && h.fx.stand > 5;
m = setup('ROGUE'); h = m.human; m.possess(h, true); o = foe(m); o.pos.set(0, 0, fwd(m, 2.5));
T.streetSpin = act(m, 'streetSpin') && (run(m, 30), m.prog(h.team, h.pos) > m.prog(h.team, o.pos));
m = setup('IRONCLAD'); h = m.human; o = foe(m); o.pos.set(0, 0, fwd(m, 6)); m.possess(o, true);
T.ironWall = act(m, 'ironWall') && (o.pos.set(0, 0, fwd(m, 1.5)), run(m, 3), m.ball.owner === h);
m = setup('SOLARIS'); h = m.human; h.pos.set(0, 0, fwd(m, 20)); m.possess(h, true); o = foe(m); o.pos.set(0.4, 0, fwd(m, 26));
const ss = h.stats.shots;
T.solarFlare = act(m, 'solarFlare') && o.state === 'down' && h.stats.shots > ss;
const failed = Object.keys(T).filter((k) => !T[k]);
check('all 21 new moves do what they say in a match', Object.keys(T).length === 21 && failed.length === 0, { failed });
// a move with nothing to do says why, and costs nothing
m = setup('WARDEN'); h = m.human;
const r0 = h.abil.find((a) => a.id === 'sweepKick');
check('a move with nobody in range does nothing and keeps its cooldown ready', !act(m, 'sweepKick') && r0.cd === 0);

// ---- bots play whole matches with every character, no errors ----
let err = null, goals = 0;
try {
  for (let g = 0; g < 5; g++) {
    const pick = ids.filter((id) => !G.STYLES[id].gk);
    const mm = new G.Match('quick', 0.7, { size: 5, home: 'ROVERS', away, noHuman: true, length: 120, teamStyle: [pick[(g * 2) % pick.length], pick[(g * 2 + 1) % pick.length]] });
    for (const p of mm.players) if (!p.isGK) { const id = pick[(mm.players.indexOf(p) * 7 + g * 3) % pick.length]; p.styleId = id; p.style = G.STYLES[id]; p.abil = p.style.abilities.map((a) => ({ id: a, def: G.ABILITIES[a], cd: 0 })); }
    let s = 0; while (!mm.result && s++ < 60 * 160) mm.update(STEP);
    goals += mm.score[0] + mm.score[1];
  }
} catch (e) { err = e.stack.split('\n').slice(0, 3).join(' | '); }
check('bots play five whole matches using every character and their moves, with no error', !err, { err, goals });
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
