// Clubs and kits: every pairing ends up with kits you can tell apart, matches wear them,
// and you can pick your club in the Locker. Screenshots: a kit line-up, a kickoff, the club tab.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const pairs = await page.evaluate(() => {
    const out = { n: 0, bad: [], awayUsed: [] };
    for (const h of CLUB_IDS_T()) for (const a of CLUB_IDS_T()) {
      if (h === a) continue;
      const [H, A] = EGO.matchSides(h, a); out.n++;
      if (EGO.kitClash(H.kit, A.kit)) out.bad.push(h + '-' + a + ' shirts');
      for (const [s, o] of [[H, A], [A, H]]) if (EGO.kitClash(s.keeper, s.kit) || EGO.kitClash(s.keeper, o.kit)) out.bad.push(h + '-' + a + ' keeper ' + s.club);
      if (A.away) out.awayUsed.push(h + '-' + a);
    }
    return out;
    function CLUB_IDS_T() { return EGO.CLUB_IDS; }
  });
  check('every pairing of the 6 clubs has kits that do not clash', pairs.n === 30 && pairs.bad.length === 0, pairs.bad.slice(0, 6));
  check('clashing clubs switch to away kits', pairs.awayUsed.length > 0, pairs.awayUsed);

  // line-up of every club: home, away, keeper
  await page.evaluate(() => {
    const G = EGO.Game; G.manual = true; EGO.Showcase.hide();
    const fake = { scene: EGO.World.scene, ball: { owner: null } };
    window._lineup = [];
    EGO.CLUB_IDS.forEach((id, i) => ['home', 'away', 'keeper'].forEach((w, j) => {
      const side = EGO.sideFor(id, w === 'away');
      const p = new EGO.Player(fake, { team: 0, role: w === 'keeper' ? 'GK' : 'ST', style: 'ROOKIE', side, number: 7 + j, name: 'X', skin: '#e0ac85' });
      p.pos.set(-7.5 + i * 3, 0, 1.6 * j); p.yaw = Math.PI + (j === 1 ? Math.PI : 0); p.setState('free'); p.animate(1);
      window._lineup.push(p);
    }));
    const cam = EGO.World.camera; cam.fov = 40; cam.position.set(0, 5, -15); cam.lookAt(0, 1, 1.4); cam.updateProjectionMatrix();
    EGO.World.render();
  });
  await page.screenshot({ path: __dirname + '/shots/k1_lineup.png' });
  await page.evaluate(() => { for (const p of window._lineup) p.dispose(); EGO.Game.toLobby(); });

  // a match between two clubs that clash
  const m = await page.evaluate(() => {
    EGO.Save.data.club = 'EMBER'; const G = EGO.Game; G.startMatch('quick');
    G.match.dispose(); G.match = new EGO.Match('quick', 0.5, { home: 'EMBER', away: 'SUNSPIRE' }); G.match.human && EGO.UI.buildHud(G.match); EGO.World.paintCrowd(EGO.TEAM[0], EGO.TEAM[1]);
    G.stepManual(30, true);
    return { a: EGO.TEAM[0].short, b: EGO.TEAM[1].short, away: EGO.TEAM[1].away, bar: [document.getElementById('sc0-nm').textContent, document.getElementById('sc1-nm').textContent] };
  });
  check('match uses both clubs, away kit on a clash', m.a === 'EMB' && m.b === 'SUN' && m.away === true && m.bar.join() === 'EMB,SUN', m);
  await page.screenshot({ path: __dirname + '/shots/k2_kickoff.png' });
  await page.evaluate(() => EGO.Game.toLobby());

  // pick a club in the Locker
  await page.evaluate(() => { EGO.UI.openLocker(); });
  await page.click('#ltab-club'); await sleep(150);
  await page.click('.lcard[data-id="NIGHTFALL"]'); await sleep(150);
  const prev = await page.evaluate(() => ({ club: EGO.Showcase.p.side.club, saved: EGO.Save.data.club }));
  check('clicking a club shows its kit on your player', prev.club === 'NIGHTFALL' && prev.saved === 'EMBER', prev);
  await page.click('#lk-equip'); await sleep(150);
  await page.evaluate(() => EGO.Game.stepManual(20, true));
  await page.screenshot({ path: __dirname + '/shots/k3_locker_club.png' });
  const eq = await page.evaluate(() => { EGO.UI.show('lobby'); EGO.Game.toLobby(); return { saved: EGO.Save.data.club, card: document.getElementById('pro-club').textContent, show: EGO.Showcase.p.side.club }; });
  check('equipping a club saves it and the start screen wears it', eq.saved === 'NIGHTFALL' && eq.card === 'NIGHTFALL' && eq.show === 'NIGHTFALL', eq);

  await page.evaluate(() => { localStorage.setItem('scorz.save.v1', JSON.stringify({ club: 'REAL TEAM' })); });
  await page.reload(); await sleep(1200);
  check('an unknown club in the save falls back', await page.evaluate(() => EGO.Save.data.club === 'ROVERS'));
  const sims = await page.evaluate(() => [EGO.simulate('quick', 0.5, 60), EGO.simulate('lawless', 0.5, 60)].map((r) => r.score));
  check('bot matches still run', sims.every((s) => Array.isArray(s)), sims);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
