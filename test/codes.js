// Codes on the Profile screen. The tester code itself is never written in the project (it is public): set
// SCORZ_TESTER_CODE to check the real one, otherwise a stand-in code with the same reward is added for the test.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;
const REAL = process.env.SCORZ_TESTER_CODE || '';

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const A = await ctx.newPage(); A.setDefaultTimeout(120000);
  A.on('pageerror', (e) => logs.push(e.message));
  await A.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await A.goto(URL, { timeout: 120000 }); await A.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
  const code = REAL || 'stand in tester 42';
  if (!REAL) await A.evaluate(() => { EGO.CODES[EGO.codeHash('STANDINTESTER42')] = { name: 'TESTER PACK', give: 'all' }; });
  check(REAL ? 'the real tester code is the one the game knows' : 'stand-in code added (set SCORZ_TESTER_CODE to check the real one)', await A.evaluate((c) => !!EGO.CODES[EGO.codeHash(c)], code));
  await A.click('#go-profile');
  const redeem = async (text) => { await A.fill('#pf-code', text); await A.click('#pf-code-form button'); return A.evaluate(() => document.getElementById('pf-code-msg').textContent); };
  check('empty: TYPE A CODE FIRST', /TYPE A CODE FIRST/.test(await redeem('')));
  check('a wrong code does nothing', /DOES NOT WORK/.test(await redeem('free stuff please')));
  const before = await A.evaluate(() => ({ em: EGO.Save.data.emeralds, styles: EGO.Save.data.styles.length }));
  const msg = await redeem('  ' + code.toLowerCase().split('').join(' ') + '!! ');
  const after = await A.evaluate(() => {
    const d = EGO.Save.data;
    return { styles: d.styles.length, allStyles: EGO.STYLE_IDS.length, flows: d.flows.length, allFlows: Object.keys(EGO.FLOWS).length, skins: d.skins.length, allSkins: Object.keys(EGO.SKINS).filter((k) => !EGO.SKINS[k].base).length, em: d.emeralds, bp: d.bp, rp: d.rp };
  });
  check('the code works with any spaces, case or symbols', /TESTER PACK UNLOCKED/.test(msg), msg);
  check('you get every style, Flow and skin, emeralds and blueprints (not rank)', after.styles === after.allStyles && after.flows === after.allFlows && after.skins === after.allSkins && after.em === before.em + 99999 && after.bp >= 999 && after.rp === 0, after);
  await A.screenshot({ path: __dirname + '/shots/code1_profile.png', timeout: 120000 });
  check('a second time: YOU ALREADY USED THAT CODE', /ALREADY USED/.test(await redeem(code)));
  // it is kept after a reload, and you can equip anything
  await A.reload(); await A.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
  const kept = await A.evaluate(() => ({ styles: EGO.Save.data.styles.length, all: EGO.STYLE_IDS.length, codes: EGO.Save.data.codes.length }));
  check('kept after closing the game', kept.styles === kept.all && kept.codes === 1, kept);
  // phones: the box fits
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const P = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })).newPage(); P.setDefaultTimeout(120000);
    P.on('pageerror', (e) => logs.push(e.message));
    await P.goto(URL, { timeout: 120000 }); await P.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
    await P.evaluate(() => EGO.UI.show('profile'));
    await P.evaluate(() => document.getElementById('pf-code').scrollIntoView());
    const fit = await P.evaluate(() => { const i = document.getElementById('pf-code').getBoundingClientRect(), b = document.querySelector('#pf-code-form button').getBoundingClientRect(); return { inR: Math.round(i.right), btnR: Math.round(b.right), vw: innerWidth, sw: document.documentElement.scrollWidth, scr: document.getElementById('scr-profile').scrollWidth - document.getElementById('scr-profile').clientWidth }; });
    check('phone ' + w + 'x' + h + ': the code box fits', fit.btnR <= fit.vw && fit.inR <= fit.vw && fit.scr <= 0, fit);
    await P.screenshot({ path: __dirname + '/shots/code2_phone_' + w + '.png', timeout: 120000 });
    await P.context().close();
  }
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
