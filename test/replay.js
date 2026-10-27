// Replays: the last 10 seconds are recorded; after your goal, nutmeg or ankle breaker a REPLAY offer
// appears; the replay puts every model back where it was, can be skipped, and SAVE CLIP downloads a video.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  page.on('dialog', (d) => d.dismiss());
  const rec = await page.evaluate(() => {
    const G = EGO.Game; G.startMatch('quick'); G.manual = true;
    G.stepManual(60 * 12, false); // 12 seconds of football
    const m = G.match, R = EGO.Replay;
    // remember where the ball was a little before the goal
    window._snap = { t: m.time, x: m.ball.mesh.position.x, y: m.ball.mesh.position.y, z: m.ball.mesh.position.z };
    G.stepManual(60, false);
    // the human scores
    const h = m.human; m.phase = 'play'; m.ball.owner = null; m.ball.lastKicker = h; m.ball.lastTouch = h; m.onGoal(1); G.stepManual(10, true);
    return { count: R.count, offer: R.offer && R.offer.kind, shown: !document.getElementById('rp-offer').hidden, key: document.getElementById('rp-key').textContent };
  });
  check('the last 10 seconds are recorded', rec.count === 600, rec);
  check('a goal offers a replay', rec.offer === 'GOAL' && rec.shown && rec.key === 'ENTER', rec);
  await page.keyboard.press('Enter');
  const on = await page.evaluate(() => {
    const G = EGO.Game; G.stepManual(2, true);
    const R = EGO.Replay, p = R.play;
    // jump the replay to the remembered moment and compare the ball
    p.t = window._snap.t; R.apply(p.t);
    const b = EGO.Game.match.ball.mesh.position, s = window._snap;
    return { state: G.state, ui: !document.getElementById('rp-on').hidden, body: document.body.classList.contains('replaying'), err: +Math.hypot(b.x - s.x, b.y - s.y, b.z - s.z).toFixed(3), span: +(p.t1 - p.t0).toFixed(2) };
  });
  check('ENTER plays the replay', on.state === 'replay' && on.ui && on.body, on);
  check('the replay puts the ball back where it really was', on.err < 0.05, on);
  check('the clip covers the moment before the goal', on.span >= 3.4 && on.span <= 4.2, on.span);
  await page.screenshot({ path: __dirname + '/shots/rp1_replay.png' });
  const end = await page.evaluate(() => { const G = EGO.Game; for (let i = 0; i < 60 * 12 && G.state === 'replay'; i++) G.stepManual(1, false); return { state: G.state, phase: G.match.phase }; });
  check('it ends by itself and play carries on', end.state === 'match', end);

  // skip, and the short offer after an ankle breaker
  const skip = await page.evaluate(() => {
    const G = EGO.Game, m = G.match, h = m.human, o = m.teams[1][1];
    G.stepManual(60 * 4, false); m.phase = 'play';
    m.ankleBreak(o, h);
    const offered = EGO.Replay.offer && EGO.Replay.offer.kind;
    EGO.Replay.start(); G.stepManual(10, false);
    const st = G.state;
    document.getElementById('rp-skip').click();
    const after = G.state;
    // a second ankle breaker: the offer goes away on its own after 3 seconds
    m.phase = 'play'; m.ankleBreak(o, h); const shown = !document.getElementById('rp-offer').hidden;
    G.stepManual(60 * 3.3, false);
    return { offered, st, after, shown, gone: document.getElementById('rp-offer').hidden };
  });
  check('ankle breakers offer a replay too', skip.offered === 'ANKLE BREAKER', skip);
  check('SKIP goes straight back to the match', skip.st === 'replay' && skip.after === 'match', skip);
  check('the offer disappears after a few seconds', skip.shown && skip.gone, skip);

  // SAVE CLIP: plays it again while recording, then downloads a video
  const support = await page.evaluate(() => EGO.Replay.clipType());
  if (support) {
    await page.evaluate(() => { const G = EGO.Game, m = G.match; G.stepManual(60 * 4, false); m.phase = 'play'; m.ankleBreak(m.teams[1][1], m.human); EGO.Replay.start(); G.manual = false; });
    const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    await sleep(300);
    await page.click('#rp-save', { force: true });
    const d = await dl;
    const info = await page.evaluate(() => ({ clip: EGO.Replay.lastClip, note: document.getElementById('rp-note').textContent, state: EGO.Game.state }));
    check('SAVE CLIP downloads a video of the replay', !!d && /scorz-ankle-breaker\.(webm|mp4)$/.test(d.suggestedFilename()) && info.clip && info.clip.size > 1000, { file: d && d.suggestedFilename(), info });
    await page.evaluate(() => { EGO.Game.manual = true; });
  } else check('SAVE CLIP: this browser has no video recorder (skipped)', true, support);

  // bot matches never offer replays
  const sim = await page.evaluate(() => { EGO.Replay.offer = null; const r = EGO.simulate('quick', 0.6, 60); return { goals: r.goals, offer: EGO.Replay.offer }; });
  check('bot-only matches do not offer replays', sim.offer === null, sim);
  check('no errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();

  // phones: the offer says TAP and a tap starts it
  const o = await open({ wait: 1500, viewport: { width: 844, height: 390 }, mobile: true });
  await o.page.evaluate(() => { const G = EGO.Game; G.startMatch('quick'); G.manual = true; G.stepManual(60 * 6, false); const m = G.match; m.phase = 'play'; m.ball.lastKicker = m.human; m.onGoal(1); G.stepManual(5, true); });
  const tapKey = await o.page.evaluate(() => document.getElementById('rp-key').textContent);
  const b = await o.page.evaluate(() => { const r = document.getElementById('rp-offer').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await o.page.touchscreen.tap(b[0], b[1]); await sleep(100);
  const tapped = await o.page.evaluate(() => { EGO.Game.stepManual(3, true); return EGO.Game.state; });
  await o.page.screenshot({ path: __dirname + '/shots/rp2_phone.png' });
  check('phone: tap REPLAY to watch it', tapKey === 'TAP' && tapped === 'replay', { tapKey, tapped });
  check('phone: no errors', o.logs.length === 0, o.logs.slice(0, 4));
  await o.browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
