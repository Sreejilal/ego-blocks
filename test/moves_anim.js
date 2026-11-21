// The FEINT step-over and the Awakening animations (owner, Nov 2026: "an animation of the person doing a step over and an
// animation for their awakening"). Plays both in a real match, checks the joints really move that way, and saves pictures:
// test/shots/stepover_*.png and test/shots/awaken_*.png. Run `node build.js` first.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

(async () => {
  const { browser, page, logs } = await open({ viewport: { width: 960, height: 540 } });
  await page.evaluate(() => { EGO.Game.startMatch('quick'); });
  const setup = () => page.evaluate(() => {
    const G = EGO.Game, m = G.match;
    for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1);
    const p = m.human, s = Math.sign(m.oppGoalZ(p.team));
    for (const q of m.players) { if (q !== p) { q.ai.think = 99; q.vel.set(0, 0, 0); q.pos.x = q.pos.x > 0 ? 14 : -14; } }
    p.pos.set(0, 0, -s * 2); p.setState('free'); p.vel.set(0, 0, 0); p.yaw = s > 0 ? 0 : Math.PI; m.possess(p, true);
    p.dodgeCharges = 1; p.dodgeRe = 0; p.awakeT = 0; p.awakeRest = 0;
    EGO.Cam.yaw = p.yaw + Math.PI * 0.62; // from the side and a little in front, so the foot going round the ball shows
    G.stepManual(2, true);
    return s;
  });

  // ---------- the step-over ----------
  await setup();
  const step = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, p = m.human;
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const ok = m.dodge(p, rx, rz), side = p.feint, seen = { minX: 9, minZ: 9, maxZ: -9, lean: 0, head: 0 };
    const leg = side > 0 ? p.P.legR : p.P.legL;
    const frames = [];
    for (let i = 0; i < 18; i++) {
      G.stepManual(1, true);
      seen.minX = Math.min(seen.minX, leg.rotation.x); seen.minZ = Math.min(seen.minZ, leg.rotation.z); seen.maxZ = Math.max(seen.maxZ, leg.rotation.z);
      seen.lean = Math.max(seen.lean, Math.abs(p.P.body.rotation.z)); seen.head = Math.max(seen.head, Math.abs(p.P.headP.rotation.y));
      frames.push(i);
    }
    return { ok, side, seen };
  });
  check('FEINT: the stepping leg lifts forward over the ball', step.ok && step.seen.minX < -0.6, step.seen.minX);
  check('FEINT: the leg circles from inside to outside (a wide sideways sweep)', step.seen.maxZ - step.seen.minZ > 0.9, +(step.seen.maxZ - step.seen.minZ).toFixed(2));
  check('FEINT: the body leans and the head turns to sell it', step.seen.lean > 0.3 && step.seen.head > 0.35, step.seen);
  // pictures, frame by frame
  await setup();
  await page.evaluate(() => { const m = EGO.Game.match, p = m.human; m.dodge(p, Math.cos(p.yaw), -Math.sin(p.yaw)); });
  for (const [i, n] of [[1, 2], [2, 3], [3, 3], [4, 3], [5, 4]]) {
    await page.evaluate((n) => EGO.Game.stepManual(n, true), n);
    await page.screenshot({ path: __dirname + '/shots/stepover_' + i + '.png' });
  }

  // ---------- the Awakening ----------
  await setup();
  const aw = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, p = m.human;
    const ok = m.activateAwaken(p);
    let top = 0, spin = 0, stance = 0, n = 0;
    while (p.state === 'awaken' && n++ < 400) {
      G.stepManual(1, true);
      top = Math.max(top, p.P.body.position.y); spin = Math.max(spin, p.P.root.rotation.y - p.yaw);
      stance = Math.max(stance, p.P.legL.rotation.z - p.P.legR.rotation.z);
    }
    return { ok, top: +top.toFixed(2), spin: +spin.toFixed(2), stance: +stance.toFixed(2), fx: p._awFx, after: p.state };
  });
  check('AWAKENING: bursts up into the air (body rises over 1 block)', aw.ok && aw.top > 1.6, aw.top);
  check('AWAKENING: a full spin on the way up', aw.spin > 6, aw.spin);
  check('AWAKENING: lands in a wide stance, with light at the top and a shockwave on landing', aw.stance > 0.4 && aw.fx === 2 && aw.after === 'free', aw);
  await setup();
  await page.evaluate(() => { const m = EGO.Game.match; m.activateAwaken(m.human); });
  for (const [i, u] of [[1, 0.2], [2, 0.42], [3, 0.6], [4, 0.8], [5, 0.95]]) {
    await page.evaluate((u) => { const G = EGO.Game, p = G.match.human; let n = 0; while (p.state === 'awaken' && p.stateT / p.stateDur < u && n++ < 300) G.stepManual(1, true); }, u);
    await page.screenshot({ path: __dirname + '/shots/awaken_' + i + '.png' });
  }

  const errs = logs.filter((l) => /PAGEERROR|error:/i.test(l));
  check('no page errors', !errs.length, errs.slice(0, 3));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})();
