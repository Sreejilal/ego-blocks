// Bug fixes from the Nov 2026 "less buggy" pass, on the server's copy of the game (fast):
// the back of the goal net stops you instead of throwing you to the side, a button you were holding when the ball went
// out does not take the throw-in by accident, and a shot pressed as play stopped never fires by itself at the restart.
const G = require('../server/headless').load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const F = G.F;
const ctl = (o = {}) => Object.assign({ moveX: 0, moveY: 0, sprint: false, jump: false, jumpHeld: false, shootDown: false, shootHeld: false, shootUp: false, passDown: false, passUp: false, passHeld: false, dodge: false, tackle: false, ab: [false, false, false], flow: false, emote: -1, awaken: false, shiftLock: false, item: false, camYaw: 0 }, o);
function setup() {
  const m = new G.Match('quick', 0.5, { noHuman: true, autopilot: true, size: 3 });
  for (let i = 0; i < 400 && m.phase !== 'play'; i++) m.update(1 / 60);
  const p = m.teams[0].find((q) => !q.isGK);
  return { m, p };
}

// 1) behind the goal, walking into the back of the net
{
  const { m, p } = setup();
  p.pos.set(0.6, 0, F.L + F.GD + 1.2); p.vel.set(0, 0, 0); p.setState('free');
  let maxX = 0;
  for (let i = 0; i < 60; i++) { p.mx = 0; p.mz = -1; p.sprint = false; p.physics(1 / 60); maxX = Math.max(maxX, Math.abs(p.pos.x)); }
  check('the back of the net stops you (no jump to the side of the goal)', maxX < 1 && p.pos.z >= F.L + F.GD + 0.5, { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), maxX: +maxX.toFixed(2) });
  // and from the side it still pushes you out sideways
  p.pos.set(F.GW + F.POST + 1.2, 0, F.L + 1.2); p.vel.set(0, 0, 0);
  for (let i = 0; i < 60; i++) { p.mx = -1; p.mz = 0; p.physics(1 / 60); }
  check('the side of the net still stops you from the side', Math.abs(p.pos.x) >= F.GW + F.POST + 0.4 && Math.abs(p.pos.z - (F.L + 1.2)) < 0.3, { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) });
  m.dispose();
}

// 2) a throw-in: letting go of a button you were holding does not take it, a fresh press does
{
  const { m, p } = setup();
  p.isHuman = true;
  for (const q of m.teams[0]) if (q !== p && !q.isGK) q.pos.set(-20, 0, -30);
  p.pos.set(F.W - 1, 0, 2);
  m.restart = { type: 'THROW-IN', team: 0, x: F.W + 0.35, z: 2 };
  m.doRestart();
  const taker = m.setPieceBy === p;
  m.updateHuman(1 / 60, ctl({ shootUp: true }), p);
  m.updateHuman(1 / 60, ctl({ passUp: true }), p);
  const stale = { stillHeld: !!p.setPiece && m.ball.owner === p };
  m.updateHuman(1 / 60, ctl({ passDown: true, passHeld: true }), p);
  check('a button you held when the ball went out does not take the throw-in when you let go', taker && stale.stillHeld, { taker, stale });
  check('a fresh press takes it', !p.setPiece && m.ball.owner !== p, { setPiece: !!p.setPiece });
  m.dispose();
}

// 3) a shot pressed as play stopped is forgotten
{
  const { m, p } = setup();
  p.isHuman = true;
  p.shotBuffer = { power: 1, curveIn: 0, t: 0.35 };
  m.phase = 'goal';
  m.updateHuman(1 / 60, ctl(), p);
  check('a waiting shot is forgotten when play stops (no shot by itself at the kickoff)', p.shotBuffer === null, { buf: p.shotBuffer });
  m.phase = 'play'; p.shotBuffer = { power: 1, curveIn: 0, t: 0.35 }; p.setState('down', 1);
  m.updateHuman(1 / 60, ctl(), p);
  check('and when you are knocked over', p.shotBuffer === null, { buf: p.shotBuffer });
  m.dispose();
}

console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
