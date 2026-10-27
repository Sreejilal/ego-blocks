const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open({ wait: 1200, viewport: { width: 800, height: 450 } });
  for (const mode of ['ranked', 'lawless']) {
    const r = await page.evaluate((mode) => {
      const G = EGO.Game; G.manual = true;
      G.startMatch(mode);
      const m = G.match; m.autopilot = true;
      let frames = 0;
      try {
        while (G.state === 'match' && frames < 60 * 420) { G.stepManual(30, false); frames += 30; }
      } catch (e) { return { error: e.message, stack: e.stack.split('\n').slice(0, 5).join(' | ') }; }
      return { state: G.state, score: m.score, phase: m.phase, human: m.human.stats, simMin: (frames / 3600).toFixed(1), em: EGO.Save.data.emeralds, rp: EGO.Save.data.rp, golden: m.golden };
    }, mode);
    console.log(mode, JSON.stringify(r));
  }
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})();
