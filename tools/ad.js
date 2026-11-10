#!/usr/bin/env node
/*
 * Makes a YouTube ad for SCORZ from the real game, with big words, the game's own sounds and our own music:
 *   scorz-ad-1920x1080.mp4     (a normal YouTube video or video ad, 16:9)
 *   scorz-short-1080x1920.mp4  (a YouTube Short, 9:16)       ->  dist/ad/
 *
 *   npm run build   (once, so docs/index.html is up to date)
 *   npm run ad      (both; or: node tools/ad.js landscape | short)
 *
 * Each clip is a short scene in a real match: you get the ball near the goal, the computer plays you,
 * and at set moments you use a move (SLOW-MO, IMPACT SHOT, an Awakening). Step 1 tries random seeds
 * without drawing until that scene ends in your goal. Step 2 plays the same scene again and films it one
 * frame at a time (like tools/videos.js), while writing down every sound the game asks for. At the end
 * those sounds are played again in an offline audio context together with the music, and ffmpeg joins it all.
 * Filming is slow on a weak PC, so each run stops after VIDEO_MINUTES (default 8). Run it again to carry on.
 *   --fresh   forget the plans and the saved frames
 * The videos are not part of the game and are not committed.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { shootCover, COVERS, PAGE, GL_ARGS } = require('./covers');
const { openMatch, findFfmpeg } = require('./videos');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'ad');
const FPS = 30, STEP = 60 / FPS;
const URL_TEXT = 'scorz.onrender.com';
const FORMATS = {
  landscape: { name: 'scorz-ad-1920x1080', w: 1920, h: 1080, cover: COVERS[0] },
  short: { name: 'scorz-short-1080x1920', w: 1080, h: 1920, cover: COVERS[1] },
};
// each clip: your style, where you start (d blocks from their goal, x across), the goal must come between
// game frames within[0] and within[1] of the scene, pre/post: most seconds shown before and after the goal.
// What you press in each scene is in SCRIPTS (in prepare)
const CLIPS = [
  { id: 'slowmo', style: 'PHANTOM', d: 19, x: 3, within: [40, 220], pre: 3.8, post: 1.5, lines: ['FOOTBALL', 'WITH SUPERPOWERS'] },
  { id: 'impact', style: 'RAILGUN', d: 25, x: -5, gk: [2.4, 2.6], within: [30, 110], pre: 2.6, post: 1.6, lines: ['21 STYLES', 'EACH WITH ITS OWN POWERS'] },
  { id: 'awaken', style: 'THUNDER', d: 22, x: 4, within: [60, 160], pre: 3.4, post: 1.6, lines: ['AWAKEN', 'AND TAKE OVER'] },
  { id: 'friends', style: 'SPRINTER', d: 15, x: -5, mateBall: true, opp: [[7, 6], [-10, 7]], within: [20, 220], pre: 3.4, post: 1.8, lines: ['PLAY WITH', 'UP TO 8 FRIENDS'] },
];
const END = 4.2; // seconds of the end card
const PLAN_W = 640, PLAN_H = 360; // a small page is quicker to open for the tries
const args = process.argv.slice(2);
const which = Object.keys(FORMATS).filter((k) => args.includes(k));
const budget = (+process.env.VIDEO_MINUTES || 8) * 60000;
const t0 = Date.now();
const outOfTime = () => Date.now() - t0 > budget;

/** a page that plays a scene: a fresh match from the seed alone. Only the first scene in a page repeats
    exactly (something in the game carries over between matches), so plans and films each use a new page.
    It also writes down every sound the game asks for instead of playing it (SND) */
