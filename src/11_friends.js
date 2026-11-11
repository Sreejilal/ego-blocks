/* =====================================================================
   FRIENDS: the panel on the side of the start screen, the room screen and the pause menu (owner, Nov 2026: "a place on
   the side of the screen which you can hide that shows all your friends, and when they are on you can send them the
   invite"). Friends are kept on this device (Save.data.friends, by their random friend id `fid`), so no account is
   needed and they survive the free server forgetting everything when it restarts. The server only says which friends
   are online right now (Net 'friends'), passes ADD FRIEND requests ('freq') and swaps the two ids after a YES ('fadd').
   ===================================================================== */
const FR_WHAT = { menu: 'IN THE MENUS', match: 'PLAYING BOTS', room: 'IN A ROOM', playing: 'IN AN ONLINE MATCH' };
const Friends = {
  on: [], // friends online right now: { id, f, name, st, room, mine, inv }
  seenOn: null, // fids online at the last answer, so a friend coming online gets a note
  armed: null, // the REMOVE button waiting for SURE?
  tpl() {
    return `<aside id="fr-side" hidden>
      <button class="fr-tab" id="fr-tab" type="button" aria-label="Show your friends"><span class="fr-tab-t">FRIENDS</span><b class="fr-tab-n" id="fr-tab-n" hidden></b></button>
      <div class="fr-panel panel" id="fr-panel" role="region" aria-labelledby="fr-title" hidden>
        <div class="fr-head"><h3 id="fr-title">FRIENDS</h3><span class="label" id="fr-count"></span><button class="btn small" id="fr-hide" type="button">HIDE</button></div>
        <p class="label fr-note" id="fr-note"></p>
        <div class="fr-list" id="fr-list"></div>
        <div class="fr-add" id="fr-add" hidden></div>
        <div class="fr-foot"><button class="btn small blue" id="fr-link" type="button">COPY INVITE LINK</button><span class="label">SEND IT TO A FRIEND WHO IS NOT ON YET</span></div>
      </div>
    </aside>`;
  },
  init() {
    const w = document.createElement('div');
    w.innerHTML = this.tpl();
    $('app').appendChild(w.firstElementChild);
    $('fr-tab').addEventListener('click', () => this.open(true));
    $('fr-hide').addEventListener('click', () => this.open(false));
    $('fr-link').addEventListener('click', () => this.copyLink());
    $('fr-panel').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-inv],button[data-join],button[data-rm],button[data-add]'); if (!b) return;
      if (b.dataset.inv) this.invite(b.dataset.inv, b.dataset.name);
      else if (b.dataset.join) this.join(b.dataset.join);
      else if (b.dataset.add) { b.disabled = true; b.textContent = 'ASKED'; Net.send({ t: 'freq', id: b.dataset.add }); }
      else if (b.dataset.rm) {
        if (this.armed !== b.dataset.rm) { this.armed = b.dataset.rm; b.textContent = 'SURE?'; return; }
        this.remove(b.dataset.rm);
      }
    });
    setInterval(() => this.ask(), 10000);
    this.place();
  },
  /** open unless you hid it (it starts open on a wide screen, hidden on phones and small windows) */
  isOpen() { const v = Save.data.settings.frOpen; return v == null ? window.innerWidth >= 1100 && window.innerHeight >= 640 && !Touch.on : v; },
  open(v) {
    Save.data.settings.frOpen = !!v; Save.save();
    if (v) { this.goOnline(); this.ask(); }
    this.armed = null;
    this.place();
  },
  /** the panel needs the server: a click on it connects even where the quiet background connection does not start by itself */
  goOnline() { if (!Net.ws && !Net.noServerHere()) { Net.wantPresence = true; Net.connect(() => {}); } },
  /** shown on the start screen, the room screen and the pause menu; never over a match you are playing */
  where() {
    const paused = Game.state === 'paused' || (Game.state === 'online' && Net.paused);
    return paused || (Game.state === 'lobby' && (UI.cur === 'lobby' || UI.cur === 'online'));
  },
  place() {
    const side = $('fr-side'); if (!side) return;
    const show = !!this.where();
    side.hidden = !show;
    if (!show) { document.body.classList.remove('fr-open'); return; }
    const open = this.isOpen(), B = document.body.classList;
    $('fr-panel').hidden = !open; $('fr-tab').hidden = open;
    B.toggle('fr-open', open); B.toggle('fr-lobby', UI.cur === 'lobby' && Game.state === 'lobby'); B.toggle('fr-online', UI.cur === 'online' && Game.state === 'lobby'); // room for the rank card and the pause menu
    if (open) this.render(); else this.renderTab();
  },
  /** every 10s while connected: which friends are online (and who else is, for ADD FRIENDS while the panel is open) */
  ask() {
    if (!Net.ws || Net.ws.readyState !== 1) return;
    Net.send({ t: 'friends' });
    if (this.where() && this.isOpen()) Net.send({ t: 'who' });
  },
  got(m) {
    this.on = Array.isArray(m.list) ? m.list : [];
    const d = Save.data, now = new Set();
    let changed = false;
    for (const p of this.on) {
      if (!p.f) continue;
      now.add(p.f);
      const f = d.friends.find((x) => x.f === p.f);
      if (f && f.n !== p.name) { f.n = p.name; changed = true; } // they changed their name
    }
    if (changed) Save.save();
    // a friend just came online: a quiet note, also in a match (ESC shows the panel to invite them)
    if (this.seenOn) for (const p of this.on) if (p.f && !this.seenOn.has(p.f)) this.note(p.name + ' IS ONLINE' + (Game.playing() ? ' · ESC TO INVITE' : ''));
    this.seenOn = now;
    if (Net.room && UI.cur === 'online') Net.renderRoom(); // FRIEND instead of ADD FRIEND next to them in your room
    this.place();
  },
  note(text) { if (Game.state === 'online') Net.note(text); else UI.toast(text, 'gold'); },
  isFriendId(id) { return this.on.some((p) => p.id === id); },
  /** a YES on either side: both games keep the other's id */
  add(f, name) {
    if (typeof f !== 'string' || !/^[a-z0-9]{16}$/.test(f) || f === Save.data.fid) return;
    const d = Save.data, n = Net.cleanName(name) || 'FRIEND', had = d.friends.find((x) => x.f === f);
    if (had) had.n = n; else { d.friends.unshift({ f, n }); d.friends = d.friends.slice(0, 60); }
    Save.save();
    Net.hello(); this.ask();
    if (!had) { this.note(n + ' IS YOUR FRIEND NOW'); Sfx.coin(); }
    this.place();
  },
  remove(f) {
    Save.data.friends = Save.data.friends.filter((x) => x.f !== f); Save.save();
    this.on = this.on.filter((p) => p.f !== f); this.armed = null;
    Net.hello(); this.place();
  },
  /** INVITE: from the menus it opens your room; from a match against bots the room is made quietly and you hear when they arrive */
  invite(id, name) {
    if (!Net.room && !Game.match && UI.cur !== 'online') Net.open();
    Net.invite(id);
    this.setNote('INVITE SENT TO ' + (name || 'YOUR FRIEND') + (Game.match && !Net.room ? '. YOU HEAR WHEN THEY ARE IN YOUR ROOM' : ''));
  },
  join(code) {
    if (Game.state === 'online') { Net.send({ t: 'leave' }); Net.room = null; Net.paused = false; Game.toLobby(); }
    else if (Game.match) Game.toLobby(); // your match against bots ends (no rewards)
    Net.open(); Net.join(code);
  },
  copyLink() {
    const go = () => { const link = Net.inviteLink(); const ok = () => this.setNote('INVITE LINK COPIED. SEND IT TO YOUR FRIEND'); try { navigator.clipboard.writeText(link).then(ok, () => this.setNote(link)); } catch (e) { this.setNote(link); } };
    if (Net.room) { go(); return; }
    if (!Game.match && UI.cur !== 'online') Net.open();
    this.afterRoom = go;
    Net.connect(() => Net.send({ t: 'create' }));
  },
  setNote(t) { this.noteText = t; const el = $('fr-note'); if (el) { el.textContent = t; el.hidden = !t; } },
  renderTab() {
    const n = this.on.length, b = $('fr-tab-n');
    b.hidden = !n; b.textContent = String(n);
    $('fr-tab').classList.toggle('live', n > 0);
  },
  render() {
    this.renderTab();
    const d = Save.data, on = Net.ws && Net.ws.readyState === 1;
    const byF = new Map(this.on.filter((p) => p.f).map((p) => [p.f, p]));
    // online first (device friends and account friends), then everyone else on your list
    const rows = this.on.map((p) => ({ p, n: p.name, f: p.f })).concat(d.friends.filter((x) => !byF.has(x.f)).map((x) => ({ p: null, n: x.n, f: x.f })));
    $('fr-count').textContent = on ? this.on.length + ' ONLINE' : '';
    let html = '';
    if (!rows.length) html = '<p class="label fr-empty">NO FRIENDS YET. PRESS ADD FRIEND NEXT TO SOMEONE IN YOUR ROOM OR IN THE LIST BELOW.</p>';
    for (const r of rows) {
      const p = r.p;
      if (p) {
        const what = p.mine ? 'IN YOUR ROOM' : FR_WHAT[p.st] || '';
        const join = p.room && !p.mine ? `<button class="btn tiny" type="button" data-join="${esc(p.room)}">JOIN</button>` : '';
        const inv = p.inv ? `<button class="btn tiny blue" type="button" data-inv="${esc(p.id)}" data-name="${esc(p.name)}">INVITE</button>` : '';
        html += `<div class="fr-row on"><i class="fr-dot"></i><div class="fr-who"><b>${esc(r.n)}</b><span class="label">${what}</span></div><div class="fr-btns">${inv}${join}</div></div>`;
      } else {
        html += `<div class="fr-row"><i class="fr-dot"></i><div class="fr-who"><b>${esc(r.n)}</b><span class="label">OFFLINE</span></div><div class="fr-btns"><button class="btn ghost tiny" type="button" data-rm="${esc(r.f)}">${this.armed === r.f ? 'SURE?' : 'REMOVE'}</button></div></div>`;
      }
    }
    $('fr-list').innerHTML = html;
    // players online who are not your friends yet: ADD FRIEND
    const W = Net.who, others = on && W ? W.list.filter((p) => !p.friend && p.fr).slice(0, 6) : [];
    const add = $('fr-add');
    add.hidden = !others.length;
    add.innerHTML = others.length ? '<span class="label">PLAYERS ONLINE</span>' + others.map((p) => `<div class="fr-row"><div class="fr-who"><b>${esc(p.name)}</b><span class="label">${p.mine ? 'IN YOUR ROOM' : FR_WHAT[p.st] || ''}</span></div><div class="fr-btns"><button class="btn tiny" type="button" data-add="${esc(p.id)}">ADD FRIEND</button></div></div>`).join('') : '';
    const note = this.noteText || (Net.noServerHere() ? 'FRIENDS NEED THE ONLINE SERVER' : on ? '' : Net.ws ? 'CONNECTING...' : 'NOT ONLINE. OPEN THIS PANEL OR PLAY WITH FRIENDS TO GO ONLINE');
    const nt = $('fr-note'); nt.textContent = note; nt.hidden = !note;
  },
};
