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
  check('team OVR: the starters averaged, you included (a spot nobody was put in counts as ROOKIE)', G.teamOvr(d) === Math.round([G.ovrOf(d.style, 'ST'), G.ovrOf('ROOKIE', 'WING'), G.ovrOf('ROOKIE', 'MID'), G.ovrOf('BASTION', 'DEF'), G.ovrOf('AEGIS', 'GK')].reduce((x, y) => x + y, 0) / 5), G.teamOvr(d));
  const rk = new G.Match('quick', 0.4, { size: 4, home: 'ROVERS', away, role: 'ST', squad: { bench: [] }, length: 120 });
  const fill = rk.teams[0].filter((q) => !q.isHuman).map((q) => q.role + ':' + q.styleId);
  check('nobody picked for a spot: ROOKIE plays there (never a random pick), in goal too', fill.length === 3 && fill.every((x) => x.endsWith(':ROOKIE')), fill);

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
  await page.click('#tm-pitch .fc-card[data-slot="DEF"]');
  const r0 = await page.evaluate(() => ({ sel: document.getElementById('tm-sel').textContent, list: [...document.querySelectorAll('#tm-roster [data-pick]')].map((b) => b.dataset.pick), dim: [...document.querySelectorAll('#tm-roster .fc-card.dim')].map((b) => b.dataset.pick) }));
  check('tap a spot: it is picked, and YOUR PLAYERS shows every character you have (a keeper is greyed out for an outfield spot)', /DEFENDER/.test(r0.sel) && ['RAILGUN', 'BASTION', 'THUNDER', 'AEGIS'].every((k) => r0.list.includes(k)) && r0.dim.includes('AEGIS') && !r0.dim.includes('BASTION'), r0);
  await page.click('#tm-roster [data-pick="BASTION"]');
  const t1 = await page.evaluate(() => ({ def: EGO.Save.data.squad.DEF, card: document.querySelector('#tm-pitch .fc-card[data-slot="DEF"] .fc-name').textContent, sub: document.getElementById('team-sub').textContent }));
  check('then tap a player: their card goes there and it is saved', t1.def === 'BASTION' && t1.card === 'BASTION' && /OVR/.test(t1.sub), t1);
  // drag and drop with the mouse: from YOUR PLAYERS onto a spot, then two cards on the pitch swap
  const drag = async (from, to) => {
    const a = await page.locator(from).boundingBox(), b = await page.locator(to).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + a.width / 2 + (b.x + b.width / 2 - a.x - a.width / 2) * i / 8, a.y + a.height / 2 + (b.y + b.height / 2 - a.y - a.height / 2) * i / 8);
    await page.mouse.up();
  };
  await drag('#tm-roster [data-pick="RAILGUN"]', '#tm-pitch .fc-card[data-slot="MID"]');
  const d1 = await page.evaluate(() => ({ mid: EGO.Save.data.squad.MID, card: document.querySelector('#tm-pitch .fc-card[data-slot="MID"] .fc-name').textContent, ghost: !!document.querySelector('.tm-ghost') }));
  check('drag a player from YOUR PLAYERS onto a spot: they play there', d1.mid === 'RAILGUN' && d1.card === 'RAILGUN' && !d1.ghost, d1);
  await drag('#tm-pitch .fc-card[data-slot="MID"]', '#tm-pitch .fc-card[data-slot="DEF"]');
  const d2 = await page.evaluate(() => ({ mid: EGO.Save.data.squad.MID, def: EGO.Save.data.squad.DEF }));
  check('drag one card on the pitch onto another: the two swap places', d2.def === 'RAILGUN' && d2.mid === 'BASTION', d2);
  await drag('#tm-pitch .fc-card[data-slot="MID"]', '#tm-bench .fc-card[data-slot="B1"]');
  const d3 = await page.evaluate(() => ({ mid: EGO.Save.data.squad.MID || null, bench: EGO.Save.data.squad.bench.slice() }));
  check('drag a card onto the bench: they sit on the bench', d3.mid === null && d3.bench.includes('BASTION') && d3.bench.includes('THUNDER'), d3);
  // the outfit: number and skins, only skins you own, saved, and worn in a match
  await page.evaluate(() => { const d = EGO.Save.data; d.skins.push('MOHAWK', 'RED_BAND'); EGO.Save.save(); EGO.TeamUI.sel = 'DEF'; EGO.TeamUI.render(); });
  for (let i = 0; i < 3; i++) await page.click('#tm-sel [data-num="1"]');
  await page.click('#tm-sel [data-of="hair"][data-dir="1"]');
  const o1 = await page.evaluate(() => ({ look: EGO.Save.data.squadLook.RAILGUN, num: document.querySelector('#tm-sel .tm-n').textContent, card: (document.querySelector('#tm-pitch .fc-card[data-slot="DEF"] .fc-num') || {}).textContent, hairs: EGO.TeamUI.options('hair') }));
  check('OUTFIT: change their number and hairstyle (from the hairstyles you own); the card shows the number', o1.look && o1.look.n === 4 && o1.num === '4' && o1.card === '4' && o1.look.hair && o1.hairs.includes('MOHAWK') && !o1.hairs.includes('AFRO'), o1);
  await page.waitForTimeout(400); await page.screenshot({ path: __dirname + '/shots/team_screen.png', timeout: 120000 }).catch(() => {});
  const o2 = await page.evaluate(() => {
    const G = EGO.Game; EGO.Save.load(); EGO.Save.validate();
    const kept = EGO.Save.data.squadLook.RAILGUN;
    G.startMatch('quick', { noIntro: true }); G.manual = true; G.stepManual(2, false);
    const p = G.match.teams[G.match.human.team].find((q) => q.styleId === 'RAILGUN');
    const r = { kept, num: p && p.number, hair: p && p.look.hairShape, want: kept && kept.hair && EGO.SKINS[kept.hair] ? EGO.SKINS[kept.hair].shape : null };
    G.match.dispose(); G.match = null; G.toLobby();
    return r;
  });
  check('after a reload the outfit is still there, and in a match they wear that number and hairstyle', o2.kept && o2.kept.n === 4 && o2.num === 4 && o2.hair === o2.want, o2);
  await page.evaluate(() => { EGO.Save.data.squad = { bench: ['THUNDER'] }; EGO.Save.save(); });
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
