// The tutorial: NEW? PLAY THE TUTORIAL on the start screen (until you have done it) and on How to Play. 11 steps,
// each done when you do it, with the words for your controls. Played here with real keys and mouse buttons.
// The end gives a first-time bonus and a button straight into a quick match. The box fits on phones.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts) => {
    const p = await (await browser.newContext(opts)).newPage(); p.setDefaultTimeout(120000);
    p.on('pageerror', (e) => logs.push(e.message));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(URL, { timeout: 120000 }); await p.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 }); return p;
  };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  check('a new player sees NEW? PLAY THE TUTORIAL', await A.evaluate(() => !document.getElementById('go-tut').hidden));
  await A.evaluate(() => { const s = EGO.Save.data.settings; s.cam = 'third'; s.camPicked = true; s.cutins = false; });
  await A.click('#go-tut');
  const s1 = await A.evaluate(() => { EGO.Game.stepManual(3, true); return { mode: EGO.Game.match.mode, box: !document.getElementById('tutbox').hidden, n: document.getElementById('tut-n').textContent, title: document.getElementById('tut-title').textContent, text: document.getElementById('tut-text').textContent, mark: EGO.TutHud.mark && EGO.TutHud.mark.visible, clock: document.getElementById('clock').textContent }; });
  check('step 1: MOVE with the keyboard words and a gold square', s1.mode === 'tutorial' && s1.box && /STEP 1 OF 11/.test(s1.n) && s1.title === 'MOVE' && /W A S D/.test(s1.text) && s1.mark && s1.clock === '1/11', s1);
  await A.screenshot({ path: __dirname + '/shots/tut1_move.png', timeout: 120000 });
  // play it through with real inputs
  const run = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, T = m.tut, I = EGO.Input, C = EGO.Cam, d = m.teams[1][0], seen = [];
    const id = () => EGO.TUT_STEPS[T.step].id;
    const face = (x, z) => { C.yaw = Math.atan2(x - h.pos.x, z - h.pos.z); C.snapYaw = null; };
    const until = (fn, max = 300) => { const s = T.step; for (let i = 0; i < max && T.step === s && m.phase !== 'end'; i++) fn(i); return T.step !== s; };
    const ok = {};
    ok.move = until(() => { face(T.mark.x, T.mark.z); I.down.add('KeyW'); EGO.Game.stepManual(4, false); }); I.down.delete('KeyW');
    ok.look = until(() => { I.down.add('ArrowLeft'); EGO.Game.stepManual(4, false); }); I.down.delete('ArrowLeft');
    ok.sprint = until(() => { I.down.add('KeyW'); I.down.add('ShiftLeft'); EGO.Game.stepManual(4, false); }); I.down.delete('KeyW'); I.down.delete('ShiftLeft');
    ok.ball = until(() => { face(m.ball.pos.x, m.ball.pos.z); I.down.add('KeyW'); EGO.Game.stepManual(3, false); }); I.down.delete('KeyW');
    ok.pass = until(() => { I.edges.add('Mouse2'); EGO.Game.stepManual(1, false); I.up.add('Mouse2'); EGO.Game.stepManual(6, false); }, 40);
    ok.back = until(() => { if (m.ball.owner !== h) { face(m.ball.pos.x, m.ball.pos.z); I.down.add('KeyW'); } EGO.Game.stepManual(3, false); }, 600); I.down.delete('KeyW');
    seen.push(document.getElementById('tut-title').textContent);
    ok.shoot = until(() => { face(0, m.oppGoalZ(0)); I.edges.add('Mouse0'); I.mouseL = true; EGO.Game.stepManual(24, false); I.mouseL = false; I.up.add('Mouse0'); EGO.Game.stepManual(60, false); if (m.ball.owner !== h && m.phase === 'play') { m.ball.reset(h.pos.x, h.pos.z); m.possess(h, true); } }, 12);
    ok.feint = until(() => { I.down.add('KeyD'); I.edges.add('KeyC'); EGO.Game.stepManual(4, false); I.down.delete('KeyD'); EGO.Game.stepManual(20, false); }, 20);
    ok.tackle = until((i) => { face(d.pos.x, d.pos.z); I.down.add('KeyW'); I.down.add('ShiftLeft'); if (Math.hypot(d.pos.x - h.pos.x, d.pos.z - h.pos.z) < 3 && i % 8 === 0) I.edges.add('KeyF'); EGO.Game.stepManual(3, false); }, 900); I.down.delete('KeyW'); I.down.delete('ShiftLeft');
    ok.ability = until(() => { I.edges.add('KeyQ'); EGO.Game.stepManual(3, false); I.edges.add('KeyE'); EGO.Game.stepManual(3, false); }, 20);
    const last = { title: (EGO.Game.stepManual(2, true), document.getElementById('tut-title').textContent) };
    for (let i = 0; i < 100 && EGO.Game.state === 'match'; i++) EGO.Game.stepManual(10, false);
    return { ok, last, state: EGO.Game.state, step: T.step };
  });
  check('every step can be done with real keys and mouse buttons', Object.values(run.ok).every(Boolean), run.ok);
  check('the last step says YOU ARE READY', run.last.title === 'YOU ARE READY', run.last);
  const end = await A.evaluate(() => ({ state: EGO.Game.state, title: document.getElementById('r-title').textContent, earn: document.getElementById('r-earn').textContent, again: document.getElementById('r-again').textContent, em: EGO.Save.data.emeralds, done: EGO.Save.data.tutorial, played: EGO.Save.data.stats.played }));
  check('the end: TUTORIAL DONE, +100 first time, it does not count as a match', end.state === 'results' && end.title === 'TUTORIAL DONE' && /\+100/.test(end.earn) && end.em === 600 && end.done && end.played === 0, end);
  await A.screenshot({ path: __dirname + '/shots/tut2_done.png', timeout: 120000 });
  const next = await A.evaluate(() => { document.getElementById('r-again').click(); const r = { mode: EGO.Game.match.mode, again: document.getElementById('r-again').textContent }; EGO.Game.toLobby(); return Object.assign(r, { btn: !document.getElementById('go-tut').hidden }); });
  check('PLAY A QUICK MATCH starts one; the start screen button goes away', next.mode === 'quick' && !next.btn, next);
  const again = await A.evaluate(() => { EGO.UI.show('howto'); document.getElementById('howto-tut').click(); EGO.Game.stepManual(2, true); const r = { mode: EGO.Game.match.mode }; EGO.Game.forfeit(); return Object.assign(r, { state: EGO.Game.state, em: EGO.Save.data.emeralds }); });
  check('How to Play has PLAY THE TUTORIAL; quitting goes back with no bonus', again.mode === 'tutorial' && again.state === 'lobby' && again.em === 600, again);
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
      return { box, vw: innerWidth, vh: innerHeight, hits, text: document.getElementById('tut-text').textContent, wide: document.documentElement.scrollWidth <= innerWidth };
    });
    check('phone ' + tag + ': the box fits, covers nothing and uses phone words', lay.box.l >= 0 && lay.box.r <= lay.vw && !lay.hits.length && /LEFT THUMB/.test(lay.text) && lay.wide, lay);
    await P.screenshot({ path: __dirname + '/shots/tut3_phone_' + tag + '.png', timeout: 120000 });
    await P.context().close();
  }
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
