// Screenshots of every menu on an emulated phone, plus overflow checks
const { open } = require('./harness');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390);
const tag = W > H ? 'L' : 'P';
(async () => {
  const { browser, page, logs } = await open({ wait: 1800, viewport: { width: W, height: H }, mobile: true });
  const ov = (id) => page.evaluate((id) => { const e = document.getElementById(id); return { sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight }; }, id);
  const tap = async (sel) => { const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel); await page.touchscreen.tap(r.x, r.y); await sleep(250); };
  await tap('#go-howto');
  await page.screenshot({ path: __dirname + `/shots/m${tag}1_howto.png` });
  console.log('howto', JSON.stringify(await ov('scr-howto')));
  await tap('#howto-back');
  await page.evaluate(() => { EGO.Save.data.emeralds = 5000; EGO.UI.renderLobby(); });
  await tap('#go-spins');
  await page.screenshot({ path: __dirname + `/shots/m${tag}2_spins.png` });
  console.log('spins', JSON.stringify(await ov('scr-spins')));
  await tap('#spin-go');
  await sleep(6500);
  await page.screenshot({ path: __dirname + `/shots/m${tag}3_spun.png` });
  await tap('#spin-back');
  await tap('#go-locker');
  await page.screenshot({ path: __dirname + `/shots/m${tag}4_locker.png` });
  console.log('locker', JSON.stringify(await ov('scr-locker')));
  await tap('#locker-back');
  // results screen
  await page.evaluate(() => { EGO.Game.startMatch('ranked'); EGO.Game.manual = true; EGO.Game.stepManual(5); const m = EGO.Game.match; m.score = [3, 1]; m.human.stats.goals = 2; m.human.stats.assists = 1; m.endMatch(); EGO.Game.stepManual(220, true); });
  await sleep(300);
  await page.screenshot({ path: __dirname + `/shots/m${tag}5_results.png` });
  console.log('results', JSON.stringify(await ov('scr-results')), await page.evaluate(() => EGO.Game.state));
  await tap('#r-lobby');
  await page.evaluate(() => { EGO.Game.manual = false; });
  await sleep(500);
  await page.screenshot({ path: __dirname + `/shots/m${tag}6_lobby_after.png` });
  console.log('LOGS', logs.length ? logs.slice(0, 20).join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
