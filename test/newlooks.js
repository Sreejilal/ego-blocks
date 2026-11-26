// New looks (owner, Nov 26 2026: more clubs, new hairstyles): every club has a crest and kits, every new hairstyle is a
// skin you can get, and a picture of them all on the pitch.
// node test/newlooks.js   (run `npm run build` first)
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

process.on('unhandledRejection', (e) => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const r = await page.evaluate(() => {
    const ids = EGO.CLUB_IDS, crests = ids.map((id) => { try { return EGO.crestCanvas(id, 24).width > 0; } catch (e) { return false; } });
    const hairs = Object.keys(EGO.SKINS).filter((k) => EGO.SKINS[k].slot === 'hair' && EGO.SKINS[k].shape);
    const NEW = ['FADE', 'TOP_KNOT', 'CURTAINS', 'BRAIDS', 'TWIN_TAILS', 'WOLF_CUT', 'DREADS', 'BLAZE_CUT'];
    const spinnable = NEW.filter((k) => [0, 1, 2, 3, 4].some((r) => EGO.poolFor('skin', r).includes(k)));
    // a picture: the six new clubs (home, away) and the eight new hairstyles
    EGO.Showcase.hide(); document.getElementById('app').style.visibility = 'hidden'; EGO.Game.manual = true;
    const fake = { scene: EGO.World.scene, ball: { owner: null } }, made = [];
    ids.slice(6).forEach((id, i) => ['home', 'away'].forEach((w, j) => {
      const p = new EGO.Player(fake, { team: 0, role: 'ST', style: 'ROOKIE', side: EGO.sideFor(id, w === 'away'), number: 9, name: 'X', skin: '#e0ac85' });
      p.pos.set((i - 2.5) * 2.2, 0, 3.5 + 1.4 * j); p.yaw = Math.PI; p.setState('free'); p.animate(1); made.push(p);
    }));
    NEW.forEach((k, i) => {
      const p = new EGO.Player(fake, { team: 0, role: 'ST', style: 'ROOKIE', side: EGO.sideFor('ROVERS'), number: 10, name: 'X', skin: '#c48b62', look: { hair: k } });
      p.pos.set((i - 3.5) * 1.5, 0, 0); p.yaw = Math.PI * 0.82; p.setState('free'); p.animate(1); made.push(p);
    });
    window._made = made;
    const cam = EGO.World.camera; cam.fov = 40; cam.position.set(0, 3.4, -9.5); cam.lookAt(0, 1.1, 2); cam.updateProjectionMatrix();
    EGO.World.render();
    return { clubs: ids.length, crests: crests.every(Boolean), hairs: hairs.length, shapes: NEW.every((k) => EGO.SKINS[k] && EGO.SKINS[k].shape), spinnable: spinnable.length };
  });
  await page.waitForTimeout(500); await page.screenshot({ path: __dirname + '/shots/newlooks.png', timeout: 120000 }).catch(() => {});
  check('12 clubs, each with a crest', r.clubs === 12 && r.crests, r);
  check('8 new hairstyles, all skins you can spin for', r.shapes && r.spinnable === 8 && r.hairs >= 21, r);
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.filter((l) => l.startsWith('PAGEERROR')).slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
