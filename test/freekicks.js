// Free kick practice: FREE KICKS on the start screen. You against a keeper and a wall of two, 10 kicks from random
// spots. The camera turns to the goal each kick, you stand still behind the ball, only shots work, and the end screen
// shows your score and best (saved, no rewards). Works on a phone too.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts) => {
    const p = await (await browser.newContext(opts)).newPage(); p.setDefaultTimeout(120000);
    p.on('pageerror', (e) => logs.push(e.message));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(URL, { timeout: 120000 }); await p.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 }); return p;
  };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  await A.evaluate(() => { const s = EGO.Save.data.settings; s.cam = 'third'; s.camPicked = true; s.cutins = false; EGO.Save.data.style = 'ROOKIE'; EGO.Save.data.spunStyle = null; });
  await A.click('#go-fk');
  const setup = await A.evaluate(() => {
    const m = EGO.Game.match; EGO.Game.stepManual(40, true);
    const h = m.human, gk = m.teams[1].find((p) => p.isGK), wall = m.teams[1].filter((p) => !p.isGK);
    const gz = m.oppGoalZ(0), want = Math.atan2(-m.fk.x, gz - m.fk.z);
    return { mode: m.mode, players: m.players.length, wall: wall.length, owner: m.ball.owner === h, hold: !!h.fkHold, ballOnSpot: Math.hypot(m.ball.pos.x - m.fk.x, m.ball.pos.z - m.fk.z) < 0.35,
      camOK: Math.abs(Math.atan2(Math.sin(EGO.Cam.yaw - want), Math.cos(EGO.Cam.yaw - want))) < 0.1, clock: document.getElementById('clock') ? document.getElementById('clock').textContent : null, mode2: document.getElementById('hud-mode').textContent };
  });
  check('FREE KICKS starts you, a keeper and a wall of two, ball on the spot, camera on the goal', setup.mode === 'freekick' && setup.players === 4 && setup.wall === 2 && setup.owner && setup.hold && setup.ballOnSpot && setup.camOK, setup);
  check('the HUD shows the kick number', /1\/10/.test(JSON.stringify(setup)) && setup.mode2 === 'FREE KICKS', setup);
  await A.screenshot({ path: __dirname + '/shots/fk1_lineup.png', timeout: 120000 });
  const still = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, x0 = m.ball.pos.x, z0 = m.ball.pos.z;
    EGO.Input.down.add('KeyW'); EGO.Input.down.add('ShiftLeft'); EGO.Game.stepManual(30, false); EGO.Input.down.delete('KeyW'); EGO.Input.down.delete('ShiftLeft');
    EGO.Input.edges.add('KeyF'); EGO.Game.stepManual(2, false);
    return { moved: Math.hypot(m.ball.pos.x - x0, m.ball.pos.z - z0), owner: m.ball.owner === h, state: h.state };
  });
  check('you cannot walk off with it or slide on a free kick', still.moved < 0.3 && still.owner && still.state === 'free', still);
  const ab = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, i = h.abil.findIndex((a) => !EGO.FK_SHOTS.includes(a.id)), j = h.abil.findIndex((a) => EGO.FK_SHOTS.includes(a.id));
    EGO.Input.edges.add(['KeyQ', 'KeyE', 'KeyR'][i]); EGO.Game.stepManual(2, true);
    return { blockedName: h.abil[i].def.name, toast: document.getElementById('toasts').textContent, owner: m.ball.owner === h, shotAbility: j >= 0 ? h.abil[j].def.name : null };
  });
  check('a non-shot ability says ONLY SHOTS ON A FREE KICK', /ONLY SHOTS ON A FREE KICK/.test(ab.toast) && ab.owner, ab);
  // shoot with the mouse: hold, then let go
  const shot = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human;
    EGO.Input.edges.add('Mouse0'); EGO.Input.mouseL = true; EGO.Game.stepManual(30, false); EGO.Input.mouseL = false; EGO.Input.up.add('Mouse0'); EGO.Game.stepManual(2, false);
    const fl = m.fk.state; EGO.Game.stepManual(400, false);
    return { flight: fl, n: m.fk.n, log: m.fk.log.slice() };
  });
  check('hold and release shoot takes the kick, then the next one is set up', shot.flight === 'flight' && shot.log.length === 1 && shot.n === 2, shot);
  // play the rest out quickly and finish
  const end = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human;
    EGO.Save.data.fkBest = 0;
    for (let i = 0; i < 9000 && EGO.Game.state === 'match'; i++) {
      if (m.fk && m.fk.state === 'aim' && m.ball.owner === h && m.fk.t > 0.5) { const gz = m.oppGoalZ(0); const near = Math.abs(m.fk.x) > 1 ? Math.sign(m.fk.x) : (m.fkWall[0].pos.x > m.fk.x ? 1 : -1); m.shootAt(h, m.aim.clone().set(-near * 3.8, 2.3, gz), 0.95, { curveIn: 0 }); }
      EGO.Game.stepManual(10, false);
    }
    return { state: EGO.Game.state, title: document.getElementById('r-title').textContent, score: document.getElementById('r-score').textContent, stats: document.getElementById('r-stats').textContent, earn: document.getElementById('r-earn').textContent, best: EGO.Save.data.fkBest, again: document.getElementById('r-again').textContent, em: EGO.Save.data.emeralds };
  });
  check('after 10 kicks: your score, NEW BEST, what happened, no rewards', end.state === 'results' && /^\d+ \/ 10$/.test(end.title) && /NEW BEST|BEST/.test(end.score) && /GOALS/.test(end.stats) && /NO REWARDS/.test(end.earn) && end.best === +end.title.split(' ')[0], end);
  await A.screenshot({ path: __dirname + '/shots/fk2_results.png', timeout: 120000 });
  const again = await A.evaluate(() => { document.getElementById('r-again').click(); return { mode: EGO.Game.match.mode, n: EGO.Game.match.fk.n }; });
  check('AGAIN starts a new round', again.mode === 'freekick' && again.n === 1, again);
  const quit = await A.evaluate(() => { EGO.Game.forfeit(); return { state: EGO.Game.state, played: EGO.Save.data.stats.played }; });
  check('quitting goes back to the start screen and does not count as a match', quit.state === 'lobby' && quit.played === 0, quit);
  // phone upright and sideways
  for (const [w, h, tag] of [[844, 390, 'side'], [390, 844, 'up']]) {
    const P = await mk({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await P.evaluate(() => { EGO.Save.data.settings.autoFs = false; });
    await P.tap('#go-fk');
    const btn = await P.evaluate(() => { EGO.Game.stepManual(30, true); const r = document.querySelector('#touch [data-act="shoot"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const cdp = await P.context().newCDPSession(P);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 3 }] });
    await P.evaluate(() => EGO.Game.stepManual(20, false));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const t = await P.evaluate(() => {
      EGO.Game.stepManual(3, false); const m = EGO.Game.match;
      return { mode: m.mode, state: m.fk.state, shoot: !document.querySelector('#touch [data-act="shoot"]').hidden, wide: document.documentElement.scrollWidth <= innerWidth };
    });
    check('phone ' + tag + ': SHOOT takes the free kick, no sideways scroll', t.mode === 'freekick' && t.shoot && t.wide && t.state === 'flight', t);
    await P.screenshot({ path: __dirname + '/shots/fk3_phone_' + tag + '.png', timeout: 120000 });
    await P.context().close();
  }
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
