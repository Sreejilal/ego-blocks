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

/* ---------- skins: looks only, they never change stats ----------
   Every slot has a free base skin that everyone owns. The rest come from Skin Spins (and later the game pass). */
const SKIN_SLOTS = [
  { id: 'hair', name: 'HAIR', base: 'STYLE_HAIR' }, { id: 'color', name: 'COLOUR', base: 'STYLE_COLOR' },
  { id: 'boots', name: 'BOOTS', base: 'TEAM_BOOTS' }, { id: 'gloves', name: 'GLOVES', base: 'NO_GLOVES' },
  { id: 'acc', name: 'EXTRA', base: 'NO_ACC' }, { id: 'celeb', name: 'GOAL', base: 'JUMP' },
];
const SKINS = {
  STYLE_HAIR: { slot: 'hair', name: 'STYLE CUT', rarity: 'Rare', base: true, desc: 'The haircut that comes with your style.' },
  CROP: { slot: 'hair', name: 'CROP', rarity: 'Rare', shape: 'short' },
  MANE: { slot: 'hair', name: 'MANE', rarity: 'Rare', shape: 'long' },
  BOB: { slot: 'hair', name: 'BOB', rarity: 'Rare', shape: 'bob' },
  TOP_BUN: { slot: 'hair', name: 'TOP BUN', rarity: 'Rare', shape: 'bun' },
  SWEEP: { slot: 'hair', name: 'SWEEP', rarity: 'Epic', shape: 'swept' },
  BED_HEAD: { slot: 'hair', name: 'BED HEAD', rarity: 'Epic', shape: 'messy' },
  FLAT_TOP: { slot: 'hair', name: 'FLAT TOP', rarity: 'Epic', shape: 'flattop' },
  CLOUD: { slot: 'hair', name: 'CLOUD', rarity: 'Legendary', shape: 'fluffy' },
  SPIKES: { slot: 'hair', name: 'SPIKES', rarity: 'Legendary', shape: 'spiky' },
  MOHAWK: { slot: 'hair', name: 'MOHAWK', rarity: 'Mythic', shape: 'mohawk' },
  STYLE_COLOR: { slot: 'color', name: 'STYLE COLOUR', rarity: 'Rare', base: true, desc: 'The hair colour that comes with your style.' },
  JET: { slot: 'color', name: 'JET', rarity: 'Rare', hex: '#15131b' },
  CHESTNUT: { slot: 'color', name: 'CHESTNUT', rarity: 'Rare', hex: '#6b3e22' },
  SANDY: { slot: 'color', name: 'SANDY', rarity: 'Rare', hex: '#d8b06a' },
  SNOW: { slot: 'color', name: 'SNOW', rarity: 'Epic', hex: '#eef1f7' },
  CRIMSON: { slot: 'color', name: 'CRIMSON', rarity: 'Epic', hex: '#c8283a' },
  OCEAN: { slot: 'color', name: 'OCEAN', rarity: 'Epic', hex: '#2a64ff' },
  MINT: { slot: 'color', name: 'MINT', rarity: 'Legendary', hex: '#4fe3a1' },
  VIOLET: { slot: 'color', name: 'VIOLET', rarity: 'Legendary', hex: '#9150e8' },
  SUNSET: { slot: 'color', name: 'SUNSET', rarity: 'Mythic', hex: '#ff7a2a' },
  PRISM: { slot: 'color', name: 'PRISM', rarity: 'Generational', hex: '#b65cff', prism: true },
  TEAM_BOOTS: { slot: 'boots', name: 'TEAM BOOTS', rarity: 'Rare', base: true, desc: 'Plain boots in your team colours.' },
  CHALK: { slot: 'boots', name: 'CHALK', rarity: 'Rare', hex: '#f4efe0' },
  BLACKOUT: { slot: 'boots', name: 'BLACKOUT', rarity: 'Rare', hex: '#121217' },
  LIME: { slot: 'boots', name: 'LIME', rarity: 'Epic', hex: '#a6ff2e' },
  MAGMA: { slot: 'boots', name: 'MAGMA', rarity: 'Epic', hex: '#ff4a1c' },
  ICE: { slot: 'boots', name: 'ICE', rarity: 'Legendary', hex: '#8fe6ff' },
  GOLDEN: { slot: 'boots', name: 'GOLDEN', rarity: 'Mythic', hex: '#ffcc33' },
  STARDUST: { slot: 'boots', name: 'STARDUST', rarity: 'Generational', hex: '#241a5a', sparkle: true },
  NO_GLOVES: { slot: 'gloves', name: 'BARE HANDS', rarity: 'Rare', base: true, desc: 'No gloves.' },
  BLACK_GLOVES: { slot: 'gloves', name: 'NIGHT GLOVES', rarity: 'Rare', hex: '#1a1a22' },
  WHITE_GLOVES: { slot: 'gloves', name: 'CHALK GLOVES', rarity: 'Rare', hex: '#f2f2ea' },
  RED_GLOVES: { slot: 'gloves', name: 'RED GLOVES', rarity: 'Epic', hex: '#d8262e' },
  GOLD_GLOVES: { slot: 'gloves', name: 'GOLD GLOVES', rarity: 'Legendary', hex: '#ffc93d' },
  NO_ACC: { slot: 'acc', name: 'NOTHING', rarity: 'Rare', base: true, desc: 'No extra.' },
  RED_BAND: { slot: 'acc', name: 'RED HEADBAND', rarity: 'Rare', acc: 'band', hex: '#e0302a' },
  WHITE_BAND: { slot: 'acc', name: 'WHITE HEADBAND', rarity: 'Rare', acc: 'band', hex: '#f4f1e8' },
  BLACK_BAND: { slot: 'acc', name: 'BLACK HEADBAND', rarity: 'Epic', acc: 'band', hex: '#17171d' },
  FACE_MASK: { slot: 'acc', name: 'FACE MASK', rarity: 'Epic', acc: 'mask', hex: '#22242e' },
  SILVER_CHAIN: { slot: 'acc', name: 'SILVER CHAIN', rarity: 'Epic', acc: 'chain', hex: '#d9dde4' },
  GOLD_CHAIN: { slot: 'acc', name: 'GOLD CHAIN', rarity: 'Legendary', acc: 'chain', hex: '#ffc93d' },
  CHROME_MASK: { slot: 'acc', name: 'CHROME MASK', rarity: 'Mythic', acc: 'mask', hex: '#b8c4d6', glow: 0.35 },
  ICE_CHAIN: { slot: 'acc', name: 'ICE CHAIN', rarity: 'Generational', acc: 'chain', hex: '#7ff6ff', glow: 0.8 },
  JUMP: { slot: 'celeb', name: 'BIG JUMP', rarity: 'Rare', base: true, celeb: 'jump', desc: 'Jump for joy with both arms up.' },
  AIRPLANE: { slot: 'celeb', name: 'AIRPLANE', rarity: 'Rare', celeb: 'plane', desc: 'Arms out wide, tilting side to side.' },
  SHUSH: { slot: 'celeb', name: 'SHUSH', rarity: 'Epic', celeb: 'shush', desc: 'A finger to the lips for the away fans.' },
  ROBOT: { slot: 'celeb', name: 'ROBOT', rarity: 'Epic', celeb: 'robot', desc: 'Stiff, stepped robot dance moves.' },
  KNEE_SLIDE: { slot: 'celeb', name: 'KNEE SLIDE', rarity: 'Legendary', celeb: 'knees', desc: 'Drop to the knees, lean back and soak it in.' },
  BACKFLIP: { slot: 'celeb', name: 'BACKFLIP', rarity: 'Mythic', celeb: 'flip', desc: 'Backflip after backflip.' },
  METEOR: { slot: 'celeb', name: 'METEOR', rarity: 'Generational', celeb: 'meteor', desc: 'Leap sky high, then slam down in a ring of light.' },
};
const SKIN_IDS = Object.keys(SKINS).filter((k) => !SKINS[k].base);
/** the concrete colours and shapes a player model is built from: the style's defaults with skins on top */
function lookFor(styleId, look = {}) {
  const st = STYLES[styleId] || STYLES.ROOKIE, S = (slot) => SKINS[look[slot]] || {};
  const acc = S('acc');
  return {
    hairShape: S('hair').shape || st.hairShape, hair: S('color').hex || st.hair, prism: !!S('color').prism,
    boots: S('boots').hex || null, sparkle: !!S('boots').sparkle, gloves: S('gloves').hex || null,
    acc: acc.acc ? { kind: acc.acc, hex: acc.hex, glow: acc.glow || 0 } : null, celeb: S('celeb').celeb || 'jump',
  };
}
/** bots wear a few skins too, so matches show them off */
function botLook() {
  const any = (slot, p) => (chance(p) ? pick(SKIN_IDS.filter((k) => SKINS[k].slot === slot)) : null);
  return { boots: any('boots', 0.4), color: any('color', 0.2), acc: any('acc', 0.22), gloves: any('gloves', 0.15), celeb: any('celeb', 0.6) };
}

