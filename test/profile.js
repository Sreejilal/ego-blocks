// Match history (last 20) and the profile card: level from XP, rank, what you have equipped, best stats.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const lv = await page.evaluate(() => [0, 199, 200, 449, 450, 2000].map((x) => EGO.levelOf(x).level));
  check('levels: 200 XP for level 2, then 50 more each level', lv.join() === '1,1,2,2,3,7', lv);

  // play a ranked win with 2 goals and an assist
  const one = await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('ranked'); G.manual = true; G.stepManual(170, false);
    const m = G.match; m.score = [3, 1]; m.human.stats.goals = 2; m.human.stats.assists = 1; m.human.stats.tackles = 2; m.clock = 0.1;
    G.stepManual(60 * 4.5, false);
    const d = EGO.Save.data, h = d.history[d.history.length - 1];
    return { state: G.state, xp: d.xp, h, best: d.best, xpLine: document.getElementById('r-xp').textContent };
  });
  check('a finished match is saved to the history', one.state === 'results' && one.h && one.h.mode === 'ranked' && one.h.res === 'win' && one.h.g === 2 && one.h.a === 1 && one.h.rp === 25 && one.h.score.join() === '3,1' && one.h.style === 'ROOKIE', one.h);
  check('XP for the match: 100 win + 50 goals + 15 assist + 10 tackles', one.xp === 175 && /\+175 XP/.test(one.xpLine), { xp: one.xp, line: one.xpLine });
  check('best stats update', one.best.goals === 2 && one.best.assists === 1 && one.best.streak === 1 && one.best.peakRp === 25, one.best);
  await page.screenshot({ path: __dirname + '/shots/p1_results.png' });

  // 22 more quick results: the history keeps only the last 20
  const many = await page.evaluate(() => {
    const G = EGO.Game;
    for (let i = 0; i < 22; i++) {
      G.toLobby(); G.startMatch('quick'); G.stepManual(170, false);
      const m = G.match; m.score = i % 3 === 0 ? [0, 2] : [1, 0]; m.human.stats.goals = i % 3 === 0 ? 0 : 1; m.clock = 0.1; G.stepManual(60 * 4.5, false);
    }
    const d = EGO.Save.data;
    return { n: d.history.length, last: d.history[19].res, best: d.best, lv: EGO.levelOf(d.xp).level };
  });
  check('only the last 20 matches are kept', many.n === 20, many);
  check('win streak counts the longest run', many.best.streak === 2, many.best);

  await page.evaluate(() => EGO.Game.toLobby());
  const card = await page.evaluate(() => document.getElementById('pro-rec').textContent);
  check('the lobby card shows your level', /^LEVEL \d+ ·/.test(card), card);
  await page.click('#lob-profile'); await sleep(200);
  const prof = await page.evaluate(() => ({ cur: EGO.UI.cur, rows: document.querySelectorAll('#pf-hist .pf-row').length, level: document.querySelector('.pf-lv b').textContent, skins: document.querySelectorAll('.pf-skin canvas').length, face: !!document.querySelector('.pf-head canvas'), first: document.querySelector('#pf-hist .pf-row').textContent }));
  check('the profile screen lists 20 matches, newest first', prof.cur === 'profile' && prof.rows === 20 && /QUICK MATCH/.test(prof.first), prof);
  check('the profile card shows level, face and all six skin slots', prof.face && prof.skins === 6 && +prof.level === many.lv, prof);
  await page.screenshot({ path: __dirname + '/shots/p2_profile.png' });

  // it survives a reload, and junk in the save is cleaned up
  await page.reload(); await sleep(1200);
  const kept = await page.evaluate(() => ({ n: EGO.Save.data.history.length, xp: EGO.Save.data.xp }));
  check('history and XP survive a reload', kept.n === 20 && kept.xp > 175, kept);
  await page.evaluate(() => localStorage.setItem('scorz.save.v1', JSON.stringify({ xp: 'lots', history: [null, 5, { mode: 'quick', res: 'win', score: 'x', g: 'two' }, { nope: 1 }], best: { goals: -3 } })));
  await page.reload(); await sleep(1200);
  const clean = await page.evaluate(() => ({ xp: EGO.Save.data.xp, hist: EGO.Save.data.history, best: EGO.Save.data.best }));
  check('broken history in a save is cleaned up', clean.xp === 0 && clean.hist.length === 1 && clean.hist[0].g === 0 && clean.hist[0].score.join() === '0,0' && clean.best.goals === 0, clean);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();

  for (const [name, viewport] of [['phone-side', { width: 844, height: 390 }], ['phone-up', { width: 390, height: 844 }]]) {
    const o = await open({ wait: 1500, viewport, mobile: true });
    await o.page.evaluate(() => { const d = EGO.Save.data; for (let i = 0; i < 5; i++) d.history.push({ t: Date.now() - i * 3600e3, mode: i % 2 ? 'ranked' : 'koth', size: 3, score: [2, 1], res: i % 2 ? 'win' : 'loss', g: 1, a: 0, style: 'ROOKIE', club: 'ROVERS', opp: 'EMBER', rp: i % 2 ? 25 : null }); EGO.UI.show('profile'); });
    await o.page.screenshot({ path: __dirname + '/shots/p_' + name + '.png' });
    const side = await o.page.evaluate(() => { const s = document.getElementById('scr-profile'); return s.scrollWidth > s.clientWidth; });
    check(name + ': profile has no sideways scrolling', !side);
    check(name + ': no errors', o.logs.length === 0, o.logs.slice(0, 4));
    await o.browser.close();
  }
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
