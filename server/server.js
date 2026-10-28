#!/usr/bin/env node
/*
 * SCORZ online server.
 *   npm run server          (or: node server/server.js)
 * then open http://localhost:8787 and pick PLAY WITH FRIENDS.
 *
 * One server runs every online match with the same code as the browser game (src/), 60 steps a second,
 * and sends each player a snapshot 20 times a second. Players send only their controls.
 * It also serves the built game (docs/index.html), so one address is all your friends need.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const THREE = require('three');
const G = require('./headless').load();
const Accounts = require('./accounts');
const Filter = require('./filter');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const PORT = Number(process.env.PORT) || 8787;
const STEP = 1 / 60, SNAP_EVERY = 3;
const MODES_OK = ['quick', 'koth', 'volleys', 'duel'];
const STATES = ['free', 'dash', 'slide', 'dive', 'down', 'stun', 'frozen', 'celebrate', 'kickoff', 'hold', 'windup'];
const KICKS = [null, 'backheel', 'rabona', 'outside', 'nolook'];
const FX_SENT = ['burst', 'turbo', 'shuffle', 'lockdown', 'skyTrap', 'vision', 'scent', 'loaded', 'call', 'bubble', 'feathers'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// doing nothing while the ball is in play: a warning after IDLE_SECONDS, a bot after IDLE_GRACE more
const IDLE_WARN = Number(process.env.IDLE_SECONDS) || 30, IDLE_GRACE = Number(process.env.IDLE_GRACE) || 10;
const rooms = new Map();
const online = new Map(); // account name -> connection, so friends can see who is on and in which room
let nextId = 1;

/* ---------- the web page ---------- */
const PAGE = path.join(__dirname, '..', 'docs', 'index.html');
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/api/')) { api(req, res, url.slice(5)); return; }
  if (url === '/' || url === '/index.html') {
    fs.readFile(PAGE, (err, data) => {
      if (err) { res.writeHead(500); res.end('Build the game first: npm run build'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(data);
    });
  } else if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok ' + rooms.size + ' rooms'); }
  else { res.writeHead(404); res.end('not found'); }
});

/* ---------- accounts and friends (JSON over HTTP, a sign-in token in the Authorization header) ---------- */
const tries = new Map(); // sign-in attempts per address, to slow down password guessing
function api(req, res, route) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const reply = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 160 * 1024) { reply(413, { error: 'TOO BIG' }); req.destroy(); } });
  req.on('end', () => {
    let data = {}; try { data = body ? JSON.parse(body) : {}; } catch (e) { reply(400, { error: 'BAD REQUEST' }); return; }
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const u = Accounts.byToken(token);
    if (route === 'register' || route === 'login') {
      const ip = req.socket.remoteAddress || '?', t = (tries.get(ip) || []).filter((x) => Date.now() - x < 60000);
      if (t.length >= 10) { reply(429, { error: 'TOO MANY TRIES. WAIT A MINUTE.' }); return; }
      t.push(Date.now()); tries.set(ip, t);
      const r = route === 'register' ? Accounts.register(data.user, data.pass) : Accounts.login(data.user, data.pass);
      reply(r.error ? 400 : 200, r); return;
    }
    if (!u) { reply(401, { error: 'SIGN IN AGAIN' }); return; }
    const friendInfo = (name) => { const f = Accounts.get(name), c = online.get(name); return { user: name, online: !!c, room: c && c.room ? c.room.code : null, playing: !!(c && c.room && c.room.match), card: f ? Accounts.card(f) : null }; };
    switch (route) {
      case 'me': reply(200, { user: u.user, save: u.save }); return;
      case 'logout': Accounts.logout(u, token); reply(200, { ok: true }); return;
      case 'save': { const r = Accounts.setSave(u, data.save); reply(r.error ? 400 : 200, r); return; }
      case 'friends': reply(200, { friends: u.friends.map(friendInfo), requests: u.requests.slice() }); return;
      case 'friends/add': { const r = Accounts.addFriend(u, data.user); reply(r.error ? 400 : 200, r); return; }
      case 'friends/accept': { const r = Accounts.accept(u, data.user); reply(r.error ? 400 : 200, r); return; }
      case 'friends/decline': reply(200, Accounts.decline(u, data.user)); return;
      case 'friends/remove': reply(200, Accounts.remove(u, data.user)); return;
    }
    if (route.startsWith('card/')) {
      const name = route.slice(5).toUpperCase(), f = Accounts.get(name);
      if (!f || (f !== u && !u.friends.includes(f.user))) { reply(404, { error: 'ONLY FRIENDS CAN SEE THAT CARD' }); return; }
      reply(200, Accounts.card(f)); return;
    }
    reply(404, { error: 'NOT FOUND' });
  });
}

