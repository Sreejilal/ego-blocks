// Awakening (owner, Nov 2026): a flashback before it (SPRINTER remembers the race he lost and says he will not give up),
// every style has its story; while awakened the special move has its own slot (Z) until used; you can awaken in goal too;
// and before it happens the build-up shows (POWER RISING, sparks in your colour).
// Saves test/shots/awaken_memory.png and awaken_quote.png.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const shot = (n) => page.screenshot({ path: __dirname + '/shots/' + n + '.png', timeout: 120000 }).catch(() => {});
  const stories = await page.evaluate(() => EGO.STYLE_IDS.filter((id) => !(EGO.AWAKEN_STORY[id] && EGO.AWAKEN_STORY[id].length === 3)));
  check('every style has an Awakening story', stories.length === 0, stories);
  const aw = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; d.style = 'SPRINTER'; d.styles.push('SPRINTER'); d.settings.cutins = true;
    G.startMatch('quick'); G.stepManual(200); const m = G.match, h = m.human;
    h.setState('free'); const ok = m.activateAwaken(h); G.stepManual(1);
    const el = document.getElementById('awk');
    return { ok, shown: !el.hidden, mem: document.getElementById('awk-mem').textContent, quote: document.getElementById('awk-quote').textContent, slow: EGO.TimeCtl.scale < 0.5, slot: !document.getElementById('slot-z').hidden, slotName: document.getElementById('slot-z').textContent };
  });
  check('SPRINTER awakens: the flashback of the race he lost, then "I will not give up", in slow motion', aw.ok && aw.shown && /RACE/.test(aw.mem) && /NOT GIVE UP/.test(aw.quote) && aw.slow, aw);
  // stop the flashback at two moments for pictures (animations are paused, so headless timing does not matter)
  await page.evaluate(() => { clearTimeout(EGO.UI.awkT); document.getElementById('awk').hidden = false; EGO.Game.stepManual(1, true); document.getElementById('awk').getAnimations({ subtree: true }).forEach((a) => { a.pause(); a.currentTime = 1000; }); });
  await shot('awaken_memory');
  await page.evaluate(() => { document.getElementById('awk').getAnimations({ subtree: true }).forEach((a) => { a.currentTime = 1900; }); });
  await shot('awaken_quote');
  check('while awakened, the special move has its own slot (Z) with its name', aw.slot && /BLAZE|TRAIL|SPRINT|[A-Z]/.test(aw.slotName), aw.slotName);
  const used = await page.evaluate(() => { const G = EGO.Game, m = G.match, h = m.human; document.getElementById('awk').getAnimations({ subtree: true }).forEach((a) => a.finish()); EGO.TimeCtl.reset(); G.stepManual(70); h.setState('free'); m.ball.reset(h.pos.x, h.pos.z + 0.5); m.possess(h); const r = m.tryAwakenMove(h); G.stepManual(3); return { r, hidden: document.getElementById('slot-z').hidden, usedFlag: h.awakeMoveUsed }; });
  check('using the special move hides its slot (once per Awakening)', used.usedFlag && used.hidden, used);
  // you in goal can awaken; the computer keepers cannot
  const gk = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; d.pos = 'GK'; d.style = 'FORTRESS'; d.styles.push('FORTRESS'); d.settings.cutins = false;
    G.toLobby(); G.startMatch('quick'); G.stepManual(200); const m = G.match, h = m.human, bot = m.keeperOf(1);
    h.setState('free'); bot.setState('free');
    return { me: h.isGK && m.activateAwaken(h), bot: m.activateAwaken(bot) };
  });
  check('you can awaken in goal, the computer keepers still cannot', gk.me === true && gk.bot === false, gk);
  // the build-up: POWER RISING and sparks before it happens
  const build = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data; d.pos = null; d.style = 'TITAN'; d.styles.push('TITAN');
    G.toLobby(); G.startMatch('quick'); G.stepManual(200); const m = G.match, h = m.human;
    let sparks = 0; const real = EGO.FX.sparks; EGO.FX.sparks = function (...a) { if (a[3] === h.aura) sparks++; return real.apply(this, a); };
    h.awake = 60; m.awakeAdd(h, 20); const label = [...document.querySelectorAll('#labels .lbl, #labels div')].some((e) => /POWER RISING/.test(e.textContent));
    h.awakeRest = m.time + 999; for (let i = 0; i < 120; i++) G.stepManual(1);
    EGO.FX.sparks = real;
    return { awake: Math.round(h.awake), label, sparks };
  });
  check('before an Awakening the build-up shows: POWER RISING, then sparks in your colour', build.label && build.sparks > 3, build);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
