// Camera effects (owner, Nov 2026: "the graphics are too low ... like GTA 6, try"): on HIGH and ULTRA (and auto on a
// computer that keeps up) the picture gets bloom, richer colour and a soft vignette; MED and LOW draw it plainly.
// Saves test/shots/post_off.png and post_on.png from the same spot so they can be compared.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  const setQ = (q) => page.evaluate((q) => { EGO.Save.data.settings.quality = q; EGO.Game.applyQuality(); EGO.Game.stepManual(2, true); return { on: !!EGO.World.postOn, has: !!EGO.World.post }; }, q);
  await page.evaluate(() => { const G = EGO.Game; G.startMatch('quick'); G.stepManual(240); EGO.Cam.yaw = 0.35; EGO.Cam.pitch = 0.05; G.stepManual(2, true); });
  const med = await setQ('med');
  await page.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; });
  await shot('post_off');
  const ultra = await setQ('ultra');
  await shot('post_on');
  const glow = await page.evaluate(() => {
    const W = EGO.World, P = W.post, r = W.renderer, w = P.c.width, h = P.c.height, px = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(P.c, 0, 0, w, h, px);
    let lit = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 60) lit++;
    return { lit, of: w * h, multisample: P.sceneRT.isWebGLMultisampleRenderTarget || false };
  });
  check('MED draws the plain picture, ULTRA turns the camera effects on', !med.on && ultra.on && ultra.has, { med, ultra });
  check('bright things glow (the bloom picks up the floodlights, sky and white lines)', glow.lit > 20, glow);
  const high = await setQ('high'), low = await setQ('low');
  check('HIGH has the effects too, LOW does not', high.on && !low.on, { high, low });
  const auto = await page.evaluate(() => { const G = EGO.Game; EGO.Save.data.settings.quality = 'auto'; G.autoStep = 0; G.applyQuality(); return { on: EGO.World.postOn, q: EGO.World.quality, pr: EGO.World.renderer.getPixelRatio() }; });
  check('auto starts with the camera effects on a computer, at the normal sharpness', auto.on && auto.q === 'hi1', auto);
  await page.evaluate(() => { document.getElementById('hud').style.visibility = ''; EGO.Game.toLobby(); EGO.Save.data.settings.quality = 'ultra'; EGO.Game.applyQuality(); EGO.Game.stepManual(30, true); });
  await shot('post_lobby');
  check('no errors (every effect shader built)', logs.filter((l) => !/willReadFrequently|GPU stall/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
