// Style spins and blueprints: a spun style is yours (and on) until your next style spin replaces it; blueprints
// from GOALS keep a style for good; the GOALS screen shows the grind; finished steps pay blueprints and skins.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (vp) => {
    const p = await (await browser.newContext({ viewport: vp })).newPage(); p.setDefaultTimeout(120000);
    p.on('pageerror', (e) => logs.push(e.message));
    await p.goto(URL, { timeout: 120000 }); await p.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 }); return p;
  };
  const A = await mk({ width: 1280, height: 720 });
  // two style spins in a row: the real spin, rolled again until it gives the style the test wants
  await A.evaluate(() => EGO.UI.openSpins());
  const spun = await A.evaluate(async () => {
    const d = EGO.Save.data; d.emeralds = 1000;
    const real = Math.random; const out = [];
    for (const want of ['SPRINTER', 'PHANTOM']) {
      // pick() uses Math.random over the pool: try rolls until the spin gives the style we want
      for (let tries = 0; tries < 400; tries++) {
        const before = JSON.stringify({ s: d.spunStyle, st: d.styles });
        const snapshot = JSON.parse(JSON.stringify(d));
        EGO.UI.spinKind = 'style'; EGO.UI.spinning = false; EGO.UI.spin(); EGO.Reveal.skip && EGO.Reveal.skip();
        await new Promise((r) => setTimeout(r, 30));
        if (d.spunStyle === want) break;
        Object.assign(d, snapshot); d.emeralds = 1000; EGO.UI.spinning = false;
      }
      await new Promise((r) => setTimeout(r, 900));
      out.push({ spun: d.spunStyle, style: d.style, owned: d.styles.slice(), tag: document.getElementById('spin-result').textContent });
    }
    return out;
  });
  check('a spun style is yours and switched on, but not kept for good', spun[0].spun === 'SPRINTER' && spun[0].style === 'SPRINTER' && !spun[0].owned.includes('SPRINTER') && /YOURS UNTIL YOUR NEXT STYLE SPIN/.test(spun[0].tag), spun[0]);
  check('the next style spin replaces it', spun[1].spun === 'PHANTOM' && spun[1].style === 'PHANTOM' && /REPLACES SPRINTER/.test(spun[1].tag) && !spun[1].owned.includes('SPRINTER'), spun[1]);
  await A.screenshot({ path: __dirname + '/shots/bp1_spin.png', timeout: 120000 });
  const reload = await A.evaluate(() => { EGO.Save.load(); EGO.Save.validate(); return { style: EGO.Save.data.style, spun: EGO.Save.data.spunStyle }; });
  check('it is still on after a reload, until the next spin', reload.style === 'PHANTOM' && reload.spun === 'PHANTOM', reload);
  // GOALS: playing pays blueprints
  const g = await A.evaluate(() => {
    const d = EGO.Save.data; d.bp = 0; d.goalSteps = {}; Object.assign(d.stats, { goals: 16, wins: 26, played: 4, tackles: 0, ankles: 0, awakens: 10, assists: 0 });
    const done = EGO.Goals.check(d);
    return { bp: d.bp, done, skins: d.skins.filter((s) => ['GRIND_BOOTS', 'AWAKE_GLOVES'].includes(s)), again: EGO.Goals.check(d).length };
  });
  check('finished GOALS steps pay blueprints, once', g.bp === 2 + 3 + 2 + 3 + 5 + 2 + 3 && g.again === 0, g);
  check('some steps pay a skin you cannot spin', g.skins.includes('GRIND_BOOTS') && g.skins.includes('AWAKE_GLOVES') && !(await A.evaluate(() => Object.keys(EGO.SKINS).filter((k) => EGO.SKINS[k].obj).some((k) => EGO.poolFor('skin', 4).includes(k) || EGO.poolFor('skin', 3).includes(k)))), g);
  // keep a style for good in the Locker
  const keep = await A.evaluate(async () => {
    const d = EGO.Save.data; EGO.UI.openLocker(); EGO.UI.lockerTab = 'style'; EGO.UI.lockerSel = 'PHANTOM'; EGO.UI.renderLocker();
    const btn = document.getElementById('lk-keep'), text = document.getElementById('lk-cap').textContent;
    const bp0 = d.bp; if (btn) btn.click();
    return { text, had: !!btn, bp: bp0 - d.bp, owned: d.styles.includes('PHANTOM'), spun: d.spunStyle };
  });
  check('the Locker keeps a style for blueprints (Epic: 4)', keep.had && keep.bp === 4 && keep.owned && keep.spun === null, keep);
  await A.screenshot({ path: __dirname + '/shots/bp2_locker.png', timeout: 120000 });
  const after = await A.evaluate(async () => {
    const d = EGO.Save.data; d.emeralds = 1000;
    for (let tries = 0; tries < 400; tries++) {
      const snap = JSON.parse(JSON.stringify(d));
      EGO.UI.spinKind = 'style'; EGO.UI.spinning = false; EGO.UI.spin(); EGO.Reveal.skip && EGO.Reveal.skip();
      await new Promise((r) => setTimeout(r, 30));
      if (d.spunStyle && d.spunStyle !== 'PHANTOM') break;
      Object.assign(d, snap); d.emeralds = 1000; EGO.UI.spinning = false;
    }
    await new Promise((r) => setTimeout(r, 900));
    return { kept: d.styles.includes('PHANTOM'), spun: d.spunStyle };
  });
  check('a kept style stays after the next spin', after.kept && after.spun && after.spun !== 'PHANTOM', after);
  // the GOALS screen
  await A.evaluate(() => { EGO.UI.show('lobby'); document.getElementById('go-goals').click(); });
  const gs = await A.evaluate(() => ({ cur: EGO.UI.cur, text: document.getElementById('scr-goals').textContent }));
  check('GOALS on the start screen shows blueprints and every goal', gs.cur === 'goals' && /BLUEPRINTS/.test(gs.text) && /SCORE GOALS/.test(gs.text) && /BREAK ANKLES/.test(gs.text) && /AWAKEN/.test(gs.text), gs.text.slice(0, 120));
  await A.screenshot({ path: __dirname + '/shots/bp3_goals.png', timeout: 120000 });
  // a match counts towards it, and the results say so
  const res = await A.evaluate(() => {
    const d = EGO.Save.data; d.goalSteps = {}; Object.assign(d.stats, { goals: 4, wins: 0, played: 0, tackles: 0, ankles: 0, awakens: 0, assists: 0 });
    EGO.UI.show('lobby'); EGO.Game.startMatch('quick'); EGO.Game.stepManual(3, false);
    const m = EGO.Game.match; m.score = [1, 0]; m.result = { res: 'win', human: { goals: 1, assists: 0, shots: 2, tackles: 1 } }; EGO.Game.finishMatch(false);
    return { line: document.getElementById('r-daily').textContent, goals: d.stats.goals, tackles: d.stats.tackles };
  });
  check('the results show a finished GOAL step', /GOAL DONE: SCORE GOALS 5/.test(res.line) && res.goals === 5 && res.tackles === 1, res);
  // phones
  for (const [nm, vp] of [['side', { width: 844, height: 390 }], ['up', { width: 390, height: 844 }]]) {
    const P = await mk(vp);
    await P.evaluate(() => { document.getElementById('go-goals').click(); });
    const fit = await P.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth }));
    check('phone ' + nm + ': GOALS fits', fit.sw <= fit.w, fit);
    await P.screenshot({ path: __dirname + '/shots/bp4_goals_' + nm + '.png', timeout: 120000 });
  }
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
