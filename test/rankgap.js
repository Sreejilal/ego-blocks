// Online: a Diamond player against a Wood player on the other team. The room warns about the rank gap, and the
// higher player gets no rewards for a win or a draw (a loss still counts). The lower player is rewarded as usual.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18795, BASE = 'http://localhost:' + PORT + '/';

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '15', GOLDEN_SECONDS: '2' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (url, rp) => {
    const p = await (await browser.newContext({ viewport: { width: 900, height: 520 } })).newPage(); p.setDefaultTimeout(120000);
    p.on('pageerror', (e) => logs.push(e.message));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(url, { timeout: 120000 }); await p.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 });
    await p.evaluate((rp) => { EGO.Save.data.rp = rp; EGO.Save.save(); }, rp);
    return p;
  };
  const A = await mk(BASE, 450); // Diamond
  await A.evaluate(() => EGO.Net.open()); await A.click('#on-create'); await sleep(800);
  const link = await A.evaluate(() => EGO.Net.inviteLink());
  const B = await mk(link, 30); // Wood
  for (let i = 0; i < 40; i++) { if (await B.evaluate(() => !!EGO.Net.room).catch(() => false)) break; await sleep(250); }
  await sleep(500);
  const teams = await A.evaluate(() => EGO.Net.room.players.map((p) => ({ name: p.name, team: p.team, rp: p.rp })));
  const warn = await A.evaluate(() => document.getElementById('on-wait').textContent);
  check('the room knows each player\'s rank and warns about the gap', teams.length === 2 && teams[0].team !== teams[1].team && /BIG RANK GAP/.test(warn), { teams, warn });
  const before = await Promise.all([A, B].map((p) => p.evaluate(() => ({ em: EGO.Save.data.emeralds, xp: EGO.Save.data.xp }))));
  await A.click('#on-go');
  for (let i = 0; i < 160; i++) { const s = await A.evaluate(() => EGO.Game.state); if (s === 'results') break; await sleep(500); }
  for (let i = 0; i < 20; i++) { const s = await B.evaluate(() => EGO.Game.state); if (s === 'results') break; await sleep(500); }
  const res = await Promise.all([A, B].map((p) => p.evaluate(() => ({ title: document.getElementById('r-title').textContent, earn: document.getElementById('r-earn').textContent, em: EGO.Save.data.emeralds, xp: EGO.Save.data.xp }))));
  const aWon = res[0].title !== 'DEFEAT';
  check('the higher player gets nothing for a win or draw (a loss counts as usual)', aWon ? /FAR BELOW YOUR RANK/.test(res[0].earn) && res[0].em === before[0].em && res[0].xp === before[0].xp : res[0].em > before[0].em, { title: res[0].title, earn: res[0].earn.slice(0, 80) });
  check('the lower player is rewarded as usual', !/FAR BELOW YOUR RANK/.test(res[1].earn) && res[1].em > before[1].em, { title: res[1].title, em: res[1].em - before[1].em });
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  check('no server errors', !/Error/.test(out), out.split('\n').slice(1, 4));
  await browser.close(); srv.kill();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
