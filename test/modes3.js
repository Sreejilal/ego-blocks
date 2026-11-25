// CHAOS (the rules change every 25 seconds), BOMB BALL (the ball is a bomb) and TINY GOALS (small goals, no keepers),
// run the way the online server runs them (bots only, no screen), then once on a real server with two pretend players.
// No browser, so it is light on memory.   node test/modes3.js
const G = require('../server/headless').load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const STEP = 1 / 60, F = G.F;
const away = G.CLUB_IDS.find((c) => c !== 'ROVERS');
const mk = (mode, opts = {}) => { const m = new G.Match(mode, 0.5, Object.assign({ humans: [], size: 3, bots: 'fill', noHuman: true, autopilot: true, home: 'ROVERS', away, length: 120, goldenLength: 10 }, opts)); m.autopilot = true; return m; };
const toPlay = (m) => { for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP); return m.phase === 'play'; };
const whole = (mode, opts) => { // a whole bot match: goals and anything that went wrong
  let m = null, err = null, extra = {};
  try { m = mk(mode, Object.assign({ length: 240 }, opts)); const seen = new Set(); let booms = 0, s = 0; while (!m.result) { m.update(STEP); if (m.chaos && m.chaos.on) seen.add(m.chaos.on); if (m.lastGoal && m.lastGoal.bomb && m.phase === 'goal' && m.phaseT < STEP * 1.5) booms++; if (++s > 60 * 600) throw new Error('never ended'); } extra = { twists: [...seen], booms }; } catch (e) { err = e.stack.split('\n').slice(0, 3).join(' | '); }
  return Object.assign({ err, score: m && m.score, goals: m ? m.score[0] + m.score[1] : 0 }, extra);
};

