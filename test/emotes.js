// The emote wheel: B (or the EMOTE button, or D-pad down) opens it, 1 to 6 / a click / the D-pad picks, your player does
// it for a moment with its name over your head. Not with the ball, once every 3 seconds. Online, everyone sees it.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;
const PORT = 18793;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts, url) => {
    const p = await (await browser.newContext(opts)).newPage(); p.setDefaultTimeout(120000);
    p.on('pageerror', (e) => logs.push(e.message));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(url || URL, { timeout: 120000 }); await p.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 }); return p;
  };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  const start = () => A.evaluate(() => {
    if (EGO.Game.match) EGO.Game.toLobby();
    const s = EGO.Save.data.settings; s.cam = 'third'; s.camPicked = true; s.cutins = false;
    EGO.Game.startMatch('quick'); for (let i = 0; i < 80 && EGO.Game.match.phase !== 'play'; i++) EGO.Game.stepManual(10, false);
    const m = EGO.Game.match, h = m.human; if (m.ball.owner === h) { m.ball.release(); m.ball.pos.x += 6; } for (const o of m.players) if (o !== h) o.pos.x += 9;
    EGO.Game.stepManual(2, false);
  });
  await start();
  const kb = await A.evaluate(() => {
    EGO.Input.edges.add('KeyB'); EGO.Game.stepManual(2, true);
    const open = !document.getElementById('emote-pop').hidden, n = document.querySelectorAll('#emote-pop [data-em]').length;
    EGO.Input.edges.add('Digit1'); EGO.Game.stepManual(3, true);
    const h = EGO.Game.match.human;
    return { open, n, closed: document.getElementById('emote-pop').hidden, state: h.state, emote: h.emote, label: [...document.querySelectorAll('.flabel')].some((l) => !l.hidden && /WAVE/.test(l.textContent)) };
  });
  check('B opens the wheel with 6 emotes, 1 picks WAVE and the wheel closes', kb.open && kb.n === 6 && kb.closed && kb.state === 'emote' && kb.emote === 'wave', kb);
  check('the emote name shows over your head', kb.label, kb);
  await A.screenshot({ path: __dirname + '/shots/em1_wave.png', timeout: 120000 });
  const done = await A.evaluate(() => { EGO.Game.stepManual(110, false); return EGO.Game.match.human.state; });
  check('after a moment you are free to play again', done === 'free', done);
  const again = await A.evaluate(() => { EGO.Game.match.human.emoteCd = EGO.Game.match.time + 2; EGO.UI.toggleEmotes(true); EGO.UI.pickEmote(1); EGO.Game.stepManual(2, false); return EGO.Game.match.human.state; });
  check('not more than once every 3 seconds', again !== 'emote', again);
  const ball = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; h.emoteCd = 0; m.possess(h); EGO.UI.toggleEmotes(true); EGO.UI.pickEmote(2); EGO.Game.stepManual(2, true); return { state: h.state, toast: document.getElementById('toasts').textContent }; });
  check('not while you have the ball', ball.state !== 'emote' && /NOT WITH THE BALL/.test(ball.toast), ball);
  const pad = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human; m.ball.release(); m.ball.pos.x += 8; h.emoteCd = 0; EGO.Game.stepManual(2, false);
    EGO.Input.edges.add('PadDown'); EGO.Game.stepManual(1, false); const open = EGO.UI.emoteOpen;
    const cd0 = h.abil.map((a) => a.cd);
    EGO.Input.edges.add('PadUp'); EGO.Game.stepManual(2, false);
    return { open, emote: h.emote, state: h.state, abilityFired: h.abil.some((a, i) => a.cd > cd0[i]) };
  });
  check('controller: D-pad down opens it, the D-pad picks (and does not fire an ability)', pad.open && pad.state === 'emote' && pad.emote === 'clap' && !pad.abilityFired, pad);
  // phone: the EMOTE button
  const P = await mk({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await P.evaluate(() => { EGO.Save.data.settings.autoFs = false; EGO.Game.startMatch('quick'); for (let i = 0; i < 80 && EGO.Game.match.phase !== 'play'; i++) EGO.Game.stepManual(10, false); const m = EGO.Game.match, h = m.human; if (m.ball.owner === h) { m.ball.release(); m.ball.pos.x += 6; } EGO.Game.stepManual(2, true); });
  const btn = await P.evaluate(() => { const b = document.querySelector('#touch [data-act="emote"]'); const r = b.getBoundingClientRect(); return { shown: !b.hidden, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const cdp = await P.context().newCDPSession(P);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 5 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
  const popOpen = await P.evaluate(() => !document.getElementById('emote-pop').hidden);
  await P.screenshot({ path: __dirname + '/shots/em2_phone.png', timeout: 120000 });
  await P.tap('#emote-pop [data-em="4"]'); await P.evaluate(() => EGO.Game.stepManual(3, false));
  const ph = await P.evaluate(() => ({ state: EGO.Game.match.human.state, emote: EGO.Game.match.human.emote }));
  check('phone: the EMOTE button opens the wheel and a tap picks', btn.shown && popOpen && ph.state === 'emote' && ph.emote === 'flex', Object.assign(ph, { btn: btn.shown, popOpen }));
  await P.context().close();
  // online: the friend sees it
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '60' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const O1 = await mk({ viewport: { width: 900, height: 520 } }, 'http://localhost:' + PORT + '/');
  await O1.evaluate(() => EGO.Net.open()); await O1.click('#on-create'); await sleep(800);
  const link = await O1.evaluate(() => EGO.Net.inviteLink());
  const O2 = await mk({ viewport: { width: 900, height: 520 } }, link);
  for (let i = 0; i < 40; i++) { if (await O2.evaluate(() => !!EGO.Net.room).catch(() => false)) break; await sleep(250); }
  await O1.click('#on-go'); await sleep(2500);
  for (let i = 0; i < 40; i++) { if (await O1.evaluate(() => EGO.Net.snaps.length && EGO.Net.snaps[EGO.Net.snaps.length - 1].ph === 'play')) break; await sleep(250); }
  // the friend (not taking the kickoff, so without the ball) waves; the host should see it
  await O2.evaluate(() => { EGO.Input.emotePick = 0; });
  let seenAny = [];
  for (let i = 0; i < 20 && !seenAny.includes('wave'); i++) { await sleep(150); seenAny = await O1.evaluate(() => EGO.Net.nm.players.filter((p) => p.state === 'emote').map((p) => p.emote)); }
  check('online: your friend sees your emote', seenAny.includes('wave'), { seenAny });
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  check('no server errors', !/Error/.test(out), out.split('\n').slice(1, 4));
  await browser.close(); srv.kill();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
