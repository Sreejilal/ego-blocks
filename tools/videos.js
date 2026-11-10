#!/usr/bin/env node
/*
 * Makes the two CrazyGames preview videos from a real match (their rules: 15 to 20 seconds, no sound,
 * 1080p landscape 16:9 and portrait 2:3, no fast forward, the cover picture as the first frame,
 * no mouse pointer, no "play now" words or icons):
 *   video-landscape-1920x1080.mp4 and video-portrait-1080x1620.mp4  ->  dist/videos/
 *
 *   npm run build     (once, so docs/index.html is up to date)
 *   npm run videos    (both; or: node tools/videos.js landscape | portrait)
 *
 * How it works: the game runs on a fixed random seed. Step 1 plays a bot match without drawing it to find
 * a goal by your team (you are played by the computer too) and saves the plan in dist/videos/plan.json.
 * Step 2 plays the same match again, skips to 12 seconds before that goal and films it one frame at a
 * time with Game.stepManual, so even a slow PC makes a smooth 30 fps video.
 * Filming a 1080p frame in the test browser is slow, so each run stops after VIDEO_MINUTES (default 8)
 * and the next run carries on from the frames already saved. Run it again until it says the video is saved.
 *   --fresh      forget the plan and the saved frames, start again
 *   --seed N     another match (default 1)
 *   --plan       only find the goals (dist/videos/plan.json, one per video), film nothing
 * MP4 needs an ffmpeg with H.264: set FFMPEG to its path or have ffmpeg on PATH. Without one the
 * videos come out as WebM, made with Playwright's own ffmpeg.
 * The videos are for the submission form only. They are not part of the game and are not committed.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { shootCover, COVERS, LOOK, PAGE, GL_ARGS } = require('./covers');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'videos');
const FPS = 30, STEP = 60 / FPS; // game frames (60 fps) per video frame
const HOLD = 15; // video frames on the cover picture before play shows (0.5s)
const FADE = 12; // video frames to fade from the cover into the match
const BEFORE = 12, AFTER = 4; // seconds of play before and after the goal
const PLAY = (BEFORE + AFTER) * FPS;
const VIDEOS = {
  landscape: { name: 'video-landscape-1920x1080', w: 1920, h: 1080, cover: COVERS[0] },
  portrait: { name: 'video-portrait-1080x1620', w: 1080, h: 1620, cover: COVERS[1] },
};
const SETUP = { mode: 'quick', rp: 420, ...LOOK }; // a high rank, so the bots play well
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const seed = flag('--seed') ? +args[args.indexOf('--seed') + 1] : 1;
const which = Object.keys(VIDEOS).filter((k) => args.includes(k));
const budget = (+process.env.VIDEO_MINUTES || 8) * 60000;
const t0 = Date.now();

function findFfmpeg() {
  if (process.env.FFMPEG) return { bin: process.env.FFMPEG, mp4: true };
  try { return { bin: require('ffmpeg-static'), mp4: true }; } catch (e) {}
  if (spawnSync('ffmpeg', ['-version']).status === 0) return { bin: 'ffmpeg', mp4: true };
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright') : path.join(os.homedir(), '.cache', 'ms-playwright'));
  for (const d of fs.existsSync(base) ? fs.readdirSync(base).filter((n) => n.startsWith('ffmpeg')) : []) {
    for (const f of ['ffmpeg-win64.exe', 'ffmpeg-mac', 'ffmpeg-linux']) if (fs.existsSync(path.join(base, d, f))) return { bin: path.join(base, d, f), mp4: false };
  }
  return null;
}

/** open the game at w x h, start the seeded match with the computer playing you, ready at game frame 0 */
async function openMatch(browser, w, h, seed) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  page error: ' + e.message));
  await page.goto(pathToFileURL(PAGE).href);
  await page.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 60000 });
  await page.evaluate((cfg) => {
    const d = EGO.Save.data;
    d.style = cfg.style; Object.assign(d.look, cfg.look); d.club = cfg.club; d.rp = cfg.rp; d.tutorial = true;
    Object.assign(d.settings, { quality: 'high', cam: 'third', camPicked: true, cutins: false, autoFs: false, mute: true, shiftLock: false, sky: 'day' });
    EGO.Game.applyQuality();
    // no words on the advertising boards (no promo text in the video, and the easter egg code stays a secret)
    EGO.World.scene.traverse((o) => { if (o.material && o.material.map && o.material.map === EGO.World.T.ads) o.visible = false; });
    // the same random numbers every time, so the match plays out the same way; drawing gets its own numbers
    const rng = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const sim = rng(cfg.seed), draw = rng(7); let drawing = false;
    Math.random = () => (drawing ? draw() : sim());
    const render = EGO.World.render.bind(EGO.World);
    EGO.World.render = (...a) => { drawing = true; try { return render(...a); } finally { drawing = false; } };
    // the videos are silent, and sounds use random numbers on the real audio clock, which would change the match
    for (const k of Object.keys(EGO.Sfx)) if (typeof EGO.Sfx[k] === 'function') EGO.Sfx[k] = () => {};
    EGO.Input.requestLock = () => {}; // losing the mouse lock would pause the match
    EGO.Game.manual = true; // only stepManual moves the game from now on
    EGO.Game.last = 0; EGO.Game.time = 0; // each step is now + 1000/60 - now: start the clock at 0 so it rounds the same way every run
    EGO.Game.startMatch(cfg.mode);
    const m = EGO.Game.match;
    m.autopilot = true; m.caller = null; // the computer plays you, like EGO.simulate
    window.VID = { frame: 0, step(n, draw) { EGO.Game.stepManual(n, draw); this.frame += n; } };
  }, { ...SETUP, seed });
  await page.addStyleTag({ content: '#replay .rp-offer, #hint { display: none !important; } * { cursor: none !important; }' });
  return { ctx, page };
}

