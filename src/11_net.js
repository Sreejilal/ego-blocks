/* =====================================================================
   Net: playing online with friends. The server runs the match (same
   code as offline); this side sends your controls 30 times a second
   and draws the match from the server's snapshots, a little behind
   real time so movement stays smooth. Rooms have a 4-letter code and
   an invite link. The offline game never needs any of this.
   ===================================================================== */
const NET_STATES = ['free', 'dash', 'slide', 'dive', 'down', 'stun', 'frozen', 'celebrate', 'kickoff', 'hold', 'windup'];
const NET_KICKS = [null, 'backheel', 'rabona', 'outside', 'nolook'];
const NET_MODES = [['quick', 'QUICK'], ['koth', 'KING OF THE HILL'], ['volleys', 'VOLLEYS ONLY'], ['duel', '1V1 DUEL']];
const NET_DELAY = 0.12; // seconds the picture runs behind the server
const CHAT_SHOW = [['all', 'ALL'], ['quick', 'QUICK'], ['off', 'OFF']];

/** the match as this screen knows it: models moved by snapshots, with what the HUD needs */
class NetMatch {
  constructor(msg, myId) {
    this.mode = msg.mode; this.cfg = MODES[msg.mode] || MODES.quick; this.size = msg.size; this.tier = 0; this.online = true;
    this.scene = World.scene; this.time = 0; this.clock = MATCH_LEN; this.golden = false; this.goldenClock = 0;
    this.phase = 'kickoff'; this.phaseT = 0; this.score = [0, 0]; this.players = []; this.teams = [[], []]; this.items = [];
    this.aim = V3(0, 1, F.L); this.camYaw = 0; this.aimOnTarget = false; this.human = null; this.result = null;
    this.feats = { curler: 0, volley: 0, longShot: 0, ankles: 0, trailed: false };
    this.ball = new Ball(this);
    msg.roster.forEach((r, i) => {
      const p = new Player(this, { team: r.team, role: r.role, human: !!r.id, style: r.style, flow: r.flow, look: (msg.looks && msg.looks[i]) || {}, skin: r.skin, number: r.number, name: r.id === myId ? 'YOU' : r.name });
      p.netId = r.id;
      this.players.push(p); this.teams[r.team].push(p);
      if (r.id === myId) this.human = p;
    });
    for (const p of this.players) if (p.isHuman && p !== this.human) p.isHuman = false; // only you are "you" on this screen
    if (this.cfg.hill) this.buildHill();
  }
  dispose() {
    for (const p of this.players) p.dispose();
    this.ball.dispose();
    if (this.hill) { this.scene.remove(this.hill.mesh); this.hill.mesh.children.forEach((c) => { c.geometry.dispose(); c.material.dispose(); }); }
  }
}
for (const k of ['dir', 'oppGoalZ', 'ownGoalZ', 'prog', 'buildHill']) NetMatch.prototype[k] = Match.prototype[k];

