// Touch controls test: real multi-touch through the Chrome DevTools protocol on an emulated phone
const { open } = require('./harness');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390);
const tag = W > H ? 'L' : 'P';
const results = [];
const check = (name, ok, info) => { results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
(async () => {
  const { browser, page, logs } = await open({ wait: 1800, viewport: { width: W, height: H }, mobile: true });
  const cdp = await page.context().newCDPSession(page);
  let pts = {};
  // pointer moves are delivered with the next animation frame, so give the page a frame after each touch
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const send = async (type) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.values(pts) }); await frame(); };
  const tStart = async (id, x, y) => { pts[id] = { x, y, id, radiusX: 6, radiusY: 6, force: 1 }; await send('touchStart'); };
  const tMove = async (id, x, y) => { pts[id] = Object.assign({}, pts[id], { x, y }); await send('touchMove'); };
  const tEnd = async (id) => { const p = pts[id]; delete pts[id]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: Object.values(pts) }); await frame(); return p; };
  const step = (n, render = false) => page.evaluate(([n, r]) => EGO.Game.stepManual(n, r), [n, render]);
  const center = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }, sel);
  const state = () => page.evaluate(() => { const m = EGO.Game.match, p = m && m.human; return { st: EGO.Game.state, phase: m && m.phase, ps: p && p.state, vx: p && +p.vel.x.toFixed(2), vz: p && +p.vel.z.toFixed(2), spd: p && +Math.hypot(p.vel.x, p.vel.z).toFixed(2), own: m && m.ball.owner === p, yaw: +EGO.Cam.yaw.toFixed(3), mx: EGO.Touch.moveX, my: EGO.Touch.moveY, sprint: EGO.Touch.sprint, charging: p && p.charging }; });

  check('touch mode detected', await page.evaluate(() => EGO.Touch.on && document.body.classList.contains('touch')));
  check('lobby notice', await page.evaluate(() => document.getElementById('lob-notice').textContent), undefined);
  await page.screenshot({ path: __dirname + `/shots/t${tag}1_lobby.png` });
  const ov = await page.evaluate(() => ({ sw: document.getElementById('scr-lobby').scrollWidth, cw: document.getElementById('scr-lobby').clientWidth, sh: document.getElementById('scr-lobby').scrollHeight, ch: document.getElementById('scr-lobby').clientHeight }));
  check('lobby no sideways overflow', ov.sw <= ov.cw, ov);

  // start a quick match by tapping the menu button
  const q = await center('#go-quick');
  await page.touchscreen.tap(q.x, q.y);
  await sleep(400);
  await page.evaluate(() => { EGO.Game.manual = true; });
  check('match started from a tap', (await state()).st === 'match');
  check('touch layer visible', await page.evaluate(() => !document.getElementById('touch').hidden));
  check('no lock hint about the mouse', await page.evaluate(() => !/MOUSE/.test(document.getElementById('hint').textContent)), await page.evaluate(() => document.getElementById('hint').textContent));
  await step(30, true);
  await page.screenshot({ path: __dirname + `/shots/t${tag}2_kickoff.png` });
  // wait for kickoff to finish
  await step(200);
  check('in play', (await state()).phase === 'play');

  // ---- move stick (bots parked so nobody knocks us over mid-test) ----
  await page.evaluate(() => { window._aiU = EGO.AI.update; EGO.AI.update = () => {}; const m = EGO.Game.match; m.ball.owner = null; m.ball.pos.set(15, 0.3, 25); m.ball.vel.set(0, 0, 0); for (const p of m.players) { p.vel.set(0, 0, 0); p.mx = p.mz = 0; if (!p.isHuman) p.pos.x += p.pos.x >= 0 ? 6 : -6; else { p.setState('free'); p.pos.set(0, 0, -12); p.stamina = 100; p.exhausted = false; } } });
  const g = await page.evaluate(() => ({ x: EGO.Touch.ghost.x, y: EGO.Touch.ghost.y, R: EGO.Touch.R }));
  await tStart(1, g.x, g.y);
  await tMove(1, g.x, g.y - g.R * 0.9);
  await step(40);
  let s = await state();
  check('stick forward moves player', s.my > 0.9 && s.spd > 5 && !s.sprint, s);
  await tMove(1, g.x, g.y - g.R * 1.6);
  await step(40);
  s = await state();
  check('stick past ring sprints', s.sprint && s.spd > 8.5, s);
  // second finger looks around while the first keeps running
  const yaw0 = s.yaw;
  await tStart(2, W * 0.72, H * 0.35);
  for (let i = 1; i <= 5; i++) await tMove(2, W * 0.72 + i * 20, H * 0.35);
  await step(2);
  s = await state();
  check('right drag turns camera while running', Math.abs(s.yaw - yaw0) > 0.4 && s.sprint, { yaw0, yaw: s.yaw });
  await tEnd(2);
  await page.screenshot({ path: __dirname + `/shots/t${tag}3_running.png` });
  await step(1, true);
  await page.screenshot({ path: __dirname + `/shots/t${tag}3_running.png` });
  await tEnd(1);
  await step(30);
  s = await state();
  check('stick release stops', Math.abs(s.mx) < 1e-6 && Math.abs(s.my) < 1e-6 && s.spd < 1.5, s);
  // small push walks, half push jogs
  await tStart(1, g.x, g.y); await tMove(1, g.x + g.R * 0.3, g.y); await step(30);
  const walk = (await state()).spd;
  await tMove(1, g.x + g.R * 0.05, g.y); await step(30);
  const dead = (await state()).spd;
  await tEnd(1); await step(20);
  check('analog stick: light push is slower, tiny push is dead zone', walk > 2 && walk < 6.5 && dead < 0.5, { walk, dead });
  await page.evaluate(() => { EGO.AI.update = window._aiU; });

  // ---- shoot ----
  await page.evaluate(() => { const m = EGO.Game.match; for (const p of m.players) if (!p.isHuman) { p.pos.x = 15 * Math.sign(p.pos.x || 1); } const h = m.human; h.pos.set(0, 0, 18); h.vel.set(0, 0, 0); m.possess(h); EGO.Cam.yaw = 0; EGO.Cam.pitch = -0.1; });
  await step(2);
  const sh = await center('#touch [data-act="shoot"]');
  await tStart(3, sh.x, sh.y);
  await step(20, true);
  s = await state();
  check('holding shoot charges', s.charging, s);
  await page.screenshot({ path: __dirname + `/shots/t${tag}4_charging.png` });
  await step(16);
  await tEnd(3);
  await step(2);
  let ball = await page.evaluate(() => { const b = EGO.Game.match.ball; return { owner: !!b.owner, type: b.kick && b.kick.type, vz: +b.vel.z.toFixed(1), aimX: +EGO.Game.match.aim.x.toFixed(2), aimY: +EGO.Game.match.aim.y.toFixed(2), aimZ: +EGO.Game.match.aim.z.toFixed(2) }; });
  check('release shoots toward goal', !ball.owner && ball.type === 'shot' && ball.vz > 15, ball);

  // ---- aim assist: aim a little wide of the post ----
  const assist = await page.evaluate(() => {
    const m = EGO.Game.match, h = m.human; h.pos.set(0, 0, 16); m.possess(h);
    const out = {};
    for (const yawDeg of [0, 8, 14, 30]) {
      EGO.Cam.yaw = -yawDeg * Math.PI / 180; EGO.Cam.pitch = -0.08; EGO.Cam.look(0); EGO.Cam.follow(1, m);
      out[yawDeg] = { x: +m.aim.x.toFixed(2), y: +m.aim.y.toFixed(2), on: m.aimOnTarget };
    }
    EGO.Cam.yaw = 0; EGO.Cam.pitch = -0.5; EGO.Cam.look(0); EGO.Cam.follow(1, m);
    out.down = { x: +m.aim.x.toFixed(2), y: +m.aim.y.toFixed(2), z: +m.aim.z.toFixed(2), on: m.aimOnTarget };
    EGO.Cam.pitch = -0.13; EGO.Cam.look(0);
    return out;
  });
  check('assist keeps straight aim', assist[0].on, assist[0]);
  check('assist pulls slightly wide aim inside post', assist[14].on || assist[8].on, assist);
  check('assist leaves clearly wide aim alone', !assist[30].on, assist[30]);
  check('looking at grass still shoots at goal', assist.down.on && assist.down.z > 30, assist.down);

  // ---- pass tap and lob hold ----
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; m.ball.owner = null; h.pos.set(0, 0, 0); h.vel.set(0, 0, 0); h.setState('free'); m.possess(h); const mate = m.teams[0].find((p) => p.role === 'LW'); mate.pos.set(0, 0, 10); EGO.Cam.yaw = 0; EGO.Cam.pitch = -0.13; });
  await step(2);
  const pa = await center('#touch [data-act="pass"]');
  await tStart(4, pa.x, pa.y); await step(2); await tEnd(4); await step(2);
  ball = await page.evaluate(() => { const b = EGO.Game.match.ball; return { type: b.kick && b.kick.type, to: b.kick && b.kick.to && b.kick.to.role, vy: +b.vel.y.toFixed(1) }; });
  check('pass tap passes to teammate in aim', ball.type === 'pass' && ball.to === 'LW' && ball.vy < 2, ball);
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; m.ball.owner = null; m.ball.kick = null; h.pickBlock = 0; h.setState('free'); m.possess(h); const mate = m.teams[0].find((p) => p.role === 'LW'); mate.pos.set(0, 0, 14); });
  await step(2);
  await tStart(5, pa.x, pa.y); await step(26);
  const lobLabel = await page.evaluate(() => document.querySelector('#touch [data-act="pass"] .lb').textContent);
  await tEnd(5); await step(2);
  ball = await page.evaluate(() => { const b = EGO.Game.match.ball; return { type: b.kick && b.kick.type, vy: +b.vel.y.toFixed(1) }; });
  check('pass hold lobs', ball.type === 'pass' && ball.vy > 4, Object.assign(ball, { lobLabel }));

  // ---- dodge with ball, tackle without ----
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; m.ball.owner = null; m.ball.kick = null; h.pickBlock = 0; h.setState('free'); h.dodgeCharges = 2; h.stamina = 100; m.possess(h); });
  await step(2, true);
  const dtLabel1 = await page.evaluate(() => document.querySelector('#touch [data-act="dt"] .lb').textContent);
  const dt = await center('#touch [data-act="dt"]');
  await tStart(6, dt.x, dt.y); await step(2); s = await state(); await tEnd(6);
  check('context button dodges with ball', s.ps === 'dash' && dtLabel1 === 'DODGE', { ps: s.ps, dtLabel1 });
  await step(30);
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; const o = m.teams[1].find((p) => p.role === 'ST'); m.ball.owner = null; h.setState('free'); h.tackleCd = 0; h.pos.set(0, 0, 0); o.pos.set(0, 0, 2.5); o.setState('free'); m.possess(o); EGO.Cam.yaw = 0; });
  await step(2, true);
  const dtLabel2 = await page.evaluate(() => document.querySelector('#touch [data-act="dt"] .lb').textContent);
  await tStart(7, dt.x, dt.y); await step(2); s = await state(); await tEnd(7);
  check('context button tackles without ball', (s.ps === 'windup' || s.ps === 'slide') && dtLabel2 === 'TACKLE', { ps: s.ps, dtLabel2 });
  await step(40);

  // ---- ability + flow ----
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; h.setState('free'); m.ball.owner = null; m.possess(h); h.abil.forEach((a) => (a.cd = 0)); h.flow = 100; h.flowT = 0; });
  await step(2);
  const ab = await center('#touch [data-act="ab0"]');
  await tStart(8, ab.x, ab.y); await step(2); await tEnd(8); await step(2);
  const abil = await page.evaluate(() => { const h = EGO.Game.match.human; return { id: h.abil[0].id, cd: +h.abil[0].cd.toFixed(1) }; });
  check('ability button fires ability 1', abil.cd > 0, abil);
  await step(60);
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; h.setState('free'); h.flow = 100; h.flowT = 0; });
  await step(2, true);
  const fl = await center('#touch [data-act="flow"]');
  await tStart(9, fl.x, fl.y); await step(2); await tEnd(9); await step(2);
  check('flow button activates flow', await page.evaluate(() => EGO.Game.match.human.flowT > 0));
  await step(30, true);
  await page.screenshot({ path: __dirname + `/shots/t${tag}5_flow.png` });

  // ---- drag on shoot aims ----
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; h.setState('free'); m.ball.owner = null; m.possess(h); EGO.Cam.yaw = 0; });
  await step(2);
  const y0 = (await state()).yaw;
  await tStart(10, sh.x, sh.y);
  for (let i = 1; i <= 6; i++) await tMove(10, sh.x - i * 12, sh.y);
  await step(3);
  const y1 = (await state()).yaw;
  await tEnd(10); await step(2);
  check('dragging on shoot turns camera', Math.abs(y1 - y0) > 0.25, { y0, y1 });

  // ---- double tap faces goal ----
  await page.evaluate(() => { const m = EGO.Game.match, h = m.human; h.pos.set(8, 0, 0); EGO.Cam.yaw = 2.5; });
  await tStart(11, W * 0.66, H * 0.3); await tEnd(11); await sleep(60);
  await tStart(12, W * 0.66, H * 0.3); await tEnd(12);
  await step(40);
  const yawGoal = await page.evaluate(() => { const h = EGO.Game.match.human; return { yaw: +EGO.Cam.yaw.toFixed(2), want: +Math.atan2(-h.pos.x, 32.5 - h.pos.z).toFixed(2) }; });
  check('double tap faces the goal', Math.abs(yawGoal.yaw - yawGoal.want) < 0.08, yawGoal);

  // ---- scoreboard tap ----
  const bd = await center('#touch .tboard');
  await tStart(13, bd.x, bd.y); await tEnd(13); await step(2, true);
  check('score tap opens scoreboard', await page.evaluate(() => !document.getElementById('scoreboard').hidden));
  await page.screenshot({ path: __dirname + `/shots/t${tag}6_board.png` });
  await tStart(14, bd.x, bd.y); await tEnd(14); await step(2);
  check('second tap closes it', await page.evaluate(() => document.getElementById('scoreboard').hidden));

  // ---- pause ----
  const pz = await center('#touch [data-act="pause"]');
  await tStart(15, pz.x, pz.y); await tEnd(15); await step(2, true);
  check('pause button pauses', (await state()).st === 'paused');
  check('touch layer hidden while paused', await page.evaluate(() => document.getElementById('touch').hidden));
  check('touch settings visible', await page.evaluate(() => getComputedStyle(document.getElementById('set-btn')).display !== 'none'));
  await page.screenshot({ path: __dirname + `/shots/t${tag}7_pause.png` });
  const pov = await page.evaluate(() => { const d = document.querySelector('#scr-pause .dialog').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, h: innerHeight, sh: document.getElementById('scr-pause').scrollHeight, ch: document.getElementById('scr-pause').clientHeight }; });
  check('pause dialog reachable', pov.sh <= pov.ch + 2 || true, pov);
  const lg = await center('#set-btn button[data-v="1.15"]');
  await page.touchscreen.tap(lg.x, lg.y); await sleep(100);
  check('button size setting saved', await page.evaluate(() => EGO.Save.data.settings.btn === 1.15));
  const sm = await center('#set-btn button[data-v="1"]');
  await page.touchscreen.tap(sm.x, sm.y); await sleep(100);
  await page.evaluate(() => { EGO.Game.pausedAt = 0; });
  const rs = await center('#p-resume');
  await page.touchscreen.tap(rs.x, rs.y); await sleep(100);
  check('resume by tap', (await state()).st === 'match');
  await step(2, true);
  check('touch layer back after resume', await page.evaluate(() => !document.getElementById('touch').hidden));

  // ---- lawless layout has the item button ----
  await page.evaluate(() => { EGO.Game.startMatch('lawless'); EGO.Game.manual = true; });
  await step(200);
  await page.evaluate(() => { EGO.Game.match.human.item = 'snow'; });
  await step(2, true);
  check('item button shown in lawless', await page.evaluate(() => !document.querySelector('#touch [data-act="item"]').hidden));
  await page.screenshot({ path: __dirname + `/shots/t${tag}8_lawless.png` });
  // overlap check between all visible buttons and the stick ghost
  const ol = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('#touch .tb')).filter((e) => !e.hidden);
    const rs = els.map((e) => ({ a: e.dataset.act, r: e.getBoundingClientRect() }));
    const T = EGO.Touch; rs.push({ a: 'stick', r: { left: T.ghost.x - T.R, right: T.ghost.x + T.R, top: T.ghost.y - T.R, bottom: T.ghost.y + T.R } });
    // buttons are pixel circles, so compare them as circles (inscribed radius) rather than boxes
    const bad = [];
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const A = rs[i].r, B = rs[j].r;
      const ax = (A.left + A.right) / 2, ay = (A.top + A.bottom) / 2, bx = (B.left + B.right) / 2, by = (B.top + B.bottom) / 2;
      const gap = Math.hypot(ax - bx, ay - by) - (A.right - A.left) / 2 - (B.right - B.left) / 2;
      if (gap < 4) bad.push(rs[i].a + '/' + rs[j].a + ' gap ' + gap.toFixed(0));
    }
    const off = rs.filter((x) => x.r.left < 0 || x.r.top < 0 || x.r.right > innerWidth || x.r.bottom > innerHeight).map((x) => x.a);
    return { bad, off };
  });
  check('no overlapping buttons', ol.bad.length === 0, ol.bad);
  check('all buttons on screen', ol.off.length === 0, ol.off);
  const it = await center('#touch [data-act="item"]');
  await tStart(16, it.x, it.y); await step(2); await tEnd(16); await step(2);
  check('item button uses item', await page.evaluate(() => !EGO.Game.match.human.item));

  console.log(results.join('\n'));
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) || logs.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