async function openStudio(browser, w, h) {
  const { ctx, page } = await openMatch(browser, w, h, 1, { settings: { cutins: true } });
  await page.evaluate(() => {
    const rng = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let sim = rng(1), draw = rng(7), drawing = false;
    Math.random = () => (drawing ? draw() : sim());
    const render = EGO.World.render;
    EGO.World.render = (...a) => { drawing = true; try { return render(...a); } finally { drawing = false; } };
    const controls = EGO.Input.controls;
    window.SND = { on: false, t: 0, log: [], state: {} };
    for (const k of Object.keys(EGO.Sfx)) {
      if (typeof EGO.Sfx[k] !== 'function' || k === 'init' || k === 'setMuted') continue;
      EGO.Sfx[k] = (...a) => {
        const args = a.filter((x) => x == null || ['number', 'string', 'boolean'].includes(typeof x));
        if (k === 'setCrowd' || k === 'setLoud') SND.state[k] = args;
        if (SND.on) SND.log.push([+SND.t.toFixed(4), k, args]);
      };
    }
    VID.restart = (seed, style) => {
      EGO.Input.controls = controls; SND.on = false; SND.log = [];
      sim = rng(seed); draw = rng(7);
      EGO.Save.data.style = style;
      const G = EGO.Game; G.last = 0; G.time = 0; G.crowdT = 0; VID.frame = 0;
      if (EGO.World.excite) EGO.World.excite[0] = EGO.World.excite[1] = 0;
      G.startMatch('quick');
      G.match.autopilot = true; G.match.caller = null;
      sim = rng(seed * 7919 + 13); // again: painting the crowd uses random numbers only when the teams changed since the last match
    };
  });
  await page.addStyleTag({ content: '#hint, .toast, .cutin-old { display: none !important; }' });
  return { ctx, page };
}

