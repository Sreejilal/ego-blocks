// Presets (owner, Nov 2026: "1 preset its like striker then goalie"): the Locker's PRESETS tab keeps four outfits
// (style, Flow, skin colour, every skin) with a position each. SAVE MY LOOK HERE keeps what you wear, USE puts it all
// back on, your next match starts in that preset's position, things you no longer own are skipped with a note,
// and a broken save gets four empty presets. Also checks the tab fits a phone held either way.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const d0 = await page.evaluate(() => EGO.Save.data.presets);
  check('a new save has four empty presets: striker, keeper, midfield, defender', d0.length === 4 && d0.map((p) => p.pos).join() === 'ST,GK,MID,DEF' && d0.every((p) => p.s === null), d0);
  // own everything, so we can dress up
  await page.evaluate(() => { const d = EGO.Save.data; EGO.unlockAll(d); d.style = 'ROOKIE'; d.flow = null; d.look.gloves = 'NO_GLOVES'; EGO.Save.save(); });
  await page.click('#go-locker'); await sleep(300);
  await page.click('#ltab-preset'); await sleep(300);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#scr-locker .lcard')].map((c) => c.dataset.id + ':' + c.querySelector('.nm').textContent + ':' + c.querySelector('.meta .label').textContent));
  check('the PRESETS tab shows the four presets', cards.length === 4 && /STRIKER/.test(cards[0]) && /KEEPER/.test(cards[1]) && cards.every((c) => /NOT SAVED/.test(c)), cards);
  check('an empty preset asks you to save first', await page.evaluate(() => /SAVE YOUR LOOK HERE FIRST/.test(document.getElementById('lk-cap').textContent) && !!document.getElementById('pre-save')));
  await page.screenshot({ path: __dirname + '/shots/preset1_empty.png' });
  // 1: the striker look
  await page.click('#pre-save'); await sleep(300);
  const p1 = await page.evaluate(() => ({ s: EGO.Save.data.presets[0].s, pos: EGO.Save.data.pos, wear: EGO.UI.presetOn(0), cap: document.getElementById('lk-cap').textContent }));
  check('SAVE MY LOOK HERE keeps your style and skins, and you are wearing it', p1.s && p1.s.style === 'ROOKIE' && p1.s.look.gloves === 'NO_GLOVES' && p1.pos === 'ST' && p1.wear && /WEARING/.test(p1.cap), p1);
  // 2: dress as a keeper in the other tabs, then save it in preset 2
  await page.click('#ltab-style'); await sleep(200);
  await page.click('#scr-locker .lcard[data-id="FORTRESS"]'); await sleep(200); await page.click('#lk-equip'); await sleep(200);
  const glove = await page.evaluate(() => Object.keys(EGO.SKINS).find((k) => EGO.SKINS[k].slot === 'gloves' && !EGO.SKINS[k].base));
  await page.click('#ltab-skin'); await sleep(200); await page.click('#lk-slots [data-slot="gloves"]'); await sleep(200);
  await page.click(`#scr-locker .lcard[data-id="${glove}"]`); await sleep(200); await page.click('#lk-equip'); await sleep(200);
  await page.click('#ltab-preset'); await sleep(300);
  check('the tab opens on the first preset when you wear none of them', await page.evaluate(() => document.querySelector('#scr-locker .lcard[aria-pressed="true"]').dataset.id === 'P0'));
  await page.click('#scr-locker .lcard[data-id="P1"]'); await sleep(300);
  await page.click('#pre-save'); await sleep(300);
  const p2 = await page.evaluate(() => ({ s: EGO.Save.data.presets[1].s, pos: EGO.Save.data.pos }));
  check('preset 2 keeps the keeper style, the gloves and the keeper position', p2.s.style === 'FORTRESS' && p2.s.look.gloves === glove && p2.pos === 'GK', p2);
  await page.screenshot({ path: __dirname + '/shots/preset2_keeper.png' });
  // clicking a preset tries it on the 3D player before you USE it
  await page.click('#scr-locker .lcard[data-id="P0"]'); await sleep(400);
  const tried = await page.evaluate(() => ({ key: EGO.Showcase.key, style: EGO.Save.data.style }));
  check('clicking a preset shows it on your player before you use it', /^ROOKIE\|/.test(tried.key) && tried.style === 'FORTRESS', tried);
  // USE the striker preset
  await page.click('#lk-equip'); await sleep(300);
  const used = await page.evaluate(() => ({ style: EGO.Save.data.style, gloves: EGO.Save.data.look.gloves, pos: EGO.Save.data.pos, wear: EGO.UI.presetOn(0), saved: JSON.parse(localStorage.getItem(EGO.Save.key)).style }));
  check('USE puts the whole striker preset back on and saves it', used.style === 'ROOKIE' && used.gloves === 'NO_GLOVES' && used.pos === 'ST' && used.wear && used.saved === 'ROOKIE', used);
  // the position buttons
  await page.click('#pre-pos [data-ppos="MID"]'); await sleep(200);
  check('changing the position of the preset you wear changes your next match too', await page.evaluate(() => EGO.Save.data.presets[0].pos === 'MID' && EGO.Save.data.pos === 'MID' && /MIDFIELD/.test(document.querySelector('#scr-locker .lcard[data-id="P0"] .nm').textContent)));
  await page.click('#pre-pos [data-ppos="ST"]'); await sleep(200);
  // USE the keeper preset, then a match starts you in goal in the keeper style
  await page.click('#scr-locker .lcard[data-id="P1"]'); await sleep(300); await page.click('#lk-equip'); await sleep(300);
  await page.evaluate(() => { EGO.Game.introTest = false; EGO.Game.startMatch('quick'); EGO.Game.stepManual(5); });
  const m = await page.evaluate(() => { const h = EGO.Game.match.human; return { role: h.role, gk: h.isGK, style: h.styleId || h.style, gloves: h.look && h.look.gloves }; });
  check('with the keeper preset on, the match starts you in goal', m.role === 'GK' && m.gk, m);
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Game.manual = false; }); // stepManual stops the real drawing loop; turn it back on so the screenshots show the menus as players see them
  await sleep(300);
  // a preset with a style you lost: the rest goes on, the style stays, a note says why
  await page.evaluate(() => { const d = EGO.Save.data; d.presets[2].s = { style: 'COMET', flow: null, tone: 3, look: Object.assign({}, d.look) }; d.styles = d.styles.filter((s) => s !== 'COMET'); d.spunStyle = null; d.style = 'ROOKIE'; EGO.Save.save(); });
  await page.click('#go-locker'); await sleep(300); await page.click('#ltab-preset'); await sleep(300);
  await page.click('#scr-locker .lcard[data-id="P2"]'); await sleep(300); await page.click('#lk-equip'); await sleep(300);
  const lost = await page.evaluate(() => ({ style: EGO.Save.data.style, tone: EGO.Save.data.tone, pos: EGO.Save.data.pos, warn: (document.querySelector('.pre-warn') || {}).textContent || '' }));
  check('a style you no longer own is skipped with a note, the rest goes on', lost.style === 'ROOKIE' && lost.tone === 3 && lost.pos === 'MID' && /COMET/.test(lost.warn), lost);
  // layouts: phone upright and sideways, no sideways scrolling, the save button reachable
  for (const [w, h, name] of [[390, 844, 'upright'], [844, 390, 'sideways'], [1280, 720, 'laptop']]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(400);
    const lay = await page.evaluate(() => {
      const b = document.getElementById('pre-save'); b.scrollIntoView({ block: 'nearest' });
      const r = b.getBoundingClientRect(), tabs = document.getElementById('ltab-preset').getBoundingClientRect();
      return { wide: document.documentElement.scrollWidth <= innerWidth + 1, btn: r.width > 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0, tab: tabs.right <= innerWidth + 1 && tabs.width > 0 };
    });
    check('the PRESETS tab fits a ' + name + ' screen', lay.wide && lay.btn && lay.tab, lay);
    await page.screenshot({ path: __dirname + '/shots/preset3_' + name + '.png' });
  }
  // a broken save: four empty presets again; bad ids are fixed
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem(EGO.Save.key)); d.presets = 'junk'; localStorage.setItem(EGO.Save.key, JSON.stringify(d)); });
  await page.reload(); await sleep(2500);
  check('a broken presets value gives four empty presets', await page.evaluate(() => EGO.Save.data.presets.length === 4 && EGO.Save.data.presets.every((p) => p.s === null)));
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem(EGO.Save.key)); d.presets = [{ pos: 'XX', s: { style: 'NOPE', flow: 'NOPE', tone: 99, look: { kit: 'NOPE', hair: 5 } } }]; localStorage.setItem(EGO.Save.key, JSON.stringify(d)); });
  await page.reload(); await sleep(2500);
  const fixed = await page.evaluate(() => EGO.Save.data.presets);
  check('bad preset values are repaired', fixed.length === 4 && fixed[0].pos === 'ST' && fixed[0].s.style === 'ROOKIE' && fixed[0].s.flow === null && fixed[0].s.tone === 7 && fixed[0].s.look.kit === 'TEAM_KIT' && fixed[1].s === null, fixed[0]);
  check('no errors', logs.length === 0, logs.slice(0, 5));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(1); });
