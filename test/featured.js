// Featured mode: a fixed 3-hour rotation from the clock (King of the Hill, Volleys Only, 1v1 Duels, Lawless),
// a countdown in the lobby, and each mode's rules.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const sched = await page.evaluate(() => {
    const H = 3600 * 1000, base = Date.UTC(2026, 9, 28, 0, 0, 0);
    const modes = [0, 1, 2, 3, 4].map((i) => EGO.featuredAt(base + i * 3 * H + 60000).mode);
    const a = EGO.featuredAt(base + 30 * 60000), b = EGO.featuredAt(base + 31 * 60000);
    return { modes, leftA: Math.round(a.left / 60000), drop: Math.round((a.left - b.left) / 1000), same: a.mode === b.mode };
  });
  check('featured mode rotates every 3 hours through all four', new Set(sched.modes.slice(0, 4)).size === 4 && sched.modes[4] === sched.modes[0] && ['koth', 'volleys', 'duel', 'lawless'].every((m) => sched.modes.includes(m)), sched.modes);
  check('the countdown runs down to the next one', sched.leftA === 150 && sched.drop === 60 && sched.same, sched);

  const lobby = await page.evaluate(() => { EGO.Game.stepManual(2, true); const f = EGO.featuredAt(); return { name: document.getElementById('feat-name').textContent, sub: document.getElementById('feat-sub').textContent, want: EGO.MODES[f.mode].name }; });
  check('the lobby shows the featured mode and the countdown', lobby.name === lobby.want && /NEXT IN \d+:\d\d:\d\d/.test(lobby.sub), lobby);
  await page.screenshot({ path: __dirname + '/shots/f1_lobby.png' });

  // King of the Hill
  const koth = await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('koth'); G.manual = true; G.stepManual(170, false);
    const m = G.match, h = m.human, H = m.hill;
    for (const o of m.teams[1]) if (!o.isGK) o.pos.set(-20, 0, 30);
    m.phase = 'play'; H.tx = H.x = 0; H.tz = H.z = 6; H.moveT = 99;
    h.pos.set(0, 0, 6); h.vel.set(0, 0, 0); m.ball.owner = null; m.possess(h, true);
    const s0 = m.score[0];
    for (let i = 0; i < 150; i++) { h.pos.set(0, 0, 6); h.vel.set(0, 0, 0); m.update(1 / 60); }
    const inside = m.score[0] - s0;
    h.pos.set(15, 0, -20); const s1 = m.score[0];
    for (let i = 0; i < 120; i++) { h.pos.set(15, 0, -20); h.vel.set(0, 0, 0); m.update(1 / 60); }
    const outside = m.score[0] - s1;
    m.ball.owner = null; m.ball.lastKicker = h; m.ball.lastTouch = h; const s2 = m.score[0]; m.onGoal(1);
    G.stepManual(2, true);
    return { inside, outside, goal: m.score[0] - s2, ring: !!H.mesh.parent, chip: document.getElementById('hud-mode').textContent };
  });
  check('King of the Hill: a point a second in the ring, none outside', koth.inside === 2 && koth.outside === 0, koth);
  check('King of the Hill: goals are worth 3', koth.goal === 3 && koth.ring && /KING OF THE HILL/.test(koth.chip), koth);
  await page.screenshot({ path: __dirname + '/shots/f2_koth.png' });

  // Volleys Only
  const vol = await page.evaluate(() => {
    const G = EGO.Game; G.toLobby(); G.startMatch('volleys'); G.manual = true; G.stepManual(170, false);
    const m = G.match, h = m.human;
    m.phase = 'play'; m.ball.owner = null;
    m.ball.lastKicker = h; m.ball.kick = { by: h, type: 'shot', t: m.time, aerial: false }; m.ball.inGoal = 1;
    m.onGoal(1);
    const ground = { score: m.score[0], phase: m.phase, banner: document.getElementById('banner-big').textContent };
    G.stepManual(120, false); m.phase = 'play';
    m.ball.owner = null; m.ball.lastKicker = h; m.ball.kick = { by: h, type: 'shot', t: m.time, aerial: true };
    m.onGoal(1);
    return { ground, aerialScore: m.score[0] };
  });
  check('Volleys Only: a goal off the ground does not count', vol.ground.score === 0 && vol.ground.phase === 'out' && vol.ground.banner === 'NO GOAL', vol);
  check('Volleys Only: a volley or header counts', vol.aerialScore === 1, vol);

  // 1v1 Duel
  const duel = await page.evaluate(() => {
    const G = EGO.Game; G.toLobby(); G.startMatch('duel'); G.manual = true; G.stepManual(170, false);
    const m = G.match, h = m.human, sizes = [m.teams[0].length, m.teams[1].length];
    for (let g = 0; g < 3; g++) { m.phase = 'play'; m.ball.owner = null; m.ball.lastKicker = h; m.onGoal(1); for (let i = 0; i < 60 * 4.2; i++) m.update(1 / 60); }
    return { sizes, score: m.score.slice(), phase: m.phase, chip: document.getElementById('hud-mode').textContent };
  });
  check('1v1 Duel: one player and a keeper each, first to 3 ends it', duel.sizes.join() === '2,2' && duel.score[0] === 3 && duel.phase === 'end' && duel.chip === '1V1 DUEL', duel);

  // bots play every featured mode to the end
  const sims = await page.evaluate(() => ['koth', 'volleys', 'duel'].map((mode) => { const r = EGO.simulate(mode, 0.6, 120, mode === 'duel' ? 2 : 3); return { mode, score: r.score, shots: r.shots }; }));
  check('bot matches run in every featured mode', sims.every((s) => Array.isArray(s.score)) && sims[0].score[0] + sims[0].score[1] > 5, sims);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
