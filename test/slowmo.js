// SLOW-MO (C twice): with the ball, tapping C twice fast slows everyone near you and nobody can tackle you
// (on the server's copy of the game, fast). One tap is still a feint; keepers are never slowed; it ends after
// SLOWMO_TIME or when the ball leaves you; it recharges for SLOWMO_CD; bots use it too; online snapshots carry it.
// The last part opens the browser: pressing C twice in a real match lights the HUD slot and the blue screen edge.
const fs = require('fs');
const path = require('path');
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const DT = 1 / 60;
const tap = { moveX: 0, moveY: 0, dodge: true, ab: [false, false, false], emote: -1, camYaw: 0 };
const idle = Object.assign({}, tap, { dodge: false });

/** a match with every player standing still (the AI skips `wall` players), p on the ball, one defender close, one far away */
function setup() {
  const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: 3 });
  for (let i = 0; i < 300 && m.phase !== 'play'; i++) m.update(DT);
  for (const q of m.players) { q.vel.set(0, 0, 0); q.setState('free'); q.wall = true; }
  const p = m.teams[0].find((q) => !q.isGK), mate = m.teams[0].find((q) => !q.isGK && q !== p);
  const [gk, near, far] = [m.teams[1].find((q) => q.isGK), ...m.teams[1].filter((q) => !q.isGK)];
  p.pos.set(0, 0, 10); p.yaw = 0; mate.pos.set(-8, 0, 4);
  near.pos.set(2.5, 0, 12); far.pos.set(-20, 0, 34); gk.pos.set(1, 0, 14);
  m.ball.reset(0, 10.6); m.possess(p, true);
  return { m, p, mate, gk, near, far };
}
const run = (m, s) => { for (let i = 0; i < Math.round(s / DT); i++) m.update(DT); };

