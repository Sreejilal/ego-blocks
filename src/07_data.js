/* =====================================================================
   Styles, abilities, Flows, Lawless items, rarities, ranks
   ===================================================================== */
const RARITIES = ['Rare', 'Epic', 'Legendary', 'Mythic', 'Generational'];
const RARITY_ODDS = [55, 28, 12, 4.5, 0.5];
const RARITY_HEX = { Rare: '#4aa8ff', Epic: '#b65cff', Legendary: '#ffc53a', Mythic: '#ff3d52', Generational: '#ffffff' };
const NEED_BALL = 'NEED THE BALL';

const STYLES = {
  ROOKIE: { name: 'ROOKIE', rarity: 'Rare', hair: '#3b2a22', hairShape: 'short', aura: '#3fd6ff', blurb: 'Reads the whole pitch. The free starter, and it can still win games.', abilities: ['vision', 'quickShot', 'burst'] },
  SPRINTER: { name: 'SPRINTER', rarity: 'Rare', hair: '#c8323e', hairShape: 'long', aura: '#ff5a3c', blurb: 'Raw pace. Burns past the back line, then bends it in.', abilities: ['turbo', 'cutInside', 'curler'] },
  PHANTOM: { name: 'PHANTOM', rarity: 'Epic', hair: '#17151f', hairShape: 'bob', aura: '#9a6bff', blurb: 'A slippery dribbler that leaves black feathers and frozen defenders behind.', abilities: ['zigzag', 'feint', 'snapPass'] },
  ENFORCER: { name: 'ENFORCER', rarity: 'Epic', hair: '#8a1f33', hairShape: 'swept', aura: '#ffb02e', blurb: 'Midfield general. Flattens attackers and threads perfect through balls.', abilities: ['armSwipe', 'pinpointPass', 'lockdown'] },
  SHAMBLER: { name: 'SHAMBLER', rarity: 'Legendary', hair: '#a6c49c', hairShape: 'messy', aura: '#7dff6a', blurb: 'An undead dribble nobody can tackle, and long arms that steal anything.', abilities: ['undeadShuffle', 'graveGrab', 'lurch'] },
  MAGNET: { name: 'MAGNET', rarity: 'Mythic', hair: '#eef2f7', hairShape: 'fluffy', aura: '#8fd4ff', blurb: 'Kills any high ball dead on the boot, then finishes it in the air.', abilities: ['skyTrap', 'volley', 'fakeVolley'] },
  RAILGUN: { name: 'RAILGUN', rarity: 'Generational', hair: '#f2d35a', hairShape: 'spiky', aura: '#4c7dff', blurb: 'The striker of a generation. Shots fly dead straight from anywhere.', abilities: ['impactShot', 'call', 'overhead'] },
};
const STYLE_IDS = Object.keys(STYLES);

function nearBall(p, m, r = 1.9) {
  const b = m.ball;
  if (b.owner === p) return true;
  if (b.owner) return false;
  return dist2D(b.pos, p.pos) < r && b.pos.y - p.pos.y < 2.4;
}
function aimFor(p, m) { return p.isHuman ? m.aim.clone() : AI.shotTarget(p, m); }

