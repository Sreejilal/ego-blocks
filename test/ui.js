const { open } = require('./harness');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  // pity + odds check (pure logic)
  const odds = await page.evaluate(() => {
    const c = [0, 0, 0, 0, 0]; for (let i = 0; i < 200000; i++) c[EGO.rollRarity(0)]++;
    let worst = 0, pity = 0, sinceLeg = 0;
    for (let i = 0; i < 20000; i++) { const r = EGO.rollRarity(pity); sinceLeg++; if (r >= 2) { worst = Math.max(worst, sinceLeg); sinceLeg = 0; pity = 0; } else pity++; }
    return { pct: c.map((x) => (x / 2000).toFixed(2)), worstGapToLegendary: worst };
  });
  console.log('ODDS', JSON.stringify(odds));
  await page.evaluate(() => { EGO.Save.data.emeralds = 1000; EGO.UI.renderLobby(); });
  await page.click('#go-spins'); await sleep(400);
  await page.screenshot({ path: __dirname + '/shots/u1_spins.png' });
  await page.click('#spin-go'); await sleep(1800);
  await page.screenshot({ path: __dirname + '/shots/u2_spinning.png' });
  await sleep(4200);
  await page.screenshot({ path: __dirname + '/shots/u3_spin_result.png' });
  const after = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, styles: EGO.Save.data.styles, pity: EGO.Save.data.pity, result: document.getElementById('spin-result').textContent }));
  console.log('AFTER SPIN', JSON.stringify(after));
  await page.click('#tab-flow'); await sleep(200);
  await page.click('#spin-go'); await sleep(6200);
  await page.screenshot({ path: __dirname + '/shots/u4_flow_result.png' });
  console.log('AFTER FLOW SPIN', JSON.stringify(await page.evaluate(() => ({ em: EGO.Save.data.emeralds, flows: EGO.Save.data.flows, result: document.getElementById('spin-result').textContent }))));
  await page.click('#spin-back'); await sleep(200);
  await page.click('#go-locker'); await sleep(300);
  await page.screenshot({ path: __dirname + '/shots/u5_locker.png' });
  await page.click('.lcard[data-id="RAILGUN"]'); await sleep(200);
  await page.screenshot({ path: __dirname + '/shots/u6_locker_locked.png' });
  await page.click('#ltab-flow'); await sleep(200);
  await page.screenshot({ path: __dirname + '/shots/u7_locker_flows.png' });
  await page.click('#locker-back'); await sleep(200);
  await page.click('#go-howto'); await sleep(300);
  await page.screenshot({ path: __dirname + '/shots/u8_howto.png' });
  await page.click('#howto-back'); await sleep(200);
  // results: ranked match forced to end with a win
  await page.click('#go-ranked'); await sleep(300);
  await page.evaluate(() => { const G = EGO.Game; G.manual = true; const m = G.match; G.stepManual(170, false); m.score = [2, 1]; m.human.stats.goals = 2; m.human.stats.assists = 1; m.clock = 0.2; G.stepManual(30, false); });
  await page.evaluate(() => EGO.Game.stepManual(240, true));
  await sleep(300);
  await page.screenshot({ path: __dirname + '/shots/u9_results.png' });
  console.log('RESULTS', JSON.stringify(await page.evaluate(() => ({ state: EGO.Game.state, em: EGO.Save.data.emeralds, rp: EGO.Save.data.rp, stats: EGO.Save.data.stats, saved: JSON.parse(localStorage.getItem('egoblocks.save.v1') || 'null') !== null }))));
  await page.click('#r-lobby'); await sleep(400);
  await page.evaluate(() => EGO.Game.manual = false);
  await sleep(600);
  await page.screenshot({ path: __dirname + '/shots/u10_lobby_after.png' });
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})();
