// The FRIENDS panel (owner, Nov 2026: "a place on the side of the screen which you can hide that shows all your friends,
// and when they are on you can send them the invite, and they can accept mid-match also").
// Server: ADD FRIEND asks first and only a YES swaps the two device friend ids; friends are kept on each device (hello
// carries `fid` and `fr`), the server answers who of them is online (both must list each other); a friend who joins your
// room while the match is on jumps straight in, taking a bot's place in their own style. Browser: the panel, HIDE, the
// rows and buttons, the FRIEND REQUEST and "IS IN YOUR ROOM" pop-ups, and an online match swapping a bot for a friend.
// SERVER_ONLY=1 skips the browser part.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18805;
const fid = (c) => c.repeat(16);

function client() {
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws');
  const c = { ws, last: {}, all: [] };
  ws.on('message', (raw) => { const m = JSON.parse(raw); c.last[m.t] = m; c.all.push(m); if (m.t === 'welcome') c.id = m.id; });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = new Promise((r) => ws.on('open', r));
  c.ask = async (t, extra) => { c.last[t] = null; c.send(Object.assign({ t }, extra)); for (let i = 0; i < 40 && !c.last[t]; i++) await sleep(20); return c.last[t]; };
  c.count = (t) => c.all.filter((m) => m.t === t).length;
  return c;
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'scorz-fr-')), MATCH_SECONDS: '60' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  check('server starts', /SCORZ server/.test(out), out.trim().split('\n')[0]);
  try {
    const A = client(), B = client(), C = client(), D = client();
    await Promise.all([A, B, C, D].map((c) => c.open));
    const hello = (c, name, f, fr, extra) => c.send(Object.assign({ t: 'hello', name, fid: f, fr }, extra));
    hello(A, 'AMY', fid('a'), []); hello(B, 'BEN', fid('b'), []); hello(C, 'CAT', fid('c'), [], { style: 'BLITZ' }); hello(D, 'DOT', fid('d'), [fid('a')]);
    await sleep(150);

    // ADD FRIEND: a request first; only YES swaps the ids
    let w = await A.ask('who');
    check('PLAYERS ONLINE says who can be added as a friend (no account needed)', w.list.length === 3 && w.list.every((p) => p.fr === true && p.friend === false), w.list.map((p) => p.name));
    B.send({ t: 'freq-yes', id: A.id }); await sleep(120);
    check('a YES with no request gets nothing (nobody can grab your friend id)', !A.last.fadd && !B.last.fadd);
    A.send({ t: 'freq', id: B.id }); await sleep(150);
    check('ADD FRIEND pops up a FRIEND REQUEST on their screen', B.last.freq && B.last.freq.id === A.id && B.last.freq.from === 'AMY', B.last.freq);
    check('the request does not show your friend id yet', !JSON.stringify(B.last.freq).includes(fid('a')));
    B.send({ t: 'freq-yes', id: A.id }); await sleep(150);
    check('YES: both games get the other one\'s friend id and name to keep', A.last.fadd && A.last.fadd.f === fid('b') && A.last.fadd.name === 'BEN' && B.last.fadd && B.last.fadd.f === fid('a'), { a: A.last.fadd, b: B.last.fadd });
    A.send({ t: 'freq', id: C.id }); await sleep(150); C.send({ t: 'freq-no', id: A.id }); await sleep(150);
    check('NO THANKS: they hear no, and nothing is swapped', /NO THANKS/.test((A.last.info || {}).text || '') && !C.last.fadd, A.last.info);
    A.send({ t: 'freq', id: C.id }); await sleep(150);
    check('after a NO, more requests from them are held back for a while', C.count('freq') === 1, C.count('freq'));

    // both keep each other: online friends with what they are doing
    hello(A, 'AMY', fid('a'), [fid('b')]); hello(B, 'BEN', fid('b'), [fid('a')], { where: 'match' }); await sleep(120);
    let f = await A.ask('friends');
    check('FRIENDS: BEN is online, playing bots, and can be invited', f.list.length === 1 && f.list[0].name === 'BEN' && f.list[0].f === fid('b') && f.list[0].st === 'match' && f.list[0].inv, f.list);
    f = await D.ask('friends');
    check('only friends who keep you too: DOT lists AMY, AMY does not list DOT, so DOT sees nothing', f.list.length === 0, f.list);
    w = await A.ask('who');
    check('device friends are marked FRIEND in PLAYERS ONLINE too', w.list.find((p) => p.name === 'BEN').friend === true && w.list.find((p) => p.name === 'DOT').friend === false, w.list.map((p) => p.name + (p.friend ? '*' : '')));

    // a friend joins your room while the match is on: straight in, in their own style
    A.send({ t: 'create' }); await sleep(150);
    const code = A.last.room.code;
    f = await B.ask('friends');
    check('a friend sees your room code (JOIN)', f.list[0].room === code && f.list[0].st === 'room', f.list[0]);
    B.send({ t: 'join', code }); await sleep(150);
    A.send({ t: 'start' }); await sleep(500);
    check('the match starts for AMY and BEN', A.last.start && B.last.start && A.last.room.state === 'match');
    const swapsBefore = A.count('swap');
    B.send({ t: 'invite', id: C.id }); await sleep(150); // BEN (CAT said no thanks to AMY a moment ago, so AMY is held back)
    check('an invite reaches CAT mid-match', C.last.invite && C.last.invite.code === code, C.last.invite);
    C.send({ t: 'join', code }); await sleep(400);
    const st = C.last.start, i = st ? st.roster.findIndex((r) => r.id === C.id) : -1;
    check('CAT jumps into the match that is on (no waiting for the next one)', st && st.live === true && i >= 0, st && { live: st.live, i });
    check('in CAT\'s own style, in place of a bot (never the keeper)', i >= 0 && st.roster[i].style === 'BLITZ' && st.roster[i].name === 'CAT' && st.roster[i].role !== 'GK', i >= 0 && st.roster[i]);
    check('AMY and BEN see that player turn into CAT', A.count('swap') === swapsBefore + 1 && A.last.swap.i === i && A.last.swap.r.id === C.id && B.last.swap && B.last.swap.i === i, A.last.swap);
    check('the room lists CAT', A.last.room.players.some((p) => p.id === C.id), A.last.room.players.map((p) => p.name));
    await sleep(200);
    const p0 = C.last.snap.pl[i].slice(0, 3);
    for (let k = 0; k < 90; k++) { C.send({ t: 'input', mx: k % 40 < 20 ? 1 : -1, my: 0.6, sp: true, cy: 0, aim: [0, 1, 20] }); await sleep(33); }
    const p1 = C.last.snap.pl[i].slice(0, 3);
    check('CAT plays that player (it moves with CAT\'s controls) and the snapshots know it is CAT\'s', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1 && C.last.snap.me && C.last.snap.me.i === i, { p0, p1, me: C.last.snap.me && C.last.snap.me.i });

    // no bots to take over (bots off): they wait for the next match as before
    const E = client(), F = client(); await Promise.all([E.open, F.open]);
    hello(E, 'EVE', fid('e'), []); hello(F, 'FIN', fid('f'), []); await sleep(100);
    E.send({ t: 'create' }); await sleep(120);
    const c2 = E.last.room.code;
    E.send({ t: 'settings', mode: 'quick', size: 3, bots: 'none' }); await sleep(80);
    D.send({ t: 'join', code: c2 }); await sleep(120);
    E.send({ t: 'start' }); await sleep(400);
    F.send({ t: 'join', code: c2 }); await sleep(300);
    check('with bots off there is nobody to take over: FIN waits for the next match', E.last.room.state === 'match' && !F.last.start && F.last.room && F.last.room.players.some((p) => p.id === F.id), { state: E.last.room.state, start: !!F.last.start });
    for (const c of [A, B, C, D, E, F]) c.ws.close();
  } catch (e) { check('server part ran without errors', false, e.message); }
  srv.kill();
  if (process.env.SERVER_ONLY) return finish();

  // ---- the browser ----
  const { open } = require('./harness');
  const { browser, page, logs } = await open();
  const r1 = await page.evaluate(() => {
    const d = EGO.Save.data, F = EGO.Friends, sent = [];
    EGO.Net.ws = { readyState: 1, send: (s) => sent.push(JSON.parse(s)), close() {} }; window.__sent = sent;
    d.friends = [{ f: 'b'.repeat(16), n: 'BENJI' }, { f: 'c'.repeat(16), n: 'CAT' }];
    EGO.Game.toLobby();
    const side = document.getElementById('fr-side'), panel = document.getElementById('fr-panel');
    const first = { side: !side.hidden, open: !panel.hidden, fid: d.fid };
    F.got({ list: [{ id: 'p2', f: 'b'.repeat(16), name: 'BENJI', st: 'menu', room: null, mine: false, inv: true }, { id: 'p7', f: null, name: 'ACCTPAL', st: 'room', room: 'QX4T', mine: false, inv: true }] });
    const rows = Array.from(document.querySelectorAll('#fr-list .fr-row')).map((r) => ({ on: r.classList.contains('on'), name: r.querySelector('b').textContent, btns: Array.from(r.querySelectorAll('button')).map((b) => b.textContent) }));
    return { first, rows, count: document.getElementById('fr-count').textContent };
  });
  check('the start screen has the FRIENDS panel on the side, open on a wide screen', r1.first.side && r1.first.open, r1.first);
  check('a friend id is made for this game (16 letters and numbers)', /^[a-z0-9]{16}$/.test(r1.first.fid), r1.first.fid);
  check('online friends first with INVITE (and JOIN when they are in a room), offline friends after with REMOVE', r1.rows.length === 3 && r1.rows[0].on && r1.rows[0].btns.join() === 'INVITE' && r1.rows[1].btns.join() === 'INVITE,JOIN' && !r1.rows[2].on && r1.rows[2].name === 'CAT' && r1.rows[2].btns.join() === 'REMOVE' && r1.count === '2 ONLINE', r1);
  await page.screenshot({ path: __dirname + '/shots/friends_panel.png' });

  // HIDE, the tab, remembered
  await page.click('#fr-hide');
  const hid = await page.evaluate(() => ({ panel: document.getElementById('fr-panel').hidden, tab: !document.getElementById('fr-tab').hidden, n: document.getElementById('fr-tab-n').textContent, saved: EGO.Save.data.settings.frOpen }));
  check('HIDE folds it into a FRIENDS tab on the edge that shows how many are online, and it is remembered', hid.panel && hid.tab && hid.n === '2' && hid.saved === false, hid);
  await page.click('#fr-tab');
  const back = await page.evaluate(() => !document.getElementById('fr-panel').hidden && EGO.Save.data.settings.frOpen === true);
  check('the tab opens it again', back);

  // INVITE from the menus: opens your room and sends the invite; REMOVE asks SURE? first
  await page.evaluate(() => { window.__sent.length = 0; EGO.Net.connect = (f) => f(); document.querySelector('#fr-list [data-inv="p2"]').click(); });
  const inv = await page.evaluate(() => ({ cur: EGO.UI.cur, sent: window.__sent.map((m) => m.t) }));
  check('INVITE from the start screen opens PLAY WITH FRIENDS and makes your room first', inv.cur === 'online' && inv.sent.includes('create'), inv);
  await page.evaluate(() => { EGO.Net.onMessage({ t: 'room', code: 'AB12', host: EGO.Net.id, mode: 'quick', size: 3, bots: 'fill', state: 'room', players: [{ id: EGO.Net.id, name: 'ME', team: 0 }] }); });
  const sentInv = await page.evaluate(() => window.__sent.filter((m) => m.t === 'invite').map((m) => m.id));
  check('as soon as the room is there, the invite goes to that friend', sentInv.join() === 'p2', sentInv);
  const rm = await page.evaluate(() => {
    const b = () => document.querySelector('#fr-list [data-rm]');
    b().click(); const sure = b().textContent; b().click();
    return { sure, left: EGO.Save.data.friends.map((f) => f.n), hello: window.__sent.filter((m) => m.t === 'hello').pop() };
  });
  check('REMOVE asks SURE? and then takes them off your list (and tells the server)', rm.sure === 'SURE?' && rm.left.join() === 'BENJI' && rm.hello && rm.hello.fr.join() === 'b'.repeat(16), rm);

  // a FRIEND REQUEST pop-up, YES with J
  await page.evaluate(() => { EGO.Game.toLobby(); window.__sent.length = 0; EGO.Net.onMessage({ t: 'freq', id: 'p9', from: 'ZED' }); });
  const pop = await page.evaluate(() => ({ shown: !document.getElementById('invite-pop').hidden, kind: document.getElementById('ip-kind').textContent, text: document.getElementById('ip-text').textContent, yes: document.getElementById('ip-join').textContent }));
  check('ADD FRIEND from someone pops up FRIEND REQUEST with YES', pop.shown && pop.kind === 'FRIEND REQUEST' && /ZED WANTS TO BE FRIENDS/.test(pop.text) && /^YES/.test(pop.yes), pop);
  await page.keyboard.press('KeyJ'); await page.evaluate(() => EGO.Game.stepManual(2));
  const yes = await page.evaluate(() => window.__sent.filter((m) => m.t === 'freq-yes').map((m) => m.id));
  check('J says YES', yes.join() === 'p9', yes);
  await page.evaluate(() => EGO.Net.onMessage({ t: 'fadd', f: 'z'.repeat(16), name: 'ZED' }));
  const added = await page.evaluate(() => ({ list: EGO.Save.data.friends.map((f) => f.n), hello: window.__sent.filter((m) => m.t === 'hello').pop() }));
  check('ZED is kept on this device and the server is told', added.list.includes('ZED') && added.hello && added.hello.fr.includes('z'.repeat(16)) && added.hello.fid === r1.first.fid, added.list);

  // in a match the panel is out of the way; ESC (pause) shows it; a friend coming online gets a note
  const inMatch = await page.evaluate(() => {
    EGO.Game.startMatch('quick'); EGO.Game.stepManual(5);
    const playing = document.getElementById('fr-side').hidden;
    EGO.Friends.got({ list: [{ id: 'p2', f: 'b'.repeat(16), name: 'BENJI', st: 'menu', room: null, mine: false, inv: true }, { id: 'p9', f: 'z'.repeat(16), name: 'ZED', st: 'menu', room: null, mine: false, inv: true }] });
    const toast = Array.from(document.querySelectorAll('.toast, #toasts *')).map((t) => t.textContent).join(' | ');
    EGO.Game.pause();
    const paused = !document.getElementById('fr-side').hidden && !document.getElementById('fr-panel').hidden;
    return { playing, paused, toast };
  });
  check('the panel stays out of a match you are playing, and shows in the pause menu', inMatch.playing && inMatch.paused, inMatch);
  check('a friend coming online during a match gets a note (ESC TO INVITE)', /ZED IS ONLINE · ESC TO INVITE/.test(inMatch.toast), inMatch.toast);

  // inviting from a match against bots: the room is made quietly; when they arrive, GO TO ROOM?
  const arr = await page.evaluate(() => {
    EGO.Net.room = null; window.__sent.length = 0;
    document.querySelector('#fr-list [data-inv="p9"]').click();
    const stayed = EGO.Game.state === 'paused';
    const me = { id: EGO.Net.id, name: 'ME', team: 0 };
    EGO.Net.onMessage({ t: 'room', code: 'CD34', host: EGO.Net.id, mode: 'quick', size: 3, bots: 'fill', state: 'room', players: [me] });
    EGO.Net.onMessage({ t: 'room', code: 'CD34', host: EGO.Net.id, mode: 'quick', size: 3, bots: 'fill', state: 'room', players: [me, { id: 'p9', name: 'ZED', team: 1 }] });
    return { stayed, sent: window.__sent.map((m) => m.t + (m.id ? ':' + m.id : '')), pop: !document.getElementById('invite-pop').hidden, text: document.getElementById('ip-text').textContent, sub: document.getElementById('ip-sub').textContent };
  });
  check('INVITE from the pause menu of a bot match keeps your match and makes a room quietly', arr.stayed && arr.sent.includes('create') && arr.sent.includes('invite:p9'), arr.sent);
  check('when they arrive: ZED IS IN YOUR ROOM, GO NOW?', arr.pop && arr.text === 'ZED IS IN YOUR ROOM' && /GO NOW/.test(arr.sub), arr);
  await page.evaluate(() => { EGO.Net.acceptInvite(); });
  const went = await page.evaluate(() => ({ cur: EGO.UI.cur, state: EGO.Game.state, match: !!EGO.Game.match, room: !document.getElementById('on-room').hidden }));
  check('GO ends the bot match and opens your room', went.cur === 'online' && went.state === 'lobby' && !went.match && went.room, went);

  // an online match: a bot turns into your friend who just jumped in
  const sw = await page.evaluate(() => {
    const N = EGO.Net;
    const roster = [['GK', null, 'ROOKIE'], ['DEF', null, 'ROOKIE'], ['ST', N.id, EGO.Save.data.style], ['GK', null, 'ROOKIE'], ['DEF', null, 'ROOKIE'], ['ST', 'p5', 'ROOKIE']].map(([role, id, style], i) => ({ team: i < 3 ? 0 : 1, role, number: i + 2, name: id ? 'X' : 'BOT' + i, style, flow: null, look: {}, skin: '#e0ac85', id, rp: 0 }));
    N.start({ t: 'start', mode: 'quick', size: 3, home: EGO.CLUB_IDS[0], away: EGO.CLUB_IDS[1], awayKit: false, roster, looks: roster.map(() => ({})) });
    const nm = N.nm, old = nm.players[1];
    N.onMessage({ t: 'swap', i: 1, r: { team: 0, role: 'DEF', number: 3, name: 'ZED', style: 'BLITZ', flow: null, look: {}, skin: '#9a6643', id: 'p9', rp: 0 } });
    const p = nm.players[1];
    const r = { replaced: p !== old, style: p.styleId, name: p.name, net: p.netId, inTeam: nm.teams[0].includes(p) && !nm.teams[0].includes(old), oldGone: !old.P.root.parent, me: nm.human && nm.human.netId === N.id };
    N.leaveMatch && (N.send = () => {});
    return r;
  });
  check('online: when a friend jumps in, that bot is rebuilt as them (style, name) on every screen', sw.replaced && sw.style === 'BLITZ' && sw.name === 'ZED' && sw.net === 'p9' && sw.inTeam && sw.oldGone && sw.me, sw);
  const live = await page.evaluate(() => { EGO.Net.start({ t: 'start', live: true, mode: 'quick', size: 3, home: EGO.CLUB_IDS[0], away: EGO.CLUB_IDS[1], roster: EGO.Net.nm.players.map((p, i) => ({ team: p.team, role: p.role, number: p.number, name: p.name, style: p.styleId, flow: null, look: {}, skin: p.skin, id: i === 2 ? EGO.Net.id : null, rp: 0 })), looks: [] }); return Array.from(document.querySelectorAll('#chatfeed *, .toast')).map((e) => e.textContent).join(' | '); });
  check('the friend who jumped in is told so', /JUMPED INTO A MATCH THAT WAS ALREADY ON/.test(live), live);
  await page.evaluate(() => { EGO.Game.toLobby(); });

  // a phone: hidden to start with (a tab), and the panel fits the screen when opened
  await browser.close();
  for (const [w, h] of [[844, 390], [390, 844]]) {
    const ph = await open({ viewport: { width: w, height: h }, mobile: true });
    const r = await ph.page.evaluate(() => {
      EGO.Touch.setOn(true); EGO.Game.toLobby();
      const tab = !document.getElementById('fr-tab').hidden && document.getElementById('fr-panel').hidden;
      EGO.Save.data.friends = Array.from({ length: 30 }, (_, i) => ({ f: ('p' + i).padEnd(16, 'x'), n: 'PAL' + i }));
      EGO.Friends.open(true);
      const q = document.getElementById('fr-panel').getBoundingClientRect(), list = document.getElementById('fr-list');
      return { tab, fits: q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight, scrolls: list.scrollHeight > list.clientHeight, sideways: document.documentElement.scrollWidth <= innerWidth };
    });
    await ph.page.screenshot({ path: __dirname + `/shots/friends_panel_${w}x${h}.png` });
    check(`phone ${w}x${h}: starts as a tab, opens inside the screen, a long list scrolls, no sideways scrolling`, r.tab && r.fits && r.scrolls && r.sideways, r);
    if (ph.logs.length) logs.push(...ph.logs);
    await ph.browser.close();
  }
  check('no errors in the console', !logs.some((l) => /error/i.test(l)), logs.slice(0, 5));
  finish();
})().catch((e) => { console.error(e); process.exit(1); });

function finish() {
  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(failed ? failed + ' FAILED' : 'ALL ' + results.length + ' PASSED');
  process.exit(failed ? 1 : 0);
}
