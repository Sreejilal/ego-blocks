// Owner's list, Nov 26 2026: in STORY you are the striker (no going in goal); switching player slows time only when the
// one you take over has the ball; shift lock turns slower.
// node test/switchgk.js   (run `npm run build` first)
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

process.on('unhandledRejection', (e) => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  const story = await page.evaluate(() => {
    const G = EGO.Game, d = EGO.Save.data, ev = EGO.STORY_EVENTS[1];
    d.pos = 'GK'; d.posFor = d.style; // you went in goal last time
    G.startMatch(ev.mode, { story: ev }); G.manual = true; G.stepManual(2, false); G.beginIntro(); // test robots skip the intro: open the position picker by hand
    const m = G.match, roles = (EGO.UI.introRoles || []).slice(), canGK = G.pickRole('GK');
    const r = { human: m.human.role, roles, canGK, intro: !!G.intro };
    m.dispose(); G.match = null; G.toLobby();
    G.startMatch('quick'); G.stepManual(2, false); G.beginIntro();
    r.quickRoles = (EGO.UI.introRoles || []).slice(); r.quickHuman = G.match.human.role;
    G.match.dispose(); G.match = null; G.toLobby(); d.pos = null;
    return r;
  });
  check('STORY: you start as the striker even if you went in goal before, and the keeper spot is not on the picker', story.human !== 'GK' && story.roles.length >= 2 && !story.roles.includes('GK') && !story.canGK, story);
  check('outside STORY you can still go in goal', story.quickRoles.includes('GK') && story.quickHuman === 'GK', story);
  const sw = await page.evaluate(() => {
    const G = EGO.Game, T = EGO.TimeCtl; G.startMatch('quick', { noIntro: true }); G.manual = true; G.stepManual(3, false);
    const m = G.match, h = m.human, mates = m.teams[h.team].filter((q) => q !== h && !q.isGK);
    T.reset(); m.ball.owner = null; m.switchTo(mates[0]); const noBall = T.slowT;
    T.reset(); m.possess(mates[1], true); m.switchTo(mates[1]); const withBall = T.slowT, scale = T.slowScale;
    G.match.dispose(); G.match = null; G.toLobby();
    return { noBall, withBall, scale };
  });
  check('switching to a teammate without the ball: no slow motion; to the one with the ball: a moment of slow motion', sw.noBall === 0 && sw.withBall > 0.2 && sw.scale < 0.6, sw);
  const sl = await page.evaluate(() => {
    const C = EGO.Cam || window.Cam, S = EGO.Save.data.settings, I = EGO.Input;
    const turn = (lock) => { S.shiftLock = lock; const y0 = EGO.Cam.yaw; I.mdx = 100; I.mdy = 0; EGO.Cam.look(1 / 60); I.mdx = 0; return Math.abs(EGO.Cam.yaw - y0); };
    const off = turn(false), on = turn(true); S.shiftLock = false;
    return { off: +off.toFixed(3), on: +on.toFixed(3) };
  });
  check('shift lock: the same mouse move turns the camera less', sl.on > 0 && sl.on < sl.off * 0.75, sl);
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.filter((l) => l.startsWith('PAGEERROR')).slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
