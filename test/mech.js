const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open({ wait: 1200, viewport: { width: 800, height: 450 } });
  const out = await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('quick'); G.manual = true;
    const m = G.match; const h = m.human; const res = {};
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const clearField = () => { for (const p of m.players) { if (p !== h) { p.pos.set(p.team ? 18 : -18, 0, p.isGK ? (p.team ? 40 : -40) : 0); p.setState('kickoff'); } } };
    const run = (sec, until) => { for (let i = 0; i < sec * 60; i++) { m.update(1 / 60); if (until && until()) return i / 60; } return -1; };
    m.phase = 'play'; for (const p of m.players) p.setState('free');
    // ---- shots
    const shots = [];
    for (const [px, pz, tx, ty, pw] of [[0, 15, 3.5, 1.5, 0.6], [0, 15, -3.8, 2.5, 1], [8, 20, -3, 0.8, 0.8], [0, 0, 2, 1.5, 1], [-12, 8, 3.5, 2.6, 0.9], [0, 22, 0, 1, 0.3], [0, 10, 4, 2, 0.45]]) {
      clearField(); h.setState('free'); h.pos.set(px, 0, pz); h.vel.set(0, 0, 0); h.yaw = Math.atan2(tx - px, 32.5 - pz);
      m.ball.reset(px, pz + 0.6); m.possess(h, true); h.pickBlock = 0;
      m.shootAt(h, V(tx, ty, 32.5), pw);
      let cross = null;
      for (let i = 0; i < 240; i++) { const z0 = m.ball.pos.z; m.update(1 / 60); if (!cross && m.ball.pos.z >= 32.5 && z0 < 32.5) cross = [m.ball.pos.x.toFixed(2), m.ball.pos.y.toFixed(2)]; if (m.phase !== 'play') break; }
      shots.push({ from: [px, pz], target: [tx, ty], power: pw, cross, phase: m.phase, score: m.score.slice() });
      m.phase = 'play'; m.ball.reset(0, 0); m.score = [0, 0]; for (const p of m.players) p.setState('free');
    }
    res.shots = shots;
    // ---- passes
    const passes = [];
    const mate = m.teams[0][2];
    for (const [d, lob, mv] of [[8, false, 0], [16, false, 0], [26, false, 0], [26, true, 0], [18, false, 6], [34, true, 0]]) {
      clearField(); mate.setState('free');
      h.pos.set(0, 0, -10); h.vel.set(0, 0, 0); h.yaw = 0; m.ball.reset(0, -9.4); m.possess(h, true);
      mate.pos.set(6, 0, -10 + d); mate.vel.set(0, 0, mv);
      mate.ai.task = 'pos';
      m.passTo(h, mate, { lob });
      const t = run(4, () => m.ball.owner && m.ball.owner !== h);
      passes.push({ d, lob, moving: mv, received: m.ball.owner ? m.ball.owner.name + (m.ball.owner === mate ? '(mate)' : '') : null, t: +t.toFixed(2) });
    }
    res.passes = passes;
    // ---- curler
    clearField(); h.setState('free'); h.pos.set(-6, 0, 16); h.yaw = 0.2; m.ball.reset(-6, 16.6); m.possess(h, true);
    m.curlShot(h, V(3.6, 1.2, 32.5));
    let cc = null; for (let i = 0; i < 200; i++) { const z0 = m.ball.pos.z; m.update(1 / 60); if (!cc && m.ball.pos.z >= 32.5 && z0 < 32.5) cc = [m.ball.pos.x.toFixed(2), m.ball.pos.y.toFixed(2)]; if (m.phase !== 'play') break; }
    res.curler = { target: [3.6, 1.2], cross: cc, phase: m.phase };
    m.phase = 'play'; m.score = [0, 0]; for (const p of m.players) p.setState('free');
    // ---- impact shot from long range
    clearField(); h.setState('free'); h.pos.set(0, 0, -20); h.yaw = 0; m.ball.reset(0, -19.4); m.possess(h, true);
    m.impactShot(h, V(-3, 1.5, 32.5));
    let ic = null; for (let i = 0; i < 120; i++) { const z0 = m.ball.pos.z; m.update(1 / 60); if (!ic && m.ball.pos.z >= 32.5 && z0 < 32.5) ic = [m.ball.pos.x.toFixed(2), m.ball.pos.y.toFixed(2), (i / 60).toFixed(2)]; if (m.phase !== 'play') break; }
    res.impact = { target: [-3, 1.5], cross: ic, phase: m.phase };
    m.phase = 'play'; m.score = [0, 0]; for (const p of m.players) p.setState('free');
    // ---- tackle vs carrier (AI defender slides at human)
    const def = m.teams[1][1];
    const tk = [];
    for (const dodge of [false, true]) {
      clearField(); def.setState('free'); def.tackleCd = 0;
      h.pos.set(0, 0, 5); h.vel.set(0, 0, 0); h.yaw = 0; m.ball.reset(0, 5.6); m.possess(h, true); h.iframes = 0; h.dodgeCharges = 2; h.protect = 0;
      def.pos.set(0, 0, 7.6); def.yaw = Math.PI;
      m.tackle(def, 0, -1);
      if (dodge) { for (let i = 0; i < 6; i++) m.update(1 / 60); m.dodge(h, 1, 0); }
      run(0.8);
      tk.push({ dodge, owner: m.ball.owner ? m.ball.owner.name : 'loose', humanState: h.state, defState: def.state });
    }
    res.tackle = tk;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})();
