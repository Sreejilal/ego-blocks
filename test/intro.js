// The match intro: the camera flies in while both teams wait at kickoff, you pick your position (you swap with the bot who
// had it), PLAY or ENTER or the countdown starts the kickoff, and the next match remembers your position.
// Not on the very first match, the tutorial or free kicks. Tests normally skip it (EGO.Game.introTest turns it on).
// Online the camera flies in too, without the picker (test/random.js).
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const settle = () => page.waitForFunction(() => document.getAnimations().every((a) => !/^in(Drop|Fade)$/.test(a.animationName) || a.playState !== 'running'), null, { timeout: 20000 }).catch(() => {}); // the picker slides in
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  const st = () => page.evaluate(() => { const G = EGO.Game, m = G.match, el = document.getElementById('intro'); return { intro: !!G.intro, shown: !el.hidden, phase: m && m.phase, role: m && m.human && m.human.role, state: G.state, hud: getComputedStyle(document.getElementById('hud')).visibility, live: G.state === 'match' && !G.gate && !G.intro }; });

  check('tests that do not ask for it get no intro', await page.evaluate(() => { EGO.Game.startMatch('quick'); return !EGO.Game.intro && document.getElementById('intro').hidden; }));
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Game.introTest = true; EGO.Save.data.pos = null; });

  await page.click('#go-quick'); await sleep(300);
  const s0 = await st();
  check('PLAY starts the intro: the picker shows, the match HUD is hidden', s0.intro && s0.shown && s0.state === 'match' && s0.hud === 'hidden', s0);
  const roles = await page.evaluate(() => [...document.querySelectorAll('#in-roles .in-role')].map((b) => ({ r: b.dataset.r, on: b.getAttribute('aria-pressed') === 'true', t: b.textContent })));
  check('every spot on your team can be picked (the keeper first), yours is lit', roles.length === 4 && roles[0].r === 'GK' && roles.filter((x) => x.on).length === 1 && roles.find((x) => x.on).r === s0.role, roles);
  const cam0 = await page.evaluate(() => EGO.World.camera.position.toArray().map((v) => +v.toFixed(1)));
  await page.evaluate(() => EGO.Game.stepManual(90));
  await settle(); await shot('intro1_fly');
  const cam1 = await page.evaluate(() => EGO.World.camera.position.toArray().map((v) => +v.toFixed(1)));
  const s1 = await st();
  check('the camera flies while nobody plays (still at kickoff after 1.5s)', s1.phase === 'kickoff' && s1.intro && JSON.stringify(cam0) !== JSON.stringify(cam1) && cam0[1] > 8, { cam0, cam1, phase: s1.phase });
  check('their page is told nothing is being played yet (no gameplay start)', s1.live === false, s1.live);
  await page.keyboard.press('Escape'); await sleep(150);
  check('ESC does not pause the intro', (await st()).state === 'match');

  // pick another position
  const other = roles.find((x) => !x.on && x.r !== 'GK').r; // an outfield spot (in goal has its own test: keeper.js)
  const before = await page.evaluate((r) => { const m = EGO.Game.match; const o = m.teams[0].find((p) => p.role === r); return { botName: o.name }; }, other);
  await settle();
  await page.click(`#in-roles [data-r="${other}"]`); await sleep(150);
  const sw = await page.evaluate((r) => { const m = EGO.Game.match, h = m.human; const bot = m.teams[0].find((p) => p.name === r.botName); return { me: h.role, bot: bot.role, lit: document.querySelector('#in-roles [aria-pressed="true"]').dataset.r, saved: EGO.Save.data.pos }; }, before);
  check('picking a spot swaps you with the bot who had it, and is saved', sw.me === other && sw.bot === s0.role && sw.lit === other && sw.saved === other, sw);
  await page.evaluate(() => EGO.Game.stepManual(200)); // the flight ends; the camera follows you
  await shot('intro2_pick');
  const camEnd = await page.evaluate(() => { const c = EGO.World.camera.position, h = EGO.Game.match.human.pos; return { dz: +(h.z - c.z).toFixed(1), dx: +Math.abs(h.x - c.x).toFixed(1), y: +c.y.toFixed(1) }; });
  check('after the flight the camera sits just behind you', camEnd.dz > 3 && camEnd.dz < 11 && camEnd.dx < 2 && camEnd.y < 6, camEnd);
  // PLAY
  await settle(); await page.click('#in-go'); await sleep(150);
  const s2 = await st();
  check('PLAY ends the intro and shows the match screen', !s2.intro && !s2.shown && s2.hud === 'visible', s2);
  await page.evaluate(() => EGO.Game.stepManual(200));
  const s3 = await st();
  check('the kickoff happens and the match is played in your position', s3.phase === 'play' && s3.role === other && s3.live === true, s3);

  // the next match remembers it; the countdown starts it by itself; keys pick
  await page.evaluate(() => { EGO.Game.toLobby(); }); await sleep(200);
  await page.click('#go-quick'); await sleep(200);
  check('the next match starts you in the position you picked', (await st()).role === other, (await st()).role);
  const first = roles[0].r;
  await page.keyboard.press('Digit1'); await page.evaluate(() => EGO.Game.stepManual(2));
  check('number key 1 picks the first spot', (await st()).role === first, (await st()).role);
  await page.evaluate(() => EGO.Game.stepManual(60 * 11));
  const s4 = await st();
  check('if nobody presses PLAY, the countdown starts the kickoff', !s4.intro && (s4.phase === 'kickoff' || s4.phase === 'play'), s4);
  await page.evaluate(() => { EGO.Game.toLobby(); }); await sleep(150);
  await page.click('#go-quick'); await sleep(200);
  await page.keyboard.press('Enter'); await page.evaluate(() => EGO.Game.stepManual(2));
  check('ENTER plays at once', !(await st()).intro);

  // never on the tutorial, free kicks, or the very first match
  const none = await page.evaluate(() => { const G = EGO.Game, out = {}; for (const m of ['tutorial', 'freekick']) { G.startMatch(m); out[m] = !!G.intro; G.toLobby(); } G.onboard(); out.first = !!G.intro; out.gate = !!G.gate; G.toLobby(); return out; });
  check('no intro on the tutorial, free kicks or the first match ever', !none.tutorial && !none.freekick && !none.first && none.gate, none);
  // 5v5 and the duel: the picker matches the line-up
  const five = await page.evaluate(() => { const G = EGO.Game; G.introTest = true; G.startMatch('duel'); const d = document.querySelectorAll('#in-roles .in-role').length; G.toLobby(); EGO.Save.data.rp = 99999; G.startMatch('ranked'); const r = document.querySelectorAll('#in-roles .in-role').length, size = G.match.size; G.toLobby(); EGO.Save.data.rp = 0; return { duel: d, ranked: r, size }; });
  check('the picker has two spots in a duel and five in 5v5 (the keeper too)', five.duel === 2 && five.ranked === 5 && five.size === 5, five);
  // a phone
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => { EGO.Game.startMatch('quick'); EGO.Game.stepManual(30); });
  await settle(); await shot('intro3_phone');
  const fit = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); const go = r('in-go'), roles = [...document.querySelectorAll('#in-roles .in-role')].map((b) => b.getBoundingClientRect()), top = document.querySelector('.in-top').getBoundingClientRect(); return { goIn: go.bottom <= innerHeight && go.top >= 0, rolesIn: roles.every((b) => b.bottom <= innerHeight && b.right <= innerWidth && b.height >= 36), overlap: top.bottom > document.querySelector('.in-pick').getBoundingClientRect().top }; });
  check('on a phone the picker fits on screen, buttons big enough, the title does not cover it', fit.goIn && fit.rolesIn && !fit.overlap, fit);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