/** step 1: play matches without drawing and pick a goal you scored (the camera follows you),
    or else the first goal by your team */
async function makePlan(browser, v) {
  let backup = null;
  for (let s = seed; s < seed + 8; s++) {
    const plan = await planFor(browser, s, v);
    if (plan && plan.mine) return plan;
    if (plan && !backup) backup = plan;
    console.log(`  no goal by you in the seed ${s} match`);
  }
  if (backup) return backup;
  throw new Error(`no goal by your team in seeds ${seed} to ${seed + 7}`);
}
async function planFor(browser, seed, v) {
  console.log(`Finding a goal in the seed ${seed} match (${v.w}x${v.h})...`);
  // the same screen size as the video: the camera sits further back on a tall screen, and your aim follows it
  const { ctx, page } = await openMatch(browser, v.w, v.h, seed);
  const minF = (BEFORE + 1) * 60, maxF = 200 * 60;
  let goals = [];
  for (let done = false; !done;) {
    const r = await page.evaluate(({ maxF, STEP }) => {
      const m = EGO.Game.match, out = [];
      for (let i = 0; i < 1200 && VID.frame < maxF && m.phase !== 'end'; i += STEP) {
        const before = m.score[0] + m.score[1];
        VID.step(STEP, false);
        if (m.score[0] + m.score[1] !== before) { const g = m.lastGoal; out.push({ f: VID.frame, team: g.team, mine: !!(g.scorer && g.scorer.isHuman), score: m.score.slice() }); }
      }
      return { out, end: m.phase === 'end' || VID.frame >= maxF };
    }, { maxF, STEP });
    goals = goals.concat(r.out);
    r.out.forEach((g) => console.log(`  ${(g.f / 60).toFixed(1)}s: goal by ${g.team === 0 ? (g.mine ? 'YOU' : 'your team') : 'the other team'} (${g.score.join('-')})`));
    done = r.end || goals.some((g) => g.mine && g.f >= minF);
  }
  await ctx.close();
  const pick = goals.find((g) => g.mine && g.f >= minF) || goals.find((g) => g.team === 0 && g.f >= minF);
  if (!pick) return null;
  const plan = { seed, goal: pick.f, start: pick.f - BEFORE * 60, score: pick.score, mine: pick.mine };
  if (pick.mine) console.log(`Using the goal you scored at ${(pick.f / 60).toFixed(1)}s.`);
  return plan;
}