/* ---------- helpers ---------- */
const clean = (s, n) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, n);
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const r2 = (v) => Math.round(v * 100) / 100;
function newCode() { let c; do { c = ''; for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; } while (rooms.has(c)); return c; }
function maxPerTeam(room) { return room.size - 1; } // keepers are always bots
function summary(room) {
  return { t: 'room', code: room.code, host: room.host, mode: room.mode, size: room.size, state: room.match ? 'match' : 'room',
    players: room.players.map((p) => ({ id: p.id, name: p.name, team: p.team })) };
}
function broadcast(room, msg) { const s = JSON.stringify(msg); for (const p of room.players) if (p.ws.readyState === 1) p.ws.send(s); }
function sync(room) { broadcast(room, summary(room)); }
function pickTeam(room) {
  const n = [0, 1].map((t) => room.players.filter((p) => p.team === t).length);
  return n[0] <= n[1] ? 0 : 1;
}

/** a player's controls from their input message (held buttons stay, presses count once) */
function toCtl(m, prev) {
  const b = (k) => !!(m && m[k]);
  const aim = m && Array.isArray(m.aim) ? new THREE.Vector3(+m.aim[0] || 0, +m.aim[1] || 0, +m.aim[2] || 0) : (prev && prev.aim) || null;
  return {
    moveX: Math.max(-1, Math.min(1, +m.mx || 0)), moveY: Math.max(-1, Math.min(1, +m.my || 0)), sprint: b('sp'),
    jump: b('jump'), jumpHeld: b('jh'), shootDown: b('sd'), shootHeld: b('sh'), shootUp: b('su'), passDown: b('pd'), passUp: b('pu'),
    dodge: b('dodge'), tackle: b('tackle'), ab: [b('a0'), b('a1'), b('a2')], flow: b('flow'), awaken: b('aw'), item: false, board: false,
    camYaw: Number.isFinite(+m.cy) ? +m.cy : 0, aim,
  };
}
const EDGES = ['jump', 'shootDown', 'shootUp', 'passDown', 'passUp', 'dodge', 'tackle', 'flow', 'awaken'];
function clearEdges(c) { for (const k of EDGES) c[k] = false; c.ab = [false, false, false]; }
/** moving or pressing anything counts; only turning the camera does not */
const active = (c) => Math.abs(c.moveX) > 0.2 || Math.abs(c.moveY) > 0.2 || c.sprint || c.jumpHeld || c.shootHeld || EDGES.some((k) => c[k]) || c.ab.some(Boolean);
/** one step of the idle clock for a human player */
function idleStep(room, h) {
  h.idleT = (h.idleT || 0) + STEP;
  if (h.idleT < IDLE_WARN) return;
  const left = IDLE_WARN + IDLE_GRACE - h.idleT, s = Math.max(0, Math.ceil(left));
  if (s !== h.idleWarned && s > 0) { h.idleWarned = s; room.events.push({ e: 'idle', s, to: h.netId }); }
  if (left > 0) return;
  // a bot plays for them; they keep watching and get the player back with any button
  const m = room.match;
  h.isHuman = false; h.ctl = null; h.botFor = true; h.wasIdle = true; h.idleT = 0; h.idleWarned = null;
  m.humans = m.humans.filter((x) => x !== h);
  room.events.push({ e: 'bot', to: h.netId });
}

