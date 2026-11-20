// The crowd extras (owner, Nov 2026: "make the crowd have posters and banners ... way more graphical at the highest end"):
// banners over the front wall in the clubs' colours, fans holding up posters, giant flags waving in the end stands, camera
// flashes (more after a goal), and the ULTRA graphics setting (sharpest, big soft shadows). Saves test/shots/crowd_*.png.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  const info = await page.evaluate(() => {
    const W = EGO.World, E = W.extras, G = EGO.Game;
    EGO.Save.data.settings.quality = 'ultra'; G.applyQuality();
    G.startMatch('ranked'); G.stepManual(30);
    const T = EGO.TEAM, bc = E.bannerCv.getContext('2d').getImageData(10, 8, 1, 1).data;
    const home = EGO.CLUBS[T[0].club].home, hex = (d) => '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    return {
      banners: E.banners.geometry.attributes.position.count / 4, posters: E.posters.count, posterAll: E.posterIdx.length, flags: E.flags.length,
      flagsOn: E.flags.every((f) => f.visible), flashesOn: E.flashes.visible, soft: W.renderer.shadowMap.type === 2, map: W.sun.shadow.mapSize.x,
      bannerPix: hex(bc), homeShirt: home.shirt.toLowerCase(), homeAlt: home.alt.toLowerCase(), fans: W.fans.count,
    };
  });
  check('banners hang all round (12), fans hold up posters, 4 giant flags', info.banners === 12 && info.posters > 40 && info.flags === 4, info);
  check('the banners wear the home club colours', info.bannerPix === info.homeShirt || info.bannerPix === info.homeAlt, info);
  check('ULTRA: soft shadows, a 4096 shadow map, flags and flashes on', info.soft && info.map === 4096 && info.flagsOn && info.flashesOn, info);
  // look at the far end (giant flags, posters) and at a side stand (banners)
  await page.evaluate(() => { EGO.Cam.yaw = 0; EGO.Cam.pitch = -0.02; EGO.Game.stepManual(2, true); });
  await shot('crowd_end');
  await page.evaluate(() => { const m = EGO.Game.match; m.human.pos.set(-20, 0, 10); EGO.Cam.yaw = -Math.PI / 2 - 0.25; EGO.Cam.pitch = -0.05; EGO.Game.stepManual(40, true); });
  await shot('crowd_side');
  // a goal: the crowd goes wild, posters go up, flashes everywhere
  const wild = await page.evaluate(() => {
    const W = EGO.World, E = W.extras, n = () => { const t = E.flashMat.uniforms.uTime.value, a = E.flashes.geometry.attributes; let on = 0; for (let i = 0; i < a.aPhase.count; i++) { const spd = a.aRate.getX(i) * (1 + E.flashMat.uniforms.uFlash.value * 6), f = (t * spd + a.aPhase.getX(i)) % 1; if (f < 0.1 * spd) on++; } return on; };
    let calm = 0, loud = 0;
    for (let i = 0; i < 60; i++) { EGO.Game.stepManual(1); calm += n(); }
    W.excite[0] = W.excite[1] = 1;
    for (let i = 0; i < 60; i++) { W.excite[0] = W.excite[1] = 1; EGO.Game.stepManual(1); loud += n(); }
    return { calm, loud, flash: +E.flashMat.uniforms.uFlash.value.toFixed(2) };
  });
  check('after a goal there are far more camera flashes', wild.loud > wild.calm * 3 && wild.flash > 0.9, wild);
  await page.evaluate(() => { EGO.Game.stepManual(1, true); });
  await shot('crowd_goal');
  // lower settings drop the extras that cost the most
  const lower = await page.evaluate(() => {
    const W = EGO.World, E = W.extras, out = {};
    for (const q of ['high', 'med', 'low']) { EGO.Save.data.settings.quality = q; EGO.Game.applyQuality(); out[q] = { flags: E.flags[0].visible, posters: E.posters.visible, flashes: E.flashes.visible, soft: W.renderer.shadowMap.type === 2 }; }
    EGO.Save.data.settings.quality = 'auto'; EGO.Game.applyQuality();
    return out;
  });
  check('HIGH keeps the flags, MED drops them, LOW keeps only the banners; soft shadows only on ULTRA', lower.high.flags && !lower.high.soft && !lower.med.flags && lower.med.posters && lower.med.flashes && !lower.low.posters && !lower.low.flashes, lower);
  // a half-empty stadium: only the fans who came hold posters
  const tier = await page.evaluate(() => { const W = EGO.World, E = W.extras; W.setTier(0); const r = { fans: W.fans.count, posters: E.posters.count, flashes: E.flashes.geometry.drawRange.count }; W.setTier(5); r.full = E.posters.count; r.fullFlashes = E.flashes.geometry.drawRange.count; return r; });
  check('a smaller crowd holds fewer posters and takes fewer photos (none from empty seats)', tier.posters < tier.full && tier.flashes < tier.fullFlashes, tier);
  // the pause menu offers ULTRA
  const menu = await page.evaluate(() => { EGO.Game.pause(); const b = [...document.querySelectorAll('#set-q button')].map((x) => x.dataset.q); EGO.Game.resume(); return b; });
  check('the pause menu has ULTRA graphics', menu.includes('ultra'), menu);
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Game.stepManual(30, true); });
  await shot('crowd_lobby');
  check('no errors (every crowd shader built)', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL: INVALID_ENUM|context lost/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