/** in the page: a fresh match from the seed, get to kickoff, set up the scene, and play you with scripted presses (like a real player) */
async function prepare(page, clip) {
  await page.evaluate((c) => {
    VID.restart(c.v, c.style);
    const G = EGO.Game, m = G.match;
    while (m.phase !== 'play' && VID.frame < 60 * 30) VID.step(1, false);
    const p = m.human, gz = m.oppGoalZ(p.team), s = Math.sign(gz), face = s > 0 ? 0 : Math.PI;
    // each seed also moves the scene a little and changes the timing, so the tries are not all the same
    const v = c.v || 0, J = (k, n) => ((v * k) % n) - (n - 1) / 2, T = (v % 4) * 3;
    c = Object.assign({}, c, { x: c.x + J(37, 7) * 0.6, d: c.d + J(53, 5) * 0.8 });
    const at = (q, x, d, yaw) => { q.pos.set(x, 0, gz - s * d); q.vel.set(0, 0, 0); q.setState('free'); q.yaw = yaw; };
    const mates = m.teams[p.team].filter((q) => q !== p && !q.isGK), opps = m.opponents(p).filter((q) => !q.isGK);
    const gk = m.opponents(p).find((q) => q.isGK), myGk = m.teams[p.team].find((q) => q.isGK);
    at(p, c.x, c.d, face);
    if (gk) at(gk, c.gk ? c.gk[0] : 0, c.gk ? c.gk[1] : 0.9, face + Math.PI);
    if (myGk) at(myGk, 0, 2 * EGO.PITCH.L - 1, face);
    const spotsO = [...(c.opp || [[c.x + 3.4, c.d - 4.5], [c.x - 3.6, c.d - 3.2]]), [-c.x * 0.4 + 7, c.d - 11], [-c.x * 0.4 - 8, c.d - 10], [0, c.d - 14]];
    opps.forEach((q, i) => { const sp = spotsO[i] || [(i % 2 ? 9 : -9), c.d - 7]; at(q, sp[0], sp[1], face + Math.PI); });
    const spotsM = [[c.x + (c.x > 0 ? -10 : 10), c.d - 1], [c.x + (c.x > 0 ? -4 : 4), c.d + 9], [c.x > 0 ? 12 : -12, c.d + 4], [0, c.d + 16]];
    mates.forEach((q, i) => { const sp = spotsM[i] || [0, c.d + 20]; at(q, sp[0], sp[1], face); });
    const holder = c.mateBall ? mates[0] : p;
    m.ball.reset(holder.pos.x, holder.pos.z + s * 0.7); m.possess(holder, true);
    m.lastGoal = null;
    m.autopilot = false; m.caller = null; // from here on you are played by the script below
    EGO.Cam.yaw = face;
    for (const a of p.abil) a.cd = 0;
    const S = window.SCENE = { start: VID.frame, cur: 0, lastCtl: -1, goalF: -1, mine: false, got: -1 };
    // the top corner away from the keeper
    const corner = () => new THREE.Vector3((gk && gk.pos.x > 0 ? -1 : 1) * (EGO.PITCH.GW - 0.55), 2.2, gz);
    const shoot = (f, k, from, hold) => { if (f === from) k.shootDown = true; if (f >= from && f < from + hold) k.shootHeld = true; if (f === from + hold) k.shootUp = true; };
    // left/right on the stick that walks you towards x (the camera looks at their goal, so right is -x when s > 0)
    const steer = (x) => Math.max(-0.8, Math.min(0.8, (x - p.pos.x) * -s * 0.25));
    // the stick pushed towards a spot on the pitch (forward is towards their goal, right is -x when s > 0)
    const toward = (k, x, z) => { const dx = x - p.pos.x, dz = z - p.pos.z, l = Math.hypot(dx, dz) || 1; k.moveY = (dz * s) / l; k.moveX = (-dx * s) / l; };
    const SCRIPTS = {
      // run at them, C C (a feint, then SLOW-MO), cut through the slowed defenders towards the middle and shoot hard
      slowmo(f, k) { k.moveY = 1; k.sprint = true; k.moveX = steer(f < 50 ? c.x + 1.5 * Math.sin(f / 9) : 0.5); if (f === 6 || f === 12) k.dodge = true; shoot(f, k, 70 + T, 40); },
      // a few steps, then Q: IMPACT SHOT
      impact(f, k) { k.moveY = 1; k.sprint = true; k.moveX = steer(c.x * 0.6); if (f === 18 + T) k.ab[p.abil.findIndex((a) => a.id === 'impactShot')] = true; },
      // the Awakening comes (it comes by itself in a match), then Z as soon as you can move: THUNDERBOLT
      awaken(f, k) { k.moveY = f > 50 ? 0.6 : 0; if (f >= 50 && !p.awakeMoveUsed && p.state === 'free' && m.canAct(p)) k.awaken = true; },
      // your teammate passes, you run onto it and finish first time
      friends(f, k) {
        k.sprint = true;
        if (m.ball.owner === p && S.got < 0) S.got = f;
        if (S.got >= 0) { k.moveY = 1; shoot(f, k, S.got + 2 + T, 28); return; }
        const b = m.ball.pos;
        if (f < 10) { k.moveY = 0.25; k.sprint = false; } else toward(k, b.x + m.ball.vel.x * 0.15, b.z + m.ball.vel.z * 0.15);
      },
    };
    const ACTS = { awaken: { 4: () => m.activateAwaken(p) }, friends: { 6: () => m.ball.owner === holder && m.passTo(holder, p, {}) } }[c.id] || {};
    const EDGES = ['jump', 'shootDown', 'shootUp', 'passDown', 'passUp', 'dodge', 'tackle', 'flow', 'awaken', 'item'];
    EGO.Input.controls = () => {
      const k = { moveX: 0, moveY: 0, sprint: false, jump: false, jumpHeld: false, shootDown: false, shootHeld: false, shootUp: false, passDown: false, passUp: false, passHeld: false,
        dodge: false, tackle: false, ab: [false, false, false], flow: false, emote: -1, awaken: false, shiftLock: false, item: false, board: false, camYaw: face, aim: corner() };
      SCRIPTS[c.id](S.cur, k);
      if (S.lastCtl === S.cur) { for (const e of EDGES) k[e] = false; k.ab = [false, false, false]; } // a press counts once
      S.lastCtl = S.cur;
      return k;
    };
    /** did the scene show what it is for? */
    S.check = () => ({ slowmo: (p.slowUses || 0) > 0, impact: p.abil.some((a) => a.id === 'impactShot' && a.cd > 0), awaken: !!p.awakeMoveUsed, friends: S.got >= 0 }[c.id]);
    /** one game frame of the scene, watching for the goal */
    S.step = (draw) => {
      const f = S.cur = VID.frame - S.start;
      if (ACTS[f]) ACTS[f]();
      EGO.Cam.yaw = face;
      const before = m.score[0] + m.score[1];
      VID.step(1, draw);
      if (S.goalF < 0 && m.score[0] + m.score[1] !== before) { S.goalF = f + 1; S.mine = !!(m.lastGoal && m.lastGoal.scorer === p); S.ok = S.check(); }
    };
  }, clip);
}