/* ---------- chat ---------- */
const CHAT_MAX = 5, CHAT_WINDOW = 8000; // at most 5 messages in 8 seconds
function chat(me, room, m) {
  const now = Date.now();
  me.chatTimes = (me.chatTimes || []).filter((t) => now - t < CHAT_WINDOW);
  if (me.chatTimes.length >= CHAT_MAX) { send(me.ws, { t: 'chat-note', text: 'SLOW DOWN A LITTLE' }); return; }
  let text, q = -1;
  if (Number.isInteger(m.q) && m.q >= 0 && m.q < G.QUICK_CHAT.length) { q = m.q; text = G.QUICK_CHAT[q]; }
  else {
    // typed chat only for signed-in players, and never for someone the room has reported
    if (!me.account) { send(me.ws, { t: 'chat-note', text: 'SIGN IN ON THE PROFILE SCREEN TO TYPE MESSAGES' }); return; }
    if (room.silenced.has(me.id)) { send(me.ws, { t: 'chat-note', text: 'YOUR TYPED CHAT IS OFF IN THIS ROOM' }); return; }
    text = Filter.clean(m.text).text;
    if (!text) return;
  }
  me.chatTimes.push(now);
  const line = { t: 'chat', id: me.id, name: me.name, team: me.team, text, q };
  room.log.push({ id: me.id, name: me.name, text, at: now }); if (room.log.length > 60) room.log.shift();
  broadcast(room, line);
}
/** a report keeps the last things that player said, for the owner to read in reports.jsonl */
function report(me, room, m) {
  const target = room.players.find((p) => p.id === m.id);
  if (!target || target === me) return;
  const key = me.id + '>' + target.id;
  if (room.reports.has(key)) { send(me.ws, { t: 'reported', id: target.id }); return; }
  room.reports.add(key);
  const entry = { at: new Date().toISOString(), room: room.code, by: me.account || me.name, byAccount: !!me.account, player: target.name, account: target.account || null,
    said: room.log.filter((l) => l.id === target.id).slice(-12).map((l) => l.text) };
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(path.join(DATA_DIR, 'reports.jsonl'), JSON.stringify(entry) + '\n'); } catch (e) { console.error('could not save a report:', e.message); }
  // enough reports in this room (2, or everyone else when there are only two of you): their typed chat stops here
  const others = room.players.length - 1, by = [...room.reports].filter((k) => k.endsWith('>' + target.id)).length;
  if (by >= Math.min(2, others)) room.silenced.add(target.id);
  send(me.ws, { t: 'reported', id: target.id });
}

/* ---------- matches ---------- */
function startMatch(room) {
  const humans = room.players.map((p) => ({ id: p.id, team: p.team, name: p.name, style: p.style, flow: p.flow, look: p.look }));
  // the host's club at home against another club
  const home = G.CLUBS[room.hostClub] ? room.hostClub : 'ROVERS', away = G.CLUB_IDS.filter((c) => c !== home)[Math.floor(Math.random() * (G.CLUB_IDS.length - 1))];
  const m = new G.Match(room.mode, 0.5, { humans, size: room.size, home, away, length: Number(process.env.MATCH_SECONDS) || undefined, goldenLength: Number(process.env.GOLDEN_SECONDS) || undefined });
  room.match = m; room.events = []; room.steps = 0; room.acc = 0; room.last = Date.now();
  for (const h of m.humans) h.ctl = toCtl({}, null);
  const roster = m.players.map((p) => ({ team: p.team, role: p.role, number: p.number, name: p.name, style: p.styleId, flow: p.flowId, look: p.lookIds || null, skin: p.skin, id: p.netId || null }));
  broadcast(room, { t: 'start', mode: room.mode, size: room.size, home: G.TEAM[0].club, away: G.TEAM[1].club, awayKit: G.TEAM[1].away, roster, looks: m.players.map((p) => p.lookIds || null) });
  sync(room);
}
function snapshot(room) {
  const m = room.match, b = m.ball, idx = (p) => (p ? m.players.indexOf(p) : -1);
  const pl = m.players.map((p) => {
    let flags = 0;
    if (p.charging) flags |= 1; if (p.onGround) flags |= 2; if (p.flowT > 0) flags |= 4; if (p.callT > 0 || p.fx.call > 0) flags |= 8;
    if (p.fx.shuffle > 0) flags |= 16; if (p.fx.lockdown > 0) flags |= 32; if (p.fx.bubble > 0) flags |= 64; if (p.awakeT > 0) flags |= 128;
    return [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r2(p.vel.x), r2(p.vel.z), r2(p.yaw), STATES.indexOf(p.state), r2(p.stateT), r2(p.stateDur), r2(p.kickT), KICKS.indexOf(p.kickStyle || null), flags, r2(p.charge),
      p.dive ? p.dive.side : 0, p.dive ? (p.dive.high ? 1 : 0) : 0, p.dive ? r2(p.dive.dur) : 0, r2(p.flipT)];
  });
  const base = { t: 'snap', n: room.steps, ph: m.phase, pt: r2(m.phaseT), c: r2(m.clock), g: m.golden ? r2(m.goldenClock) : -1, s: m.score, b: [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z), idx(b.owner)], pl,
    hill: m.hill ? [r2(m.hill.x), r2(m.hill.z), m.hill.holder] : null, ev: room.events };
  room.events = [];
  for (const rp of room.players) {
    const p = m.humans.find((h) => h.netId === rp.id);
    const me = p ? { i: idx(p), cd: p.abil.map((a) => r2(a.cd)), fl: r2(p.flow), ft: r2(p.flowT), aw: r2(p.awake), awt: r2(p.awakeT), st: r2(p.stamina), dc: p.dodgeCharges, dr: r2(p.dodgeRe), tc: r2(p.tackleCd), tk: r2(p.mods.tackleCd), ph: r2(p.passHold || 0),
      fx: FX_SENT.reduce((o, k) => (p.fx[k] > 0 ? (o[k] = r2(p.fx[k]), o) : o), {}) } : null;
    send(rp.ws, Object.assign({ me }, base));
  }
  // stats for the scoreboard, once a second
  if (room.steps % 60 === 0) broadcast(room, { t: 'stats', st: m.players.map((p) => [p.stats.goals, p.stats.assists, p.stats.shots, p.stats.tackles, p.stats.saves]) });
}
function endMatch(room) {
  const m = room.match;
  broadcast(room, { t: 'end', score: m.score, players: m.players.map((p) => ({ id: p.netId || null, team: p.team, stats: p.stats, feats: p.feats || null, idle: !!p.wasIdle })) });
  m.dispose();
  room.match = null;
  sync(room);
}
function tick(room) {
  const m = room.match; if (!m) return;
  const now = Date.now();
  room.acc = Math.min(0.25, room.acc + (now - room.last) / 1000); room.last = now;
  while (room.acc >= STEP) {
    room.acc -= STEP;
    G.Hud.room = room;
    m.update(STEP);
    for (const h of m.humans) if (h.ctl) clearEdges(h.ctl);
    if (m.phase === 'play') for (const h of m.humans.slice()) idleStep(room, h);
    room.steps++;
    if (room.steps % SNAP_EVERY === 0) snapshot(room);
    if (m.phase === 'end' && m.phaseT > 3.2) { endMatch(room); return; }
  }
}

