// Presets (owner, Nov 2026: "1 preset its like striker then goalie", then "the look didn't change", "type any way u want",
// "20 like presets"): the Locker's PRESETS tab. Tap a card to wear it (an empty one starts from what you wear), what you
// EQUIP while wearing one goes into it, the 3D player shows the keeper kit for a keeper preset, in goal you really wear
// your gloves, names are typed (any letters, kept as typed), up to 20 presets with + NEW PRESET and DELETE, old saves get
// names from their positions, broken saves are repaired, and it fits a phone held either way.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const d0 = await page.evaluate(() => ({ p: EGO.Save.data.presets, w: EGO.Save.data.preset }));
  check('a new save has four empty presets named STRIKER, KEEPER, MIDFIELD, DEFENDER', d0.p.length === 4 && d0.p.map((p) => p.n).join() === 'STRIKER,KEEPER,MIDFIELD,DEFENDER' && d0.p.map((p) => p.pos).join() === 'ST,GK,MID,DEF' && d0.p.every((p) => p.s === null) && d0.w === -1, d0);
  // own everything, so we can dress up
  await page.evaluate(() => { const d = EGO.Save.data; EGO.unlockAll(d); d.style = 'ROOKIE'; d.flow = null; d.look.gloves = 'NO_GLOVES'; EGO.Save.save(); });
  const glove = await page.evaluate(() => 'AWAKE_GLOVES');
  const boots = await page.evaluate(() => Object.keys(EGO.SKINS).find((k) => EGO.SKINS[k].slot === 'boots' && !EGO.SKINS[k].base));
  await page.click('#go-locker'); await sleep(300);
  await page.click('#ltab-preset'); await sleep(300);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#scr-locker .lcard')].map((c) => c.dataset.id + ':' + c.querySelector('.nm').textContent + ':' + c.querySelector('.meta').textContent));
  check('the tab shows the four presets and a + NEW PRESET card', cards.length === 5 && /STRIKER/.test(cards[0]) && /KEEPER/.test(cards[1]) && /^PNEW:\+ NEW PRESET:4\/20/.test(cards[4]), cards);
  // tap STRIKER: it starts from what you wear and you wear it
  await page.click('#scr-locker .lcard[data-id="P0"]'); await sleep(300);
  const s1 = await page.evaluate(() => ({ s: EGO.Save.data.presets[0].s, w: EGO.Save.data.preset, pos: EGO.Save.data.pos, label: document.querySelector('#scr-locker .lcard[data-id="P0"] .meta .label').textContent }));
  check('tapping an empty preset starts it from your look and you wear it', s1.s && s1.s.style === 'ROOKIE' && s1.w === 0 && s1.pos === 'ST' && s1.label === 'WEARING', s1);
  // while wearing STRIKER, equip boots: they go into STRIKER by themselves
  await page.click('#ltab-skin'); await sleep(200); await page.click('#lk-slots [data-slot="boots"]'); await sleep(200);
  await page.click(`#scr-locker .lcard[data-id="${boots}"]`); await sleep(200); await page.click('#lk-equip'); await sleep(200);
  check('what you EQUIP while wearing a preset goes into it', await page.evaluate((b) => EGO.Save.data.presets[0].s.look.boots === b, boots));
  // tap KEEPER, then dress it as a keeper in the other tabs
  await page.click('#ltab-preset'); await sleep(300);
  check('the tab opens on the preset you wear', await page.evaluate(() => document.querySelector('#scr-locker .lcard[aria-pressed="true"]').dataset.id === 'P0'));
  await page.click('#scr-locker .lcard[data-id="P1"]'); await sleep(300);
  await page.click('#pre-edit'); await sleep(300);
  check('CHANGE THE LOOK jumps to the SKINS tab', await page.evaluate(() => EGO.UI.lockerTab === 'skin'));
  await page.click('#ltab-style'); await sleep(200);
  await page.click('#scr-locker .lcard[data-id="FORTRESS"]'); await sleep(200); await page.click('#lk-equip'); await sleep(200);
  await page.click('#ltab-skin'); await sleep(200); await page.click('#lk-slots [data-slot="gloves"]'); await sleep(200);
  await page.click(`#scr-locker .lcard[data-id="${glove}"]`); await sleep(200); await page.click('#lk-equip'); await sleep(200);
  const s2 = await page.evaluate(() => ({ k: EGO.Save.data.presets[1].s, st: EGO.Save.data.presets[0].s }));
  check('the KEEPER preset keeps its own style and gloves, STRIKER is untouched', s2.k.style === 'FORTRESS' && s2.k.look.gloves === 'AWAKE_GLOVES' && s2.st.style === 'ROOKIE' && s2.st.look.gloves === 'NO_GLOVES', { k: s2.k.style + '/' + s2.k.look.gloves, st: s2.st.style + '/' + s2.st.look.gloves });
  // switching: the look really changes, on the save and on the 3D player (keeper kit for the keeper)
  await page.click('#ltab-preset'); await sleep(300);
  const keeperView = await page.evaluate(() => ({ gk: EGO.Showcase.p.isGK, key: EGO.Showcase.key }));
  await page.screenshot({ path: __dirname + '/shots/preset1_keeper.png' });
  await page.click('#scr-locker .lcard[data-id="P0"]'); await sleep(400);
  const strikerView = await page.evaluate(() => ({ gk: EGO.Showcase.p.isGK, key: EGO.Showcase.key, style: EGO.Save.data.style, gloves: EGO.Save.data.look.gloves, boots: EGO.Save.data.look.boots, pos: EGO.Save.data.pos }));
  await page.screenshot({ path: __dirname + '/shots/preset2_striker.png' });
  check('tapping STRIKER changes the look back: style, gloves, boots, position', strikerView.style === 'ROOKIE' && strikerView.gloves === 'NO_GLOVES' && strikerView.boots === boots && strikerView.pos === 'ST', strikerView);
  check('the 3D player changes too: keeper kit for KEEPER, outfield kit for STRIKER', keeperView.gk === true && strikerView.gk === false && keeperView.key !== strikerView.key, { keeper: keeperView.gk, striker: strikerView.gk });
  // in goal you really wear your gloves (they used to be painted plain white)
  await page.click('#scr-locker .lcard[data-id="P1"]'); await sleep(300);
  await page.evaluate(() => { EGO.Game.introTest = false; EGO.Game.startMatch('quick'); EGO.Game.stepManual(5); });
  const m = await page.evaluate(() => {
    const h = EGO.Game.match.human, c = h.skinTex.image, px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let glove = 0, white = 0; for (let i = 0; i < px.length; i += 4) { if (Math.abs(px[i] - 201) < 8 && Math.abs(px[i + 1] - 184) < 8 && Math.abs(px[i + 2] - 255) < 8) glove++; if (px[i] === 242 && px[i + 1] === 242 && px[i + 2] === 234) white++; }
    return { role: h.role, gk: h.isGK, gloves: h.look.gloves, glovePx: glove, whitePx: white };
  });
  check('with the KEEPER preset you start in goal', m.role === 'GK' && m.gk, m);
  check('in goal your gloves are painted in their colour, not plain white', m.gloves === '#c9b8ff' && m.glovePx > 0 && m.whitePx === 0, m);
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Game.manual = false; }); // stepManual stops the real drawing loop; turn it back on for the screenshots
  await sleep(300);
  // typing a name: any letters, kept as typed, the card follows as you type
  await page.click('#go-locker'); await sleep(300); await page.click('#ltab-preset'); await sleep(300);
  await page.fill('#pre-name', 'My Goalie 1!'); await sleep(150);
  const live = await page.evaluate(() => ({ card: document.querySelector('#scr-locker .lcard[data-id="P1"] .nm').textContent, cap: document.querySelector('#lk-cap b').textContent, n: EGO.Save.data.presets[1].n }));
  check('typing a name updates the card and the caption as you type, as typed', live.card === 'My Goalie 1!' && live.cap === 'My Goalie 1!' && live.n === 'My Goalie 1!', live);
  await page.press('#pre-name', 'End'); await page.type('#pre-name', ' wasd'); await page.press('#pre-name', 'Escape'); await sleep(150);
  check('typing W A S D and ESC in the name box types, it does not leave the Locker', await page.evaluate(() => EGO.UI.cur === 'locker' && EGO.Save.data.presets[1].n === 'My Goalie 1! wasd'), await page.evaluate(() => [EGO.UI.cur, EGO.Save.data.presets[1].n]));
  await page.fill('#pre-name', '<b>Hi</b> this name is far too long'); await page.press('#pre-name', 'Enter'); await sleep(200);
  const n2 = await page.evaluate(() => EGO.Save.data.presets[1].n);
  check('names are kept to 18 letters and lose < and >', n2.length <= 18 && !/[<>]/.test(n2), n2);
  await page.fill('#pre-name', '   '); await page.press('#pre-name', 'Enter'); await sleep(200);
  check('an empty name becomes PRESET 2', await page.evaluate(() => EGO.Save.data.presets[1].n === 'PRESET 2'));
  // + NEW PRESET up to 20
  for (let k = 0; k < 16; k++) { await page.click('#scr-locker .lcard[data-id="PNEW"]'); await sleep(120); }
  const many = await page.evaluate(() => ({ n: EGO.Save.data.presets.length, w: EGO.Save.data.preset, last: EGO.Save.data.presets[19], plus: !!document.querySelector('#scr-locker .lcard[data-id="PNEW"]') }));
  check('+ NEW PRESET adds presets you wear at once, up to 20, then the card goes', many.n === 20 && many.w === 19 && many.last.n === 'PRESET 20' && many.last.s && !many.plus, { n: many.n, w: many.w, plus: many.plus });
  // DELETE asks once more first
  await page.click('#scr-locker .lcard[data-id="P3"]'); await sleep(250);
  await page.click('#pre-del'); await sleep(150);
  const armed = await page.evaluate(() => ({ n: EGO.Save.data.presets.length, t: document.getElementById('pre-del').textContent }));
  await page.click('#pre-del'); await sleep(250);
  const del = await page.evaluate(() => ({ n: EGO.Save.data.presets.length, names: EGO.Save.data.presets.slice(0, 4).map((p) => p.n), plus: !!document.querySelector('#scr-locker .lcard[data-id="PNEW"]') }));
  check('DELETE asks SURE? first, then removes it, and + NEW PRESET comes back', armed.n === 20 && /SURE/.test(armed.t) && del.n === 19 && del.names[3] === 'PRESET 5' && del.plus, { armed, del });
  // a preset with a style you lost: the rest goes on, the style stays, a note says why
  await page.evaluate(() => { const d = EGO.Save.data; d.presets[2].s = { style: 'COMET', flow: null, tone: 3, look: Object.assign({}, d.look) }; d.styles = d.styles.filter((s) => s !== 'COMET'); d.spunStyle = null; d.style = 'ROOKIE'; EGO.Save.save(); });
  await page.click('#ltab-style'); await sleep(150); await page.click('#ltab-preset'); await sleep(250);
  await page.click('#scr-locker .lcard[data-id="P2"]'); await sleep(300);
  const lost = await page.evaluate(() => ({ style: EGO.Save.data.style, tone: EGO.Save.data.tone, pos: EGO.Save.data.pos, warn: (document.querySelector('.pre-warn') || {}).textContent || '' }));
  check('a style you no longer own is skipped with a note, the rest goes on', lost.style === 'ROOKIE' && lost.tone === 3 && lost.pos === 'MID' && /COMET/.test(lost.warn), lost);
  // layouts with 19 presets: phone upright and sideways, laptop
  for (const [w, h, name] of [[390, 844, 'upright'], [844, 390, 'sideways'], [1280, 720, 'laptop']]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(400);
    const lay = await page.evaluate(() => {
      const box = document.getElementById('pre-name'); box.scrollIntoView({ block: 'nearest' });
      const r = box.getBoundingClientRect(), tabs = document.getElementById('ltab-preset').getBoundingClientRect();
      return { wide: document.documentElement.scrollWidth <= innerWidth + 1, box: r.width > 60 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0, tab: tabs.right <= innerWidth + 1 && tabs.width > 0 };
    });
    check('the PRESETS tab fits a ' + name + ' screen', lay.wide && lay.box && lay.tab, lay);
    await page.screenshot({ path: __dirname + '/shots/preset3_' + name + '.png' });
  }
  // saves: from before names, broken, too many, bad values
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem(EGO.Save.key)); d.presets = [{ pos: 'GK', s: null }, { pos: null, s: null }]; delete d.preset; localStorage.setItem(EGO.Save.key, JSON.stringify(d)); });
  await page.reload(); await sleep(2500);
  check('presets from before names are named after their position', await page.evaluate(() => EGO.Save.data.presets.map((p) => p.n).join() === 'KEEPER,PRESET 2' && EGO.Save.data.preset === -1), await page.evaluate(() => EGO.Save.data.presets.map((p) => p.n)));
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem(EGO.Save.key)); d.presets = 'junk'; d.preset = 7; localStorage.setItem(EGO.Save.key, JSON.stringify(d)); });
  await page.reload(); await sleep(2500);
  check('a broken presets value gives the four starters back', await page.evaluate(() => EGO.Save.data.presets.length === 4 && EGO.Save.data.presets[1].n === 'KEEPER' && EGO.Save.data.presets.every((p) => p.s === null) && EGO.Save.data.preset === -1));
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem(EGO.Save.key)); d.presets = Array.from({ length: 25 }, (x, i) => ({ n: 'P' + i, pos: 'XX', s: { style: 'NOPE', flow: 'NOPE', tone: 99, look: { kit: 'NOPE', hair: 5 } } })); d.preset = 3; localStorage.setItem(EGO.Save.key, JSON.stringify(d)); });
  await page.reload(); await sleep(2500);
  const fixed = await page.evaluate(() => ({ n: EGO.Save.data.presets.length, p0: EGO.Save.data.presets[0], w: EGO.Save.data.preset }));
  check('too many presets are cut to 20 and bad values are repaired', fixed.n === 20 && fixed.p0.n === 'P0' && fixed.p0.pos === 'ST' && fixed.p0.s.style === 'ROOKIE' && fixed.p0.s.flow === null && fixed.p0.s.tone === 7 && fixed.p0.s.look.kit === 'TEAM_KIT' && fixed.w === 3, fixed);
  const errs = logs.filter((l) => !/willReadFrequently/.test(l)); // the glove check reads pixels back, Chrome mentions it
  check('no errors', errs.length === 0, errs.slice(0, 5));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(1); });