/** step 1: does this seed's scene end in your goal, showing its move, in the time we want? */
async function tryScene(page, clip, seed) {
  await prepare(page, { ...clip, v: seed });
  const r = await page.evaluate((c) => {
    const limit = c.within[1] + 30;
    while (SCENE.goalF < 0 && VID.frame - SCENE.start < limit) SCENE.step(false);
    return { goalF: SCENE.goalF, mine: SCENE.mine, move: !!SCENE.ok };
  }, clip);
  r.ok = r.mine && r.move && r.goalF >= clip.within[0] && r.goalF <= clip.within[1];
  return r;
}
async function planClip(browser, clip, from = 1) {
  for (let seed = from; seed < from + 150; seed++) {
    const st = await openStudio(browser, PLAN_W, PLAN_H);
    const r = await tryScene(st.page, clip, seed);
    await st.ctx.close();
    if (r.ok || seed % 10 === 0) console.log(`  ${clip.id} seed ${seed}: ${r.ok ? 'GOAL' : 'no'} ${JSON.stringify(r)}`);
    if (r.ok) {
      const start = Math.max(0, r.goalF - Math.round(clip.pre * 60));
      return { seed, start, end: r.goalF + Math.round(clip.post * 60), goalF: r.goalF };
    }
    if (outOfTime()) return null;
  }
  throw new Error('no seed gave a goal for the ' + clip.id + ' scene');
}

const OVERLAY_CSS = (w, h) => {
  const tall = h > w, u = Math.min(w, h) / 100; // 1% of the short side
  return `
  #ad-ov { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; font-family: var(--font-display); text-transform: uppercase; }
  #ad-ov .cap { position: absolute; left: 0; right: 0; top: ${tall ? 17 : 15}%; text-align: center; transform: rotate(-3deg); }
  #ad-ov .cap span { display: block; line-height: .92; letter-spacing: .03em; will-change: transform, opacity; }
  #ad-ov .l1 { color: #fff; font-size: ${tall ? 15 * u : 11 * u}px; text-shadow: ${0.5 * u}px ${0.5 * u}px 0 #1a3c9e, ${u}px ${u}px 0 #090b16, 0 0 ${3 * u}px rgba(0,0,0,.5); }
  #ad-ov .l2 { color: #ffcb3d; font-size: ${tall ? 9 * u : 7 * u}px; margin-top: ${0.8 * u}px; text-shadow: ${0.4 * u}px ${0.4 * u}px 0 #7a3b00, ${0.8 * u}px ${0.8 * u}px 0 #090b16, 0 0 ${3 * u}px rgba(0,0,0,.5); }
  #ad-ov .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
  #ad-ov .end { position: absolute; left: 0; right: 0; text-align: center; opacity: 0; ${tall ? 'bottom: 7%;' : 'left: 6%; right: auto; top: 70%; text-align: left;'} }
  #ad-ov .end .free { display: block; color: #ffcb3d; font-size: ${tall ? 12 * u : 8 * u}px; line-height: .95; text-shadow: ${0.5 * u}px ${0.5 * u}px 0 #7a3b00, ${u}px ${u}px 0 #090b16; }
  #ad-ov .end .sub { display: block; color: #fff; font-size: ${tall ? 6 * u : 4.4 * u}px; margin-top: ${0.6 * u}px; text-shadow: ${0.4 * u}px ${0.4 * u}px 0 #090b16; }
  #ad-ov .end .url { display: inline-block; margin-top: ${1.6 * u}px; padding: ${0.9 * u}px ${2.2 * u}px ${1.2 * u}px; background: #090b16; color: #fff; border: ${0.5 * u}px solid #ffcb3d;
    font-size: ${tall ? 6.4 * u : 4.6 * u}px; letter-spacing: .02em; text-transform: none; box-shadow: ${0.8 * u}px ${0.8 * u}px 0 rgba(0,0,0,.45); }
  ${tall ? '#ad-ov .shade { position: absolute; left: 0; right: 0; bottom: 0; height: 34%; background: linear-gradient(transparent, rgba(9,11,22,.85)); opacity: 0; }' : '#ad-ov .shade { display: none; }'}
  `;
};
const OVERLAY_HTML = `<div id="ad-ov"><div class="cap"><span class="l1"></span><span class="l2"></span></div><div class="shade"></div>
  <div class="end"><span class="free">PLAY FREE</span><span class="sub">IN YOUR BROWSER. NO DOWNLOAD.</span><span class="url">${URL_TEXT}</span></div><div class="flash"></div></div>`;
