/* =====================================================================
   Portal: the CrazyGames SDK. Only the CrazyGames build loads it
   (npm run build:crazygames); everywhere else every call does nothing.
   It reports gameplay start and stop, keeps progress in their Data
   module, uses the CrazyGames username, follows their mute and chat
   settings, asks for a video ad at the final whistle (their SDK
   decides how often) and shares online rooms for their invite button.
   ===================================================================== */
const Portal = {
  on: false, sdk: null, user: null, live: false, adMute: false, sdkMute: false, noChat: false, inRoom: false, adT: 0,
  /** before the game starts: their SDK has to start first, it preloads the saved progress */
  async boot() {
    const W = window.CrazyGames;
    if (BUILD.portal !== 'crazygames' || !W || !W.SDK) return;
    const sdk = W.SDK;
    try {
      await Promise.race([sdk.init(), new Promise((ok, no) => setTimeout(() => no(new Error('the SDK took too long')), 8000))]);
      if (sdk.environment === 'disabled') return;
    } catch (e) { console.warn('CrazyGames SDK did not start:', e && e.message); return; }
    this.sdk = sdk; this.on = true;
    this.try(() => sdk.game.loadingStart());
    // progress lives in their Data module (it follows a signed-in player to every device)
    this.try(() => {
      const data = sdk.data;
      data.getItem(Save.key); // throws if the Data module is off for this game
      if (!data.getItem(Save.key)) {
        let raw = null; // a save from before: copy it in once
        for (const k of [Save.key].concat(Save.oldKeys)) { try { raw = raw || window.localStorage.getItem(k); } catch (e) {} }
        if (raw) data.setItem(Save.key, raw);
      }
      Save.backend = data;
    });
    this.readSettings(this.try(() => sdk.game.settings));
    this.try(() => sdk.game.addSettingsChangeListener((s) => { this.readSettings(s); this.applyMute(); Net.renderRoom(); Touch.layout(); if (this.noChat) Net.closeChat(false); }));
    this.user = (await this.tryAsync(() => sdk.user.getUser())) || null;
    this.try(() => sdk.user.addAuthListener((u) => this.signedIn(u)));
    this.try(() => sdk.game.addJoinRoomListener((p) => this.joinFrom(p)));
  },
  /** right after Game.start */
  ready() {
    if (BUILD.portal) { const adv = document.querySelector('.on-adv'); if (adv) adv.remove(); if (!BUILD.server) $('go-online').hidden = true; }
    this.applyMute();
    if (!this.on) return;
    this.try(() => this.sdk.game.loadingStop());
    const blk = document.createElement('div'); blk.id = 'ad-block'; blk.hidden = true; $('app').appendChild(blk);
    if (this.user) this.useName();
    const inv = this.try(() => this.sdk.game.inviteParams);
    if (inv && inv.room && BUILD.server) this.joinFrom(inv);
    else if (this.try(() => this.sdk.game.isInstantMultiplayer) && BUILD.server) { Net.open(); Net.connect(() => Net.send({ t: 'create' })); }
  },
  try(fn) { try { return fn(); } catch (e) { return undefined; } },
  async tryAsync(fn) { try { return await fn(); } catch (e) { return undefined; } },
  /** every frame: tell them when a match is being played, and when it stops (menu, results, replays) */
  tick() {
    if (!this.on) return;
    const live = Game.state === 'match' || (Game.state === 'online' && !Net.paused);
    if (live === this.live) return;
    this.live = live;
    this.try(() => (live ? this.sdk.game.gameplayStart() : this.sdk.game.gameplayStop()));
  },
  /** a win: their page celebrates with you */
  happy() { if (this.on) { this.tick(); this.try(() => this.sdk.game.happytime()); } },
  /** a video ad at the final whistle. Their SDK picks if one plays (at most one every 3 minutes) */
  midgame() {
    if (!this.on) return;
    this.tick(); // gameplay stop goes out before the ad
    const block = $('ad-block');
    const done = () => { clearTimeout(this.adT); block.hidden = true; this.adMute = false; this.applyMute(); };
    block.hidden = false;
    this.adT = setTimeout(done, 6000); // no ad started: carry on
    try {
      this.sdk.ad.requestAd('midgame', {
        adStarted: () => { clearTimeout(this.adT); this.adT = setTimeout(done, 120000); this.adMute = true; this.applyMute(); },
        adFinished: done, adError: done,
      });
    } catch (e) { done(); }
  },
  /** sound is off when you turned it off, while an ad plays, or when their page mutes the game */
  applyMute() { Sfx.setMuted(!!Save.data.settings.mute || this.adMute || this.sdkMute); },
  readSettings(s) { s = s || {}; this.sdkMute = !!s.muteAudio; this.noChat = !!s.disableChat; },
  chatAllowed() { return !this.noChat; },
  /* ---------- their account ---------- */
  useName() {
    const n = Net.cleanName(this.user.username);
    if (!n) return;
    Save.data.name = n; Save.save();
    const el = $('on-name'); if (el) { el.value = n; el.readOnly = true; }
    Net.hello();
  },
  async signIn() { const u = await this.tryAsync(() => this.sdk.user.showAuthPrompt()); if (u) this.signedIn(u); },
  signedIn(u) {
    this.user = u || null; if (!this.user) return;
    // their SDK has now loaded this account's progress (or moved the guest progress into it)
    Save.load(); Save.validate(); this.useName(); this.applyMute();
    UI.renderLobby(); Showcase.ensure(); if (UI.cur === 'profile') UI.renderProfile();
  },
  accountHtml() {
    if (this.user) return `<h3>ACCOUNT</h3><div class="on-row"><span class="label">CRAZYGAMES ACCOUNT</span><b class="ac-name">${esc(this.user.username)}</b></div><p class="pf-note">Your progress is saved to your CrazyGames account, so it follows you to any device.</p>`;
    const can = this.try(() => this.sdk.user.isUserAccountAvailable);
    return `<h3>ACCOUNT</h3><p class="pf-note">You are playing as a guest, and your progress is saved on this device.${can ? ' Sign in to CrazyGames to keep it on every device and play under your CrazyGames name.' : ''}</p>`
      + (can ? '<div class="on-row"><button class="btn small blue" id="cg-in" type="button">SIGN IN</button></div>' : '');
  },
  bindAccount() { const b = $('cg-in'); if (b) b.addEventListener('click', () => { Sfx.init(); Sfx.click(); this.signIn(); }); },
  /* ---------- rooms and invites ---------- */
  room(R) {
    if (!this.on) return;
    this.try(() => {
      if (R) { this.inRoom = true; this.sdk.game.updateRoom({ roomId: R.code, isJoinable: R.players.length < (R.size - 1) * 2, inviteParams: { room: R.code } }); }
      else if (this.inRoom) { this.inRoom = false; this.sdk.game.leftRoom(); }
    });
  },
  inviteLink(code) { return this.try(() => this.sdk.game.inviteLink({ room: code })) || ''; },
  /** a friend pressed JOIN on their page */
  joinFrom(p) {
    const code = p && String(p.room || '').toUpperCase();
    if (!code || !BUILD.server || (Net.room && Net.room.code === code)) return;
    if (Game.state !== 'lobby') Game.toLobby();
    Net.open(); $('on-code').value = code; Net.join(code);
  },
};
