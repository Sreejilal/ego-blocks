// The camera: third person by default, V (or R3, or the phone button, or the menu) switches to first person,
// the choice is saved, your own model hides in first person and comes back for replays. Phones go fullscreen
// when a match starts, unless Fullscreen is turned off in the menu.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'file:///' + path.join(__dirname, '..', 'docs', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts) => { const ctx = await browser.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', (e) => logs.push(e.message)); await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' })); await p.goto(URL); await sleep(2500); return p; };
  // where the camera is compared to the player's eyes
  const view = (p) => p.evaluate(() => {
    const m = EGO.Game.match, h = m.human, c = EGO.World.camera.position;
    return { cam: EGO.Save.data.settings.cam, d: Math.hypot(c.x - h.pos.x, c.y - (h.pos.y + 1.55), c.z - h.pos.z), seen: h.P.root.visible, aim: !!m.aim && Number.isFinite(m.aim.x) };
  });
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  check('third person is the default', await A.evaluate(() => EGO.Save.data.settings.cam) === 'third');
  await A.evaluate(() => EGO.Game.startMatch('quick')); await A.evaluate(() => EGO.Game.stepManual(90, true));
  const v0 = await view(A);
  check('third person: the camera sits behind you and you can see yourself', v0.cam === 'third' && v0.d > 4 && v0.seen, v0);
  await A.screenshot({ path: __dirname + '/shots/cam1_third.png' });
  await A.keyboard.press('KeyV'); await A.evaluate(() => EGO.Game.stepManual(4, true));
  const v1 = await view(A);
  check('V: first person, the camera is at your eyes and your own model is hidden', v1.cam === 'first' && v1.d < 0.5 && !v1.seen && v1.aim, v1);
  await A.evaluate(() => { EGO.Cam.pitch = -0.9; EGO.Game.stepManual(2, true); });
  await A.screenshot({ path: __dirname + '/shots/cam2_first_down.png' });
  const pitch = await A.evaluate(() => { EGO.Input.mdy = 4000; EGO.Cam.look(0.016); return EGO.Cam.pitch; });
  check('first person lets you look down further, at the ball at your feet', pitch < -1.1, pitch);
  await A.evaluate(() => { EGO.Cam.pitch = -0.1; EGO.Game.stepManual(2, true); });
  await A.screenshot({ path: __dirname + '/shots/cam3_first.png' });
  // a goal: wide shot in third person, then back
  const goal = await A.evaluate(() => { const m = EGO.Game.match; m.phase = 'goal'; EGO.Game.stepManual(30, false); const c = EGO.World.camera.position, h = m.human; const d = Math.hypot(c.x - h.pos.x, c.y - (h.pos.y + 1.55), c.z - h.pos.z); const seen = h.P.root.visible; m.phase = 'play'; EGO.Game.stepManual(4, false); return { d, seen, back: !h.P.root.visible }; });
  check('goals and the final whistle use the wide third person shot, then first person again', goal.d > 2 && goal.seen && goal.back, goal);
  // saved, and V again goes back
  const saved = await A.evaluate(() => JSON.parse(localStorage.getItem('scorz.save.v1')).settings.cam);
  await A.keyboard.press('KeyV'); await A.evaluate(() => EGO.Game.stepManual(30, false));
  const v2 = await view(A);
  check('the choice is saved, and V again goes back to third person', saved === 'first' && v2.cam === 'third' && v2.seen && v2.d > 4, { saved, v2 });
  // one press during hit stop still switches only once
  const once = await A.evaluate(() => { EGO.TimeCtl.hitStop && EGO.TimeCtl.hitStop(0.2); EGO.Input.edges.add('KeyV'); EGO.Game.stepManual(5, false); return EGO.Save.data.settings.cam; });
  check('one press switches once, even in a hit stop', once === 'first', once);
  // controller R3, but R3 still watches a replay when one is offered
  const r3 = await A.evaluate(() => { EGO.Input.edges.add('PadRS'); EGO.Game.stepManual(2, false); return EGO.Save.data.settings.cam; });
  check('R3 on a controller switches the camera', r3 === 'third', r3);
  // the menu
  await A.evaluate(() => { EGO.Game.pause(); });
  await A.evaluate(() => document.querySelector('#set-cam [data-v="first"]').click());
  const menu = await A.evaluate(() => ({ cam: EGO.Save.data.settings.cam, pressed: document.querySelector('#set-cam [data-v="first"]').getAttribute('aria-pressed') }));
  check('the Camera setting in the menu works', menu.cam === 'first' && menu.pressed === 'true', menu);
  await A.screenshot({ path: __dirname + '/shots/cam4_menu.png' });
  await A.evaluate(() => EGO.Game.resume());
  // replays show your player again
  const rep = await A.evaluate(() => {
    EGO.Game.stepManual(20, false);
    const m = EGO.Game.match; EGO.Replay.offer = { t: EGO.Replay.times[EGO.Replay.slot(EGO.Replay.count - 1)] - 0.2, kind: 'goal', focus: m.human };
    const ok = EGO.Replay.start(); EGO.Game.stepManual(3, false);
    const r = { ok: ok !== false, state: EGO.Game.state, seen: m.human.P.root.visible };
    EGO.Replay.stop(); return r;
  });
  check('replays show your player even in first person', rep.state === 'replay' && rep.seen, rep);

  // a phone: the camera button, and fullscreen when the match starts
  const P = await mk({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const fs0 = await P.evaluate(() => ({ fs: EGO.Touch.isFs(), can: EGO.Touch.fsAvailable(), auto: EGO.Save.data.settings.autoFs }));
  await P.tap('#go-quick'); await sleep(1200);
  const fs1 = await P.evaluate(() => EGO.Touch.isFs());
  check('phone: tapping QUICK MATCH goes fullscreen', !fs0.fs && fs0.can && fs0.auto && fs1, Object.assign(fs0, { after: fs1 }));
  await P.evaluate(() => EGO.Game.stepManual(30, true));
  const btn = await P.evaluate(() => { const r = (a) => document.querySelector('#touch [data-act="' + a + '"]').getBoundingClientRect(); const c = r('cam'), p = r('pause'); return { shown: !document.querySelector('#touch [data-act="cam"]').hidden, x: c.x + c.width / 2, y: c.y + c.height / 2, gap: Math.max(p.left - c.right, c.top - p.bottom) }; });
  const cdp = await P.context().newCDPSession(P);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await P.evaluate(() => EGO.Game.stepManual(4, true));
  const pv = await view(P);
  check('phone: the camera button next to pause switches to first person', btn.shown && btn.gap >= 0 && pv.cam === 'first' && pv.d < 0.5, Object.assign(pv, { gap: btn.gap }));
  await P.screenshot({ path: __dirname + '/shots/cam5_phone_first.png' });
  // Fullscreen OFF in the menu: no more automatic fullscreen
  await P.evaluate(() => { EGO.Game.pause(); document.querySelector('#set-fs [data-v="0"]').click(); });
  await sleep(600);
  const off = await P.evaluate(() => ({ fs: EGO.Touch.isFs(), auto: EGO.Save.data.settings.autoFs }));
  await P.evaluate(() => { EGO.Game.resume(); EGO.Game.forfeit(); EGO.Game.toLobby(); EGO.Game.stepManual(2, true); }); // a frame so the touch layer hides
  await P.tap('#go-quick'); await sleep(1000);
  const again = await P.evaluate(() => EGO.Touch.isFs());
  check('turning Fullscreen OFF in the menu stops the automatic fullscreen', !off.fs && off.auto === false && !again, Object.assign(off, { again }));
  // an upright phone: the top buttons do not overlap
  const U = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await U.evaluate(() => { EGO.Save.data.settings.autoFs = false; EGO.Game.startMatch('quick'); EGO.Game.stepManual(30, true); });
  const top = await U.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const c = r('#touch [data-act="cam"]'), p = r('#touch [data-act="pause"]'), sb = r('.scorebar'); return { camL: c.left, camR: c.right, pauseL: p.left, pauseBottom: p.bottom, sbR: sb.right, camTop: c.top, sbBottom: sb.bottom }; });
  check('upright phone: the camera button sits under pause, clear of the score', top.camL >= top.sbR && top.camTop >= top.pauseBottom, top);
  await U.screenshot({ path: __dirname + '/shots/cam6_upright.png' });
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