const ABILITIES = {
  vision: {
    name: 'VISION', cd: 14, icon: 'eye',
    desc: '4s of light slow-mo. Glowing block paths show your open teammates and the best shooting lane.',
    use(p) { p.fx.vision = 4; if (p.isHuman) TimeCtl.slowMo(0.7, 4); FX.ring(p.pos.x, 0.25, p.pos.z, p.aura, 1.6, 26); return true; },
    ai(p, m, c) { return c.hasBall && c.pressure > 4 && c.dGoal > 12; },
  },
  quickShot: {
    name: 'QUICK SHOT', cd: 10, icon: 'shot',
    desc: 'An instant low shot with no wind-up. Uses your aim.',
    use(p, m) { if (!nearBall(p, m)) return NEED_BALL; const t = aimFor(p, m); t.y = Math.min(t.y, 0.8); m.shootAt(p, t, 0.85, { trail: p.aura, kickDur: 0.2 }); return true; },
    ai(p, m, c) { return c.hasBall && c.dGoal < 22 && c.angleOK; },
  },
  burst: {
    name: 'BURST', cd: 12, icon: 'buff',
    desc: '2 seconds of +45% speed.',
    use(p) { p.fx.burst = 2; FX.ring(p.pos.x, 0.2, p.pos.z, p.aura, 1, 14); return true; },
    ai(p, m, c) { return (c.hasBall && c.spaceAhead && c.dGoal > 12) || (c.chasing && c.chaseDist > 9) || (c.defending && c.carrierDist > 9 && c.carrierDist < 20); },
  },
  turbo: {
    name: 'TURBO', cd: 12, icon: 'dash',
    desc: '3 seconds of +75% speed with a dust trail. Sprinting costs no stamina while it lasts.',
    use(p) { p.fx.turbo = 3; return true; },
    ai(p, m, c) { return (c.hasBall && c.spaceAhead && c.dGoal > 14) || (c.chasing && c.chaseDist > 10) || (c.defending && c.carrierDist > 10 && c.carrierDist < 24); },
  },
  cutInside: {
    name: 'CUT INSIDE', cd: 10, icon: 'dash',
    desc: 'A sharp dash with the ball toward the middle. Beats one tackle.',
    use(p, m) {
      if (m.ball.owner !== p) return NEED_BALL;
      const s = m.dir(p.team);
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const side = p.pos.x > 0 ? -1 : 1;
      let dx = fx * 0.55 + side * 0.85, dz = fz * 0.55 + s * 0.35;
      const l = len2D(dx, dz); dx /= l; dz /= l;
      m.dashP(p, dx, dz, 17, 0.32); p.tackleProof = 0.6;
      FX.dust(p.pos.x, p.pos.z, 6); Sfx.dodge();
      return true;
    },
    ai(p, m, c) { return c.hasBall && c.nearOpp < 3.4 && c.oppInFront; },
  },
  curler: {
    name: 'CURLER', cd: 14, icon: 'shot',
    desc: 'A shot that starts wide and bends hard back in around the keeper.',
    use(p, m) { if (!nearBall(p, m)) return NEED_BALL; m.curlShot(p, aimFor(p, m)); return true; },
    ai(p, m, c) { return c.hasBall && c.dGoal < 26 && c.dGoal > 8; },
  },
  zigzag: {
    name: 'ZIGZAG', cd: 10, icon: 'dash',
    desc: 'A rapid zig-zag dash past the defender in front. Tackle-proof while dashing. Leaves black feathers.',
    use(p, m) {
      if (m.ball.owner !== p) return NEED_BALL;
      m.dashP(p, Math.sin(p.yaw), Math.cos(p.yaw), 14.5, 0.62, { zig: true });
      p.tackleProof = 0.7; p.fx.feathers = 0.7; Sfx.swoosh();
      return true;
    },
    ai(p, m, c) { return c.hasBall && c.nearOpp < 4.2 && c.oppInFront; },
  },
  feint: {
    name: 'FEINT', cd: 8, icon: 'fake',
    desc: 'Fake a shot. Defenders near you freeze for 0.6s and the keeper may dive the wrong way.',
    use(p, m) { if (!nearBall(p, m)) return NEED_BALL; p.kickT = 0; p.kickDur = 0.3; m.feint(p, 6.5, 0.6); return true; },
    ai(p, m, c) { return c.hasBall && (c.nearOpp < 4.5 || (c.dGoal < 16 && c.angleOK)); },
  },
  snapPass: {
    name: 'SNAP PASS', cd: 10, icon: 'pass',
    desc: 'An instant laser-straight pass to the teammate you aim at.',
    use(p, m) {
      if (m.ball.owner !== p) return NEED_BALL;
      const mate = p.isHuman ? m.pickPassTarget(p) : (AI.bestPass(m, p, m.skill(p)) || {}).mate;
      if (!mate) return 'NO TEAMMATE';
      m.passTo(p, mate, { snap: true }); return true;
    },
    ai(p, m, c) { return c.hasBall && c.goodPass && c.pressure < 3.5; },
  },
  armSwipe: {
    name: 'ARM SWIPE', cd: 12, icon: 'grab',
    desc: 'Off the ball only. Shove the opponent in front to the floor for 1.5s, so they are easy to rob.',
    use(p, m) {
      if (m.ball.owner === p) return 'ONLY OFF THE BALL';
      const t = m.opponentInFront(p, 3.4, 1.1);
      if (!t) return 'NO TARGET IN RANGE';
      const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, l = len2D(dx, dz) || 1;
      p.kickT = 0; p.yaw = Math.atan2(dx, dz);
      m.knockDown(t, 1.5, dx / l, dz / l, 5, p);
      Sfx.punch(); FX.sparks(t.pos.x, 1.2, t.pos.z, p.aura, 10, 4);
      return true;
    },
    ai(p, m, c) { return !c.hasBall && c.carrierOpp && c.carrierDist < 3.1; },
  },
  pinpointPass: {
    name: 'PINPOINT PASS', cd: 10, icon: 'pass',
    desc: 'A perfect curling through ball into the space ahead of a teammate.',
    use(p, m) {
      if (m.ball.owner !== p) return NEED_BALL;
      const mate = p.isHuman ? m.pickPassTarget(p) : AI.bestRunner(m, p);
      if (!mate) return 'NO TEAMMATE';
      m.throughBall(p, mate); return true;
    },
    ai(p, m, c) { return c.hasBall && c.runnerAhead; },
  },
  lockdown: {
    name: 'LOCKDOWN', cd: 16, icon: 'shield',
    desc: '4s of a huge tackle hitbox. Your slide tackles reach more than twice as far.',
    use(p) { p.fx.lockdown = 4; return true; },
    ai(p, m, c) { return c.defending && c.carrierDist < 9; },
  },
  undeadShuffle: {
    name: 'UNDEAD SHUFFLE', cd: 16, icon: 'dash',
    desc: '3s extended dribble with arms stretched out, swaying and auto-dodging every tackle.',
    use(p, m) { if (m.ball.owner !== p) return NEED_BALL; p.fx.shuffle = 3; p.tackleProof = 3; Sfx.swoosh(); return true; },
    ai(p, m, c) { return c.hasBall && c.nearOpp < 5; },
  },
  graveGrab: {
    name: 'GRAVE GRAB', cd: 12, icon: 'grab',
    desc: 'A long-reach lunge that steals the ball from a nearby carrier, or snatches a loose ball.',
    use(p, m) {
      if (m.ball.owner === p) return 'ALREADY ON THE BALL';
      const b = m.ball;
      if (b.owner && b.owner.team !== p.team && dist2D(b.owner.pos, p.pos) < 7.5) { m.graveGrab(p, b.owner); return true; }
      if (!b.owner && dist2D(b.pos, p.pos) < 6.5 && b.pos.y < 2.2) { m.graveGrab(p, null); return true; }
      return 'NO TARGET IN RANGE';
    },
    ai(p, m, c) { return !c.hasBall && ((c.carrierOpp && c.carrierDist < 6.5) || (c.looseDist < 5.5)); },
  },
  lurch: {
    name: 'LURCH', cd: 10, icon: 'dash',
    desc: 'Burst straight at the nearest ball carrier.',
    use(p, m) {
      const c = m.ball.owner;
      if (!c || c.team === p.team) return 'NO CARRIER TO CHASE';
      const d = dist2D(c.pos, p.pos);
      if (d > 24) return 'TOO FAR';
      const dx = (c.pos.x - p.pos.x) / d, dz = (c.pos.z - p.pos.z) / d;
      m.dashP(p, dx, dz, 21, Math.min(0.8, d / 21), { home: c });
      FX.feathers(p.pos.x, 0.5, p.pos.z, p.aura, 6);
      return true;
    },
    ai(p, m, c) { return c.carrierOpp && c.carrierDist > 4 && c.carrierDist < 18; },
  },
  skyTrap: {
    name: 'SKY TRAP', cd: 8, icon: 'trap',
    desc: 'For 5s, the next high ball you touch dies dead on your boot, even mid-air.',
    use(p) { p.fx.skyTrap = 5; FX.ring(p.pos.x, 0.3, p.pos.z, p.aura, 1.4, 20); return true; },
    ai(p, m, c) { return c.highBallNear; },
  },
  volley: {
    name: 'VOLLEY', cd: 12, icon: 'shot',
    desc: 'A huge volley while airborne. On the ground it flicks the ball up and volleys it for you.',
    use(p, m) { return m.volley(p); },
    ai(p, m, c) { return (c.hasBall && c.dGoal < 23 && c.angleOK) || (c.highBallNear && c.dGoal < 24); },
  },
  fakeVolley: {
    name: 'FAKE VOLLEY', cd: 14, icon: 'fake',
    desc: 'Fake the volley, freeze defenders around you, then cut the ball the other way.',
    use(p, m) { return m.fakeVolley(p); },
    ai(p, m, c) { return c.hasBall && c.nearOpp < 4; },
  },
  impactShot: {
    name: 'IMPACT SHOT', cd: 20, icon: 'beam',
    desc: 'Infinite range, max power, zero arc. The ball flies dead straight as a glowing beam.',
    use(p, m) { if (!nearBall(p, m, 2.1)) return NEED_BALL; m.impactShot(p, aimFor(p, m)); return true; },
    ai(p, m, c) { return c.hasBall && c.dGoal < 46 && c.angleOK && (c.dGoal < 30 || chance(0.4)); },
  },
  call: {
    name: 'CALL', cd: 14, icon: 'call',
    desc: 'Demand the ball. Teammates instantly pass to you if you are open.',
    use(p, m) { if (m.ball.owner === p) return 'YOU HAVE THE BALL'; p.fx.call = 3; m.callNow(p); return true; },
    ai(p, m, c) { return c.mateHasBall && c.open > 4.5 && c.progAhead > 2; },
  },
  overhead: {
    name: 'OVERHEAD', cd: 16, icon: 'flip',
    desc: 'A bicycle kick off any high ball. On the ground it pops the ball up and flips into it.',
    use(p, m) { return m.overhead(p); },
    ai(p, m, c) { return (c.hasBall && c.dGoal < 17 && c.angleOK) || (c.highBallNear && c.dGoal < 20); },
  },
};