{ // one tap feints, a second tap 0.2s later starts SLOW-MO
  const { m, p, near, far, gk } = setup();
  m.updateHuman(DT, tap, p);
  const feinted = p.feint !== 0 && p.dodgeCharges === 0;
  run(m, 0.2);
  m.updateHuman(DT, tap, p);
  check('one tap of C is still a feint', feinted, { feint: p.feint });
  check('a second tap within 0.4s starts SLOW-MO (and does not waste time on a second feint)', p.fx.slowmo > 2 && p.slowRe > 19, { slowmo: p.fx.slowmo, recharge: p.slowRe });
  run(m, 0.1);
  near.computeMods(); far.computeMods(); gk.computeMods();
  check('opponents within 8 blocks slow right down, keepers and far ones do not', near.fx.slowed > 0 && near.mods.speed < 0.5 * near.speedMul + 0.01 && !(far.fx.slowed > 0) && !(gk.fx.slowed > 0), { near: +near.mods.speed.toFixed(2), far: far.fx.slowed || 0, keeper: gk.fx.slowed || 0 });
  check('nobody can tackle you while it runs', p.tackleProof > 0, p.tackleProof);
}
{ // a tackle into a player in SLOW-MO: ankle breaker, the ball stays. Without it the same tackle wins the ball
  const tackleOnce = (slow) => {
    const { m, p, near } = setup();
    if (slow) { p.dodgeCharges = 0; m.updateHuman(DT, tap, p); m.updateHuman(DT, tap, p); } // feint not ready, so only SLOW-MO keeps the ball
    near.pos.set(0, 0, 12.4); near.tackleCd = 0; near.setState('free');
    m.tackle(near, 0, -1);
    run(m, 0.7);
    return { kept: m.ball.owner === p, tackler: near.state };
  };
  const off = tackleOnce(false), on = tackleOnce(true);
  check('the same slide tackle wins the ball from a normal player', !off.kept, off);
  check('in SLOW-MO the tackle bounces off (ankle breaker) and you keep the ball', on.kept && on.tackler === 'stun', on);
}
{ // it lasts SLOWMO_TIME
  const { m, p, near } = setup();
  m.updateHuman(DT, tap, p); m.updateHuman(DT, tap, p);
  run(m, 2.0);
  const mid = p.fx.slowmo > 0 && near.fx.slowed > 0;
  run(m, 0.8);
  check('it lasts 2.5 seconds, then everyone is back to normal speed', mid && !(p.fx.slowmo > 0) && !(near.fx.slowed > 0), { mid, after: p.fx.slowmo, near: near.fx.slowed });
}
{ // it ends when the ball leaves you
  const { m, p, mate, near } = setup();
  m.updateHuman(DT, tap, p); m.updateHuman(DT, tap, p);
  run(m, 0.3);
  m.passTo(p, mate, {});
  run(m, 0.3);
  check('a pass ends it at once (no slowed defenders for the shot or the pass after)', !(p.fx.slowmo > 0) && !(near.fx.slowed > 0) && !(p.tackleProof > 0), { slowmo: p.fx.slowmo, near: near.fx.slowed, proof: p.tackleProof });
}
{ // recharge, and the ball is needed
  const { m, p } = setup();
  m.updateHuman(DT, tap, p); m.updateHuman(DT, tap, p);
  run(m, 3);
  m.updateHuman(DT, tap, p); run(m, 0.1); m.updateHuman(DT, tap, p);
  const again = p.fx.slowmo > 0;
  p.slowRe = 0.5; run(m, 0.6);
  m.updateHuman(DT, tap, p); m.updateHuman(DT, tap, p);
  check('it recharges for 20s, then works again', !again && p.fx.slowmo > 0, { again, later: p.fx.slowmo });
  const s2 = setup(); s2.m.ball.release(); s2.m.ball.pos.set(10, 0.2, -10);
  s2.m.updateHuman(DT, tap, s2.p); s2.m.updateHuman(DT, tap, s2.p);
  check('without the ball, a double tap does nothing', !(s2.p.fx.slowmo > 0) && s2.p.slowRe === 0, { slowmo: s2.p.fx.slowmo, re: s2.p.slowRe });
  const s3 = setup();
  s3.m.updateHuman(DT, tap, s3.p); run(s3.m, 0.6); s3.m.updateHuman(DT, tap, s3.p);
  check('two taps far apart are not a double tap', !(s3.p.fx.slowmo > 0), s3.p.fx.slowmo);
}
{ // bots use it in a real match
  const m = new G.Match('quick', 0.8, { noHuman: true, autopilot: true, size: 4 });
  for (let i = 0; i < 60 * 240; i++) m.update(DT);
  const uses = m.players.reduce((n, q) => n + (q.slowUses || 0), 0);
  check('bots use SLOW-MO in a match (4 minutes, about 6 times)', uses >= 1, uses);
}
{ // online: the server sends it, the client reads it
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
  const net = fs.readFileSync(path.join(__dirname, '..', 'src', '11_net.js'), 'utf8');
  check('online snapshots carry SLOW-MO (flags, your recharge, your screen effect)', /flags \|= 512/.test(srv) && /flags \|= 1024/.test(srv) && /sr: r2\(p\.slowRe\)/.test(srv) && /'slowmo', 'slowed'/.test(srv) && /me\.sr/.test(net) && /f & 1024/.test(net), null);
}
(async () => {
  const { browser, page, logs } = await open();
  await page.evaluate(() => { EGO.Game.startMatch('quick'); });
  const r = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, I = EGO.Input;
    for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1);
    const p = m.human, s = Math.sign(m.oppGoalZ(p.team));
    p.pos.set(0, 0, -s * 4); p.setState('free'); p.vel.set(0, 0, 0); m.possess(p, true);
    const o = m.opponents(p).find((q) => !q.isGK); o.pos.set(2, 0, -s * 4 + s * 3); o.ai.think = 9;
    EGO.Cam.yaw = s > 0 ? 0 : Math.PI;
    G.stepManual(1, true);
    const ready = document.getElementById('slot-s').classList.contains('ready');
    I.locked = true; I.edges.add('KeyC'); G.stepManual(1, true); G.stepManual(8, true);
    I.edges.add('KeyC'); G.stepManual(1, true); G.stepManual(12, true);
    const fx = document.getElementById('slowfx');
    return { ready, slowmo: +(p.fx.slowmo || 0).toFixed(2), recharge: Math.round(p.slowRe), edge: !fx.hidden && getComputedStyle(fx).display !== 'none', active: document.getElementById('slot-s').classList.contains('active'), oppSlowed: o.fx.slowed > 0 };
  });
  await page.screenshot({ path: __dirname + '/shots/slowmo.png', timeout: 120000 }).catch((e) => console.log('(no screenshot: ' + e.message.slice(0, 60) + ')')); // a slow PC can time out here; the checks below still count
  check('in a real match: the SLOW-MO slot is ready, C C starts it, the slot glows and the screen gets a blue edge', r.ready && r.slowmo > 1.5 && r.recharge >= 19 && r.edge && r.active, r);
  check('the defender next to you is caught in it', r.oppSlowed, r);
  const howto = await page.evaluate(() => document.getElementById('scr-howto').textContent);
  check('How to Play explains it for keyboard, controller and touch', /tap C twice/.test(howto) && /tap B twice/.test(howto) && /tap FEINT twice/.test(howto), null);
  const errs = logs.filter((l) => /error/i.test(l));
  check('no errors in the console', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((x) => x.startsWith('FAIL')) ? 1 : 0;
})();
