// Fixes from playtesting with friends (Nov 2026):
// 1. "my cursor just goes to places when I use slow mo": C C used to start a feint on the first tap that kept sliding you
//    sideways through the slow motion (your view and aim with it), plus a big zoom. Now the second tap stops the feint and
//    gives it back, and the zoom is light. On a phone, two taps just beside the FEINT button no longer swing the camera.
// 2. "people don't understand you have to put full screen on mobile": a PHONE TIP on the start screen and a gold FULL
//    button in matches while a phone shows the browser bars. iPhones (no fullscreen in their browsers) get Add to Home Screen.
// 3. "when I play I want only the game, not the URL": laptops go fullscreen when a match starts too, and RESUME goes back.
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DT = 1 / 60;
const tap = { moveX: 0, moveY: 0, dodge: true, ab: [false, false, false], emote: -1, camYaw: 0 };
const idle = Object.assign({}, tap, { dodge: false });
const PARTS = (process.env.PARTS || 'sim,laptop,laptopfs,phone,iphone,app').split(','); // PARTS=phone runs one part (handy on a slow PC)
const want = (k) => PARTS.includes(k);
const notTest = () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); // a real browser, not a test robot

function setup() {
  const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: 3 });
  for (let i = 0; i < 300 && m.phase !== 'play'; i++) m.update(DT);
  for (const q of m.players) { q.vel.set(0, 0, 0); q.setState('free'); q.wall = true; }
  const p = m.teams[0].find((q) => !q.isGK);
  p.pos.set(0, 0, 10); p.yaw = 0;
  m.ball.reset(0, 10.6); m.possess(p, true);
  return { m, p };
}
const run = (m, p, s) => { for (let i = 0; i < Math.round(s / DT); i++) { m.updateHuman(DT, idle, p); m.update(DT); } };

if (want('sim')) { // C C: the feint stops at the second tap
  const one = setup();
  one.m.updateHuman(DT, tap, one.p); run(one.m, one.p, 1.2);
  const two = setup();
  two.m.updateHuman(DT, tap, two.p); run(two.m, two.p, 0.15); two.m.updateHuman(DT, tap, two.p);
  const cut = { state: two.p.state, feint: two.p.feint, charges: two.p.dodgeCharges, slowmo: +two.p.fx.slowmo.toFixed(2) };
  run(two.m, two.p, 1.2);
  const side1 = Math.abs(one.p.pos.x), side2 = Math.abs(two.p.pos.x);
  check('one tap of C is still a full feint (a big step to the side)', side1 > 3, { side: +side1.toFixed(2) });
  check('C C: the second tap stops the feint at once, starts SLOW-MO and gives the feint back', cut.state === 'free' && cut.feint === 0 && cut.charges === 1 && cut.slowmo > 2, cut);
  check('C C moves you much less to the side than before (it used to be 4.5 blocks)', side2 < 2.3 && side2 < side1 * 0.6, { side: +side2.toFixed(2), feintOnly: +side1.toFixed(2) });
  check('you still have the ball', two.m.ball.owner === two.p);
}

