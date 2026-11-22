// CrazyGames name check on our server (owner, Nov 2026: "check names online"). Our own key pair stands in for theirs: a
// tiny local page serves the public key (CG_JWKS_URL) and we sign tokens like their getUserToken() does. The server
// accepts a real, fresh token for our game, turns everything else down, gives the player their CrazyGames name, and
// nobody else online can use that name (someone already using it is renamed, and a newcomer cannot take it).
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18833, JWKS_PORT = 18834, GAME_ID = '20267', ROOT = path.join(__dirname, '..');

const KEYS = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), OTHER = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(KEYS.publicKey.export({ format: 'jwk' }), { kid: 'ingame-auth', alg: 'RS256', use: 'sig' });
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const sign = (payload, key = KEYS.privateKey, kid = 'ingame-auth') => {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const b = b64u(JSON.stringify(Object.assign({ userId: 'u-1', gameId: GAME_ID, username: 'RustyCake.ZU9H', profilePictureUrl: '', iat: now, exp: now + 3600 }, payload)));
  return h + '.' + b + '.' + b64u(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + b), key));
};

(async () => {
  const jwks = http.createServer((q, r) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ keys: [jwk] })); }).listen(JWKS_PORT);
  // the check itself, straight from the module
  process.env.CG_JWKS_URL = 'http://localhost:' + JWKS_PORT + '/jwks.json'; process.env.CG_GAME_ID = GAME_ID;
  const CGAuth = require('../server/cgauth');
  const now = Math.floor(Date.now() / 1000);
  const good = await CGAuth.verify(sign({}));
  const expired = await CGAuth.verify(sign({ iat: now - 7200, exp: now - 3600 }));
  const otherGame = await CGAuth.verify(sign({ gameId: '999' }));
  const forged = await CGAuth.verify(sign({}, OTHER.privateKey));
  const tampered = (() => { const t = sign({}).split('.'); t[1] = b64u(JSON.stringify({ userId: 'u-2', gameId: GAME_ID, username: 'SOMEONEELSE', exp: now + 3600 })); return t.join('.'); })();
  const edited = await CGAuth.verify(tampered);
  const junk = [await CGAuth.verify('not.a.token'), await CGAuth.verify(''), await CGAuth.verify(null), await CGAuth.verify('a.b')];
  check('a real, fresh token for our game is accepted (their username and id come out)', good && good.username === 'RustyCake.ZU9H' && good.id === 'u-1', good);
  check('run out, another game, signed with the wrong key, edited, or junk: all turned down', expired === null && otherGame === null && forged === null && edited === null && junk.every((j) => j === null), { expired, otherGame, forged, edited, junk });

  // the server: names
  const srv = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT) }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  const client = () => new Promise((ok) => {
    const ws = new WebSocket('ws://localhost:' + PORT + '/ws'), c = { ws, msgs: [], last: (t) => [...c.msgs].reverse().find((m) => m.t === t) };
    ws.on('message', (raw) => { try { c.msgs.push(JSON.parse(raw)); } catch (e) {} });
    ws.on('open', () => ok(c));
  });
  const send = (c, m) => c.ws.send(JSON.stringify(m));
  const names = (c) => { const r = c.last('room'); return r ? r.players.map((p) => p.name + (p.v ? '+' : '')) : []; };

  const faker = await client(); send(faker, { t: 'hello', name: 'RUSTYCAKEZU9' }); await sleep(150);
  send(faker, { t: 'create' }); await sleep(300);
  const before = names(faker);
  const real = await client(); send(real, { t: 'hello', name: 'RUSTYCAKEZU9' }); await sleep(100);
  send(real, { t: 'cgauth', token: sign({}) }); await sleep(600);
  send(real, { t: 'join', code: faker.last('room').code }); await sleep(400);
  const after = names(faker), ack = real.last('cgauth');
  check('a checked CrazyGames player gets their name (with a tick); someone already using it without the account is renamed', before[0] === 'RUSTYCAKEZU9' && ack && ack.ok === true && after.includes('RUSTYCAKEZU9+') && after.filter((n) => /^RUSTYCAKEZU9/.test(n)).length === 1 && after.some((n) => /^PLAYER\d\d$/.test(n)), { before, after, ack });
  const late = await client(); send(late, { t: 'hello', name: 'RUSTYCAKEZU9' }); await sleep(100);
  send(late, { t: 'join', code: faker.last('room').code }); await sleep(400);
  const late2 = names(faker);
  check('while they are online, nobody else can take that name', late2.filter((n) => /^RUSTYCAKEZU9/.test(n)).length === 1 && late2.filter((n) => /^PLAYER\d\d$/.test(n)).length === 2, late2);
  send(real, { t: 'hello', name: 'SOMETHINGELSE' }); await sleep(300);
  check('a checked player keeps their CrazyGames name even if their game says another', names(faker).includes('RUSTYCAKEZU9+'), names(faker));
  const bad = await client(); send(bad, { t: 'hello', name: 'TRYING' }); send(bad, { t: 'cgauth', token: sign({}, OTHER.privateKey) }); await sleep(500);
  check('a forged token gets a no, and no tick', bad.last('cgauth') && bad.last('cgauth').ok === false, bad.last('cgauth'));

  for (const c of [faker, real, late, bad]) c.ws.close();
  srv.kill(); jwks.close();
  check('no server errors', !/Error|TypeError/.test(out), out.split('\n').filter((l) => /Error/.test(l)).slice(0, 3));
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message); process.exit(1); });
