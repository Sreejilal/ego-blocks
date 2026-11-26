// Shooting is harder (owner, Nov 26 2026: "it is way too easy to score"): your open-play shots can go off the spot you aim
// at, a little close in, a lot from far, sprinting, under pressure or with a full blast. Free kicks and special moves stay exact.
// node test/shooting.js   (run `npm run build` first)
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

process.on('unhandledRejection', (e) => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const r = await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('quick', { noIntro: true }); G.manual = true; G.stepManual(3, false);
    const m = G.match, h = m.human, s = m.dir(h.team), gz = s * EGO.PITCH.L, foes = m.opponents(h).filter((q) => !q.isGK);
    for (const q of foes) q.pos.set(30, 0, -s * 40); // out of the way
    const spread = (dist, power, sprint, pressed) => {
      h.pos.set(0, 0, gz - s * dist); h.sprint = !!sprint; h.vel.set(0, 0, sprint ? s * 11 : 0);
      if (pressed) foes[0].pos.set(0.8, 0, gz - s * dist + s * 0.4); else foes[0].pos.set(30, 0, -s * 40);
      const T = { x: 4.4, y: 2.6, z: gz };
      let sum = 0, max = 0;
      for (let i = 0; i < 300; i++) { const t = m.shotError(h, T, power); const off = Math.hypot(t.x - T.x, t.y - T.y); sum += off; max = Math.max(max, off); }
      return { avg: +(sum / 300).toFixed(2), max: +max.toFixed(2) };
    };
    const close = spread(9, 0.8), far = spread(30, 0.8), farBlast = spread(30, 1, true), pressed = spread(14, 0.8, false, true), calm = spread(14, 0.8);
    // a real shot goes through it, and the ball still flies
    h.pos.set(0, 0, gz - s * 20); h.sprint = false; h.vel.set(0, 0, 0); m.possess(h, true); m.lastShotErr = null;
    const shot = m.shootAt(h, { x: 0, y: 1.2, z: gz }, 1);
    const used = m.lastShotErr != null && m.lastShotErr > 0;
    m.lastShotErr = null; m.ball.reset(0, gz - s * 20); m.possess(h, true);
    m.shootAt(h, { x: 0, y: 1.2, z: gz }, 1, { special: 'volley' });
    const exact = m.lastShotErr == null;
    return { close, far, farBlast, pressed, calm, shot, used, exact };
  });
  check('close in (9 blocks) your shot goes nearly where you aim', r.close.avg < 0.25, r.close);
  check('from far (30 blocks) it can be well off: aiming for the corner is a risk', r.far.avg > 0.6 && r.far.max > 1.5, r.far);
  check('sprinting into a full blast from far is wilder still', r.farBlast.avg > r.far.avg * 1.4, { far: r.far, farBlast: r.farBlast });
  check('a defender right on you makes it worse than a calm shot from the same spot', r.pressed.avg > r.calm.avg * 1.5, { pressed: r.pressed, calm: r.calm });
  check('a real shot uses it; special moves stay exact', r.shot && r.used && r.exact, r);
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.filter((l) => l.startsWith('PAGEERROR')).slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
