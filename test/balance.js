// Balance check: full 4 minute bot matches at every team size and a few bot skill levels.
// Healthy: about 3 to 10 goals a match on average. Usage: node test/balance.js [matches per setting]
const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const n = +(process.argv[2] || 4);
  const rows = [];
  const sizes = (process.argv[3] || '3,4,5').split(',').map(Number), ds = (process.argv[4] || '0.3,0.6,0.9').split(',').map(Number);
  for (const size of sizes) for (const d of ds) {
    const r = await page.evaluate(([size, d, n]) => {
      const goals = [], shots = [], passes = [], tackles = [];
      for (let i = 0; i < n; i++) { const s = EGO.simulate(size === 5 ? 'ranked' : 'quick', d, 240, size); goals.push(s.goals); shots.push(s.shots); passes.push(s.passes); tackles.push(s.tackles); }
      const avg = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
      return { goals, avgGoals: avg(goals), shots: avg(shots), passes: avg(passes), tackles: avg(tackles) };
    }, [size, d, n]);
    rows.push(Object.assign({ size: size + 'v' + size, d }, r));
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
  const bad = rows.filter((r) => r.avgGoals < 3 || r.avgGoals > 10);
  console.log(bad.length ? 'OUT OF RANGE: ' + bad.map((r) => r.size + ' d=' + r.d + ' avg ' + r.avgGoals).join(', ') : 'ALL SETTINGS 3 TO 10 GOALS');
  console.log('LOGS', logs.length ? logs.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
