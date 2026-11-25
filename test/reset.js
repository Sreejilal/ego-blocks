// RESET PROGRESS (owner, Nov 2026): the profile's START OVER panel. Press once: SURE?; it calms down again after 5 seconds.
// Press twice: everything you earned goes (emeralds, styles, skins, rank, level, stats, presets), your settings, name,
// friends and codes stay (the tester code no longer refills everything by itself), and the fresh save is stored. (On CrazyGames it uses their Data module: test/crazygames.js.)
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  await page.evaluate(() => {
    const d = EGO.Save.data;
    Object.assign(d, { emeralds: 12345, xp: 9000, rp: 340, bp: 40, name: 'DHYANTEST', codes: ['somecode'], friends: [{ f: 'abcdefghijklmnop', n: 'PAL' }] });
    d.styles.push('THUNDER', 'ZENITH'); d.style = 'ZENITH'; d.skins.push('MOHAWK'); d.stats.wins = 50; d.stats.played = 80; d.settings.sens = 1.6; d.settings.quality = 'low';
    d.presets[0].n = 'MY STRIKER'; EGO.Save.save(); EGO.UI.show('profile');
  });
  const once = await page.evaluate(() => { document.getElementById('pf-reset').click(); return { t: document.getElementById('pf-reset').textContent, msg: document.getElementById('pf-reset-msg').textContent, em: EGO.Save.data.emeralds }; });
  check('one press only asks SURE? (nothing is deleted yet)', /SURE/.test(once.t) && /EVERYTHING YOU EARNED GOES/.test(once.msg) && once.em === 12345, once);
  await page.screenshot({ path: __dirname + '/shots/reset_sure.png', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(5300);
  const calm = await page.evaluate(() => ({ t: document.getElementById('pf-reset').textContent, em: EGO.Save.data.emeralds }));
  check('left alone for 5 seconds, it goes back to RESET PROGRESS', calm.t === 'RESET PROGRESS' && calm.em === 12345, calm);
  const done = await page.evaluate(() => {
    const b = document.getElementById('pf-reset'); b.click(); b.click();
    const d = EGO.Save.data, raw = JSON.parse(localStorage.getItem(EGO.Save.key) || '{}');
    return { em: d.emeralds, xp: d.xp, rp: d.rp, bp: d.bp, styles: d.styles, style: d.style, skins: d.skins.length, wins: d.stats.wins, preset: d.presets[0].n, name: d.name, codes: d.codes, friends: d.friends.length, sens: d.settings.sens, q: d.settings.quality, stored: raw.emeralds, storedName: raw.name, msg: document.getElementById('pf-reset-msg').textContent, card: document.getElementById('pf-card').textContent.slice(0, 80) };
  });
  check('two presses: a fresh start (500 emeralds, ROOKIE, level 1, no rank, no stats, the starter presets)', done.em === 500 && done.xp === 0 && done.rp === 0 && done.bp === 0 && done.styles.join(',') === 'ROOKIE' && done.style === 'ROOKIE' && done.skins === 0 && done.wins === 0 && done.preset === 'STRIKER', done);
  check('your settings, name, friends and codes stay', done.name === 'DHYANTEST' && done.codes.join(',') === 'somecode' && done.friends === 1 && done.sens === 1.6 && done.q === 'low', done);
  check('the fresh start is saved, and the screen says so', done.stored === 500 && done.storedName === 'DHYANTEST' && /FRESH START/.test(done.msg), done);
  await page.screenshot({ path: __dirname + '/shots/reset_done.png', timeout: 120000 }).catch(() => {});
  // the owner's tester code stays in the codes, but START OVER really takes the styles and skins away (owner, Nov 25:
  // "when you reset you keep your characters and skins": the code's top-up gave them all back at once)
  const tester = await page.evaluate(() => {
    const C = EGO.CODES, h = Object.keys(C).find((k) => C[k].give === 'all' && !C[k].retired), d = EGO.Save.data;
    d.codes = [h]; d.topUpOff = false; EGO.Save.validate(); const before = d.styles.length;
    EGO.Save.reset(); const after = EGO.Save.data.styles.length, skins = EGO.Save.data.skins.length;
    EGO.Save.load(); EGO.Save.validate(); // the next visit
    const D = EGO.Save.data;
    return { before, after, skins, reload: D.styles.length, admin: EGO.Admin.is(), off: D.topUpOff };
  });
  check('with the tester code, START OVER still leaves only ROOKIE and no skins, after a reload too, and keeps the admin panel', tester.before > 10 && tester.after === 1 && tester.skins === 0 && tester.reload === 1 && tester.admin && tester.off, tester);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 12).join(' | ')); process.exit(1); });
