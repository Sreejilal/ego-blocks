const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open({ wait: 1200, viewport: { width: 800, height: 450 } });
  const res = await page.evaluate(() => {
    const G = EGO.Game; G.manual = true;
    if (G.match) G.match.dispose();
    const m = new EGO.Match('lawless', 0.5, { style: 'ROOKIE', flow: null }); G.match = m;
    const h = m.human, out = [];
    const step = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) m.update(1 / 60); };
    const ids = ['fist', 'boom', 'slime', 'jet', 'snow', 'magnet', 'bubble', 'wall', 'mine', 'bolt'];
    for (const id of ids) {
      const r = { item: id };
      try {
        m.phase = 'play'; m.score = [0, 0]; m.itemSpawnT = 99;
        for (const p of m.players) { p.setState(p === h ? 'free' : 'kickoff'); p.vel.set(0, 0, 0); p.fx = {}; p.item = null; p.pickBlock = 0; p.pending = null; }
        m.teams[0].forEach((p, i) => { if (p !== h) p.pos.set(-15, 0, -20 + i * 3); });
        m.teams[1].forEach((p, i) => p.pos.set(15, 0, 20 - i * 3));
        h.pos.set(0, 0, 0); h.yaw = 0; m.camYaw = 0; m.aim.set(0, 0.3, 9);
        const opp = m.teams[1][1]; opp.setState('free'); opp.pos.set(0.5, 0, 8); m.ball.reset(0.5, 8.6); m.possess(opp, true);
        if (['slime', 'mine', 'bubble', 'bolt'].includes(id)) { m.ball.reset(0, 0.6); m.possess(h, true); opp.pos.set(0, 0, -3); opp.yaw = 0; }
        if (id === 'wall') { opp.pos.set(0, 0, 9); m.ball.reset(0, 8.4); m.possess(opp, true); opp.yaw = Math.PI; }
        h.item = id;
        const ok = m.useItem(h);
        r.used = ok; r.itemAfter = h.item;
        if (id === 'slime' || id === 'mine') { opp.mx = 0; opp.mz = 1; for (let i = 0; i < 90; i++) { opp.mx = 0; opp.mz = 1; opp.sprint = true; m.update(1 / 60); } }
        else if (id === 'wall') { const bz = m.ball.pos.z; m.ball.owner = null; m.ball.vel.set(0, 0.5, -14); step(1); r.ballZ = +m.ball.pos.z.toFixed(1); r.wallHazards = m.hazards.filter((x) => x.type === 'wall').length; }
        else if (id === 'jet') { for (let i = 0; i < 60; i++) { h.jetThrust = true; m.update(1 / 60); } r.height = +h.pos.y.toFixed(1); }
        else step(id === 'boom' ? 2 : 1);
        r.oppState = opp.state; r.owner = m.ball.owner ? m.ball.owner.name : 'loose'; r.hState = h.state;
        r.fx = Object.keys(h.fx).filter((k) => h.fx[k] > 0).join(',');
        r.projectiles = m.projectiles.length; r.hazards = m.hazards.map((x) => x.type).join(',');
      } catch (e) { r.error = e.message + ' ' + (e.stack || '').split('\n')[1]; }
      out.push(r);
    }
    // item box spawning + pickup
    m.itemSpawnT = 0; m.phase = 'play'; for (const p of m.players) p.item = null;
    step(0.1);
    const box = m.items[0];
    let picked = null;
    if (box) { h.pos.set(box.x, 0, box.z); step(0.1); picked = h.item; }
    out.push({ spawned: m.items.length + (box ? 1 : 0), picked });
    G.match.dispose(); G.match = null;
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})();
