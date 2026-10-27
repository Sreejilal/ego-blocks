// New styles (PROWLER, TRICKSTER, THUNDER) and the anime cut-ins for big moves.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const res = await page.evaluate(() => {
    const G = EGO.Game; G.manual = true;
    const out = {};
    for (const sid of ['PROWLER', 'TRICKSTER', 'THUNDER']) {
      if (G.match) G.match.dispose();
      const m = new EGO.Match('quick', 0.5, { style: sid, flow: null, size: 3 }); G.match = m;
      const h = m.human, [gk, mid, st] = m.teams[1];
      const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) m.update(1 / 60); };
      const reset = () => {
        m.phase = 'play'; EGO.TimeCtl.reset();
        for (const p of m.players) { p.setState(p === h ? 'free' : 'kickoff'); p.vel.set(0, 0, 0); p.fx = {}; p.pickBlock = 0; p.tackleProof = 0; p.dash = null; p.pending = null; }
        m.teams[0].forEach((p) => { if (p !== h) p.pos.set(-15, 0, -20); });
        mid.pos.set(15, 0, 20); st.pos.set(18, 0, 22); gk.pos.set(0, 0, 37); gk.setState('free');
        h.pos.set(0, 0, 0); h.yaw = 0; h.onGround = true; m.ball.reset(0, 0.6); m.aim.set(2, 1.2, F_L()); m.camYaw = 0;
        h.abil.forEach((a) => (a.cd = 0));
      };
      function F_L() { return 38.5; }
      const r = {};
      for (let i = 0; i < 3; i++) {
        const id = h.abil[i].id, x = {};
        reset();
        if (['oneTouch', 'rainbow', 'nutmeg', 'whiplash', 'longBomb', 'knuckle', 'loaded'].includes(id)) m.possess(h, true);
        if (['rainbow', 'nutmeg', 'whiplash'].includes(id)) { mid.setState('free'); mid.pos.set(0.3, 0, 2.4); mid.yaw = Math.PI; }
        if (id === 'pounce' || id === 'scent') { m.ball.reset(5, 6); m.ball.vel.set(0, 0, 2); }
        if (id === 'longBomb') { h.pos.set(0, 0, 8); m.ball.reset(0, 8.6); m.possess(h, true); }
        x.used = m.useAbility(h, i);
        if (id === 'scent') { x.fx = h.fx.scent; h.computeMods(); x.speed = +h.mods.speed.toFixed(2); }
        if (id === 'loaded') { x.fx = h.fx.loaded; h.computeMods(); x.shot = +h.mods.shot.toFixed(2); }
        if (id === 'knuckle') { let flips = 0, last = 0; for (let k = 0; k < 30; k++) { m.update(1 / 60); const c = Math.sign(m.ball.curve.x + m.ball.curve.z); if (c && c !== last) { flips++; last = c; } } x.wobbles = flips; }
        if (id === 'longBomb') { const vy0 = m.ball.vel.y; step(0.5); x.dip = +(m.ball.vel.y - vy0).toFixed(1); }
        if (id === 'nutmeg') { x.midState = mid.state; step(0.9); x.owner = m.ball.owner ? (m.ball.owner === h ? 'YOU' : m.ball.owner.role) : 'loose'; x.ballZ = +m.ball.pos.z.toFixed(1); }
        if (id === 'rainbow') { x.ballVy = +m.ball.vel.y.toFixed(1); x.midState = mid.state; step(0.3); x.overHead = m.ball.pos.y > 1.9; }
        if (id === 'whiplash') { x.midState = mid.state; x.hState = h.state; }
        if (id === 'pounce') { x.hState = h.state; step(0.6); x.owner = m.ball.owner === h; }
        if (id === 'oneTouch') { x.kick = m.ball.kick && m.ball.kick.special; x.speed = +m.ball.vel.length().toFixed(1); }
        x.slow = +EGO.TimeCtl.slowT.toFixed(2);
        x.big = !!h.abil[i].def.big;
        r[id] = x;
      }
      out[sid] = r;
    }
    G.match.dispose(); G.match = null;
    return out;
  });
  const P = res.PROWLER, T = res.TRICKSTER, H = res.THUNDER;
  check('PROWLER: SCENT speeds you to a loose ball', P.scent.used && P.scent.fx > 4 && P.scent.speed >= 1.19, P.scent);
  check('PROWLER: POUNCE lunges onto the loose ball', P.pounce.used && P.pounce.hState === 'dash' && P.pounce.owner, P.pounce);
  check('PROWLER: ONE TOUCH is a harder first-time finish', P.oneTouch.used && P.oneTouch.kick === 'onetouch' && P.oneTouch.speed > 38, P.oneTouch);
  check('TRICKSTER: RAINBOW FLICK lifts it over the defender', T.rainbow.used && T.rainbow.ballVy > 8 && T.rainbow.midState === 'stun' && T.rainbow.overHead, T.rainbow);
  check('TRICKSTER: NUTMEG goes through his legs', T.nutmeg.used && T.nutmeg.midState === 'stun' && T.nutmeg.ballZ > 3.5 && T.nutmeg.owner !== 'MID', T.nutmeg);
  check('TRICKSTER: WHIPLASH floors the defender close by', T.whiplash.used && T.whiplash.midState === 'stun' && T.whiplash.hState === 'dash', T.whiplash);
  check('THUNDER: LONG BOMB dips late', H.longBomb.used && H.longBomb.dip < -7.5, H.longBomb);
  check('THUNDER: LOADED gives full-power shots', H.loaded.used && H.loaded.fx > 4 && H.loaded.shot >= 1.19, H.loaded);
  check('THUNDER: KNUCKLEBALL wobbles', H.knuckle.used && H.knuckle.wobbles >= 3, H.knuckle);
  const bigs = [P.pounce, P.oneTouch, T.rainbow, T.nutmeg, H.longBomb, H.knuckle];
  check('big moves get slow motion', bigs.every((x) => x.big && x.slow > 0.4) && !P.scent.big && P.scent.slow === 0, bigs.map((x) => x.slow));

  // the cut-in: on screen under a second with your face and the move name, and the setting turns it off
  const ci = await page.evaluate(async () => {
    EGO.Save.data.style = 'THUNDER'; EGO.Save.data.styles.push('THUNDER');
    const G = EGO.Game; G.startMatch('quick'); G.stepManual(170, false);
    const m = G.match, h = m.human; m.possess(h, true); h.abil.forEach((a) => (a.cd = 0));
    m.useAbility(h, 2);
    const el = document.getElementById('cutin');
    const r = { shown: !el.hidden, name: document.getElementById('ci-name').textContent, face: !!document.querySelector('#ci-face canvas'), punch: EGO.Cam.punchT > 0 };
    G.stepManual(6, true);
    await new Promise((res) => setTimeout(res, 230));
    G.stepManual(1, true);
    return r;
  });
  await page.screenshot({ path: __dirname + '/shots/st1_cutin.png' });
  await page.waitForTimeout(800);
  const gone = await page.evaluate(() => document.getElementById('cutin').hidden);
  check('cut-in shows your face and the move name, then goes (under 1s)', ci.shown && ci.name === 'KNUCKLEBALL' && ci.face && ci.punch && gone, Object.assign(ci, { gone }));
  const off = await page.evaluate(() => {
    const G = EGO.Game; G.pause();
    document.querySelector('#set-cut [data-v="0"]').click();
    const saved = EGO.Save.data.settings.cutins; G.pausedAt = 0; G.resume();
    const m = G.match, h = m.human; m.ball.owner = null; h.setState('free'); m.possess(h, true); h.abil.forEach((a) => (a.cd = 0)); EGO.TimeCtl.reset();
    m.useAbility(h, 0);
    return { saved, shown: !document.getElementById('cutin').hidden || !!document.querySelector('#cutin.go'), slow: EGO.TimeCtl.slowT };
  });
  check('cut-ins can be turned off in the pause menu', off.saved === false && off.slow === 0, off);
  await page.evaluate(() => { EGO.Save.data.settings.cutins = true; });

  // bots can use the new styles in full matches without errors
  const sims = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 3; i++) { const m = new EGO.Match('quick', 0.6, { noHuman: true, autopilot: true, length: 90, size: 3 }); m.players.forEach((p, k) => { if (!p.isGK) { const sid = ['PROWLER', 'TRICKSTER', 'THUNDER'][k % 3]; p.styleId = sid; p.style = EGO.STYLES[sid]; p.abil = p.style.abilities.map((id) => ({ id, def: EGO.ABILITIES[id], cd: 0 })); } }); let t = 0, used = 0; const oU = m.useAbility.bind(m); m.useAbility = (p, j) => { const r = oU(p, j); if (r) used++; return r; }; while (m.phase !== 'end' && t < 400) { m.update(1 / 60); EGO.FX.update(1 / 60); t += 1 / 60; } out.push({ score: m.score, used }); m.dispose(); }
    return out;
  });
  check('bots play the new styles', sims.every((s) => s.used > 3), sims);
  const styles = await page.evaluate(() => EGO.STYLE_IDS.map((k) => k + ':' + EGO.STYLES[k].rarity));
  check('10 styles, new ones in the spin pools', styles.length === 10 && ['PROWLER:Legendary', 'TRICKSTER:Epic', 'THUNDER:Mythic'].every((x) => styles.includes(x)), styles);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  console.log(results.join('\n'));
  await browser.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
