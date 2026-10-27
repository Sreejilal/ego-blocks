// Quick health check (npm test): loads the game, plays a little, runs two short bot matches,
// and checks saving. Prints PASS/FAIL lines and exits with code 1 if anything failed.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500, viewport: { width: 1280, height: 720 } });
  check('loads to the lobby', await page.evaluate(() => window.EGO && EGO.Game.state === 'lobby'));

  const play = await page.evaluate(() => {
    const G = EGO.Game;
    G.startMatch('quick'); G.manual = true;
    for (let i = 0; i < 5; i++) G.stepManual(60, i === 4);
    const m = G.match;
    return { state: G.state, phase: m.phase, players: m.players.length, clock: +m.clock.toFixed(1) };
  });
  check('a match starts and plays', play.state === 'match' && play.phase !== 'kickoff' && play.players === 10, play);

  const pause = await page.evaluate(() => { const G = EGO.Game; G.pause(); const a = G.state; G.pausedAt = 0; G.resume(); return [a, G.state]; });
  check('pause and resume', pause[0] === 'paused' && pause[1] === 'match', pause);

  for (const mode of ['quick', 'lawless']) {
    const r = await page.evaluate((mode) => { try { return EGO.simulate(mode, 0.5, 60); } catch (e) { return { error: e.message }; } }, mode);
    check('bot match runs to the end: ' + mode, !r.error && r.simSeconds >= 60 && Array.isArray(r.score), r.error ? r : { score: r.score, shots: r.shots, passes: r.passes });
  }

  await page.evaluate(() => { EGO.Save.data.emeralds = 4321; EGO.Save.save(); });
  await page.reload(); await page.waitForTimeout(1200);
  check('progress is saved between visits', await page.evaluate(() => EGO.Save.data.emeralds === 4321));

  await page.evaluate(() => { localStorage.removeItem('scorz.save.v1'); localStorage.setItem('egoblocks.save.v1', JSON.stringify({ emeralds: 777, rp: 130 })); });
  await page.reload(); await page.waitForTimeout(1200);
  const moved = await page.evaluate(() => { const n = JSON.parse(localStorage.getItem('scorz.save.v1') || 'null'); return { em: EGO.Save.data.emeralds, rp: EGO.Save.data.rp, newKey: n && n.emeralds, oldKey: localStorage.getItem('egoblocks.save.v1') }; });
  check('old EGO BLOCKS saves carry over to SCORZ', moved.em === 777 && moved.rp === 130 && moved.newKey === 777 && moved.oldKey === null, moved);

  check('no errors in the console', logs.length === 0, logs.slice(0, 5));
  console.log(results.join('\n'));
  await browser.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