/** in the page: the words for time t (seconds into the clip). Each line pops in, a white flash on the cut */
const OVERLAY_JS = `window.ADOV = {
  set(lines, t, total) {
    const ov = document.getElementById('ad-ov'), l = ov.querySelectorAll('.cap span');
    const pop = (el, k) => { const a = Math.max(0, Math.min(1, k)); const e = 1 - Math.pow(1 - a, 3); el.style.opacity = a > 0 ? 1 : 0; el.style.transform = 'scale(' + (1.6 - 0.6 * e) + ')'; };
    l[0].textContent = lines[0]; l[1].textContent = lines[1];
    pop(l[0], (t - 0.12) / 0.18); pop(l[1], (t - 0.42) / 0.18);
    const out = Math.max(0, Math.min(1, (total - t) / 0.2)); ov.querySelector('.cap').style.opacity = out;
    ov.querySelector('.flash').style.opacity = Math.max(0, 0.75 - t * 6);
  },
  end(t) {
    const ov = document.getElementById('ad-ov'), e = ov.querySelector('.end');
    ov.querySelector('.cap').style.opacity = 0;
    ov.querySelector('.flash').style.opacity = Math.max(0, 0.9 - t * 5);
    ov.querySelector('.shade').style.opacity = Math.min(1, t / 0.3);
    const a = Math.max(0, Math.min(1, (t - 0.35) / 0.25)), k = 1 - Math.pow(1 - a, 3);
    e.style.opacity = a; e.style.transform = 'scale(' + (1.25 - 0.25 * k) + ')'; e.style.transformOrigin = getComputedStyle(e).textAlign === 'left' ? 'left center' : 'center';
    const pulse = 1 + 0.04 * Math.max(0, Math.sin((t - 1.2) * 5)); e.querySelector('.url').style.transform = 'scale(' + (t > 1.2 ? pulse : 1) + ')';
  },
};`;
async function addOverlay(page, fmt) {
  await page.addStyleTag({ content: OVERLAY_CSS(fmt.w, fmt.h) });
  await page.evaluate(({ html, js }) => { document.body.insertAdjacentHTML('beforeend', html); (0, eval)(js); }, { html: OVERLAY_HTML, js: OVERLAY_JS });
}

/** step 2: film one clip into dir/NNNN.jpg in the studio page, writing down the sounds.
    Returns false if the scene did not play out like the plan (then it is planned again) */
