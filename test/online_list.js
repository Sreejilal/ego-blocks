// PLAYERS ONLINE and invites: everyone with the game open shows in the list (also in the menus or a match against
// bots), friends first; a room code only shows to friends; INVITE pops up on their screen with JOIN and NO THANKS;
// SHOW ME HERE off hides you from everyone but friends; INVITES FROM FRIENDS or NOBODY is respected; invites cannot
// be spammed and NO THANKS stops them for a while. The last part opens the browser: a pushed invite shows the
// popup, J joins the room, the list renders with INVITE and ADD FRIEND. Starts its own server.
// SERVER_ONLY=1 node test/online_list.js skips the browser part.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18793, BASE = 'http://localhost:' + PORT;

function client() {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws');
  const c = { ws, last: {}, all: [] };
  ws.on('message', (raw) => { const m = JSON.parse(raw); c.last[m.t] = m; c.all.push(m); if (m.t === 'welcome') c.id = m.id; });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = new Promise((r) => ws.on('open', r));
  c.who = async () => { c.last.who = null; c.send({ t: 'who' }); for (let i = 0; i < 30 && !c.last.who; i++) await sleep(20); return c.last.who; };
  c.count = (t) => c.all.filter((m) => m.t === t).length;
  return c;
}
const api = (route, body, token) => fetch(BASE + '/api/' + route, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
const names = (w) => (w ? w.list.map((p) => p.name) : []);

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorz-who-'));
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: dataDir }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  check('server starts', /SCORZ server/.test(out), out.trim().split('\n')[0]);

  // two signed-in friends (AMYX and BENX), a guest (PLAYER42) and a shy guest (PLAYER77)
  const amy = await api('register', { user: 'AMYX', pass: 'secret1' }), ben = await api('register', { user: 'BENX', pass: 'secret2' });
  await api('friends/add', { user: 'BENX' }, amy.token); await api('friends/accept', { user: 'AMYX' }, ben.token);
  const A = client(), B = client(), G = client(), S = client(), N = client();
  await Promise.all([A, B, G, S, N].map((c) => c.open));
  A.send({ t: 'hello', name: 'X', token: amy.token });
  B.send({ t: 'hello', name: 'X', token: ben.token, where: 'match' });
  G.send({ t: 'hello', name: 'PLAYER42' });
  S.send({ t: 'hello', name: 'PLAYER77', hide: true });
  await sleep(150); // N never says hello: half-open connections are not listed

  let w = await G.who();
  check('everyone with the game open is listed (not yourself, not the hidden player, not a half-open connection)', names(w).join() === 'AMYX,BENX' && w.n === 2, names(w));
  check('you see what they are doing: in the menus, or playing against bots', w.list.find((p) => p.name === 'BENX').st === 'match' && w.list.find((p) => p.name === 'AMYX').st === 'menu', w.list);
  w = await A.who();
  check('friends come first and are marked FRIEND', w.list[0].name === 'BENX' && w.list[0].friend === true && !w.list.find((p) => p.name === 'PLAYER42').friend, w.list.map((p) => p.name + (p.friend ? '*' : '')));
  check('signed-in players are marked (so ADD FRIEND can show), guests are not', w.list.find((p) => p.name === 'BENX').acc && !w.list.find((p) => p.name === 'PLAYER42').acc, null);

  // rooms: the code only for friends
  B.send({ t: 'create' }); await sleep(150);
  const code = B.last.room.code;
  w = await A.who(); const benForAmy = w.list.find((p) => p.name === 'BENX');
  w = await G.who(); const benForGuest = w.list.find((p) => p.name === 'BENX');
  check('a friend sees your room code (JOIN), a stranger only sees IN A ROOM', benForAmy.room === code && benForAmy.st === 'room' && benForGuest.room === null && benForGuest.st === 'room', { benForAmy, benForGuest });

  // invites
  B.send({ t: 'invite', id: G.id }); await sleep(150);
  check('INVITE pops up on their screen with who, the room and how many are in it', G.last.invite && G.last.invite.from === 'BENX' && G.last.invite.code === code && G.last.invite.n === 1, G.last.invite);
  check('the inviter hears it was sent', B.last.info && /INVITE SENT TO PLAYER42/.test(B.last.info.text), B.last.info);
  B.send({ t: 'invite', id: G.id }); await sleep(150);
  check('inviting the same player again straight away is refused (no spam)', G.count('invite') === 1 && /WAIT/.test(B.last.error.text), B.last.error);
  G.send({ t: 'join', code }); await sleep(150);
  w = await B.who();
  check('after joining they show IN YOUR ROOM, with no INVITE button', w.list.find((p) => p.name === 'PLAYER42').mine === true && w.list.find((p) => p.name === 'PLAYER42').inv === false, w.list.find((p) => p.name === 'PLAYER42'));
  G.send({ t: 'leave' }); await sleep(100);

  // NO THANKS: that player cannot invite you again for a while (the next invite is not delivered)
  A.send({ t: 'create' }); await sleep(150);
  A.send({ t: 'invite', id: G.id }); await sleep(150);
  const before = G.count('invite');
  G.send({ t: 'invite-no', id: A.id }); await sleep(150);
  check('NO THANKS tells the inviter they cannot play right now', A.last.info && /PLAYER42 CANNOT PLAY RIGHT NOW/.test(A.last.info.text), A.last.info);

  // settings
  G.send({ t: 'hello', name: 'PLAYER42', inv: 'off' }); await sleep(100);
  const C = client(); await C.open; C.send({ t: 'hello', name: 'CARL1' }); C.send({ t: 'create' }); await sleep(150);
  C.send({ t: 'invite', id: G.id }); await sleep(150);
  check('INVITES FROM NOBODY: no popup, and the inviter is told', G.count('invite') === before && /NOT TAKING INVITES/.test(C.last.error.text), C.last.error);
  G.send({ t: 'hello', name: 'PLAYER42', inv: 'friends' }); await sleep(100);
  w = await C.who();
  check('INVITES FROM FRIENDS: no INVITE button for strangers', w.list.find((p) => p.name === 'PLAYER42').inv === false, w.list.find((p) => p.name === 'PLAYER42'));
  S.send({ t: 'hello', name: 'PLAYER77', hide: true }); await sleep(50);
  C.send({ t: 'invite', id: S.id }); await sleep(150);
  check('a hidden player cannot be invited by strangers', !S.last.invite && /NOT TAKING INVITES/.test(C.last.error.text), C.last.error);
  B.send({ t: 'hello', name: 'X', token: ben.token, hide: true }); await sleep(100);
  check('a hidden player still shows to friends, but not to strangers', names(await A.who()).includes('BENX') && !names(await C.who()).includes('BENX'), null);
  const fr = await api('friends', null, amy.token);
  check('the friends list on the Profile screen carries their connection, for its INVITE button', fr.friends[0].online && fr.friends[0].id === B.id, fr.friends[0] && { online: fr.friends[0].online, id: fr.friends[0].id });
  // a burst of invites to different players is capped
  const many = []; for (let i = 0; i < 8; i++) { const x = client(); many.push(x); }
  await Promise.all(many.map((x) => x.open)); many.forEach((x, i) => x.send({ t: 'hello', name: 'BOT' + i })); await sleep(150);
  many.forEach((x) => C.send({ t: 'invite', id: x.id })); await sleep(250);
  check('at most 6 invites a minute', many.filter((x) => x.last.invite).length === 6, many.filter((x) => x.last.invite).length);
  S.ws.close(); await sleep(150);
  check('a closed game leaves the list', !names(await C.who()).includes('PLAYER77'), null);
  for (const x of [A, B, G, N, C, ...many]) x.ws.close();

  // the browser: the popup, J joins, and the list (SERVER_ONLY=1 skips it, for a quick run)
  if (!process.env.SERVER_ONLY) await browserPart();

  srv.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(results.join('\n'));
  process.exitCode = results.some((x) => x.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });

