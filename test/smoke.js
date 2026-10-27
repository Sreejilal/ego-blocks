const { open } = require('./harness');
(async () => {
  const { browser, page, logs } = await open();
  await page.screenshot({ path: __dirname + '/shots/lobby.png' });
  const info = await page.evaluate(() => ({ state: window.EGO && EGO.Game.state, gl: !!(EGO && EGO.World.renderer), calls: EGO.World.renderer.info.render.calls, tris: EGO.World.renderer.info.render.triangles }));
  console.log('INFO', JSON.stringify(info));
  console.log('LOGS', logs.length ? logs.join('\n') : 'none');
  await browser.close();
})();
