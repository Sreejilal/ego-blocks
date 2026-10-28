// Calling for the ball: your teammate looks up first (0.3 to 0.9s, with a thinking bubble), then picks
// the pass that fits: ground, lob over a defender, through ball into your run, or a flashy one.
// Tightly marked means WAIT. Bot matches compare thinking passes with the old instant ones.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('quick'); G.manual = true; G.stepManual(170, false); // past kickoff
    // put the play somewhere calm: you at midfield, your teammate with the ball, the other team far away
    window.setup = (opts = {}) => {
      const m = G.match, h = m.human, mate = m.teams[0].find((p) => !p.isGK && !p.isHuman);
      for (const o of m.teams[1]) { if (!o.isGK) { o.pos.set(-20, 0, 25); o.vel.set(0, 0, 0); o.setState('free'); } }
      m.ball.owner = null; m.ball.kick = null;
      h.pos.set(opts.hx || 0, 0, opts.hz || 4); h.vel.set(opts.hvx || 0, 0, opts.hvz || 0); h.setState('free'); h.pickBlock = 0;
      mate.pos.set(6, 0, -6); mate.vel.set(0, 0, 0); mate.setState('free'); mate.pickBlock = 0; mate.ai.look = null; mate.ai.waitT = 0; mate.ai.think = 0; mate.ai.abilIn = 99; mate.flow = 0;
      m.possess(mate, true); m.phase = 'play';
      h.callT = 1.6;
      return { m, h, mate };
    };
    // step the match by hand and note what happens to the ball
    window.watch = (frames, hold) => {
      const m = G.match, out = { firstKickAt: -1, kick: null, labels: [], lookAt: -1 };
      const oLabel = m.label.bind(m);
      m.label = (p, t, c, d) => { out.labels.push(t); return oLabel(p, t, c, d); };
      for (let i = 0; i < frames; i++) {
        if (hold) hold(m);
        m.update(1 / 60);
        const mate = m.teams[0].find((p) => !p.isGK && !p.isHuman);
        if (out.lookAt < 0 && mate.ai.look) out.lookAt = i;
        const k = m.ball.kick;
        if (out.firstKickAt < 0 && k && k.by === mate) { out.firstKickAt = i; out.kick = { type: k.type, toHuman: k.to === m.human, vy: +m.ball.vel.y.toFixed(1), style: mate.kickStyle, curve: +Math.hypot(m.ball.curve.x, m.ball.curve.z).toFixed(1) }; }
      }
      m.label = oLabel;
      return out;
    };
  });

  const calm = await page.evaluate(() => { setup(); return watch(80, (m) => { m.human.mx = m.human.mz = 0; }); });
  const tSec = calm.firstKickAt / 60;
  check('teammate looks up before passing (0.3 to 0.9s)', calm.labels.includes('...') && tSec >= 0.28 && tSec <= 1.1, { seconds: +tSec.toFixed(2), labels: calm.labels });
  check('then passes to you', calm.kick && calm.kick.type === 'pass' && calm.kick.toHuman, calm.kick);

  const marked = await page.evaluate(() => {
    const { m } = setup(); const o = m.teams[1].find((p) => !p.isGK && p.role !== 'DEF'); o.pos.set(0.9, 0, 4.4);
    return watch(70, (m) => { o.pos.set(m.human.pos.x + 0.9, 0, m.human.pos.z + 0.4); o.vel.set(0, 0, 0); o.mx = o.mz = 0; });
  });
  check('tightly marked: WAIT instead of forcing it', marked.labels.includes('WAIT') && !(marked.kick && marked.kick.toHuman), marked);

  const lob = await page.evaluate(() => {
    const { m } = setup(); const o = m.teams[1].find((p) => !p.isGK && p.role !== 'DEF');
    return watch(80, (m) => { o.pos.set(3, 0, -1); o.vel.set(0, 0, 0); o.mx = o.mz = 0; o.setState('stun', 5); m.human.mx = m.human.mz = 0; });
  });
  check('defender in the lane: a lofted ball over him', lob.kick && lob.kick.toHuman && lob.kick.vy > 3, lob.kick);

  const thru = await page.evaluate(() => {
    setup({ hx: -4, hz: 0 });
    return watch(80, (m) => { m.human.mx = 0; m.human.mz = 1; m.human.sprint = true; m.human.vel.z = Math.max(m.human.vel.z, 9); });
  });
  check('sprinting into space: a through ball into your run', thru.labels.includes('THROUGH BALL') && thru.kick && thru.kick.toHuman, { labels: thru.labels, kick: thru.kick });

  // flashy passes: force the dice, then try each style and its animation
  const flashy = await page.evaluate(() => {
    const keep = Math.random; Math.random = () => 0.01;
    setup(); const w = watch(80, (m) => { m.human.mx = m.human.mz = 0; });
    Math.random = keep;
    const anims = {};
    for (const style of ['outside', 'rabona', 'nolook', 'backheel']) {
      const { m, h, mate } = setup(); h.callT = 0;
      if (style === 'backheel') { mate.yaw = Math.PI; }
      m.passTo(mate, h, { style });
      let maxZ = 0, maxHead = 0;
      for (let i = 0; i < 20; i++) { m.update(1 / 60); maxZ = Math.max(maxZ, Math.abs(mate.P.legR.rotation.z)); maxHead = Math.max(maxHead, Math.abs(mate.P.headP.rotation.y)); }
      let got = false; for (let i = 0; i < 160 && !got; i++) { m.update(1 / 60); got = m.ball.owner === h; }
      anims[style] = { style: mate.kickStyle, legZ: +maxZ.toFixed(2), head: +maxHead.toFixed(2), reached: got };
    }
    return { w, anims };
  });
  check('now and then a flashy pass with its own name', flashy.w.kick && flashy.w.kick.style === 'outside' && flashy.w.labels.includes('OUTSIDE BOOT!'), flashy.w);
  const A = flashy.anims;
  check('flashy passes have their own moves', A.rabona.legZ > 0.3 && A.outside.legZ > 0.25 && A.nolook.head > 0.5 && A.backheel.style === 'backheel', A);
  check('flashy passes still reach you', Object.values(A).every((a) => a.reached), A);

  // screenshot: the thinking bubble
  await page.evaluate(() => {
    const { m, mate } = setup({ hz: 0 }); mate.pos.set(2.5, 0, 9); mate.yaw = Math.PI; m.ball.owner = null; m.possess(mate, true); m.human.callT = 1.6;
    EGO.FX.clear(); EGO.Cam.yaw = 0; EGO.Cam.pitch = -0.1;
    for (let i = 0; i < 8; i++) m.update(1 / 60);
    EGO.Game.stepManual(2, true);
  });
  await page.screenshot({ path: __dirname + '/shots/pass1_thinking.png' });

  // bot matches: does thinking first lose the ball more often than the old instant pass?
  const sim = await page.evaluate(() => {
    const run = (think) => {
      const r = { called: 0, reached: 0, lost: 0, teamLost: 0, goalsFor: 0, goalsAgainst: 0 };
      for (let g = 0; g < 16; g++) {
        const m = new EGO.Match('quick', 0.6, { noHuman: true, autopilot: true, length: 240, size: 3, caller: true, thinkPass: think });
        const caller = m.caller;
        let pending = null, last = -1, t = 0;
        while (m.phase !== 'end' && t < 900) {
          m.update(1 / 60); EGO.FX.update(1 / 60); t += 1 / 60;
          const b = m.ball, k = b.kick;
          if (!pending && k && k.type === 'pass' && k.to === caller && k.by.team === caller.team) { pending = k; r.called++; }
          if (pending && b.owner) { if (b.owner === caller) r.reached++; else if (b.owner.team !== caller.team) r.lost++; pending = null; }
          if (pending && b.kick !== pending && !b.owner) pending = null;
          if (b.owner && b.owner.team !== last) { if (last === 0) r.teamLost++; last = b.owner.team; }
        }
        r.goalsFor += m.score[0]; r.goalsAgainst += m.score[1];
        m.dispose();
      }
      r.lostRate = +(r.lost / Math.max(1, r.called)).toFixed(2);
      return r;
    };
    return { instant: run(false), think: run(true) };
  });
  // allow for luck: two standard errors on the interception rate, 15 percent on the team's lost balls
  const pr = (sim.think.lost + sim.instant.lost) / Math.max(1, sim.think.called + sim.instant.called);
  const se = Math.sqrt(pr * (1 - pr) * (1 / Math.max(1, sim.think.called) + 1 / Math.max(1, sim.instant.called)));
  check('thinking passes do not lose the ball more often', sim.think.lostRate <= sim.instant.lostRate + 2 * se && sim.think.teamLost <= sim.instant.teamLost * 1.15, Object.assign(sim, { margin: +(2 * se).toFixed(2) }));
  check('no errors', logs.length === 0, logs.slice(0, 4));
  console.log(results.join('\n'));
  await browser.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
