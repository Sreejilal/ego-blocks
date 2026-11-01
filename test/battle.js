// The free kick battle: an offline match still level after golden goal goes to free kicks, 3 each (you first),
// then sudden death. You take yours with the free kick controls; for theirs you stand in the wall and can jump.
// The battle winner wins the match (rewards as a win or loss); the match score stays level.
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
  // a level match whose golden goal time runs out
  const toBattle = () => {
    const s = EGO.Save.data.settings; s.cam = 'third'; s.camPicked = true; s.cutins = false; s.autoFs = false;
    EGO.Game.startMatch('quick'); for (let i = 0; i < 80 && EGO.Game.match.phase !== 'play'; i++) EGO.Game.stepManual(10, false);
    const m = EGO.Game.match; m.score = [2, 2]; m.clock = 0; m.golden = true; m.goldenClock = 0.05; EGO.Game.stepManual(6, true);
    return { battle: !!(m.fk && m.fk.battle), banner: document.getElementById('banner-big').textContent, clock: document.getElementById('clock').textContent, sub: document.getElementById('clock-sub').textContent };
  };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  const start = await A.evaluate(toBattle);
  check('still level after golden goal: FREE KICK BATTLE', start.battle && /FREE KICK BATTLE/.test(start.banner) && start.clock === '0-0' && start.sub === 'FK BATTLE', start);
  const mine = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human;
    for (let i = 0; i < 60 && !(m.fk.shooter === h && m.fk.state === 'aim'); i++) EGO.Game.stepManual(5, false);
    EGO.Game.stepManual(2, true);
    return { first: m.fk.shooter === h, hold: !!h.fkHold, panel: !document.getElementById('fkpanel').hidden, toast: document.getElementById('toasts').textContent, score: m.score.slice() };
  });
  check('you take the first kick, with the free kick controls', mine.first && mine.hold && mine.panel && /YOUR KICK/.test(mine.toast), mine);
  await A.screenshot({ path: __dirname + '/shots/bt1_yourkick.png', timeout: 120000 });
  const shot = await A.evaluate(() => {
    const m = EGO.Game.match;
    EGO.Input.edges.add('Mouse0'); EGO.Input.mouseL = true; EGO.Game.stepManual(30, false); EGO.Input.mouseL = false; EGO.Input.up.add('Mouse0'); EGO.Game.stepManual(2, false);
    const st = m.fk.state;
    for (let i = 0; i < 80 && !(m.fk.state === 'aim' && m.fk.shooter && m.fk.shooter.team === 1); i++) EGO.Game.stepManual(5, false);
    return { taken: st === 'flight' || st === 'goal' || st === 'done', kicks: m.fk.kicks.slice(), log: m.fk.log.slice(), score: m.score.slice(), theirs: m.fk.shooter.team === 1 };
  });
  check('your kick is taken and counted, the match score stays level', shot.taken && shot.kicks[0] === 1 && shot.log.length === 1 && shot.score[0] === 2 && shot.score[1] === 2 && shot.theirs, shot);
  const wall = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, x0 = h.pos.x, z0 = h.pos.z;
    EGO.Game.stepManual(2, true);
    const inWall = !!h.inWall, toast = document.getElementById('toasts').textContent, nearBall = Math.hypot(h.pos.x - m.fk.x, h.pos.z - m.fk.z);
    EGO.Input.down.add('KeyW'); EGO.Game.stepManual(20, false); EGO.Input.down.delete('KeyW');
    const moved = Math.hypot(h.pos.x - x0, h.pos.z - z0);
    EGO.Input.edges.add('Space'); EGO.Game.stepManual(4, false);
    return { inWall, toast, nearBall: +nearBall.toFixed(1), moved: +moved.toFixed(2), jumped: !h.onGround || h.vel.y > 0 };
  });
  check('their kick: you stand in the wall, cannot walk off, and can jump', wall.inWall && wall.nearBall > 5 && wall.nearBall < 9 && wall.moved < 0.3 && wall.jumped && /YOU ARE IN THE WALL/.test(wall.toast), wall);
  await A.screenshot({ path: __dirname + '/shots/bt2_wall.png', timeout: 120000 });
  // finish it: you shoot well each time
  const end = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, em0 = EGO.Save.data.emeralds;
    for (let i = 0; i < 6000 && EGO.Game.state === 'match'; i++) {
      const k = m.fk;
      if (k && k.state === 'aim' && k.shooter === h && m.ball.owner === h && k.t > 0.5) {
        const gz = m.oppGoalZ(0), near = Math.abs(k.x) > 1 ? Math.sign(k.x) : (k.wallNow[0].pos.x > k.x ? 1 : -1);
        h.fkShot.type = 'curve'; h.fkShot.curve = -0.8 * near;
        const t = m.aim.clone().set(-near * 6.5, 2.0, gz); m.freeKickShot(h, EGO.fkIdeal(Math.hypot(t.x - m.ball.pos.x, t.z - m.ball.pos.z)), t);
      }
      EGO.Game.stepManual(10, false);
    }
    const r = m.result || {};
    return { state: EGO.Game.state, res: r.res, battle: r.battle, score: m.score.slice(), title: document.getElementById('r-title').textContent, chip: document.getElementById('r-score').textContent, earned: EGO.Save.data.emeralds - em0 };
  });
  const won = end.battle && end.battle[0] > end.battle[1];
  check('the battle decides the match: VICTORY or DEFEAT, rewards to match', end.state === 'results' && end.res === (won ? 'win' : 'loss') && end.title === (won ? 'VICTORY' : 'DEFEAT') && end.earned >= (won ? 150 : 50) && end.score[0] === end.score[1], end);
  check('the results show the battle score', /FREE KICK BATTLE \d+-\d+/.test(end.chip), end.chip);
  await A.screenshot({ path: __dirname + '/shots/bt3_results.png', timeout: 120000 });
  // bot-only matches (and the balance sims) still end level as draws
  const sim = await A.evaluate(() => { const m = new EGO.Match('quick', 0.6, { noHuman: true, autopilot: true, size: 3 }); for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(1 / 60); m.score = [1, 1]; m.clock = 0; m.golden = true; m.goldenClock = 0.02; for (let i = 0; i < 5; i++) m.update(1 / 60); const r = { phase: m.phase, res: m.result && m.result.res, fk: !!m.fk }; m.dispose(); return r; });
  check('a match with no human still ends as a draw', sim.phase === 'end' && sim.res === 'draw' && !sim.fk, sim);
  // phone: in the wall only JUMP shows
  const P = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await P.evaluate(toBattle);
  const ph = await P.evaluate(() => {
    const m = EGO.Game.match, h = m.human;
    for (let i = 0; i < 60 && !(m.fk.shooter === h && m.fk.state === 'aim'); i++) EGO.Game.stepManual(5, false);
    m.freeKickShot(h, 0.6, m.aim.clone().set(0, 1.5, m.oppGoalZ(0)));
    for (let i = 0; i < 80 && !(m.fk.state === 'aim' && m.fk.shooter.team === 1); i++) EGO.Game.stepManual(5, false);
    EGO.Game.stepManual(3, true);
    return { inWall: !!h.inWall, shown: [...document.querySelectorAll('#touch [data-act]')].filter((e) => getComputedStyle(e).display !== 'none' && !e.hidden && e.offsetParent).map((e) => e.dataset.act), stick: getComputedStyle(document.getElementById('t-stick')).display };
  });
  check('phone: in the wall only JUMP (and the corner buttons) show', ph.inWall && ph.shown.includes('jump') && !ph.shown.some((a) => /^shoot$|^pass$|^ab|^dt$/.test(a)) && ph.stick === 'none', ph);
  await P.screenshot({ path: __dirname + '/shots/bt4_phone_wall.png', timeout: 120000 });
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
