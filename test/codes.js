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
  check('a second time with nothing new: YOU ALREADY HAVE EVERYTHING', /ALREADY HAVE EVERYTHING/.test(await redeem(code)));
  // a save from before an update is missing the newest things: the code again gives them, but no more emeralds
  const forget = () => A.evaluate(() => { const d = EGO.Save.data; d.styles = d.styles.filter((s) => s !== 'GLACIER' && s !== 'KESTREL'); d.flows = d.flows.filter((f) => f !== 'WILDFIRE'); d.skins = d.skins.filter((s) => s !== 'SKY_POINT'); EGO.Save.save(); return d.emeralds; });
  const em0 = await forget();
  const again = await redeem(code), em1 = await A.evaluate(() => EGO.Save.data.emeralds);
  check('a second time after an update: the new things unlock, no extra emeralds', /4 NEW ITEMS UNLOCKED/.test(again) && em1 === em0, { again, em0, em1 });
  // and just opening the game gives them too
  await forget();
  await A.reload(); await A.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
  if (!REAL) await A.evaluate(() => { EGO.CODES[EGO.codeHash('STANDINTESTER42')] = { name: 'TESTER PACK', give: 'all' }; EGO.Save.validate(); });
  const kept = await A.evaluate(() => { const d = EGO.Save.data; return { styles: d.styles.length, all: EGO.STYLE_IDS.length, flows: d.flows.length, allFlows: Object.keys(EGO.FLOWS).length, skins: d.skins.length, allSkins: Object.keys(EGO.SKINS).filter((k) => !EGO.SKINS[k].base).length, codes: d.codes.length }; });
  check('kept after closing the game, and new things from updates unlock by themselves', kept.styles === kept.all && kept.flows === kept.allFlows && kept.skins === kept.allSkins && kept.codes === 1, kept);
  // a save that never used the code gets nothing
  const plain = await A.evaluate(() => { const d = EGO.Save.defaults(); return EGO.codeTopUp(d) === 0 && d.styles.length === 1 && d.flows.length === 0 && d.skins.length === 0; });
  check('no code used: nothing unlocks', plain);
  // the old tester code is retired: it cannot be used any more, but saves that used it keep getting new things
  const old = await A.evaluate(() => {
    const d = EGO.Save.defaults(); d.codes.push('yszaepofxo');
    EGO.CODES[EGO.codeHash('OLDSTANDIN')] = { name: 'TESTER PACK', give: 'all', retired: true };
    const fresh = EGO.Save.defaults(), r = EGO.redeemCode(fresh, 'old stand in');
    return { known: !!EGO.CODES.yszaepofxo && EGO.CODES.yszaepofxo.retired, topUp: EGO.codeTopUp(d) > 0, refused: !r.ok && /DOES NOT WORK/.test(r.msg) && fresh.styles.length === 1 };
  });
  check('the old tester code is retired (no new uses), saves that used it still get new things', old.known && old.topUp && old.refused, old);
  // the two gift codes: the lobby one (500 emeralds) and the hidden one (1000 emeralds, 10 blueprints), once each
  await A.evaluate(() => { const d = EGO.Save.data; d.codes = d.codes.filter((h) => h !== EGO.codeHash(EGO.GIFT_CODE) && h !== EGO.codeHash('TOPBINS')); EGO.Save.save(); EGO.UI.show('lobby'); });
  const giftShown = await A.evaluate(() => !document.getElementById('lob-gift').hidden && document.getElementById('lob-gift').textContent.includes(EGO.GIFT_CODE));
  await A.click('#lob-gift');
  const filled = await A.evaluate(() => ({ screen: EGO.UI.cur, code: document.getElementById('pf-code').value }));
  const g0 = await A.evaluate(() => ({ em: EGO.Save.data.emeralds, bp: EGO.Save.data.bp }));
  await A.click('#pf-code-form button');
  const giftMsg = await A.evaluate(() => document.getElementById('pf-code-msg').textContent);
  const g1 = await A.evaluate(() => ({ em: EGO.Save.data.emeralds, bp: EGO.Save.data.bp }));
  const twice = await redeem(await A.evaluate(() => EGO.GIFT_CODE));
  const hidden = await redeem('top bins');
  const g2 = await A.evaluate(() => ({ em: EGO.Save.data.emeralds, bp: EGO.Save.data.bp }));
  await A.evaluate(() => EGO.UI.show('lobby'));
  const giftGone = await A.evaluate(() => document.getElementById('lob-gift').hidden);
  check('the lobby shows the gift code; a click opens Profile with it typed in', giftShown && filled.screen === 'profile' && filled.code === 'KICKOFF', filled);
  check('the gift code gives 500 emeralds once, then the lobby line goes away', /\+500 EMERALDS/.test(giftMsg) && g1.em === g0.em + 500 && /ALREADY USED/.test(twice) && giftGone, { giftMsg, twice, giftGone });
  check('the hidden code gives 1000 emeralds and 10 blueprints', /HIDDEN GIFT/.test(hidden) && g2.em === g1.em + 1000 && g2.bp === g1.bp + 10, { hidden, g1, g2 });
  // the Locker lists styles and Flows from Rare up to Generational
  const order = await A.evaluate(() => {
    const R = ['Rare', 'Epic', 'Legendary', 'Mythic', 'Generational'], out = {};
    for (const tab of ['style', 'flow']) {
      EGO.UI.openLocker(); EGO.UI.lockerTab = tab; EGO.UI.renderLocker();
      const ids = [...document.querySelectorAll('#locker-grid .lcard')].map((b) => b.dataset.id).filter((id) => id !== 'NONE');
      const M = tab === 'style' ? EGO.STYLES : EGO.FLOWS, r = ids.map((id) => R.indexOf(M[id].rarity));
      out[tab] = { sorted: r.every((v, i) => i === 0 || v >= r[i - 1]), first: ids[0], n: ids.length };
    }
    EGO.UI.show('lobby');
    return out;
  });
  check('the Locker lists styles and Flows from Rare up to Generational (ROOKIE first)', order.style.sorted && order.flow.sorted && order.style.first === 'ROOKIE', order);
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