const Net = {
  ws: null, id: null, room: null, nm: null, url: '', status: '', snaps: [], rt: 0, sendT: 0, pend: {}, paused: false, joinCode: null, lastBall: null,
  muted: new Set(), reported: new Set(), log: [], logCode: null, chatOpen: false,
  tpl() {
    return `<section id="scr-online" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>PLAY WITH FRIENDS</h2><button class="btn small" id="on-back" type="button">BACK</button></div>
        <div class="panel on-box" id="on-start">
          <label class="label" for="on-name">YOUR NAME</label>
          <input class="on-in" id="on-name" maxlength="12" autocomplete="off" spellcheck="false">
          <button class="btn blue" id="on-create" type="button">CREATE A ROOM <span class="sub">GET A CODE FOR FRIENDS</span></button>
          <div class="on-row"><input class="on-in code" id="on-code" maxlength="4" placeholder="CODE" autocomplete="off" spellcheck="false"><button class="btn" id="on-join" type="button">JOIN</button></div>
          <p class="on-status" id="on-status"></p>
          <p class="label on-privacy">TO PLAY ONLINE, YOUR NAME AND YOUR CONTROLS GO TO THE SCORZ SERVER. IT ONLY USES THEM TO RUN THE MATCH.</p>
          <details class="on-adv"><summary class="label">SERVER ADDRESS</summary><div class="on-row"><input class="on-in" id="on-server" autocomplete="off" spellcheck="false"><button class="btn small" id="on-server-save" type="button">SAVE</button></div></details>
        </div>
        <div class="on-split">
        <div class="panel on-box" id="on-room" hidden>
          <div class="on-code"><span class="label">ROOM CODE</span><b id="on-room-code">----</b><button class="btn small" id="on-copy" type="button">COPY INVITE LINK</button></div>
          <div class="on-teams"><div class="on-team" id="on-t0"></div><div class="on-team" id="on-t1"></div></div>
          <button class="btn small" id="on-switch" type="button">SWITCH TEAM</button>
          <div class="on-host" id="on-host">
            <span class="label">MODE</span><div class="seg" id="on-mode">${NET_MODES.map(([k, n]) => `<button type="button" data-m="${k}">${n}</button>`).join('')}</div>
            <span class="label">TEAM SIZE</span><div class="seg" id="on-size">${[3, 4, 5].map((n) => `<button type="button" data-s="${n}">${n}V${n}</button>`).join('')}</div>
            <button class="btn blue" id="on-go" type="button">START MATCH <span class="sub">BOTS FILL EMPTY SPOTS</span></button>
          </div>
          <p class="on-status" id="on-wait"></p>
          <button class="btn ghost" id="on-leave" type="button">LEAVE ROOM</button>
        </div>
        <div class="panel on-box on-chat" id="on-chat" hidden>
          <div class="cp-head"><span class="label">CHAT</span><div class="seg" id="on-chatset">${CHAT_SHOW.map(([v, n]) => `<button type="button" data-v="${v}">${n}</button>`).join('')}</div></div>
          <div class="chat-log" id="on-log" aria-live="polite"></div>
          <div class="chat-quick" id="on-quick">${this.quickBtns()}</div>
          <div class="on-row chat-type"><input class="on-in" id="on-say" maxlength="80" placeholder="TYPE A MESSAGE" autocomplete="off" spellcheck="false"><button class="btn small" id="on-send" type="button">SEND</button></div>
          <p class="label chat-guest">SIGN IN ON THE PROFILE SCREEN TO TYPE MESSAGES. QUICK CHAT WORKS FOR EVERYONE.</p>
          <p class="on-status" id="on-chat-note"></p>
        </div>
        </div>
      </div>
    </section>`;
  },
  init() {
    const d = Save.data;
    if (!d.name) { d.name = 'PLAYER' + randi(10, 99); Save.save(); }
    $('on-name').value = d.name;
    $('on-server').value = this.serverUrl();
    const click = (id, fn) => $(id).addEventListener('click', () => { Sfx.init(); Sfx.click(); fn(); });
    click('on-back', () => UI.show('lobby'));
    click('on-create', () => this.connect(() => this.send({ t: 'create' })));
    click('on-join', () => this.join($('on-code').value));
    $('on-code').addEventListener('keydown', (e) => { if (e.code === 'Enter') this.join($('on-code').value); });
    $('on-name').addEventListener('change', () => { d.name = this.cleanName($('on-name').value) || d.name; $('on-name').value = d.name; Save.save(); this.hello(); });
    click('on-server-save', () => { d.settings.server = $('on-server').value.trim(); Save.save(); this.close(); this.setStatus('SAVED. CREATE OR JOIN A ROOM.'); });
    click('on-copy', () => this.copyInvite());
    click('on-switch', () => { const me = this.room && this.room.players.find((p) => p.id === this.id); if (me) this.send({ t: 'team', team: 1 - me.team }); });
    click('on-go', () => this.send({ t: 'start' }));
    click('on-leave', () => { this.send({ t: 'leave' }); this.room = null; this.renderRoom(); Portal.room(null); });
    // chat
    const quickClick = (el, close) => $(el).addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; Sfx.click(); this.quick(+b.dataset.q); if (close) this.closeChat(true); });
    quickClick('on-quick', false); quickClick('cp-quick', true);
    click('on-send', () => this.say('on-say'));
    $('on-say').addEventListener('keydown', (e) => { if (e.code === 'Enter') this.say('on-say'); });
    click('cp-send', () => { this.say('cp-say'); this.closeChat(true); });
    $('cp-say').addEventListener('keydown', (e) => {
      if (e.code === 'Enter') { e.preventDefault(); this.say('cp-say'); this.closeChat(true); }
      else if (e.code === 'Escape') { e.stopPropagation(); this.closeChat(false); }
    });
    click('cp-close', () => this.closeChat(true));
    $('on-chatset').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v) { Sfx.click(); this.setChatShow(v); } });
    const people = (e) => {
      const m = e.target.closest('[data-mute]'), r = e.target.closest('[data-report]');
      if (m) { Sfx.click(); this.toggleMute(m.dataset.mute); }
      else if (r) { Sfx.click(); if (!r.dataset.armed) { r.dataset.armed = '1'; r.textContent = 'SURE?'; } else this.send({ t: 'report', id: r.dataset.report }); }
    };
    $('on-room').addEventListener('click', people); $('p-people').addEventListener('click', people);
    $('on-mode').addEventListener('click', (e) => { const m = e.target.closest('[data-m]'); if (m && this.room) { Sfx.click(); this.send({ t: 'settings', mode: m.dataset.m, size: this.room.size }); } });
    $('on-size').addEventListener('click', (e) => { const s = e.target.closest('[data-s]'); if (s && this.room) { Sfx.click(); this.send({ t: 'settings', mode: this.room.mode, size: +s.dataset.s }); } });
    // an invite link opens straight into the room
    try { const q = new URLSearchParams(location.search); this.joinCode = q.get('room'); if (q.get('server')) this.urlOverride = q.get('server'); } catch (e) {}
  },
  /** where the server is: your saved address, the invite link's, or the server that sent you this page */
  serverUrl() {
    const s = (!BUILD.portal && Save.data.settings && Save.data.settings.server) || this.urlOverride || BUILD.server;
    if (s) return s;
    if (location.protocol === 'file:' || !location.host) return 'ws://localhost:8787/ws';
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  },
  cleanName(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 12); },
  setStatus(t) { this.status = t; const el = $('on-status'); if (el) el.textContent = t; },
  open() { UI.show('online'); this.renderRoom(); if (this.joinCode) { const c = this.joinCode; this.joinCode = null; $('on-code').value = c; this.join(c); } },
  join(code) { code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); if (code.length !== 4) { this.setStatus('A ROOM CODE IS 4 LETTERS OR NUMBERS'); return; } this.connect(() => this.send({ t: 'join', code })); },
  /* ---------- the connection ---------- */
  connect(then) {
    if (this.ws && this.ws.readyState === 1) { then(); return; }
    if (this.ws && this.ws.readyState === 0) { this.onOpen = then; return; }
    this.url = this.serverUrl();
    this.setStatus('CONNECTING...');
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { this.setStatus('THAT SERVER ADDRESS DOES NOT WORK'); return; }
    this.ws = ws; this.onOpen = then;
    ws.onopen = () => { this.setStatus('CONNECTED'); this.hello(); const f = this.onOpen; this.onOpen = null; if (f) f(); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this.onMessage(m); };
    ws.onclose = () => {
      const wasPlaying = Game.state === 'online';
      this.ws = null; this.room = null; Portal.room(null);
      if (wasPlaying) { Game.toLobby(); UI.show('online'); }
      this.renderRoom();
      this.setStatus(wasPlaying ? 'LOST THE CONNECTION TO THE SERVER' : 'CANNOT REACH THE SERVER. IS IT RUNNING? (SEE SERVER ADDRESS)');
    };
  },
  close() { if (this.ws) { this.ws.onclose = null; try { this.ws.close(); } catch (e) {} } this.ws = null; this.room = null; this.renderRoom(); },
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); },
  hello() { const d = Save.data; this.send({ t: 'hello', name: d.name, style: d.style, flow: d.flow, look: d.look, club: d.club, token: Account.token }); },
  onMessage(m) {
    switch (m.t) {
      case 'welcome': this.id = m.id; break;
      case 'room': this.room = m; this.renderRoom(); if (this.paused) this.renderPeople(); Portal.room(m); break;
      case 'chat': this.addChat(m); break;
      case 'chat-note': this.note(m.text); Sfx.deny(); break;
      case 'reported': this.reported.add(m.id); this.mute(m.id, true); this.note('REPORTED. THANKS. THEY ARE MUTED FOR YOU.'); break;
      case 'error': this.setStatus(m.text); $('on-wait').textContent = m.text; Sfx.deny(); break;
      case 'left': this.room = null; this.renderRoom(); Portal.room(null); break;
      case 'start': this.start(m); break;
      case 'snap': this.onSnap(m); break;
      case 'stats': if (this.nm) m.st.forEach((s, i) => { const p = this.nm.players[i]; if (p) Object.assign(p.stats, { goals: s[0], assists: s[1], shots: s[2], tackles: s[3], saves: s[4] }); }); break;
      case 'end': this.end(m); break;
    }
  },
  /* ---------- the room screen ---------- */
  renderRoom() {
    const R = this.room;
    $('on-start').hidden = !!R; $('on-room').hidden = !R; $('on-chat').hidden = !R || !Portal.chatAllowed();
    if (!R) return;
    if (R.code !== this.logCode) { this.logCode = R.code; this.log = []; $('on-chat-note').textContent = ''; this.renderLog(); }
    this.renderChatUI();
    const host = R.host === this.id;
    $('on-room-code').textContent = R.code;
    for (const t of [0, 1]) {
      const list = R.players.filter((p) => p.team === t);
      $('on-t' + t).innerHTML = `<span class="label">${t === 0 ? 'HOME' : 'AWAY'} · ${list.length} / ${R.size - 1}</span>` + list.map((p) => `<div class="on-p ${p.id === this.id ? 'me' : ''}">${esc(p.name)}${p.id === R.host ? ' <span class="chip">HOST</span>' : ''}${p.id === this.id ? ' <span class="chip">YOU</span>' : this.acts(p)}</div>`).join('') + '<div class="on-p bot">+ BOTS</div>';
    }
    $('on-host').hidden = !host;
    $('on-mode').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === R.mode));
    $('on-size').querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', +b.dataset.s === R.size); b.disabled = R.mode === 'duel'; });
    $('on-wait').textContent = R.state === 'match' ? 'A MATCH IS ON. YOU PLAY IN THE NEXT ONE.' : host ? 'SHARE THE CODE, THEN PRESS START.' : 'WAITING FOR THE HOST TO START.';
  },
  inviteLink() {
    if (Portal.on) return Portal.inviteLink(this.room ? this.room.code : '');
    const base = location.origin && location.origin !== 'null' ? location.origin + location.pathname : '';
    const sameHost = this.url === (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return base + '?room=' + (this.room ? this.room.code : '') + (sameHost ? '' : '&server=' + encodeURIComponent(this.url));
  },
  copyInvite() {
    const link = this.inviteLink();
    const done = () => { $('on-wait').textContent = 'INVITE LINK COPIED. SEND IT TO A FRIEND.'; };
    try { navigator.clipboard.writeText(link).then(done, () => { $('on-wait').textContent = link; }); } catch (e) { $('on-wait').textContent = link; }
  },
  /* ---------- chat ---------- */
  quickBtns() { return QUICK_CHAT.map((t, i) => `<button class="btn small" type="button" data-q="${i}">${i < 4 ? `<span class="key">${i + 1}</span> ` : ''}${t}</button>`).join(''); },
  chatPopTpl() {
    return `<div id="chat-pop" class="panel" hidden>
      <div class="cp-head"><span class="label">QUICK CHAT</span><button class="btn ghost" id="cp-close" type="button">CLOSE</button></div>
      <div class="chat-quick" id="cp-quick">${this.quickBtns()}</div>
      <div class="on-row chat-type"><input class="on-in" id="cp-say" maxlength="80" placeholder="TYPE, THEN ENTER" autocomplete="off" spellcheck="false"><button class="btn small" id="cp-send" type="button">SEND</button></div>
      <p class="label chat-guest">SIGN IN ON THE PROFILE SCREEN TO TYPE MESSAGES</p>
    </div>`;
  },
  quick(i) { this.send({ t: 'chat', q: i }); },
  say(id) { const el = $(id), text = el.value.trim(); el.value = ''; if (text) this.send({ t: 'chat', text: text.slice(0, 80) }); },
  /** a line from the server; muted players and the chat setting decide what you see */
  addChat(m) {
    if (!Portal.chatAllowed()) return;
    const show = Save.data.settings.chat;
    if (this.muted.has(m.id) || show === 'off' || (show === 'quick' && m.q < 0)) return;
    this.log.push(m); if (this.log.length > 40) this.log.shift();
    this.renderLog();
    if (Game.state === 'online') { this.feed(m); if (m.id !== this.id) Sfx.click(); }
  },
  line(m) {
    const d = document.createElement('div');
    d.className = 'cl' + (m.sys ? ' sys' : m.q >= 0 ? ' q' : '');
    if (m.sys) { d.textContent = m.text; return d; }
    const b = document.createElement('b'); b.className = 't' + m.team; b.textContent = m.name;
    d.append(b, ' ' + m.text);
    return d;
  },
  renderLog() {
    const el = $('on-log'); if (!el) return;
    if (Save.data.settings.chat === 'off') { el.replaceChildren(this.line({ sys: true, text: 'CHAT IS OFF. PICK ALL OR QUICK TO SEE IT.' })); return; }
    el.replaceChildren(...this.log.map((m) => this.line(m)));
    el.scrollTop = el.scrollHeight;
  },
  /** chat lines in the corner of the match screen, gone after 7 seconds */
  feed(m) {
    const wrap = $('chatfeed');
    while (wrap.children.length >= 5) wrap.removeChild(wrap.firstChild);
    const d = this.line(m); wrap.appendChild(d);
    setTimeout(() => d.remove(), 7000);
  },
  note(text) { if (Game.state === 'online') this.feed({ sys: true, text }); else $('on-chat-note').textContent = text; },
  setChatShow(v) { if (!CHAT_SHOW.some(([k]) => k === v)) return; Save.data.settings.chat = v; Save.save(); this.renderChatUI(); this.renderLog(); },
  renderChatUI() {
    const signed = !!Account.token;
    document.querySelectorAll('.chat-type').forEach((el) => { el.hidden = !signed; });
    document.querySelectorAll('.chat-guest').forEach((el) => { el.hidden = signed; if (Portal.on) el.textContent = 'QUICK CHAT WORKS FOR EVERYONE. TYPED CHAT IS OFF HERE.'; });
    $('on-chatset').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === Save.data.settings.chat));
  },
  /** MUTE / REPORT next to everyone else in the room and in the match menu */
  acts(p) {
    return `<span class="on-acts"><button class="btn ghost tiny" type="button" data-mute="${esc(p.id)}">${this.muted.has(p.id) ? 'UNMUTE' : 'MUTE'}</button>`
      + (this.reported.has(p.id) ? '<span class="label">REPORTED</span>' : `<button class="btn ghost tiny" type="button" data-report="${esc(p.id)}">REPORT</button>`) + '</span>';
  },
  mute(id, on) {
    if (on) { this.muted.add(id); this.log = this.log.filter((m) => m.id !== id); } else this.muted.delete(id);
    this.renderLog(); this.renderRoom(); this.renderPeople();
  },
  toggleMute(id) { this.mute(id, !this.muted.has(id)); },
  renderPeople() {
    const el = $('p-people'), R = this.room, on = Game.state === 'online' && !!R;
    el.hidden = !on; if (!on) return;
    const others = R.players.filter((p) => p.id !== this.id);
    el.innerHTML = '<span class="label">PLAYERS</span>' + (others.length ? others.map((p) => `<div class="on-p">${esc(p.name)}${this.acts(p)}</div>`).join('') : '<p class="label">ONLY YOU AND BOTS</p>');
  },
  typing() { const a = document.activeElement; return !!(a && a.id === 'cp-say'); },
  openChat() {
    if (this.chatOpen || Game.state !== 'online' || !Portal.chatAllowed()) return;
    this.chatOpen = true; this.renderChatUI();
    $('chat-pop').hidden = false;
    Input.down.clear(); Input.releaseLock();
    if (Account.token && !Touch.on) setTimeout(() => $('cp-say').focus(), 0);
  },
  closeChat(relock) {
    if (!this.chatOpen) return;
    this.chatOpen = false; $('chat-pop').hidden = true;
    if (this.typing()) document.activeElement.blur();
    if (relock && Game.state === 'online' && !this.paused) Input.requestLock();
  },
  /** in a match: 1 to 4 (or VIEW + D-pad) send a phrase, T opens the chat box */
  chatKeys() {
    if (!Portal.chatAllowed()) return;
    const E = Input.edges;
    for (let i = 0; i < 4; i++) if (E.has('Digit' + (i + 1)) || E.has('Numpad' + (i + 1))) this.quick(i);
    if (Input.padHeld(PAD.BACK)) ['PadUp', 'PadRight', 'PadDown', 'PadLeft'].forEach((k, i) => { if (E.has(k)) this.quick(i); });
    if (E.has('KeyT')) this.openChat();
  },
  /* ---------- the match ---------- */
  start(msg) {
    if (Game.match) { Game.match.dispose(); Game.match = null; }
    Replay.stop(); Reveal.stop(); Showcase.hide(); UI.hideOverlays(); TimeCtl.reset(); FX.clear();
    [TEAM[0], TEAM[1]] = matchSides(msg.home, msg.away);
    World.paintCrowd(TEAM[0], TEAM[1]); World.setTier(2); World.setSun(SUN_MATCH);
    const nm = this.nm = new NetMatch(msg, this.id);
    Game.match = nm; Game.lastMode = 'online'; Game.ended = false;
    this.snaps = []; this.rt = -1; this.pend = {}; this.paused = false; this.lastBall = null; this.lastPhase = '';
    const me = nm.human;
    Cam.reset(me && me.team === 1 ? Math.PI : 0);
    Game.state = 'online';
    UI.show('hud'); UI.buildHud(nm); $('chatfeed').replaceChildren(); this.idleWarn(null);
    Sfx.init(); Sfx.setCrowd(0.55);
    Input.consumeEdges(); Input.requestLock();
  },
  onSnap(m) {
    const nm = this.nm; if (!nm) return;
    this.snaps.push(m); if (this.snaps.length > 30) this.snaps.shift();
    // things that happened: banners, labels, goals, your toasts and cut-ins
    for (const e of m.ev || []) this.event(e);
    if (m.me && nm.human) {
      const p = nm.human, me = m.me;
      p.abil.forEach((a, i) => { a.cd = me.cd[i] || 0; });
      p.flow = me.fl; p.flowT = me.ft; p.stamina = me.st; p.dodgeCharges = me.dc; p.dodgeRe = me.dr; p.tackleCd = me.tc; p.mods.tackleCd = me.tk || 1; p.passHold = me.ph;
      for (const k in p.fx) p.fx[k] = 0;
      Object.assign(p.fx, me.fx || {});
    }
    // sounds from what changed
    if (m.ph !== this.lastPhase) {
      if (m.ph === 'play' && (this.lastPhase === 'kickoff' || this.lastPhase === 'out')) Sfx.whistle(1);
      if (m.ph === 'out') Sfx.whistle(1);
      if (m.ph === 'end') Sfx.whistle(3);
      this.lastPhase = m.ph;
    }
    const b = m.b;
    if (this.lastBall) {
      const v = Math.hypot(b[0] - this.lastBall[0], b[1] - this.lastBall[1], b[2] - this.lastBall[2]) * 20, v0 = this.lastBall.v || 0;
      if (v - v0 > 8 && b[3] < 0) Sfx.kick(clamp(v / 36, 0.2, 1));
      b.v = v;
    }
    this.lastBall = b;
  },
  event(e) {
    const nm = this.nm, P = (i) => (i >= 0 ? nm.players[i] : null);
    if (e.to && e.to !== this.id) return;
    if (e.e === 'banner') UI.banner(e.big, e.small, e.color, e.quick ? 1.1 : 2.0);
    else if (e.e === 'label') { const p = P(e.i); if (p) UI.flabel(p, e.text, e.color, e.dur); }
    else if (e.e === 'goal') { UI.goalBanner(e.team, P(e.s), P(e.a), e.own); Sfx.roar(1); Sfx.whistle(1); World.excite[e.team] = 1; if (P(e.s) === nm.human) Shake.add(0.5); }
    else if (e.e === 'toast') UI.toast(e.text, e.cls);
    else if (e.e === 'idle') this.idleWarn('ARE YOU THERE?', 'MOVE OR PRESS ANY BUTTON. A BOT TAKES OVER IN ' + e.s, true);
    else if (e.e === 'idleok') this.idleWarn(null);
    else if (e.e === 'bot') this.idleWarn('A BOT IS PLAYING FOR YOU', 'PRESS ANY BUTTON TO PLAY AGAIN. NO REWARDS THIS MATCH.', true);
    else if (e.e === 'back') { this.idleWarn(null); UI.toast('YOU ARE BACK IN', 'good'); }
    else if (e.e === 'cutin') { const p = P(e.i); if (p && Save.data.settings.cutins) { UI.cutin(p, e.name); Cam.punch(0.75); Sfx.cutin(); } }
  },
  /** the idle warning in the middle of the screen (null hides it) */
  idleWarn(big, small, beep) {
    const el = $('idle-warn'); el.hidden = !big; if (!big) return;
    $('idle-big').textContent = big; $('idle-small').textContent = small;
    if (beep) Sfx.deny();
  },
  /** move every model to where it was NET_DELAY seconds ago on the server, blending two snapshots */
  applySnapshots(rdt) {
    const S = this.snaps, nm = this.nm;
    if (!S.length) return;
    const newest = S[S.length - 1].n / 60, target = newest - NET_DELAY;
    if (this.rt < 0 || Math.abs(this.rt - target) > 0.5) this.rt = target; else this.rt += rdt + (target - this.rt) * 0.08;
    let a = S[0], b = S[S.length - 1];
    for (let i = 0; i < S.length - 1; i++) if (S[i].n / 60 <= this.rt && S[i + 1].n / 60 >= this.rt) { a = S[i]; b = S[i + 1]; break; }
    const ta = a.n / 60, tb = b.n / 60, k = tb > ta ? clamp((this.rt - ta) / (tb - ta), 0, 1) : 1, since = Math.max(0, this.rt - tb);
    nm.time = this.rt; nm.phase = b.ph; nm.phaseT = b.pt + since; nm.clock = b.c; nm.golden = b.g >= 0; nm.goldenClock = Math.max(0, b.g); nm.score = b.s;
    nm.players.forEach((p, i) => {
      const A = a.pl[i], B = b.pl[i]; if (!A || !B) return;
      p.pos.set(lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k));
      p.vel.set(B[3], 0, B[4]);
      p.yaw = A[5] + wrapA(B[5] - A[5]) * k;
      const st = NET_STATES[B[6]] || 'free';
      if (p.state !== st) p.setState(st, B[8]);
      p.stateT = B[7] + since; p.stateDur = B[8];
      p.kickT = B[9] >= 0 ? Math.min(0.999, B[9] + since / 0.3) : -1; p.kickStyle = NET_KICKS[B[10]] || null;
      const f = B[11];
      p.charging = !!(f & 1); p.onGround = !!(f & 2); p.flowT = f & 4 ? Math.max(p.flowT, 1) : 0; p.callT = f & 8 ? 0.5 : 0;
      p.fx.shuffle = f & 16 ? 1 : 0; p.fx.lockdown = f & 32 ? 1 : 0; p.fx.bubble = f & 64 ? 1 : 0;
      p.charge = B[12];
      p.dive = st === 'dive' ? { side: B[13], high: !!B[14], dur: B[15] } : null;
      p.flipT = B[16];
      p.animate(rdt);
      p.P.eyes.visible = p.flowT > 0;
    });
    // the ball, with a roll worked out from how far it moved
    const ball = nm.ball, pa = a.b, pb = b.b;
    ball.last.copy(ball.pos);
    ball.pos.set(lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k), lerp(pa[2], pb[2], k));
    ball.owner = pb[3] >= 0 ? nm.players[pb[3]] : null;
    const dx = ball.pos.x - ball.last.x, dz = ball.pos.z - ball.last.z, dl = len2D(dx, dz);
    if (dl > 1e-4) { ball.spinAxis.set(dz / dl, 0, -dx / dl); _q1.setFromAxisAngle(ball.spinAxis, dl / BALL_R); ball.quat.premultiply(_q1); }
    ball.mesh.position.copy(ball.pos); ball.mesh.quaternion.copy(ball.quat);
    ball.blob.position.set(ball.pos.x, 0.02, ball.pos.z);
    if (nm.hill && b.hill) { const H = nm.hill; H.x = b.hill[0]; H.z = b.hill[1]; H.holder = b.hill[2]; H.mesh.position.set(H.x, 0.04, H.z); const c = H.mesh.children; c[0].material.color.copy(col(H.holder >= 0 ? TEAM[H.holder].hex : '#f5efe0')); c[1].material.color.copy(c[0].material.color); }
  },
  /** remember button presses until the next send, so a quick tap is never lost */
  collect(c) {
    if (!c) { this.held = null; return; }
    const P = this.pend;
    P.jump = P.jump || c.jump; P.sd = P.sd || c.shootDown; P.su = P.su || c.shootUp; P.pd = P.pd || c.passDown; P.pu = P.pu || c.passUp;
    P.dodge = P.dodge || c.dodge; P.tackle = P.tackle || c.tackle; P.flow = P.flow || c.flow;
    P.a0 = P.a0 || c.ab[0]; P.a1 = P.a1 || c.ab[1]; P.a2 = P.a2 || c.ab[2];
    this.held = c;
  },
  sendInput() {
    const c = this.paused ? null : this.held, P = this.pend, nm = this.nm;
    const msg = Object.assign({ t: 'input', mx: c ? +c.moveX.toFixed(2) : 0, my: c ? +c.moveY.toFixed(2) : 0, sp: !!(c && c.sprint), jh: !!(c && c.jumpHeld), sh: !!(c && c.shootHeld), cy: +nm.camYaw.toFixed(3), aim: [+nm.aim.x.toFixed(2), +nm.aim.y.toFixed(2), +nm.aim.z.toFixed(2)] }, P);
    this.send(msg);
    this.pend = {};
  },
  /** one frame of an online match */
  frame(rdt) {
    const nm = this.nm; if (!nm) return;
    const busy = this.paused || this.typing();
    if (!busy) Cam.look(rdt);
    this.collect(busy ? null : Input.controls());
    if (!busy) this.chatKeys();
    this.sendT -= rdt;
    if (this.sendT <= 0) { this.sendT = 1 / 30; this.sendInput(); }
    Input.consumeEdges();
    this.applySnapshots(rdt);
    FX.update(rdt); Shake.update(rdt);
    Cam.follow(rdt, nm);
    UI.updateHud(nm, rdt);
  },
  /** the final whistle: rewards on your side, then the results with BACK TO ROOM */
  end(m) {
    const nm = this.nm; if (!nm) return;
    const mine = m.players.find((p) => p.id === this.id);
    const my = nm.human ? nm.human.team : 0, a = m.score[my], b = m.score[1 - my];
    nm.score = m.score;
    nm.result = { res: a > b ? 'win' : a < b ? 'loss' : 'draw', human: mine ? mine.stats : { goals: 0, assists: 0, shots: 0, tackles: 0 }, idle: !!(mine && mine.idle) };
    this.idleWarn(null);
    if (mine && mine.feats) nm.feats = mine.feats;
    this.closeChat(false);
    Game.finishMatch(false);
    $('r-again').textContent = 'BACK TO ROOM'; $('r-lobby').textContent = 'LEAVE ROOM';
  },
  /** leave the match early: a bot takes over your player */
  leaveMatch() { this.send({ t: 'leave' }); this.room = null; this.paused = false; Game.toLobby(); },
};
