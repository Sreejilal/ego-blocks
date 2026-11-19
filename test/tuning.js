// Feel tuning (on the server's copy of the game, fast): winding up a shot slows you more the bigger the shot,
// and Quick Match is 4v4 with a winger who keeps wide.
const G = require('../server/headless').load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

function runSpeed(charge) {
  const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: 3 });
  for (let i = 0; i < 300 && m.phase !== 'play'; i++) m.update(1 / 60);
  const p = m.teams[0].find((q) => !q.isGK);
  p.pos.set(0, 0, -5); p.vel.set(0, 0, 0); p.setState('free');
  let top = 0;
  for (let i = 0; i < 40; i++) {
    p.mx = 0; p.mz = 1; p.sprint = false; p.charging = charge != null; p.charge = charge || 0;
    p.physics(1 / 60);
    top = Math.max(top, Math.hypot(p.vel.x, p.vel.z));
  }
  m.dispose();
  return +top.toFixed(2);
}
const free = runSpeed(null), small = runSpeed(0), big = runSpeed(1);
check('winding up a shot slows you, more for a bigger shot', small < free * 0.55 && big < small * 0.6, { free, small, big });

const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: G.teamSizeFor('quick', 0) });
const roles = m.teams.map((t) => t.map((p) => p.role).join(','));
// the midfielder plays behind the striker (owner: a midfielder that played up front like a striker was confusing)
let behind = 0, n = 0;
for (let i = 0; i < 60 * 40; i++) { m.update(1 / 60); if (m.phase === 'play' && i % 30 === 0) for (const t of m.teams) { const md = t.find((p) => p.role === 'MID'), st = t.find((p) => p.role === 'ST'); if (md && st) { behind += (st.pos.z - md.pos.z) * m.dir(st.team); n++; } } }
m.dispose();
check('Quick Match: 4v4 with a keeper, defender, midfielder and striker, the midfielder behind the striker', roles.every((r) => r === 'GK,DEF,MID,ST') && behind / n > 2, { roles, behind: +(behind / n).toFixed(1) });
console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
