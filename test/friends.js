// Online server with a big group of friends: rooms grow as friends join (up to 5v5 with computer keepers,
// 8 friends), a Duel room turns into a normal match when a third friend arrives, the host cannot shrink a
// room below what holds everyone, and 8 friends play one match where everyone moves their own player.
// Starts its own server.
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const Filter = require('../server/filter');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18791;

function client(name) {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws');
  const c = { ws, name, msgs: [], snaps: 0, last: {}, infos: [] };
  ws.on('message', (raw) => { const m = JSON.parse(raw); c.msgs.push(m.t); c.last[m.t] = m; if (m.t === 'snap') c.snaps++; if (m.t === 'info') c.infos.push(m.text); });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = new Promise((r) => ws.on('open', r));
  return c;
}
const teams = (room) => [0, 1].map((t) => room.players.filter((p) => p.team === t).length);

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '20', GOLDEN_SECONDS: '2' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  check('server starts', /SCORZ server/.test(out), out.trim().split('\n')[0]);

  const names = ['HOST', 'AMY', 'BOB', 'CAT', 'DAN', 'EVE', 'FIN', 'GUS', 'HAL'];
  const cs = names.map(client);
  await Promise.all(cs.map((c) => c.open));
  cs.forEach((c, i) => c.send({ t: 'hello', name: c.name, style: i % 2 ? 'SPRINTER' : 'THUNDER' }));
  const host = cs[0];
  host.send({ t: 'create' }); await sleep(200);
  const code = host.last.room.code;
  const sizeAfter = [];
  for (let i = 1; i <= 7; i++) { cs[i].send({ t: 'join', code }); await sleep(150); sizeAfter.push(host.last.room.size); }
  // 2 players fit a 3v3 room per team (the keeper is a computer), so: 3,3,3 then 4,4 then 5,5
  check('a 3v3 room holds 4 friends', sizeAfter[2] === 3 && host.last.room.players.length === 8, sizeAfter);
  check('the 5th friend makes it 4v4 instead of "room full"', sizeAfter[3] === 4, sizeAfter);
  check('the 7th friend makes it 5v5', sizeAfter[5] === 5 && sizeAfter[6] === 5, sizeAfter);
  check('everyone hears that the room grew', cs[1].infos.some((t) => /4V4/.test(t)) && cs[1].infos.some((t) => /5V5/.test(t)), cs[1].infos);
  check('8 friends split 4 and 4', teams(host.last.room).join() === '4,4', teams(host.last.room));
  check('a friend called BOB keeps that name (the filter used to squeeze a rude word into it)', host.last.room.players.some((p) => p.name === 'BOB'), host.last.room.players.map((p) => p.name));
  cs[8].send({ t: 'join', code }); await sleep(150);
  check('a 9th friend is told the room is full', cs[8].last.error && /FULL/.test(cs[8].last.error.text) && host.last.room.players.length === 8, cs[8].last.error);
  host.send({ t: 'settings', mode: 'quick', size: 3 }); await sleep(150);
  check('the host cannot shrink the room below what holds everyone', host.last.room.size === 5, host.last.room.size);
  host.send({ t: 'settings', mode: 'duel' }); await sleep(150);
  check('a Duel needs exactly two, so it stays a normal match', host.last.room.mode === 'quick' && host.last.room.size === 5, host.last.room);

  // the match: 8 friends + 2 computer keepers
  host.send({ t: 'start' }); await sleep(400);
  const st = cs[3].last.start;
  check('everyone gets the start', cs.slice(0, 8).every((c) => c.last.start), cs.slice(0, 8).map((c) => !!c.last.start));
  check('5v5 with 8 friends and 2 computer keepers', st && st.roster.length === 10 && st.roster.filter((p) => p.id).length === 8 && st.roster.filter((p) => !p.id).every((p) => p.role === 'GK'), st && st.roster.map((p) => p.role + (p.id ? '@' + p.name : '')));
  // everyone runs to their own side of the pitch (left or right), so we can tell they move their own player
  const dir = (i) => (i % 2 ? 1 : -1);
  const iv = setInterval(() => cs.slice(0, 8).forEach((c, i) => c.send({ t: 'input', mx: dir(i), my: 0, sp: true, cy: 0 })), 33);
  await sleep(1500);
  const x0 = cs.slice(0, 8).map((c) => { const s = c.last.snap; return s && s.me ? s.pl[s.me.i][0] : null; });
  await sleep(2500);
  const snaps = cs.slice(0, 8).map((c) => c.last.snap);
  const idx = snaps.map((s) => (s && s.me ? s.me.i : -1));
  check('each friend has their own player', new Set(idx).size === 8 && idx.every((i) => i >= 0), idx);
  check('snapshots reach all 8', cs.slice(0, 8).every((c) => c.snaps > 50), cs.slice(0, 8).map((c) => c.snaps));
  const moved = snaps.map((s, i) => +(s.pl[s.me.i][0] - x0[i]).toFixed(1));
  // camera yaw 0 looks up the pitch, so +moveX is the same world direction for everyone
  check('each friend moves their own player', moved.every((d, i) => Math.sign(d) === Math.sign(moved[i % 2]) && Math.abs(d) > 1.5) && Math.sign(moved[0]) !== Math.sign(moved[1]), moved);
  clearInterval(iv);
  // a friend joins mid-match: they wait for the next one, nobody is thrown out
  const late = client('LATE'); await late.open; late.send({ t: 'hello', name: 'LATE' });
  cs[7].ws.close(); await sleep(300); // one leaves (a bot takes over) to make room
  late.send({ t: 'join', code }); await sleep(300);
  check('a friend can join while a match is on and waits for the next one', late.last.room && late.last.room.state === 'match' && late.last.room.players.some((p) => p.name === 'LATE'), late.last.room && late.last.room.state);
  const before = host.snaps; await sleep(800);
  check('the match keeps going', host.snaps > before + 8, host.snaps - before);

  // a Duel room: the third friend turns it into a normal match
  const d = [client('D1'), client('D2'), client('D3')];
  await Promise.all(d.map((c) => c.open));
  d.forEach((c) => c.send({ t: 'hello', name: c.name }));
  d[0].send({ t: 'create' }); await sleep(150);
  d[0].send({ t: 'settings', mode: 'duel' }); await sleep(150);
  const dc = d[0].last.room.code;
  d[1].send({ t: 'join', code: dc }); await sleep(150);
  check('a Duel room is 1 against 1', d[0].last.room.mode === 'duel' && teams(d[0].last.room).join() === '1,1', d[0].last.room);
  d[2].send({ t: 'join', code: dc }); await sleep(150);
  check('a third friend turns the Duel into a 3v3 match', d[0].last.room.mode === 'quick' && d[0].last.room.size === 3 && d[0].last.room.players.length === 3, d[0].last.room);

  const names2 = ['BOB', 'BOBBY', 'KSHITIJ', 'SHITAL', 'ASHIT', 'NAZIA', 'NAZIR', 'DICKSON', 'PISCES', 'GG KSHITIJ'];
  check('ordinary names pass the filter', names2.every((n) => !Filter.clean(n).changed), names2.filter((n) => Filter.clean(n).changed));
  const rude = ['b00bs', 'piss off', 'sh1t', 'fuuuck', 'f u c k', 'WHATASHIT', 'kshitijshit', 'bobshit', 'DICKHEAD', 'nazi'];
  check('swear words are still caught, also hidden next to a name', rude.every((n) => Filter.clean(n).changed), rude.filter((n) => !Filter.clean(n).changed));
  check('no server errors', !/Error|TypeError/.test(out), out.trim().split('\n').slice(1, 5));
  [...cs, late, ...d].forEach((c) => c.ws.close());
  srv.kill();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
