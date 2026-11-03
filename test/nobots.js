// Online with no bots: the host picks BOTS: FILL, KEEPERS ONLY or NONE. With bots off only the friends play
// (KEEPERS ONLY keeps computer keepers), each team needs a player, and a match with no keepers still plays
// properly: goal kicks are taken by a player, shots and restarts work. Starts its own server.
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18792;
let srv = null;

function client() {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws');
  const c = { ws, last: {} };
  ws.on('message', (raw) => { const m = JSON.parse(raw); c.last[m.t] = m; });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = new Promise((r) => ws.on('open', r));
  return c;
}

(async () => {
  // 1. the room setting, on the real server
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '6', GOLDEN_SECONDS: '2' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const a = client(), b = client();
  await a.open; await b.open;
  a.send({ t: 'hello', name: 'ali' }); b.send({ t: 'hello', name: 'ben' });
  a.send({ t: 'create' }); await sleep(200);
  check('a new room fills empty spots with bots', a.last.room && a.last.room.bots === 'fill', a.last.room && a.last.room.bots);
  a.send({ t: 'settings', mode: 'quick', size: 3, bots: 'none' }); await sleep(150);
  check('the host can switch bots off', a.last.room.bots === 'none');
  a.send({ t: 'start' }); await sleep(150);
  check('with no bots, a match needs a player on each team', a.last.error && /EACH TEAM NEEDS A PLAYER/.test(a.last.error.text) && a.last.room.state === 'room', a.last.error);
  b.send({ t: 'join', code: a.last.room.code }); await sleep(200);
  a.send({ t: 'settings', mode: 'quick', size: 3, bots: 'bad' }); await sleep(150);
  check('a bad setting is ignored', a.last.room.bots === 'none');
  a.send({ t: 'start' }); await sleep(400);
  const st = a.last.start;
  check('NONE: only the two friends play, no keepers', st && st.roster.length === 2 && st.roster.every((r) => r.id && r.role !== 'GK') && st.roster[0].team !== st.roster[1].team, st && st.roster.map((r) => r.role + (r.id ? '' : ' (bot)')));
  // both press forward and shoot now and then until the end
  for (let i = 0; i < 70; i++) { for (const c of [a, b]) c.send({ t: 'input', mx: 0, my: 1, sp: true, sd: i % 10 === 0, su: i % 10 === 4 }); await sleep(100); }
  for (let i = 0; i < 80 && !(a.last.end && b.last.end); i++) await sleep(100);
  check('the match plays to the end', !!(a.last.end && b.last.end), a.last.end && a.last.end.score);
  a.send({ t: 'settings', mode: 'quick', size: 3, bots: 'keepers' }); await sleep(150);
  a.send({ t: 'start' }); await sleep(400);
  const st2 = a.last.start;
  check('KEEPERS ONLY: the friends and two computer keepers', st2 && st2.roster.length === 4 && st2.roster.filter((r) => r.role === 'GK' && !r.id).length === 2, st2 && st2.roster.map((r) => r.role + (r.id ? '' : ' (bot)')));
  a.ws.close(); b.ws.close(); await sleep(200);
  check('no server errors', !/Error|TypeError/.test(out), out.split('\n').filter((l) => /Error/.test(l)).slice(0, 3));

  // 2. a long match with no keepers on the server's copy of the game: shots, goals, goal kicks, no crash
  const G = require('../server/headless').load();
  const m = new G.Match('quick', 0.5, { humans: [{ id: 'a', team: 0, name: 'A', style: 'ROOKIE', look: {} }, { id: 'b', team: 1, name: 'B', style: 'SPRINTER', look: {} }], size: 3, bots: 'none', length: 90, goldenLength: 20 });
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const ctl = () => ({ moveX: rnd() * 2 - 1, moveY: rnd() < 0.7 ? 1 : -1, sprint: rnd() < 0.5, jump: rnd() < 0.01, jumpHeld: false, shootDown: rnd() < 0.03, shootHeld: rnd() < 0.5, shootUp: rnd() < 0.03, passDown: rnd() < 0.02, passUp: rnd() < 0.02, passHeld: false, dodge: rnd() < 0.01, tackle: rnd() < 0.02, ab: [rnd() < 0.01, rnd() < 0.01, rnd() < 0.01], flow: false, awaken: false, shiftLock: false, emote: -1, item: false, board: false, camYaw: rnd() * 6.28, aim: null });
  const restarts = {}, oR = m.doRestart.bind(m); m.doRestart = function () { const r = m.restart; if (r) restarts[r.type] = (restarts[r.type] || 0) + 1; return oR(); };
  let err = null, t = 0, goalKickBy = null;
  try {
    while (m.phase !== 'end' && t < 200) {
      for (const h of m.humans) h.ctl = ctl();
      for (const h of m.humans) { const gz = m.oppGoalZ(h.team); h.ctl.camYaw = Math.atan2(-h.pos.x, gz - h.pos.z) + (rnd() - 0.5); h.ctl.aim = m.aim.clone().set((rnd() - 0.5) * 12, 1, gz); }
      m.update(1 / 60); t += 1 / 60;
      if (m.setPieceBy && m.setPieceBy.setPiece && m.setPieceBy.setPiece.type === 'goalkick') goalKickBy = m.setPieceBy.isGK ? 'keeper' : 'player';
    }
  } catch (e) { err = e.message + ' ' + (e.stack || '').split('\n')[1]; }
  check('no keepers: a whole match runs, with goals and restarts', !err && m.phase === 'end' && m.players.length === 2 && !m.keeperOf(0) && m.score[0] + m.score[1] > 0, { err, score: m.score, restarts, mins: +(t / 60).toFixed(1) });
  check('no keepers: a goal kick is taken by a player', goalKickBy === 'player' || !restarts['GOAL KICK'], { goalKickBy, restarts });
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exitCode = 1; })
  .finally(() => { if (srv) srv.kill(); setTimeout(() => process.exit(), 300); });