const FLOWS = {
  SECOND_WIND: { name: 'SECOND WIND', rarity: 'Rare', color: '#7dffb0', desc: '+60% stamina regen.', mods: { stamRegen: 1.6 } },
  OVERCLOCK: { name: 'OVERCLOCK', rarity: 'Epic', color: '#ff6a3c', desc: '+20% speed with and without the ball.', mods: { speed: 1.2 } },
  VIPER: { name: 'VIPER', rarity: 'Epic', color: '#5dff7a', desc: 'Bigger tackle hitbox and tackle cooldown halved.', mods: { tackleRange: 1.6, tackleCd: 0.5 } },
  GAMBLE: { name: 'GAMBLE', rarity: 'Legendary', color: '#ffcb3d', desc: 'A random boost to speed, shot power or stamina. 10% chance of all three.', gamble: true, mods: {} },
  BLUE_FLAME: { name: 'BLUE FLAME', rarity: 'Mythic', color: '#3d8bff', desc: 'Ability cooldowns 25% shorter.', mods: { cdRate: 1 / 0.75 } },
  MONARCH: { name: 'MONARCH', rarity: 'Generational', color: '#ffffff', desc: '+20% shot power, +12% speed and cooldowns 15% shorter.', mods: { shot: 1.2, speed: 1.12, cdRate: 1 / 0.85 } },
};
const FLOW_IDS = Object.keys(FLOWS);
const RAW_FLOW_DESC = 'No Flow equipped: +8% speed. Equip one from Flow Spins for a bigger buff.';

