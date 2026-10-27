const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open({ wait: 1200, viewport: { width: 800, height: 450 } });
  const r = await page.evaluate(() => {
    const G = EGO.Game, out = {};
    // golden goal -> draw
    EGO.Save.data.rp = 100; EGO.Save.data.emeralds = 0;
    G.startMatch('ranked'); G.manual = true; G.stepManual(170, false);
    const m = G.match; m.score = [1, 1]; m.clock = 0.1; G.stepManual(10, false);
    out.golden = { golden: m.golden, phase: m.phase, gclock: +m.goldenClock.toFixed(1) };
    m.goldenClock = 0.1; G.stepManual(10, false); G.stepManual(220, false);
    out.draw = { state: G.state, res: m.result && m.result.res, em: EGO.Save.data.emeralds, rp: EGO.Save.data.rp, title: document.getElementById('r-title').textContent };
    // golden goal decided by a goal
    G.startMatch('quick'); G.manual = true; G.stepManual(170, false);
    const m2 = G.match; m2.score = [0, 0]; m2.clock = 0.1; G.stepManual(10, false);
    const h = m2.human; m2.teams[1][0].pos.x = 25; h.pos.set(0, 0, 22); m2.ball.reset(0, 22.6); m2.possess(h, true); m2.shootAt(h, new THREE.Vector3(2, 1, 32.5), 1);
    G.stepManual(700, false);
    out.goldenWin = { state: G.state, res: m2.result && m2.result.res, score: m2.score.slice(), title: document.getElementById('r-title').textContent };
    // forfeit
    G.startMatch('ranked'); G.manual = true; G.stepManual(100, false);
    const rpB = EGO.Save.data.rp, emB = EGO.Save.data.emeralds;
    G.pause(); G.forfeit();
    out.forfeit = { state: G.state, rpBefore: rpB, rpAfter: EGO.Save.data.rp, emDelta: EGO.Save.data.emeralds - emB, title: document.getElementById('r-title').textContent };
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})();
