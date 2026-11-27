// RANK ROAD (owner, Nov 27 2026: "ranked has no rewards to fight for that you can see"): a reward every 25 to 50 RP and a
// skin you can only get there at every new rank, each paid once; the road on its own screen from the start screen; ranked
// results show what you got and what is next.
// node test/ranks.js   (run `npm run build` first)
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

process.on('unhandledRejection', (e) => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
(async () => {
  // ---- the rules ----
  const R = G.RANK_ROAD, ranks = R.filter((s) => s.skin);
  check('a reward every 25 to 50 RP up to OBSIDIAN, and a skin you cannot spin at each of the 5 new ranks', R.length >= 10 && R.every((s, i) => !i || s.rp - R[i - 1].rp <= 50) && ranks.length === 5 && ranks.every((s) => G.SKINS[s.skin] && G.SKINS[s.skin].obj && ![0, 1, 2, 3, 4].some((r) => G.poolFor('skin', r).includes(s.skin))), R.map((s) => s.rp));
  const d = G.Save.defaults(), em0 = d.emeralds, bp0 = d.bp;
  d.rp = 110; const g1 = G.Rank.claim(d);
  check('reaching 110 RP pays the 25, 50, 75 and 100 RP steps (with the STONE skin)', g1.map((s) => s.rp).join() === '25,50,75,100' && d.skins.includes('RANK_STONE') && d.emeralds === em0 + 100 + 150 + 250 && d.bp === bp0 + 1 && d.rankGot === 100, { got: g1.map((s) => s.rp), em: d.emeralds - em0 });
  d.rp = 60; const g2 = G.Rank.claim(d); d.rp = 110; const g3 = G.Rank.claim(d);
  check('each step pays once: dropping back and climbing again pays nothing new', g2.length === 0 && g3.length === 0 && G.Rank.next(d).rp === 150);

  // ---- on screen ----
  const { browser, page, logs } = await open({ wait: 1500 });
  page.setDefaultTimeout(60000);
  await page.evaluate(() => { const d = EGO.Save.data; d.rp = 0; d.rankGot = 0; EGO.Save.save(); EGO.UI.show('lobby'); EGO.UI.renderLobby(); });
  const lob = await page.evaluate(() => document.getElementById('go-ranks').textContent);
  check('the start screen shows the next rank reward', /RANK ROAD/.test(lob) && /NEXT AT 25 RP: \+100 EMERALDS/.test(lob), lob);
  await page.evaluate(() => document.getElementById('go-ranks').click());
  const road = await page.evaluate(() => ({ cur: EGO.UI.cur, steps: document.querySelectorAll('#rr-road .rr-step').length, skins: document.querySelectorAll('#rr-road .rr-skin').length, next: (document.querySelector('#rr-road .rr-step.next .rr-rp') || {}).textContent, top: document.getElementById('rr-top').textContent }));
  check('RANK ROAD: every step with its reward, the rank skins drawn, the next one marked, a PLAY RANKED button', road.cur === 'ranks' && road.steps === 12 && road.skins === 5 && road.next === '25 RP' && /PLAY RANKED/.test(road.top), road);
  await page.waitForTimeout(400); await page.screenshot({ path: __dirname + '/shots/ranks_road.png', timeout: 120000 }).catch(() => {});
  const res = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; d.rp = 20; G.startMatch('ranked'); G.manual = true; G.stepManual(2, false);
    const m = G.match, me = m.human.team; m.score[me] = 2; m.score[1 - me] = 0; m.result = { res: 'win', human: { goals: 1, assists: 0, shots: 2, tackles: 0 } }; G.finishMatch(false);
    return { rp: d.rp, got: d.rankGot, line: document.getElementById('r-rank').textContent };
  });
  check('a ranked win that reaches a step: the results show the reward and the next one', res.rp === 45 && res.got === 25 && /RANK ROAD 25 RP: \+100 EMERALDS/.test(res.line) && /NEXT REWARD AT 50 RP/.test(res.line), res);
  await page.waitForTimeout(300); await page.screenshot({ path: __dirname + '/shots/ranks_result.png', timeout: 120000 }).catch(() => {});
  for (const [w, h] of [[390, 844], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    const fit = await page.evaluate(() => { EGO.Game.toLobby(); EGO.RankUI ? EGO.RankUI.open() : document.getElementById('go-ranks').click(); return { sw: document.documentElement.scrollWidth, w: innerWidth, cur: EGO.UI.cur }; });
    check(w + 'x' + h + ': the rank road fits the screen', fit.sw <= fit.w && fit.cur === 'ranks', fit);
    await page.screenshot({ path: __dirname + '/shots/ranks_' + w + 'x' + h + '.png', timeout: 120000 }).catch(() => {});
  }
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.filter((l) => l.startsWith('PAGEERROR')).slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
