// Idle players online: a warning with a countdown, then a bot plays for them, any button gives the player
// back, and that match gives no rewards. Runs with short times (IDLE_SECONDS=4, IDLE_GRACE=3).
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18791, BASE = 'http://localhost:' + PORT;

function client(name) {
  return new Promise((res) => {
    const ws = new WebSocket('ws://localhost:' + PORT + '/ws'), c = { ws, got: [], ev: [], snap: null, id: null, end: null };
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.t === 'welcome') c.id = m.id;
      else if (m.t === 'snap') { c.snap = m; for (const e of m.ev) if (!e.to || e.to === c.id) c.ev.push(Object.assign({ at: m.n }, e)); }
      else if (m.t === 'end') c.end = m;
      else if (m.t !== 'stats') c.got.push(m);
    });
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', name })); res(c); });
  });
}
const tell = (c, m) => c.ws.send(JSON.stringify(m));
const still = { t: 'input', mx: 0, my: 0, cy: 0 };

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '30', GOLDEN_SECONDS: '2', IDLE_SECONDS: '4', IDLE_GRACE: '3' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);

  /* ---------- on the server: X does nothing, Y keeps running ---------- */
  const X = await client('IDLER'), Y = await client('RUNNER');
  tell(X, { t: 'create' }); await sleep(200);
  tell(Y, { t: 'join', code: X.got.find((m) => m.t === 'room').code }); await sleep(200);
  tell(X, { t: 'start' }); await sleep(300);
  let flip = 1;
  const pump = setInterval(() => { tell(X, still); tell(Y, { t: 'input', mx: flip, my: 0, sp: true, cy: 0 }); }, 50);
  const flipper = setInterval(() => { flip = -flip; }, 700);
  for (let i = 0; i < 120 && !X.ev.some((e) => e.e === 'bot'); i++) await sleep(100);
  const warns = X.ev.filter((e) => e.e === 'idle').map((e) => e.s);
  check('doing nothing brings a warning that counts down', warns.join(',') === '3,2,1', warns);
  check('then a bot plays for you', X.ev.some((e) => e.e === 'bot') && X.snap.me === null);
  check('the player who keeps moving is never warned', !Y.ev.some((e) => e.e === 'idle' || e.e === 'bot'), Y.ev.filter((e) => /idle|bot/.test(e.e)));
  const roster = X.got.find((m) => m.t === 'start').roster, xi = roster.findIndex((r) => r.id === X.id);
  const p0 = X.snap.pl[xi].slice(0, 3); await sleep(1500); const p1 = X.snap.pl[xi].slice(0, 3);
  check('the bot really plays (your player keeps moving)', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.5 || X.snap.ph !== 'play', { p0, p1, ph: X.snap.ph });
  clearInterval(pump);
  const pump2 = setInterval(() => { tell(X, { t: 'input', mx: 0, my: 1, cy: 0 }); tell(Y, { t: 'input', mx: flip, my: 0, cy: 0 }); }, 50);
  await sleep(600);
  check('any button gives your player back', X.ev.some((e) => e.e === 'back') && X.snap.me && X.snap.me.i === xi);
  for (let i = 0; i < 240 && !X.end; i++) await sleep(250);
  clearInterval(pump2); clearInterval(flipper);
  const ex = X.end && X.end.players.find((p) => p.id === X.id), ey = X.end && X.end.players.find((p) => p.id === Y.id);
  check('the match result marks who went idle', ex && ex.idle === true && ey && ey.idle === false, { x: ex && ex.idle, y: ey && ey.idle });
  X.ws.close(); Y.ws.close(); await sleep(200);

  /* ---------- in the game ---------- */
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts) => { const ctx = await browser.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', (e) => logs.push(e.message)); await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' })); await p.goto(BASE + '/'); await sleep(2500); return p; };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  const before = await A.evaluate(() => ({ em: EGO.Save.data.emeralds, xp: EGO.Save.data.xp, pass: EGO.Save.data.pass.xp }));
  await A.evaluate(() => EGO.Net.open()); await A.click('#on-create'); await sleep(800);
  await A.click('#on-go'); await sleep(1500);
  let warn = null;
  for (let i = 0; i < 80; i++) { warn = await A.evaluate(() => ({ shown: !document.getElementById('idle-warn').hidden, big: document.getElementById('idle-big').textContent, small: document.getElementById('idle-small').textContent })); if (warn.shown) break; await sleep(200); }
  check('in the game: ARE YOU THERE? with a countdown', warn.shown && warn.big === 'ARE YOU THERE?' && /TAKES OVER IN \d/.test(warn.small), warn);
  await A.screenshot({ path: __dirname + '/shots/id1_warning.png' });
  let bot = null;
  for (let i = 0; i < 60; i++) { bot = await A.evaluate(() => document.getElementById('idle-big').textContent); if (/BOT/.test(bot)) break; await sleep(200); }
  check('then: A BOT IS PLAYING FOR YOU', bot === 'A BOT IS PLAYING FOR YOU', bot);
  await A.screenshot({ path: __dirname + '/shots/id2_bot.png' });
  await A.keyboard.down('KeyW'); await sleep(900); await A.keyboard.up('KeyW');
  const back = await A.evaluate(() => document.getElementById('idle-warn').hidden);
  check('pressing a key takes the player back and hides the message', back);
  for (let i = 0; i < 100; i++) { if (await A.evaluate(() => EGO.Game.state) === 'results') break; await A.keyboard.press('KeyC'); await sleep(300); }
  const res = await A.evaluate(() => ({ state: EGO.Game.state, earn: document.getElementById('r-earn').textContent, xpLine: document.getElementById('r-xp').textContent, em: EGO.Save.data.emeralds, xp: EGO.Save.data.xp, pass: EGO.Save.data.pass.xp, hist: EGO.Save.data.history.length }));
  check('results: no emeralds, XP or pass XP for that match', res.state === 'results' && /A BOT PLAYED FOR YOU/.test(res.earn) && res.em === before.em && res.xp === before.xp && res.pass === before.pass && /\+0 XP/.test(res.xpLine), Object.assign(res, { before }));
  check('the match still shows in your history', res.hist === 1, res.hist);
  await A.screenshot({ path: __dirname + '/shots/id3_results.png' });
  // a phone held upright: the warning fits
  const P = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await P.evaluate(() => { EGO.UI.show('hud'); EGO.Net.idleWarn('A BOT IS PLAYING FOR YOU', 'PRESS ANY BUTTON TO PLAY AGAIN. NO REWARDS THIS MATCH.'); });
  const box = await P.evaluate(() => { const r = document.getElementById('idle-warn').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  check('upright phone: the message fits the screen', box.l >= 0 && box.r <= box.w, box);
  await P.screenshot({ path: __dirname + '/shots/id4_upright.png' });
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  check('no server errors', !/Error/.test(out), out.split('\n').slice(1, 5));
  await browser.close(); srv.kill();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
