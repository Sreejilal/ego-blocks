/* =====================================================================
   Account: optional. Guests play straight away and keep progress in
   this browser. Signing in (a name and a password, nothing else)
   keeps progress on the SCORZ server so it follows you to any device,
   and lets you add friends, see who is online and look at their
   profile cards. Lives on the Profile screen.
   ===================================================================== */
const GUEST_KEY = 'scorz.save.guest'; // the guest progress, kept aside while you are signed in
const Account = {
  user: null, token: null, friends: [], requests: [], pending: false, syncT: 0, msg: '',
  init() {
    if (Portal.on) return; // on CrazyGames only their account is allowed
    const a = Save.data.account;
    if (a && a.token) { this.user = a.user; this.token = a.token; this.refresh(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.upload(true); });
  },
  base() { return Net.serverUrl().replace(/^ws/, 'http').replace(/\/ws$/, ''); },
  api(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    return fetch(this.base() + '/api/' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, keepalive: !!(body && body.keep) })
      .then((r) => r.json().catch(() => ({ error: 'THE SERVER SENT SOMETHING ODD' })))
      .catch(() => ({ error: 'CANNOT REACH THE SERVER' }));
  },
  /** what goes up to the server: the progress, not this device's settings or sign-in */
  payload() { const d = Object.assign({}, Save.data); delete d.account; delete d.settings; return d; },
  async signIn(user, pass, create) {
    this.msg = create ? 'CREATING YOUR ACCOUNT...' : 'SIGNING IN...'; UI.renderProfile();
    const r = await this.api(create ? 'register' : 'login', { user, pass });
    if (r.error) { this.msg = r.error; UI.renderProfile(); return r; }
    this.user = r.user; this.token = r.token;
    const me = await this.api('me');
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(Save.data)); } catch (e) {}
    if (me.save) this.useSave(me.save); // your account's progress replaces the guest progress on this device
    Save.data.account = { user: this.user, token: this.token }; Save.data.name = this.user;
    Save.save();
    if (!me.save) await this.upload();
    this.msg = create ? 'ACCOUNT MADE. YOUR PROGRESS IS SAVED ON THE SERVER.' : 'SIGNED IN. WELCOME BACK.';
    Net.hello(); this.refresh();
    return r;
  },
  useSave(save) {
    const keep = { account: Save.data.account, settings: Save.data.settings };
    try { localStorage.setItem(Save.key, JSON.stringify(Object.assign({}, save, keep))); } catch (e) {}
    Save.load(); Save.validate();
    UI.renderLobby(); Showcase.ensure();
  },
  signOut() {
    if (this.token) { this.upload(true); this.api('logout', {}); }
    this.user = null; this.token = null; this.friends = []; this.requests = [];
    let guest = null; try { guest = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'); } catch (e) {}
    const settings = Save.data.settings;
    try { localStorage.setItem(Save.key, JSON.stringify(Object.assign(guest || Save.defaults(), { account: null, settings }))); } catch (e) {}
    Save.load(); Save.validate(); Save.data.account = null; Save.save();
    this.msg = 'SIGNED OUT. THIS DEVICE IS BACK TO GUEST PROGRESS.';
    UI.renderLobby(); Showcase.ensure(); Net.hello(); UI.renderProfile();
  },
  /** called on every save; the upload happens a few seconds later, once */
  changed() { if (this.token) this.pending = true; },
  tick(rdt) { if (!this.pending) return; this.syncT -= rdt; if (this.syncT <= 0) { this.syncT = 5; this.upload(); } },
  async upload(keep) {
    if (!this.token) return;
    this.pending = false;
    const r = await this.api('save', { save: this.payload(), keep: !!keep });
    if (r.error === 'SIGN IN AGAIN') { this.token = null; this.user = null; Save.data.account = null; this.msg = 'PLEASE SIGN IN AGAIN'; }
  },
  async refresh() {
    if (!this.token) return;
    const r = await this.api('friends');
    if (r.error) { if (r.error === 'SIGN IN AGAIN') { this.token = null; this.user = null; Save.data.account = null; this.msg = 'PLEASE SIGN IN AGAIN'; } }
    else { this.friends = r.friends || []; this.requests = r.requests || []; }
    if (UI.cur === 'profile') UI.renderProfile();
  },
  async friendAction(kind, user) {
    const r = await this.api('friends/' + kind, { user });
    this.msg = r.error || (kind === 'add' ? (r.friends ? 'YOU ARE NOW FRIENDS' : r.already ? 'ALREADY FRIENDS' : 'REQUEST SENT') : kind === 'accept' ? 'YOU ARE NOW FRIENDS' : '');
    this.refresh();
  },
  /* ---------- the Profile screen panels ---------- */
  html() {
    if (Portal.on) return Portal.accountHtml();
    if (!this.token) {
      return `<h3>ACCOUNT</h3><p class="pf-note">You are playing as a guest, and your progress stays in this browser. Make an account (just a name and a password) to keep it on the SCORZ server, play on any device and add friends.</p>
        <div class="on-row"><input class="on-in" id="ac-user" maxlength="12" placeholder="NAME" autocomplete="username" spellcheck="false"><input class="on-in" id="ac-pass" type="password" maxlength="64" placeholder="PASSWORD" autocomplete="current-password"></div>
        <div class="on-row"><button class="btn small blue" id="ac-in" type="button">SIGN IN</button><button class="btn small" id="ac-new" type="button">CREATE ACCOUNT</button></div>
        <p class="on-status" id="ac-msg">${esc(this.msg)}</p>
        <p class="pf-note small">Never use your real name or a password you use anywhere else. Friends only ever see your profile card.</p>`;
    }
    const fr = this.friends.map((f) => `<div class="fr-row"><b>${esc(f.user)}</b><span class="label ${f.online ? 'on' : ''}">${f.online ? (f.room ? (f.playing ? 'PLAYING IN ' : 'IN ROOM ') + esc(f.room) : 'ONLINE') : 'OFFLINE'}</span>
      <button class="btn small" type="button" data-card="${esc(f.user)}">CARD</button>${f.room ? `<button class="btn small blue" type="button" data-join="${esc(f.room)}">JOIN</button>` : ''}<button class="btn ghost" type="button" data-remove="${esc(f.user)}">REMOVE</button></div>`).join('');
    const rq = this.requests.map((u) => `<div class="fr-row"><b>${esc(u)}</b><span class="label">WANTS TO BE FRIENDS</span><button class="btn small blue" type="button" data-accept="${esc(u)}">ACCEPT</button><button class="btn ghost" type="button" data-decline="${esc(u)}">NO THANKS</button></div>`).join('');
    return `<h3>ACCOUNT</h3><div class="on-row"><span class="label">SIGNED IN AS</span><b class="ac-name">${esc(this.user)}</b><button class="btn small" id="ac-out" type="button">SIGN OUT</button></div>
      <p class="pf-note">Your progress is saved on the SCORZ server.</p>
      <h3>FRIENDS</h3><div class="on-row"><input class="on-in" id="fr-name" maxlength="12" placeholder="FRIEND'S NAME" spellcheck="false"><button class="btn small" id="fr-add" type="button">ADD FRIEND</button><button class="btn ghost" id="fr-refresh" type="button">REFRESH</button></div>
      <p class="on-status" id="ac-msg">${esc(this.msg)}</p>${rq}${fr || '<p class="label">NO FRIENDS YET. ADD ONE BY THEIR SCORZ NAME.</p>'}`;
  },
  bind(el) {
    if (Portal.on) { Portal.bindAccount(); return; }
    const v = (id) => ($(id) ? $(id).value : '');
    const on = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', () => { Sfx.init(); Sfx.click(); fn(); }); };
    on('ac-in', () => this.signIn(v('ac-user'), v('ac-pass'), false));
    on('ac-new', () => this.signIn(v('ac-user'), v('ac-pass'), true));
    on('ac-out', () => this.signOut());
    on('fr-add', () => this.friendAction('add', v('fr-name')));
    on('fr-refresh', () => this.refresh());
    el.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => this.friendAction('accept', b.dataset.accept)));
    el.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', () => this.friendAction('decline', b.dataset.decline)));
    el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => this.friendAction('remove', b.dataset.remove)));
    el.querySelectorAll('[data-join]').forEach((b) => b.addEventListener('click', () => { Sfx.click(); Net.open(); Net.join(b.dataset.join); }));
    el.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => this.showCard(b.dataset.card)));
  },
  /** a friend's profile card: level, style, skins, rank and their last matches */
  async showCard(user) {
    const c = await this.api('card/' + encodeURIComponent(user));
    if (c.error) { this.msg = c.error; UI.renderProfile(); return; }
    const def = Save.defaults();
    const d = { rp: c.rp, xp: c.xp, style: STYLES[c.style] ? c.style : 'ROOKIE', flow: FLOWS[c.flow] ? c.flow : null, club: CLUBS[c.club] ? c.club : 'ROVERS', look: Object.assign({}, def.look, c.look), best: Object.assign({}, def.best, c.best), stats: Object.assign({}, def.stats, c.stats), history: c.history || [] };
    for (const sl of SKIN_SLOTS) if (!SKINS[d.look[sl.id]] || SKINS[d.look[sl.id]].slot !== sl.id) d.look[sl.id] = sl.base;
    const el = $('friend-card');
    el.querySelector('.fc-body').innerHTML = `<h2>${esc(c.user)}</h2>` + UI.profileCard(d) + '<h3>RECENT MATCHES</h3>' + (UI.historyRows(d.history) || '<p class="label">NO MATCHES YET</p>');
    el.querySelector('.pf-face').replaceWith(portraitCanvas(d.style, 88, lookFor(d.style, d.look)));
    el.querySelectorAll('.pf-skin').forEach((s) => s.querySelector('.sv').replaceWith(skinCanvas(s.dataset.id, 32)));
    el.hidden = false;
  },
};
