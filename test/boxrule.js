// The owner's box rule (Nov 2026: "a bot just follows me around and I can't shoot"): once you are in their box, their
// outfield bots wait outside it for BOX_FREE seconds (anyone already inside backs out, nobody slides in), then they can
// come in. Their keeper plays as normal, and online matches never have it. Also the hitbox fix: a ball at head height
// hits the head (it used to fly through when its middle was just over the head).
// Runs on the server's copy of the game (no browser), so it is quick.
const { load } = require('../server/headless.js');
const G = load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const F = G.F;
const neutral = { moveX: 0, moveY: 0, ab: [false, false, false] };
function setup() {
  const m = new G.Match('quick', 0.5, { size: 4 });
  m.phase = 'play'; m.phaseT = 0; m.ctl = neutral;
  const h = m.human, gz = m.ownGoalZ(1); // their goal
  h.pos.set(0, 0, gz - 30); // outside their box to start with
  return { m, h, gz };
}
const inBox = (m, p) => m.inOwnBox(p);
{
  const { m, h, gz } = setup();
  const defs = m.teams[1].filter((p) => !p.isGK), keeper = m.keeperOf(1);
  // a defender already inside, one running in
  defs[0].pos.set(2, 0, gz - 4);
  defs[1].pos.set(-3, 0, gz - 11.5);
  h.pos.set(0, 0, gz - 6); m.ball.reset(0, gz - 5.6); m.possess(h);
  let inside = 0, maxIn = 0;
  for (let i = 0; i < 60 * 3; i++) { m.update(1 / 60); h.pos.set(0, 0, gz - 6); if (m.ball.owner !== h) { m.ball.release(); m.ball.reset(0, gz - 5.6); m.possess(h); } inside = defs.filter((p) => inBox(m, p)).length; if (i > 40) maxIn = Math.max(maxIn, inside); }
  check('in their box, their defenders back out and wait outside (no sliding in)', maxIn === 0 && h.stats && m.ball.owner === h, { maxIn, owner: m.ball.owner === h, boxT: +m.boxT.toFixed(1) });
  check('their keeper still plays in the box', inBox(m, keeper), { keeper: [+keeper.pos.x.toFixed(1), +keeper.pos.z.toFixed(1)] });
  // after BOX_FREE seconds they can come in
  for (let i = 0; i < 60 * 2.5; i++) m.update(1 / 60);
  defs[0].pos.set(2, 0, gz - 4);
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  check('after ' + 5 + ' seconds they can come in again', m.boxT >= 5 && inBox(m, defs[0]), { boxT: +m.boxT.toFixed(1), z: +defs[0].pos.z.toFixed(1) });
  // leave the box and come back: the wait starts again
  h.pos.set(0, 0, gz - 30); m.update(1 / 60);
  check('out of the box the timer resets', m.boxT === 0, m.boxT);
}
{ // online (several players, no single "you"): never
  const m = new G.Match('quick', 0.5, { size: 3, humans: [{ id: 'a', team: 0, name: 'A', style: 'ROOKIE' }, { id: 'b', team: 1, name: 'B', style: 'ROOKIE' }] });
  m.phase = 'play';
  const d = m.teams[1].find((p) => !p.isGK && !p.netId) || m.teams[1].find((p) => !p.isGK), a = m.humans[0], gz = m.ownGoalZ(1);
  a.pos.set(0, 0, gz - 6); d.pos.set(1, 0, gz - 4);
  for (let i = 0; i < 30; i++) m.update(1 / 60);
  check('online matches never have the rule', !m.boxT && !m.human, { boxT: m.boxT || 0 });
}
{ // owner: "the striker still rushes": nobody charges at a keeper who has the ball safe (in hand, in the box)
  const m = new G.Match('quick', 0.5, { size: 4, role: 'GK' });
  m.phase = 'play'; m.ctl = neutral;
  const h = m.human, gz = m.ownGoalZ(0), st = m.teams[1].find((p) => p.role === 'ST');
  h.pos.set(0, 0, gz + 3); m.ball.reset(0, gz + 3.3); m.possess(h);
  st.pos.set(2, 0, gz + 14);
  let press = 0, closest = 99;
  for (let i = 0; i < 60 * 2.5; i++) { m.update(1 / 60); if (m.ball.owner !== h) break; if (m.teams[1].some((p) => p.ai.task === 'press')) press++; closest = Math.min(closest, Math.hypot(st.pos.x - h.pos.x, st.pos.z - h.pos.z)); }
  check('nobody charges at you while you hold the ball in goal', press === 0 && closest > 5, { pressFrames: press, closest: +closest.toFixed(1) });
  // the same keeper dribbling out of his box can be pressed
  h.setState('free'); m.ball.held = false; h.pos.set(0, 0, gz + 16); m.ball.reset(0, gz + 16.3); m.possess(h);
  let pressed = false; for (let i = 0; i < 30; i++) { m.update(1 / 60); if (m.teams[1].some((p) => p.ai.task === 'press')) { pressed = true; break; } }
  check('out of your box with the ball, they come for you again', pressed, pressed);
}
{ // a ball at head height hits the head
  const m = new G.Match('quick', 0.5, { size: 4 });
  m.phase = 'play'; m.ctl = neutral;
  const h = m.human, b = m.ball;
  for (const p of m.players) if (p !== h) { p.wall = true; p.pos.set(p.pos.x, 0, 25); }
  h.pos.set(0, 0, 0); h.vel.set(0, 0, 0);
  const out = [];
  for (const y of [2.0, 2.1]) {
    b.release(); b.reset(0, 6); b.pos.y = y; b.vel.set(0, 0.5 * G.BALL_G * (6 / 24), -24); b.kick = null; // fast, so it cannot be controlled: it has to bounce off
    let hit = false;
    for (let i = 0; i < 40; i++) { const vz = b.vel.z; m.update(1 / 60); if (b.owner === h || b.vel.z > 0 || Math.abs(b.vel.z - vz) > 3) { hit = true; break; } if (b.pos.z < -3) break; }
    out.push(y + ':' + (hit ? 'hit' : 'through'));
  }
  check('a ball at head height hits the head instead of flying through', out.every((s) => s.endsWith('hit')), out);
}
{ // owner: "if you try to shoot top bins it just won't go in, nerf the goalie": a good shot into a top corner beats a computer keeper most of the time
  const rate = (skill) => {
    let goals = 0;
    for (let i = 0; i < 30; i++) {
      const m = new G.Match('quick', skill, { size: 4 }), h = m.human, gk = m.keeperOf(1), b = m.ball, gz = m.oppGoalZ(0);
      m.phase = 'play'; m.ctl = neutral;
      for (const p of m.players) { if (p !== h && p !== gk) { p.wall = true; p.pos.set(p.pos.x, 0, -30); } p.setState('free'); }
      const dist = 14 + (i % 4) * 3, sx = ((i % 3) - 1) * 6;
      h.pos.set(sx, 0, gz - dist); b.reset(sx, gz - dist + 0.6); m.possess(h); gk.pos.set(0, 0, gz - 1.2);
      for (let f = 0; f < 30; f++) m.update(1 / 60);
      m.shootAt(h, new (b.pos.constructor)((i % 2 ? 1 : -1) * (F.GW - 0.7), F.GH - 0.55, gz), 0.9, {});
      for (let f = 0; f < 120; f++) { m.update(1 / 60); if (m.phase === 'goal') { goals++; break; } if (b.owner === gk || (b.kick && b.kick.by === gk)) break; }
      m.dispose();
    }
    return goals / 30;
  };
  const avg = rate(0.5), top = rate(0.95);
  check('a hard shot into a top corner beats the computer keeper most of the time (it used to be 1 in 5)', avg >= 0.5 && top >= 0.4, { average: Math.round(avg * 100) + '%', best: Math.round(top * 100) + '%' });
}
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
