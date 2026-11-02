// Smooth and bug-free: the small things that made the game feel broken.
// 1. An ability slot shows READY the moment its cooldown ends (it used to stay on "1" with a sliver left).
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

(async () => {
  const { browser, page, logs } = await open({ wait: 1200, viewport: { width: 1280, height: 720 } });
  const slot = await page.evaluate(() => {
    const G = EGO.Game, st = EGO.Save.data.settings; st.cutins = false; st.camPicked = true; st.autoFs = false;
    G.startMatch('quick');
    const m = G.match, h = m.human;
    for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1, false);
    const a = h.abil[0], el = document.getElementById('slot0'), num = el.querySelector('.num');
    const seen = (c) => ({ cd: +a.cd.toFixed(3), ready: el.classList.contains('ready'), num: num.textContent });
    // part way, then a sliver left, then done: the slot must follow every step
    a.cd = a.def.cd * 0.5; G.stepManual(1, false); const mid = seen();
    a.cd = 0.03; G.stepManual(1, false); const sliver = Object.assign(seen(), { left: a.cd > 0 });
    for (let i = 0; i < 30 && a.cd > 0; i++) G.stepManual(1, false);
    G.stepManual(1, false); const done = seen();
    G.forfeit();
    return { mid, sliver, done };
  });
  check('an ability slot counts down, then shows READY as soon as you can use it', !slot.mid.ready && slot.mid.num !== '' && slot.done.cd === 0 && slot.done.ready && slot.done.num === '', slot);

  check('no page errors', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 6));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
