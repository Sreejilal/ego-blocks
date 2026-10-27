// Chat in online rooms: quick chat for everyone, typed chat only when signed in, the swear filter, links and
// numbers removed, the rate limit, mute, report (saved for the owner, and typed chat off after enough reports),
// then the same in real browsers: the room panel, keys 1 to 4 and T in a match, the phone chat button.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18790, BASE = 'http://localhost:' + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'scorz-chat-'));
const api = (p, body) => fetch(BASE + '/api/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

/** a bare WebSocket player that remembers every message */
function client(name, token) {
  return new Promise((res) => {
    const ws = new WebSocket('ws://localhost:' + PORT + '/ws'), c = { ws, got: [], id: null };
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') c.id = m.id; if (m.t !== 'snap' && m.t !== 'stats') c.got.push(m); });
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', name, token })); res(c); });
  });
}
const tell = (c, m) => c.ws.send(JSON.stringify(m));
const chats = (c) => c.got.filter((m) => m.t === 'chat');
const notes = (c) => c.got.filter((m) => m.t === 'chat-note').map((m) => m.text);

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, MATCH_SECONDS: '40' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);

  /* ---------- the rules, straight on the server ---------- */
  const acc = await api('register', { user: 'SAYER', pass: 'secret12' });
  const X = await client('X', acc.token), Y = await client('YOU2'), Z = await client('ZED');
  tell(X, { t: 'create' }); await sleep(200);
  const code = X.got.find((m) => m.t === 'room').code;
  tell(Y, { t: 'join', code }); tell(Z, { t: 'join', code }); await sleep(300);
  tell(Y, { t: 'chat', q: 0 }); await sleep(200);
  check('quick chat works for guests and everyone sees it', [X, Y, Z].every((c) => chats(c).some((m) => m.text === 'PASS!' && m.q === 0 && m.name === 'YOU2')));
  tell(Y, { t: 'chat', text: 'hello all' }); await sleep(200);
  check('guests cannot type messages', !chats(X).some((m) => /HELLO/.test(m.text)) && notes(Y).some((t) => /SIGN IN/.test(t)), notes(Y));
  tell(X, { t: 'chat', text: 'what the fuck nice goal' }); tell(X, { t: 'chat', text: 'join www.bad-site.com or call 98765 43210' }); await sleep(250);
  const typed = chats(Y).filter((m) => m.name === 'SAYER').map((m) => m.text);
  check('signed-in players can type, swear words are hidden', typed[0] === 'WHAT THE **** NICE GOAL', typed[0]);
  check('links and phone numbers are removed', typed[1] && !/bad-site|98765/i.test(typed[1]) && /LINK REMOVED/.test(typed[1]), typed[1]);
  const before = chats(X).length;
  for (let i = 0; i < 8; i++) tell(Z, { t: 'chat', q: 1 });
  await sleep(300);
  check('too many messages at once are slowed down', chats(X).length - before === 5 && notes(Z).some((t) => /SLOW DOWN/.test(t)), { got: chats(X).length - before });
  tell(X, { t: 'chat', q: 99 }); tell(X, { t: 'chat', text: { evil: 1 } }); tell(X, { t: 'report', id: 'nobody' }); await sleep(150);
  tell(Y, { t: 'report', id: X.id }); await sleep(200);
  check('a report is confirmed', Y.got.some((m) => m.t === 'reported' && m.id === X.id));
  tell(X, { t: 'chat', text: 'still here' }); await sleep(200);
  check('one report out of three players does not stop their chat yet', chats(Z).some((m) => m.text === 'STILL HERE'));
  tell(Y, { t: 'report', id: X.id }); tell(Z, { t: 'report', id: X.id }); await sleep(250);
  tell(X, { t: 'chat', text: 'can you hear me' }); tell(X, { t: 'chat', q: 2 }); await sleep(250);
  check('after two reports their typed chat is off in that room, quick chat still works', !chats(Z).some((m) => /CAN YOU/.test(m.text)) && chats(Z).some((m) => m.name === 'SAYER' && m.text === 'GG') && notes(X).some((t) => /OFF IN THIS ROOM/.test(t)), notes(X));
  const lines = fs.readFileSync(path.join(DATA, 'reports.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  check('reports are saved for the owner with what was said (and the same report counts once)', lines.length === 2 && lines[0].player === 'SAYER' && lines[0].account === 'SAYER' && lines[0].said.includes('WHAT THE **** NICE GOAL') && lines[1].by === 'ZED', lines.map((l) => [l.by, l.player, l.said.length]));
  for (const c of [X, Y, Z]) c.ws.close();
  await sleep(200);

  /* ---------- in the game ---------- */
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts, url) => {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    p.on('pageerror', (e) => logs.push(e.message));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(url || BASE + '/'); await sleep(2500); return p;
  };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  await A.evaluate(() => EGO.Account.signIn('chatty', 'password1', true)); await sleep(500);
  await A.evaluate(() => EGO.Net.open()); await A.click('#on-create'); await sleep(800);
  const link = await A.evaluate(() => EGO.Net.inviteLink());
  const B = await mk({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, link);
  for (let i = 0; i < 40; i++) { if (await B.evaluate(() => !!(EGO.Net.room)).catch(() => false)) break; await sleep(250); }
  await sleep(400);
  const ui = await Promise.all([A, B].map((p) => p.evaluate(() => ({ chat: !document.getElementById('on-chat').hidden, type: !document.querySelector('#on-chat .chat-type').hidden, guest: !document.querySelector('#on-chat .chat-guest').hidden }))));
  check('the room has a chat; typing only for the signed-in player', ui[0].chat && ui[0].type && !ui[0].guest && ui[1].chat && !ui[1].type && ui[1].guest, ui);
  await B.tap('#on-quick [data-q="1"]'); await sleep(400);
  await A.fill('#on-say', 'hello shit'); await A.press('#on-say', 'Enter'); await sleep(400);
  const logA = await A.evaluate(() => document.getElementById('on-log').textContent), logB = await B.evaluate(() => document.getElementById('on-log').textContent);
  check('quick chat from the phone shows up on the desktop', /NICE!/.test(logA), logA);
  check('typed chat shows up filtered on the phone', /HELLO \*\*\*\*/.test(logB) && !/SHIT/.test(logB), logB);
  await A.screenshot({ path: __dirname + '/shots/ch1_room_chat.png' });
  await B.screenshot({ path: __dirname + '/shots/ch2_room_chat_phone.png' });
  // mute, then the chat setting
  await B.tap('#on-room [data-mute]'); await sleep(200);
  await A.fill('#on-say', 'secret words'); await A.press('#on-say', 'Enter'); await sleep(400);
  const muted = await B.evaluate(() => ({ log: document.getElementById('on-log').textContent, btn: document.querySelector('#on-room [data-mute]').textContent }));
  check('muting a player hides their messages (and the earlier ones)', !/SECRET/.test(muted.log) && !/HELLO/.test(muted.log) && muted.btn === 'UNMUTE', muted);
  await B.tap('#on-room [data-mute]'); await B.tap('#on-chatset [data-v="quick"]'); await sleep(200);
  await A.fill('#on-say', 'typed line'); await A.press('#on-say', 'Enter'); await A.click('#on-quick [data-q="2"]'); await sleep(400);
  const q = await B.evaluate(() => ({ log: document.getElementById('on-log').textContent, set: EGO.Save.data.settings.chat }));
  check('the QUICK setting shows quick chat only', q.set === 'quick' && /GG/.test(q.log) && !/TYPED LINE/.test(q.log), q);
  await B.tap('#on-chatset [data-v="all"]');
  // a phone held upright joins for a moment: the room and chat fit with no sideways scrolling
  const C = await mk({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, link);
  for (let i = 0; i < 40; i++) { if (await C.evaluate(() => !!(EGO.Net.room)).catch(() => false)) break; await sleep(250); }
  await C.evaluate(() => document.getElementById('on-chat').scrollIntoView()); await sleep(200);
  const fit = await C.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, chat: document.getElementById('on-chat').getBoundingClientRect().width }));
  check('upright phone: room chat fits the screen', fit.sw <= fit.w && fit.chat <= fit.w, fit);
  await C.screenshot({ path: __dirname + '/shots/ch3_room_chat_upright.png' });
  await C.evaluate(() => EGO.Net.send({ t: 'leave' })); await C.context().close(); await sleep(300);

  // in a match
  await A.click('#on-go'); await sleep(2000);
  await A.keyboard.press('Digit1');
  let feedB = '';
  for (let i = 0; i < 16 && !/PASS!/.test(feedB); i++) { await sleep(250); feedB = await B.evaluate(() => document.getElementById('chatfeed').textContent); }
  check('in a match, key 1 sends PASS! and it shows in the corner', /CHATTY/.test(feedB) && /PASS!/.test(feedB), feedB);
  await A.keyboard.press('KeyT'); await sleep(400);
  const pop = await A.evaluate(() => ({ open: !document.getElementById('chat-pop').hidden, focus: document.activeElement && document.activeElement.id }));
  await A.keyboard.down('KeyW'); await sleep(150);
  const still = await A.evaluate(() => ({ w: EGO.Input.down.has('KeyW'), held: EGO.Net.held }));
  await A.keyboard.up('KeyW');
  check('T opens the chat box, and typing does not move your player', pop.open && pop.focus === 'cp-say' && !still.w && still.held === null, Object.assign(pop, still));
  await A.screenshot({ path: __dirname + '/shots/ch4_match_chat_box.png' });
  await A.keyboard.type(' good game'); await A.keyboard.press('Enter'); await sleep(600);
  const after = await Promise.all([A.evaluate(() => !document.getElementById('chat-pop').hidden), B.evaluate(() => document.getElementById('chatfeed').textContent)]);
  check('Enter sends it and closes the box', !after[0] && /W GOOD GAME/.test(after[1]), after);
  // the phone: chat button next to pause, guests get quick chat
  const btn = await B.evaluate(() => { const b = document.querySelector('#touch [data-act="chat"]'); const r = b.getBoundingClientRect(); return { shown: !b.hidden && !document.getElementById('touch').hidden, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const cdp = await B.context().newCDPSession(B);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 7 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(400);
  const bPop = await B.evaluate(() => ({ open: !document.getElementById('chat-pop').hidden, type: !document.querySelector('#chat-pop .chat-type').hidden, guest: !document.querySelector('#chat-pop .chat-guest').hidden }));
  check('phone: the chat button opens quick chat (no typing for guests)', btn.shown && bPop.open && !bPop.type && bPop.guest, Object.assign(bPop, { shown: btn.shown }));
  await B.screenshot({ path: __dirname + '/shots/ch5_match_chat_phone.png' });
  await B.tap('#cp-quick [data-q="6"]'); await sleep(600);
  const feedA = await A.evaluate(() => document.getElementById('chatfeed').textContent);
  const bClosed = await B.evaluate(() => document.getElementById('chat-pop').hidden);
  check('a phrase from the phone shows on the desktop and the box closes', /THANKS/.test(feedA) && bClosed, feedA);
  await B.screenshot({ path: __dirname + '/shots/ch6_match_feed_phone.png' });
  // mute and report from the match menu
  await A.keyboard.press('Escape'); await sleep(400);
  const people = await A.evaluate(() => ({ shown: !document.getElementById('p-people').hidden, text: document.getElementById('p-people').textContent }));
  check('the match menu lists the other players with MUTE and REPORT', people.shown && /MUTE/.test(people.text) && /REPORT/.test(people.text), people.text);
  await A.click('#p-people [data-report]'); await A.click('#p-people [data-report]'); await sleep(500);
  const rep = await A.evaluate(() => ({ text: document.getElementById('p-people').textContent, muted: EGO.Net.muted.size }));
  check('REPORT asks once, then reports and mutes them for you', /REPORTED/.test(rep.text) && /UNMUTE/.test(rep.text) && rep.muted === 1, rep);
  await A.screenshot({ path: __dirname + '/shots/ch7_menu_people.png' });
  const saved = fs.readFileSync(path.join(DATA, 'reports.jsonl'), 'utf8').trim().split('\n').length;
  check('that report was saved too', saved === 3, saved);
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  check('no server errors', !/Error/.test(out), out.split('\n').slice(1, 5));
  await browser.close(); srv.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
