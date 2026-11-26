// MY TEAM: ratings (OVR), a character per spot and a bench of 3, the team playing offline matches, substitutions from the
// pause menu (3 a match), and V switching player. Rules headless first, then the screens.
// node test/team.js   (run `npm run build` first)
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const STEP = 1 / 60, away = G.CLUB_IDS.find((c) => c !== 'ROVERS');
const toPlay = (m) => { for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(STEP); return m.phase === 'play'; };

(async () => {
  check('ratings: rarer is higher, 6 lower out of position', G.ovrOf('ROOKIE', 'ST') === 72 && G.ovrOf('RAILGUN', 'ST') === 93 && G.ovrOf('RAILGUN', 'DEF') === 87 && G.ovrOf('BASTION', 'DEF') === 78, [G.ovrOf('ROOKIE', 'ST'), G.ovrOf('RAILGUN', 'DEF')]);
  const d = G.Save.defaults(); d.styles.push('RAILGUN', 'BASTION', 'AEGIS', 'THUNDER', 'PHANTOM', 'ZENITH');
  d.squad = { ST: 'RAILGUN', DEF: 'BASTION', GK: 'AEGIS', MID: 'NOT_A_STYLE', WING: 'AEGIS', bench: ['THUNDER', 'PHANTOM', 'RAILGUN', 'ZENITH'] };
  G.Save.data = d; G.Save.validate();
  check('the save keeps only characters you own, keeper styles only in goal, each once, 3 on the bench at most', d.squad.ST === 'RAILGUN' && d.squad.GK === 'AEGIS' && !d.squad.MID && !d.squad.WING && d.squad.bench.join() === 'THUNDER,PHANTOM,ZENITH', d.squad);
  check('team OVR: the starters averaged, you included (an AUTO spot counts as 70)', G.teamOvr(d) === Math.round((93 + 70 + 70 + 78 + 84) / 5) || G.teamOvr(d) > 70, G.teamOvr(d));

  // the team plays, and subs
  const sq = { MID: 'ZENITH', DEF: 'BASTION', GK: 'AEGIS', bench: ['THUNDER', 'PHANTOM'] };
  let m = new G.Match('quick', 0.4, { size: 4, home: 'ROVERS', away, role: 'ST', squad: sq, length: 120 });
  const mine = m.teams[0].filter((p) => !p.isHuman).map((p) => p.role + ':' + p.styleId);
  check('your team plays the characters you picked (keeper in goal too)', mine.includes('MID:ZENITH') && mine.includes('DEF:BASTION') && mine.includes('GK:AEGIS'), mine);
  toPlay(m);
  const def = m.teams[0].find((p) => p.role === 'DEF'), pos = def.pos.clone(), num = def.number;
  m.possess(def, true);
  const p = m.subIn(def, 'THUNDER');
  check('a sub comes on in the same spot (same place, number, the ball if they had it); the one going off is on the bench', !!p && p.styleId === 'THUNDER' && p.role === 'DEF' && p.pos.distanceTo(pos) < 0.01 && p.number === num && m.ball.owner === p && m.teams[0].includes(p) && !m.players.includes(def) && m.bench.includes('BASTION') && m.subsLeft === 2, { style: p && p.styleId, bench: m.bench, left: m.subsLeft });
  m.subIn(m.teams[0].find((q) => q.role === 'MID'), 'PHANTOM'); m.subIn(m.teams[0].find((q) => q.role === 'DEF'), 'BASTION');
  const fourth = m.subIn(m.teams[0].find((q) => q.role === 'MID'), 'ZENITH');
  check('3 subs a match, then no more; you cannot sub yourself', m.subsLeft === 0 && !fourth && !m.subIn(m.human, m.bench[0]), { left: m.subsLeft, bench: m.bench });
  let err = null; try { for (let i = 0; i < 900; i++) m.update(STEP); } catch (e) { err = e.message; }
  check('the match plays on after the subs', !err, err);

  // V: switch player
  m = new G.Match('quick', 0.4, { size: 4, home: 'ROVERS', away, role: 'ST', length: 120 }); toPlay(m);
  const me = m.human, mate = m.teams[0].find((q) => !q.isHuman && !q.isGK);
  m.possess(mate, true);
  m.ctl = { moveX: 0, moveY: 0, swap: true, ab: [false, false, false] }; m.updateHuman(STEP, m.ctl);
  check('V takes over the teammate with the ball (never the keeper)', m.human === mate && !me.isHuman && !mate.isGK, { now: m.human.role });
  m.ball.release(); m.ball.pos.set(me.pos.x, 0.2, me.pos.z);
  m.ctl = { moveX: 0, moveY: 0, swap: true, ab: [false, false, false] }; m.updateHuman(STEP, m.ctl);
  check('with nobody on the ball, V takes the teammate nearest it', m.human === me, { now: m.human.role });

  // ---- on screen ----
  const { browser, page, logs } = await open({ wait: 1500 });
  await page.evaluate(() => { const d = EGO.Save.data; d.styles.push('RAILGUN', 'BASTION', 'THUNDER', 'AEGIS'); d.squad = { bench: ['THUNDER'] }; EGO.Save.save(); EGO.UI.show('lobby'); EGO.UI.renderLobby(); });
  await page.click('#go-team', { force: true });
  const t0 = await page.evaluate(() => ({ cur: EGO.UI.cur, cards: document.querySelectorAll('#tm-pitch .fc-card').length, me: !!document.querySelector('#tm-pitch .fc-card.me'), bench: document.querySelectorAll('#tm-bench .fc-card').length, ovr: document.querySelector('#tm-ovr b').textContent }));
  check('MY TEAM: five cards on the pitch (yours marked), a bench of 3, the team OVR', t0.cur === 'team' && t0.cards === 5 && t0.me && t0.bench === 3 && +t0.ovr > 0, t0);
  await page.click('#tm-pitch .fc-card[data-slot="DEF"]'); await page.click('#st-pick-grid [data-style="BASTION"]');
  const t1 = await page.evaluate(() => ({ def: EGO.Save.data.squad.DEF, card: document.querySelector('#tm-pitch .fc-card[data-slot="DEF"] .fc-name').textContent, sub: document.getElementById('team-sub').textContent }));
  check('picking a character for a spot puts their card there and saves it', t1.def === 'BASTION' && t1.card === 'BASTION' && /OVR/.test(t1.sub), t1);
  await page.screenshot({ path: __dirname + '/shots/team_screen.png', timeout: 120000 }).catch(() => {});
  const s0 = await page.evaluate(() => { const G = EGO.Game; G.startMatch('quick'); G.manual = true; G.stepManual(240, false); G.pause(); return { subs: !document.getElementById('p-subs').hidden }; });
  check('in a match, the pause menu has SUBS', s0.subs, s0);
  await page.click('#p-subs'); await page.click('#subs-bench [data-sub="THUNDER"]'); await page.click('#subs-on [data-off]');
  const s1 = await page.evaluate(() => { const m = EGO.Game.match; return { left: m.subsLeft, on: m.teams[m.human.team].some((p) => p.styleId === 'THUNDER'), msg: document.getElementById('subs-msg').textContent }; });
  check('SUBS: pick the bench player, then who comes off', s1.left === 2 && s1.on && /THUNDER IS ON/.test(s1.msg), s1);
  await page.screenshot({ path: __dirname + '/shots/team_subs.png', timeout: 120000 }).catch(() => {});
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
