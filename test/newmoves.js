// The four newest moves do what their text says (on the server's copy of the game, fast):
// SECOND WIND refills stamina, CHIP SHOT lobs, RALLY protects teammates near you, FROST slows opponents near you,
// FAKE SHOT does not freeze the same defender twice in a row, COMET's ROCKET JUMP landing knocks the ball loose.
const G = require('../server/headless').load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

function setup(style) {
  const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: 3, teamStyle: [style, 'ROOKIE'] });
  for (let i = 0; i < 300 && m.phase !== 'play'; i++) m.update(1 / 60);
  const p = m.teams[0].find((q) => !q.isGK), mate = m.teams[0].find((q) => !q.isGK && q !== p);
  for (const q of m.players) { q.vel.set(0, 0, 0); q.setState('free'); }
  p.pos.set(0, 0, 10); p.yaw = 0;
  m.ball.reset(0, 10.6); m.possess(p, true);
  return { m, p, mate, idx: (id) => p.abil.findIndex((a) => a.id === id) };
}

{ // SECOND WIND
  const { m, p, idx } = setup('KESTREL');
  p.stamina = 8; p.exhausted = true;
  const ok = m.useAbility(p, idx('secondWind')); p.computeMods();
  check('SECOND WIND: stamina full at once, sprinting costs half for 3s', ok === true && p.stamina === 100 && !p.exhausted && p.fx.wind === 3 && p.mods.stamDrain === 0.5, { stamina: p.stamina, wind: p.fx.wind, drain: p.mods.stamDrain });
}
{ // CHIP SHOT
  const { m, p, idx } = setup('FEATHER');
  m.aim.set(2, 2, m.oppGoalZ(0));
  const ok = m.useAbility(p, idx('chipShot')), b = m.ball;
  let top = 0; for (let i = 0; i < 90; i++) { m.update(1 / 60); top = Math.max(top, b.pos.y); }
  check('CHIP SHOT: a high soft lob at goal', ok === true && b.kick && b.kick.special === 'chip' && top > 4, { special: b.kick && b.kick.special, top: +top.toFixed(1) });
}
{ // RALLY
  const { m, p, mate, idx } = setup('CAPTAIN');
  const far = m.teams[0].find((q) => q !== p && q !== mate);
  mate.pos.set(5, 0, 12); far.pos.set(0, 0, -30); mate.tackleProof = far.tackleProof = 0;
  const ok = m.useAbility(p, idx('rally'));
  check('RALLY: you and teammates within 10 blocks cannot be tackled for 2.5s', ok === true && p.tackleProof >= 2.5 && mate.tackleProof >= 2.5 && far.tackleProof === 0, { me: p.tackleProof, near: mate.tackleProof, far: far.tackleProof });
}
{ // FROST
  const { m, p, idx } = setup('GLACIER');
  const [gk, o1, o2] = [m.teams[1].find((q) => q.isGK), ...m.teams[1].filter((q) => !q.isGK)];
  o1.pos.set(3, 0, 12); o2.pos.set(-20, 0, 30); gk.pos.set(1, 0, 13);
  const ok = m.useAbility(p, idx('frost')); o1.computeMods(); o2.computeMods();
  check('FROST: opponents within 7 blocks slow right down for 3s, not keepers or far ones', ok === true && o1.fx.slimed === 3 && o1.mods.speed < 0.7 * o1.speedMul + 0.01 && !(o2.fx.slimed > 0) && !(gk.fx.slimed > 0), { near: o1.fx.slimed, speed: +o1.mods.speed.toFixed(2), far: o2.fx.slimed || 0, keeper: gk.fx.slimed || 0 });
}
{ // the five newest styles are complete and in the game
  const ids = ['KESTREL', 'ANCHOR', 'FEATHER', 'CAPTAIN', 'GLACIER'];
  const bad = ids.filter((k) => { const s = G.STYLES[k]; return !s || s.abilities.length !== 3 || s.abilities.some((a) => !G.ABILITIES[a]) || !s.awaken || !s.awaken.move || !s.awaken.name; });
  check('the five newest styles each have three moves and an Awakening', !bad.length, bad);
}
{ // three new Flows
  const f = ['IRON_NERVE', 'WILDFIRE', 'FROSTBITE'].map((k) => G.FLOWS[k]);
  const { p } = setup('ROOKIE');
  p.flowId = 'WILDFIRE'; p.flowT = 5; p.computeMods();
  check('three new Flows, with their boosts', f.every((x) => x && x.mods && x.color && x.desc) && p.mods.speed > 1.14 * p.speedMul && p.mods.stamDrain > 1.2, { speed: +p.mods.speed.toFixed(2), drain: p.mods.stamDrain });
}
{ // four new celebrations move the arms
  const { p } = setup('ROOKIE');
  const arms = {};
  for (const [id, want] of [['WAVE', 'wave'], ['APPLAUSE', 'clap'], ['FLEX', 'flex'], ['SKY_POINT', 'point']]) {
    if (G.SKINS[id].celeb !== want) { arms[id] = 'wrong'; continue; }
    p.look.celeb = want; p.setState('celebrate', 3);
    for (let i = 0; i < 30; i++) p.animate(1 / 60);
    arms[id] = +Math.min(p.P.armL.rotation.x, p.P.armR.rotation.x).toFixed(2);
  }
  check('four new goal celebrations, each with its own moves', Object.values(arms).every((v) => typeof v === 'number' && v < -1), arms);
}
{ // Nov 2026 balance: FAKE SHOT freezes defenders within 5 blocks, and never the same one twice within 1.5s
  const { m, p } = setup('PHANTOM');
  const [o1, o2] = m.teams[1].filter((q) => !q.isGK);
  o1.pos.set(0.5, 0, 12.6); o2.pos.set(0, 0, 16.2);
  m.feint(p, 5, 0.45); const first = [o1.state, o2.state];
  for (let i = 0; i < 40; i++) m.update(1 / 60);
  for (const q of [p, o1]) { q.vel.set(0, 0, 0); q.setState('free'); } p.pos.set(0, 0, 10); o1.pos.set(0.5, 0, 12.6);
  m.feint(p, 5, 0.45); const again = o1.state;
  for (let i = 0; i < 70; i++) m.update(1 / 60);
  for (const q of [p, o1]) { q.vel.set(0, 0, 0); q.setState('free'); } p.pos.set(0, 0, 10); o1.pos.set(0.5, 0, 12.6);
  m.feint(p, 5, 0.45); const later = o1.state;
  check('FAKE SHOT: freezes a defender close by (not one 6 away), not again within 1.5s, then again', first.join() === 'stun,free' && again === 'free' && later === 'stun', { first, again, later });
}
{ // COMET's ROCKET JUMP: landing next to an opponent with the ball knocks it loose, up towards COMET
  const { m, p } = setup('COMET');
  const o = m.teams[1].find((q) => !q.isGK);
  const jump = (dist, proof) => {
    for (const q of [p, o]) { q.vel.set(0, 0, 0); q.setState('free'); q.mx = q.mz = 0; }
    p.pos.set(0, 0, 10); p.onGround = true; p.abil.forEach((a) => { a.cd = 0; });
    o.pos.set(0, 0, 10 + dist); o.tackleProof = proof ? 5 : 0; o.iframes = 0;
    m.ball.reset(0, 10.5 + dist); m.possess(o); o.protect = 0;
    const used = m.useAbility(p, p.abil.findIndex((a) => a.id === 'rocketJump'));
    for (let t = 0; t < 180 && (!p.onGround || t < 2) && m.ball.owner === o; t++) { p.mx = p.mz = 0; p.physics(1 / 60); m.ball.pos.set(0, 0.3, 10.5 + dist); m.rocketLandings(); }
    return { used, owner: m.ball.owner === o ? 'carrier' : m.ball.owner ? 'other' : 'loose', up: m.ball.vel.y > 3, toward: m.ball.vel.z < 0 };
  };
  const near = jump(2.5), far = jump(5), proof = jump(2.5, true);
  check('ROCKET JUMP: land next to the carrier and the ball pops loose towards you (not from 5 away, not off a tackle-proof carrier)', near.used === true && near.owner === 'loose' && near.up && near.toward && far.owner === 'carrier' && proof.owner === 'carrier', { near, far, proof });
}
console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
