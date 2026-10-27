const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open({ wait: 1200, viewport: { width: 800, height: 450 } });
  const out = await page.evaluate(() => {
    const G = EGO.Game; G.manual = true;
    const results = [];
    const styles = Object.keys(window.EGO_STYLES || {});
    return { styles };
  });
  // expose data via a second evaluate that builds matches per style
  const res = await page.evaluate(() => {
    const G = EGO.Game; G.manual = true;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const results = [];
    const STY = ['ROOKIE', 'SPRINTER', 'PHANTOM', 'ENFORCER', 'SHAMBLER', 'MAGNET', 'RAILGUN'];
    for (const sid of STY) {
      if (G.match) G.match.dispose();
      const m = new EGO.Match('quick', 0.5, { style: sid, flow: null });
      G.match = m;
      const h = m.human;
      const step = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) m.update(1 / 60); };
      const reset = () => {
        m.phase = 'play'; m.score = [0, 0]; EGO.TimeCtl.reset();
        for (const p of m.players) { p.setState(p === h ? 'free' : 'kickoff'); p.vel.set(0, 0, 0); p.fx = {}; p.pickBlock = 0; p.iframes = 0; p.tackleProof = 0; p.protect = 0; p.pending = null; p.dash = null; p.slide = null; p.dive = null; }
        m.teams[0].forEach((p, i) => { if (p !== h) p.pos.set(-15, 0, -20 + i * 3); });
        m.teams[1].forEach((p, i) => p.pos.set(15, 0, 20 - i * 3));
        h.pos.set(0, 0, 0); h.yaw = 0; h.vel.set(0, 0, 0); h.onGround = true;
        m.ball.reset(0, 0.6); m.aim.set(2, 1.2, 32.5); m.camYaw = 0;
        h.abil.forEach((a) => a.cd = 0);
      };
      for (let i = 0; i < 3; i++) {
        const id = h.abil[i].id;
        const r = { style: sid, ability: id };
        try {
          reset();
          const mate = m.teams[0][2], opp = m.teams[1][1], opp2 = m.teams[1][2];
          // scenario setup
          if (['quickShot', 'curler', 'zigzag', 'feint', 'snapPass', 'pinpointPass', 'undeadShuffle', 'cutInside', 'volley', 'fakeVolley', 'impactShot', 'overhead', 'vision', 'burst', 'turbo'].includes(id)) m.possess(h, true);
          if (['snapPass', 'pinpointPass'].includes(id)) { mate.setState('free'); mate.pos.set(6, 0, 12); }
          if (['feint', 'zigzag', 'cutInside', 'undeadShuffle', 'fakeVolley'].includes(id)) { opp.setState('free'); opp.pos.set(0.5, 0, 2.6); opp.yaw = Math.PI; opp2.setState('free'); opp2.pos.set(-2, 0, 3); }
          if (['armSwipe', 'graveGrab', 'lurch'].includes(id)) { opp.setState('free'); opp.pos.set(0, 0, id === 'lurch' ? 10 : id === 'graveGrab' ? 5 : 2.2); m.ball.reset(opp.pos.x, opp.pos.z + 0.6); m.possess(opp, true); h.yaw = 0; }
          if (id === 'call') { mate.setState('free'); mate.pos.set(-6, 0, -8); m.ball.reset(-6, -7.4); m.possess(mate, true); }
          if (id === 'skyTrap') { m.ball.reset(0.3, 0.9); m.ball.pos.y = 5; m.ball.vel.set(0, 0, -0.3); }
          if (id === 'lockdown') { opp.setState('free'); opp.pos.set(0, 0, 3.6); m.ball.reset(0, 4.2); m.possess(opp, true); }
          const before = { ball: m.ball.pos.clone(), hp: h.pos.clone(), owner: m.ball.owner && m.ball.owner.name };
          const ok = m.useAbility(h, i);
          r.used = ok; r.cd = +h.abil[i].cd.toFixed(1);
          // follow-ups
          if (id === 'lockdown') { r.fxLock = h.fx.lockdown; m.tackle(h, 0, 1); }
          if (id === 'skyTrap') { step(0.05); h.vel.y = 7.6; h.onGround = false; let caught = null; for (let k = 0; k < 50; k++) { m.update(1 / 60); if (m.ball.owner === h && !caught) caught = { t: k, y: +m.ball.pos.y.toFixed(2), hy: +h.pos.y.toFixed(2) }; } r.caught = caught; }
          step(['snapPass', 'pinpointPass', 'call'].includes(id) ? 1.8 : id === 'volley' || id === 'overhead' ? 0.8 : 0.9);
          r.ownerAfter = m.ball.owner ? m.ball.owner.name : (m.ball.kick ? 'kicked:' + m.ball.kick.type + (m.ball.kick.special ? '/' + m.ball.kick.special : '') : 'loose');
          r.ballMoved = +m.ball.pos.distanceTo(before.ball).toFixed(1);
          r.humanMoved = +h.pos.distanceTo(before.hp).toFixed(1);
          r.hState = h.state; r.oppState = opp.state; r.opp2State = opp2.state; r.mateHas = m.ball.owner === mate; r.phase = m.phase; r.score = m.score.join('-');
          if (id === 'vision') r.slowT = +EGO.TimeCtl.slowT.toFixed(2);
          if (id === 'burst' || id === 'turbo') r.speedMod = +h.mods.speed.toFixed(2);
        } catch (e) { r.error = e.message + ' ' + (e.stack || '').split('\n')[1]; }
        results.push(r);
      }
    }
    G.match.dispose(); G.match = null;
    return results;
  });
  for (const r of res) console.log(JSON.stringify(r));
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})();
