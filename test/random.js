// Random matches: RANDOM MATCH puts you in an open public room with other players (no host, no code needed), the server
// starts the match by itself after a short wait (bots fill the rest), a player who arrives mid-match takes a bot's place
// at once, the next match starts by itself after the results (in another mode), friends' rooms (CREATE A ROOM) are never
// matched, and the start of an online match has the camera flight (no position picker: the server picks).
// One real game window plus pretend players straight on the WebSocket. Starts its own server.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18797, URL = 'http://localhost:' + PORT + '/';
/** a pretend player: remembers every message */
function bot(name) {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws'), got = [];
  const b = { ws, got, send: (m) => ws.send(JSON.stringify(m)), last: (t) => got.filter((m) => m.t === t).pop(), all: (t) => got.filter((m) => m.t === t) };
  ws.on('message', (raw) => { try { got.push(JSON.parse(raw)); } catch (e) {} });
  b.ready = new Promise((ok) => ws.on('open', () => { b.send({ t: 'hello', name }); ok(); }));
  return b;
}
const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(200); } return false; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), PUB_WAIT_MS: '15000', PUB_NEXT_MS: '4000', PUB_MODES: 'quick,turbo', MATCH_SECONDS: '12', GOLDEN_SECONDS: '1' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  try {
    // a friends' room first: random players must never land in it
    const F = bot('friendhost'); await F.ready; F.send({ t: 'create' });
    await until(() => F.last('room'));
    const friendCode = F.last('room').code;
    check('a friends room is not public', F.last('room').pub === false, F.last('room'));

    const A = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    A.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); A.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
    await A.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await A.goto(URL); await sleep(2500);
    await A.evaluate(() => {
      EGO.Game.toLobby(); EGO.Game.introTest = true;
      const UI = EGO.UI, show = UI.showIntro.bind(UI); window.__intro = []; // what the screen showed the moment the intro opened
      UI.showIntro = (m, online) => { show(m, online); window.__intro.push({ online, shown: !document.getElementById('intro').hidden, picker: !document.querySelector('#intro .in-pick').hidden, mode: document.getElementById('in-mode').textContent, cls: document.body.classList.contains('intro'), fly: EGO.Net.intro && EGO.Net.intro.fly }); };
    });
    const btn = await A.evaluate(() => ({ lobby: document.getElementById('go-online').textContent, first: document.querySelector('#on-start .btn.blue') && document.querySelector('#on-start .btn.blue').id }));
    check('the start screen says PLAY ONLINE, and RANDOM MATCH is the main online button', /PLAY ONLINE/.test(btn.lobby) && btn.first === 'on-random', btn);
    await A.click('#go-online'); await sleep(300);
    await A.click('#on-random');
    await until(() => A.evaluate(() => !!(EGO.Net.room))); await sleep(300);
    const r0 = await A.evaluate(() => ({ pub: EGO.Net.room.pub, code: EGO.Net.room.code, host: EGO.Net.room.host, pubShown: !document.getElementById('on-pub').hidden, t: document.getElementById('on-pub-t').textContent, hostCtl: !document.getElementById('on-host').hidden }));
    check('RANDOM MATCH opens a public room with a countdown and the mode, and nobody gets the host buttons', r0.pub && r0.code !== friendCode && !r0.host && r0.pubShown && /^NEXT: (QUICK|TURBO) · STARTS IN \d/.test(r0.t) && !r0.hostCtl, r0);
    await A.screenshot({ path: __dirname + '/shots/random1_wait.png', timeout: 120000 }).catch(() => {});

    const B = bot('bob'); await B.ready; B.send({ t: 'random' });
    await until(() => B.last('room'));
    check('a second random player lands in the same room (not the friends room)', B.last('room').code === r0.code && B.last('room').players.length === 2, B.last('room') && { code: B.last('room').code, n: B.last('room').players.length });
    const seen = await until(() => A.evaluate(() => EGO.Net.room.players.length === 2 && /2 PLAYERS/.test(document.getElementById('on-pub-t').textContent)), 5000);
    check('the waiting screen shows the new player', seen, await A.evaluate(() => document.getElementById('on-pub-t').textContent));

    // nobody presses start: the server starts it
    const started = await until(() => A.evaluate(() => EGO.Game.state === 'online' && !!EGO.Net.nm), 30000);
    const st = await A.evaluate(() => ({ state: EGO.Game.state, names: EGO.Net.nm ? EGO.Net.nm.players.map((p) => p.name) : [], intro: window.__intro }));
    check('the match starts by itself, with both players and bots in the empty spots', started && st.names.includes('BOB') && st.names.length === 6 && !!B.last('start'), st.names);
    const I0 = st.intro[0] || {};
    check('it opens with the camera flight and the team names, with no position picker online', st.intro.length === 1 && I0.online && I0.shown && I0.cls && !I0.picker && /^ONLINE · /.test(I0.mode) && I0.fly > 1.5, st.intro);
    const flown = await until(() => A.evaluate(() => !EGO.Net.intro && document.getElementById('intro').hidden && !document.body.classList.contains('intro')), 20000);
    check('the flight ends by itself and the match screen comes back', flown, await A.evaluate(() => ({ intro: !!EGO.Net.intro, phase: EGO.Net.nm && EGO.Net.nm.phase })));
    await sleep(1500);
    await A.screenshot({ path: __dirname + '/shots/random2_match.png', timeout: 120000 }).catch(() => {});

    // someone arrives mid-match: straight in, in a bot's place
    const C = bot('cara'); await C.ready; C.send({ t: 'random' });
    await until(() => C.last('start'));
    const cs = C.last('start');
    check('a player who arrives mid-match takes a bot\'s place at once', !!cs && cs.live === true && cs.roster.some((p) => p.name === 'CARA'), cs && { live: cs.live, names: cs.roster.map((p) => p.name) });
    check('the friends room is still just the friends', F.last('room').players.length === 1, F.last('room').players.map((p) => p.name));

    // the final whistle, the results, then the next match starts by itself
    const ended = await until(() => B.last('end'), 40000);
    check('the match ends', ended);
    const again = await until(() => B.all('start').length >= 2, 15000);
    check('the next match starts by itself after the results', again, B.all('start').length);
    const modes = B.all('start').map((m) => m.mode);
    check('and it is a different mode', modes.length >= 2 && modes[0] !== modes[1], modes);
    check('no errors in the game', logs.length === 0, logs.slice(0, 5));
    check('no server errors', !/Error|TypeError|ReferenceError/.test(out), out.split('\n').filter((l) => /Error/.test(l)).slice(0, 3));
    for (const b of [F, B, C]) b.ws.close();
  } catch (e) { check('ran to the end', false, e.message.slice(0, 300)); }
  console.log(results.join('\n'));
  await browser.close(); srv.kill();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
