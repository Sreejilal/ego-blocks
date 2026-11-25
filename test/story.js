// STORY mode (chapters of events with their own goals and rewards, story-only characters, your team, taking control of the
// teammate you pass to), the LAWLESS blasters, and the start screen's mode spotlight. Rules headless first, then the screens.
// node test/story.js   (run `npm run build` first)
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const STEP = 1 / 60;
const away = G.CLUB_IDS.find((c) => c !== 'ROVERS');
const toPlay = (m) => { for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP); return m.phase === 'play'; };

(async () => {
  // ---- the story-only characters ----
  const st = ['ROGUE', 'IRONCLAD', 'SOLARIS'];
  check('three story characters, with a role, an Awakening and a flashback', st.every((k) => G.STYLES[k] && G.STYLES[k].story && G.STYLES[k].awaken && G.STYLES[k].role && G.AWAKEN_STORY[k]), st.map((k) => G.STYLES[k] && G.STYLES[k].role));
  let fromBots = 0; for (let i = 0; i < 3000; i++) if (st.includes(G.botStyle(['ST', 'MID', 'DEF', 'LW'][i % 4]))) fromBots++;
  let fromSpins = 0; for (let r = 0; r < 5; r++) fromSpins += G.poolFor('style', r).filter((k) => st.includes(k)).length;
  const d0 = G.Save.defaults(); d0.bp = 999;
  check('never from bots, spins or blueprints', fromBots === 0 && fromSpins === 0 && !G.Goals.unlock(d0, 'ROGUE'), { fromBots, fromSpins, styles: d0.styles });

  // ---- the events ----
  const E = G.STORY_EVENTS;
  check('12 events in 3 chapters, each with a mode that exists, a goal and a reward; the characters come at the end of each chapter', E.length === 12 && G.STORY.length === 3 && E.every((e) => G.MODES[e.mode] && e.goal && e.reward && e.text) && G.STORY.map((c) => c.events[c.events.length - 1].reward.style).join() === 'ROGUE,IRONCLAD,SOLARIS', E.map((e) => e.mode));
  const d = G.Save.defaults(); d.story = { done: [] };
  check('you start at event 1; only it is open', G.Story.next(d) === E[0] && G.Story.open(d, E[0]) && !G.Story.open(d, E[1]));
  const fake = (res, score, mine) => ({ result: { res }, score, human: { team: 0 }, myGoals: mine });
  const g = (goal) => Object.assign({}, E[0], { goal });
  check('goals: win, win by 2, score 2 yourself, keep a clean sheet', G.Story.met(fake('win', [1, 0], 0), g({ win: true })) && !G.Story.met(fake('loss', [0, 1], 0), g({ win: true }))
    && !G.Story.met(fake('win', [2, 1], 0), g({ win: true, by: 2 })) && G.Story.met(fake('win', [3, 1], 0), g({ win: true, by: 2 }))
    && !G.Story.met(fake('win', [3, 0], 1), g({ win: true, mine: 2 })) && G.Story.met(fake('win', [3, 0], 2), g({ win: true, mine: 2 }))
    && !G.Story.met(fake('win', [2, 1], 0), g({ win: true, clean: true })) && G.Story.met(fake('win', [2, 0], 0), g({ win: true, clean: true })));
  const em0 = d.emeralds, f1 = G.Story.finish(d, E[0], fake('win', [2, 0], 1)), em1 = d.emeralds, f2 = G.Story.finish(d, E[0], fake('win', [2, 0], 1));
  check('meeting the goal pays out once and opens the next event; a replay gives nothing', f1.ok && f1.first && em1 === em0 + 150 && f1.next === E[1] && f2.ok && !f2.first && d.emeralds === em1 && G.Story.open(d, E[1]), { f1: [f1.ok, f1.first, f1.got], em: [em0, em1, d.emeralds] });
  const f3 = G.Story.finish(d, E[1], fake('loss', [0, 2], 0));
  check('missing the goal gives nothing and the event stays', !f3.ok && !f3.first && G.Story.next(d) === E[1], f3.ok);
  d.story.done = E.slice(0, 3).map((e) => e.id); const f4 = G.Story.finish(d, E[3], fake('win', [3, 1], 1));
  check('finishing chapter 1 gives ROGUE for good', f4.first && d.styles.includes('ROGUE') && f4.got.some((t) => /ROGUE/.test(t)), f4.got);

  // ---- a story match: your team, and passing takes you to the receiver ----
  const sq = { ST: 'RAILGUN', MID: 'ENFORCER', DEF: 'BASTION' };
  let m = new G.Match('quick', 0.3, { size: 4, home: 'ROVERS', away, story: E[3], squad: sq, role: 'ST', length: 120 });
  const mates = m.teams[0].filter((p) => !p.isHuman && !p.isGK);
  check('your team plays the characters you picked for each spot', mates.length >= 2 && mates.every((p) => p.styleId === sq[G.SQUAD_OF[p.role]]), mates.map((p) => p.role + ':' + p.styleId));
  toPlay(m);
  const h0 = m.human, mate = mates[0];
  m.possess(h0, true); m.passTo(h0, mate);
  for (let i = 0; i < 240 && m.ball.owner !== mate; i++) { mate.mx = mate.mz = 0; m.update(STEP); if (m.ball.owner && m.ball.owner !== mate) break; }
  check('in a story match, you take control of the teammate you pass to', m.ball.owner === mate && m.human === mate && mate.isHuman && !h0.isHuman, { owner: m.ball.owner && m.ball.owner.role, human: m.human.role });
  let err = null; try { for (let i = 0; i < 600; i++) m.update(STEP); } catch (e) { err = e.message; }
  check('and the match plays on, the player you left run by the computer', !err && !h0.isHuman, err);
  m = new G.Match('quick', 0.3, { size: 4, home: 'ROVERS', away, role: 'ST', length: 120 }); toPlay(m);
  const q0 = m.human, qm = m.teams[0].find((p) => !p.isHuman && !p.isGK);
  m.possess(q0, true); m.passTo(q0, qm); for (let i = 0; i < 240 && m.ball.owner !== qm; i++) { qm.mx = qm.mz = 0; m.update(STEP); if (m.ball.owner && m.ball.owner !== qm) break; }
  check('outside story mode you stay yourself', m.human === q0, m.human.role);

  // ---- LAWLESS blasters ----
  m = new G.Match('lawless', 0.5, { size: 3, home: 'ROVERS', away, role: 'ST', length: 120 }); toPlay(m);
  const sh = m.human, dir = m.dir(sh.team), foes = m.opponents(sh).filter((o) => !o.isGK);
  sh.pos.set(0, 0, 0); sh.yaw = dir > 0 ? 0 : Math.PI; m.camYaw = sh.yaw; sh.tackleProof = 5;
  foes.forEach((o, i) => { o.pos.set(i * 0.4, 0, dir * (6 + i * 3)); o.vel.set(0, 0, 0); o.setState('free'); });
  sh.item = 'blaster'; const used = m.useItem(sh);
  for (let i = 0; i < 40; i++) { for (const o of foes) if (o.state !== 'down') { o.mx = o.mz = 0; } m.update(STEP); }
  check('BLASTER: three quick shots that knock opponents over', used && G.ITEMS.blaster && foes.filter((o) => o.state === 'down').length >= 1 && !sh.gun && sh.item == null, foes.map((o) => o.state));
  toPlay(m); foes.forEach((o, i) => { o.pos.set(-1.5 + i * 3, 0, dir * 4); o.setState('free'); });
  sh.pos.set(0, 0, 0); sh.setState('free'); sh.item = 'scatter'; const n0 = m.projectiles.length, u2 = m.useItem(sh), n1 = m.projectiles.length;
  for (let i = 0; i < 30; i++) m.update(STEP);
  check('SCATTER BLASTER: six shots in a spread', u2 && n1 - n0 === 6 && foes.some((o) => o.state === 'down'), { shots: n1 - n0, foes: foes.map((o) => o.state) });
  err = null; let goals = 0;
  try { m = new G.Match('lawless', 0.5, { size: 3, home: 'ROVERS', away, noHuman: true, autopilot: true, length: 240 }); m.autopilot = true; let s = 0; while (!m.result && s++ < 60 * 400) m.update(STEP); goals = m.score[0] + m.score[1]; } catch (e) { err = e.stack.split('\n').slice(0, 2).join(' | '); }
  check('LAWLESS: bots play a whole match with the guns in the pool, no error', !err && G.ITEM_IDS.includes('blaster') && G.ITEM_IDS.includes('scatter'), { err, goals });

  // ---- on screen ----
  const { browser, page, logs } = await open({ wait: 1500 });
  const lob = await page.evaluate(() => {
    EGO.UI.show('lobby'); const b = document.getElementById('spot-play'), a = b.dataset.mode;
    EGO.UI.spotShow(1); const n = b.dataset.mode, flip = document.getElementById('spot-in').classList.contains('flip');
    return { a, n, flip, feat: EGO.featuredAt().mode, story: document.getElementById('story-sub').textContent, all: !!document.getElementById('go-modes') };
  });
  check('start screen: the spotlight starts on the featured mode, flips to the next, ALL MODES is next to it, STORY next to RANKED', lob.a === lob.feat && lob.n !== lob.a && lob.flip && lob.all && /CHAPTER 1/.test(lob.story), lob);
  await page.evaluate(() => { EGO.UI.spotHold = true; EGO.UI.spotI = 0; EGO.UI.spotShow(0); EGO.UI.spotPrev = null; }); // pointing at it holds it still
  await page.click('#spot-play');
  const sp = await page.evaluate(() => ({ state: EGO.Game.state, mode: EGO.Game.lastMode, feat: EGO.featuredAt().mode }));
  check('PLAY on the spotlight starts that mode at once', sp.state === 'match' && sp.mode === sp.feat, sp);
  await page.evaluate(() => { EGO.Game.match.dispose(); EGO.Game.match = null; EGO.Game.toLobby(); EGO.UI.openModes(); });
  const law = await page.evaluate(() => !!document.querySelector('#md-pick [data-mode="lawless"]'));
  check('MORE MODES lists LAWLESS too', law, law);
  await page.evaluate(() => { document.getElementById('scr-modes').hidden = true; EGO.Save.data.story.done = []; EGO.UI.show('story'); });
  const scr = await page.evaluate(() => ({ evs: document.querySelectorAll('.st-ev').length, now: document.querySelectorAll('.st-ev.now').length, play: document.querySelectorAll('.st-ev [data-ev]').length, slots: document.querySelectorAll('.st-slot').length }));
  check('the story screen: 12 events, the first one open with PLAY, your 3 team spots', scr.evs === 12 && scr.now === 1 && scr.play === 1 && scr.slots === 3, scr);
  await page.screenshot({ path: __dirname + '/shots/story_screen.png' });
  await page.click('.st-slot[data-slot="ST"]'); await page.click('#st-pick-grid [data-style="ROOKIE"]');
  const pick = await page.evaluate(() => ({ squad: EGO.Save.data.squad.ST, open: !document.getElementById('st-pick').hidden }));
  check('picking a character for a spot saves it', pick.squad === 'ROOKIE' && !pick.open, pick);
  await page.click('.st-ev.now [data-ev]');
  const sm = await page.evaluate(() => { const m = EGO.Game.match; return { state: EGO.Game.state, story: m && m.story && m.story.id, size: m && m.size, foe: EGO.TEAM ? EGO.TEAM[1].club : null }; });
  check('PLAY starts the event: its own size and opponent', sm.state === 'match' && sm.story === 'bp1' && sm.size === 2, sm);
  const fin = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, me = m.human.team; G.manual = true;
    m.score[me] = 2; m.score[1 - me] = 0; m.phase = 'play'; m.clock = 0.02; G.stepManual(400, false);
    return { state: G.state, again: document.getElementById('r-again').textContent, back: document.getElementById('r-lobby').textContent, box: document.querySelector('#r-earn .st-res') && document.querySelector('#r-earn .st-res').textContent, done: EGO.Save.data.story.done.slice() };
  });
  check('winning it: EVENT DONE with the reward, NEXT EVENT and STORY buttons', fin.state === 'results' && /EVENT DONE/.test(fin.box) && /150 EMERALDS/.test(fin.box) && fin.again === 'NEXT EVENT' && fin.back === 'STORY' && fin.done.includes('bp1'), fin);
  await page.screenshot({ path: __dirname + '/shots/story_result.png' });
  await page.click('#r-again');
  const nx = await page.evaluate(() => ({ story: EGO.Game.match && EGO.Game.match.story && EGO.Game.match.story.id }));
  check('NEXT EVENT plays event 2', nx.story === 'bp2', nx);
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
