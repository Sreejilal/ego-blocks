// Online play in real browsers: a desktop player creates a room, a phone player opens the invite link,
// both play a short match (keyboard and touch) on the server, see the results and go back to the room.
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18788, URL = 'http://localhost:' + PORT + '/';

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '25', GOLDEN_SECONDS: '2' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts) => {
    const ctx = await browser.newContext(opts); const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    return page;
  };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  await A.goto(URL); await sleep(2500);
  await A.click('#go-online'); await sleep(300);
  await A.fill('#on-name', 'ali'); await A.press('#on-name', 'Tab');
  await A.click('#on-create'); await sleep(800);
  const code = await A.evaluate(() => document.getElementById('on-room-code').textContent);
  const link = await A.evaluate(() => EGO.Net ? EGO.Net.inviteLink() : null);
  check('desktop player creates a room and gets a code and invite link', /^[A-Z0-9]{4}$/.test(code) && link && link.includes('?room=' + code), { code, link });
  await A.screenshot({ path: __dirname + '/shots/on1_room.png' });

  const B = await mk({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await B.goto(link);
  for (let i = 0; i < 40; i++) { if (await B.evaluate(() => !!(window.EGO && EGO.Net.room)).catch(() => false)) break; await sleep(250); }
  const bRoom = await B.evaluate(() => ({ cur: EGO.UI.cur, code: document.getElementById('on-room-code').textContent, players: EGO.Net.room && EGO.Net.room.players.length }));
  check('the invite link opens straight into the room on a phone', bRoom.cur === 'online' && bRoom.code === code && bRoom.players === 2, bRoom);
  await sleep(300);
  const aSees = await A.evaluate(() => document.getElementById('on-t0').textContent + ' | ' + document.getElementById('on-t1').textContent);
  check('the host sees the friend join', /ALI/.test(aSees) && /PLAYER/.test(aSees), aSees);
  const bHost = await B.evaluate(() => document.getElementById('on-host').hidden);
  check('only the host gets the mode and start buttons', bHost === true);
  await A.click('#on-mode [data-m="koth"]'); await sleep(300);
  await A.click('#on-go'); await sleep(1500);
  const started = await Promise.all([A, B].map((p) => p.evaluate(() => ({ state: EGO.Game.state, players: EGO.Net.nm && EGO.Net.nm.players.length, me: EGO.Net.nm && EGO.Net.nm.human && EGO.Net.nm.human.name, mode: EGO.Net.nm && EGO.Net.nm.mode, chip: document.getElementById('hud-mode').textContent }))));
  check('both screens are in the online match', started.every((s) => s.state === 'online' && s.players === 6 && s.me === 'YOU' && s.mode === 'koth'), started);

  // A runs forward with the keyboard, B pushes the touch stick sideways
  const a0 = await A.evaluate(() => EGO.Net.nm.human.pos.z);
  await A.keyboard.down('KeyW'); await A.keyboard.down('ShiftLeft');
  const stick = await B.evaluate(() => { const T = EGO.Touch; return [T.ghost.x, T.ghost.y]; });
  const cdp = await B.context().newCDPSession(B);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: stick[0], y: stick[1], id: 1 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: stick[0] + i * 10, y: stick[1], id: 1 }] }); await sleep(30); }
  await sleep(2500);
  const moved = await Promise.all([A.evaluate(() => EGO.Net.nm.human.pos.z), B.evaluate(() => ({ x: EGO.Net.nm.human.pos.x, z: EGO.Net.nm.human.pos.z, touch: !document.getElementById('touch').hidden }))]);
  const bSeesA = await B.evaluate(() => { const nm = EGO.Net.nm; const a = nm.players.find((p) => p.name === 'ALI'); return a ? a.pos.z : null; });
  check('keyboard moves you on the server and on your screen', moved[0] - a0 > 5, { from: +a0.toFixed(1), to: +moved[0].toFixed(1) });
  check('the friend sees you move too', bSeesA != null && Math.abs(bSeesA - moved[0]) < 4, { onB: bSeesA, onA: moved[0] });
  check('touch controls work online on the phone', moved[1].touch && Math.abs(moved[1].x) > 1, moved[1]);
  await A.screenshot({ path: __dirname + '/shots/on2_match_desktop.png' });
  await B.screenshot({ path: __dirname + '/shots/on3_match_phone.png' });
  await A.keyboard.up('KeyW'); await A.keyboard.up('ShiftLeft');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // ESC opens the menu but the match keeps going
  await A.keyboard.press('Escape'); await sleep(300);
  const menu = await A.evaluate(() => ({ shown: !document.getElementById('scr-pause').hidden, title: document.querySelector('#scr-pause h2').textContent, leave: document.getElementById('p-forfeit').textContent, state: EGO.Game.state }));
  const c1 = await A.evaluate(() => EGO.Net.nm.time); await sleep(1200); const c2 = await A.evaluate(() => EGO.Net.nm.time);
  check('ESC opens the menu while the online match keeps going', menu.shown && menu.title === 'MENU' && menu.leave === 'LEAVE MATCH' && menu.state === 'online' && c2 > c1 + 0.3, Object.assign(menu, { c1, c2 }));
  if (menu.shown) await A.click('#p-resume'); else await A.evaluate(() => EGO.Game.resume());
  await sleep(200);

  // the final whistle
  for (let i = 0; i < 60; i++) { const s = await A.evaluate(() => EGO.Game.state); if (s === 'results') break; await sleep(500); }
  const res = await Promise.all([A, B].map((p) => p.evaluate(() => ({ state: EGO.Game.state, title: document.getElementById('r-title').textContent, again: document.getElementById('r-again').textContent, hist: EGO.Save.data.history.length, played: EGO.Save.data.stats.played }))));
  check('both see the results, saved to their history', res.every((r) => r.state === 'results' && r.again === 'BACK TO ROOM' && r.hist === 1 && r.played === 1), res);
  await B.screenshot({ path: __dirname + '/shots/on4_results_phone.png' });
  await A.click('#r-again'); await sleep(500);
  const back = await A.evaluate(() => ({ cur: EGO.UI.cur, room: !document.getElementById('on-room').hidden, code: document.getElementById('on-room-code').textContent }));
  check('BACK TO ROOM returns to the same room for a rematch', back.cur === 'online' && back.room && back.code === code, back);
  await A.click('#on-go'); await sleep(1500);
  const re = await A.evaluate(() => EGO.Game.state);
  check('rematch starts', re === 'online', re);
  // leaving mid-match: back to the lobby, a bot takes over
  await A.keyboard.press('Escape'); await sleep(200);
  await A.click('#p-forfeit'); await A.click('#p-forfeit'); await sleep(600);
  const left = await A.evaluate(() => ({ state: EGO.Game.state, cur: EGO.UI.cur }));
  check('LEAVE MATCH goes back to the lobby', left.state === 'lobby' && left.cur === 'lobby', left);
  check('no page errors', logs.length === 0, logs.slice(0, 5));
  check('no server errors', !/Error/.test(out), out.split('\n').slice(1, 6));
  await browser.close(); srv.kill();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
