// Free game pass: 30 tiers, pass XP only from doing things, 4 weekly challenges, looks-only rewards,
// seasons of 8 weeks that reset the track but keep what you earned.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const base = await page.evaluate(() => {
    const W = 7 * 864e5, T0 = Date.UTC(2026, 9, 26);
    const s0 = EGO.seasonAt(T0 + 1000), s7 = EGO.seasonAt(T0 + 7 * W + 1000), s8 = EGO.seasonAt(T0 + 8 * W + 1000);
    const classic = EGO.weekChallenges(4), other = EGO.weekChallenges(5);
    const xp = { idle: EGO.passXp('loss', { touches: 1 }), busy: EGO.passXp('win', { touches: 12, passes: 6, shots: 3, onTarget: 2, goals: 1, assists: 1, tackles: 2 }), forfeit: EGO.passXp('forfeit', { touches: 20, goals: 3 }), capped: EGO.passXp('win', { touches: 50, goals: 9, assists: 5 }) };
    return { s0, s7, s8, classic, other, rewards: EGO.PASS_REWARDS.length, xp };
  });
  check('seasons are 8 weeks long', base.s0.season === 1 && base.s7.season === 1 && base.s8.season === 2, [base.s0.season, base.s7.season, base.s8.season]);
  check('weekly challenges: the classic four, other weeks four different ones', base.classic.join() === 'curler,tackles,cleanSheet,diamond' && new Set(base.other).size === 4, { classic: base.classic, other: base.other });
  check('30 tiers of rewards', base.rewards === 30, base.rewards);
  check('standing around earns no pass XP, forfeits earn none', base.xp.idle === 0 && base.xp.forfeit === 0, base.xp);
  check('playing well earns pass XP (and one match is capped)', base.xp.busy === 60 + 40 + 30 + 30 + 30 + 60 && base.xp.capped === 400, base.xp);

  // a match in a classic week: curler goal, clean sheet, tackles; tiers pay out
  const run = await page.evaluate(() => {
    const realNow = Date.now, W = 7 * 864e5, T = Date.UTC(2026, 9, 26) + 4 * W + 3600e3; Date.now = () => T;
    try {
      const d = EGO.Save.data; EGO.Pass.sync(d);
      const em0 = d.emeralds, G = EGO.Game;
      G.startMatch('quick'); G.manual = true; G.stepManual(170, false);
      const m = G.match, h = m.human;
      // a curled shot from the edge of the box goes in
      m.phase = 'play'; m.ball.owner = null; m.possess(h, true); h.pos.set(4, 0, 22);
      m.shootAt(h, new THREE.Vector3(2, 1, 38.5), 0.8, { curveIn: 0.7 });
      m.onGoal(1);
      h.stats.tackles = 5; h.stats.passes = 8; h.stats.onTarget = 2; h.stats.touches = 15;
      m.score = [1, 0]; m.clock = 0.1; for (let i = 0; i < 60 * 20 && G.state !== "results"; i++) G.stepManual(1, false);
      const P = d.pass;
      return { state: G.state, xp: P.xp, done: P.done.slice(), prog: Object.assign({}, P.prog), tier: EGO.Pass.tier(d), got: P.got, emDelta: d.emeralds - em0, skins: d.skins.slice(), line: document.getElementById('r-pass').textContent };
    } finally { Date.now = realNow; }
  });
  check('a curler goal, a clean sheet and 5 tackles complete three challenges', ['curler', 'cleanSheet', 'tackles'].every((c) => run.done.includes(c)) && !run.done.includes('diamond'), run.done);
  check('challenge XP plus match XP reaches tier 1 and pays its reward', run.xp >= 1400 && run.tier >= 1 && run.got === run.tier && /CHALLENGE DONE/.test(run.line) && /TIER 1: 100 EMERALDS/.test(run.line), { xp: run.xp, tier: run.tier, line: run.line });
  await page.screenshot({ path: __dirname + '/shots/gp1_results.png' });

  // tier 2 is a skin; a skin you already own turns into emeralds; the next season resets the track but keeps the skins
  const later = await page.evaluate(() => {
    const realNow = Date.now, W = 7 * 864e5, T = Date.UTC(2026, 9, 26) + 4 * W + 7200e3; Date.now = () => T;
    try {
      const d = EGO.Save.data, P = EGO.Pass;
      d.pass.xp = 1999; const r1 = P.award(d, { feats: {}, score: [0, 0], human: null, cfg: {}, mode: 'quick' }, 'draw', { touches: 5, passes: 1 });
      const hasChalk = d.skins.includes('CHALK');
      d.skins.push('WHITE_BAND'); d.pass.xp = 3999; const em = d.emeralds; const r2 = P.award(d, { feats: {}, score: [0, 0], human: null, cfg: {}, mode: 'quick' }, 'draw', { touches: 5, passes: 1 });
      Date.now = () => T + 8 * W;
      P.sync(d);
      return { r1: r1.tiers, hasChalk, r2: r2.tiers, emBack: d.emeralds - em, newSeason: { season: d.pass.season, xp: d.pass.xp, got: d.pass.got, done: d.pass.done.length }, kept: d.skins.includes('CHALK') };
    } finally { Date.now = realNow; }
  });
  check('tier 2 gives a skin', later.hasChalk && later.r1.some((t) => /TIER 2: CHALK/.test(t)), later.r1);
  check('a skin you already own becomes 100 emeralds', later.r2.some((t) => /TIER 4: 100 EMERALDS/.test(t)), later.r2);
  check('a new season starts the track again and you keep your skins', later.newSeason.season === 2 && later.newSeason.xp === 0 && later.newSeason.got === 0 && later.kept, later);

  // the screen
  await page.evaluate(() => { EGO.Save.data.pass.season = 0; EGO.Pass.sync(EGO.Save.data); EGO.Save.data.pass.xp = 4300; EGO.Save.data.pass.got = 4; EGO.Game.toLobby(); });
  const sub = await page.evaluate(() => document.getElementById('pass-sub').textContent);
  await page.click('#go-pass', { force: true }); await sleep(200);
  const scr = await page.evaluate(() => ({ cur: EGO.UI.cur, tiles: document.querySelectorAll('.gp-t').length, got: document.querySelectorAll('.gp-t.got').length, next: document.querySelector('.gp-t.next') && document.querySelector('.gp-t.next').textContent, ch: document.querySelectorAll('.gp-c').length, tier: document.querySelector('.gp-tier b').textContent }));
  check('lobby button shows your tier', sub === 'TIER 4 / 30', sub);
  check('pass screen: 30 reward tiles, 4 challenges, your progress', scr.cur === 'pass' && scr.tiles === 30 && scr.got === 4 && /TIER 5/.test(scr.next) && scr.ch === 4 && /TIER 4/.test(scr.tier), scr);
  await page.screenshot({ path: __dirname + '/shots/gp2_pass.png' });

  // the Locker shows pass skins as locked until earned, and spins never give them
  const lk = await page.evaluate(() => {
    EGO.UI.openLocker(); EGO.UI.lockerTab = 'skin'; EGO.UI.skinSlot = 'celeb'; EGO.UI.lockerSel = 'TROPHY'; EGO.UI.renderLocker();
    const pools = [0, 1, 2, 3, 4].flatMap((r) => EGO.poolFor('skin', r));
    return { cap: document.getElementById('lk-cap').textContent, inSpins: pools.some((k) => ['TROPHY', 'SEASON_GOLD', 'CHAMP_BOOTS'].includes(k)) };
  });
  check('pass-only skins: locked in the Locker until earned, never in spins', /GAME PASS TIER 30/.test(lk.cap) && !lk.inSpins, lk);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();

  const o = await open({ wait: 1500, viewport: { width: 390, height: 844 }, mobile: true });
  await o.page.evaluate(() => EGO.UI.show('pass'));
  await o.page.screenshot({ path: __dirname + '/shots/gp_phone.png' });
  const side = await o.page.evaluate(() => { const s = document.getElementById('scr-pass'); return s.scrollWidth > s.clientWidth; });
  check('phone: pass screen has no sideways scrolling', !side);
  check('phone: no errors', o.logs.length === 0, o.logs.slice(0, 4));
  await o.browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
