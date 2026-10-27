// The 3D spin: a block drops, shakes and glows in the rarity colour (sometimes teasing a better one),
// cracks open on your player in the prize. Rarer = longer. SKIP jumps to the result. Odds and pity unchanged.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const odds = await page.evaluate(() => {
    const c = [0, 0, 0, 0, 0]; for (let i = 0; i < 200000; i++) c[EGO.rollRarity(0)]++;
    let worst = 0, pity = 0, since = 0;
    for (let i = 0; i < 30000; i++) { const r = EGO.rollRarity(pity); since++; if (r >= 2) { worst = Math.max(worst, since); since = 0; pity = 0; } else pity++; }
    return { pct: c.map((x) => +(x / 2000).toFixed(1)), worst };
  });
  check('odds are still 55 / 28 / 12 / 4.5 / 0.5', Math.abs(odds.pct[0] - 55) < 0.8 && Math.abs(odds.pct[1] - 28) < 0.8 && Math.abs(odds.pct[2] - 12) < 0.6 && Math.abs(odds.pct[3] - 4.5) < 0.4 && Math.abs(odds.pct[4] - 0.5) < 0.2, odds.pct);
  check('Legendary or better still comes within 30 spins', odds.worst <= 30, odds.worst);
  const durs = await page.evaluate(() => [0, 1, 2, 3, 4].map((r) => EGO.Reveal.duration(r)));
  check('rarer pulls take longer', durs.every((d, i) => i === 0 || d > durs[i - 1]) && durs[4] < 5, durs);

  await page.evaluate(() => { EGO.Save.data.emeralds = 3000; EGO.Game.manual = true; });
  await page.click('#go-spins'); await sleep(150);
  const idle = await page.evaluate(() => { EGO.Game.stepManual(20, true); return { phase: EGO.Reveal.phase, block: EGO.Reveal.block.visible, hidden: !EGO.Showcase.p.P.root.visible, mode: EGO.Showcase.mode }; });
  check('spin screen: a closed block waits on the lit spot', idle.phase === 'idle' && idle.block && idle.hidden && idle.mode === 'reveal', idle);
  await page.screenshot({ path: __dirname + '/shots/rv1_ready.png' });

  // force a Mythic pull with a tease, and watch the phases
  const run = await page.evaluate(() => {
    const R = EGO.Reveal, out = { phases: [], colors: [], fizzled: false };
    R.start({ kind: 'style', id: 'MAGNET', r: 3, dupe: false }, () => { out.doneAt = R.t; }, { fake: true });
    out.plan = R.plan.steps.slice();
    let last = '';
    for (let i = 0; i < 60 * 5; i++) {
      EGO.Game.stepManual(1, i % 40 === 0);
      if (R.phase !== last) { out.phases.push(R.phase); last = R.phase; }
      if (R.phase === 'shake') { const c = '#' + R.mat.emissive.getHexString(); if (out.colors[out.colors.length - 1] !== c) out.colors.push(c); }
      if (R.plan.fizzled) out.fizzled = true;
      if (i === 150) window._mid = true;
    }
    out.shown = EGO.Showcase.p.P.root.visible; out.style = EGO.Showcase.p.styleId; out.pose = EGO.Showcase.p.state;
    return out;
  });
  check('block drops, shakes, then cracks open', run.phases.join() === 'drop,shake,done', run.phases);
  check('a tease: glows a better colour, then fizzles to the real one', run.fizzled && run.plan.join() === '0,1,2,3,4,3', { plan: run.plan, colors: run.colors.length });
  check('your player appears posing in the new style', run.shown && run.style === 'MAGNET' && run.pose === 'celebrate', run);
  await page.screenshot({ path: __dirname + '/shots/rv2_opened.png' });

  // a real spin with SKIP
  const before = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, spins: EGO.Save.data.stats.spins }));
  await page.click('#spin-go'); await sleep(100);
  await page.evaluate(() => EGO.Game.stepManual(50, true));
  await page.screenshot({ path: __dirname + '/shots/rv3_shaking.png' });
  const skipVisible = await page.evaluate(() => !document.getElementById('spin-skip').hidden);
  await page.click('#spin-skip'); await sleep(100);
  const after = await page.evaluate(() => { EGO.Game.stepManual(30, true); return { phase: EGO.Reveal.phase, result: document.getElementById('spin-result').textContent, shown: document.getElementById('spin-result').classList.contains('show'), em: EGO.Save.data.emeralds, spins: EGO.Save.data.stats.spins, spinning: EGO.UI.spinning, skip: document.getElementById('spin-skip').hidden }; });
  check('SKIP jumps straight to the result', skipVisible && after.phase === 'done' && after.shown && after.result.length > 3 && !after.spinning && after.skip, after);
  check('a spin still costs 200 (50 back for a duplicate)', after.spins === before.spins + 1 && (after.em === before.em - 200 || after.em === before.em - 150), { before, after });
  await page.screenshot({ path: __dirname + '/shots/rv4_result.png' });

  // without skipping, a spin ends on its own
  await page.click('#tab-flow'); await sleep(100);
  await page.click('#spin-go'); await sleep(100);
  const flow = await page.evaluate(() => { for (let i = 0; i < 60 * 5; i++) EGO.Game.stepManual(1, false); EGO.Game.stepManual(1, true); return { phase: EGO.Reveal.phase, shown: document.getElementById('spin-result').classList.contains('show'), flow: EGO.Showcase.flow }; });
  check('flow spin plays out and shows the flow on your player', flow.phase === 'done' && flow.shown && !!flow.flow, flow);
  await page.click('#spin-back'); await sleep(100);
  const lob = await page.evaluate(() => { EGO.Game.stepManual(5, true); return { on: EGO.Reveal.on, block: EGO.Reveal.group.visible, player: EGO.Showcase.p.P.root.visible, mode: EGO.Showcase.mode }; });
  check('back on the start screen the block is gone and your player is back', !lob.on && !lob.block && lob.player && lob.mode === 'lobby', lob);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();

  for (const [name, viewport] of [['phone-side', { width: 844, height: 390 }], ['phone-up', { width: 390, height: 844 }]]) {
    const o = await open({ wait: 1500, viewport, mobile: true });
    await o.page.evaluate(() => { EGO.Save.data.emeralds = 1000; EGO.UI.openSpins(); EGO.Game.manual = true; EGO.Reveal.start({ kind: 'skin', id: 'GOLD_CHAIN', r: 2, dupe: false }, () => EGO.UI.spinDone('skin', 'GOLD_CHAIN', 2, false)); for (let i = 0; i < 200; i++) EGO.Game.stepManual(1, false); EGO.Game.stepManual(1, true); });
    await o.page.screenshot({ path: __dirname + '/shots/rv_' + name + '.png' });
    const lay = await o.page.evaluate(() => { const s = document.getElementById('scr-spins'), f = document.getElementById('sp-fit').getBoundingClientRect(), b = document.getElementById('spin-go').getBoundingClientRect(); return { side: s.scrollWidth > s.clientWidth, page: s.scrollHeight > s.clientHeight + 1, fit: [Math.round(f.width), Math.round(f.height)], btnBottom: Math.round(b.bottom), h: innerHeight }; });
    check(name + ': spin screen fits with the 3D stage in view', !lay.side && !lay.page && lay.fit[1] > 90 && lay.btnBottom <= lay.h, lay);
    check(name + ': no errors', o.logs.length === 0, o.logs.slice(0, 4));
    await o.browser.close();
  }
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
