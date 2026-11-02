// Online on a bumpy connection: the server's snapshots arrive late and in bunches (0 to 150 ms late, like home wifi far from
// the server). Players on screen must keep moving smoothly: a running player moves on screen at about the speed they really run,
// not in slow motion while waiting and then fast to catch up (and never stands still or jumps).
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18791, URL = 'http://localhost:' + PORT + '/';
let srv = null;

(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT) }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const A = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
  A.setDefaultTimeout(120000); A.on('pageerror', (e) => logs.push(e.message));
  await A.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await A.goto(URL); await A.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
  await A.evaluate(() => { EGO.Save.data.settings.quality = 'low'; EGO.Game.applyQuality(); });
  // the buttons are pressed from inside the page: this slow test machine can miss real clicks while it draws
  await A.evaluate(() => document.getElementById('go-online').click());
  await A.fill('#on-name', 'ali'); await A.press('#on-name', 'Tab');
  await A.evaluate(() => document.getElementById('on-create').click());
  await A.waitForFunction(() => EGO.Net.room, null, { timeout: 60000 });
  await A.evaluate(() => document.getElementById('on-go').click());
  await A.waitForFunction(() => EGO.Game.state === 'online' && EGO.Net.snaps.length > 5 && EGO.Net.nm.phase === 'play', null, { timeout: 60000 });
  const r = await A.evaluate((J) => new Promise((done) => {
    const N = EGO.Net, nm = N.nm, onSnap = N.onSnap.bind(N);
    // the bumpy connection: every snapshot is held back 0 to 150 ms, so some overtake others' timing and some come in bunches
    let hold = 0;
    N.onSnap = (m) => { const late = J * (Math.random() < 0.15 ? 150 : Math.random() * 60); hold = Math.max(hold, performance.now() + late); setTimeout(() => onSnap(m), hold - performance.now()); };
    const apply = N.applySnapshots.bind(N), last = new Map(), t0 = performance.now();
    let frames = 0, still = 0, jumps = 0, uneven = 0, moving = 0;
    N.applySnapshots = (rdt) => {
      apply(rdt);
      if (performance.now() - t0 < 3000) return; // the first 3 seconds: it learns how bumpy the connection is (a kickoff's worth)
      frames++;
      for (const p of nm.players) {
        const sp = Math.hypot(p.vel.x, p.vel.z), L = last.get(p);
        if (L && sp > 4 && L.sp > 4) {
          moving++;
          const d = Math.hypot(p.pos.x - L.x, p.pos.z - L.z);
          if (d < 1e-4) still++;
          else if (d > sp * rdt * 4 + 0.35) jumps++;
          const k = d / (sp * rdt); if (k < 0.6 || k > 1.6) uneven++; // much slower or faster than they really run
        }
        last.set(p, { x: p.pos.x, z: p.pos.z, sp });
      }
    };
    // run the game 60 times a second without drawing (the test machine draws slowly), with real snapshots arriving
    const G = EGO.Game; G.manual = true; const iv = setInterval(() => G.loop(performance.now(), false), 16);
    setTimeout(() => { clearInterval(iv); G.manual = false; done({ frames, moving, still, jumps, unevenPct: +(uneven / Math.max(1, moving) * 100).toFixed(1), stillPct: +(still / Math.max(1, moving) * 100).toFixed(1), jumpPct: +(jumps / Math.max(1, moving) * 100).toFixed(1), delay: +(N.delay || 0.12).toFixed(3) }); }, 11000);
  }), +(process.env.NET_JITTER || 1)); // NET_JITTER=0: a perfect connection, to see the baseline
  check('on a bumpy connection running players move at their real speed, never stop or jump', r.moving > 600 && r.stillPct < 3 && r.jumpPct < 2 && r.unevenPct < 10, r);
  check('the picture waits a little longer on a bumpy connection', r.delay > 0.13 && r.delay <= 0.35, r.delay);
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((x) => x.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exitCode = 1; })
  .finally(() => { if (srv) srv.kill(); setTimeout(() => process.exit(), 300); }); // never leave the server running
