// Night, rain, roofs and 3D grass (owner, Nov 2026: the second list of ideas): a NIGHT sky (floodlights do the lighting),
// RAIN (streaks round the camera, a greyer world), a roof over the lower stands in a small stadium and over the upper deck
// in a big one, and little blades of grass round the camera on HIGH and ULTRA, coloured from the pitch.
// Saves test/shots/wx_night_rain.png, wx_day_roof.png and wx_grass.png.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000, viewport: { width: 960, height: 540 } });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  const a = await page.evaluate(() => {
    const G = EGO.Game, W = EGO.World, s = EGO.Save.data.settings;
    s.quality = 'high'; G.applyQuality(); s.sky = 'night'; W.setLook('night'); s.weather = 'rain'; W.setWeather('rain');
    G.startMatch('quick'); G.stepManual(240); W.setTier(5); EGO.Cam.yaw = 0.3; EGO.Cam.pitch = 0.08; G.stepManual(3, true);
    return { look: W.look, rain: W.rain.visible, grass: W.grass && W.grass.visible, roofHigh: W.roofHigh.visible, roofLow: W.roofLow.visible, fog: W.scene.fog.far };
  });
  check('NIGHT and RAIN: the rain falls, the sky is the night one', a.look === 'night' && a.rain, a);
  check('a big stadium has the roof over its upper deck', a.roofHigh && !a.roofLow, a);
  check('HIGH has the 3D grass', a.grass, a);
  await page.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; EGO.Game.stepManual(1, true); });
  await shot('wx_night_rain');
  const b = await page.evaluate(() => {
    const G = EGO.Game, W = EGO.World, s = EGO.Save.data.settings;
    s.sky = 'day'; W.setLook('day'); s.weather = 'clear'; W.setWeather('clear'); W.setTier(0); EGO.Cam.yaw = -1.2; EGO.Cam.pitch = 0.12; G.stepManual(3, true);
    return { rain: W.rain.visible, roofLow: W.roofLow.visible, roofHigh: W.roofHigh.visible };
  });
  check('clear weather has no rain; a small stadium has the roof over its lower stands', !b.rain && b.roofLow && !b.roofHigh, b);
  await shot('wx_day_roof');
  await page.evaluate(() => { const m = EGO.Game.match; m.human.pos.set(4, 0, 30); EGO.Cam.yaw = 0.2; EGO.Cam.pitch = -0.35; EGO.Game.stepManual(30, true); });
  await shot('wx_grass');
  const q = await page.evaluate(() => { const G = EGO.Game, W = EGO.World, s = EGO.Save.data.settings, out = {}; for (const k of ['high', 'med', 'low']) { s.quality = k; G.applyQuality(); out[k] = W.grass.visible; } s.quality = 'auto'; G.applyQuality(); return out; });
  check('the grass is on HIGH, not on MED or LOW', q.high && !q.med && !q.low, q);
  const menu = await page.evaluate(() => { EGO.Game.pause(); const r = { sky: [...document.querySelectorAll('#set-sky button')].map((x) => x.dataset.v), wx: [...document.querySelectorAll('#set-wx button')].map((x) => x.dataset.v) }; EGO.Game.resume(); return r; });
  check('the pause menu has NIGHT and the weather', menu.sky.includes('night') && menu.wx.join(',') === 'clear,rain', menu);
  check('no errors (every new shader built)', logs.filter((l) => !/willReadFrequently|GPU stall/i.test(l)).length === 0, logs.slice(0, 5));
  await page.evaluate(() => { const s = EGO.Save.data.settings; s.sky = 'day'; s.weather = 'clear'; EGO.World.setWeather('clear'); EGO.World.setLook('day'); });
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
