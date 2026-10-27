const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const n = +(process.argv[2] || 3), mode = process.argv[3] || 'quick';
  for (const d of [0.25, 0.6, 0.9]) {
    for (let i = 0; i < n; i++) {
      const t0 = Date.now();
      const r = await page.evaluate(([mode, d]) => { try { return EGO.simulate(mode, d, 240); } catch (e) { return { error: e.message, stack: e.stack.split('\n').slice(0, 6).join('\n') }; } }, [mode, d]);
      console.log('d=' + d, JSON.stringify(r), (Date.now() - t0) + 'ms');
      if (r.error) break;
    }
  }
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})();
