// Optional accounts: sign-up rules, sign-in, progress kept on the server (and after a restart), friends
// and profile cards (friends only), password-guessing limits, then the same flow in real browsers.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18789, BASE = 'http://localhost:' + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'scorz-acc-'));

let srv, out = '';
async function startServer() {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA }) });
  srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
}
const api = (p, body, token) => fetch(BASE + '/api/' + p, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }).then(async (r) => Object.assign({ status: r.status }, await r.json()));

(async () => {
  await startServer();
  const a = await api('register', { user: 'ali7', pass: 'secret12' });
  check('make an account with a name and a password', a.status === 200 && a.user === 'ALI7' && a.token && a.token.length > 30, { user: a.user });
  const rules = await Promise.all([api('register', { user: 'ALI7', pass: 'another1' }), api('register', { user: 'xx', pass: 'secret12' }), api('register', { user: 'bigfuckguy', pass: 'secret12' }), api('register', { user: 'bob', pass: '123' })]);
  check('names must be free, 3 to 12 characters, not rude; passwords 6+', rules.every((r) => r.status === 400) && /TAKEN/.test(rules[0].error) && /3 TO 12/.test(rules[1].error) && /DIFFERENT/.test(rules[2].error) && /6 OR MORE/.test(rules[3].error), rules.map((r) => r.error));
  const bad = await api('login', { user: 'ali7', pass: 'nope' }), good = await api('login', { user: 'ali7', pass: 'secret12' });
  check('sign in needs the right password', bad.status === 400 && good.status === 200 && good.token, { bad: bad.error });
  await api('save', { save: { emeralds: 999, xp: 450, rp: 220, style: 'THUNDER', look: { hair: 'MOHAWK' }, club: 'EMBER', history: [{ t: 1, mode: 'quick', res: 'win', score: [2, 1], g: 1, a: 0 }], secret: 'x' } }, a.token);
  const me = await api('me', null, good.token);
  check('progress is saved on the server', me.save && me.save.emeralds === 999 && me.save.style === 'THUNDER', me.save && Object.keys(me.save));
  const noTok = await api('me');
  check('no sign-in, no progress', noTok.status === 401);

  // friends and cards
  const b = await api('register', { user: 'BEN9', pass: 'secret34' });
  const stranger = await api('card/ALI7', null, b.token);
  check('strangers cannot see your card', stranger.status === 404, stranger.error);
  await api('friends/add', { user: 'ali7' }, b.token);
  const req = await api('friends', null, a.token);
  check('a friend request arrives', req.requests.includes('BEN9'), req);
  await api('friends/accept', { user: 'BEN9' }, a.token);
  const fb = await api('friends', null, b.token), card = await api('card/ALI7', null, b.token);
  check('accepted: both are friends', fb.friends.some((f) => f.user === 'ALI7') && (await api('friends', null, a.token)).friends.some((f) => f.user === 'BEN9'), fb.friends.map((f) => f.user));
  check('a friend sees the profile card, and only the card', card.status === 200 && card.style === 'THUNDER' && card.rp === 220 && card.history.length === 1 && card.emeralds === undefined && card.secret === undefined, Object.keys(card));

  // guessing passwords gets slowed down
  let limited = false;
  for (let i = 0; i < 12; i++) { const r = await api('login', { user: 'ali7', pass: 'guess' + i }); if (r.status === 429) { limited = true; break; } }
  check('too many sign-in tries in a minute are refused', limited);

  // the file survives a restart, and passwords are not stored as typed
  await sleep(2600); srv.kill(); await sleep(400); // the server writes the accounts file every 2 seconds
  const file = fs.readFileSync(path.join(DATA, 'accounts.json'), 'utf8');
  check('passwords and tokens are stored hashed', !file.includes('secret12') && !file.includes(a.token));
  out = ''; await startServer(); // a fresh server starts with a clean guessing limit
  const again = await api('login', { user: 'ALI7', pass: 'secret12' });
  const kept = await api('me', null, again.token);
  check('accounts and progress survive a server restart', again.status === 200 && kept.save && kept.save.emeralds === 999, { status: again.status });

  // in the browser: a guest makes an account, another device signs in and gets the progress
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => logs.push(e.message)); await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' })); await p.goto(BASE + '/'); await sleep(2500); return p; };
  const P1 = await mk();
  await P1.evaluate(() => { EGO.Save.data.emeralds = 1234; EGO.Save.data.xp = 777; EGO.Save.save(); });
  await P1.click('#go-profile'); await sleep(300);
  const guest = await P1.evaluate(() => document.getElementById('pf-acc').textContent);
  check('guests play straight away and see the account option', /playing as a guest/i.test(guest) && /CREATE ACCOUNT/.test(guest));
  await P1.fill('#ac-user', 'cat5'); await P1.fill('#ac-pass', 'meowmeow');
  await P1.click('#ac-new'); await sleep(1500);
  const signed = await P1.evaluate(() => ({ user: EGO.Account.user, panel: document.getElementById('pf-acc').textContent, name: EGO.Save.data.name }));
  check('creating an account in the game signs you in', signed.user === 'CAT5' && /SIGNED IN AS/.test(signed.panel) && signed.name === 'CAT5', signed);
  const up = await api('login', { user: 'cat5', pass: 'meowmeow' }).then((r) => api('me', null, r.token));
  check('the guest progress went up to the account', up.save && up.save.emeralds === 1234 && up.save.xp === 777 && up.save.settings === undefined && up.save.account === undefined, up.save && { em: up.save.emeralds });
  await P1.evaluate(() => { EGO.Save.data.emeralds = 1500; EGO.Save.save(); EGO.Account.upload(); }); await sleep(800);
  const P2 = await mk();
  await P2.click('#go-profile'); await sleep(300);
  await P2.fill('#ac-user', 'CAT5'); await P2.fill('#ac-pass', 'meowmeow'); await P2.click('#ac-in'); await sleep(1500);
  const p2 = await P2.evaluate(() => ({ em: EGO.Save.data.emeralds, xp: EGO.Save.data.xp, user: EGO.Account.user }));
  check('signing in on another device brings your progress', p2.user === 'CAT5' && p2.em === 1500 && p2.xp === 777, p2);
  // friends in the game
  await P2.fill('#fr-name', 'ALI7'); await P2.click('#fr-add'); await sleep(800);
  await api('friends/accept', { user: 'CAT5' }, again.token);
  await P2.click('#fr-refresh'); await sleep(800);
  const list = await P2.evaluate(() => document.getElementById('pf-acc').textContent);
  check('friends show up on the Profile screen', /ALI7/.test(list) && /OFFLINE/.test(list), list.slice(0, 200));
  await P2.click('[data-card="ALI7"]'); await sleep(800);
  const fc = await P2.evaluate(() => ({ shown: !document.getElementById('friend-card').hidden, text: document.querySelector('#friend-card .fc-body').textContent }));
  check("a friend's card shows their level, style, skins, rank and recent matches", fc.shown && /ALI7/.test(fc.text) && /LEVEL/.test(fc.text) && /THUNDER/.test(fc.text) && /RECENT MATCHES/.test(fc.text) && /QUICK MATCH/.test(fc.text), fc.text.slice(0, 160));
  await P2.screenshot({ path: __dirname + '/shots/ac1_friend_card.png' });
  await P2.click('#fc-close');
  // signed-in name in online rooms
  await P2.evaluate(() => { EGO.UI.show('lobby'); EGO.Net.open(); });
  await P2.click('#on-create'); await sleep(800);
  const roomName = await P2.evaluate(() => EGO.Net.room && EGO.Net.room.players[0].name);
  check('online rooms use your account name', roomName === 'CAT5', roomName);
  // sign out: back to the guest progress on this device
  await P1.click('#ac-out'); await sleep(500);
  const out1 = await P1.evaluate(() => ({ user: EGO.Account.user, em: EGO.Save.data.emeralds }));
  check('signing out goes back to the guest progress on this device', out1.user === null && out1.em === 1234, out1);
  await P2.screenshot({ path: __dirname + '/shots/ac2_room.png' });
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  check('no server errors', !/Error/.test(out), out.split('\n').slice(1, 5));
  await browser.close(); srv.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); if (srv) srv.kill(); process.exit(1); });
