// Skins: the Locker shows your player in 3D and tries on whatever you click; skins save, never change stats,
// and come from Skin Spins. Screenshots of the Locker at three sizes go to test/shots/.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const pools = await page.evaluate(() => [0, 1, 2, 3, 4].map((r) => EGO.poolFor('skin', r).length));
  check('every rarity has skins to roll', pools.every((n) => n > 0), pools);

  // a skin owned and equipped, then a reload: it stays
  await page.evaluate(() => { const d = EGO.Save.data; d.skins.push('RED_BAND', 'MOHAWK', 'BACKFLIP'); d.emeralds = 2000; EGO.Save.save(); });
  await page.click('#go-locker'); await sleep(200);
  await page.click('#ltab-skin'); await sleep(200);
  await page.click('#lk-slots [data-slot="acc"]'); await sleep(200);
  await page.click('.lcard[data-id="GOLD_CHAIN"]'); await sleep(200);
  const tried = await page.evaluate(() => ({ acc: EGO.Showcase.p.look.acc, cap: document.getElementById('lk-cap').textContent, equipped: EGO.Save.data.look.acc }));
  check('clicking a locked skin tries it on without equipping', tried.acc && tried.acc.kind === 'chain' && tried.equipped === 'NO_ACC' && /LOCKED/.test(tried.cap), tried);
  await page.click('.lcard[data-id="RED_BAND"]'); await sleep(150);
  await page.click('#lk-equip'); await sleep(150);
  await page.click('#lk-slots [data-slot="hair"]'); await sleep(150);
  await page.click('.lcard[data-id="MOHAWK"]'); await sleep(150);
  await page.click('#lk-equip'); await sleep(150);
  await page.evaluate(() => { EGO.Game.manual = true; EGO.Game.stepManual(30, true); });
  await page.screenshot({ path: __dirname + '/shots/sk1_locker_desktop.png' });
  const eq = await page.evaluate(() => ({ look: EGO.Save.data.look, shape: EGO.Showcase.p.look.hairShape, acc: EGO.Showcase.p.look.acc && EGO.Showcase.p.look.acc.kind }));
  check('equipping saves the skin and shows it', eq.look.acc === 'RED_BAND' && eq.look.hair === 'MOHAWK' && eq.shape === 'mohawk' && eq.acc === 'band', eq);

  // dragging the preview spins the player
  const box = await page.locator('#lk-fit').boundingBox();
  const t0 = await page.evaluate(() => EGO.Showcase.turnTo);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
  const t1 = await page.evaluate(() => EGO.Showcase.turnTo);
  check('dragging the preview turns the player', t1 - t0 > 1, { t0: +t0.toFixed(2), t1: +t1.toFixed(2) });

  // celebrations play in the preview
  await page.click('#lk-slots [data-slot="celeb"]'); await sleep(150);
  await page.click('.lcard[data-id="BACKFLIP"]'); await sleep(150);
  await page.evaluate(() => EGO.Game.stepManual(40, true));
  const cel = await page.evaluate(() => ({ state: EGO.Showcase.p.state, celeb: EGO.Showcase.p.look.celeb }));
  check('goal celebration plays in the preview', cel.state === 'celebrate' && cel.celeb === 'flip', cel);
  await page.screenshot({ path: __dirname + '/shots/sk2_locker_celeb.png' });
  await page.click('#lk-equip'); await sleep(100);

  // back to the start screen: the player wears it there too
  await page.click('#locker-back'); await sleep(150);
  const lob = await page.evaluate(() => { EGO.Game.stepManual(10, true); return { mode: EGO.Showcase.mode, shape: EGO.Showcase.p.look.hairShape, state: EGO.Showcase.p.state }; });
  check('start screen shows the equipped skins', lob.mode === 'lobby' && lob.shape === 'mohawk' && lob.state === 'free', lob);

  // in a match: same look, same stats as without skins
  const m = await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('quick'); const h = G.match.human;
    const r = { shape: h.look.hairShape, acc: h.look.acc && h.look.acc.kind, celeb: h.look.celeb, speed: h.mods.speed, shot: h.mods.shot };
    h.computeMods(); r.speed = h.mods.speed; r.shot = h.mods.shot;
    h.setState('celebrate', 3); G.stepManual(30, true);
    G.toLobby(); return r;
  });
  check('match player wears the skins and stats are unchanged', m.shape === 'mohawk' && m.acc === 'band' && m.celeb === 'flip' && m.speed === 1 && m.shot === 1, m);

  // a skin spin pays 200 and adds a skin
  // the match above locked the mouse, which confuses Playwright's clicks for a while, so drive the spin screen directly
  await page.evaluate(() => { EGO.UI.openSpins(); EGO.UI.spinKind = 'skin'; EGO.UI.renderSpins(true); });
  const before = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, n: EGO.Save.data.skins.length, pity: EGO.Save.data.pity.skin }));
  await page.evaluate(() => EGO.UI.spin()); await sleep(6500);
  const after = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, n: EGO.Save.data.skins.length, pity: EGO.Save.data.pity.skin, result: document.getElementById('spin-result').textContent }));
  check('skin spin costs 200 and gives a skin (or a refund)', (after.n === before.n + 1 && after.em === before.em - 200) || (after.n === before.n && after.em === before.em - 150), { before, after });
  await page.screenshot({ path: __dirname + '/shots/sk3_skin_spin.png' });

  // broken or hacked saves fall back to the free skins
  await page.evaluate(() => { localStorage.setItem('scorz.save.v1', JSON.stringify({ skins: ['MOHAWK', 42, 'NOPE'], look: { hair: 'MOHAWK', acc: 'GOLD_CHAIN', boots: 'MOHAWK', celeb: 7 } })); });
  await page.reload(); await sleep(1200);
  const san = await page.evaluate(() => ({ skins: EGO.Save.data.skins, look: EGO.Save.data.look }));
  check('bad save data is cleaned up', JSON.stringify(san.skins) === '["MOHAWK"]' && san.look.hair === 'MOHAWK' && san.look.acc === 'NO_ACC' && san.look.boots === 'TEAM_BOOTS' && san.look.celeb === 'JUMP' && san.look.color === 'STYLE_COLOR', san);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();

  for (const [name, viewport] of [['phone-side', { width: 844, height: 390 }], ['phone-up', { width: 390, height: 844 }]]) {
    const o = await open({ wait: 1500, viewport, mobile: true });
    await o.page.evaluate(() => { EGO.Save.data.skins.push('GOLD_CHAIN'); EGO.Save.data.look.acc = 'GOLD_CHAIN'; EGO.UI.openLocker(); EGO.UI.lockerTab = 'skin'; EGO.UI.skinSlot = 'acc'; EGO.UI.lockerSel = 'GOLD_CHAIN'; EGO.UI.renderLocker(); EGO.Game.manual = true; EGO.Game.stepManual(30, true); });
    await o.page.screenshot({ path: __dirname + '/shots/sk_locker_' + name + '.png' });
    const lay = await o.page.evaluate(() => {
      const sec = document.getElementById('scr-locker'), fit = document.getElementById('lk-fit').getBoundingClientRect(), cap = document.getElementById('lk-cap').getBoundingClientRect();
      return { sideScroll: sec.scrollWidth > sec.clientWidth, pageScroll: sec.scrollHeight > sec.clientHeight + 1, fit: [Math.round(fit.width), Math.round(fit.height)], capBottom: Math.round(cap.bottom), h: innerHeight };
    });
    check(name + ': locker fits the screen with the preview in view', !lay.sideScroll && !lay.pageScroll && lay.fit[0] > 100 && lay.fit[1] > 100 && lay.capBottom <= lay.h, lay);
    check(name + ': no errors', o.logs.length === 0, o.logs.slice(0, 4));
    await o.browser.close();
  }
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