async function filmClip(page, fmt, clip, plan, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const fname = (i) => path.join(dir, String(i).padStart(4, '0') + '.jpg');
  const total = Math.round((plan.end - plan.start) / STEP);
  await prepare(page, { ...clip, v: plan.seed });
  console.log(`  ${fmt.name} ${clip.id}: seed ${plan.seed}, ${total} frames`);
  await page.evaluate((n) => { while (VID.frame - SCENE.start < n) SCENE.step(false); }, plan.start);
  await page.evaluate(() => { SND.on = true; SND.log = [[0, 'setLoud', SND.state.setLoud || [1]], [0, 'setCrowd', SND.state.setCrowd || [0.55]]]; });
  const dur = total / FPS;
  let last = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate(({ STEP, i, lines, dur }) => {
      for (let k = 0; k < STEP; k++) { SND.t = (i * STEP + k) / 60; SCENE.step(k === STEP - 1); }
      ADOV.set(lines, (i + 1) / 30, dur);
    }, { STEP, i, lines: clip.lines, dur });
    await page.screenshot({ path: fname(i), type: 'jpeg', quality: 92 });
    if ((i + 1) % 30 === 0) { const now = Date.now(); console.log(`  ${i + 1}/${total} frames (${((now - last) / 30000).toFixed(2)}s per frame)`); last = now; }
  }
  const r = await page.evaluate(() => ({ log: SND.log, goalF: SCENE.goalF, mine: SCENE.mine, ok: SCENE.ok }));
  await page.evaluate(() => { SND.on = false; });
  if (r.goalF !== plan.goalF || !r.mine || !r.ok) {
    console.log(`  the ${clip.id} scene played out differently here (goal at ${r.goalF}, not ${plan.goalF}), so it gets a new seed`);
    fs.rmSync(dir, { recursive: true, force: true });
    return false;
  }
  fs.writeFileSync(path.join(dir, 'sounds.json'), JSON.stringify(r.log));
  return total;
}

/** the end card: the cover picture, slowly zooming, with PLAY FREE and the address */
async function filmEnd(browser, fmt, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const total = Math.round(END * FPS), fname = (i) => path.join(dir, String(i).padStart(4, '0') + '.jpg');
  if (fs.existsSync(fname(total - 1))) return total;
  const coverPng = path.join(dir, 'cover.png');
  if (!fs.existsSync(coverPng)) { console.log(`  drawing the cover at ${fmt.w}x${fmt.h}`); await shootCover(browser, fmt.cover, coverPng, fmt.w, fmt.h); }
  const ctx = await browser.newContext({ viewport: { width: fmt.w, height: fmt.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(PAGE).href);
  await page.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 180000 });
  const src = 'data:image/png;base64,' + fs.readFileSync(coverPng).toString('base64');
  await page.evaluate((src) => {
    EGO.Game.manual = true;
    const img = document.createElement('img'); img.id = 'ad-cover'; img.src = src;
    img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483640;pointer-events:none;transform-origin:60% 45%';
    document.body.appendChild(img); return img.decode();
  }, src);
  await addOverlay(page, fmt);
  await page.addStyleTag({ content: '* { cursor: none !important; }' });
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => { document.getElementById('ad-cover').style.transform = 'scale(' + (1 + 0.035 * t) + ')'; ADOV.end(t); }, i / FPS);
    await page.screenshot({ path: fname(i), type: 'jpeg', quality: 92 });
  }
  await ctx.close();
  return total;
}

/** the sound track: the music, and every sound the game asked for, at the same moment as in the picture.
    Runs the game's own Sfx in an offline audio context, so it sounds exactly like the game */