/* ---------- what the match says to players ---------- */
const H = G.Hud, cur = () => H.room;
const pi = (p) => (p && cur() && cur().match ? cur().match.players.indexOf(p) : -1);
const ev = (e) => { const r = cur(); if (r) r.events.push(e); };
H.toast = (text, cls, to) => { if (to && to.netId) ev({ e: 'toast', text, cls, to: to.netId }); };
H.label = (p, text, color, dur) => ev({ e: 'label', i: pi(p), text, color, dur });
H.banner = (big, small, color, quick) => ev({ e: 'banner', big, small, color, quick: !!quick });
H.goal = (team, scorer, assister, own) => ev({ e: 'goal', team, s: pi(scorer), a: pi(assister), own: !!own });
H.cutin = (p, name) => { if (p.netId) ev({ e: 'cutin', i: pi(p), name, to: p.netId }); };
H.flash = H.flowReady = H.lockHint = () => {};

/* ---------- connections ---------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws) => {
  const me = { id: 'p' + nextId++, ws, name: 'PLAYER', team: 0, style: 'ROOKIE', flow: null, look: {}, club: 'ROVERS', room: null };
  send(ws, { t: 'welcome', id: me.id });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = me.room;
    switch (m.t) {
      case 'hello': { // who I am and what I wear; signed-in players play under their account name
        const acc = m.token ? Accounts.byToken(m.token) : null;
        if (me.account && online.get(me.account) === me) online.delete(me.account);
        me.account = acc ? acc.user : null;
        if (acc) online.set(acc.user, me);
        const typed = clean(m.name, 12) || 'PLAYER';
        me.name = acc ? acc.user : Filter.clean(typed).changed ? 'PLAYER' + (10 + Math.floor(Math.random() * 90)) : typed; // no rude names or numbers
        me.style = G.STYLES[m.style] ? m.style : 'ROOKIE';
        me.flow = G.FLOWS[m.flow] ? m.flow : null;
        me.look = {}; if (m.look && typeof m.look === 'object') for (const s of G.SKIN_SLOTS) if (G.SKINS[m.look[s.id]] && G.SKINS[m.look[s.id]].slot === s.id) me.look[s.id] = m.look[s.id];
        me.club = G.CLUBS[m.club] ? m.club : 'ROVERS';
        if (room) sync(room);
        break;
      }
      case 'create': {
        leave(me);
        const r = { code: newCode(), host: me.id, hostClub: me.club, mode: 'quick', size: 3, players: [], match: null, events: [], log: [], reports: new Set(), silenced: new Set() };
        rooms.set(r.code, r); join(me, r);
        break;
      }
      case 'join': {
        const r = rooms.get(clean(m.code, 4));
        if (!r) { send(ws, { t: 'error', text: 'NO ROOM WITH THAT CODE' }); break; }
        if (r.players.length >= 8) { send(ws, { t: 'error', text: 'THAT ROOM IS FULL' }); break; }
        leave(me); join(me, r);
        break;
      }
      case 'team':
        if (room && !room.match && (m.team === 0 || m.team === 1) && room.players.filter((p) => p.team === m.team).length < maxPerTeam(room)) { me.team = m.team; sync(room); }
        break;
      case 'settings':
        if (room && room.host === me.id && !room.match) {
          if (MODES_OK.includes(m.mode)) room.mode = m.mode;
          room.size = room.mode === 'duel' ? 2 : Math.max(3, Math.min(5, Math.round(+m.size) || room.size));
          if (room.mode !== 'duel' && room.size < 3) room.size = 3;
          // players who no longer fit sit out the next match
          for (const t of [0, 1]) room.players.filter((p) => p.team === t).slice(maxPerTeam(room)).forEach((p) => { p.team = 1 - t; });
          sync(room);
        }
        break;
      case 'start':
        if (room && room.host === me.id && !room.match) {
          for (const t of [0, 1]) if (room.players.filter((p) => p.team === t).length > maxPerTeam(room)) { send(ws, { t: 'error', text: 'TOO MANY PLAYERS ON ONE TEAM' }); return; }
          startMatch(room);
        }
        break;
      case 'input':
        if (room && room.match) {
          const M = room.match;
          let p = M.humans.find((h) => h.netId === me.id);
          const c = toCtl(m, p && p.ctl);
          if (!p) { // a bot is playing for you: any button takes your player back
            p = M.players.find((x) => x.netId === me.id && x.botFor);
            if (!p || !active(c)) break;
            p.isHuman = true; p.botFor = false; M.humans.push(p); p.ctl = null;
            room.events.push({ e: 'back', to: me.id });
          }
          if (active(c)) { p.idleT = 0; if (p.idleWarned != null) { p.idleWarned = null; room.events.push({ e: 'idleok', to: me.id }); } }
          for (const k of EDGES) c[k] = c[k] || (p.ctl && p.ctl[k]); c.ab = c.ab.map((v, i) => v || (p.ctl && p.ctl.ab[i])); p.ctl = c;
        }
        break;
      case 'chat': if (room) chat(me, room, m); break;
      case 'report': if (room) report(me, room, m); break;
      case 'leave': leave(me); send(ws, { t: 'left' }); break;
    }
  });
  ws.on('close', () => { leave(me); if (me.account && online.get(me.account) === me) online.delete(me.account); });
});
function join(me, room) {
  const full = (t) => room.players.filter((p) => p.team === t).length >= maxPerTeam(room);
  if (full(0) && full(1)) { send(me.ws, { t: 'error', text: 'THAT ROOM IS FULL' }); return; }
  me.room = room; me.team = pickTeam(room);
  if (full(me.team)) me.team = 1 - me.team;
  room.players.push(me);
  sync(room);
}
function leave(me) {
  const room = me.room; if (!room) return;
  me.room = null;
  room.players = room.players.filter((p) => p !== me);
  if (room.match) { const p = room.match.players.find((h) => h.netId === me.id); if (p) { p.isHuman = false; p.netId = null; p.ctl = null; p.botFor = false; room.match.humans = room.match.humans.filter((h) => h !== p); } } // a bot takes over
  if (!room.players.length) { if (room.match) room.match.dispose(); rooms.delete(room.code); return; }
  if (room.host === me.id) { room.host = room.players[0].id; room.hostClub = room.players[0].club; }
  sync(room);
}

setInterval(() => { for (const r of rooms.values()) tick(r); }, 1000 / 60);
server.listen(PORT, () => console.log('SCORZ server on http://localhost:' + PORT + '  (WebSocket: ws://localhost:' + PORT + '/ws)'));
