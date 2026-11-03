// The four newest moves do what their text says (on the server's copy of the game, fast):
// SECOND WIND refills stamina, CHIP SHOT lobs, RALLY protects teammates near you, FROST slows opponents near you.
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
  check('SECOND WIND: stamina full at once, sprinting costs half for 6s', ok === true && p.stamina === 100 && !p.exhausted && p.fx.wind === 6 && p.mods.stamDrain === 0.5, { stamina: p.stamina, wind: p.fx.wind, drain: p.mods.stamDrain });
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
  check('FROST: opponents within 6 blocks slow right down for 2.5s, not keepers or far ones', ok === true && o1.fx.slimed === 2.5 && o1.mods.speed < 0.7 * o1.speedMul + 0.01 && !(o2.fx.slimed > 0) && !(gk.fx.slimed > 0), { near: o1.fx.slimed, speed: +o1.mods.speed.toFixed(2), far: o2.fx.slimed || 0, keeper: gk.fx.slimed || 0 });
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
console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
