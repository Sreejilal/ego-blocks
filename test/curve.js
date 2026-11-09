// Curve shots: hold A/D (the stick) while you charge and the ball swings out and bends back in to where you aimed.
// The physics part runs on the server's copy of the game (fast); the last part opens the browser for the power bar and the dots.
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

function setup() {
  const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: 3 });
  for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(1 / 60);
  const p = m.teams[0].find((q) => !q.isGK);
  const gz = m.oppGoalZ(0), s = Math.sign(gz);
  for (const q of m.players) if (q !== p) q.pos.set(30, 0, 0); // everyone out of the way (the keeper too)
  p.pos.set(-4, 0, gz - s * 18); p.vel.set(0, 0, 0); p.setState('free'); p.yaw = s > 0 ? 0 : Math.PI;
  m.possess(p, true);
  m.ball.pos.set(p.pos.x + Math.sin(p.yaw) * 0.6, 0.3, p.pos.z + Math.cos(p.yaw) * 0.6);
  return { m, p, gz, s };
}
/** follow the ball alone until it crosses the goal line: where it crossed and how far it swung off the straight line */
function fly(m, from, target) {
  const b = m.ball, ux = target.x - from.x, uz = target.z - from.z, L = Math.hypot(ux, uz);
  let swing = 0, cross = null;
  for (let i = 0; i < 240 && !cross; i++) {
    const ox = b.pos.x, oz = b.pos.z, oy = b.pos.y;
    b.update(1 / 60);
    const side = ((b.pos.x - from.x) * uz - (b.pos.z - from.z) * ux) / L; // + means left of the line, looking along the shot
    if (Math.abs(side) > Math.abs(swing)) swing = side;
    if ((oz - target.z) * (b.pos.z - target.z) <= 0 && oz !== b.pos.z) { const k = (target.z - oz) / (b.pos.z - oz); cross = { x: +(ox + (b.pos.x - ox) * k).toFixed(2), y: +(oy + (b.pos.y - oy) * k).toFixed(2) }; }
  }
  return { cross, swing: +swing.toFixed(2) };
}
const ctl = (o = {}) => Object.assign({ moveX: 0, moveY: 0, sprint: false, jump: false, jumpHeld: false, shootDown: false, shootHeld: false, shootUp: false, passDown: false, passUp: false, passHeld: false, dodge: false, tackle: false, ab: [false, false, false], flow: false, emote: -1, awaken: false, shiftLock: false, item: false }, o);

// 1) straight, curve right, curve left: all three end up where you aimed, the curlers swing out on the other side first
const shots = {};
for (const ci of [0, 1, -1]) {
  const { m, p, gz } = setup();
  const target = { x: 2.5, y: 1.4, z: gz };
  m.shootAt(p, target, 0.8, { curveIn: ci });
  const k = m.ball.kick, from = { x: m.ball.pos.x, z: m.ball.pos.z }; // the kick puts the ball at your foot
  const f = fly(m, from, target);
  shots[ci] = Object.assign(f, { curved: k.curved, curl: k.curl || 0, miss: f.cross ? +Math.hypot(f.cross.x - target.x, f.cross.y - target.y).toFixed(2) : 99 });
  m.dispose();
}
check('a straight shot goes where you aim', shots[0].miss < 0.5 && !shots[0].curved && Math.abs(shots[0].swing) < 0.2, shots[0]);
check('a curve-right shot still ends up where you aim', shots[1].miss < 0.8 && shots[1].curved, shots[1]);
check('a curve-left shot still ends up where you aim', shots[-1].miss < 0.8 && shots[-1].curved, shots[-1]);
check('curve right swings out left first (and left swings out right), about a block or more', shots[1].swing > 0.7 && shots[-1].swing < -0.7, { right: shots[1].swing, left: shots[-1].swing });

// 2) a tiny wobble on the stick is still a straight shot
{
  const { m, p, gz } = setup();
  m.shootAt(p, { x: 0, y: 1.2, z: gz }, 0.8, { curveIn: G.CURVE_MIN * 0.5 });
  check('a small wobble on the stick does not curve the shot', !m.ball.kick.curved, { min: G.CURVE_MIN });
  m.dispose();
}

// 3) the real controls: hold shoot, hold D, let go
{
  const { m, p, gz, s } = setup();
  const cy = s > 0 ? 0 : Math.PI, aim = { x: -1.5, y: 1.2, z: gz };
  p.isHuman = true;
  m.updateHuman(1 / 60, ctl({ shootDown: true, shootHeld: true, moveX: 1, camYaw: cy, aim }), p);
  for (let i = 0; i < 24; i++) m.updateHuman(1 / 60, ctl({ shootHeld: true, moveX: 1, camYaw: cy, aim }), p);
  const mid = { charging: p.charging, curve: +(p.shotCurve || 0).toFixed(2) };
  m.updateHuman(1 / 60, ctl({ shootUp: true, moveX: 0, camYaw: cy, aim }), p); // let go of D and shoot at the same moment
  const k = m.ball.kick || {}, from = { x: m.ball.pos.x, z: m.ball.pos.z };
  const f = fly(m, from, aim);
  check('holding D while charging builds up curve', mid.charging && mid.curve > 0.9, mid);
  check('letting go fires a curve shot that bends right onto the aim', k.type === 'shot' && k.curl > 0.9 && f.swing > 0.5 && f.cross && Math.hypot(f.cross.x - aim.x, f.cross.y - aim.y) < 0.9, { curl: k.curl, f });
  check('after the shot the curve is cleared for next time', !p.charging && p.shotCurve === 0, { charging: p.charging, curve: p.shotCurve });
  m.dispose();
}

