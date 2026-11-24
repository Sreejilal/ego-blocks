// Bigger goals, MEGA GOAL (the goal is as wide as the pitch) and BLOCK HEIST (a goal steals the other vault's best block),
// first the rules the way the online server runs them (bots only, no screen), then the screen parts in the browser.
// node test/heist.js   (run `npm run build` first)
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const STEP = 1 / 60, F = G.F;
const away = G.CLUB_IDS.find((c) => c !== 'ROVERS');
const mk = (mode, opts = {}) => { const m = new G.Match(mode, 0.5, Object.assign({ humans: [], size: 3, bots: 'fill', noHuman: true, autopilot: true, home: 'ROVERS', away, length: 120, goldenLength: 10 }, opts)); m.autopilot = true; return m; };
const toPlay = (m) => { for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP); return m.phase === 'play'; };
const kickIn = (m, x, y, side) => { // a ball rolling over the goal line at x (side 1: the goal at +Z)
  const b = m.ball; if (b.owner) b.release();
  for (const p of m.players) p.pos.set(p.pos.x, 0, clamp0(p.pos.z, side)); // everyone out of the way
  b.pos.set(x, y, side * (F.L - 1.2)); b.vel.set(0, 0, side * 16); b.curve.set(0, 0, 0); b.kick = null;
  for (let i = 0; i < 40 && m.phase === 'play'; i++) m.update(STEP);
  return m.phase;
};
const clamp0 = (z, side) => (z * side > 0 ? -side * 10 : z);

