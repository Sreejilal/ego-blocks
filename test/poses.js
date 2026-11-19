// Each character's own pose (owner, Nov 2026): the Locker shows the picked style in its pose, every style's pose is
// different, and on the start screen your player stops juggling every few rounds to strike it, then juggles again.
// Saves test/shots/pose_*.png (a few of them) and pose_lobby.png.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  await page.evaluate(() => { const G = EGO.Game; if (G.state !== 'lobby') G.toLobby(); EGO.unlockAll(EGO.Save.data); EGO.UI.openLocker(); });
  // every style's pose, read off the 3D model
  const poses = await page.evaluate(() => {
    const out = {};
    for (const id of EGO.STYLE_IDS) {
      document.querySelector(`#locker-grid [data-id="${id}"]`).click();
      EGO.Game.stepManual(12);
      const P = EGO.Showcase.p.P, r = (o) => [o.rotation.x, o.rotation.z].map((v) => +v.toFixed(2));
      out[id] = { style: EGO.Showcase.p.styleId, arms: r(P.armL).concat(r(P.armR)), legs: r(P.legL).concat(r(P.legR)), body: [+P.body.position.y.toFixed(2), +P.body.rotation.x.toFixed(2)], ball: EGO.Showcase.ball.position.toArray().map((v) => +v.toFixed(2)) };
    }
    return out;
  });
  const ids = Object.keys(poses), sig = ids.map((id) => JSON.stringify([poses[id].arms, poses[id].legs, poses[id].body].map((a) => a.map((v) => Math.round(v * 5) / 5))));
  check('the Locker shows the picked character (all ' + ids.length + ')', ids.every((id) => poses[id].style === id), ids.filter((id) => poses[id].style !== id));
  check('every character has a pose of its own', new Set(sig).size === ids.length, { styles: ids.length, different: new Set(sig).size });
  for (const id of ['TITAN', 'WARDEN', 'COMET', 'ANCHOR', 'TRICKSTER', 'FORTRESS']) {
    await page.evaluate((id) => { document.querySelector(`#locker-grid [data-id="${id}"]`).click(); EGO.Game.stepManual(20, true); }, id);
    await shot('pose_' + id.toLowerCase());
  }
  check('TITAN roars (both arms up), COMET floats, ANCHOR sits', poses.TITAN.arms[1] > 2 && poses.TITAN.arms[3] < -2 && poses.COMET.body[0] > 0.9 && poses.ANCHOR.body[0] < 0.5, { titan: poses.TITAN.arms, comet: poses.COMET.body, anchor: poses.ANCHOR.body });
  check('MAGNET floats the ball over his hand, TRICKSTER balances it on his foot', poses.MAGNET.ball[1] > 1.9 && poses.TRICKSTER.ball[1] > 0.45, { magnet: poses.MAGNET.ball, trickster: poses.TRICKSTER.ball });
  // the start screen: juggling, then the pose, then juggling again
  const lobby = await page.evaluate(() => {
    const G = EGO.Game, S = EGO.Showcase, d = EGO.Save.data; d.style = 'TITAN'; G.toLobby(); S.preview(null); S.loops = 0; S.pz.on = false; S.pz.w = 0;
    const seen = { juggled: false, posed: false, back: false, posedAt: -1 };
    for (let i = 0; i < 60 * 25; i++) {
      G.stepManual(1);
      if (!S.pz.on && S.pz.w < 0.05 && !seen.posed) seen.juggled = true;
      if (S.pz.on && S.pz.w > 0.95 && !seen.posed) { seen.posed = true; seen.posedAt = i; seen.arms = [+S.p.P.armL.rotation.x.toFixed(2), +S.p.P.armL.rotation.z.toFixed(2)]; }
      if (seen.posed && !S.pz.on && S.pz.w < 0.05) { seen.back = true; break; }
    }
    return seen;
  });
  check('on the start screen your player juggles, strikes the pose, then juggles again', lobby.juggled && lobby.posed && lobby.back && lobby.arms[1] > 2, lobby);
  await page.evaluate(() => { const S = EGO.Showcase; S.loops = 99; for (let i = 0; i < 400 && !(S.pz.on && S.pz.w > 0.95); i++) EGO.Game.stepManual(1); EGO.Game.stepManual(1, true); });
  await shot('pose_lobby');
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
