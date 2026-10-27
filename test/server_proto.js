// Online server, protocol level: two pretend players create and join a room, play a short match by
// sending controls, get snapshots, see the end, and can start a rematch. Starts its own server.
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18787;

function client(name) {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws');
  const c = { ws, name, msgs: [], snaps: 0, last: {}, ends: 0 };
  ws.on('message', (raw) => { const m = JSON.parse(raw); c.msgs.push(m.t); c.last[m.t] = m; if (m.t === 'snap') c.snaps++; if (m.t === 'end') c.ends++; });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = new Promise((r) => ws.on('open', r));
  return c;
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '8', GOLDEN_SECONDS: '2' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  check('server starts', /SCORZ server/.test(out), out.trim().split('\n')[0]);
  const page = await fetch('http://localhost:' + PORT + '/').then((r) => r.text()).catch(() => '');
  check('server also serves the game page', /<title>SCORZ<\/title>/.test(page));

  const a = client('ALI'), b = client('BEN');
  await a.open; await b.open;
  a.send({ t: 'hello', name: 'ali!!', style: 'THUNDER', look: { hair: 'MOHAWK' }, club: 'EMBER' });
  b.send({ t: 'hello', name: 'Ben', style: 'ROOKIE' });
  a.send({ t: 'create' }); await sleep(200);
  const code = a.last.room && a.last.room.code;
  check('create a room with a 4-letter code', /^[A-Z0-9]{4}$/.test(code || ''), code);
  b.send({ t: 'join', code: 'ZZZZ' }); await sleep(100);
  check('a wrong code is refused', b.last.error && /NO ROOM/.test(b.last.error.text), b.last.error);
  b.send({ t: 'join', code }); await sleep(200);
  const room = a.last.room;
  check('a friend joins with the code, on the other team', room.players.length === 2 && room.players[0].name === 'ALI' && room.players[0].team !== room.players[1].team, room.players);
  b.send({ t: 'start' }); await sleep(100);
  check('only the host can start', !b.last.start, b.msgs.slice(-3));
  a.send({ t: 'settings', mode: 'koth', size: 4 }); await sleep(100);
  check('the host picks the mode and team size', a.last.room.mode === 'koth' && a.last.room.size === 4, a.last.room);
  a.send({ t: 'start' }); await sleep(300);
  const st = a.last.start;
  check('the match starts with bots in the empty spots', st && st.roster.length === 8 && st.roster.filter((p) => p.id).length === 2 && st.roster.find((p) => p.id && p.name === 'ALI').style === 'THUNDER', st && st.roster.map((p) => p.team + p.role + (p.id ? '@' + p.name : '')));
  // play: ALI runs forward and shoots now and then
  const t0 = Date.now(); let n = 0;
  const iv = setInterval(() => { n++; a.send({ t: 'input', mx: 0, my: 1, sp: true, sd: n % 20 === 0, sh: n % 20 < 10, su: n % 20 === 10, cy: 0, aim: [0, 1, 38.5] }); b.send({ t: 'input', mx: 1, my: 0, cy: Math.PI }); }, 33);
  await sleep(4000);
  const s1 = a.last.snap;
  check('snapshots arrive about 20 times a second', a.snaps > 60 && b.snaps > 60, { a: a.snaps, b: b.snaps, secs: ((Date.now() - t0) / 1000).toFixed(1) });
  check('your own numbers come with them', s1 && s1.me && s1.me.cd.length === 3 && s1.me.st > 0, s1 && s1.me);
  const ali = s1.pl[s1.me.i];
  check('your controls move your player on the server', ali[2] > 3, { z: ali[2] });
  check('King of the Hill ring is in the snapshot', Array.isArray(s1.hill), s1.hill);
  for (let i = 0; i < 60 && !(a.ends && b.ends); i++) await sleep(500); // kickoff, 8s of play, maybe golden goal, the final whistle
  clearInterval(iv);
  check('the match ends and everyone gets the result', a.ends === 1 && b.ends === 1 && a.last.end.players.length === 8, { ends: [a.ends, b.ends], score: a.last.end && a.last.end.score });
  check('back in the room for a rematch', a.last.room.state === 'room' && a.last.room.players.length === 2, a.last.room.state);
  a.send({ t: 'start' }); await sleep(300);
  check('rematch with the same group', a.msgs.filter((m) => m === 'start').length === 2);
  // leaving mid-match: a bot takes over, the friend becomes host
  a.ws.close(); await sleep(400);
  check('when the host leaves, the friend becomes host', b.last.room.host !== a.last.room.host && b.last.room.players.length === 1, b.last.room);
  const snapsBefore = b.snaps; await sleep(1000);
  check('the match keeps going for the others', b.snaps > snapsBefore + 10, b.snaps - snapsBefore);
  b.ws.close(); await sleep(200);
  const h = await fetch('http://localhost:' + PORT + '/health').then((r) => r.text()).catch(() => '');
  check('an empty room is closed', /ok 0 rooms/.test(h), h);
  check('no server errors', !/Error|TypeError/.test(out), out.trim().split('\n').slice(1, 5));
  srv.kill();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
