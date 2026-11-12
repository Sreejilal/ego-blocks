// Smooth and bug-free: the small things that made the game feel broken.
// 1. An ability slot shows READY the moment its cooldown ends (it used to stay on "1" with a sliver left).
// 2. Spin prices: styles 200, Flows 150, skins 100.
// 3. A ball kicked into the crowd lands on the steps or bounces off them; it never flies through the stands.
// 4. Auto graphics steps down when frames get dropped (stutter), pixels first with no shader rebuild; smooth 60 or 144 fps is left alone.
// 5. PASS let go while knocked over (or during a restart) is not stuck down: no endless LOB bar, the next pass is normal.
// 6. The game on GitHub Pages plays online on the server built into the page (Render); a page the server sends uses that server.
// 7. The sky: a bright day by default, SUNSET in the pause menu brings back the evening look; it is saved and bad saves are fixed.
// 8. Stamina matters: about 6s of sprint, then you are out of breath (no sprint, a slower jog, the stamina bar flashes) until it is a third back.
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
    const b = G.match.ball, bad = [], rest = [], P = EGO.PITCH;
    let n = 0;
    // 120 kicks: every direction, low and high, slow and fast, from near the boards
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * Math.PI * 2, sp = 14 + (i % 5) * 7, up = [2, 6, 10, 15][i % 4];
      b.reset(Math.sin(a) * (P.W - 1), Math.cos(a) * (P.L - 2)); // near the touchlines and goal lines
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
    // 400 more: dropped or rolled onto the steps from anywhere in the stands, at random speeds (balls bouncing at the fronts of steps)
    let seed = 99; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 400; i++) {
      const SX = P.BOARD_X + 2, SZ = P.BOARD_Z + 3; // where the stands start
      const side = rnd() < 0.5, s1 = rnd() < 0.5 ? -1 : 1, x = side ? s1 * (SX + 0.1 + rnd() * 11) : (rnd() - 0.5) * SX * 2, z = side ? (rnd() - 0.5) * (P.BOARD_Z + 0.5) * 2 : s1 * (SZ + 0.1 + rnd() * 11);
      b.reset(x, z, EGO.standTop(x, z) + 0.31 + rnd() * 3);
      b.vel.set((rnd() - 0.5) * 30, (rnd() - 0.6) * 12, (rnd() - 0.5) * 30);
      for (let f = 0; f < 240; f++) {
        b.update(1 / 60);
        if (b.pos.y - 0.3 < EGO.standTop(b.pos.x, b.pos.z) - 0.05) { bad.push({ drop: i, pos: [b.pos.x, b.pos.y, b.pos.z].map((v) => +v.toFixed(2)) }); break; }
      }
      n++;
    }
    G.forfeit();
    return { kicks: n, through: bad.slice(0, 4), throughN: bad.length, inCrowd: rest.length };
  });
  check('a ball in the crowd stays on top of the stands, never inside them', stands.throughN === 0 && stands.inCrowd > 30, stands);

  const auto = await page.evaluate(() => {
    const G = EGO.Game, W = EGO.World, d = EGO.Save.data; d.settings.quality = 'auto';
    G.startMatch('quick'); G.autoStep = 0; G.applyQuality(); G.matchReady();
    const pr0 = W.renderer.getPixelRatio(), mat = G.match.ball.mesh.material, v0 = mat.version;
    const run = (pattern, secs) => { let t = 0, i = 0; while (t < secs) { const ms = pattern[i++ % pattern.length]; G.loop(G.last + ms, false); t += ms / 1000; } };
    run([16.7], 7); const smooth60 = G.autoStep;
    G.matchReady(); run([16.7, 16.7, 33.4], 7); const judder = G.autoStep, pr1 = W.renderer.getPixelRatio(), toast = document.getElementById('toasts').textContent, rebuilt = mat.version !== v0;
    G.autoStep = 0; G.applyQuality(); G.matchReady();
    run([6.9, 13.9], 7); const hz144 = G.autoStep;
    G.autoStep = 0; G.applyQuality(); G.matchReady();
    run([16.7, 16.7, 33.4], 30); const worst = { step: G.autoStep, quality: W.quality, shadows: W.renderer.shadowMap.enabled };
    d.settings.quality = 'med'; G.autoStep = 0; G.applyQuality(); G.matchReady();
    run([16.7, 33.4], 8); const manual = { step: G.autoStep, quality: W.quality };
    G.forfeit(); d.settings.quality = 'auto'; G.applyQuality();
    return { pr0, smooth60, judder, pr1, toast: /GRAPHICS LOWERED/.test(toast), rebuilt, hz144, worst, manual };
  });
  check('auto graphics: smooth 60 and 144 fps stay, stutter lowers the pixels first (no shader rebuild), then shadows; a picked setting stays',
    auto.smooth60 === 0 && auto.judder === 1 && Math.abs(auto.pr1 - auto.pr0 * 0.85) < 0.01 && auto.toast && !auto.rebuilt && auto.hz144 === 0 && auto.worst.step === 3 && auto.worst.quality === 'low' && !auto.worst.shadows && auto.manual.step === 0 && auto.manual.quality === 'med', auto);

  const pass = await page.evaluate(() => {
    const G = EGO.Game, I = EGO.Input; G.startMatch('quick'); const m = G.match, h = m.human;
    for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1, false);
    I.edges.add('Mouse2'); I.mouseR = true; G.stepManual(10, false);
    const held = h.passHold > 0;
    m.stun(h, 1.0); G.stepManual(2, false);
    I.mouseR = false; I.up.add('Mouse2'); G.stepManual(2, false); // let go while knocked over: the game is not listening then
    G.stepManual(90, false);
    const r = { held, after: h.passHold, bar: !document.getElementById('charge').hidden };
    G.forfeit(); return r;
  });
  check('PASS let go while knocked over does not stay held (no LOB bar left on screen)', pass.held && pass.after === 0 && !pass.bar, pass);

  const gh = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const G2 = await gh.newPage(); G2.setDefaultTimeout(120000);
  G2.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  const file = require('path').join(__dirname, '..', 'docs', 'index.html');
  await G2.route('https://sreejilal.github.io/**', (r) => r.fulfill({ path: file, contentType: 'text/html' })); // the page as GitHub Pages serves it
  await G2.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await G2.route('https://ego-blocks.onrender.com/**', (r) => r.abort()); // the test stays off the internet
  await G2.goto('https://sreejilal.github.io/ego-blocks/', { timeout: 120000 });
  await G2.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
  const ghMsg = await G2.evaluate(() => { document.getElementById('go-online').click(); document.getElementById('on-create').click(); return { url: EGO.Net.serverUrl(), status: document.getElementById('on-status').textContent }; });
  check('on GitHub Pages PLAY WITH FRIENDS goes to the Render server', ghMsg.url === 'wss://ego-blocks.onrender.com/ws' && !/NOT SWITCHED ON/.test(ghMsg.status), ghMsg);
  await gh.close();
  // the page on the scorz.onrender.com static site (no server there) plays on the built-in server; the server's own page plays on itself
  const hosts = {};
  for (const host of ['scorz.onrender.com', 'ego-blocks.onrender.com']) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const P = await c.newPage(); P.setDefaultTimeout(120000);
    P.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
    await P.route('https://' + host + '/', (r) => r.fulfill({ path: file, contentType: 'text/html' }));
    await P.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await P.goto('https://' + host + '/', { timeout: 120000 });
    await P.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
    hosts[host] = await P.evaluate(() => ({ url: EGO.Net.serverUrl(), served: EGO.Net.servedByServer() }));
    await c.close();
  }
  const S = hosts['scorz.onrender.com'], E = hosts['ego-blocks.onrender.com'];
  check('on scorz.onrender.com (only the page) PLAY WITH FRIENDS goes to the server; the server page uses itself', S.url === 'wss://ego-blocks.onrender.com/ws' && !S.served && E.url === 'wss://ego-blocks.onrender.com/ws' && E.served, hosts);

  const sky = await page.evaluate(() => {
    const W = EGO.World, G = EGO.Game, d = EGO.Save.data;
    const look = () => ({ look: W.look, stars: W.stars.visible, fog: '#' + W.scene.fog.color.clone().convertLinearToSRGB().getHexString(), sunY: +W.sky.material.uniforms.sunDir.value.y.toFixed(2) });
    const first = Object.assign(look(), { setting: d.settings.sky });
    G.startMatch('quick'); G.pause();
    document.querySelector('#set-sky [data-v="sunset"]').click();
    const sunset = Object.assign(look(), { setting: d.settings.sky, pressed: document.querySelector('#set-sky [data-v="sunset"]').getAttribute('aria-pressed') });
    document.querySelector('#set-sky [data-v="day"]').click();
    const back = look();
    G.resume(); G.forfeit();
    localStorage.setItem(EGO.Save.key, JSON.stringify(Object.assign({}, d, { settings: Object.assign({}, d.settings, { sky: 'purple' }) })));
    EGO.Save.load(); const fixed = EGO.Save.data.settings.sky;
    return { first, sunset, back, fixed };
  });
  const stam = await page.evaluate(() => {
    const G = EGO.Game, I = EGO.Input; G.startMatch('quick'); const m = G.match, h = m.human;
    for (let i = 0; i < 400 && m.phase !== 'play'; i++) G.stepManual(1, false);
    EGO.AI.update = ((u) => { window._aiU = u; return () => {}; })(EGO.AI.update); // nobody else moves: just you running
    m.ball.reset(30, 40); h.pos.set(-25, 0, -45); h.stamina = 100; h.exhausted = false;
    const sp = () => Math.hypot(h.vel.x, h.vel.z);
    I.down.add('KeyW'); I.down.add('ShiftLeft'); EGO.Cam.yaw = 0;
    let t = 0, fast = 0; while (!h.exhausted && t < 15) { G.stepManual(1, false); t += 1 / 60; fast = Math.max(fast, sp()); if (h.pos.z > 40) h.pos.z = -45; }
    const empty = +t.toFixed(1);
    G.stepManual(30, false); if (h.pos.z > 40) h.pos.z = -45;
    const tired = { speed: +sp().toFixed(2), flashing: document.getElementById('stamina').classList.contains('tired') };
    let back = 0; while (h.exhausted && back < 15) { G.stepManual(1, false); back += 1 / 60; if (h.pos.z > 40) h.pos.z = -45; }
    G.stepManual(30, false);
    const again = { speed: +sp().toFixed(2), flashing: document.getElementById('stamina').classList.contains('tired') };
    I.down.delete('KeyW'); I.down.delete('ShiftLeft'); EGO.AI.update = window._aiU; G.forfeit();
    return { sprint: +fast.toFixed(2), empty, tired, back: +back.toFixed(1), again };
  });
  check('stamina: about 5s of sprint, then out of breath (slower, the bar flashes) until it comes back, then you sprint again',
    stam.empty > 4.2 && stam.empty < 5.8 && stam.tired.speed < stam.sprint * 0.62 && stam.tired.flashing && stam.back > 3 && stam.back < 8 && !stam.again.flashing && stam.again.speed > stam.sprint * 0.9, stam);

  check('the sky is a bright day; SUNSET in the pause menu switches to the evening and back; a bad save becomes day',
    sky.first.look === 'day' && sky.first.setting === 'day' && !sky.first.stars && sky.first.sunY > 0.5 && sky.sunset.look === 'sunset' && sky.sunset.stars && sky.sunset.sunY < 0.3 && sky.sunset.setting === 'sunset' && sky.sunset.pressed === 'true' && sky.back.look === 'day' && sky.fixed === 'day', sky);
  for (const [w, h] of [[844, 390], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const P = await ctx.newPage(); P.setDefaultTimeout(120000);
    await P.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await P.goto('file://' + require('path').join(__dirname, '..', 'docs', 'index.html')); await P.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
    const lay = await P.evaluate(() => {
      EGO.Save.data.settings.autoFs = false; EGO.Game.startMatch('quick'); EGO.Game.pause();
      const row = document.getElementById('set-sky'); row.scrollIntoView(); const r = row.getBoundingClientRect();
      return { l: Math.round(r.left), r: Math.round(r.right), w: innerWidth, side: document.documentElement.scrollWidth > innerWidth, shown: r.width > 0 && r.height > 0 };
    });
    check('phone ' + w + 'x' + h + ': the Sky setting fits in the pause menu', lay.shown && lay.l >= 0 && lay.r <= lay.w && !lay.side, lay);
    await ctx.close();
  }

  check('no page errors', !logs.some((l) => l.startsWith('PAGEERROR')), logs.slice(0, 6));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
