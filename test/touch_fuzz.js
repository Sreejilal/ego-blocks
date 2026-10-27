// Random multi-touch fuzz during a live match: no errors, nothing left stuck when the fingers lift
const { open } = require('./harness');
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390), ROUNDS = +(process.argv[4] || 250);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
(async () => {
  const { browser, page, logs } = await open({ wait: 1800, viewport: { width: W, height: H }, mobile: true });
  const cdp = await page.context().newCDPSession(page);
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  let pts = {}, nextId = 1;
  const send = async (type) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.values(pts) }); };
  await page.evaluate(() => { EGO.Game.startMatch('lawless'); EGO.Game.manual = true; EGO.Game.stepManual(160); });
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('#touch [data-act]')).filter((e) => !e.hidden && e.dataset.act !== 'pause').map((e) => { const r = e.getBoundingClientRect(); return { a: e.dataset.act, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  let errors = 0, maxHeld = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const ids = Object.keys(pts);
    const r = rnd();
    if (ids.length < 4 && r < 0.4) {
      // new finger: on a button half the time, else anywhere
      let x, y;
      if (rnd() < 0.5) { const b = btns[Math.floor(rnd() * btns.length)]; x = b.x + (rnd() - 0.5) * 10; y = b.y + (rnd() - 0.5) * 10; }
      else { x = rnd() * W; y = rnd() * H; }
      let id = 0; while (pts[id]) id++; pts[id] = { x, y, id, radiusX: 5, radiusY: 5, force: 1 }; await send('touchStart');
    } else if (ids.length && r < 0.75) {
      const id = ids[Math.floor(rnd() * ids.length)];
      pts[id] = Object.assign({}, pts[id], { x: Math.min(W - 1, Math.max(0, pts[id].x + (rnd() - 0.5) * 120)), y: Math.min(H - 1, Math.max(0, pts[id].y + (rnd() - 0.5) * 120)) });
      await send('touchMove');
    } else if (ids.length) {
      const id = ids[Math.floor(rnd() * ids.length)]; delete pts[id];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: Object.values(pts) });
    }
    await frame();
    const st = await page.evaluate(() => { EGO.Game.stepManual(3); return { held: EGO.Touch.held.size, state: EGO.Game.state }; });
    maxHeld = Math.max(maxHeld, st.held);
    if (st.state !== 'match') { await page.evaluate(() => { if (EGO.Game.state === 'paused') { EGO.Game.pausedAt = 0; EGO.Game.resume(); } }); }
  }
  // lift everything
  pts = {}; await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frame();
  await page.evaluate(() => EGO.Game.stepManual(10));
  const end = await page.evaluate(() => ({ held: EGO.Touch.held.size, ptrs: EGO.Touch.ptrs.size, stick: EGO.Touch.stickId, look: EGO.Touch.lookId, mx: EGO.Touch.moveX, my: EGO.Touch.moveY, charging: EGO.Game.match.human.charging, passHold: EGO.Game.match.human.passHold, phase: EGO.Game.match.phase, score: EGO.Game.match.score }));
  console.log('maxHeld', maxHeld, 'end', JSON.stringify(end));
  const ok = end.held === 0 && end.ptrs === 0 && end.stick === null && end.look === null && end.mx === 0 && end.my === 0 && !end.charging && !(end.passHold > 0);
  console.log(ok ? 'PASS nothing stuck after fuzz' : 'FAIL something stuck after fuzz');
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
