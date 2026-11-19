// The Android app page (app/www/index.html) played like a brand-new player on a phone: real touches on the stick, the
// camera and the SHOOT button for a whole first match, with a picture of every screen on the way (test/shots/app_*.png).
// Run `npm run build:app` first. Sizes: node test/app_phone.js [width] [height]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390);
const PAGE = path.join(__dirname, '..', 'app', 'www', 'index.html');
const shot = (page, name) => page.screenshot({ path: path.join(__dirname, 'shots', 'app_' + name + '.png'), timeout: 120000 });
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(PAGE)) throw new Error('app/www/index.html is missing. Run `npm run build:app` first.');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  const asked = []; // every web address the app page asks for with no internet game going
  page.on('request', (r) => { if (!/^file:|^data:|^blob:/.test(r.url())) asked.push(r.url()); });
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })); // a real player, not a test robot
  await page.goto(require('url').pathToFileURL(PAGE).href, { timeout: 120000 });
  await page.waitForFunction(() => window.EGO && EGO.Game.state === 'match', null, { timeout: 120000 });
  const cdp = await context.newCDPSession(page);
  let pts = {};
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const send = async (type) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.values(pts) }); await frame(); };
  const tStart = async (id, x, y) => { pts[id] = { x, y, id, radiusX: 6, radiusY: 6, force: 1 }; await send('touchStart'); };
  const tMove = async (id, x, y) => { pts[id] = Object.assign({}, pts[id], { x, y }); await send('touchMove'); };
  const tEnd = async (id) => { const p = pts[id]; delete pts[id]; if (p) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [p] }); await frame(); }; // the list is the fingers that lift
  const step = (n, render = false) => page.evaluate(([n, r]) => EGO.Game.stepManual(n, r), [n, render]);
  const box = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 }; }, sel);

  // ---- 1. the very first thing a new player sees ----
  const first = await page.evaluate(() => ({ portal: EGO.Portal.on, touch: EGO.Touch.on, gate: !document.getElementById('tut-gate').hidden, go: document.getElementById('tg-go').textContent, label: document.querySelector('#tut-gate .label') && document.querySelector('#tut-gate .label').textContent, size: EGO.Game.match.size, mode: EGO.Game.match.mode, keysHidden: document.getElementById('tg-keys').hidden }));
  await shot(page, '1_first_screen');
  check('first open: straight onto the pitch in a 2v2, waiting behind TAP TO PLAY', first.gate && first.go === 'TAP TO PLAY' && first.size === 2 && first.mode === 'quick' && first.touch && first.keysHidden, first);
  await page.touchscreen.tap(W / 2, H / 2);
  await sleep(300);
  check('a tap starts the match', await page.evaluate(() => !EGO.Game.gate && document.getElementById('tut-gate').hidden));
  await step(20, true);
  await shot(page, '2_kickoff');

  // ---- 2. are the touch buttons on screen, big enough and not on top of each other? ----
  const acts = ['shoot', 'pass', 'dt', 'jump', 'ab0', 'ab1', 'ab2', 'pause', 'cam', 'emote'];
  const boxes = {};
  for (const a of acts) boxes[a] = await box(`#touch [data-act="${a}"]`);
  boxes.stick = await box('#t-stick');
  const vis = Object.entries(boxes).filter(([k, b]) => b && b.shown && k !== 'stick'); // the stick's box is the whole left side, so it is left out
  const off = vis.filter(([, b]) => b.l < 0 || b.t < 0 || b.r > W || b.b > H).map(([k]) => k);
  const small = vis.filter(([k, b]) => k !== 'stick' && Math.min(b.w, b.h) < 36).map(([k, b]) => k + ' ' + b.w + 'x' + b.h);
  const hit = [];
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) { const a = vis[i][1], b = vis[j][1]; const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (ox > 6 && oy > 6) hit.push(vis[i][0] + '+' + vis[j][0]); }
  check('every touch button is fully on the screen', off.length === 0, off);
  check('every touch button is at least 36px', small.length === 0, small);
  check('no touch buttons sit on top of each other', hit.length === 0, hit);
  console.log('BUTTONS ' + vis.map(([k, b]) => `${k}:${b.w}x${b.h}@${b.l},${b.t}`).join('  '));

  // ---- 3. play the whole match with touches ----
  const info = () => page.evaluate(() => {
    const G = EGO.Game, m = G.match; if (!m || G.state !== 'match') return { st: G.state };
    const p = m.human, b = m.ball, mate = m.players.find((q) => q.team === p.team && q !== p);
    return { st: G.state, phase: m.phase, px: p.pos.x, pz: p.pos.z, bx: b.pos.x, bz: b.pos.z, own: b.owner === p, mateOwn: b.owner === mate, oppOwn: !!b.owner && b.owner.team !== p.team, yaw: EGO.Cam.yaw, gz: m.oppGoalZ(p.team), score: m.score.slice(), team: p.team, time: m.time, ps: p.state, ph: +(p.passHold || 0).toFixed(2), held: [...EGO.Touch.held].join(','), nptr: EGO.Touch.ptrs.size, sp: !!p.setPiece, tmx: +EGO.Touch.moveX.toFixed(2), tmy: +EGO.Touch.moveY.toFixed(2), sid: EGO.Touch.stickId, spd: +Math.hypot(p.vel.x, p.vel.z).toFixed(1), gx: EGO.Touch.ghost.x, gy: EGO.Touch.ghost.y, R: EGO.Touch.R, cue: !!(EGO.BallCue.cur && EGO.BallCue.cur()), tip: (document.querySelector('#tip:not([hidden])') || {}).textContent || '' };
  });
  let s = await info();
  const seen = { own: 0, shots: 0, moved: 0, tips: new Set(), frames: 0, tackles: 0, passes: 0 };
  const start = { x: s.px, z: s.pz };
  let stick = false, shotOwn = false, shotGoal = false, shotTip = false, iter = 0, still = 0;
  const sb = boxes.shoot, tb = boxes.dt;
  // which way does a camera drag turn? try a small one
  const y0 = s.yaw; await tStart(2, W * 0.6, H * 0.3); for (let i = 1; i <= 4; i++) await tMove(2, W * 0.6 + i * 15, H * 0.3); await tEnd(2); await step(2);
  s = await info(); const perPx = (s.yaw - y0) / 60;
  check('dragging the right side turns the camera', Math.abs(perPx) > 0.001, +perPx.toFixed(4));
  const turnTo = async (want) => { let d = want - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 0.08 || !perPx) return; const px = Math.max(-220, Math.min(220, d / perPx)); await tStart(2, W * 0.55, H * 0.3); for (let i = 1; i <= 4; i++) await tMove(2, W * 0.55 + px * i / 4, H * 0.3); await tEnd(2); };
  while (s.st === 'match' && iter < (+process.env.ITERS || 2600)) {
    iter++;
    // still level after golden goal: a free kick battle. Take our kicks (theirs the bots take by themselves)
    if (await page.evaluate(() => { const m = EGO.Game.match, h = m && m.human; if (!m || !m.fk || !m.fk.battle) return false; if (m.fk.state === 'aim' && m.ball.owner === h && h.fkHold && m.fk.t > 0.5) { const t = m.aim.clone().set(Math.sign(m.fk.x || 1) * -3, 1.6, m.oppGoalZ(h.team)); m.freeKickShot(h, EGO.fkIdeal(Math.hypot(t.x - m.ball.pos.x, t.z - m.ball.pos.z)), t); } EGO.Game.stepManual(10); return true; })) { seen.battle = true; s = await info(); continue; }
    if (s.phase === 'play') {
      // run at the ball, or at their goal once we have it
      const tx = s.own ? 0 : s.bx, tz = s.own ? s.gz : s.bz;
      let dx = tx - s.px, dz = tz - s.pz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const my = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), mx = -dx * Math.cos(s.yaw) + dz * Math.sin(s.yaw);
      const k = s.own ? 0.9 : 1.5; // past the ring = sprint
      const X = Math.max(8, Math.min(W / 2 - 8, s.gx + mx * s.R * k)), Y = Math.max(8, Math.min(H - 8, s.gy - my * s.R * k));
      if (!stick) { await tStart(1, s.gx, s.gy); stick = true; }
      await tMove(1, X, Y);
      if (s.own) {
        seen.own++;
        if (!shotOwn) { await step(1, true); await shot(page, '4_i_have_the_ball'); shotOwn = true; }
        await turnTo(Math.atan2(0 - s.px, s.gz - s.pz)); // look at their goal
        still = s.spd < 0.5 ? still + 1 : 0;
        if (Math.abs(s.gz - s.pz) < 48) { await tStart(3, sb.x, sb.y); await step(24); await tEnd(3); seen.shots++; }
        else if (still >= 3) { await tStart(3, boxes.pass.x, boxes.pass.y); await step(4); await tEnd(3); seen.passes++; still = 0; } // a throw-in or corner waits for me: pass it
      } else if (s.oppOwn && d < 2.2 && tb && tb.shown && iter % 6 === 0) { await tStart(3, tb.x, tb.y); await step(2); await tEnd(3); seen.tackles++; }
      else if (iter % 12 === 0) await turnTo(Math.atan2(s.bx - s.px, s.bz - s.pz)); // keep the ball in front of the camera
    } else if (stick) { await tEnd(1); stick = false; }
    await step(8);
    seen.frames += 8; if (process.env.TRACE && (s.ph > 0.3 || s.held)) console.log('STUCK', iter, s.ph, s.held, s.nptr, Object.keys(pts).join(','), s.phase, s.own, s.sp); if (process.env.TRACE && iter % 4000 === 0) console.log('T', iter, 'stick', s.tmx, s.tmy, s.sid, 'spd', s.spd, s.phase, s.ps, s.own, +s.px.toFixed(1), +s.pz.toFixed(1), 'ball', +s.bx.toFixed(1), +s.bz.toFixed(1), 'gz', s.gz, 'yaw', +s.yaw.toFixed(2), 't', s.time, s.score.join('-'));
    const n = await info();
    if (n.st === 'match') {
      if (n.tip && !seen.tips.has(n.tip)) { seen.tips.add(n.tip); if (!shotTip) { await step(1, true); await shot(page, '3_first_tip'); shotTip = true; } }
      if (iter === 40) { await step(1, true); await shot(page, '3b_playing'); }
      if (!shotGoal && (n.score[0] + n.score[1]) > (s.score ? s.score[0] + s.score[1] : 0)) { await step(30, true); await shot(page, '5_goal'); shotGoal = true; }
      seen.moved = Math.max(seen.moved, Math.hypot(n.px - start.x, n.pz - start.z));
    }
    s = n.st === 'match' ? n : Object.assign({}, s, { st: n.st });
  }
  if (stick) { await tEnd(1); }
  const end = await page.evaluate(() => ({ st: EGO.Game.state, score: EGO.Game.match && EGO.Game.match.score, team: EGO.Game.match && EGO.Game.match.human.team, played: EGO.Save.data.stats.played }));
  console.log('MATCH ' + JSON.stringify({ end, battle: !!seen.battle, own: seen.own, shots: seen.shots, tackles: seen.tackles, passes: seen.passes, moved: +seen.moved.toFixed(1), seconds: Math.round(seen.frames / 60), tips: [...seen.tips].map((t) => t.slice(0, 50)) }));
  check('the stick moved the player around the pitch', seen.moved > 10, +seen.moved.toFixed(1));
  check('I won the ball with touches', seen.own > 0, seen.own);
  check('I shot with the SHOOT button', seen.shots > 0, seen.shots);
  check('the match reached the end', end.st !== 'match', end);

  check('the app asked for nothing on the internet while playing bots', asked.length === 0, asked.slice(0, 5));
  // ---- 4. the screens after the match ----
  await step(260, true); await sleep(300);
  await shot(page, '6_results');
  const ovf = (id) => page.evaluate((id) => { const e = document.getElementById(id); return e ? { sw: e.scrollWidth, cw: e.clientWidth } : null; }, id);
  let o = await ovf('scr-results'); check('results screen fits sideways', !o || o.sw <= o.cw + 1, o);
  const tap = async (sel) => { const b = await box(sel); if (!b || !b.shown) return false; await page.touchscreen.tap(b.x, b.y); await sleep(350); return true; };
  await page.evaluate(() => { EGO.Game.manual = false; });
  // close anything that pops up (level up, rewards) then go to the start screen
  for (let i = 0; i < 6 && await page.evaluate(() => EGO.Game.state !== 'lobby'); i++) { if (!(await tap('#r-lobby'))) { await page.touchscreen.tap(W / 2, H / 2); await sleep(400); } }
  await sleep(900);
  await shot(page, '7_start_screen');
  check('back on the start screen', await page.evaluate(() => EGO.Game.state === 'lobby'));
  const subs = await page.evaluate(() => [document.getElementById('quick-sub').textContent, document.getElementById('rank-sub').textContent]);
  check('the PLAY and RANKED buttons say the real size of the next match (2v2)', /2V2/.test(subs[0]) && /2V2/.test(subs[1]), subs);
  o = await ovf('scr-lobby'); check('start screen fits sideways', o && o.sw <= o.cw + 1, o);
  for (const [btn, scr, back, name] of [['#go-online', 'scr-online', '#on-back', '8_online'], ['#go-locker', 'scr-locker', '#locker-back', '9_locker'], ['#go-howto', 'scr-howto', '#howto-back', '10_howto']]) {
    if (!(await tap(btn))) { check('open ' + name, false, 'button not on screen: ' + btn); continue; }
    await sleep(500); await shot(page, name);
    o = await ovf(scr); check(name + ' fits sideways', o && o.sw <= o.cw + 1, o);
    if (name === '8_online') check('the online screen calls the game server', asked.some((u) => /ego-blocks.onrender.com/.test(u)), asked.slice(0, 3));
    if (name === '8_online') console.log('ONLINE ' + JSON.stringify(await page.evaluate(() => ({ text: document.getElementById('scr-online').innerText.replace(/\s+/g, ' ').slice(0, 300), link: EGO.Net.inviteLink ? (EGO.Net.room = { code: 'ABCD' }, EGO.Net.inviteLink()) : null }))));
    if (!(await tap(back))) await page.evaluate(() => EGO.UI.show('lobby'));
  }
  // second match: pause menu
  await tap('#go-quick'); await sleep(500);
  // the match intro: the camera flies in and you can pick your position; PLAY starts it
  const intro = await page.evaluate(() => ({ on: !!EGO.Game.intro, roles: document.querySelectorAll('#in-roles .in-role').length }));
  check('the second match opens with the intro and the position picker', intro.on && intro.roles >= 2, intro);
  await shot(page, '10b_intro');
  if (intro.on) { await tap('#in-go'); await sleep(300); }
  check('PLAY on the intro starts the match', !(await page.evaluate(() => EGO.Game.intro)));
  const m2 = await page.evaluate(() => ({ st: EGO.Game.state, size: EGO.Game.match && EGO.Game.match.size }));
  check('second match is also a small one (2v2)', m2.st === 'match' && m2.size === 2, m2);
  await step(240, true);
  const pb = await box('#touch [data-act="pause"]'); await page.touchscreen.tap(pb.x, pb.y); await sleep(400);
  await shot(page, '11_pause');
  o = await ovf('scr-pause'); check('pause menu fits sideways', !o || o.sw <= o.cw + 1, o);

  check('no errors', logs.length === 0, logs.slice(0, 5));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(1); });
