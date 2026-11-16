// Online with a friend: the room offers the four extra modes, a match in one of them starts on both screens, and
// each player sees the other's name above their head. Starts its own server. Pictures: test/shots/om_*.png
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18795, URL = 'http://localhost:' + PORT + '/';
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '40', GOLDEN_SECONDS: '2' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts) => {
    const page = await (await browser.newContext(opts)).newPage();
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    return page;
  };
  try {
    const A = await mk({ viewport: { width: 1280, height: 720 } });
    await A.goto(URL); await sleep(2500);
    await A.click('#go-online'); await sleep(300);
    await A.fill('#on-name', 'ali'); await A.press('#on-name', 'Tab');
    await A.click('#on-create'); await sleep(800);
    const link = await A.evaluate(() => EGO.Net.inviteLink());
    const B = await mk({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await B.goto(link);
    for (let i = 0; i < 40; i++) { if (await B.evaluate(() => !!(window.EGO && EGO.Net.room)).catch(() => false)) break; await sleep(250); }
    const modes = await A.evaluate(() => [...document.querySelectorAll('#on-mode [data-m]')].map((b) => b.dataset.m));
    check('the room offers 8 modes', modes.length === 8 && ['golden', 'nokeep', 'turbo', 'moon'].every((m) => modes.includes(m)), modes);
    const fit = await A.evaluate(() => { const s = document.getElementById('scr-online'); return { sw: s.scrollWidth, cw: s.clientWidth, cut: [...document.querySelectorAll('#on-mode [data-m]')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.dataset.m) }; });
    check('the mode buttons fit on a laptop', fit.sw <= fit.cw + 1 && fit.cut.length === 0, fit);
    for (const m of ['golden', 'turbo', 'moon', 'nokeep']) {
      await A.click(`#on-mode [data-m="${m}"]`); await sleep(250);
      const r = await Promise.all([A, B].map((p) => p.evaluate(() => EGO.Net.room.mode)));
      check('the host picks ' + m + ' and the friend sees it', r[0] === m && r[1] === m, r);
    }
    await A.screenshot({ path: __dirname + '/shots/om_room_laptop.png' });
    await B.screenshot({ path: __dirname + '/shots/om_room_phone.png' });
    await A.click('#on-go'); await sleep(2500);
    const st = await Promise.all([A, B].map((p) => p.evaluate(() => ({ state: EGO.Game.state, mode: EGO.Net.nm && EGO.Net.nm.mode, gk: EGO.Net.nm && EGO.Net.nm.players.filter((q) => q.role === 'GK').length, n: EGO.Net.nm && EGO.Net.nm.players.length, chip: document.getElementById('hud-mode').textContent }))));
    check('a No Keepers match starts on both screens with nobody in goal', st.every((s) => s.state === 'online' && s.mode === 'nokeep' && s.gk === 0 && s.n === 4), st);
    await sleep(3500);
    // name tags: each sees the other's name, not their own, and none on bots
    const tags = await Promise.all([A, B].map((p) => p.evaluate(() => ({ shown: [...document.querySelectorAll('.ntag')].filter((e) => !e.hidden).map((e) => e.textContent + ':' + e.dataset.t), all: EGO.UI.ntags.map((e) => e.textContent).filter(Boolean), bots: EGO.Net.nm.players.filter((q) => !q.netId).length }))));
    check('each player has the other\'s name ready as a tag (never their own, never a bot\'s)', tags[0].all.length === 1 && /^PLAYER/.test(tags[0].all[0]) && tags[1].all.length === 1 && tags[1].all[0] === 'ALI', tags);
    await A.screenshot({ path: __dirname + '/shots/om_match_laptop.png' });
    await B.screenshot({ path: __dirname + '/shots/om_match_phone.png' });
    check('no errors on either screen', logs.length === 0, logs.slice(0, 5));
    check('no server errors', !/Error|TypeError|ReferenceError/.test(out), out.split('\n').filter((l) => /Error/.test(l)).slice(0, 3));
  } catch (e) { check('ran to the end', false, e.message.slice(0, 300)); }
  console.log(results.join('\n'));
  await browser.close(); srv.kill();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