// 4) a curler that a slide tackle knocks away stops bending
{
  const { m, p, gz } = setup();
  m.shootAt(p, { x: 2, y: 0.6, z: gz }, 0.7, { curveIn: 1 });
  for (let i = 0; i < 4; i++) m.ball.update(1 / 60);
  const d = m.teams[1].find((q) => !q.isGK), b = m.ball;
  const ux = b.vel.x, uz = b.vel.z, l = Math.hypot(ux, uz);
  d.pos.set(b.pos.x + ux / l * 1.2, 0, b.pos.z + uz / l * 1.2); d.state = 'slide'; d.slide = { dx: -ux / l, dz: -uz / l, hit: false, hitBall: false }; b.pos.y = 0.4;
  m.updateSlides();
  const hit = !!d.slide.hitBall;
  check('a slide that knocks a curler away stops it bending', !hit || (b.curve.x === 0 && b.curve.z === 0), { hit, curve: [b.curve.x, b.curve.z] });
  m.dispose();
}

// 5) good bots curl some of their shots, and matches still have a healthy number of goals
{
  let curled = 0, shotsN = 0, goals = 0;
  for (let g = 0; g < 4; g++) {
    const m = new G.Match('quick', 0.9, { noHuman: true, autopilot: true, size: 4, length: 150 });
    const orig = m.shootAt.bind(m);
    m.shootAt = function (p, t, pw, o = {}) { shotsN++; if (Math.abs(o.curveIn || 0) >= G.CURVE_MIN) curled++; return orig(p, t, pw, o); };
    for (let i = 0; i < 60 * 200 && m.phase !== 'end'; i++) m.update(1 / 60);
    goals += m.score[0] + m.score[1];
    m.dispose();
  }
  check('good bots curl some of their shots', curled > 0 && curled < shotsN * 0.5, { curled, shots: shotsN });
  check('bot matches still have a healthy number of goals', goals / 4 >= 1 && goals / 4 <= 12, { perMatch: goals / 4 });
}

(async () => {
  // 6) in the browser: the power bar says CURVE RIGHT and the dots show the bend
  const { browser, page, logs } = await open();
  await page.evaluate(() => { EGO.Game.startMatch('quick'); });
  const r = await page.evaluate(() => {
    const G = EGO.Game; let m = G.match;
    for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1);
    const p = m.human, gz = m.oppGoalZ(p.team), s = Math.sign(gz);
    for (const q of m.players) if (q !== p) q.pos.set(30, 0, 0);
    p.pos.set(0, 0, gz - s * 16); p.setState('free'); m.possess(p, true);
    EGO.Cam.yaw = s > 0 ? 0 : Math.PI; EGO.Cam.pitch = -0.05;
    const I = EGO.Input;
    I.locked = true; I.down.add('KeyD'); I.mouseL = true; I.edges.add('Mouse0');
    G.stepManual(20, true);
    const out = { charging: p.charging, curve: +(p.shotCurve || 0).toFixed(2), txt: document.getElementById('charge-txt').textContent, curlBar: document.getElementById('charge').classList.contains('curl'), dots: EGO.ShotHud.dots.filter((d) => d.visible).length };
    return out;
  });
  await page.screenshot({ path: __dirname + '/shots/curve_charge.png' });
  const r2 = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, I = EGO.Input;
    I.mouseL = false; I.up.add('Mouse0'); I.down.delete('KeyD');
    G.stepManual(1, true);
    const k = m.ball.kick || {};
    G.stepManual(2, true);
    return { kick: k.type, curl: k.curl || 0, dotsAfter: EGO.ShotHud.dots.filter((d) => d.visible).length, bar: !document.getElementById('charge').hidden };
  });
  check('the power bar says CURVE RIGHT while you hold D', r.charging && r.curlBar && /CURVE RIGHT/.test(r.txt), r);
  check('dots show the bend while you charge', r.dots >= 8, r);
  check('letting go fires the curve shot and the dots go away', r2.kick === 'shot' && r2.curl > 0.9 && r2.dotsAfter === 0 && !r2.bar, r2);
  const errs = logs.filter((l) => /error/i.test(l));
  check('no errors in the console', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((x) => x.startsWith('FAIL')) ? 1 : 0;
})();
