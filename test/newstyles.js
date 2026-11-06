// SPARK and TITAN do what their text says (on the server's copy of the game, fast):
// ZAP stuns the nearest opponent close by, RAM charges and knocks over anyone in the way.
// Also the six new celebrations and three new emotes.
const G = require('../server/headless').load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

function setup(style) {
  const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: 3, teamStyle: [style, 'ROOKIE'] });
  for (let i = 0; i < 300 && m.phase !== 'play'; i++) m.update(1 / 60);
  const p = m.teams[0].find((q) => !q.isGK);
  for (const q of m.players) { q.vel.set(0, 0, 0); q.setState('free'); q.tackleProof = 0; q.iframes = 0; }
  p.pos.set(0, 0, 10); p.yaw = 0;
  m.ball.reset(0, 10.6); m.possess(p, true);
  const [gk, o1, o2] = [m.teams[1].find((q) => q.isGK), ...m.teams[1].filter((q) => !q.isGK)];
  gk.pos.set(0, 0, m.oppGoalZ(0)); o2.pos.set(-15, 0, -20);
  return { m, p, o1, o2, gk, idx: (id) => p.abil.findIndex((a) => a.id === id) };
}

{ // ZAP
  const { m, p, o1, o2, idx } = setup('SPARK');
  o1.pos.set(2.5, 0, 11);
  const ok = m.useAbility(p, idx('zap'));
  check('ZAP: the nearest opponent within 4 blocks is stunned for half a second, not far ones', ok === true && o1.state === 'stun' && o1.stateDur === 0.5 && o2.state === 'free', { near: o1.state, dur: o1.stateDur, far: o2.state });
  const s2 = setup('SPARK'); s2.o1.pos.set(9, 0, 18);
  const miss = s2.m.useAbility(s2.p, s2.idx('zap'));
  check('ZAP: nobody close, nothing happens and it does not recharge', miss === false && s2.p.abil[s2.idx('zap')].cd === 0, { miss, cd: s2.p.abil[s2.idx('zap')].cd });
}
{ // RAM
  const { m, p, o1, o2, idx } = setup('TITAN');
  o1.pos.set(0, 0, 13);
  const z0 = p.pos.z, ok = m.useAbility(p, idx('ram'));
  let downed = false; for (let i = 0; i < 30; i++) { m.update(1 / 60); if (o1.state === 'down') downed = true; }
  check('RAM: a charge forward that knocks over whoever is in the way, keeping the ball', ok === true && p.pos.z - z0 > 4.5 && downed && o2.state !== 'down' && m.ball.owner === p, { moved: +(p.pos.z - z0).toFixed(1), downed, far: o2.state, owner: m.ball.owner && m.ball.owner.name });
}
{ // both styles complete and in the spins
  const bad = ['SPARK', 'TITAN'].filter((k) => { const s = G.STYLES[k]; return !s || s.abilities.length !== 3 || s.abilities.some((a) => !G.ABILITIES[a]) || !s.awaken || !s.awaken.move || !s.awaken.name; });
  check('SPARK and TITAN each have three moves and an Awakening', !bad.length, bad);
}
{ // six new celebrations, each with its own moves (three are emotes too)
  const { p } = setup('ROOKIE');
  const pose = {};
  for (const [id, want] of [['SALUTE', 'salute'], ['BOW', 'bow'], ['AIR_DRUMS', 'drums'], ['FIST_PUMP', 'pump'], ['CHILL', 'chill'], ['FIREWORKS', 'fireworks']]) {
    if (!G.SKINS[id] || G.SKINS[id].celeb !== want) { pose[id] = 'missing'; continue; }
    p.look.celeb = want; p.setState('celebrate', 3);
    for (let i = 0; i < 40; i++) { p.stateT += 1 / 60; p.animate(1 / 60); }
    const P = p.P; pose[id] = [P.armL.rotation.x, P.armR.rotation.x, P.armR.rotation.z, P.body.rotation.x, P.body.position.y, P.legL.rotation.x].map((v) => +v.toFixed(2)).join(',');
  }
  const vals = Object.values(pose);
  check('six new goal celebrations, all different', vals.every((v) => v !== 'missing') && new Set(vals).size === 6, pose);
  p.look.celeb = 'knees'; p.setState('celebrate', 3);
  for (let i = 0; i < 40; i++) { p.stateT += 1 / 60; p.animate(1 / 60); }
  check('the body moves up and down in animations (a knee slide drops low)', p.P.body.position.y < 0.45, +p.P.body.position.y.toFixed(2));
  const em = G.EMOTES.map((e) => e.id);
  check('nine emotes, the new ones included', em.length === 9 && ['salute', 'bow', 'drums'].every((k) => em.includes(k)), em);
}
console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