/** step 2: film one video, carrying on from frames saved by an earlier run. Returns true when it is finished. */
async function film(browser, v, plan, ff) {
  const dir = path.join(OUT, 'frames-' + v.name);
  fs.mkdirSync(dir, { recursive: true });
  const fname = (i) => path.join(dir, String(i).padStart(4, '0') + '.jpg');
  const total = HOLD + PLAY;
  let have = 0; while (have < total && fs.existsSync(fname(have))) have++;
  if (have < total) {
    const coverPng = path.join(dir, 'cover.png');
    if (!fs.existsSync(coverPng)) { console.log(`  drawing the cover at ${v.w}x${v.h}`); await shootCover(browser, v.cover, coverPng, v.w, v.h); }
    const { ctx, page } = await openMatch(browser, v.w, v.h, plan.seed);
    const src = 'data:image/png;base64,' + fs.readFileSync(coverPng).toString('base64');
    await page.evaluate((src) => { const img = document.createElement('img'); img.id = 'vid-cover'; img.src = src; img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;pointer-events:none'; document.body.appendChild(img); return img.decode(); }, src);
    const shoot = (i) => page.screenshot({ path: fname(i), type: 'jpeg', quality: 92 });
    if (have < HOLD) { // the cover alone: one picture, saved HOLD times
      await shoot(0); for (let i = 1; i < HOLD; i++) fs.copyFileSync(fname(0), fname(i)); have = HOLD;
    }
    // play the match (no drawing) up to the frame before the next one to film
    const startAt = plan.start + (have - HOLD) * STEP;
    console.log(`  ${v.name}: frame ${have + 1} of ${total}, skipping to ${(startAt / 60).toFixed(1)}s of the match`);
    await page.evaluate((n) => { while (VID.frame < n) VID.step(Math.min(600, n - VID.frame), false); }, startAt);
    let last = Date.now();
    for (let i = have; i < total; i++) {
      if (Date.now() - t0 > budget) { await ctx.close(); console.log(`  saved ${i} of ${total} frames. Out of time for this run: run it again to carry on.`); return false; }
      const j = i - HOLD;
      await page.evaluate(({ STEP, op }) => { VID.step(STEP, true); document.getElementById('vid-cover').style.opacity = op; }, { STEP, op: Math.max(0, 1 - (j + 1) / FADE) });
      await shoot(i);
      if ((i + 1) % 30 === 0) { const now = Date.now(); console.log(`  ${i + 1}/${total} frames (${((now - last) / 30000).toFixed(2)}s per frame)`); last = now; }
    }
    const score = await page.evaluate(() => EGO.Game.match.score.slice());
    await ctx.close();
    if (score.join() !== plan.score.join()) console.log(`  WARNING: the match came out ${score.join('-')} instead of ${plan.score.join('-')}, so the goal may be missing. Watch it, or run again with --fresh --seed ${seed + 1}.`);
  }
  // join the frames into the video
  const file = path.join(OUT, v.name + (ff.mp4 ? '.mp4' : '.webm'));
  const enc = ff.mp4 ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    : ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2'];
  const p = spawn(ff.bin, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-an', ...enc, file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res) => p.on('close', res));
  for (let i = 0; i < total; i++) if (!p.stdin.write(fs.readFileSync(fname(i)))) await new Promise((res) => p.stdin.once('drain', res));
  p.stdin.end();
  if ((await closed) !== 0) throw new Error('ffmpeg could not make ' + file);
  const mb = fs.statSync(file).size / 1e6;
  console.log(`saved dist/videos/${path.basename(file)} (${(total / FPS).toFixed(1)}s, ${mb.toFixed(1)} MB${mb > 50 ? ', OVER their 50 MB limit' : ''})`);
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

(async () => {
  if (!fs.existsSync(PAGE)) { console.error('Run npm run build first.'); process.exit(1); }
  const ff = findFfmpeg();
  if (!ff) { console.error('No ffmpeg found. Run npx playwright install, or set FFMPEG to an ffmpeg.exe.'); process.exit(1); }
  if (!ff.mp4) console.log('No ffmpeg with H.264 found, so the videos will be WebM. Set FFMPEG for MP4.');
  fs.mkdirSync(OUT, { recursive: true });
  const planFile = path.join(OUT, 'plan.json');
  if (flag('--fresh')) { for (const n of fs.readdirSync(OUT)) if (n.startsWith('frames-') || n === 'plan.json') fs.rmSync(path.join(OUT, n), { recursive: true, force: true }); }
  const browser = await chromium.launch({ args: GL_ARGS });
  let plans = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : {};
  if (plans.seed != null) plans = {}; // the old one-plan-for-both file
  let all = true;
  for (const k of which.length ? which : Object.keys(VIDEOS)) {
    const v = VIDEOS[k];
    if (plans[k] && flag('--seed') && plans[k].seed !== seed) { console.error(`The ${k} plan uses seed ${plans[k].seed}. Add --fresh to start over.`); process.exit(1); }
    if (!plans[k]) {
      plans[k] = await makePlan(browser, v); fs.writeFileSync(planFile, JSON.stringify(plans, null, 2));
      if (!plans[k].mine) console.log(`Using the goal by your team at ${(plans[k].goal / 60).toFixed(1)}s of the seed ${plans[k].seed} match.`);
    }
    if (flag('--plan')) { console.log(k + ': ' + JSON.stringify(plans[k])); continue; }
    if (!(await film(browser, v, plans[k], ff))) { all = false; break; }
  }
  await browser.close();
  if (!all) process.exit(3);
})().catch((e) => { console.error(e.message.split('\n')[0]); process.exit(1); });
