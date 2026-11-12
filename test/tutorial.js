// The tutorial (Nov 2026, CrazyGames onboarding): a brand-new player lands straight in it behind CLICK TO PLAY. Only the
// core in 5 steps (move, get the ball, pass, score, done) with pictures of the keys that light up while held (Z Q S D on a
// French keyboard), SKIP (the button, ENTER or the pause menu) goes straight into a quick match. Also NEW? PLAY THE
// TUTORIAL on the start screen and on How to Play. The end gives a first-time bonus and a button into a quick match.
// Played here with real keys and mouse buttons. The box fits on phones and the button to press glows.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts, init, state = 'lobby') => {
    const p = await (await browser.newContext(opts)).newPage(); p.setDefaultTimeout(120000);
    p.on('pageerror', (e) => logs.push(e.message));
    if (init) await p.addInitScript(init);
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(URL, { timeout: 120000 }); await p.waitForFunction((s) => window.EGO && EGO.Game.state === s, state, { timeout: 120000 }); return p;
  };

  // a brand-new player (a real browser, not a test robot) lands on the pitch, behind CLICK TO PLAY
  {
    const N = await mk({ viewport: { width: 1280, height: 720 } }, () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }), 'match');
    const r = await N.evaluate(() => ({ mode: EGO.Game.match.mode, gate: !document.getElementById('tut-gate').hidden, go: document.getElementById('tg-go').textContent, onboarded: EGO.Save.data.onboarded, cam: EGO.Save.data.settings.cam }));
    await N.screenshot({ path: __dirname + '/shots/tut0_gate.png', timeout: 120000 });
    check('a brand-new player lands straight in the tutorial, behind a big CLICK TO PLAY', r.mode === 'tutorial' && r.gate && r.go === 'CLICK TO PLAY' && r.onboarded, r);
    check('and sees their own player (third person)', r.cam === 'third', r.cam);
    await N.mouse.click(640, 360);
    const g = await N.evaluate(() => document.getElementById('tut-gate').hidden);
    check('one click and you are playing', g);
    await N.reload(); await N.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
    check('only the first time: the next visit opens the start screen', await N.evaluate(() => EGO.Game.state === 'lobby' && !document.getElementById('go-tut').hidden));
    await N.context().close();
  }

  const A = await mk({ viewport: { width: 1280, height: 720 } });
  check('a new player sees NEW? PLAY THE TUTORIAL', await A.evaluate(() => !document.getElementById('go-tut').hidden));
  await A.evaluate(() => { EGO.Save.data.settings.cutins = false; });
  await A.click('#go-tut');
  const s1 = await A.evaluate(() => { EGO.Game.stepManual(3, true); return { mode: EGO.Game.match.mode, box: !document.getElementById('tutbox').hidden, n: document.getElementById('tut-n').textContent, title: document.getElementById('tut-title').textContent, text: document.getElementById('tut-text').textContent, mark: EGO.TutHud.mark && EGO.TutHud.mark.visible, clock: document.getElementById('clock').textContent, keys: [...document.querySelectorAll('#tut-keys .kc')].map((k) => k.textContent).join(''), skip: !document.getElementById('tut-skip').hidden }; });
  check('step 1 of 5: MOVE, a short line, pictures of W A S D and a gold square', s1.mode === 'tutorial' && s1.box && /STEP 1 OF 5/.test(s1.n) && s1.title === 'MOVE' && s1.text === 'RUN TO THE GOLD SQUARE' && s1.keys === 'WASD' && s1.mark && s1.clock === '1/5', s1);
  check('there is a SKIP button', s1.skip, s1);
  const lit = await A.evaluate(() => { EGO.Input.down.add('KeyW'); EGO.Game.stepManual(1, true); const on = document.querySelector('#tut-keys .kc[data-code="KeyW"]').classList.contains('on'); EGO.Input.down.delete('KeyW'); EGO.Game.stepManual(1, true); return { on, off: !document.querySelector('#tut-keys .kc[data-code="KeyW"]').classList.contains('on') }; });
  check('the W key lights up while you hold it', lit.on && lit.off, lit);
  await A.screenshot({ path: __dirname + '/shots/tut1_move.png', timeout: 120000 });
  // play it through with real inputs
  const run = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, T = m.tut, I = EGO.Input, C = EGO.Cam;
    const face = (x, z) => { C.yaw = Math.atan2(x - h.pos.x, z - h.pos.z); C.snapYaw = null; };
    const until = (fn, max = 300) => { const s = T.step; for (let i = 0; i < max && T.step === s && m.phase !== 'end'; i++) fn(i); return T.step !== s; };
    const ok = {}, pics = {};
    ok.move = until(() => { face(T.mark.x, T.mark.z); I.down.add('KeyW'); EGO.Game.stepManual(4, false); }); I.down.delete('KeyW');
    ok.ball = until(() => { face(m.ball.pos.x, m.ball.pos.z); I.down.add('KeyW'); EGO.Game.stepManual(3, false); }); I.down.delete('KeyW');
    EGO.Game.stepManual(1, true); pics.pass = document.querySelector('#tut-keys .mouse.r') ? 'right mouse' : document.getElementById('tut-keys').innerHTML;
    ok.pass = until(() => { I.edges.add('Mouse2'); I.mouseR = true; EGO.Game.stepManual(1, false); I.mouseR = false; I.up.add('Mouse2'); EGO.Game.stepManual(6, false); }, 40);
    EGO.Game.stepManual(1, true); pics.shoot = document.querySelector('#tut-keys .mouse.l') ? 'left mouse' : document.getElementById('tut-keys').innerHTML;
    ok.shoot = until(() => { face(0, m.oppGoalZ(0)); I.edges.add('Mouse0'); I.mouseL = true; EGO.Game.stepManual(24, false); I.mouseL = false; I.up.add('Mouse0'); EGO.Game.stepManual(90, false); }, 14);
    const last = { title: (EGO.Game.stepManual(2, true), document.getElementById('tut-title').textContent) };
    for (let i = 0; i < 100 && EGO.Game.state === 'match'; i++) EGO.Game.stepManual(10, false);
    return { ok, pics, last, state: EGO.Game.state, step: T.step };
  });
  check('every step can be done with real keys and mouse buttons (a missed shot comes back to you)', Object.values(run.ok).every(Boolean), run.ok);
  check('PASS shows the right mouse button, SCORE the left one', run.pics.pass === 'right mouse' && run.pics.shoot === 'left mouse', run.pics);
  check('the last step says YOU ARE READY', run.last.title === 'YOU ARE READY', run.last);
  const end = await A.evaluate(() => ({ state: EGO.Game.state, title: document.getElementById('r-title').textContent, earn: document.getElementById('r-earn').textContent, again: document.getElementById('r-again').textContent, em: EGO.Save.data.emeralds, done: EGO.Save.data.tutorial, played: EGO.Save.data.stats.played }));
  check('the end: TUTORIAL DONE, +100 first time, it does not count as a match', end.state === 'results' && end.title === 'TUTORIAL DONE' && /\+100/.test(end.earn) && end.em === 600 && end.done && end.played === 0, end);
  await A.screenshot({ path: __dirname + '/shots/tut2_done.png', timeout: 120000 });
  const next = await A.evaluate(() => { document.getElementById('r-again').click(); const r = { mode: EGO.Game.match.mode, again: document.getElementById('r-again').textContent }; EGO.Game.toLobby(); return Object.assign(r, { btn: !document.getElementById('go-tut').hidden }); });
  check('PLAY A QUICK MATCH starts one; the start screen button goes away', next.mode === 'quick' && !next.btn, next);
  const again = await A.evaluate(() => { EGO.UI.show('howto'); document.getElementById('howto-tut').click(); EGO.Game.stepManual(2, true); const r = { mode: EGO.Game.match.mode }; EGO.Game.forfeit(); return Object.assign(r, { state: EGO.Game.state, em: EGO.Save.data.emeralds }); });
  check('How to Play has PLAY THE TUTORIAL; quitting goes back with no bonus', again.mode === 'tutorial' && again.state === 'lobby' && again.em === 600, again);
  // SKIP: the button, ENTER, the pause menu: straight into a real match
  const skip = await A.evaluate(() => {
    const G = EGO.Game, out = {};
    G.startMatch('tutorial'); G.stepManual(2); document.getElementById('tut-skip').click(); out.button = G.match.mode;
    G.startMatch('tutorial'); G.stepManual(2); EGO.Input.edges.add('Enter'); G.stepManual(1); out.enter = G.match.mode;
    G.startMatch('tutorial'); G.stepManual(2); G.pause(); out.label = document.getElementById('p-forfeit').textContent; document.getElementById('p-forfeit').click(); out.pause = G.match.mode; out.state = G.state;
    out.em = EGO.Save.data.emeralds;
    G.toLobby();
    return out;
  });
  check('SKIP, ENTER and the pause menu (SKIP TUTORIAL) all go straight into a quick match, no bonus', skip.button === 'quick' && skip.enter === 'quick' && skip.label === 'SKIP TUTORIAL' && skip.pause === 'quick' && skip.state === 'match' && skip.em === 600, skip);
  await A.context().close();

  // a French keyboard: the pictures say Z Q S D
  {
    const F = await mk({ viewport: { width: 1280, height: 720 } }, () => { Object.defineProperty(Navigator.prototype, 'keyboard', { get: () => ({ getLayoutMap: () => Promise.resolve(new Map([['KeyW', 'z'], ['KeyA', 'q'], ['KeyS', 's'], ['KeyD', 'd'], ['KeyQ', 'a']])) }) }); });
    const k = await F.evaluate(() => { EGO.Game.startMatch('tutorial'); EGO.Game.stepManual(3, true); return [...document.querySelectorAll('#tut-keys .kc')].map((e) => e.textContent).join(''); });
    check('a French (AZERTY) keyboard sees Z Q S D', k === 'ZQSD', k);
    await F.context().close();
  }

  // phones
  for (const [w, h, tag] of [[390, 844, 'up'], [844, 390, 'side']]) {
    const P = await mk({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await P.evaluate(() => { EGO.Save.data.settings.autoFs = false; });
    await P.tap('#go-tut');
    const lay = await P.evaluate(() => {
      EGO.Game.stepManual(3, true);
      const r = (el) => { const q = el.getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right), t: Math.round(q.top), b: Math.round(q.bottom) }; };
      const box = r(document.getElementById('tutbox'));
      const others = ['#minimap', '.scorebar', '#touch [data-act="pause"]', '#touch [data-act="cam"]', '#touch [data-act="emote"]', '#touch [data-act="shoot"]', '#t-stick .base', '#fkpanel'].map((s) => document.querySelector(s)).filter((e) => e && e.offsetParent && getComputedStyle(e).display !== 'none' && !e.hidden).map((e) => [e.id || e.className || e.dataset.act, r(e)]);
      const hits = others.filter(([, q]) => !(box.r <= q.l || q.r <= box.l || box.b <= q.t || q.b <= box.t)).map(([n]) => n);
      // the PASS step: the PASS button glows
      const m = EGO.Game.match; m.tutStep(2); EGO.Game.stepManual(2, true);
      const glow = document.querySelector('#touch [data-act="pass"]').classList.contains('tut-glow');
      m.tutStep(0); EGO.Game.stepManual(2, true);
      return { box, vw: innerWidth, vh: innerHeight, hits, text: document.getElementById('tut-text').textContent, wide: document.documentElement.scrollWidth <= innerWidth, glow };
    });
    check('phone ' + tag + ': the box fits, covers nothing, uses phone words, and the button to press glows', lay.box.l >= 0 && lay.box.r <= lay.vw && !lay.hits.length && /LEFT THUMB/.test(lay.text) && lay.wide && lay.glow, lay);
    await P.screenshot({ path: __dirname + '/shots/tut3_phone_' + tag + '.png', timeout: 120000 });
    await P.context().close();
  }
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