(async () => {
  check('three new modes with names and tips', ['chaos', 'bomb', 'tiny'].every((k) => G.MODES[k] && G.MODES[k].name && G.MODES[k].tip), ['chaos', 'bomb', 'tiny'].map((k) => G.MODES[k] && G.MODES[k].name));

  // ---- CHAOS ----
  let m = mk('chaos'); toPlay(m);
  check('CHAOS: it starts as normal football', m.chaos.on === null && m.twist() === null);
  for (let i = 0; i < 60 * 13 && !m.chaos.on; i++) { m.update(STEP); if (m.phase !== 'play') toPlay(m); }
  const first = m.chaos.on;
  check('CHAOS: about 12 seconds in, a twist comes on', !!first && !!G.CHAOS_TWISTS[first], first);
  const rules = {};
  for (const id of Object.keys(G.CHAOS_TWISTS)) {
    m.chaos.on = id; const c0 = m.clock; m.phase = 'play'; m.update(STEP);
    rules[id] = { g: G.gravity(), gw: F.GW, gh: F.GH, clock: +((c0 - m.clock) / STEP).toFixed(2), big: m.players.every((p) => p.fx.big > 0), shot: (() => { const p = m.players.find((q) => !q.isGK); p.computeMods(); return +p.mods.shot.toFixed(2); })() };
    for (const p of m.players) p.fx.big = 0;
  }
  check('CHAOS twists do what they say: MOON BALL floats, MEGA and TINY GOALS, TURBO runs faster, GIANTS, ROCKET SHOTS', rules.moon.g === 6.5 && rules.mega.gw === F.W - F.POST && rules.tiny.gw === 2 && rules.tiny.gh === 2 && rules.turbo.clock > 1.25 && rules.giants.big && rules.rockets.shot >= 1.6, rules);
  m.chaos.on = null; m.update(STEP);
  check('CHAOS: with no twist, everything is back to normal', G.gravity() === 16 && F.GW === 5.5 && F.GH === 3.5, { g: G.gravity(), gw: F.GW });
  m.chaos.on = 'moon'; m.chaos.last = 'moon'; m.chaos.t = 0.001; m.phase = 'play'; m.update(STEP);
  const off = m.chaos.on; m.chaos.t = 0.001; m.phase = 'play'; m.update(STEP);
  check('CHAOS: a twist ends after a while, and the next one is never the same', off === null && !!m.chaos.on && m.chaos.on !== 'moon', { off, next: m.chaos.on });
  const ch = whole('chaos');
  check('CHAOS: bots play a whole match with no error, through several twists, and score', !ch.err && ch.twists.length >= 3 && ch.goals >= 1, ch);

  // ---- BOMB BALL ----
  m = mk('bomb'); toPlay(m);
  check('BOMB BALL: the fuse starts at 15 seconds', m.bomb.t > 14.5, m.bomb.t);
  m.bomb.t = 1; const out = m.phase; m.phase = 'out'; for (let i = 0; i < 90; i++) { m.phase = 'out'; m.updateBomb(STEP); }
  check('BOMB BALL: the fuse only burns in open play', m.bomb.t === 1, m.bomb.t); m.phase = out;
  toPlay(m);
  const b = m.ball; if (b.owner) b.release();
  b.pos.set(3, 0.3, -15); b.vel.set(0, 0, 0); // in team 0's half (team 0 defends -Z)
  const near = m.teams[1].find((p) => !p.isGK), far = m.teams[0].find((p) => p.isGK);
  near.pos.set(4, 0, -14); near.setState('free'); far.pos.set(0, 0, 30);
  const s0 = m.score.slice(); m.bomb.t = 0.01; m.update(STEP);
  check('BOMB BALL: it goes off in team 0\'s half: team 1 gets a point, players near are knocked over, a new fuse', m.score[1] === s0[1] + 1 && m.score[0] === s0[0] && near.state === 'down' && far.state !== 'down' && m.phase === 'goal' && m.bomb.t === 15, { s0, s: m.score, near: near.state, phase: m.phase, fuse: m.bomb.t });
  for (let i = 0; i < 400 && m.phase !== 'kickoff'; i++) m.update(STEP);
  check('BOMB BALL: then the team that was bombed kicks off', m.phase === 'kickoff' && m.kickTeam === 0, { phase: m.phase, kick: m.kickTeam });
  const bb = whole('bomb');
  check('BOMB BALL: bots play a whole match with no error, and the bomb goes off now and then', !bb.err && bb.booms >= 2, bb);

  // ---- TINY GOALS ----
  m = mk('tiny'); toPlay(m);
  check('TINY GOALS: the goals are 3 wide and 1.75 high, and nobody is in goal', F.GW === 1.5 && F.GH === 1.75 && !m.players.some((p) => p.isGK), { gw: F.GW, gh: F.GH, gk: m.players.filter((p) => p.isGK).length });
  let tg = { goals: 0 }, tries = 0, sum = 0;
  for (; tries < 3; tries++) { tg = whole('tiny'); if (tg.err) break; sum += tg.goals; }
  check('TINY GOALS: bots play whole matches with no error and score, but well under No Keepers (about 22 a match)', !tg.err && sum >= 2 && sum / 3 < 18, { err: tg.err, goals3: sum });
  mk('quick').update(STEP);
  check('after TINY GOALS the next match has normal goals again', F.GW === 5.5 && F.GH === 3.5, F.GW);

  // ---- online: a real server, two pretend players ----
  {
    const { spawn } = require('child_process'), path = require('path'), WebSocket = require('ws');
    const PORT = 18801, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '40', GOLDEN_SECONDS: '2' }) });
    let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
    for (let i = 0; i < 50 && !/SCORZ server/.test(log); i++) await sleep(100);
    const client = () => { const ws = new WebSocket('ws://localhost:' + PORT + '/ws'), c = { ws, last: {}, bms: [], tws: new Set(), booms: 0 }; ws.on('message', (raw) => { const m = JSON.parse(raw); c.last[m.t] = m; if (m.t === 'snap') { if (m.bm != null) c.bms.push(m.bm); if ('tw' in m) c.tws.add(String(m.tw)); for (const e of m.ev || []) if (e.e === 'bomb') c.booms++; } }); c.send = (m) => ws.send(JSON.stringify(m)); c.open = new Promise((r) => ws.on('open', r)); return c; };
    const a = client(), bb2 = client(); await a.open; await bb2.open;
    a.send({ t: 'hello', name: 'ali', style: 'ROOKIE' }); bb2.send({ t: 'hello', name: 'ben', style: 'ROOKIE' });
    a.send({ t: 'create' }); await sleep(200);
    bb2.send({ t: 'join', code: a.last.room.code }); await sleep(200);
    const picked = [];
    for (const md of ['chaos', 'bomb', 'tiny']) { a.send({ t: 'settings', mode: md }); await sleep(120); picked.push(a.last.room.mode); }
    check('online: the host can pick CHAOS, BOMB BALL and TINY GOALS', picked.join() === 'chaos,bomb,tiny', picked);
    a.send({ t: 'settings', mode: 'bomb' }); await sleep(120);
    a.send({ t: 'start' }); await sleep(4500);
    const fuse = bb2.bms.slice(-1)[0];
    check('online BOMB BALL: the fuse comes in the snapshots and burns down', bb2.bms.length > 10 && fuse < 15 && fuse > 0, { n: bb2.bms.length, last: fuse });
    check('online: no server errors', !/Error|TypeError|ReferenceError/.test(log), log.split(/\n/).filter((l) => /Error/.test(l)).slice(0, 3));
    a.ws.close(); bb2.ws.close(); srv.kill();
  }
  console.log(results.join('\n'));
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