(async () => {
  // ---- a laptop ----
  if (want('laptop')) {
    const { browser, page, logs } = await open();
    await page.evaluate(() => { EGO.Game.startMatch('quick'); });
    const r = await page.evaluate(() => {
      const G = EGO.Game, m = G.match, I = EGO.Input, C = EGO.Cam, cam = EGO.World.camera;
      for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1);
      const p = m.human, s = Math.sign(m.oppGoalZ(p.team));
      p.pos.set(0, 0, -s * 4); p.setState('free'); p.vel.set(0, 0, 0); m.possess(p, true);
      C.yaw = s > 0 ? 0 : Math.PI; I.locked = true;
      G.stepManual(5);
      const base = cam.fov, yaw0 = C.yaw, x0 = p.pos.x;
      I.edges.add('KeyC'); G.stepManual(9); I.edges.add('KeyC'); G.stepManual(1);
      let minFov = base;
      for (let i = 0; i < 60; i++) { G.stepManual(1); minFov = Math.min(minFov, cam.fov); }
      return { slowmo: p.fx.slowmo > 0 || p.slowRe > 15, zoom: +(base - minFov).toFixed(1), turned: +Math.abs(C.yaw - yaw0).toFixed(3), side: +Math.abs(p.pos.x - x0).toFixed(2) };
    });
    check('laptop: C C in a real match, the camera does not turn by itself and you slide at most ~2 blocks', r.slowmo && r.turned === 0 && r.side < 2.3, r);
    check('laptop: the slow-mo zoom is light now (it was 10 degrees)', r.zoom > 0 && r.zoom <= 3.5, r);
    // a mouse lock refused without a click (an online match starting by itself) waits for a click instead of a free cursor
    const lk = await page.evaluate(() => { Object.defineProperty(navigator, 'userActivation', { value: { isActive: false }, configurable: true }); const I = EGO.Input; I.everLocked = false; I.lockFailed = false; I.lockError(); const f = I.lockFailed; I.lockFailed = false; return { failed: f, active: navigator.userActivation ? navigator.userActivation.isActive : 'n/a' }; });
    check('a mouse lock refused without a click does not switch to the free-cursor camera', lk.failed === false, lk);
    if (logs.length) console.log(logs.join('\n'));
    await browser.close();
  }
  if (want('laptopfs')) {
    const { browser, page } = await open({ init: notTest });
    const fs0 = await page.evaluate(() => ({ fs: EGO.Touch.isFs(), touch: EGO.Touch.on, tip: !!document.getElementById('fs-tip') && !document.getElementById('fs-tip').hidden }));
    await page.click('#go-quick'); await sleep(1200);
    const fs1 = await page.evaluate(() => ({ fs: EGO.Touch.isFs(), state: EGO.Game.state }));
    check('laptop: clicking QUICK MATCH goes fullscreen (no web address or tabs while you play)', !fs0.fs && !fs0.touch && fs1.fs && fs1.state === 'match', { before: fs0, after: fs1 });
    check('laptop: no phone tip on a laptop', !fs0.tip, fs0);
    await page.evaluate(async () => { EGO.Game.pause(); await document.exitFullscreen().catch(() => {}); });
    await sleep(500);
    const out = await page.evaluate(() => EGO.Touch.isFs());
    await page.mouse.click(...(await page.evaluate(() => { const r = document.getElementById('p-resume').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })));
    await sleep(1000);
    const back = await page.evaluate(() => ({ fs: EGO.Touch.isFs(), state: EGO.Game.state }));
    check('laptop: ESC leaves fullscreen, RESUME goes back to only the game', !out && back.fs && back.state === 'match', { out, back });
    await browser.close();
  }

  // ---- a phone that can go fullscreen (Android) ----
  if (want('phone')) {
    const { browser, page, logs } = await open({ viewport: { width: 844, height: 390 }, mobile: true, init: notTest });
    await page.evaluate(() => { EGO.Game.toLobby(); });
    await sleep(300);
    const tip = await page.evaluate(() => { const t = document.getElementById('fs-tip'); return t && { shown: !t.hidden, h: document.getElementById('fst-h').textContent, go: !document.getElementById('fst-go').hidden, gold: document.getElementById('btn-fs').classList.contains('nag') }; });
    await page.screenshot({ path: __dirname + '/shots/fs_tip_phone.png' });
    check('phone: the start screen shows a PHONE TIP with GO FULL SCREEN, and the FULLSCREEN button is gold', tip && tip.shown && /FULL SCREEN/.test(tip.h) && tip.go && tip.gold, tip);
    await page.tap('#fst-go'); await sleep(900);
    const after = await page.evaluate(() => ({ fs: EGO.Touch.isFs(), tipHidden: document.getElementById('fs-tip').hidden }));
    check('phone: tapping GO FULL SCREEN fills the screen and the tip goes away', after.fs && after.tipHidden, after);
    // in a match, out of fullscreen (a swipe), the gold FULL button shows; tapping it goes back
    await page.evaluate(() => { EGO.Game.startMatch('quick'); });
    await sleep(900);
    await page.evaluate(async () => { await document.exitFullscreen().catch(() => {}); }); // a swipe out of fullscreen
    await sleep(700);
    await page.evaluate(() => { EGO.Game.stepManual(30, true); EGO.Touch.layout(); });
    const b = await page.evaluate(() => { const el = document.querySelector('#touch [data-act="fs"]'), r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { shown: !el.hidden && r.width > 0, x: r.x + r.width / 2, y: r.y + r.height / 2, onTop: !!hit && hit.closest('[data-act]') === el, fs: EGO.Touch.isFs(), right: r.right, w: innerWidth }; });
    await page.screenshot({ path: __dirname + '/shots/fs_button_phone.png' });
    check('phone: in a match without fullscreen, a gold FULL button sits with the small buttons at the top', b.shown && b.onTop && !b.fs && b.right <= b.w, b);
    await page.touchscreen.tap(b.x, b.y); await sleep(900);
    await page.evaluate(() => EGO.Game.stepManual(2, true));
    const b2 = await page.evaluate(() => ({ fs: EGO.Touch.isFs(), hidden: document.querySelector('#touch [data-act="fs"]').hidden }));
    check('phone: tapping FULL goes fullscreen and the button hides', b2.fs && b2.hidden, b2);

    // two quick taps just beside the FEINT button (a thumb going for SLOW-MO) never swing the camera round
    const spot = await page.evaluate(() => {
      const r = document.querySelector('#touch [data-act="dt"]').getBoundingClientRect();
      const free = (x, y) => { const e = document.elementFromPoint(x, y); return e && !e.closest('[data-act]') && x > EGO.Touch.zoneX; };
      const near = [[r.left - 14, r.top + r.height / 2], [r.left + r.width / 2, r.top - 14], [r.left - 10, r.top - 10], [r.right + 14, r.top + r.height / 2]].find(([x, y]) => free(x, y));
      let open = null;
      for (let y = innerHeight * 0.3; y < innerHeight * 0.6 && !open; y += 10) for (let x = innerWidth * 0.55; x < innerWidth * 0.8 && !open; x += 10) if (free(x, y) && !EGO.Touch.nearButton(x, y)) open = [x, y];
      return { near, open };
    });
    const dbl = async ([x, y]) => { await page.evaluate(() => { EGO.Cam.snapYaw = null; EGO.Touch.lastTap = 0; }); await page.touchscreen.tap(x, y); await sleep(120); await page.touchscreen.tap(x, y); await sleep(50); return page.evaluate(() => EGO.Cam.snapYaw != null); };
    const swungNear = spot.near ? await dbl(spot.near) : null, swungOpen = spot.open ? await dbl(spot.open) : null;
    check('phone: two taps just beside FEINT do not swing the camera', spot.near && swungNear === false, { spot: spot.near, swung: swungNear });
    check('phone: a double tap out in the open still swings the camera to the goal', spot.open && swungOpen === true, { spot: spot.open, swung: swungOpen });
    if (logs.length) console.log(logs.join('\n'));
    await browser.close();
  }

  // ---- an iPhone (its browsers have no fullscreen) ----
  if (want('iphone')) {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const noFs = () => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) Object.defineProperty(Document.prototype, k, { get: () => false }); };
    const { browser, page } = await open({ viewport: { width: 390, height: 844 }, mobile: true, userAgent: iphone, init: noFs });
    await page.evaluate(() => { EGO.Game.toLobby(); });
    await sleep(300);
    const tip = await page.evaluate(() => { const t = document.getElementById('fs-tip'), r = t && t.getBoundingClientRect(); return t && { shown: !t.hidden, way: EGO.Touch.fsWay(), text: t.textContent, go: !document.getElementById('fst-go').hidden, ok: document.getElementById('fst-no').textContent, fits: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    await page.screenshot({ path: __dirname + '/shots/fs_tip_iphone.png' });
    check('iPhone: the tip says Share, then Add to Home Screen (no GO button, GOT IT), and fits the screen', tip && tip.shown && tip.way === 'ios' && /Add to Home Screen/.test(tip.text) && !tip.go && tip.ok === 'GOT IT' && tip.fits, tip);
    await page.tap('#fst-no');
    await page.evaluate(() => { EGO.Game.startMatch('quick'); EGO.Game.stepManual(20, true); });
    const b = await page.evaluate(() => ({ fsBtn: !document.querySelector('#touch [data-act="fs"]').hidden, tip: !document.getElementById('fs-tip').hidden }));
    check('iPhone: no FULL button in matches (it could not work there)', !b.fsBtn && !b.tip, b);
    await browser.close();
  }

  // ---- opened from the home screen: nothing to remind ----
  if (want('app')) {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const app = () => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) Object.defineProperty(Document.prototype, k, { get: () => false }); };
    const { browser, page } = await open({ viewport: { width: 844, height: 390 }, mobile: true, userAgent: iphone, init: app });
    await page.evaluate(() => { EGO.Game.toLobby(); });
    await sleep(300);
    const t = await page.evaluate(() => ({ way: EGO.Touch.fsWay(), tip: !!document.getElementById('fs-tip') && !document.getElementById('fs-tip').hidden }));
    check('opened from the home screen icon: no tip (the game already fills the screen)', t.way === 'done' && !t.tip, t);
    await browser.close();
  }

  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(failed ? failed + ' FAILED' : 'ALL ' + results.length + ' PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