/* ---------- clubs and kits ----------
   A kit: shirt + alt colour in a pattern (stripes, hoops, sash, halves or plain), sleeves with cuffs, collar,
   number colour, shorts with a side stripe, socks with a band. Crest: [main colour, symbol colour, symbol]. */
const mkKit = (shirt, alt, pattern, sleeve, cuff, collar, number, shorts, shortsTrim, socks, sockTrim) => ({ shirt, alt, pattern, sleeve, cuff, collar, number, shorts, shortsTrim, socks, sockTrim });
const CLUBS = {
  ROVERS: {
    name: 'BLOCKTOWN ROVERS', nick: 'ROVERS', short: 'BTR', crest: ['#2f6bff', '#ffffff', 'star'],
    home: mkKit('#2f6bff', '#f4f1e8', 'sash', '#f4f1e8', '#2f6bff', '#0f2a7a', '#ffffff', '#f4f1e8', '#2f6bff', '#2f6bff', '#f4f1e8'),
    away: mkKit('#f4f1e8', '#2f6bff', 'sash', '#2f6bff', '#f4f1e8', '#2f6bff', '#16245e', '#16245e', '#f4f1e8', '#f4f1e8', '#2f6bff'),
    keeper: mkKit('#22b866', '#14804a', 'hoops', '#14804a', '#0b3d22', '#0b3d22', '#0b3d22', '#0b3d22', '#22b866', '#22b866', '#0b3d22'),
  },
  EMBER: {
    name: 'EMBER CITY', nick: 'EMBER', short: 'EMB', crest: ['#ff7a1a', '#1d1f2e', 'flame'],
    home: mkKit('#ff7a1a', '#1d1f2e', 'halves', '#1d1f2e', '#ff7a1a', '#1d1f2e', '#ffffff', '#1d1f2e', '#ff7a1a', '#ff7a1a', '#1d1f2e'),
    away: mkKit('#18a999', '#ff7a1a', 'plain', '#ff7a1a', '#18a999', '#ff7a1a', '#ffffff', '#1d1f2e', '#18a999', '#18a999', '#ff7a1a'),
    keeper: mkKit('#8e4bd6', '#5d2a9e', 'plain', '#5d2a9e', '#ffffff', '#ffffff', '#ffffff', '#3a1d66', '#8e4bd6', '#8e4bd6', '#ffffff'),
  },
  MOSSWOOD: {
    name: 'MOSSWOOD UNITED', nick: 'MOSSWOOD', short: 'MSW', crest: ['#2f9a44', '#f4f1e8', 'leaf'],
    home: mkKit('#2f9a44', '#f4f1e8', 'hoops', '#2f9a44', '#f4f1e8', '#f4f1e8', '#ffffff', '#f4f1e8', '#2f9a44', '#2f9a44', '#f4f1e8'),
    away: mkKit('#f2c94c', '#2f9a44', 'plain', '#2f9a44', '#f2c94c', '#2f9a44', '#1b4a26', '#1b4a26', '#f2c94c', '#f2c94c', '#2f9a44'),
    keeper: mkKit('#ff8a2a', '#c95c14', 'sash', '#c95c14', '#1d1f2e', '#1d1f2e', '#1d1f2e', '#1d1f2e', '#ff8a2a', '#ff8a2a', '#1d1f2e'),
  },
  HARBOUR: {
    name: 'RUBY HARBOUR', nick: 'HARBOUR', short: 'RBH', crest: ['#d8262e', '#ffffff', 'anchor'],
    home: mkKit('#d8262e', '#f4f1e8', 'stripes', '#d8262e', '#f4f1e8', '#f4f1e8', '#1a1a22', '#1a1a22', '#d8262e', '#d8262e', '#f4f1e8'),
    away: mkKit('#8d96a6', '#d8262e', 'sash', '#8d96a6', '#d8262e', '#d8262e', '#16213e', '#16213e', '#d8262e', '#8d96a6', '#d8262e'),
    keeper: mkKit('#ffd23d', '#d9a512', 'plain', '#1a1a22', '#ffd23d', '#1a1a22', '#1a1a22', '#1a1a22', '#ffd23d', '#ffd23d', '#1a1a22'),
  },
  NIGHTFALL: {
    name: 'NIGHTFALL FC', nick: 'NIGHTFALL', short: 'NFC', crest: ['#6c3cd6', '#dcd2ff', 'moon'],
    home: mkKit('#6c3cd6', '#141218', 'stripes', '#141218', '#6c3cd6', '#141218', '#ffffff', '#141218', '#6c3cd6', '#141218', '#6c3cd6'),
    away: mkKit('#c9ced8', '#6c3cd6', 'sash', '#c9ced8', '#6c3cd6', '#6c3cd6', '#2a1659', '#2a1659', '#c9ced8', '#c9ced8', '#6c3cd6'),
    keeper: mkKit('#a6ff2e', '#6cc214', 'hoops', '#6cc214', '#141218', '#141218', '#141218', '#141218', '#a6ff2e', '#a6ff2e', '#141218'),
  },
  SUNSPIRE: {
    name: 'SUNSPIRE', nick: 'SUNSPIRE', short: 'SUN', crest: ['#ffcb3d', '#141218', 'sun'],
    home: mkKit('#ffcb3d', '#141218', 'plain', '#141218', '#ffcb3d', '#141218', '#141218', '#141218', '#ffcb3d', '#ffcb3d', '#141218'),
    away: mkKit('#f4f1e8', '#141218', 'plain', '#141218', '#ffcb3d', '#ffcb3d', '#141218', '#141218', '#ffcb3d', '#f4f1e8', '#141218'),
    keeper: mkKit('#4aa8ff', '#1f6fd0', 'stripes', '#1f6fd0', '#f4f1e8', '#f4f1e8', '#f4f1e8', '#103a78', '#4aa8ff', '#4aa8ff', '#f4f1e8'),
  },
};
const CLUB_IDS = Object.keys(CLUBS);
const KEEPER_SPARES = [
  mkKit('#ff5fb0', '#d13f8c', 'plain', '#d13f8c', '#1a1a22', '#1a1a22', '#1a1a22', '#1a1a22', '#ff5fb0', '#ff5fb0', '#1a1a22'),
  mkKit('#5a5f78', '#3a3f4f', 'hoops', '#3a3f4f', '#ffcb3d', '#ffcb3d', '#ffcb3d', '#2c3150', '#5a5f78', '#5a5f78', '#ffcb3d'),
];
/** the colours that fill most of a shirt: patterned shirts count both */
const kitColours = (k) => (k.pattern === 'plain' || k.pattern === 'sash' ? [k.shirt] : [k.shirt, k.alt]);
function kitClash(a, b) {
  for (const x of kitColours(a)) for (const y of kitColours(b)) {
    const p = hexRGB(x), q = hexRGB(y);
    if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 110) return true;
  }
  return false;
}
/** a colour from the kit that reads well on the dark UI */
function kitUiHex(k) {
  const lum = (h) => { const c = hexRGB(h); return (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255; };
  return lum(k.shirt) >= 0.22 ? k.shirt : lum(k.alt) >= 0.22 ? k.alt : '#a4a9cf';
}
/** one team's look for a match: club, kit worn (home or away), keeper kit, UI colour */
function sideFor(clubId, away = false) {
  const c = CLUBS[clubId] || CLUBS.ROVERS, k = away ? c.away : c.home;
  return { club: clubId, name: c.nick, full: c.name, short: c.short, crest: c.crest, kit: k, keeper: c.keeper, away, hex: kitUiHex(k) };
}
/** pick both kits for a match: the away club changes if the home kits clash, keepers change if theirs clash */
function matchSides(homeId, awayId) {
  const home = sideFor(homeId), away = sideFor(awayId, kitClash(CLUBS[homeId].home, CLUBS[awayId].home));
  for (const [s, o] of [[home, away], [away, home]]) {
    if (kitClash(s.keeper, s.kit) || kitClash(s.keeper, o.kit)) s.keeper = KEEPER_SPARES.find((k) => !kitClash(k, s.kit) && !kitClash(k, o.kit)) || KEEPER_SPARES[0];
  }
  return [home, away];
}

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
  if (kind === 'skin') return SKIN_IDS.filter((k) => SKINS[k].rarity === rar);
  const src = kind === 'style' ? STYLES : FLOWS;
  return Object.keys(src).filter((k) => src[k].rarity === rar);
}