async function browserPart() {
  const { open } = require('./harness');
  const { browser, page, logs } = await open();
  const r = await page.evaluate(() => {
    const N = EGO.Net, out = {};
    let joined = null; N.join = (c) => { joined = c; };
    N.onMessage({ t: 'invite', id: 'p9', from: 'BENX', friend: true, code: 'QK7Z', mode: 'quick', n: 3 });
    const pop = document.getElementById('invite-pop');
    out.shown = !pop.hidden; out.text = pop.textContent.replace(/\s+/g, ' ').trim();
    EGO.Input.edges.add('KeyJ'); EGO.Game.stepManual(1);
    out.joined = joined; out.hiddenAfter = pop.hidden; out.screen = EGO.UI.cur;
    N.ws = { readyState: 1, send() {} };
    N.onMessage({ t: 'who', n: 3, list: [{ id: 'p2', name: 'BENX', acc: true, friend: true, st: 'room', room: 'QK7Z', mine: false, inv: true }, { id: 'p3', name: 'PLAYER42', acc: false, friend: false, st: 'match', room: null, mine: false, inv: true }, { id: 'p4', name: 'CARL1', acc: true, friend: false, st: 'menu', room: null, mine: false, inv: false }] });
    const rows = [...document.querySelectorAll('#on-who .who-row')].map((r) => [...r.children].map((c) => c.textContent.trim()).join(' '));
    out.rows = rows;
    EGO.Account.token = 'x'; N.renderWho(); out.addBtns = document.querySelectorAll('#on-who [data-add]').length; EGO.Account.token = null;
    N.ws = null;
    N.onMessage({ t: 'invite', id: 'p9', from: 'CARL1', friend: false, code: 'ABCD', mode: 'koth', n: 1 });
    EGO.Input.edges.add('KeyN'); EGO.Game.stepManual(1);
    out.declined = pop.hidden;
    out.howto = document.getElementById('scr-howto').textContent;
    return out;
  });
  check('an invite pops up with who and the room', r.shown && /BENX \(FRIEND\) INVITED YOU TO PLAY/.test(r.text) && /3 PLAYERS IN THE ROOM/.test(r.text), r.text);
  check('J joins their room (and opens PLAY WITH FRIENDS)', r.joined === 'QK7Z' && r.hiddenAfter && r.screen === 'online', { joined: r.joined, hidden: r.hiddenAfter, screen: r.screen });
  check('N says no thanks', r.declined, null);
  check('the list shows friends, what everyone is doing, INVITE and JOIN buttons', r.rows.length === 3 && /BENX FRIEND IN A ROOM INVITE JOIN/.test(r.rows[0]) && /PLAYER42 PLAYING BOTS INVITE/.test(r.rows[1]) && !/INVITE/.test(r.rows[2]), r.rows);
  check('signed in, ADD FRIEND shows for other signed-in players who are not friends yet', r.addBtns === 1, r.addBtns);
  check('How to Play explains it for keyboard, controller and touch', /Players online/.test(r.howto) && /J joins their room/.test(r.howto) && /A joins their room/.test(r.howto) && /tap JOIN/.test(r.howto), null);
  const errs = logs.filter((l) => /error/i.test(l));
  check('no errors in the console', errs.length === 0, errs.slice(0, 3));
  await browser.close();
}
