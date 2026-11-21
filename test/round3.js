// The owner's next list (Nov 2026): nets always solid and classic white; a brighter NIGHT and a less bright day; lightning in
// the rain (a random spot every couple of minutes, anyone near is knocked flat); KEEPER PRACTICE (you in goal for their free
// kicks); BALL skins; a 45 second golden goal that flashes and ticks at the end, then a free kick battle (no draws).
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000, viewport: { width: 960, height: 540 } });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  const look = await page.evaluate(() => {
    const W = EGO.World, G = EGO.Game; G.startMatch('quick'); G.stepManual(60);
    const net = W.nets.map((n) => +n.mat.opacity.toFixed(2)), kind = W.netKind;
    const day = W.renderer.toneMappingExposure; W.setLook('night'); const night = W.renderer.toneMappingExposure, sun = W.sun.intensity; W.setLook('day');
    return { net, kind, day, night, sun };
  });
  check('nets are solid and the classic white one', look.net.every((o) => o === 1) && look.kind === 'classic', look);
  check('the day is less bright, the night much brighter than before', look.day < 0.9 && look.night > 1.4 && look.sun > 2, look);
  const bolt = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, W = EGO.World; W.setWeather('rain'); m.phase = 'play';
    const p = m.teams[1].find((q) => !q.isGK); p.setState('free'); p.pos.set(5, 0, 5);
    m.thunderT = 0; m.weatherTick(1 / 60); const near = m.players.filter((q) => q.state === 'down').map((q) => q.name);
    W.setWeather('clear'); m.thunderT = 0; m.weatherTick(1 / 60);
    const struck = []; const real = m.lightning.bind(m); m.lightning = (x, z) => { struck.push([x, z]); }; W.setWeather('rain'); for (let i = 0; i < 4; i++) { m.thunderT = 0; m.weatherTick(1 / 60); } m.lightning = real; W.setWeather('clear');
    // a strike right on a player
    p.setState('free'); m.lightning(p.pos.x + 0.5, p.pos.z);
    return { down: p.state === 'down', spots: struck.length, next: Math.round(m.thunderT) };
  });
  check('lightning in the rain: it strikes a spot, a player there is knocked flat, the next one comes a couple of minutes later', bolt.down && bolt.spots === 4 && bolt.next >= 70, bolt);
  const kp = await page.evaluate(() => {
    const G = EGO.Game; G.toLobby(); G.startMatch('fkkeeper'); const m = G.match, h = m.human;
    const start = { gk: h.isGK, kick: m.fk && m.fk.keeper, shooter: m.fk.shooter && m.fk.shooter.team, wall: m.fkWall.map((p) => p.team) };
    for (let i = 0; i < 60 * 120 && G.state === 'match'; i++) G.stepManual(1);
    return Object.assign(start, { state: G.state, title: document.getElementById('r-title').textContent, chip: document.getElementById('r-score').textContent });
  });
  check('KEEPER PRACTICE: you are in goal, their player takes the kicks, your two make the wall, and the results count what you kept out', kp.gk && kp.kick && kp.shooter === 1 && kp.wall.every((t) => t === 0) && kp.state === 'results' && /KEPT OUT/.test(kp.title) && /KEEPER PRACTICE/.test(kp.chip), kp);
  const ball = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; G.toLobby(); d.skins.push('GOLD_BALL'); d.look.ball = 'GOLD_BALL'; G.startMatch('quick');
    const c = G.match.ball.mesh.geometry.attributes.color, cols = []; for (let i = 0; i < c.count; i += 37) cols.push([c.getX(i), c.getY(i), c.getZ(i)]);
    const golden = cols.filter((v) => v[0] > 0.4 && v[2] < v[0] * 0.5).length;
    d.look.ball = 'CLASSIC_BALL'; G.toLobby(); EGO.UI.openLocker(); document.getElementById('ltab-skin').click(); const tab = [...document.querySelectorAll('#lk-slots [data-slot]')].some((b) => b.dataset.slot === 'ball');
    return { golden, of: cols.length, tab };
  });
  check('BALL skins: a golden ball in your match, and a BALL tab in the Locker', ball.golden > ball.of * 0.3 && ball.tab, ball);
  const gold = await page.evaluate(() => {
    const G = EGO.Game; G.toLobby(); G.startMatch('quick'); const m = G.match; m.phase = 'play'; m.clock = 0.05; m.score = [1, 1];
    G.stepManual(10); const golden = m.golden, len = Math.round(m.goldenClock + 10 / 60);
    m.goldenClock = 9.5; G.stepManual(3); const stress = document.getElementById('clock').classList.contains('stress');
    m.goldenClock = 0.05; G.stepManual(5);
    return { golden, len, stress, battle: !!(m.fk && m.fk.battle), res: m.result && m.result.res };
  });
  check('golden goal is 45 seconds, the clock flashes red at the end, and still level means a free kick battle (no draw)', gold.golden && gold.len === 45 && gold.stress && gold.battle && gold.res !== 'draw', gold);
  await page.evaluate(() => { const W = EGO.World; EGO.Game.toLobby(); W.setLook('night'); EGO.Game.startMatch('quick'); EGO.Game.stepManual(200, true); });
  await shot('round3_night');
  await page.evaluate(() => { EGO.World.setLook('day'); EGO.Game.stepManual(2, true); });
  await shot('round3_day');
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
