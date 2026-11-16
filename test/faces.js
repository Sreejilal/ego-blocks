// Faces: a FACE slot in the Locker with 12 free faces. Picking one shows it on your player at once, EQUIP keeps it,
// it is drawn on the pitch, bots get mixed faces, and an old save without a face gets the calm one.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const d0 = await page.evaluate(() => ({ face: EGO.Save.data.look.face, slots: EGO.SKIN_SLOTS.map((s) => s.id) }));
  check('a new save starts with the calm face', d0.face === 'FACE_CALM' && d0.slots.includes('face'), d0);
  await page.click('#go-locker'); await sleep(300);
  await page.click('#ltab-skin'); await sleep(200);
  await page.click('#lk-slots [data-slot="face"]'); await sleep(300);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#scr-locker .lcard')].map((c) => ({ id: c.dataset.id, locked: c.classList.contains('locked') })));
  check('the FACE slot shows 12 faces, none locked', cards.length === 12 && cards.every((c) => /^FACE_/.test(c.id) && !c.locked), cards.map((c) => c.id));
  await page.screenshot({ path: __dirname + '/shots/face1_locker.png' });
  // every card's picture is different
  const pics = await page.evaluate(() => [...document.querySelectorAll('#scr-locker .lcard canvas')].map((c) => c.toDataURL().length + ':' + c.toDataURL().slice(-60)));
  check('every face card has its own picture', new Set(pics).size === 12, new Set(pics).size);
  await page.click('#scr-locker .lcard[data-id="FACE_GRIN"]'); await sleep(300);
  const tried = await page.evaluate(() => ({ show: EGO.Showcase.p && EGO.Showcase.p.look.face, saved: EGO.Save.data.look.face, cap: document.getElementById('lk-cap').textContent }));
  check('clicking a face shows it on your player before you equip', tried.show === 'grin' && tried.saved === 'FACE_CALM', tried);
  await page.screenshot({ path: __dirname + '/shots/face2_grin.png' });
  await page.click('#lk-equip'); await sleep(200);
  check('EQUIP keeps it', await page.evaluate(() => EGO.Save.data.look.face === 'FACE_GRIN' && JSON.parse(localStorage.getItem(EGO.Save.key)).look.face === 'FACE_GRIN'));
  // on the pitch: you wear it, bots have a mix
  await page.evaluate(() => { EGO.Game.startMatch('ranked'); EGO.Game.stepManual(5); });
  const m = await page.evaluate(() => { const M = EGO.Game.match; return { me: M.human.look.face, bots: M.players.filter((p) => !p.isHuman).map((p) => p.look.face) }; });
  check('you wear your face in a match', m.me === 'grin', m.me);
  check('bots have faces too', m.bots.every((f) => typeof f === 'string' && f.length > 2), m.bots);
  // the texture really changes with the face (compare the face area of two players' skins)
  const tex = await page.evaluate(() => {
    const M = EGO.Game.match, cut = (p) => { const c = p.skinTex.image; return Array.from(c.getContext('2d').getImageData(8, 10, 8, 6).data).join(','); };
    const byFace = {}; for (const p of M.players) byFace[p.look.face] = cut(p);
    // same skin tone would make two calm faces equal, two different faces must differ
    const me = cut(M.human); let other = null; for (const p of M.players) if (p.look.face !== 'grin') { other = cut(p); break; }
    return { kinds: Object.keys(byFace).length, differs: other !== null && other !== me };
  });
  check('a different face is really drawn on the head', tex.differs, tex);
  await page.evaluate(() => { EGO.Game.stepManual(200, true); });
  await page.screenshot({ path: __dirname + '/shots/face3_match.png' });
  // an old save without a face
  await page.evaluate(() => { EGO.Game.toLobby(); const d = JSON.parse(localStorage.getItem(EGO.Save.key)); delete d.look.face; localStorage.setItem(EGO.Save.key, JSON.stringify(d)); sessionStorage.setItem('kept', '1'); });
  await page.reload(); await sleep(2500);
  check('an old save without a face gets the calm one', await page.evaluate(() => EGO.Save.data.look.face === 'FACE_CALM'));
  const errs = logs.filter((l) => !/willReadFrequently/.test(l)); // this test reads pixels back, Chrome mentions it
  check('no errors', errs.length === 0, errs.slice(0, 5));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(1); });
