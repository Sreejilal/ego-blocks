// Restarts: a real throw-in (ball over your head, you stand still, opponents keep back, pass throws it to a
// teammate, shoot throws it where you aim), corners you cross or shoot, goal kicks the keeper plays long,
// and the 6 second limit. Also the bigger pitch and the 9-wide goal.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const A = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); A.setDefaultTimeout(120000);
  A.on('pageerror', (e) => logs.push(e.message));
  await A.goto(URL, { timeout: 120000 }); await A.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
  // a restart for your team right next to you: type 'side' (throw-in) or 'end' (corner)
  const restart = (where) => A.evaluate((where) => {
    if (EGO.Game.match) EGO.Game.toLobby();
    const s = EGO.Save.data.settings; s.cutins = false; s.cam = 'third'; s.camPicked = true;
    EGO.Game.startMatch('quick');
    for (let i = 0; i < 80 && EGO.Game.match.phase !== 'play'; i++) EGO.Game.stepManual(10, false);
    const m = EGO.Game.match, h = m.human, b = m.ball, them = 1 - h.team, gz = m.oppGoalZ(h.team);
    const x = where === 'side' ? EGO.PITCH.W + 1 : 6, z = where === 'side' ? 0 : gz + Math.sign(gz) * 1;
    b.release(); b.pos.set(x, 0.3, z); b.vel.set(0, 0, 0); b.lastTeam = them; b.kick = null;
    m.onOut();
    // you are the nearest one, everyone else steps away
    const spot = where === 'side' ? { x: EGO.PITCH.W - 1, z: 0 } : { x: EGO.PITCH.W - 2, z: gz - Math.sign(gz) * 2 };
    for (const p of m.players) if (p !== h && !p.isGK) p.pos.set(p.pos.x * 0.3, 0, p.pos.z * 0.5);
    h.pos.set(spot.x, 0, spot.z);
    for (let i = 0; i < 80 && m.phase !== 'play'; i++) EGO.Game.stepManual(2, false);
    EGO.Game.stepManual(2, true);
    return { type: m.setPieceBy && m.setPieceBy.setPiece && m.setPieceBy.setPiece.type, mine: m.setPieceBy === h, ballY: +b.pos.y.toFixed(2), toast: document.getElementById('toasts').textContent };
  }, where);

  const pitch = await A.evaluate(() => ({ W: EGO.PITCH.W, L: EGO.PITCH.L, GW: EGO.PITCH.GW, GH: EGO.PITCH.GH }));
  check('the pitch is 27 x 42 and the goal 9 x 3', pitch.W === 27 && pitch.L === 42 && pitch.GW === 4.5 && pitch.GH === 3, pitch);

  const t = await restart('side');
  check('a throw-in: it is yours, with the ball over your head', t.type === 'throw' && t.mine && t.ballY > 1.9, t);
  check('it tells you which buttons throw it', /THROW-IN/.test(t.toast), t.toast);
  await A.screenshot({ path: __dirname + '/shots/sp1_throwin.png', timeout: 120000 });
  const still = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, x0 = h.pos.x, z0 = h.pos.z;
    EGO.Input.down.add('KeyW'); EGO.Game.stepManual(30, false); EGO.Input.down.delete('KeyW');
    const near = Math.min(...m.opponents(h).map((o) => Math.hypot(o.pos.x - h.pos.x, o.pos.z - h.pos.z)));
    return { moved: +Math.hypot(h.pos.x - x0, h.pos.z - z0).toFixed(2), near: +near.toFixed(1), still: !!h.setPiece };
  });
  check('you stand still holding it, and opponents keep 5 blocks back', still.moved < 0.3 && still.near >= 4.9 && still.still, still);
  const thr = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball;
    EGO.Input.edges.add('Mouse2'); EGO.Input.mouseR = true; EGO.Game.stepManual(1, false); EGO.Input.mouseR = false; EGO.Input.up.add('Mouse2'); EGO.Game.stepManual(2, false);
    const r = { thrown: !!(b.kick && b.kick.by === h), style: h.kickStyle, to: b.kick && b.kick.to && b.kick.to.team === h.team };
    EGO.Game.stepManual(30, false);
    return Object.assign(r, { phase: m.phase });
  });
  check('pass throws it to a teammate, and it stays in play', thr.thrown && thr.style === 'throw' && thr.to && thr.phase === 'play', thr);

  const c = await restart('end');
  check('a corner: yours, taken from the corner', c.type === 'corner' && c.mine, c);
  const cs = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human, b = m.ball;
    EGO.Input.edges.add('Mouse0'); EGO.Input.mouseL = true; EGO.Game.stepManual(1, false);
    return { shot: !!(b.kick && b.kick.by === h && b.kick.type === 'shot'), speed: +b.vel.length().toFixed(1) };
  });
  check('shoot kicks the corner where you aim', cs.shot && cs.speed > 12, cs);

  const auto = await restart('side');
  const waited = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; EGO.Game.stepManual(60 * 6 + 30, false); return { gone: m.ball.owner !== h, piece: !!h.setPiece }; });
  check('wait 6 seconds and it is thrown to a teammate for you', auto.mine && waited.gone && !waited.piece, waited);

  const bots = await A.evaluate(() => { const r = EGO.simulate('quick', 0.6, 240, 4); return r; });
  check('bot matches still flow (no restart loops)', bots && bots.goals >= 1 && (bots.phases.out || 0) < 30, { goals: bots.goals, outSeconds: +(bots.phases.out || 0).toFixed(1) });
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
