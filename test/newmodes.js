// The four extra modes (Golden Goal, No Keepers, Turbo, Moon Ball), run the way the online server runs them:
// bots only, no screen. Each one plays to the end with no error and does what its name says.
const G = require('../server/headless').load();
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const STEP = 1 / 60;
function play(mode, opts = {}) {
  const humans = [{ id: 'a', team: 0, name: 'ANNA', style: 'ROOKIE', flow: null, look: {}, tone: 1 }, { id: 'b', team: 1, name: 'BEN', style: 'SPRINTER', flow: null, look: {}, tone: 2 }];
  const m = new G.Match(mode, 0.5, Object.assign({ humans, size: 3, bots: 'fill', home: 'ROVERS', away: G.CLUB_IDS.find((c) => c !== 'ROVERS'), length: 60, goldenLength: 10 }, opts));
  m.autopilot = true; // the two "friends" are played by bots too
  let steps = 0, maxY = 0, kicks = 0, err = null, firstGoalAt = null;
  try {
    while (!m.result && steps < 60 * 400) {
      m.update(STEP); steps++;
      maxY = Math.max(maxY, m.ball.pos.y);
      if (firstGoalAt == null && m.score[0] + m.score[1] > 0) firstGoalAt = steps;
    }
  } catch (e) { err = e.stack.split('\n').slice(0, 3).join(' | '); }
  return { m, steps, maxY, err, firstGoalAt, secs: +(steps * STEP).toFixed(1) };
}
check('the modes exist with names', ['golden', 'nokeep', 'turbo', 'moon'].every((k) => G.MODES[k] && G.MODES[k].name && G.MODES[k].tip), ['golden', 'nokeep', 'turbo', 'moon'].map((k) => G.MODES[k] && G.MODES[k].name));

const q = play('quick');
check('a normal match still plays to the end', !q.err && !!q.m.result, { err: q.err, secs: q.secs, score: q.m.score });
check('a normal match has keepers', q.m.players.filter((p) => p.role === 'GK').length === 2);

let g = null; for (let i = 0; i < 6 && !(g && g.firstGoalAt); i++) g = play('golden', { length: 600 }); // bots can go a long time without scoring: try until a match has a goal
check('Golden Goal: plays with no error', !g.err, g.err);
check('Golden Goal: the match ends at the first goal', !!g.m.result && g.m.score[0] + g.m.score[1] === 1 && g.steps - g.firstGoalAt < 60 * 12, { score: g.m.score, secs: g.secs, firstGoal: g.firstGoalAt && +(g.firstGoalAt * STEP).toFixed(1) });

const n = play('nokeep');
check('No Keepers: plays to the end with no error', !n.err && !!n.m.result, { err: n.err, score: n.m.score });
check('No Keepers: nobody is in goal, the two friends still play', n.m.players.every((p) => p.role !== 'GK') && n.m.players.filter((p) => p.netId).length === 2, n.m.players.map((p) => p.role));

const t = play('turbo');
check('Turbo: plays to the end with no error', !t.err && !!t.m.result, { err: t.err, score: t.m.score });
// same clock (60s + extra time if level): the turbo one takes less real time for the same match time
const tq = t.m.time / t.secs;
check('Turbo: the match runs about 25% faster than real time', tq > 1.2 && tq < 1.3, +tq.toFixed(3));

// Moon Ball: the same kick flies higher and hangs longer
const hang = (mode) => {
  const { m } = play(mode, { length: 0.02 });
  const mm = new G.Match(mode, 0.5, { humans: [], size: 3, bots: 'fill', home: 'ROVERS', away: G.CLUB_IDS.find((c) => c !== 'ROVERS') });
  mm.update(STEP); // sets this match's gravity
  const b = mm.ball; b.owner = null; b.pos.set(0, 0.3, 0); b.vel.set(0, 12, 0);
  let top = 0, air = 0; for (let i = 0; i < 600; i++) { b.update(STEP); top = Math.max(top, b.pos.y); if (b.pos.y > 0.5) air++; }
  return { top: +top.toFixed(1), air: +(air * STEP).toFixed(2) };
};
const hq = hang('quick'), hm = hang('moon');
check('Moon Ball: the same kick goes much higher and hangs longer', hm.top > hq.top * 1.8 && hm.air > hq.air * 1.8, { normal: hq, moon: hm });
const hq2 = hang('quick');
check('and a normal match after it is normal again', hq2.top === hq.top, hq2);
const mo = play('moon');
check('Moon Ball: plays to the end with no error', !mo.err && !!mo.m.result, { err: mo.err, score: mo.m.score, maxY: +mo.maxY.toFixed(1) });

console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
