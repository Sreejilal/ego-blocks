// Ranked tiers: each one is a step up. A Wood-level team should lose badly to an Obsidian-level one,
// the stadium fills up and opens its upper deck as you climb, and you see the opponent tier at kickoff.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  // the bot matches run first, before the browser opens: the browser's drawing would slow them down a lot
  const G = require('../server/headless').load();
  const skills = G.TIER_SKILL;
  check('every tier has stronger bots than the one below', skills.every((s, i) => i === 0 || s > skills[i - 1] + 0.1), skills);

  // the bot matches run on the server's copy of the game: no drawing, so much faster than the browser
  const play = (size, teamD) => { const m = new G.Match('ranked', 0.5, { noHuman: true, autopilot: true, size, teamD }); for (let k = 0; k < 60 * 240 && m.phase !== 'end'; k++) m.update(1 / 60); const sc = m.score.slice(); m.dispose(); return sc; };
  // Wood against Obsidian, both ways round so home and away even out
  const wo = [];
  for (const size of [3, 4, 5]) for (let i = 0; i < 4; i++) {
    const flip = i % 2 === 1, sc = play(size, flip ? [1, 0.15] : [0.15, 1]);
    wo.push({ size, obs: flip ? sc[0] : sc[1], wood: flip ? sc[1] : sc[0] });
  }
  const wins = wo.filter((g) => g.obs > g.wood).length, diff = wo.reduce((a, g) => a + g.obs - g.wood, 0) / wo.length;
  check('Obsidian bots beat Wood bots badly', wins >= wo.length - 1 && diff >= 3, { wins: wins + '/' + wo.length, avgMargin: +diff.toFixed(1), games: wo.map((g) => g.size + 'v' + g.size + ' ' + g.obs + '-' + g.wood) });

  // neighbours: the higher tier should come out ahead. Neighbouring tiers are close, so this plays 16 games a pair
  // with the server's copy of the game (no drawing, much faster than the browser) to be sure it is not luck
  const steps = (() => {
    const S = G.TIER_SKILL, out = [];
    for (let t = 0; t < 5; t++) {
      let hi = 0, lo = 0;
      for (let i = 0; i < 16; i++) {
        const flip = i % 2 === 1, sc = play(t < 2 ? 3 : t < 4 ? 4 : 5, flip ? [S[t + 1], S[t]] : [S[t], S[t + 1]]);
        hi += flip ? sc[0] : sc[1]; lo += flip ? sc[1] : sc[0];
      }
      out.push({ tiers: t + '-' + (t + 1), higher: hi, lower: lo });
    }
    return out;
  })();
  check('one tier up scores more than the tier below', steps.every((s) => s.higher > s.lower), steps);
  const { browser, page, logs } = await open({ wait: 1500 });

  // the stadium for each tier
  const st = await page.evaluate(() => [0, 1, 2, 3, 4, 5].map((t) => { EGO.World.setTier(t); return { fans: EGO.World.fans.count, upper: EGO.World.upper.visible }; }));
  check('the stadium gets fuller each tier', st.every((s, i) => i === 0 || s.fans > st[i - 1].fans), st.map((s) => s.fans));
  check('the upper deck opens from Gold', st.map((s) => s.upper).join() === 'false,false,false,true,true,true', st.map((s) => s.upper));

  // lobby screenshots: Wood stadium and Obsidian stadium
  for (const [rp, name] of [[0, 'wood'], [530, 'obsidian']]) {
    await page.evaluate((rp) => { EGO.Save.data.rp = rp; EGO.Game.toLobby(); EGO.Game.manual = true; EGO.Game.stepManual(10, false); const c = EGO.World.camera; EGO.Showcase.on = false; c.clearViewOffset(); c.fov = 60; c.aspect = innerWidth / innerHeight; c.position.set(0, 14, -30); c.lookAt(0, 6, 40); c.updateProjectionMatrix(); EGO.World.render(); }, rp);
    await page.screenshot({ path: __dirname + '/shots/t_' + name + '.png' });
  }

  // kickoff shows the opponent tier
  const ko = await page.evaluate(() => {
    EGO.Save.data.rp = 330; EGO.Game.toLobby(); EGO.Game.startMatch('ranked'); EGO.Game.stepManual(3, true);
    return { banner: document.getElementById('banner-big').textContent, small: document.getElementById('banner-small').textContent, chip: document.getElementById('hud-mode').textContent, tier: EGO.Game.match.tier, d: EGO.Game.match.teamD };
  });
  check('kickoff shows the opponent tier', ko.banner === 'VS GOLD' && /GOLD BOTS/.test(ko.small) && /VS GOLD/.test(ko.chip) && ko.d[1] === skills[3], ko);
  await page.screenshot({ path: __dirname + '/shots/t_kickoff.png' });
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