async function renderAudio(browser, cuts, dur, file) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript((dur) => {
    const SR = 44100, octx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
    const real = octx.destination, limiter = octx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.ratio.value = 12; limiter.attack.value = 0.002; limiter.release.value = 0.15; limiter.connect(real);
    let T = 0;
    Object.defineProperty(octx, 'currentTime', { get: () => T });
    Object.defineProperty(octx, 'destination', { get: () => limiter });
    window.AD_AUDIO = { octx, setT: (t) => { T = t; } };
    window.AudioContext = function () { return octx; }; window.webkitAudioContext = window.AudioContext;
  }, dur);
  await page.goto(pathToFileURL(PAGE).href);
  await page.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 180000 });
  const b64 = await page.evaluate(async ({ cuts, dur }) => {
    const { octx, setT } = AD_AUDIO, S = EGO.Sfx;
    S.init(); S.setMuted(false);
    // the game: every clip's sounds at their own time
    for (const c of cuts) for (const [t, k, a] of c.log) { if (typeof S[k] !== 'function') continue; setT(c.at + t); S[k](...a); }
    setT(cuts[cuts.length - 1].end); S.setCrowd(0.2);
    // the music: 125 beats a minute, A minor, A F C G, each chord one bar. Drums stop for the end card, which gets one big hit
    const out = octx.createGain(); out.gain.value = 0.42; out.connect(octx.destination);
    const bpm = 125, beat = 60 / bpm, endAt = cuts[cuts.length - 1].end;
    const noiseBuf = octx.createBuffer(1, octx.sampleRate, octx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const osc = (type, f, t, d, vol, o = {}) => {
      const s = octx.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t); if (o.slide) s.frequency.exponentialRampToValueAtTime(o.slide, t + d);
      const g = octx.createGain(); env(g, t, o.a || 0.004, vol, d);
      let node = s; if (o.lp) { const f2 = octx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; f2.Q.value = o.q || 0.7; s.connect(f2); node = f2; }
      node.connect(g); g.connect(o.to || out); s.start(t); s.stop(t + (o.a || 0.004) + d + 0.05);
    };
    const hiss = (t, d, vol, type, freq, o = {}) => {
      const s = octx.createBufferSource(); s.buffer = noiseBuf; const f = octx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = o.q || 0.8;
      if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + d);
      const g = octx.createGain(); env(g, t, o.a || 0.002, vol, d); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.1);
    };
    const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // A minor, F, C, G
    const bass = [45, 41, 36, 43];
    for (let b = 0, t = 0; t < endAt - 0.01; b++, t = b * beat) {
      const bar = Math.floor(b / 4), ch = chords[bar % 4], inBar = b % 4;
      osc('sine', 150, t, 0.26, 0.9, { slide: 42 }); // kick
      if (inBar === 1 || inBar === 3) { hiss(t, 0.14, 0.5, 'bandpass', 1500, { q: 0.9 }); hiss(t + 0.012, 0.1, 0.35, 'bandpass', 2400, { q: 1.4 }); } // clap
      hiss(t + beat / 2, 0.045, 0.22, 'highpass', 8000); hiss(t + beat / 4 * 3, 0.03, 0.1, 'highpass', 9000); // hats
      osc('sawtooth', N(bass[bar % 4]), t + beat / 2, beat * 0.3, 0.34, { lp: 560, q: 4 }); // off-beat bass
      osc('sawtooth', N(bass[bar % 4] + 12), t + beat * 0.75, beat * 0.18, 0.16, { lp: 700, q: 3 });
      for (const n of ch) osc('square', N(n + 12), t + beat / 2, beat * 0.28, 0.05, { lp: 2600, a: 0.01 }); // chord stab
      for (let s = 0; s < 4; s++) osc('triangle', N(ch[(inBar + s) % 3] + 24), t + s * beat / 4, beat * 0.2, 0.05); // sparkly arpeggio
      if (b % 16 === 15) hiss(t, beat, 0.25, 'bandpass', 600, { slide: 7000, q: 2, a: beat * 0.9 }); // riser into the next 4 bars
    }
    // the end card: a big hit and one long chord
    osc('sine', 120, endAt, 1.4, 1.2, { slide: 30 }); hiss(endAt, 1.6, 0.6, 'lowpass', 4000, { slide: 300 }); hiss(endAt, 2.2, 0.18, 'highpass', 6000);
    for (const n of [57, 60, 64, 69]) { osc('sawtooth', N(n), endAt, dur - endAt - 0.2, 0.06, { lp: 1800, a: 0.05 }); osc('square', N(n + 12), endAt, 1.2, 0.03, { lp: 3000 }); }
    const buf = await octx.startRendering();
    // to 16-bit WAV, a little below full volume
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const k = peak > 0 ? 0.89 / peak : 1, n = L.length, ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0, o = 44; i < n; i++, o += 4) { v.setInt16(o, Math.max(-1, Math.min(1, L[i] * k)) * 32767, true); v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i] * k)) * 32767, true); }
    const bytes = new Uint8Array(ab); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }, { cuts, dur });
  await ctx.close();
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

