// The owner's admin panel: hidden for everyone else (even the old retired code), on the start screen it gives things,
// in the pause menu of a bot match it controls the match (score, clock, ball, freeze, speed, stamina, win, and the OP
// switches: god mode, giant, mega shot, homing shots, magnet, moon jump, no cooldowns, super moves, snap now), never online.
// The secret code is never typed here: the test marks the save as the game's own list says.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const vis = (id) => page.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.hidden && e.offsetParent !== null; }, id);
  const give = (retired) => page.evaluate((r) => { const C = EGO.CODES, h = Object.keys(C).find((k) => C[k].give === 'all' && !!C[k].retired === r); EGO.Save.data.codes = [h]; EGO.Save.save(); EGO.UI.renderLobby(); }, retired);

  check('a normal player sees no admin button', !(await vis('lob-admin')) && !(await page.evaluate(() => EGO.Admin.is())));
  await give(true);
  check('the old retired code does not open it', !(await vis('lob-admin')));
  await page.evaluate(() => { EGO.Save.data.codes = []; EGO.Save.save(); EGO.UI.renderLobby(); });
  await page.evaluate(() => EGO.Game.startMatch('ranked')); await page.evaluate(() => EGO.Game.stepManual(4)); await page.keyboard.press('KeyP'); await sleep(300);
  check('a normal player has no ADMIN button in the pause menu', !(await vis('p-admin')));
  await page.evaluate(() => EGO.Admin.open(true));
  check('and it cannot be opened by hand', await page.evaluate(() => document.getElementById('admin').hidden));
  await page.evaluate(() => { EGO.Game.forfeit(); EGO.Game.toLobby(); }); await sleep(300);

  await give(false);
  check('the owner sees ADMIN PANEL on the start screen', await vis('lob-admin'));
  await page.click('#lob-admin'); await sleep(200);
  const d0 = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, bp: EGO.Save.data.bp, lv: EGO.levelOf(EGO.Save.data.xp).level, rp: EGO.Save.data.rp }));
  for (const a of ['em', 'bp', 'xp', 'rp+', 'all']) { await page.click(`#adm-body [data-a="${a}"]`); await sleep(80); }
  const d1 = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, bp: EGO.Save.data.bp, lv: EGO.levelOf(EGO.Save.data.xp).level, rp: EGO.Save.data.rp, saved: JSON.parse(localStorage.getItem(EGO.Save.key)).emeralds }));
  check('it gives emeralds, blueprints, a level and rank, and saves them', d1.em === d0.em + 10000 && d1.bp === d0.bp + 100 && d1.lv === d0.lv + 1 && d1.rp === d0.rp + 100 && d1.saved === d1.em, { d0, d1 });
  for (const a of ['em2', 'bp2', 'xp10', 'rpmax', 'passmax']) { await page.click(`#adm-body [data-a="${a}"]`); await sleep(80); }
  const d2 = await page.evaluate(() => { const d = EGO.Save.data; return { em: d.emeralds, bp: d.bp, lv: EGO.levelOf(d.xp).level, rp: d.rp, got: d.pass.got, msg: document.getElementById('adm-msg').textContent }; });
  check('the big buttons: +1,000,000 emeralds, +1,000 blueprints, +10 levels, max rank, the whole game pass', d2.em >= d1.em + 1000000 && d2.bp === d1.bp + 1000 && d2.lv === d1.lv + 10 && d2.rp >= 500 && d2.got === 30, { d1, d2 });
  await page.screenshot({ path: __dirname + '/shots/admin1_lobby.png', timeout: 120000 }).catch(() => {});
  await page.click('#adm-close');

  await page.evaluate(() => EGO.Game.startMatch('ranked')); await page.evaluate(() => EGO.Game.stepManual(220)); // past the kickoff
  await page.keyboard.press('KeyP'); await sleep(300);
  check('the owner has ADMIN in the pause menu', await vis('p-admin'));
  await page.click('#p-admin'); await sleep(200);
  check('the admin panel opens over the pause menu', await vis('admin'));
  const c0 = await page.evaluate(() => ({ s: EGO.Game.match.score.slice(), t: EGO.Game.match.clock, me: EGO.Game.match.human.team }));
  for (const a of ['us+', 'us+', 'them+', 't+', 'freeze', 'fast', 'stam', 'ball']) { await page.click(`#adm-body [data-a="${a}"]`); await sleep(80); }
  await page.screenshot({ path: __dirname + '/shots/admin2_match.png', timeout: 120000 }).catch(() => {});
  const c1 = await page.evaluate(() => { const m = EGO.Game.match; return { s: m.score.slice(), t: m.clock, owner: m.ball.owner === m.human, msg: document.getElementById('adm-msg').textContent, spd: m.human.speedMul }; });
  check('score buttons change the score', c1.s[c0.me] === c0.s[c0.me] + 2 && c1.s[1 - c0.me] === c0.s[1 - c0.me] + 1, { c0, c1 });
  check('+30 SEC adds time', Math.abs(c1.t - c0.t - 30) < 0.5, { before: c0.t, after: c1.t });
  check('BALL TO ME gives you the ball (or says to wait for play)', c1.owner || /WAIT/.test(c1.msg), c1);
  check('SUPER SPEED makes you faster', c1.spd > 1.5, c1.spd);
  await page.click('#adm-close'); await page.click('#p-resume'); await sleep(100);
  await page.evaluate(() => { const m = EGO.Game.match; m.human.stamina = 5; EGO.Game.stepManual(20); });
  const c2 = await page.evaluate(() => { const m = EGO.Game.match; return { stam: m.human.stamina, frozen: m.phase === 'play' ? m.teams[1 - m.human.team].every((o) => o.state === 'frozen') : 'not in play: ' + m.phase }; });
  check('NEVER TIRED keeps stamina full', c2.stam >= 99, c2);
  check('FREEZE THEM freezes the other team in open play', c2.frozen === true || /not in play/.test(String(c2.frozen)), c2);
  await page.keyboard.press('KeyP'); await sleep(200); await page.click('#p-admin'); await sleep(100);
  await page.click('#adm-body [data-a="freeze"]'); await page.click('#adm-close'); await page.click('#p-resume');
  await page.evaluate(() => EGO.Game.stepManual(5));
  check('turning FREEZE off unfreezes them', await page.evaluate(() => { const m = EGO.Game.match; return m.teams[1 - m.human.team].every((o) => o.state !== 'frozen'); }));
  // the OP switches
  await page.keyboard.press('KeyP'); await sleep(200); await page.click('#p-admin'); await sleep(100);
  for (const a of ['god', 'giant', 'shot', 'homing', 'magnet', 'moon', 'nocd', 'clock']) { await page.click(`#adm-body [data-a="${a}"]`); await sleep(60); }
  const on = await page.evaluate(() => [...document.querySelectorAll('#adm-body [aria-pressed="true"]')].map((b) => b.dataset.a));
  await page.click('#adm-close'); await page.click('#p-resume');
  const op = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human;
    for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1);
    h.abil.forEach((a) => { a.cd = 9; }); h.flow = 0; const t0 = m.clock;
    G.stepManual(30);
    const jump = (() => { h.setState('free'); h.onGround = true; m.jump(h); return h.vel.y; })();
    return { proof: h.tackleProof > 0 && h.fx.bubble > 0, giant: h.fx.giant > 0, size: +h.P.root.scale.x.toFixed(2), shot: +h.mods.shot.toFixed(2), magnet: h.fx.magnet > 0, cd: h.abil.every((a) => a.cd === 0), flow: h.flow, clock: +(m.clock - t0).toFixed(2), jump: +jump.toFixed(1) };
  });
  check('GOD MODE, GIANT, MEGA SHOT, BALL MAGNET, MOON JUMP, NO COOLDOWNS and STOP THE CLOCK all switch on and work', on.length >= 8 && op.proof && op.giant && op.size > 1.3 && op.shot >= 2 && op.magnet && op.cd && op.flow === 100 && Math.abs(op.clock) < 0.05 && op.jump > 15, { on, op });
  await page.screenshot({ path: __dirname + '/shots/admin3_giant.png', timeout: 120000 }).catch(() => {});
  const homing = await page.evaluate(() => { // a shot aimed at the corner flag still flies into the net
    const G = EGO.Game, m = G.match, h = m.human, gz = m.oppGoalZ(h.team);
    for (let i = 0; i < 600 && m.phase !== 'play'; i++) G.stepManual(1);
    h.pos.set(8, 0, gz * 0.55); h.vel.set(0, 0, 0); h.setState('free'); m.ball.reset(h.pos.x, h.pos.z); m.possess(h, true);
    const s0 = m.score[h.team];
    m.shootAt(h, { x: 25, y: 0.5, z: gz }, 0.8);
    for (let i = 0; i < 240 && m.phase === 'play'; i++) G.stepManual(1);
    return { phase: m.phase, goal: m.score[h.team] === s0 + 1 };
  });
  check('HOMING SHOTS: a shot aimed at the corner flag flies itself into the goal', homing.goal, homing);
  await page.keyboard.press('KeyP'); await sleep(200); await page.click('#p-admin'); await sleep(100);
  await page.evaluate(() => { const G = EGO.Game, m = G.match; for (let i = 0; i < 900 && m.phase !== 'play'; i++) { G.resume(); G.stepManual(1); } G.pause && G.state === 'match' && G.pause(); });
  const g0 = await page.evaluate(() => { const m = EGO.Game.match; return { s: m.score[m.human.team], ph: m.phase, st: EGO.Game.state }; });
  if (!(await vis('admin'))) { await page.evaluate(() => EGO.Admin.open(true)); await sleep(100); }
  await page.click('#adm-body [data-a="goal"]'); await sleep(100);
  const g1 = await page.evaluate(() => { const m = EGO.Game.match; return { s: m.score[m.human.team], ph: m.phase, st: EGO.Game.state, pose: m.human.state }; });
  check('SCORE A GOAL NOW: a real goal for you, with the celebration, straight back in the match', g1.s === g0.s + 1 && g1.ph === 'goal' && g1.st === 'match' && /celebrate|emote/.test(g1.pose), { g0, g1 });
  const flat = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human;
    for (let i = 0; i < 900 && m.phase !== 'play'; i++) G.stepManual(1);
    EGO.Admin.act('flat');
    return m.opponents(h).filter((o) => !o.isGK).every((o) => o.state === 'down');
  });
  check('KNOCK THEM ALL DOWN knocks over the whole other team', flat, flat);
  const cannon = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human;
    for (let i = 0; i < 900 && m.phase !== 'play'; i++) G.stepManual(1);
    if (m.ball.owner === h) m.ball.release(); m.ball.reset(20, 20);
    EGO.Admin.act('mv2'); G.stepManual(3);
    return { by: !!(m.ball.kick && m.ball.kick.by === h), sp: +Math.hypot(m.ball.vel.x, m.ball.vel.z).toFixed(1), left: m.adm.move };
  });
  check('SUPER MOVES: CANNON brings the ball to you and fires it', cannon.by && cannon.sp > 30 && cannon.left == null, cannon);
  await sleep(1500); // its comic cut-in is on screen for a moment
  await page.keyboard.press('KeyP'); await sleep(200); await page.click('#p-admin'); await sleep(100);
  await page.evaluate(() => { const m = EGO.Game.match; m.score[m.human.team] = 0; m.score[1 - m.human.team] = 3; });
  await page.click('#adm-body [data-a="win"]'); await sleep(100);
  await page.evaluate(() => EGO.Game.stepManual(260));
  const r = await page.evaluate(() => ({ state: EGO.Game.state, res: EGO.Game.match && EGO.Game.match.result && EGO.Game.match.result.res, admin: document.getElementById('admin').hidden }));
  check('WIN NOW ends the match as a win', r.res === 'win' && r.state === 'results' && r.admin, r);
  // OMEGA CORES: take their best core, then SNAP NOW
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Game.startMatch('heist'); EGO.Game.stepManual(220); });
  await page.keyboard.press('KeyP'); await sleep(300); await page.click('#p-admin'); await sleep(100);
  const hz = await page.evaluate(() => { const G = EGO.Game, m = G.match; for (let i = 0; i < 900 && m.phase !== 'play'; i++) { G.resume(); G.stepManual(1); } if (G.state === 'match') G.pause(); return m.phase; });
  if (!(await vis('admin'))) { await page.evaluate(() => EGO.Admin.open(true)); await sleep(100); }
  const hasCores = await page.evaluate(() => !!document.querySelector('#adm-body [data-a="snap"]'));
  await page.click('#adm-body [data-a="steal"]'); await sleep(100);
  const st = await page.evaluate(() => { const m = EGO.Game.match, me = m.human.team; return { mine: m.heist.v[me].length, theirs: m.heist.v[1 - me].length, pow: m.human.corePow }; });
  check('OMEGA CORES: TAKE THEIR BEST CORE gives you their Mythic and its power', hasCores && hz === 'play' && st.mine === 5 && st.theirs === 3 && st.pow === 3, { hz, hasCores, st });
  await page.keyboard.press('KeyP'); await sleep(200); await page.click('#p-admin'); await sleep(100);
  await page.click('#adm-body [data-a="snap"]'); await sleep(100);
  await page.evaluate(() => EGO.Game.stepManual(10));
  const sn = await page.evaluate(() => { const m = EGO.Game.match, h = m.human; return { phase: m.phase, pose: h.state + ':' + h.emote, theirs: m.heist.v[1 - h.team].length }; });
  check('SNAP NOW: every core is yours and you do the OMEGA SNAP', sn.phase === 'end' && sn.pose === 'emote:snap' && sn.theirs === 0, sn);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
