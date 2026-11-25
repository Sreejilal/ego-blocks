// Roles (owner, Nov 2026: "place each character's role so one defender one winger like that"): every character is a
// STRIKER, WINGER, MIDFIELD, DEFENDER or KEEPER. The Locker says so, you start a match in your character's role (until you
// pick another spot for that character), a winger's team plays WIDE (a left winger), and bots mostly play characters made
// for their spot. Also the new characters (owner: "add another generational person", "add more content"): ZENITH (a
// Generational winger: FLASH STEP, and WORLD STOP when awakened), BASTION (a defender) and AEGIS (a keeper).
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});

  const data = await page.evaluate(() => {
    const S = EGO.STYLES, ids = EGO.STYLE_IDS, count = {};
    for (const id of ids) count[S[id].role] = (count[S[id].role] || 0) + 1;
    return { missing: ids.filter((id) => !EGO.ROLES[S[id].role]), count, keepers: ids.filter((id) => S[id].gk).every((id) => S[id].role === 'GK'), gen: ids.filter((id) => S[id].rarity === 'Generational' && !S[id].story), zen: S.ZENITH && { role: S.ZENITH.role, ab: S.ZENITH.abilities }, bas: S.BASTION && S.BASTION.role, aeg: S.AEGIS && { role: S.AEGIS.role, gk: S.AEGIS.gk } };
  });
  check('every character has a role: strikers, wingers, midfielders, defenders and keepers', data.missing.length === 0 && data.count.ST >= 6 && data.count.WING >= 6 && data.count.MID >= 6 && data.count.DEF >= 6 && data.count.GK === 3 && data.keepers, data);
  check('a second Generational (ZENITH, a winger with FLASH STEP), BASTION a defender, AEGIS a keeper', data.gen.join(',') === 'RAILGUN,ZENITH' && data.zen.role === 'WING' && data.zen.ab[0] === 'flashStep' && data.bas === 'DEF' && data.aeg.role === 'GK' && data.aeg.gk, data);

  // the Locker: every card and the detail say the role
  const lk = await page.evaluate(() => {
    const d = EGO.Save.data; d.styles.push('ZENITH', 'BASTION', 'AEGIS');
    EGO.UI.show('locker'); EGO.UI.lockerTab = 'style'; EGO.UI.lockerSel = 'ZENITH'; EGO.UI.renderLocker();
    const card = (id) => { const c = document.querySelector('#locker-grid .lcard[data-id="' + id + '"] .label'); return c && c.textContent; };
    return { zen: card('ZENITH'), bas: card('BASTION'), aeg: card('AEGIS'), war: card('WARDEN'), det: document.getElementById('locker-detail').textContent.slice(0, 160) };
  });
  check('Locker cards say the role (WINGER, DEFENDER, KEEPER) and the detail says where it starts', /^WINGER/.test(lk.zen) && /^DEFENDER/.test(lk.bas) && /^KEEPER/.test(lk.aeg) && /^DEFENDER/.test(lk.war) && /ROLE: WINGER · STARTS ON THE WING/.test(lk.det), lk);
  await shot('roles_locker');

  // a winger starts on the left wing, and your team plays WIDE; the position picker marks YOUR ROLE
  const wing = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; G.toLobby(); G.introTest = true; d.style = 'ZENITH'; d.pos = null; d.posFor = null;
    G.startMatch('quick'); const m = G.match;
    const btn = [...document.querySelectorAll('#in-roles .in-role')].map((b) => ({ r: b.dataset.r, fit: b.classList.contains('fit'), t: b.textContent }));
    return { role: m.human.role, mine: m.teams[0].map((p) => p.role).join(','), btn };
  });
  check('ZENITH (a winger) starts on the left wing, and your team plays WIDE (keeper, defender, winger, striker)', wing.role === 'LW' && wing.mine === 'GK,DEF,LW,ST', wing);
  check('the position picker marks the spot made for your character: YOUR ROLE', wing.btn.filter((b) => b.fit).map((b) => b.r).join(',') === 'LW' && /YOUR ROLE/.test(wing.btn.find((b) => b.r === 'LW').t), wing.btn);
  await shot('roles_picker');

  // picking another spot is remembered for that character; another character starts in its own role
  const pick = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data, out = {};
    G.pickRole('ST'); out.saved = [d.pos, d.posFor];
    G.toLobby(); G.startMatch('quick'); out.again = G.match.human.role; // ZENITH again: the striker spot you picked (your team no longer needs a winger)
    G.toLobby(); d.style = 'BASTION'; G.startMatch('quick'); out.bastion = G.match.human.role;
    G.toLobby(); d.style = 'AEGIS'; G.startMatch('quick'); out.aegis = { role: G.match.human.role, gk: G.match.human.isGK };
    G.toLobby(); d.style = 'ROOKIE'; G.startMatch('quick'); out.rookie = G.match.human.role;
    G.toLobby(); G.introTest = false; return out;
  });
  check('a spot you pick is remembered for that character; others start in their role (BASTION at the back, AEGIS in goal, ROOKIE up front)', pick.saved[0] === 'ST' && pick.saved[1] === 'ZENITH' && pick.again === 'ST' && pick.bastion === 'DEF' && pick.aegis.role === 'GK' && pick.aegis.gk && pick.rookie === 'ST', pick);

  // an older save (a position from before roles) keeps its position
  const mig = await page.evaluate(() => {
    const S = EGO.Save, keep = localStorage.getItem(S.key);
    localStorage.setItem(S.key, JSON.stringify({ style: 'SPRINTER', styles: ['ROOKIE', 'SPRINTER'], pos: 'GK' }));
    S.load(); S.validate(); const out = { pos: S.data.pos, posFor: S.data.posFor };
    localStorage.setItem(S.key, keep || '{}'); S.load(); S.validate(); return out;
  });
  check('a save from before roles keeps the spot it had (for the character it has now)', mig.pos === 'GK' && mig.posFor === 'SPRINTER', mig);

  // bots: most of them play a character made for their spot
  const bots = await page.evaluate(() => {
    const G = EGO.Game; let fit = 0, n = 0;
    for (let i = 0; i < 12; i++) { G.toLobby(); G.startMatch('quick'); for (const p of G.match.players) if (!p.isHuman && !p.isGK) { n++; if (EGO.roleFits(p.styleId, p.role)) fit++; } }
    const wide = []; for (let i = 0; i < 30; i++) { G.toLobby(); G.startMatch('quick'); wide.push(G.match.teams[1].map((p) => p.role).join(',')); }
    G.toLobby();
    return { fit, n, share: +(fit / n).toFixed(2), wide: wide.filter((w) => w === 'GK,DEF,LW,ST').length, classic: wide.filter((w) => w === 'GK,DEF,MID,ST').length };
  });
  check('bots mostly play characters made for their spot (a defender at the back, a winger on the wing)', bots.share > 0.6, bots);
  check('bot teams sometimes play WIDE with a winger', bots.wide > 0 && bots.classic > bots.wide && bots.wide + bots.classic === 30, bots);

  // ZENITH's powers: FLASH STEP blinks about 6 blocks with the ball, nobody can tackle you; WORLD STOP freezes everyone near
  const zen = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; d.style = 'ZENITH'; d.pos = null; d.posFor = null; G.startMatch('quick'); G.stepManual(5);
    const m = G.match, h = m.human, b = m.ball; m.phase = 'play'; m.phaseT = 0;
    for (const p of m.players) if (p !== h) { p.wall = true; p.setState('free'); }
    h.pos.set(0, 0, 0); h.yaw = 0; h.setState('free'); b.reset(0, 0.6); m.possess(h);
    const z0 = h.pos.z, used = m.useAbility ? m.useAbility(h, 0) : EGO.ABILITIES.flashStep.use(h, m);
    const proof = h.tackleProof > 0.3; G.stepManual(20);
    const step = { used, moved: +(h.pos.z - z0).toFixed(1), kept: m.ball.owner === h, proof };
    // awakened: WORLD STOP
    const opp = m.teams[1].filter((p) => !p.isGK); opp[0].pos.set(h.pos.x + 6, 0, h.pos.z); opp[1].pos.set(h.pos.x - 9, 0, h.pos.z + 3); if (opp[2]) opp[2].pos.set(h.pos.x, 0, h.pos.z + 30);
    h.setState('free'); m.activateAwaken(h); document.getElementById('awk').hidden = true; EGO.TimeCtl.reset(); h.setState('free');
    const r = m.awakenMove(h);
    return { step, ws: { r, frozen: opp.map((o) => o.state), burst: (h.fx.burst || 0) > 2 } };
  });
  check('FLASH STEP: about 6 blocks in a flash, the ball still yours, nobody can tackle you on the way', zen.step.used === true && zen.step.moved > 4.5 && zen.step.moved < 8.5 && zen.step.kept && zen.step.proof, zen.step);
  check('WORLD STOP (awakened ZENITH): everyone within 12 blocks freezes, you burst away; further off is not touched', zen.ws.r === true && zen.ws.frozen[0] === 'frozen' && zen.ws.frozen[1] === 'frozen' && (zen.ws.frozen[2] === undefined || zen.ws.frozen[2] !== 'frozen') && zen.ws.burst, zen.ws);

  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
