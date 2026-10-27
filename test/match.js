const { open } = require('./harness');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const mode = process.argv[2] || 'quick';
  const { browser, page, logs } = await open({ wait: 1500, viewport: { width: 1100, height: 620 } });
  await page.evaluate(() => { EGO.Save.data.settings.quality = 'low'; });
  await page.click('#go-' + mode);
  const step = (n, render = true) => page.evaluate(([n, r]) => EGO.Game.stepManual(n, r), [n, render]);
  const st = () => page.evaluate(() => { const m = EGO.Game.match, h = m.human; return { phase: m.phase, clock: +m.clock.toFixed(1), score: m.score, hasBall: m.ball.owner === h, owner: m.ball.owner && m.ball.owner.name, ball: [+m.ball.pos.x.toFixed(1), +m.ball.pos.y.toFixed(1), +m.ball.pos.z.toFixed(1)], hp: [+h.pos.x.toFixed(1), +h.pos.z.toFixed(1)], hstate: h.state, stam: +h.stamina.toFixed(0), flow: +h.flow.toFixed(0), charging: h.charging, gstate: EGO.Game.state }; });
  const shot = async (name) => { await step(1, true); await page.screenshot({ path: __dirname + '/shots/' + name + '.png' }); };
  await step(60, false);
  await shot('m1_kickoff');
  await step(110, false);
  console.log('after kickoff', JSON.stringify(await st()));
  const lock = await page.evaluate(() => ({ locked: document.pointerLockElement != null }));
  console.log('lock', JSON.stringify(lock));
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await step(60, false);
  console.log('running', JSON.stringify(await st()));
  await shot('m2_run');
  await page.keyboard.up('ShiftLeft');
  await page.mouse.move(550, 300); await page.mouse.down(); await step(2, false); await page.mouse.up(); await step(2, false);
  await page.mouse.down(); await step(40, false);
  console.log('charging', JSON.stringify(await st()));
  await shot('m3_charge');
  await page.mouse.up(); await step(8, false);
  await shot('m4_shot');
  console.log('shot', JSON.stringify(await st()));
  await step(80, false);
  await page.keyboard.up('KeyW');
  for (const k of ['KeyQ', 'KeyE', 'KeyR', 'KeyC', 'KeyF', 'KeyG', 'Space', 'KeyX']) { await page.keyboard.press(k); await step(15, false); }
  await page.keyboard.down('Tab'); await step(3, false);
  await shot('m5_board');
  await page.keyboard.up('Tab');
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (let i = 0; i < 60; i++) {
    const k = keys[i % 4];
    await page.keyboard.down(k); await page.keyboard.down('KeyW');
    if (i % 5 === 0) { await page.mouse.down(); await step(10, false); await page.mouse.up(); }
    if (i % 7 === 0) { await page.mouse.down({ button: 'right' }); await step(6, false); await page.mouse.up({ button: 'right' }); }
    if (i % 3 === 0) await page.keyboard.press(['KeyQ', 'KeyE', 'KeyR', 'KeyC', 'KeyF'][i % 5]);
    await step(12, false);
    await page.keyboard.up(k);
  }
  await page.keyboard.up('KeyW');
  console.log('after play', JSON.stringify(await st()));
  await shot('m6_play');
  await page.keyboard.press('Escape'); await step(2, false);
  await shot('m7_pause');
  console.log('paused', JSON.stringify(await st()));
  console.log('LOGS', logs.length ? logs.slice(0, 30).join('\n') : 'none');
  await browser.close();
})();
