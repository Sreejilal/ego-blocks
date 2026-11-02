// Soak: every mode played start to finish by a button masher at uneven frame rates (30, 60, 144 fps and hitches).
// Every frame checks that nothing broke: no errors, no NaN, nobody outside the stadium, no ball inside the stands,
// the ball holder is next to the ball (a moment after getting it: PULL brings it from far), no stop in play lasts too long and every match reaches its end.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const MODES = (process.env.SOAK_MODES || 'quick,ranked,lawless,koth,volleys,duel,freekick,tutorial').split(',');
const SECS = +(process.env.SOAK_SECS || 300); // game seconds per mode

(async () => {
  const { browser, page, logs } = await open({ wait: 1200, viewport: { width: 960, height: 540 } });
  for (const mode of MODES) {
    const r = await page.evaluate(({ mode, SECS, seed }) => {
      let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const G = EGO.Game, I = EGO.Input, F = EGO.PITCH; G.manual = true;
      const st = EGO.Save.data.settings; st.cutins = false; st.camPicked = true; st.autoFs = false;
      G.startMatch(mode);
      const m = G.match, bad = [], seen = {};
      const note = (k, info) => { if (!seen[k]) { seen[k] = 1; bad.push(k + ' ' + JSON.stringify(info)); } };
      const fin = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'], taps = ['Space', 'KeyC', 'KeyF', 'KeyQ', 'KeyE', 'KeyR', 'KeyG', 'KeyX', 'KeyZ', 'Mouse2'];
      const trace = []; let t = 0, frames = 0, stop = 0, stopPhase = '', worst = 0, shootT = 0, dts = [];
      while (G.state === 'match' && t < SECS + 400) {
        // the masher: hold some keys, tap others, turn the mouse, charge and fire
        if (rnd() < 0.05) { const k = keys[(rnd() * keys.length) | 0]; if (I.down.has(k)) I.down.delete(k); else I.down.add(k); }
        if (rnd() < 0.04) { const k = taps[(rnd() * taps.length) | 0]; I.edges.add(k); if (k === 'Mouse2' && rnd() < 0.7) I.up.add(k); }
        if (rnd() < 0.3) { I.mdx += (rnd() - 0.5) * 60; I.mdy += (rnd() - 0.5) * 20; }
        if (shootT > 0) { shootT--; if (!shootT) { I.mouseL = false; I.up.add('Mouse0'); } }
        else if (rnd() < 0.02) { I.edges.add('Mouse0'); I.mouseL = true; shootT = 5 + ((rnd() * 60) | 0); }
        // uneven frames: 144, 60, 30 fps and the odd hitch
        const q = rnd(), ms = q < 0.3 ? 6.9 : q < 0.8 ? 16.7 : q < 0.97 ? 33.3 : 60 + rnd() * 140;
        G.loop(G.last + ms, false); frames++; t += Math.min(ms, 50) / 1000;
        if (m.phase === 'end') { for (let i = 0; i < 400 && G.state === 'match'; i++) G.loop(G.last + 16.7, false); break; }
        for (const p of m.players) {
          if (!fin(p.pos) || !fin(p.vel)) note('player NaN', { mode, t: +t.toFixed(1), role: p.role, state: p.state });
          else if (Math.abs(p.pos.x) > F.BOARD_X + 3 || Math.abs(p.pos.z) > F.BOARD_Z + 4 || p.pos.y < -0.5 || p.pos.y > 30) note('player out of the stadium', { mode, t: +t.toFixed(1), role: p.role, pos: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1)), state: p.state });
        }
        const b = m.ball;
        trace.push([+t.toFixed(2), b.owner ? b.owner.role + b.owner.team : '-', +b.pos.x.toFixed(1), +b.pos.z.toFixed(1), b.owner ? +b.owner.pos.x.toFixed(1) : 0, b.owner ? +b.owner.pos.z.toFixed(1) : 0, (m.hazards || []).map((h) => h.type).join('')]); if (trace.length > 12) trace.shift();
        if (!fin(b.pos) || !fin(b.vel)) note('ball NaN', { mode, t: +t.toFixed(1) });
        else if (b.pos.y < 0.25 || b.pos.y - 0.3 < EGO.standTop(b.pos.x, b.pos.z) - 0.05) note('ball inside the ground or the stands', { mode, t: +t.toFixed(1), pos: [b.pos.x, b.pos.y, b.pos.z].map((v) => +v.toFixed(1)), phase: m.phase });
        if (b.owner && m.time - b.owner.gotBallT > 0.5 && Math.hypot(b.owner.pos.x - b.pos.x, b.owner.pos.z - b.pos.z) > 3) note('ball far from its holder', { mode, t: +t.toFixed(1), d: +Math.hypot(b.owner.pos.x - b.pos.x, b.owner.pos.z - b.pos.z).toFixed(1), phase: m.phase, who: b.owner.role, human: b.owner.isHuman, st: b.owner.state, fx: Object.keys(b.owner.fx || {}).filter((k) => b.owner.fx[k] > 0), item: b.owner.item, ms, trace: trace.slice() });
        const c = EGO.World.camera.position; if (!fin(c)) note('camera NaN', { mode, t: +t.toFixed(1) });
        if (m.phase !== 'play') { if (stopPhase !== m.phase) { stopPhase = m.phase; stop = 0; } stop += Math.min(ms, 50) / 1000; worst = Math.max(worst, stop); if (stop > 20) note('stuck in ' + m.phase, { mode, t: +t.toFixed(1) }); }
        else { stopPhase = ''; stop = 0; }
        if (m.fk && m.fk.state && m.fk.t > 25) note('free kick stuck in ' + m.fk.state, { mode, t: +t.toFixed(1), fk: m.fk.state });
        if (m.tut && t > 200) break; // the masher will not finish the tutorial; it only has to stay sane
      }
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'].forEach((k) => I.down.delete(k)); I.mouseL = false;
      const out = { mode, state: G.state, phase: m.phase, score: m.score.slice(), frames, mins: +(t / 60).toFixed(1), worstStop: +worst.toFixed(1), bad };
      if (G.state === 'match') G.forfeit();
      G.toLobby && G.state !== 'lobby' && G.toLobby();
      return out;
    }, { mode, SECS, seed: 1234 + mode.length * 77 });
    const ends = r.mode === 'tutorial' ? true : r.state === 'results' || r.phase === 'end';
    check(mode + ': no NaN, nothing outside the stadium or inside the stands, no long stops, the match ends', !r.bad.length && ends, r);
  }
  check('no page errors', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 6));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
