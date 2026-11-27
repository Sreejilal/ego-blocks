// TRAINING drills (sprint through gates, stop 5 attacks) with stars and first-time rewards, and the DAILY login calendar.
// Rules headless first, then the screens.   node test/train.js   (run `npm run build` first)
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const STEP = 1 / 60, away = G.CLUB_IDS.find((c) => c !== 'ROVERS');

(async () => {
  // ---- the sprint drill ----
  let m = new G.Match('drillrun', 0.5, { size: 2, home: 'ROVERS', away, length: 120 });
  check('SPRINT DRILL: you alone, 8 gates, no clock, a few seconds to get ready', !!m.drill && m.drill.kind === 'run' && m.drill.gates.length === 8 && m.teams[0].length === 1 && m.drill.go > 0 && m.drill.par[2] < m.drill.par[1] && m.drill.par[1] < m.drill.par[0], { gates: m.drill && m.drill.gates.length, par: m.drill && m.drill.par.map((t) => +t.toFixed(1)) });
  for (let i = 0; i < 120; i++) m.update(STEP);
  const h = m.human; let steps = 0;
  for (const g of m.drill.gates) { // run straight to each gate at sprint speed
    for (let k = 0; k < 600 && Math.hypot(h.pos.x - g.x, h.pos.z - g.z) > 1; k++) { const dx = g.x - h.pos.x, dz = g.z - h.pos.z, l = Math.hypot(dx, dz) || 1; h.pos.x += dx / l * 11 * STEP; h.pos.z += dz / l * 11 * STEP; m.update(STEP); steps++; }
  }
  const r = m.result && m.result.drill;
  check('through all 8 gates: the drill ends with a time and stars (a fast run gets 3)', m.phase === 'end' && r && r.score > 5 && r.stars === 3, r);
  const d = G.Save.defaults(); const em0 = d.emeralds, bp0 = d.bp;
  const f1 = G.Drill.finish(d, r), f2 = G.Drill.finish(d, r);
  check('the first 3 stars pay out all three star rewards once; a repeat pays nothing', f1.got.length === 3 && d.emeralds === em0 + 60 + 120 + 200 && d.bp === bp0 + 1 && f2.got.length === 0 && d.drills.drillrun.stars === 3, { got: f1.got, em: d.emeralds - em0 });
  const slow = G.Drill.finish(d, Object.assign({}, r, { score: r.score + 30, stars: 0 }));
  check('a slower run keeps your best time', d.drills.drillrun.best === r.score && !slow.better, d.drills.drillrun);

  // ---- the defending drill ----
  m = new G.Match('drilldef', 0.5, { size: 2, home: 'ROVERS', away, length: 120 });
  const roles = [m.teams[0].map((p) => p.role).join(), m.teams[1].map((p) => p.role).join()];
  check('DEFENDING DRILL: you and your keeper against two attackers, their striker on the ball', m.drill.kind === 'def' && roles[0] === 'GK,DEF' && roles[1] === 'ST,MID' && m.human.role === 'DEF' && m.ball.owner && m.ball.owner.role === 'ST', roles);
  m.possess(m.human, true); m.update(STEP);
  check('winning the ball stops the attack', m.drill.stops === 1 && m.drill.n === 1 && m.drill.wait > 0, { stops: m.drill.stops });
  for (let i = 0; i < 120; i++) m.update(STEP);
  m.onGoal(-1);
  check('a goal ends the attack too, and the next attack starts from halfway', m.drill.goals === 1 && m.drill.n === 2, { goals: m.drill.goals });
  for (let i = 0; i < 120; i++) m.update(STEP);
  for (let k = 0; k < 3; k++) { m.possess(m.human, true); m.update(STEP); for (let i = 0; i < 120; i++) m.update(STEP); }
  const rd = m.result && m.result.drill;
  check('after 5 attacks: 4 stopped is 2 stars', m.phase === 'end' && rd && rd.score === 4 && rd.stars === 2, rd);
  let err = null; try { m = new G.Match('drilldef', 0.6, { size: 2, home: 'ROVERS', away, length: 120 }); let s = 0; while (!m.result && s++ < 60 * 200) m.update(STEP); } catch (e) { err = e.stack.split('\n').slice(0, 2).join(' | '); }
  check('the attackers really attack (a whole drill plays by itself with no error)', !err && !!m.result, { err, res: m.result && m.result.drill });
  // the same drill with you in goal (owner, Nov 26 2026: "the defending drill can also make you goalie")
  m = new G.Match('drillgk', 0.5, { size: 2, home: 'ROVERS', away, length: 120 });
  const gk = { role: m.human.role, isGK: m.human.isGK, z: +m.human.pos.z.toFixed(1), def: +m.teams[0].find((p) => p.role === 'DEF').pos.z.toFixed(1) };
  check('DEFENDING DRILL IN GOAL: you are the keeper on your goal line, your defender out in front', gk.isGK && gk.role === 'GK' && Math.abs(gk.z) > 50 && Math.abs(gk.def) < 35, gk);
  m.possess(m.human, true); m.update(STEP);
  check('in goal, catching it stops the attack', m.drill.stops === 1, { stops: m.drill.stops });
  err = null; try { m = new G.Match('drillgk', 0.6, { size: 2, home: 'ROVERS', away, length: 120, noHuman: false }); let s = 0; while (!m.result && s++ < 60 * 200) m.update(STEP); } catch (e) { err = e.stack.split('\n').slice(0, 2).join(' | '); }
  check('a whole drill in goal plays by itself with no error, and has its own stars', !err && !!m.result && m.result.drill.mode === 'drillgk' && !!G.DRILLS.drillgk, { err, res: m.result && m.result.drill });

  // ---- the login calendar ----
  const dl = G.Save.defaults(); G.Save.data = dl; const e0 = dl.emeralds;
  const g1 = G.Daily.openGift(dl);
  check('opening the daily gift also gives day 1 of the login calendar', g1 && g1.login && g1.login.day === 1 && dl.daily.login === 1 && dl.emeralds >= e0 + 50, g1 && g1.login);
  dl.daily.gift = ''; dl.daily.login = 6; const b0 = dl.bp, em1 = dl.emeralds; const g7 = G.Daily.openGift(dl);
  check('day 7 is the big one (+500 emeralds, +5 blueprints), then a new week', g7.login.day === 7 && dl.bp === b0 + 5 && dl.emeralds >= em1 + 500 && dl.daily.login % 7 === 0, g7.login);

  // ---- on screen ----
  const { browser, page, logs } = await open({ wait: 1500 });
  await page.evaluate(() => { EGO.UI.show('lobby'); });
  await page.evaluate(() => document.getElementById('go-train').click());
  const tr = await page.evaluate(() => ({ cur: EGO.UI.cur, drills: document.querySelectorAll('#tr-drills .tr-card').length, prac: [...document.querySelectorAll('#tr-practice [data-mode]')].map((b) => b.dataset.mode) }));
  check('TRAINING: three drills with stars (the defending drill also in goal), then free kicks, keeper practice and the tutorial', tr.cur === 'train' && tr.drills === 3 && tr.prac.join() === 'freekick,fkkeeper,tutorial', tr);
  await page.screenshot({ path: __dirname + '/shots/train_screen.png', timeout: 120000 }).catch(() => {});
  await page.evaluate(() => document.getElementById('go-drillrun').click());
  const run = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human; G.manual = true; G.stepManual(100, false);
    for (const g of m.drill.gates) { h.pos.set(g.x, 0, g.z); G.stepManual(30, false); }
    G.stepManual(260, false);
    return { state: G.state, title: document.getElementById('r-title').textContent, again: document.getElementById('r-again').textContent, back: document.getElementById('r-lobby').textContent, stars: document.querySelectorAll('#r-stats .dr-stars i.on').length, earn: document.getElementById('r-earn').textContent, saved: EGO.Save.data.drills.drillrun };
  });
  check('a drill ends on its results: the stars, the rewards, TRY AGAIN and TRAINING', run.state === 'results' && run.title === 'SPRINT DRILL' && run.again === 'TRY AGAIN' && run.back === 'TRAINING' && run.stars >= 1 && /STAR/.test(run.earn) && run.saved && run.saved.stars === run.stars, run);
  await page.screenshot({ path: __dirname + '/shots/train_result.png', timeout: 120000 }).catch(() => {});
  await page.evaluate(() => document.getElementById('r-lobby').click());
  const back = await page.evaluate(() => EGO.UI.cur);
  check('TRAINING takes you back to the training screen', back === 'train', back);
  const day = await page.evaluate(() => { EGO.UI.show('lobby'); EGO.Save.data.daily.gift = ''; document.getElementById('go-daily').click(); const n = document.querySelectorAll('#dl-week .dl-day').length; document.getElementById('dl-open').click(); return { n, got: document.querySelectorAll('#dl-week .dl-day.got').length, text: document.getElementById('dl-gift').textContent }; });
  check('DAILY shows the 7 day calendar; opening the gift ticks today off', day.n === 7 && day.got >= 1 && /DAY \d/.test(day.text), day);
  await page.screenshot({ path: __dirname + '/shots/daily_calendar.png', timeout: 120000 }).catch(() => {});
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
