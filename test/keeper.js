// You in goal: the intro's position picker has KEEPER too. Picking it swaps you with the computer keeper (their kit,
// gloves and number 1 come with the job), C dives (at a shot, to where the ball is going), letting go of the stick
// walks you to the keeper's spot, the ball in your hands goes to a teammate by itself if you hold it too long, and
// outside your box your ball can be taken like anyone's. The next match remembers it; No Keepers, free kicks and the
// tutorial never put you in goal.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Game.introTest = true; EGO.Save.data.pos = null; });
  await page.click('#go-quick'); await page.waitForTimeout(300);

  const roles = await page.evaluate(() => [...document.querySelectorAll('#in-roles .in-role')].map((b) => b.dataset.r));
  check('the picker has the keeper spot too, at the back (first)', roles[0] === 'GK' && roles.length === 4, roles);
  const before = await page.evaluate(() => { const m = EGO.Game.match, g = m.keeperOf(0); return { gk: g.name, tex: m.human.skinTex.uuid, num: m.human.number }; });
  await page.evaluate(() => EGO.Game.pickRole('GK'));
  const sw = await page.evaluate((b) => {
    const m = EGO.Game.match, h = m.human, old = m.teams[0].find((p) => p.name === b.gk);
    return { me: h.role, gk: h.isGK, num: h.number, keeper: m.keeperOf(0) === h, oldRole: old.role, oldGK: old.isGK, oldNum: old.number, repainted: h.skinTex.uuid !== b.tex, saved: EGO.Save.data.pos, keepers: m.teams[0].filter((p) => p.isGK).length };
  }, before);
  check('picking KEEPER puts you in goal (number 1, a new kit) and the old keeper takes your spot', sw.me === 'GK' && sw.gk && sw.num === 1 && sw.keeper && sw.oldRole !== 'GK' && !sw.oldGK && sw.oldNum === before.num && sw.repainted && sw.keepers === 1 && sw.saved === 'GK', sw);
  await page.evaluate(() => EGO.Game.stepManual(260)); // the flight ends, the camera sits behind you
  await shot('keeper1_intro');
  const nets = await page.evaluate(() => ({ mine: EGO.World.nets.find((n) => n.s < 0).grp.visible, theirs: EGO.World.nets.find((n) => n.s > 0).grp.visible, camZ: +EGO.World.camera.position.z.toFixed(1) }));
  check('the camera behind your goal: your net goes see-through (theirs stays)', !nets.mine && nets.theirs, nets);
  await page.click('#in-go'); await page.waitForTimeout(150);
  await page.evaluate(() => EGO.Game.stepManual(200)); // the kickoff
  const st = await page.evaluate(() => { const m = EGO.Game.match, h = m.human; return { phase: m.phase, z: +h.pos.z.toFixed(1), x: +h.pos.x.toFixed(1), L: 0, box: m.inOwnBox(h), cam: +EGO.World.camera.position.z.toFixed(1) }; });
  check('after the kickoff you stand in your goal', st.phase === 'play' && st.box && st.z < -25, st);

  // hands off the stick: you walk to the keeper's spot (in front of the ball)
  const spot = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball;
    for (const p of m.players) if (p !== h) p.wall = true; // everyone else stands still
    if (b.owner) b.release();
    b.reset(14, -10); b.vel.set(0, 0, 0);
    h.pos.set(0, 0, h.pos.z);
    EGO.Game.stepManual(150);
    const want = EGO.AI.keeperSpot(m, h);
    return { x: +h.pos.x.toFixed(2), want: +want.x.toFixed(2) };
  });
  check('let go of the stick and you step across to the keeper\'s spot', spot.want > 2 && Math.abs(spot.x - spot.want) < 0.8, spot);

  // a shot at the far corner: C dives to it and saves
  const save = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball, them = m.teams[1].find((p) => !p.isGK), gz = m.ownGoalZ(0);
    h.pos.set(0, 0, gz + 1.2); h.vel.set(0, 0, 0); h.setState('free'); h.diveAt = -9;
    b.reset(-3, gz + 15); b.pos.y = 0.6;
    const tx = -3.6, tz = gz, T = 0.95; // into the bottom corner, at a speed a keeper can hold
    b.vel.set((tx + 3) / T, 2.2, (tz - b.pos.z) / T);
    b.kick = { by: them, type: 'shot', t: m.time };
    EGO.Game.stepManual(14); // the shot is on its way
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c' }));
    EGO.Game.stepManual(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC', key: 'c' }));
    const dived = h.state === 'dive', side = h.dive ? Math.sign(h.dive.vx) : 0;
    EGO.Game.stepManual(80);
    return { dived, side, saves: h.stats.saves, owner: b.owner === h, score: m.score.slice(), state: h.state };
  });
  check('C dives towards a shot coming in', save.dived && save.side === -1, save);
  check('and the dive saves it (no goal)', save.saves >= 1 && save.score[1] === 0, save);

  // the ball in your hands: held too long, it goes to a teammate by itself
  const hold = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball, gz = m.ownGoalZ(0);
    for (const p of m.players) p.wall = false;
    if (b.owner) b.release();
    h.setState('free'); h.pos.set(0, 0, gz + 3); b.reset(0, gz + 3.3); m.possess(h);
    const held = h.state === 'hold' && b.held;
    EGO.Game.stepManual(60 * 7);
    return { held, after: b.owner === h, state: h.state };
  });
  check('a catch in your box is in your hands, and held too long it goes to a teammate', hold.held && !hold.after && hold.state !== 'hold', hold);

  // outside the box your ball is anyone's
  const safe = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball;
    if (b.owner) b.release();
    h.setState('free'); h.pos.set(0, 0, 0); b.reset(0, 0.3); m.possess(h);
    const out = m.safeGK(h);
    h.pos.set(0, 0, m.ownGoalZ(0) + 4); m.possess(h);
    const inBox = m.safeGK(h);
    return { out, inBox };
  });
  check('your ball is only safe inside your own box', !safe.out && safe.inBox, safe);
  await shot('keeper2_play');
  // the same shot with no dive goes in: the saves are yours to make
  const nodive = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball, them = m.teams[1].find((p) => !p.isGK), gz = m.ownGoalZ(0);
    for (const p of m.players) if (p !== h) { p.wall = true; p.setState('free'); p.pos.set(p.pos.x, 0, 10); }
    if (b.owner) b.release();
    h.setState('free'); h.pos.set(0, 0, gz + 1.2); h.vel.set(0, 0, 0);
    b.reset(-3, gz + 15); b.pos.y = 0.6; b.vel.set(-0.6 / 0.95, 2.2, -15 / 0.95);
    b.kick = { by: them, type: 'shot', t: m.time };
    EGO.Game.stepManual(80);
    return { score: m.score.slice(), saves: h.stats.saves };
  });
  check('without a dive the same shot goes in', nodive.score[1] === 1, nodive);

  // the next match remembers; No Keepers, free kicks and the tutorial do not put you in goal
  const next = await page.evaluate(() => {
    const G = EGO.Game, out = {};
    G.toLobby(); G.startMatch('quick'); out.quick = { gk: G.match.human.isGK, num: G.match.human.number, keepers: G.match.teams[0].filter((p) => p.isGK).length };
    G.stopIntro();
    G.toLobby(); G.startMatch('nokeep'); out.nokeep = G.match.human.isGK || G.match.human.role === 'GK';
    G.toLobby(); G.startMatch('freekick'); out.fk = G.match.human.isGK;
    G.toLobby(); G.startMatch('tutorial'); out.tut = G.match.human.isGK;
    G.toLobby();
    return out;
  });
  check('the next match puts you in goal again', next.quick.gk && next.quick.num === 1 && next.quick.keepers === 1, next.quick);
  check('No Keepers, free kicks and the tutorial never put you in goal', !next.nokeep && !next.fk && !next.tut, next);

  // a phone: the button says DIVE
  const lbl = await page.evaluate(() => {
    const G = EGO.Game; EGO.Touch.on = true; G.introTest = false; G.startMatch('quick'); G.stepManual(5);
    EGO.Touch.visible = true; EGO.Touch.update(G.match, 0.016);
    const el = document.querySelector('#touch [data-act="dt"] .lb') || document.querySelector('#touch .dt .lb');
    const t = el ? el.textContent : null; EGO.Touch.on = false; G.toLobby(); return t;
  });
  check('on a phone the button says DIVE when you are in goal', lbl === 'DIVE', lbl);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
