// Controller in the menus: a pretend controller walks the start screen, the other screens and the pause menu.
// The D-pad moves a gold box, A presses, B goes back, and every button on a screen can be reached from the first one.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000, init: () => {
    // a pretend controller the test can press
    window.__pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
  } });
  const B = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const step = (n) => page.evaluate((n) => EGO.Game.stepManual(n), n);
  const tap = async (b) => { await page.evaluate((b) => { __pad.buttons[b] = { pressed: true, value: 1 }; }, b); await step(2); await page.evaluate((b) => { __pad.buttons[b] = { pressed: false, value: 0 }; }, b); await step(2); };
  const cur = () => page.evaluate(() => { const e = EGO.PadNav.cur; return e ? (e.id || e.textContent.trim().slice(0, 24)) : null; });
  // from the first box, can the D-pad reach every control on this screen? (walks every direction from every box)
  const reach = () => page.evaluate(() => {
    const N = EGO.PadNav, L = N.list().map((c) => c.el), name = (e) => e.id || e.textContent.trim().slice(0, 24) || e.tagName;
    if (!L.length) return { n: 0, missed: [] };
    const seen = new Set(), todo = [N.first(N.list())];
    while (todo.length) {
      const el = todo.pop(); if (!el || seen.has(el)) continue; seen.add(el);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (dx && el.tagName === 'INPUT' && el.type === 'range') continue;
        N.focus(el); const top = N.scroller(el) ? N.scroller(el).scrollTop : 0; N.move(dx, dy);
        if (N.cur && !seen.has(N.cur)) todo.push(N.cur);
        else if (N.cur === el && N.scroller(el) && N.scroller(el).scrollTop !== top) { N.move(dx, dy); if (N.cur && !seen.has(N.cur)) todo.push(N.cur); }
      }
    }
    const now = N.list().map((c) => c.el);
    N.clear();
    return { n: L.length, missed: now.filter((e) => !seen.has(e)).map(name) };
  });

  await step(5);
  check('no gold box before the controller is touched', await page.evaluate(() => !document.body.classList.contains('padnav')));
  await tap(B.DOWN);
  check('the first press puts the box on PLAY', (await cur()) === 'go-quick' && await page.evaluate(() => document.body.classList.contains('padnav') && document.getElementById('go-quick').classList.contains('padfocus')), await cur());
  await tap(B.DOWN); const c2 = await cur();
  check('down moves the box to the row below', c2 === 'go-ranked' || c2 === 'go-online', c2);
  await tap(B.RIGHT); const c3 = await cur();
  check('right moves along the row', c3 !== c2 && c3 !== 'go-quick', c3);
  await page.evaluate(() => EGO.PadNav.focus(document.getElementById('go-ranked')));
  await tap(B.UP);
  check('up goes back to PLAY', (await cur()) === 'go-quick', await cur());
  let r = await reach(); check('start screen: every button can be reached', r.n > 8 && r.missed.length === 0, r);

  // each screen: open it with the box and A, check reach, B comes back
  for (const [btn, scr] of [['go-locker', 'scr-locker'], ['go-spins', 'scr-spins'], ['go-howto', 'scr-howto'], ['go-profile', 'scr-profile'], ['go-online', 'scr-online'], ['go-pass', 'scr-pass'], ['go-modes', 'scr-modes'], ['go-goals', 'scr-goals'], ['go-daily', 'scr-daily']]) {
    const has = await page.evaluate((b) => { const e = document.getElementById(b); if (!e || !EGO.PadNav.list().some((c) => c.el === e)) return false; EGO.PadNav.focus(e); return true; }, btn);
    if (!has) { check(btn + ' is on the start screen', false); continue; }
    await tap(B.A); await step(20);
    const opened = await page.evaluate((s) => { const e = document.getElementById(s); return !!e && !e.hidden; }, scr);
    r = await reach();
    check(scr + ': A opens it and every button can be reached', opened && r.n > 0 && r.missed.length === 0, { opened, n: r.n, missed: r.missed });
    await tap(B.B); await step(20);
    const back = await page.evaluate((s) => document.getElementById(s).hidden && !document.getElementById('scr-lobby').hidden, scr);
    check(scr + ': B goes back to the start screen', back);
    if (!back) await page.evaluate(() => { document.querySelectorAll('.overlay').forEach((o) => { o.hidden = true; }); EGO.UI.show('lobby'); });
  }

  // into a match with A, the box is gone while playing, START pauses, the box works in the pause menu, B resumes
  await page.evaluate(() => EGO.PadNav.focus(document.getElementById('go-quick')));
  await tap(B.A); await step(30);
  check('A on PLAY starts a match', await page.evaluate(() => EGO.Game.state === 'match'));
  await tap(B.DOWN);
  check('no box while playing', await page.evaluate(() => !document.body.classList.contains('padnav') && !EGO.PadNav.cur));
  await step(300);
  await tap(B.START); await step(10);
  check('START pauses', await page.evaluate(() => EGO.Game.state === 'paused'));
  await tap(B.DOWN);
  check('the box shows in the pause menu', !!(await cur()), await cur());
  r = await reach(); check('pause menu: every button can be reached', r.n > 10 && r.missed.length === 0, r);
  const q0 = await page.evaluate(() => EGO.Save.data.settings.sens);
  await page.evaluate(() => EGO.PadNav.focus(document.getElementById('set-sens')));
  await tap(B.RIGHT);
  const q1 = await page.evaluate(() => EGO.Save.data.settings.sens);
  check('left and right change a slider', q1 > q0, { q0, q1 });
  await page.waitForTimeout(400);
  await tap(B.B); await step(5);
  check('B closes the pause menu', await page.evaluate(() => EGO.Game.state === 'match'));
  // the results screen: A on the blue button plays again
  await page.evaluate(() => { const m = EGO.Game.match; m.score = [2, 0]; m.endMatch(); EGO.Game.stepManual(260); });
  await tap(B.DOWN);
  r = await reach(); check('results: every button can be reached', r.n >= 2 && r.missed.length === 0, r);
  // the match intro: the box starts on PLAY, up reaches the positions, A picks one, then PLAY starts the kickoff
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Game.introTest = true; EGO.Save.data.pos = null; EGO.Game.startMatch('quick'); });
  await step(5);
  await tap(B.DOWN);
  const in0 = await cur();
  await tap(B.UP); const in1 = await page.evaluate(() => EGO.PadNav.cur && EGO.PadNav.cur.dataset.r);
  const was = await page.evaluate(() => EGO.Game.match.human.role);
  if (in1 === was) { await tap(B.LEFT); }
  const pickR = await page.evaluate(() => EGO.PadNav.cur && EGO.PadNav.cur.dataset.r);
  await tap(B.A);
  const now = await page.evaluate(() => EGO.Game.match.human.role);
  check('the intro: the box starts on PLAY, up reaches the positions and A picks one', /^in-go$|^PLAY/.test(in0 || '') && !!in1 && now === pickR && now !== was, { in0, in1, was, pickR, now });
  await tap(B.DOWN); await tap(B.A);
  check('then PLAY with A starts the match', await page.evaluate(() => !EGO.Game.intro && EGO.Game.state === 'match'));
  await page.evaluate(() => { EGO.Game.introTest = false; EGO.Game.toLobby(); });
  check('no errors', logs.length === 0, logs.slice(0, 5));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error(e); console.log(results.join('\n')); process.exit(1); });