async function makeFormat(browser, key, ff) {
  const fmt = FORMATS[key], base = path.join(OUT, 'work-' + key);
  fs.mkdirSync(base, { recursive: true });
  // the scenes do not depend on the screen size (you are played by a script, not the camera), so both videos share them
  const planFile = path.join(OUT, 'plans.json');
  const plans = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : {};
  const savePlans = () => fs.writeFileSync(planFile, JSON.stringify(plans, null, 2));
  const plan = async (clip, from) => {
    console.log(`finding a scene for ${clip.id}`);
    const p = await planClip(browser, clip, from);
    if (p) { plans[clip.id] = p; savePlans(); }
    return p;
  };
  for (const clip of CLIPS) if (!plans[clip.id] && !(await plan(clip, 1))) return false;
  if (args.includes('--plan')) return true;
  const parts = [];
  for (const clip of CLIPS) {
    const dir = path.join(base, clip.id), done = path.join(dir, 'sounds.json');
    while (!fs.existsSync(done)) {
      if (outOfTime()) return false;
      // a fresh page for each scene: only the first scene in a page plays out exactly like the plan
      const studio = await openStudio(browser, fmt.w, fmt.h);
      await addOverlay(studio.page, fmt);
      const ok = await filmClip(studio.page, fmt, clip, plans[clip.id], dir);
      await studio.ctx.close();
      if (ok) break;
      if (!(await plan(clip, plans[clip.id].seed + 1))) return false;
      for (const k of Object.keys(FORMATS)) fs.rmSync(path.join(OUT, 'work-' + k, clip.id), { recursive: true, force: true }); // the other video used the old scene
    }
    const n = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
    parts.push({ dir, n, log: JSON.parse(fs.readFileSync(done, 'utf8')) });
  }
  return finish(browser, fmt, base, parts, ff);
}

async function finish(browser, fmt, base, parts, ff) {
  if (outOfTime()) return false;
  const endDir = path.join(base, 'end');
  parts.push({ dir: endDir, n: await filmEnd(browser, fmt, endDir), log: [] });
  // the sound track, with each clip's sounds moved to where the clip sits in the video
  let at = 0; const cuts = [];
  for (const p of parts.slice(0, -1)) { cuts.push({ at, end: at + p.n / FPS, log: p.log }); at += p.n / FPS; }
  const dur = at + parts[parts.length - 1].n / FPS;
  const wav = path.join(base, 'sound.wav');
  console.log(`  mixing the sound (${dur.toFixed(1)}s)`);
  await renderAudio(browser, cuts, dur, wav);
  // join the pictures and the sound
  const file = path.join(OUT, fmt.name + (ff.mp4 ? '.mp4' : '.webm'));
  const enc = ff.mp4 ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart']
    : ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '160k'];
  const p = spawn(ff.bin, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-i', wav, '-map', '0:v', '-map', '1:a', ...enc, '-shortest', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res) => p.on('close', res));
  for (const part of parts) for (let i = 0; i < part.n; i++) {
    const f = path.join(part.dir, String(i).padStart(4, '0') + '.jpg');
    if (!p.stdin.write(fs.readFileSync(f))) await new Promise((res) => p.stdin.once('drain', res));
  }
  p.stdin.end();
  if ((await closed) !== 0) throw new Error('ffmpeg could not make ' + file);
  console.log(`saved dist/ad/${path.basename(file)} (${dur.toFixed(1)}s, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
  return true;
}

module.exports = { prepare, openStudio, addOverlay, CLIPS, FORMATS };

if (require.main === module) (async () => {
  if (!fs.existsSync(PAGE)) { console.error('Run npm run build first.'); process.exit(1); }
  const ff = findFfmpeg();
  if (!ff) { console.error('No ffmpeg found. Run npx playwright install, or set FFMPEG to an ffmpeg.exe.'); process.exit(1); }
  if (args.includes('--fresh')) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: GL_ARGS });
  let all = true;
  for (const k of which.length ? which : Object.keys(FORMATS)) if (!(await makeFormat(browser, k, ff))) { all = false; console.log('Out of time for this run: run it again to carry on.'); break; }
  await browser.close();
  if (!all) process.exit(3);
})().catch((e) => { console.error(e.stack.split('\n').slice(0, 3).join('\n')); process.exit(1); });