(async () => {
  // ---- the goal size ----
  check('the normal goal is 11 wide and 3.5 high (was 9 by 3)', F.GW === 5.5 && F.GH === 3.5, [F.GW, F.GH]);
  const q = mk('quick'), mg = mk('mega');
  mg.update(STEP);
  const megaW = F.GW, megaBoxes = G.World.goalBoxes.length;
  q.update(STEP);
  check('MEGA GOAL: the goal runs post to post across the whole pitch', megaW === F.W - F.POST && megaBoxes === 22, megaW);
  check('two rooms at once: each match step sets its own goal (like Moon Ball\'s gravity)', F.GW === 5.5 && G.World.goalBoxes.length === 22, F.GW);

  // ---- MEGA GOAL ----
  let m = mk('mega'); toPlay(m);
  const wide = kickIn(m, 25, 0.5, 1);
  check('MEGA GOAL: a ball over the line 25 blocks from the middle is a goal', wide === 'goal' && m.score[0] === 1, { phase: wide, score: m.score });
  m = mk('quick'); toPlay(m);
  const out = kickIn(m, 25, 0.5, 1);
  check('a normal match: the same ball is out, not a goal', out === 'out' && m.score[0] === 0, { phase: out, score: m.score });
  m = mk('mega'); toPlay(m);
  m.ball.lastTeam = 0; m.ball.lastTouch = m.teams[0][1];
  const bar = kickIn(m, 10, 5.2, 1);
  check('MEGA GOAL: over the bar is always a goal kick (no corners)', bar === 'out' && m.restart && m.restart.type === 'GOAL KICK' && m.restart.team === 1, m.restart);
  let megaGoals = 0, megaErr = null;
  try { m = mk('mega', { length: 240 }); while (!m.result) m.update(STEP); megaGoals = m.score[0] + m.score[1]; } catch (e) { megaErr = e.stack.split('\n').slice(0, 3).join(' | '); }
  check('MEGA GOAL: bots play a whole match with no error and score plenty', !megaErr && megaGoals >= 3, { err: megaErr, score: m.score });

  // ---- BLOCK HEIST ----
  m = mk('heist'); toPlay(m);
  check('BLOCK HEIST: both vaults start the same (Rare, Rare, Epic, Legendary, Mythic) and the score is what they are worth', JSON.stringify(m.heist.v) === '[[0,0,1,2,3],[0,0,1,2,3]]' && m.score.join() === '15,15', { v: m.heist.v, s: m.score });
  m.onGoal(1); // team 0 scores
  check('a goal steals their best block (the Mythic): 22 to 8', m.heist.v[0].filter((r) => r === 3).length === 2 && !m.heist.v[1].includes(3) && m.score.join() === '22,8', { v: m.heist.v, s: m.score });
  for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP);
  m.onGoal(-1); // team 1 scores: steals the Mythic back
  check('and the other team can steal it back', m.score.join() === '15,15', m.score);
  for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP);
  m.clock = m.len / 2 + 0.01; m.update(STEP); m.update(STEP);
  check('half way through, the GENERATIONAL block drops', m.heist.jack === 1, m.heist.jack);
  m.onGoal(-1);
  check('the next goal takes it too (+12 and their best block)', m.heist.jack === 2 && m.heist.v[1].includes(4) && m.score.join() === '8,34', { v: m.heist.v, s: m.score });
  // clean them out: the match ends
  m = mk('heist'); toPlay(m);
  for (let k = 0; k < 5; k++) { m.onGoal(1); for (let i = 0; i < 400 && m.phase === 'goal'; i++) m.update(STEP); if (m.result) break; if (k < 4) toPlay(m); }
  check('steal every block and the match is over (CLEANED OUT)', !!m.result && m.heist.cleaned === 1 && m.score.join() === '30,0', { res: m.result && m.result.res, s: m.score, cleaned: m.heist.cleaned });
  let hErr = null;
  try { m = mk('heist', { length: 240 }); while (!m.result) m.update(STEP); } catch (e) { hErr = e.stack.split('\n').slice(0, 3).join(' | '); }
  const worth = (v) => v.reduce((a, r) => a + [1, 2, 4, 7, 12][r], 0);
  check('BLOCK HEIST: bots play a whole match with no error, and the score is always the vaults\' value', !hErr && !!m.result && m.score[0] === worth(m.heist.v[0]) && m.score[1] === worth(m.heist.v[1]), { err: hErr, s: m.score, v: m.heist && m.heist.v });

  // ---- online: a real server, two pretend players, one BLOCK HEIST match ----
  {
    const { spawn } = require('child_process'), path = require('path'), WebSocket = require('ws');
    const PORT = 18799, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '20', GOLDEN_SECONDS: '2' }) });
    let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
    for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
    const client = () => { const ws = new WebSocket('ws://localhost:' + PORT + '/ws'), c = { ws, last: {}, vts: [] }; ws.on('message', (raw) => { const m = JSON.parse(raw); c.last[m.t] = m; if (m.t === 'snap' && m.vt) c.vts.push(JSON.stringify(m.vt)); }); c.send = (m) => ws.send(JSON.stringify(m)); c.open = new Promise((r) => ws.on('open', r)); return c; };
    const a = client(), b = client(); await a.open; await b.open;
    a.send({ t: 'hello', name: 'ali', style: 'ROOKIE' }); b.send({ t: 'hello', name: 'ben', style: 'ROOKIE' });
    a.send({ t: 'create' }); await sleep(200);
    b.send({ t: 'join', code: a.last.room.code }); await sleep(200);
    a.send({ t: 'settings', mode: 'heist' }); await sleep(100);
    a.send({ t: 'settings', mode: 'mega' }); await sleep(100);
    const megaOk = a.last.room.mode === 'mega';
    a.send({ t: 'settings', mode: 'heist' }); await sleep(100);
    a.send({ t: 'start' }); await sleep(1500);
    check('online: the host can pick MEGA GOAL and BLOCK HEIST', megaOk && a.last.room.mode === 'heist', a.last.room.mode);
    check('online BLOCK HEIST: both players get the vaults in the snapshots', b.vts.length > 5 && b.vts[0] === '[[0,0,1,2,3],[0,0,1,2,3],0]', b.vts.slice(0, 1));
    check('online: no server errors', !/Error|TypeError|ReferenceError/.test(out), out.split(/\n/).filter((l) => /Error/.test(l)).slice(0, 3));
    a.ws.close(); b.ws.close(); srv.kill();
  }

  // ---- on screen ----
  const { browser, page, logs } = await open({ wait: 1500 });
  const scr = await page.evaluate(async () => {
    const G = EGO.Game, W = EGO.World;
    const out = { lobbyKey: W.goalKey };
    G.startMatch('heist'); G.manual = true; G.stepManual(200, false);
    const m = G.match;
    out.bar = !document.getElementById('vaultbar').hidden;
    out.sq = [document.querySelectorAll('#vault0 i').length, document.querySelectorAll('#vault1 i').length];
    out.blocks = m.vaultView.blocks.length;
    m.ball.owner = null; m.ball.lastKicker = m.human; m.ball.lastTouch = m.human; m.onGoal(m.human.team === 0 ? 1 : -1);
    G.stepManual(30, true);
    out.steal = document.getElementById('steal').hidden ? '' : document.getElementById('steal-big').textContent + ' / ' + document.getElementById('steal-small').textContent;
    out.flying = m.vaultView.blocks.some((b) => b.t < 1);
    out.sq2 = [document.querySelectorAll('#vault0 i').length, document.querySelectorAll('#vault1 i').length];
    return out;
  });
  check('BLOCK HEIST on screen: the vault bar shows 5 blocks a side, and 10 blocks stand on the crossbars', scr.bar && scr.sq.join() === '5,5' && scr.blocks === 10, scr);
  check('a goal: STOLEN pops up and the block flies across to the other goal', /MYTHIC BLOCK STOLEN/.test(scr.steal) && /YOUR TEAM/.test(scr.steal) && scr.flying && scr.sq2.join() !== '5,5', scr);
  await page.evaluate(() => EGO.Game.stepManual(40, true));
  await page.screenshot({ path: __dirname + '/shots/heist_goal.png' });
  const mega = await page.evaluate(() => {
    const G = EGO.Game, W = EGO.World;
    G.match.dispose(); G.match = null; G.toLobby();
    const back = W.goalKey;
    G.startMatch('mega'); G.manual = true; G.stepManual(200, false);
    const inMatch = W.goalKey, nets = W.nets.length, netW = W.nets[0].back.geometry.parameters.width;
    G.match.dispose(); G.match = null; G.toLobby();
    return { back, inMatch, nets, netW, after: W.goalKey };
  });
  check('MEGA GOAL on screen: the frames and nets are built across the pitch, and normal again after', mega.back === '5.5x3.5' && mega.inMatch === '34.5x3.5' && mega.netW === 69 && mega.after === '5.5x3.5', mega);
  await page.evaluate(() => { const G = EGO.Game; G.startMatch('mega'); G.manual = true; G.stepManual(240, false); });
  await page.screenshot({ path: __dirname + '/shots/mega_goal.png' });
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
