// Bigger goals, MEGA GOAL (the goal is as wide as the pitch), OMEGA CORES (a goal takes the other team's best core; take
// them all and the OMEGA CRUSH shatters the other team) and the ending after every match (Cine),
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

  // ---- OMEGA CORES ----
  m = mk('heist'); toPlay(m);
  check('OMEGA CORES: both teams start with the same 4 cores (Rare, Epic, Legendary, Mythic) and the score is what they are worth', JSON.stringify(m.heist.v) === '[[0,1,2,3],[0,1,2,3]]' && m.score.join() === '14,14', { v: m.heist.v, s: m.score });
  let sc = m.teams[0].find((p) => !p.isGK); m.ball.lastKicker = sc; m.ball.lastTouch = sc;
  m.onGoal(1); // team 0 scores
  check('a goal takes their best core (the Mythic): 21 to 7, and the scorer does the core grab', m.heist.v[0].filter((r) => r === 3).length === 2 && !m.heist.v[1].includes(3) && m.score.join() === '21,7' && sc.state === 'emote' && sc.emote === 'claim', { v: m.heist.v, s: m.score, pose: sc.state + ':' + sc.emote });
  for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP);
  m.onGoal(-1); // team 1 scores: takes the Mythic back
  check('and the other team can take it back', m.score.join() === '14,14', m.score);
  for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP);
  m.clock = m.len / 2 + 0.01; m.update(STEP); m.update(STEP);
  check('half way through, the GENERATIONAL core drops', m.heist.jack === 1, m.heist.jack);
  m.onGoal(-1);
  check('the next goal takes it too (+12 and their best core)', m.heist.jack === 2 && m.heist.v[1].includes(4) && m.score.join() === '7,33', { v: m.heist.v, s: m.score });
  // take every core: the match ends with the OMEGA CRUSH
  m = mk('heist'); toPlay(m);
  sc = m.teams[0].find((p) => !p.isGK);
  for (let k = 0; k < 4; k++) { m.ball.lastKicker = sc; m.ball.lastTouch = sc; m.onGoal(1); for (let i = 0; i < 400 && m.phase === 'goal'; i++) m.update(STEP); if (m.result) break; if (k < 3) toPlay(m); }
  const hero = m.players.find((p) => p.state === 'emote' && p.emote === 'crush');
  check('take every core (4 up) and the match is over: the last scorer does the OMEGA CRUSH, the others drop to their knees', !!m.result && m.heist.cleaned === 1 && m.score.join() === '28,0' && hero === sc && m.teams[1].every((p) => p.state === 'emote' && p.emote === 'sad') && m.outroLen() > 8, { res: m.result && m.result.res, s: m.score, cleaned: m.heist.cleaned, hero: hero && hero.role, len: m.outroLen() });
  let hErr = null;
  try { m = mk('heist', { length: 240 }); while (!m.result) m.update(STEP); } catch (e) { hErr = e.stack.split('\n').slice(0, 3).join(' | '); }
  const worth = (v) => v.reduce((a, r) => a + [1, 2, 4, 7, 12][r], 0);
  check('OMEGA CORES: bots play a whole match with no error, and the score is always what the cores are worth', !hErr && !!m.result && m.score[0] === worth(m.heist.v[0]) && m.score[1] === worth(m.heist.v[1]), { err: hErr, s: m.score, v: m.heist && m.heist.v });
  // every match: the losers drop to their knees at full time, and the ending lasts longer than the old 3.2 s
  m = mk('quick'); toPlay(m); m.score[0] = 2; m.score[1] = 1; m.clock = 0.01;
  for (let i = 0; i < 10 && !m.result; i++) m.update(STEP);
  check('full time in any match: winners celebrate, losers on their knees, then the ending (6 s)', !!m.result && m.teams[0].every((p) => p.state === 'celebrate') && m.teams[1].every((p) => p.state === 'emote' && p.emote === 'sad') && m.outroLen() > 6, { len: m.outroLen(), lose: m.teams[1].map((p) => p.state + ':' + p.emote) });

  // ---- online: a real server, two pretend players, one OMEGA CORES match ----
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
    check('online: the host can pick MEGA GOAL and OMEGA CORES', megaOk && a.last.room.mode === 'heist', a.last.room.mode);
    check('online OMEGA CORES: both players get the cores in the snapshots', b.vts.length > 5 && b.vts[0] === '[[0,1,2,3],[0,1,2,3],0]', b.vts.slice(0, 1));
    check('online: no server errors', !/Error|TypeError|ReferenceError/.test(out), out.split(/\n/).filter((l) => /Error/.test(l)).slice(0, 3));
    a.ws.close(); b.ws.close(); srv.kill();
  }

  // ---- on screen ----
  const { browser, page, logs } = await open({ wait: 1500 });
  const scr = await page.evaluate(async () => {
    const G = EGO.Game, W = EGO.World;
    G.outroTest = true; // test robots skip the ending unless asked
    const out = { lobbyKey: W.goalKey };
    G.startMatch('heist'); G.manual = true; G.stepManual(200, false);
    const m = G.match, h = m.human;
    out.bar = !document.getElementById('vaultbar').hidden;
    out.sq = [document.querySelectorAll('#vault0 i').length, document.querySelectorAll('#vault1 i').length];
    out.blocks = m.vaultView.blocks.length;
    out.bands = m.players.every((p) => !!p.P.armL.userData.band);
    m.ball.owner = null; m.ball.lastKicker = h; m.ball.lastTouch = h; m.onGoal(h.team === 0 ? 1 : -1);
    G.stepManual(3, false);
    out.claim = !!(m.vaultView.claim && m.vaultView.claim.p === h); out.pose = h.state + ':' + h.emote; out.cine = document.body.classList.contains('cine');
    out.camD = +Math.hypot(W.camera.position.x - h.pos.x, W.camera.position.z - h.pos.z).toFixed(1);
    for (let i = 0; i < 600 && !(m.vaultView.claim && m.vaultView.claim.locked); i++) G.stepManual(1, false);
    G.stepManual(3, false);
    const core = m.vaultView.blocks.find((b) => b.claim);
    h.P.root.updateMatrixWorld(true); const band = h.P.armL.localToWorld(m.ball.pos.clone().set(0.16, -0.5, 0));
    out.onBand = core ? +core.mesh.position.distanceTo(band).toFixed(2) : -1;
    out.steal = document.getElementById('steal').hidden ? '' : document.getElementById('steal-big').textContent + ' / ' + document.getElementById('steal-small').textContent;
    out.face = !!document.querySelector('#steal-face canvas');
    G.stepManual(1, true);
    return out;
  });
  check('OMEGA CORES on screen: 4 cores a side on the bar and on the crossbars, and everyone wears a band', scr.bar && scr.sq.join() === '4,4' && scr.blocks === 8 && scr.bands, scr);
  check('a goal: you do the core grab and the camera cuts to a close-up', scr.claim && scr.pose === 'emote:claim' && scr.cine && scr.camD < 4, scr);
  check('the core locks into the band on your arm, with the MYTHIC CORE cut-in and your face', scr.onBand >= 0 && scr.onBand < 0.05 && /MYTHIC CORE/.test(scr.steal) && /LOCKED IN/.test(scr.steal) && /YOUR TEAM/.test(scr.steal) && scr.face, scr);
  await page.screenshot({ path: __dirname + '/shots/heist_claim.png' });
  // take every core: the OMEGA CRUSH
  const c1 = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human, s = h.team === 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) { for (let i = 0; i < 900 && m.phase === 'goal'; i++) G.stepManual(1, false); m.phase = 'play'; m.ball.owner = null; m.ball.lastKicker = h; m.ball.lastTouch = h; m.onGoal(s); }
    for (let i = 0; i < 900 && m.phase !== 'end'; i++) G.stepManual(1, false);
    const out = { phase: m.phase, cleaned: m.heist.cleaned, mine: h.team };
    for (let i = 0; i < 900 && m.phaseT < 1.25; i++) G.stepManual(1, false);
    out.pose = h.state + ':' + h.emote;
    h.P.root.updateMatrixWorld(true); const fist = h.P.armR.localToWorld(m.ball.pos.clone().set(0, -0.8, 0));
    const cores = m.vaultView.blocks.filter((b) => b.team === h.team);
    out.cores = cores.length; out.near = cores.filter((b) => b.mesh.position.distanceTo(fist) < 1.5).length;
    G.stepManual(1, true);
    return out;
  });
  check('take every core: you do the OMEGA CRUSH with all 8 cores circling your fist', c1.phase === 'end' && c1.cleaned === 1 - c1.mine && c1.pose === 'emote:crush' && c1.cores === 8 && c1.near >= 7, c1);
  await page.screenshot({ path: __dirname + '/shots/crush_fist.png' });
  const c2 = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human;
    for (let i = 0; i < 900 && m.phaseT < 2.4; i++) G.stepManual(1, false);
    G.stepManual(1, true);
    return { half: m.teams[1 - h.team].filter((p) => !p.P.root.visible).length };
  });
  await page.screenshot({ path: __dirname + '/shots/crush_shatter.png' });
  const c3 = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human;
    for (let i = 0; i < 900 && m.phaseT < 3.8; i++) G.stepManual(1, false);
    G.stepManual(1, true);
    return { gone: m.teams[1 - h.team].every((p) => !p.P.root.visible), big: document.getElementById('outro').hidden ? '' : document.getElementById('ot-big').textContent + ' / ' + document.getElementById('ot-sub').textContent, state: G.state };
  });
  check('then the other team shatters into blocks and is gone: SHATTERED!', c2.half >= 1 && c3.gone && /SHATTERED!/.test(c3.big) && /YOU TOOK EVERY CORE/.test(c3.big) && c3.state === 'match', { c2, c3 });
  await page.screenshot({ path: __dirname + '/shots/crush_end.png' });
  // every match has an ending; SHOOT, PASS or JUMP skips it
  const end = await page.evaluate(() => {
    const G = EGO.Game; G.match.dispose(); G.match = null; G.toLobby();
    G.startMatch('quick'); G.manual = true; G.stepManual(200, false);
    const m = G.match, h = m.human;
    m.phase = 'play'; m.score[h.team] = 2; m.score[1 - h.team] = 1; m.clock = 0.02;
    for (let i = 0; i < 300 && m.phase !== 'end'; i++) G.stepManual(1, false);
    for (let i = 0; i < 300 && m.phaseT < 1.7; i++) G.stepManual(1, false);
    G.stepManual(1, true);
    return { phase: m.phase, len: m.outroLen(), big: document.getElementById('outro').hidden ? '' : document.getElementById('ot-big').textContent + ' / ' + document.getElementById('ot-star').textContent, sad: m.teams[1 - h.team].every((p) => p.state === 'emote' && p.emote === 'sad'), cine: document.body.classList.contains('cine'), hero: !!(EGO.Cine.st && EGO.Cine.st.hero === h), state: G.state };
  });
  check('every match ends with an ending: VICTORY!, the losers on their knees, the camera round the star player (you)', end.phase === 'end' && end.len > 6 && /VICTORY!/.test(end.big) && /STAR/.test(end.big) && end.sad && end.cine && end.hero && end.state === 'match', end);
  await page.screenshot({ path: __dirname + '/shots/ending.png' });
  const skip = await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })); EGO.Game.stepManual(2, false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })); EGO.Game.stepManual(1, false);
    return { state: EGO.Game.state, cine: document.body.classList.contains('cine'), outro: !document.getElementById('outro').hidden };
  });
  check('JUMP (or SHOOT, PASS) skips the ending to the results', skip.state !== 'match' && !skip.cine && !skip.outro, skip);
  const mega = await page.evaluate(() => {
    const G = EGO.Game, W = EGO.World;
    if (G.match) { G.match.dispose(); G.match = null; } G.toLobby();
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
