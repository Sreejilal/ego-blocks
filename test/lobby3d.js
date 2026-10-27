// 3D start screen: your player stands on a lit spot next to the menu.
// Checks the three layouts and that the player turns toward the mouse. Screenshots go to test/shots/.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sizes = [
  ['desktop', { width: 1280, height: 720 }, false],
  ['phone-side', { width: 844, height: 390 }, true],
  ['phone-up', { width: 390, height: 844 }, true],
];
(async () => {
  for (const [name, viewport, mobile] of sizes) {
    const { browser, page, logs } = await open({ wait: 1500, viewport, mobile });
    await page.evaluate(() => { EGO.Game.manual = true; EGO.Game.stepManual(40, true); });
    const info = await page.evaluate(() => {
      const S = EGO.Showcase, st = document.getElementById('lob-stage').getBoundingClientRect();
      const menu = document.querySelector('#scr-lobby .menu').getBoundingClientRect();
      const card = document.querySelector('#scr-lobby .profile').getBoundingClientRect();
      // where the player's middle lands on screen
      const v = new THREE.Vector3(0, 1.08, 0).project(EGO.World.camera);
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight;
      const sec = document.getElementById('scr-lobby');
      return { on: S.on, visible: S.p.P.root.visible, px: Math.round(px), py: Math.round(py), stage: [Math.round(st.left), Math.round(st.top), Math.round(st.width), Math.round(st.height)],
        menu: [Math.round(menu.left), Math.round(menu.top), Math.round(menu.right), Math.round(menu.bottom)], card: [Math.round(card.left), Math.round(card.top), Math.round(card.right), Math.round(card.bottom)],
        sideScroll: sec.scrollWidth > sec.clientWidth };
    });
    await page.screenshot({ path: __dirname + '/shots/l3d_' + name + '.png' });
    const inStage = info.px >= info.stage[0] && info.px <= info.stage[0] + info.stage[2] && info.py >= info.stage[1] && info.py <= info.stage[1] + info.stage[3];
    check(name + ': player stands in the stage box', info.on && info.visible && inStage, info);
    check(name + ': no sideways scrolling', !info.sideScroll);
    if (name === 'phone-up') check(name + ': player is above the buttons', info.stage[1] + info.stage[3] <= info.menu[1] + 1, { stage: info.stage, menu: info.menu });
    else check(name + ': player is right of the buttons', info.stage[0] >= info.menu[2] - 4, { stage: info.stage, menu: info.menu });
    if (name === 'desktop') {
      await page.mouse.move(1250, 360);
      const turn = await page.evaluate(() => { EGO.Game.stepManual(60, true); return EGO.Showcase.turn; });
      check('player turns toward the mouse', turn > 0, { turn: +turn.toFixed(2) });
      await page.screenshot({ path: __dirname + '/shots/l3d_desktop_turn.png' });
      const after = await page.evaluate(() => { EGO.Game.startMatch('quick'); EGO.Game.stepManual(5, true); const a = { hidden: !EGO.Showcase.p.P.root.visible, fov: EGO.World.camera.fov, offset: !!(EGO.World.camera.view && EGO.World.camera.view.enabled) }; EGO.Game.toLobby(); EGO.Game.stepManual(5, true); return Object.assign(a, { back: EGO.Showcase.p.P.root.visible }); });
      check('player hides in a match and comes back after', after.hidden && after.fov === 68 && !after.offset && after.back, after);
      const restyle = await page.evaluate(() => { EGO.Save.data.styles.push('RAILGUN'); EGO.Save.data.style = 'RAILGUN'; EGO.UI.show('lobby'); return EGO.Showcase.p.styleId; });
      check('new style shows on the start screen', restyle === 'RAILGUN', restyle);
      await page.evaluate(() => EGO.Game.stepManual(20, true));
      await page.screenshot({ path: __dirname + '/shots/l3d_desktop_railgun.png' });
    }
    check(name + ': no errors', logs.length === 0, logs.slice(0, 4));
    await browser.close();
  }
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
