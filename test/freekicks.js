// Free kicks: FREE KICKS on the start screen. You against a keeper, a wall (2 to 4) and defenders in the box, 10
// kicks. Aim with the camera (a target shows on the goal), A/D sets the curve, RMB changes the kick type (CURVE,
// POWER, DIP), hold shoot for power (a green zone on the bar). Dots show the start of the path. Abilities are off.
// The end screen shows your score and best (saved, no rewards). Works on a phone too.
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
    const h = m.human, gz = m.oppGoalZ(0), want = Math.atan2(-m.fk.x, gz - m.fk.z);
    const inWall = m.fkWall.filter((w) => Math.hypot(w.pos.x - m.fk.x, w.pos.z - m.fk.z) < 8).length;
    return { mode: m.mode, players: m.players.length, inWall, dist: Math.round(m.fk.dist * 10) / 10, owner: m.ball.owner === h, hold: !!h.fkHold, ballOnSpot: Math.hypot(m.ball.pos.x - m.fk.x, m.ball.pos.z - m.fk.z) < 0.35,
      camOK: Math.abs(Math.atan2(Math.sin(EGO.Cam.yaw - want), Math.cos(EGO.Cam.yaw - want))) < 0.1, clock: document.getElementById('clock').textContent, mode2: document.getElementById('hud-mode').textContent };
  });
  check('FREE KICKS: you, a keeper, a wall and defenders; ball on the spot; camera on the goal', setup.mode === 'freekick' && setup.players === 6 && setup.inWall >= 2 && setup.inWall <= 4 && setup.owner && setup.hold && setup.ballOnSpot && setup.camOK && setup.clock === '1/10', setup);
  check('a bigger wall closer in', setup.inWall === (setup.dist < 19 ? 4 : setup.dist < 23 ? 3 : 2), setup);
  const aids = await A.evaluate(() => {
    const m = EGO.Game.match; EGO.Game.stepManual(2, true);
    return { panel: !document.getElementById('fkpanel').hidden, dock: getComputedStyle(document.getElementById('hotbar')).display, type: document.getElementById('fk-type').textContent, target: EGO.FKHud.target.visible, dots: EGO.FKHud.dots.filter((d) => d.visible).length,
      onGoal: Math.abs(Math.abs(EGO.FKHud.target.position.z) - Math.abs(m.oppGoalZ(0))) < 0.5 };
  });
  check('the free kick panel replaces the hotbar; a target on the goal; dots for the path', aids.panel && aids.dock === 'none' && aids.type === 'CURVE' && aids.target && aids.onGoal && aids.dots >= 4, aids);
  await A.screenshot({ path: __dirname + '/shots/fk1_lineup.png', timeout: 120000 });
  const ctl = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, x0 = m.ball.pos.x, z0 = m.ball.pos.z, dots0 = EGO.FKHud.dots.map((d) => d.position.x + ',' + d.position.z).join(';');
    EGO.Input.down.add('KeyD'); EGO.Game.stepManual(25, true); EGO.Input.down.delete('KeyD');
    const curve = h.fkShot.curve, mark = document.getElementById('fk-cmark').style.left, dots1 = EGO.FKHud.dots.map((d) => d.position.x + ',' + d.position.z).join(';');
    EGO.Input.edges.add('Mouse2'); EGO.Game.stepManual(2, true);
    const type = h.fkShot.type, typeText = document.getElementById('fk-type').textContent;
    EGO.Input.down.add('KeyW'); EGO.Input.down.add('ShiftLeft'); EGO.Game.stepManual(30, false); EGO.Input.down.delete('KeyW'); EGO.Input.down.delete('ShiftLeft');
    EGO.Input.edges.add('KeyQ'); EGO.Game.stepManual(2, true);
    return { curve: +curve.toFixed(2), mark, pathMoved: dots0 !== dots1, type, typeText, moved: Math.hypot(m.ball.pos.x - x0, m.ball.pos.z - z0), owner: m.ball.owner === h, toast: document.getElementById('toasts').textContent };
  });
  check('D adds curve (the marker and the dotted path move)', ctl.curve > 0.3 && parseFloat(ctl.mark) > 60 && ctl.pathMoved, ctl);
  check('RMB changes the kick type to POWER', ctl.type === 'power' && ctl.typeText === 'POWER', ctl);
  check('you stay on the ball, abilities are off', ctl.moved < 0.3 && ctl.owner && /ABILITIES ARE OFF/.test(ctl.toast), ctl);
  const pow = await A.evaluate(() => {
    const m = EGO.Game.match;
    EGO.Input.edges.add('Mouse0'); EGO.Input.mouseL = true; EGO.Game.stepManual(36, true);
    const w = parseFloat(document.getElementById('fk-pfill').style.width), zone = parseFloat(document.getElementById('fk-zone').style.left);
    EGO.Input.mouseL = false; EGO.Input.up.add('Mouse0'); EGO.Game.stepManual(2, false);
    const st = m.fk.state, spec = m.ball.kick && m.ball.kick.special;
    EGO.Game.stepManual(2, true); const panel = !document.getElementById('fkpanel').hidden;
    EGO.Game.stepManual(400, false);
    return { w, zone, flight: st, spec, panelAfter: panel, n: m.fk.n, log: m.fk.log.slice() };
  });
  check('holding shoot fills the power bar (with a green zone), letting go takes the kick', pow.w > 20 && pow.zone > 20 && pow.flight === 'flight' && pow.spec === 'knuckle' && !pow.panelAfter && pow.log.length === 1 && pow.n === 2, pow);
  // play the rest: a good curler each time
  const end = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human;
    EGO.Save.data.fkBest = 0;
    for (let i = 0; i < 9000 && EGO.Game.state === 'match'; i++) {
      if (m.fk && m.fk.state === 'aim' && m.ball.owner === h && m.fk.t > 0.5) {
        const gz = m.oppGoalZ(0), near = Math.abs(m.fk.x) > 1 ? Math.sign(m.fk.x) : (m.fkWall[0].pos.x > m.fk.x ? 1 : -1);
        h.fkShot.type = 'curve'; h.fkShot.curve = -0.8 * near;
        const t = m.aim.clone().set(-near * 6.5, 2.0, gz);
        m.freeKickShot(h, EGO.fkIdeal(Math.hypot(t.x - m.ball.pos.x, t.z - m.ball.pos.z)), t);
      }
      EGO.Game.stepManual(10, false);
    }
    return { state: EGO.Game.state, title: document.getElementById('r-title').textContent, score: document.getElementById('r-score').textContent, stats: document.getElementById('r-stats').textContent, earn: document.getElementById('r-earn').textContent, best: EGO.Save.data.fkBest, em: EGO.Save.data.emeralds };
  });
  check('after 10 kicks: your score, best, what happened, no rewards', end.state === 'results' && /^\d+ \/ 10$/.test(end.title) && /BEST/.test(end.score) && /GOALS/.test(end.stats) && /NO REWARDS/.test(end.earn) && end.best === +end.title.split(' ')[0] && end.em === 500, end);
  check('good curlers score most of the time', +end.title.split(' ')[0] >= 4, end.title);
  await A.screenshot({ path: __dirname + '/shots/fk2_results.png', timeout: 120000 });
  const again = await A.evaluate(() => { document.getElementById('r-again').click(); return { mode: EGO.Game.match.mode, n: EGO.Game.match.fk.n }; });
  check('AGAIN starts a new round', again.mode === 'freekick' && again.n === 1, again);
  const quit = await A.evaluate(() => { EGO.Game.forfeit(); return { state: EGO.Game.state, played: EGO.Save.data.stats.played, target: EGO.FKHud.target.visible }; });
  check('quitting goes back to the start screen, does not count as a match, the target goes away', quit.state === 'lobby' && quit.played === 0 && !quit.target, quit);
  const normal = await A.evaluate(() => { EGO.Game.startMatch('quick'); EGO.Game.stepManual(5, true); const r = { fk: document.getElementById('hud').classList.contains('fk'), hotbar: getComputedStyle(document.getElementById('hotbar')).display, panel: !document.getElementById('fkpanel').hidden }; EGO.Game.toLobby(); return r; });
  check('a normal match afterwards has its hotbar back', !normal.fk && normal.hotbar !== 'none' && !normal.panel, normal);
  // phones
  for (const [w, h, tag] of [[844, 390, 'side'], [390, 844, 'up']]) {
    const P = await mk({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await P.evaluate(() => { EGO.Save.data.settings.autoFs = false; });
    await P.tap('#go-fk');
    const lay = await P.evaluate(() => {
      EGO.Game.stepManual(30, true);
      const r = (sel) => { const q = document.querySelector(sel).getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right), t: Math.round(q.top), b: Math.round(q.bottom) }; };
      const pass = document.querySelector('#touch [data-act="pass"]');
      const shown = [...document.querySelectorAll('#touch [data-act]')].filter((e) => getComputedStyle(e).display !== 'none' && !e.hidden && e.offsetParent).map((e) => e.dataset.act);
      const others = ['#minimap', ...shown.filter((a) => a !== 'pass' && a !== 'shoot').map((a) => '#touch [data-act="' + a + '"]'), '#touch [data-act="shoot"]', '#touch [data-act="pass"]'].filter((s2) => document.querySelector(s2) && document.querySelector(s2).offsetParent).map((s2) => [s2, r(s2)]);
      return { panel: r('#fkpanel'), vw: innerWidth, vh: innerHeight, typeLabel: pass.textContent.trim(), wide: document.documentElement.scrollWidth <= innerWidth, shown, others };
    });
    const hits = lay.others.filter(([, q]) => !(lay.panel.r <= q.l || q.r <= lay.panel.l || lay.panel.b <= q.t || q.b <= lay.panel.t)).map(([s2]) => s2);
    check('phone ' + tag + ': the panel fits and covers nothing, the pass button says TYPE', lay.panel.l >= 0 && lay.panel.r <= lay.vw && lay.panel.b <= lay.vh && !hits.length && /TYPE/.test(lay.typeLabel) && lay.wide, { panel: lay.panel, hits, type: lay.typeLabel });
    check('phone ' + tag + ': only the free kick buttons show', !lay.shown.some((a) => /^ab|^dt$|^jump$|^flow$/.test(a)) && lay.shown.includes('shoot') && lay.shown.includes('pass'), lay.shown);
    const btn = await P.evaluate(() => { const r = document.querySelector('#touch [data-act="shoot"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const cdp = await P.context().newCDPSession(P);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 3 }] });
    await P.evaluate(() => EGO.Game.stepManual(20, true));
    await P.screenshot({ path: __dirname + '/shots/fk3_phone_' + tag + '.png', timeout: 120000 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const t = await P.evaluate(() => { EGO.Game.stepManual(3, false); return { state: EGO.Game.match.fk.state }; });
    check('phone ' + tag + ': SHOOT takes the free kick', t.state === 'flight', t);
    await P.context().close();
  }
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
