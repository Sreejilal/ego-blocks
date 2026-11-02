// Smooth and bug-free: the small things that made the game feel broken.
// 1. An ability slot shows READY the moment its cooldown ends (it used to stay on "1" with a sliver left).
// 2. Spin prices: styles 200, Flows 150, skins 100.
// 3. A ball kicked into the crowd lands on the steps or bounces off them; it never flies through the stands.
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

  const spins = await page.evaluate(() => {
    const d = EGO.Save.data, U = EGO.UI, out = {};
    U.openSpins();
    for (const k of ['style', 'flow', 'skin']) { U.spinKind = k; d.emeralds = 1000; U.renderSpins(true); out[k] = { btn: document.getElementById('spin-go').textContent }; }
    U.spinKind = 'flow'; d.emeralds = 140; U.renderSpins(true); out.flowShort = document.getElementById('spin-go').disabled;
    U.spinKind = 'skin'; U.renderSpins(true); out.skinOk = !document.getElementById('spin-go').disabled;
    U.spin(); out.paid = 140 - d.emeralds; // 100, or 50 when it was a duplicate (50 back)
    out.lobby = document.getElementById('go-spins').textContent;
    return out;
  });
  check('spins cost 200 for a style, 150 for a Flow and 100 for a skin', /200 EMERALDS/.test(spins.style.btn) && /150 EMERALDS/.test(spins.flow.btn) && /100 EMERALDS/.test(spins.skin.btn) && spins.flowShort && spins.skinOk && (spins.paid === 100 || spins.paid === 50) && /FROM 100/.test(spins.lobby), spins);

  const stands = await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('quick');
    const b = G.match.ball, bad = [], rest = [];
    let n = 0;
    // 120 kicks: every direction, low and high, slow and fast, from near the boards
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * Math.PI * 2, sp = 14 + (i % 5) * 7, up = [2, 6, 10, 15][i % 4];
      b.reset(Math.sin(a) * 26, Math.cos(a) * 40);
      b.vel.set(Math.sin(a) * sp, up, Math.cos(a) * sp);
      let inside = false, went = false;
      for (let f = 0; f < 360; f++) {
        b.update(1 / 60);
        const top = EGO.standTop(b.pos.x, b.pos.z); if (top > 0) went = true;
        if (b.pos.y - 0.3 < top - 0.05) { inside = true; break; }
      }
      n++;
      if (inside) bad.push({ i, pos: [b.pos.x, b.pos.y, b.pos.z].map((v) => +v.toFixed(1)) });
      else if (went) rest.push(+b.pos.y.toFixed(1));
    }
    G.forfeit();
    return { kicks: n, through: bad.slice(0, 4), throughN: bad.length, inCrowd: rest.length };
  });
  check('a ball in the crowd stays on top of the stands, never inside them', stands.throughN === 0 && stands.inCrowd > 30, stands);

  check('no page errors', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 6));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
