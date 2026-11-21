// You in goal: the intro's position picker has KEEPER too. Picking it swaps you with the computer keeper (their kit,
// gloves and number 1 come with the job). Keeper styles (FORTRESS, LYNX) are normal styles from spins whose powers work in
// goal; in goal any other style's moves work too. JUMP with A or D dives that way, C dives too; pressed early it goes at
// once as a slower, floatier dive (very early: a moment's wait), so you are still in the air when the ball gets there. Nobody moves you (keepers can come off their line). The ball in your
// hands goes to a teammate by itself if you hold it too long, and outside your box your ball can be taken like anyone's.
// The next match remembers it; No Keepers, free kicks and the tutorial never put you in goal.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  await page.evaluate(() => {
    EGO.Game.toLobby(); EGO.Game.introTest = true; EGO.Save.data.pos = null;
    const d = EGO.Save.data; d.styles.push('FORTRESS', 'LYNX'); d.style = 'FORTRESS'; // a keeper style, from a spin
    // a shot at your goal: from 15 out to (tx, at the line), `T` seconds of flight, starting at height y0
    window.__shoot = (tx, T, y0 = 0.6) => {
      const m = EGO.Game.match, h = m.human, b = m.ball, them = m.teams[1].find((p) => !p.isGK), gz = m.ownGoalZ(0);
      for (const p of m.players) if (p !== h) { p.wall = true; p.setState('free'); p.pos.set(p.pos.x, 0, 10); }
      if (b.owner) b.release();
      m.phase = 'play'; m.phaseT = 0; m.pendingEnd = false; // straight on after a goal
      h.pos.set(0, 0, gz + 1.2); h.vel.set(0, 0, 0); h.setState('free'); h.diveAt = -9; h.diveQ = null; h.dive = null;
      b.reset(-1, gz + 15); b.pos.y = y0; b.vel.set((tx + 1) / T, 2.2, -15 / T);
      b.kick = { by: them, type: 'shot', t: m.time };
    };
    window.__key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
    // step until something happens: did you dive, was it saved, did it go in
    window.__watch = (frames) => { const m = EGO.Game.match, h = m.human; let dived = false, side = 0; const s0 = m.score[1], v0 = h.stats.saves; for (let i = 0; i < frames; i++) { EGO.Game.stepManual(1); if (h.state === 'dive' && !dived) { dived = true; side = Math.sign(h.dive.vx); } } return { dived, side, saved: h.stats.saves > v0, goal: m.score[1] > s0, state: h.state }; };
  });
  await page.click('#go-quick'); await page.waitForTimeout(300);

  const roles = await page.evaluate(() => [...document.querySelectorAll('#in-roles .in-role')].map((b) => b.dataset.r));
  check('Quick Match: keeper, defender, midfielder, striker (the keeper first)', roles.join(',') === 'GK,DEF,MID,ST', roles);
  const first = await page.evaluate(() => ({ role: EGO.Game.match.human.role, style: EGO.Game.match.human.styleId }));
  check('a keeper style with no position picked yet starts you in goal', first.role === 'GK' && first.style === 'FORTRESS', first);
  await page.evaluate(() => EGO.Game.pickRole('ST'));
  const before = await page.evaluate(() => { const m = EGO.Game.match, g = m.keeperOf(0); return { gk: g.name, tex: m.human.skinTex.uuid, num: m.human.number, style: m.human.styleId }; });
  await page.evaluate(() => EGO.Game.pickRole('GK'));
  const sw = await page.evaluate((b) => {
    const m = EGO.Game.match, h = m.human, old = m.teams[0].find((p) => p.name === b.gk);
    return { me: h.role, gk: h.isGK, num: h.number, keeper: m.keeperOf(0) === h, oldRole: old.role, oldGK: old.isGK, oldNum: old.number, repainted: h.skinTex.uuid !== b.tex, saved: EGO.Save.data.pos, keepers: m.teams[0].filter((p) => p.isGK).length, style: h.styleId, abil: h.abil.map((a) => a.id), slot: document.querySelector('#slot0 .nm').textContent };
  }, before);
  check('picking KEEPER puts you in goal (number 1, a new kit) and the old keeper takes your spot', sw.me === 'GK' && sw.gk && sw.num === 1 && sw.keeper && sw.oldRole === 'ST' && !sw.oldGK && sw.oldNum === before.num && sw.repainted && sw.keepers === 1 && sw.saved === 'GK', sw);
  check('FORTRESS (a keeper style) in goal: its three powers in the power slots', sw.style === 'FORTRESS' && sw.abil.join(',') === 'bigGloves,ironHands,cannonKick' && sw.slot === 'GIANT GLOVES', sw);
  await page.evaluate(() => EGO.Game.stepManual(260));
  await shot('keeper1_intro');
  const nets = await page.evaluate(() => { const m = EGO.Game.match, c = EGO.World.camera.position, h = m.human; return { camZ: +c.z.toFixed(1), line: +m.ownGoalZ(0).toFixed(1), camY: +c.y.toFixed(1), me: +h.pos.y.toFixed(1), net: +EGO.World.nets.find((n) => n.s < 0).mat.opacity.toFixed(2) }; });
  check('in goal the camera stays in front of your goal line, over your shoulder (the posts and bar never hide the top corners)', nets.camZ > nets.line + 0.2 && nets.camY > nets.me + 2.5 && nets.net > 0.95, nets);
  await page.click('#in-go'); await page.waitForTimeout(150);
  await page.evaluate(() => EGO.Game.stepManual(200));
  const st = await page.evaluate(() => { const m = EGO.Game.match, h = m.human; return { phase: m.phase, z: +h.pos.z.toFixed(1), box: m.inOwnBox(h), chat: !document.getElementById('hud-chat').hidden }; });
  check('after the kickoff you stand in your goal', st.phase === 'play' && st.box && st.z < -25, st);
  check('no CHAT button in a bot match (it is for online)', !st.chat, st.chat);

  // nobody moves you: hands off the stick and you stay put, even with the ball far off to one side
  const still = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball;
    for (const p of m.players) if (p !== h) p.wall = true;
    if (b.owner) b.release();
    b.reset(14, -10); b.vel.set(0, 0, 0);
    h.pos.set(0, 0, h.pos.z); h.vel.set(0, 0, 0);
    EGO.Game.stepManual(150);
    return { x: +h.pos.x.toFixed(2) };
  });
  check('hands off the stick, nobody moves you (keepers can play off their line)', Math.abs(still.x) < 0.2, still);

  // JUMP with D held dives right (to the world's -x as the camera looks up the pitch) at a shot going that way
  const jd = await page.evaluate(() => { __shoot(-3.6, 0.6); EGO.Game.stepManual(8); __key('KeyD', true); __key('Space', true); EGO.Game.stepManual(1); __key('Space', false); const r = __watch(70); __key('KeyD', false); return r; });
  check('JUMP with D held dives that way and saves', jd.dived && jd.side === -1 && jd.saved && !jd.goal, jd);
  const ja = await page.evaluate(() => { __shoot(3.6, 0.6); EGO.Game.stepManual(8); __key('KeyA', true); __key('Space', true); EGO.Game.stepManual(1); __key('Space', false); const r = __watch(70); __key('KeyA', false); return r; });
  check('JUMP with A held dives the other way and saves', ja.dived && ja.side === 1 && ja.saved && !ja.goal, ja);
  // real key presses, no shot coming: the order does not matter (owner: "the jump side to side is not there")
  const realKeys = async (first, second, gap = 4) => {
    await page.evaluate(() => { const m = EGO.Game.match, h = m.human, b = m.ball; m.phase = 'play'; m.phaseT = 0; if (b.owner) b.release(); b.reset(10, 0); b.vel.set(0, 0, 0); b.kick = null; h.setState('free'); h.dive = null; h.diveAt = -9; h.diveQ = null; h.pos.set(0, 0, m.ownGoalZ(0) + 1.2); h.vel.set(0, 0, 0); h.onGround = true; });
    await page.keyboard.down(first); await page.evaluate((g) => EGO.Game.stepManual(g), gap);
    await page.keyboard.down(second); await page.evaluate(() => EGO.Game.stepManual(4));
    const r = await page.evaluate(() => { const h = EGO.Game.match.human; return { state: h.state, side: h.dive ? Math.sign(h.dive.vx) : 0, fwd: !!(h.dive && h.dive.fwd), air: !h.onGround }; });
    await page.keyboard.up(second); await page.keyboard.up(first); await page.evaluate(() => EGO.Game.stepManual(80));
    return r;
  };
  const dFirst = await realKeys('KeyD', 'Space'), spaceFirst = await realKeys('Space', 'KeyD'), aSpace = await realKeys('Space', 'KeyA');
  check('real keys: D then SPACE, SPACE then D, SPACE then A all dive the right way', dFirst.state === 'dive' && dFirst.side === -1 && spaceFirst.state === 'dive' && spaceFirst.side === -1 && aSpace.state === 'dive' && aSpace.side === 1, { dFirst, spaceFirst, aSpace });
  const late = await realKeys('Space', 'KeyD', 24), fwd = await realKeys('Space', 'KeyW', 12);
  check('in the air, later in the jump, D still dives; W dives forward (owner: "jump, then A or D in the air ... you can dive forward")', late.state === 'dive' && late.side === -1 && fwd.state === 'dive' && fwd.fwd, { late, fwd });
  // C, pressed early at a high shot: you wait, shuffle across, and are still in the air when it arrives
  const early = await page.evaluate(() => { __shoot(-3.4, 1.0, 1.8); EGO.Game.stepManual(4); __key('KeyC', true); EGO.Game.stepManual(1); __key('KeyC', false); const h = EGO.Game.match.human, waited = h.state === 'free' && !!h.diveQ; const r = __watch(90); return Object.assign(r, { waited }); });
  check("C pressed very early at a high shot: a moment's wait, then the dive saves it", early.waited && early.dived && !early.goal, early);
  const soon = await page.evaluate(() => { __shoot(-3.4, 0.9, 1.8); EGO.Game.stepManual(18); __key('KeyC', true); EGO.Game.stepManual(1); __key('KeyC', false); const h = EGO.Game.match.human, now = h.state === 'dive', slow = h.dive ? +h.dive.dur.toFixed(2) : 0; const r = __watch(80); return Object.assign(r, { now, slow }); });
  check('pressed a little early, the dive goes at once (slower, still stretched out when it arrives) and saves', soon.now && soon.slow > 0.42 && !soon.goal, soon);
  const none = await page.evaluate(() => { __shoot(-3.6, 0.95); return __watch(80); });
  check('without a dive the same kind of shot goes in (the saves are yours)', none.goal && !none.dived, none);

  // FORTRESS powers
  const iron = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human;
    __shoot(0, 0.42, 1.0); // a rocket straight at you: too hard to hold
    const r1 = __watch(50); r1.held = m.ball.owner === h;
    __shoot(0, 0.42, 1.0); h.abil[1].cd = 0; const used = m.useAbility(h, 1);
    const r2 = __watch(50);
    return { normal: r1, used, held: m.ball.owner === h, state: h.state };
  });
  check('IRON HANDS: a shot too hard to hold is caught', iron.used === true && iron.held, iron);
  const cannon = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human;
    for (const p of m.players) if (p !== h) p.wall = false;
    const stP = m.teams[0].find((p) => p.role === 'ST'); stP.pos.set(2, 0, 20);
    h.abil[2].cd = 0; const used = m.useAbility(h, 2), k = m.ball.kick;
    return { used, to: k && k.to ? k.to.role : null, owner: !!m.ball.owner };
  });
  check('CANNON KICK: from your hands to the teammate furthest up the pitch', cannon.used === true && cannon.to === 'ST' && !cannon.owner, cannon);
  const gloves = await page.evaluate(() => { const m = EGO.Game.match, h = m.human; h.abil[0].cd = 0; h.setState('free'); m.ball.release(); m.ball.reset(5, 0); return { used: m.useAbility(h, 0), fx: h.fx.gloves }; });
  check('GIANT GLOVES switches on for 6 seconds', gloves.used === true && gloves.fx > 5, gloves);

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
  const safe = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball;
    if (b.owner) b.release();
    h.setState('free'); h.pos.set(0, 0, 0); b.reset(0, 0.3); m.possess(h);
    const out = m.safeGK(h);
    h.pos.set(0, 0, m.ownGoalZ(0) + 4); m.possess(h);
    return { out, inBox: m.safeGK(h) };
  });
  check('your ball is only safe inside your own box', !safe.out && safe.inBox, safe);
  await shot('keeper2_play');

  // LYNX (blueprints): CAT LEAP reaches much further than a dive, SLOW SHOT slows a shot in your box, QUICK THROW
  const lynx = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data, out = {};
    d.style = 'LYNX';
    G.toLobby(); G.introTest = false; G.startMatch('quick'); const m = G.match, h = m.human;
    out.style = h.styleId; out.abil = h.abil.map((a) => a.id);
    m.phase = 'play'; for (const p of m.players) if (p !== h) p.wall = true;
    __shoot(-4.3, 0.7); h.pos.x = 2.5; G.stepManual(10); h.abil[0].cd = 0;
    out.leap = m.useAbility(h, 0); out.vx = h.dive ? +h.dive.vx.toFixed(1) : 0; out.big = !!(h.dive && h.dive.big);
    const r = __watch(60); out.leapSaved = r.saved && !r.goal;
    __shoot(0, 0.6); h.abil[1].cd = 0; out.slowUsed = m.useAbility(h, 1); const v0 = m.ball.vel.length(); G.stepManual(25); out.slowed = !!(m.ball.kick && m.ball.kick.slowed) || m.ball.owner === h; out.v = [+v0.toFixed(1), +m.ball.vel.length().toFixed(1)];
    if (m.ball.owner !== h) { m.ball.release(); m.ball.reset(h.pos.x, h.pos.z + 0.3); m.possess(h); }
    for (const p of m.players) p.wall = false;
    h.abil[2].cd = 0; out.throwUsed = m.useAbility(h, 2); out.thrown = m.ball.owner !== h && !!m.ball.kick && m.ball.kick.type === 'pass';
    return out;
  });
  check('LYNX in goal: its three powers', lynx.style === 'LYNX' && lynx.abil.join(',') === 'catLeap,slowShot,quickThrow', lynx);
  check('CAT LEAP: a huge dive that reaches a shot a normal dive cannot', lynx.leap === true && lynx.big && Math.abs(lynx.vx) > 12 && lynx.leapSaved, lynx);
  check('SLOW SHOT and QUICK THROW work', lynx.slowUsed === true && lynx.slowed && lynx.throwUsed === true && lynx.thrown, lynx);

  // any style in goal: its own moves work there too
  const rookie = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; d.style = 'ROOKIE'; G.toLobby(); G.startMatch('quick'); const m = G.match, h = m.human;
    m.phase = 'play'; h.setState('free'); h.abil[2].cd = 0; const used = m.useAbility(h, 2);
    return { gk: h.isGK, style: h.styleId, abil: h.abil.map((a) => a.id), used, fx: +(h.fx.burst || 0).toFixed(1) };
  });
  check("in goal with any style you keep its moves (ROOKIE's BURST works)", rookie.gk && rookie.style === 'ROOKIE' && rookie.used === true && rookie.fx > 0, rookie);
  // keeper styles come from spins like any style, never for bots; the Locker shows them in STYLES; every card has its own face
  const lk = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; G.toLobby(); d.look.color = Object.keys(EGO.SKINS).find((k) => EGO.SKINS[k].slot === 'color' && !EGO.SKINS[k].base) || d.look.color;
    const pools = { rare: EGO.poolFor('style', 0).includes('FORTRESS'), epic: EGO.poolFor('style', 1).includes('LYNX') };
    let botGK = 0; for (let i = 0; i < 400; i++) if (EGO.STYLES[EGO.botStyle()].gk) botGK++;
    EGO.UI.openLocker();
    const cards = [...document.querySelectorAll('#locker-grid .lcard')];
    const label = (id) => { const c = cards.find((x) => x.dataset.id === id); return c ? c.querySelector('.meta .label').textContent : null; };
    const art = cards.map((c) => c.querySelector('canvas').toDataURL());
    document.querySelector('#locker-grid [data-id="FORTRESS"]').click();
    return { pools, botGK, fortress: label('FORTRESS'), lynx: label('LYNX'), n: cards.length, unique: new Set(art).size, detail: document.getElementById('locker-detail').textContent.slice(0, 80), tabs: [...document.querySelectorAll('.lk-side .tabs .tab')].map((t) => t.textContent).join(',') };
  });
  check('keeper styles come from style spins, and bots never get them', lk.pools.rare && lk.pools.epic && lk.botGK === 0, lk);
  check('the Locker lists them with the other styles, marked KEEPER (no separate tab)', /^KEEPER · /.test(lk.fortress) && /^KEEPER · /.test(lk.lynx) && /KEEPER STYLE/.test(lk.detail) && !/KEEPERS/.test(lk.tabs), lk);
  check('every character card has its own face (not all your look)', lk.unique === lk.n, { cards: lk.n, different: lk.unique });
  await page.waitForTimeout(400); await shot('keeper3_locker');

  // the next match remembers; No Keepers, free kicks and the tutorial do not put you in goal
  const next = await page.evaluate(() => {
    const G = EGO.Game, out = {};
    G.toLobby(); G.introTest = false; G.startMatch('quick'); out.quick = { gk: G.match.human.isGK, num: G.match.human.number, keepers: G.match.teams[0].filter((p) => p.isGK).length, style: G.match.human.styleId };
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
    const G = EGO.Game; EGO.Touch.on = true; G.startMatch('quick'); G.stepManual(5);
    EGO.Touch.visible = true; EGO.Touch.update(G.match, 0.016);
    const el = document.querySelector('#touch [data-act="dt"] .lb');
    const T = EGO.Touch; T.setCd('ab0', 0.003, ''); T.setCd('ab0', 0, ''); const sliver = T.b.ab0.style.getPropertyValue('--p');
    const t = el ? el.textContent : null; EGO.Touch.on = false; G.toLobby(); return { t, sliver };
  });
  check('on a phone the button says DIVE when you are in goal', lbl.t === 'DIVE', lbl);
  check('a power that is ready shows no cooldown sliver on the phone buttons', lbl.sliver === '0deg', lbl);
  const touch = await page.evaluate(() => { const T = EGO.Touch, was = T.on; window.dispatchEvent(new TouchEvent('touchstart', { bubbles: true })); const now = T.on; T.setOn(false); return { was, now }; });
  check('a phone that did not say so gets the touch buttons at its first touch', !touch.was && touch.now, touch);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
