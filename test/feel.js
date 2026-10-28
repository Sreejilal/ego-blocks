// How the game feels: the feint (a step-over nobody can tackle you through, once every 5s), seeing that you
// have the ball, a quick tap is a proper shot, a shot pressed just before the ball arrives still goes,
// aim help for mouse players, and first person as the starting camera.
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
  check('first person is the starting camera', await A.evaluate(() => EGO.Save.data.settings.cam) === 'first');
  // a match in play with the ball at your feet
  const setup = () => A.evaluate(() => {
    if (EGO.Game.match) EGO.Game.toLobby();
    EGO.Save.data.settings.cutins = false; EGO.Game.startMatch('quick');
    for (let i = 0; i < 80 && EGO.Game.match.phase !== 'play'; i++) EGO.Game.stepManual(10, false);
    const m = EGO.Game.match, h = m.human; m.possess(h); EGO.Game.stepManual(2, true);
    return m.ball.owner === h;
  });
  check('you can be given the ball', await setup());
  const cue = await A.evaluate(() => ({ ring: !!(EGO.Game.match.human.ownRing && EGO.Game.match.human.ownRing.visible), frame: document.getElementById('xhair').classList.contains('ball'), tag: !document.getElementById('balltag').hidden }));
  check('with the ball: a ring at your feet, a frame round the crosshair and BALL', cue.ring && cue.frame && cue.tag, cue);
  await A.screenshot({ path: __dirname + '/shots/feel1_ball.png', timeout: 120000 });
  // the feint
  const f = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, o = m.opponents(h).find((q) => !q.isGK);
    const x0 = h.pos.x, z0 = h.pos.z;
    EGO.Input.edges.add('KeyC'); EGO.Game.stepManual(4, false);
    const mid = { state: h.state, proof: h.tackleProof > 0, feint: h.feint };
    // a defender slides in during the step-over: it is an ankle breaker, you keep the ball
    o.pos.set(h.pos.x + Math.sin(h.yaw) * 1.2, 0, h.pos.z + Math.cos(h.yaw) * 1.2);
    const won = m.tryTackleHit ? null : null;
    EGO.Game.stepManual(20, false);
    const moved = Math.hypot(h.pos.x - x0, h.pos.z - z0);
    // again straight away: not ready
    EGO.Input.edges.add('KeyC'); EGO.Game.stepManual(2, false);
    const again = h.feint !== 0 || h.state === 'dash';
    return { mid, moved: +moved.toFixed(2), keep: m.ball.owner === h, again, cd: h.dodgeCharges, label: document.getElementById('slot-c').textContent };
  });
  check('C feints: a step-over to the side, tackle-proof while it happens', f.mid.state === 'dash' && f.mid.proof && f.mid.feint !== 0 && f.moved > 1, f);
  check('you keep the ball through the feint', f.keep, f);
  check('it cannot be spammed (once every 5 seconds), and the HUD says FEINT', !f.again && f.cd === 0 && /FEINT/.test(f.label), f);
  const back = await A.evaluate(() => { EGO.Game.stepManual(60 * 5 + 10, false); return EGO.Game.match.human.dodgeCharges; });
  check('the feint is back after 5 seconds', back === 1, back);
  const tackled = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human; m.possess(h); h.dodgeCharges = 1;
    EGO.Input.edges.add('KeyC'); EGO.Game.stepManual(2, false);
    const o = m.opponents(h).find((q) => !q.isGK); o.pos.set(h.pos.x + 0.6, 0, h.pos.z); o.state = 'free'; o.tackleCd = 0;
    const ok = m.tackle(o, h.pos.x - o.pos.x, h.pos.z - o.pos.z); EGO.Game.stepManual(25, false);
    return { tried: ok, owner: m.ball.owner === h, oState: o.state };
  });
  check('a tackle into the feint does not take the ball', tackled.owner, tackled);
  // shooting, each from a fresh kickoff
  await setup();
  const tap = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human; m.possess(h); EGO.Game.stepManual(2, false);
    EGO.Input.edges.add('Mouse0'); EGO.Input.mouseL = true; EGO.Game.stepManual(1, false); EGO.Input.mouseL = false; EGO.Input.up.add('Mouse0'); EGO.Game.stepManual(2, false);
    return { gone: m.ball.owner !== h, speed: +m.ball.vel.length().toFixed(1) };
  });
  check('a quick tap is a proper shot', tap.gone && tap.speed > 14, tap);
  await setup();
  const early = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball;
    for (const o of m.players) if (o !== h) o.pos.x += o.pos.x > h.pos.x ? 8 : -8; // nobody else near the ball
    b.owner = null; b.pos.set(h.pos.x + Math.sin(h.yaw) * 2.2, 0.3, h.pos.z + Math.cos(h.yaw) * 2.2); b.vel.set(-Math.sin(h.yaw) * 9, 0, -Math.cos(h.yaw) * 9);
    EGO.Input.edges.add('Mouse0'); EGO.Input.mouseL = true; EGO.Game.stepManual(1, false); EGO.Input.mouseL = false; EGO.Input.up.add('Mouse0');
    EGO.Game.stepManual(1, false); const buffered = !!h.shotBuffer || !!(b.kick && b.kick.by === h); EGO.Game.stepManual(20, false);
    return { buffered, shot: !!(b.kick && b.kick.by === h && b.kick.type === 'shot') };
  });
  check('a shot pressed just before the ball arrives still goes', early.buffered && early.shot, early);
  const assist = await A.evaluate(() => { const s = EGO.Save.data.settings; return { on: s.assist !== false, shown: getComputedStyle(document.getElementById('set-assist')).display !== 'none' }; });
  check('aim help is on for mouse players too (and in the menu)', assist.on && assist.shown, assist);
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