const ITEMS = {
  fist: { name: 'ROCKET FIST', icon: 'fist', desc: 'Fires a glove at the nearest opponent in front. Knocks them flat.', use(p, m) { return m.fireProjectile(p, 'fist'); }, ai(p, m, c) { return c.carrierOpp && c.carrierDist < 13 && c.carrierInFront; } },
  boom: { name: 'BOOM BLOCK', icon: 'boom', desc: 'Lob an explosive block. Blasts everyone nearby off their feet.', use(p, m) { return m.fireProjectile(p, 'boom'); }, ai(p, m, c) { return c.oppNearBall >= 2 && c.ballDist < 14 && c.ballDist > 4; } },
  slime: { name: 'SLIME SPILL', icon: 'slime', desc: 'Drops a slime puddle. Opponents who run through it slip over.', use(p, m) { return m.dropHazard(p, 'slime'); }, ai(p, m, c) { return c.chasedBy && c.hasBall; } },
  jet: { name: 'JETPACK', icon: 'jet', desc: '3.5s of flight. Hold jump to rise. +25% speed.', use(p) { p.fx.jetpack = 3.5; return true; }, ai(p, m, c) { return c.chasing && c.chaseDist > 10; } },
  snow: { name: 'SNOWBALL', icon: 'snow', desc: 'A fast snowball. Freezes the first opponent it hits for 2s.', use(p, m) { return m.fireProjectile(p, 'snow'); }, ai(p, m, c) { return c.carrierOpp && c.carrierDist < 16 && c.carrierInFront; } },
  magnet: { name: 'MAGNET', icon: 'magnet', desc: 'For 2.5s, pulls a loose ball to you and yanks it off nearby carriers.', use(p) { p.fx.magnet = 2.5; return true; }, ai(p, m, c) { return (!c.hasBall && c.looseDist < 12) || (c.carrierOpp && c.carrierDist < 7); } },
  bubble: { name: 'BUBBLE', icon: 'bubble', desc: '4s forcefield. Tackles, shoves and items bounce off you.', use(p) { p.fx.bubble = 4; return true; }, ai(p, m, c) { return c.hasBall && c.nearOpp < 3.5; } },
  wall: { name: 'BLOCK WALL', icon: 'wall', desc: 'Drops a 4-block stone wall in front of you for 6s.', use(p, m) { return m.dropHazard(p, 'wall'); }, ai(p, m, c) { return c.defending && c.carrierDist < 10 && c.carrierDist > 4 && c.dOwnGoal < 22; } },
  mine: { name: 'LANDMINE', icon: 'mine', desc: 'Plants a mine. The first opponent to step on it gets launched.', use(p, m) { return m.dropHazard(p, 'mine'); }, ai(p, m, c) { return c.chasedBy; } },
  bolt: { name: 'SUPERCHARGE', icon: 'bolt', desc: '4s of +50% speed with free sprinting.', use(p) { p.fx.supercharge = 4; return true; }, ai(p, m, c) { return (c.hasBall && c.spaceAhead) || (c.chasing && c.chaseDist > 8); } },
};
const ITEM_IDS = Object.keys(ITEMS);

const TIER_NAMES = ['WOOD', 'STONE', 'IRON', 'GOLD', 'DIAMOND', 'OBSIDIAN'];
const tierOf = (rp) => Math.min(5, Math.floor(rp / 100));
/** bot difficulty 0..1 from rank points */
const difficultyFor = (rp) => clamp(0.22 + Math.min(rp, 560) / 560 * 0.72, 0.22, 0.94);

function rollRarity(pity) {
  if (pity >= 29) { const r = Math.random() * 17; return r < 12 ? 2 : r < 16.5 ? 3 : 4; }
  let r = Math.random() * 100;
  for (let i = 0; i < 5; i++) { if (r < RARITY_ODDS[i]) return i; r -= RARITY_ODDS[i]; }
  return 0;
}
function poolFor(kind, rarityIdx) {
  const rar = RARITIES[rarityIdx];
  const src = kind === 'style' ? STYLES : FLOWS;
  return Object.keys(src).filter((k) => src[k].rarity === rar);
}
