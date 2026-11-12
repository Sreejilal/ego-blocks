// First-match tips (Nov 2026, CrazyGames quality: a clear UI, teach only the core first). While you are new, the match
// screen shows only move, pass and shoot; abilities, FEINT / SLOW-MO and Flow come in the first time they matter, each
// with one short tip and a picture of the key (sprint and tackle get a tip too). Tips are seen once; after 6 matches or
// once all are seen, the whole HUD shows. Not online; tests (navigator.webdriver) always get the whole HUD.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const real = () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });

(async () => {
  const { browser, page, logs } = await open({ init: real });
  await page.evaluate(() => { EGO.Game.toLobby(); EGO.Save.data.settings.cutins = false; });
  const shown = (sel) => `(() => { const e = document.querySelector('${sel}'); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; })()`;
  const r0 = await page.evaluate(`(() => {
    const G = EGO.Game; G.startMatch('quick');
    for (let i = 0; i < 60 && G.match.phase !== 'play'; i++) G.stepManual(10);
    G.stepManual(1, true);
    return { rookie: EGO.Tips.active, abil: ${shown('#slot0')}, feint: ${shown('#slot-c')}, slow: ${shown('#slot-s')}, flow: ${shown('#flowbar')}, flowSlot: ${shown('#slot-g')}, stamina: ${shown('#stamina')}, hint: document.getElementById('hint').textContent };
  })()`);
  check('a new player\'s first match shows only the basics: no ability, FEINT, SLOW-MO or Flow boxes yet', r0.rookie && !r0.abil && !r0.feint && !r0.slow && !r0.flow && !r0.flowSlot && r0.stamina, r0);
  check('and no long line of keys at the bottom (tips come one at a time instead)', !/C TO FEINT/.test(r0.hint), r0.hint);

  // each tip when it matters
  const run = await page.evaluate(`(() => {
    const G = EGO.Game, m = G.match, h = m.human, T = EGO.Tips, out = {};
    const tip = () => ({ shown: !document.getElementById('tipbox').hidden, title: document.getElementById('tip-title').textContent, keys: document.getElementById('tip-keys').innerHTML });
    const wait = () => { T.hide(); T.gap = 0; };
    const opp = m.opponents(h).find((q) => !q.isGK), away = () => m.ball.reset(h.pos.x > 0 ? -10 : 10, 0);
    T.gap = 0; m.possess(h, true); G.stepManual(2, true); out.shoot = tip(); out.seen1 = EGO.Save.data.tips.slice();
    wait(); T.shownAt.shoot = T.playT - 7; m.possess(h, true); G.stepManual(2, true); out.pass = tip();
    wait(); opp.pos.set(h.pos.x + 2, 0, h.pos.z + 1); m.possess(h, true); G.stepManual(1, true); out.feint = Object.assign(tip(), { slots: ${shown('#slot-c')} && ${shown('#slot-s')} });
    wait(); m.ball.owner && m.ball.release && m.ball.release(); opp.pos.set(h.pos.x + 4, 0, h.pos.z + 3); m.possess(opp, true); G.stepManual(1, true); out.tackle = tip();
    wait(); T.playT = 30; m.ball.release(); away(); G.stepManual(1, true); out.ability = Object.assign(tip(), { slots: ${shown('#slot0')} });
    wait(); h.flow = 45; G.stepManual(1, true); out.flow = Object.assign(tip(), { bar: ${shown('#flowbar')} });
    wait(); away(); T.walkT = 3; h.sprint = false; EGO.Input.down.add('KeyW'); G.stepManual(1, true); EGO.Input.down.delete('KeyW'); out.sprint = tip();
    out.all = EGO.Save.data.tips.slice();
    G.toLobby();
    return out;
  })()`);
  check('with the ball for the first time: SHOOT, with the left mouse button pictured', run.shoot.shown && run.shoot.title === 'SHOOT' && /mouse l/.test(run.shoot.keys) && run.seen1.join() === 'shoot', run.shoot);
  check('a little later with the ball: PASS (right mouse button)', run.pass.title === 'PASS' && /mouse r/.test(run.pass.keys), run.pass);
  check('a defender close while you have the ball: FEINT (C), and the FEINT and SLOW-MO boxes appear', run.feint.title === 'FEINT' && /data-code="KeyC"/.test(run.feint.keys) && run.feint.slots, run.feint);
  check('they have the ball near you: TACKLE (F)', run.tackle.title === 'TACKLE' && /data-code="KeyF"/.test(run.tackle.keys), run.tackle);
  check('after a while: YOUR POWERS (Q E R), and the ability boxes appear', run.ability.title === 'YOUR POWERS' && /KeyQ/.test(run.ability.keys) && run.ability.slots, run.ability);
  check('the Flow bar fills: FLOW (G), and the Flow bar appears', run.flow.title === 'FLOW' && run.flow.bar, run.flow);
  check('walking a while: SPRINT (SHIFT)', run.sprint.title === 'SPRINT' && /SHIFT/.test(run.sprint.keys), run.sprint);
  check('each tip is kept, so it never repeats', run.all.length === 7 && new Set(run.all).size === 7, run.all);
  await page.screenshot({ path: __dirname + '/shots/tips.png', timeout: 120000 }).catch(() => {});

  const after = await page.evaluate(`(() => {
    const G = EGO.Game; G.startMatch('quick'); G.stepManual(2, true);
    const r = { rookie: EGO.Tips.active, abil: ${shown('#slot0')}, flow: ${shown('#flowbar')} };
    G.toLobby();
    EGO.Save.data.tips = []; EGO.Save.data.stats.played = 6; G.startMatch('quick'); G.stepManual(2, true);
    r.after6 = { rookie: EGO.Tips.active, abil: ${shown('#slot0')} };
    G.toLobby(); EGO.Save.data.stats.played = 0;
    G.startMatch('tutorial'); G.stepManual(2, true); r.tutorial = EGO.Tips.active; G.toLobby();
    return r;
  })()`);
  check('once every tip is seen, the whole HUD shows from the start', !after.rookie && after.abil && after.flow, after);
  check('after 6 matches the whole HUD shows anyway', !after.after6.rookie && after.after6.abil, after.after6);
  check('no tips in the tutorial (it has its own box)', after.tutorial === false, after);
  check('no page errors', !logs.some((l) => /PAGEERROR/.test(l)), logs.slice(0, 3));
  await browser.close();

  // tests and video tools: always the whole HUD
  const t = await open();
  const full = await t.page.evaluate(`(() => { EGO.Game.startMatch('quick'); EGO.Game.stepManual(2, true); return { rookie: EGO.Tips.active, abil: ${shown('#slot0')}, flow: ${shown('#flowbar')} }; })()`);
  check('automated tests get the whole HUD', !full.rookie && full.abil && full.flow, full);
  await t.browser.close();

  // a phone: the ability buttons wait for their tip, and the button to press glows
  const p = await open({ init: real, viewport: { width: 844, height: 390 }, mobile: true });
  const ph = await p.page.evaluate(`(() => {
    EGO.Touch.setOn(true); EGO.Save.data.settings.autoFs = false; EGO.Save.data.tips = ['shoot', 'pass', 'sprint', 'tackle', 'feint', 'flow']; const G = EGO.Game; G.startMatch('quick');
    for (let i = 0; i < 60 && G.match.phase !== 'play'; i++) G.stepManual(10);
    G.stepManual(1, true);
    const before = ${shown('#touch [data-act="ab0"]')};
    const m = G.match; EGO.Tips.hide(); EGO.Tips.playT = 30; EGO.Tips.gap = 0; G.stepManual(1, true);
    return { before, after: ${shown('#touch [data-act="ab0"]')}, title: document.getElementById('tip-title').textContent, text: document.getElementById('tip-text').textContent, glow: document.querySelector('#touch [data-act="ab0"]').classList.contains('tut-glow'), box: (() => { const q = document.getElementById('tipbox').getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth; })() };
  })()`);
  await p.page.screenshot({ path: __dirname + '/shots/tips_phone.png', timeout: 120000 }).catch(() => {});
  check('phone: the power buttons wait for their tip, then appear and glow; the tip fits', !ph.before && ph.after && ph.title === 'YOUR POWERS' && ph.glow && ph.box, ph);
  await p.browser.close();

  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(failed ? failed + ' FAILED' : 'ALL ' + results.length + ' PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e); process.exit(1); });
