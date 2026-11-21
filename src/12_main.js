/* =====================================================================
   Game: state machine, main loop, rewards, auto quality
   ===================================================================== */
// the auto graphics ladder: [quality, pixel scale]. Shadows go first and the picture stays sharp; fewer pixels (a softer
// picture) only at the very end (CrazyGames: "consistent resolution throughout the game")
const AUTO_STEPS = [['hi1', 1], ['med', 1], ['lite', 1], ['lite', 0.9], ['low', 1]]; // the camera effects go first, then shadows
const Game = {
  state: 'boot', match: null, lastMode: null, last: 0, time: 0, ended: false, pausedAt: 0,
  perf: { t: 0, frames: 0, long: 0, min: 1, skip: 0 }, autoStep: 0, autoWant: null, autoWait: 0, crowdT: 0, gate: false,
  /** a match is being played here, offline or online */
  playing() { return this.state === 'match' || this.state === 'online'; },
  start() {
    Save.load(); Save.validate();
    Portal.applyMute();
    World.init($('gl'));
    // a phone short of memory can take the graphics away mid-game: say so, with RELOAD, instead of a frozen black screen
    $('gl').addEventListener('webglcontextlost', (e) => { e.preventDefault(); try { Save.save(); } catch (er) {} bootFail(new Error('THE GRAPHICS STOPPED. THIS PHONE OR TABLET NEEDED THE MEMORY BACK. CLOSE OTHER APPS AND TABS, THEN RELOAD. YOUR PROGRESS IS SAVED.'), true); }, false);
    FX.init(World.scene);
    Touch.detect();
    if (Touch.on || navigator.webdriver) this.autoStep = 1; // phones and tablets start without the camera effects (so do test robots, many windows at once on a small PC; test/post.js turns them on)
    UI.init();
    Showcase.init();
    Reveal.init();
    Replay.init();
    Net.init();
    Friends.init();
    BallCue.init();
    Account.init();
    Input.init($('gl'));
    Touch.init();
    this.applyQuality();
    window.addEventListener('resize', () => World.resize());
    // CrazyGames common fixes: the page never scrolls under a match and the right-click menu stays away (right click is PASS)
    window.addEventListener('wheel', (e) => { if (this.playing()) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', (e) => { if (!(e.target && e.target.closest && e.target.closest('input, textarea'))) e.preventDefault(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'match') this.pause(); });
    this.toLobby();
    KeyNames.init();
    if (Net.joinCode) Net.open(); // opened from an invite link
    else if (!Save.data.onboarded && !navigator.webdriver && !Portal.party()) this.onboard(); // a brand-new player lands straight on the pitch
    this.last = performance.now();
    const tick = (t) => { requestAnimationFrame(tick); if (!this.manual) this.loop(t); };
    requestAnimationFrame(tick);
  },
  /** the first visit (CrazyGames: "games should land new users in gameplay immediately", one click at most): straight
      into a real quick match against the easiest bots, waiting at kickoff behind a CLICK TO PLAY with a picture of the
      keys (the click lets the game lock the mouse, start the sound and, on phones, go fullscreen). The first-match tips
      (Tips) and the ball marker (BallCue) teach the rest while you play. Owner, Nov 2026: "the first match they get
      thrown into a match". The tutorial is still on the start screen */
  onboard() {
    Save.data.onboarded = true; Save.save();
    this.startMatch('quick', { noIntro: true }); // straight in: no intro or position picker on the very first match
    this.gate = true; // the match waits at kickoff until the click
    Touch.tipShown = false; // the phone tip shows the first time they reach the start screen instead
    $('tg-go').textContent = Touch.on ? 'TAP TO PLAY' : 'CLICK TO PLAY';
    const K = KeyPics, keys = $('tg-keys');
    keys.innerHTML = Touch.on ? '' : `<span class="tg-k"><span class="kcross">${K.cap('KeyW')}<span>${K.cap('KeyA')}${K.cap('KeyS')}${K.cap('KeyD')}</span></span><span class="kl">MOVE</span></span><span class="tg-k">${K.mouse('l')}<span class="kl">SHOOT</span></span><span class="tg-k">${K.mouse('r')}<span class="kl">PASS</span></span>`;
    keys.hidden = Touch.on;
    $('tut-gate').hidden = false;
  },
  /** the gentle start for this mode's next match ([team size, skill]), or null once it is over. Tests keep the normal sizes */
  rampFor(mode) { return MODES[mode] && MODES[mode].rewards && (!navigator.webdriver || this.rampTest) ? rookieRamp(Save.data.stats.played) : null; },
  /** the team size the next match in this mode will really have (the start screen's buttons say it) */
  sizeFor(mode) { const r = this.rampFor(mode), s = teamSizeFor(mode, Save.data.rp); return r ? Math.min(s, r[0]) : s; },
  gateGo() {
    this.gate = false;
    $('tut-gate').hidden = true;
    Sfx.init(); Touch.autoFs(); Input.requestLock();
  },
  /** SKIP (the button, ENTER, or the pause menu): straight into a real match, no menus in between */
  skipTutorial() {
    if (!this.match || !this.match.cfg.tutorial) return;
    $('tut-gate').hidden = true;
    this.startMatch('quick');
  },
  applyQuality() { const q = Save.data.settings.quality; if (q === 'auto') World.setQuality(...AUTO_STEPS[this.autoStep]); else World.setQuality(q); },
  toLobby() {
    Replay.stop(); Replay.offer = null; Replay.hideOffer(); Net.closeChat(false); UI.toggleEmotes(false); FKHud.hide(); ShotHud.hide();
    if (this.match) { this.match.dispose(); this.match = null; }
    Net.nm = null; Net.paused = false; this.gate = false; $('tut-gate').hidden = true; this.stopIntro();
    Input.releaseLock();
    this.state = 'lobby';
    World.setSun(SUN_LOBBY);
    const me = sideFor(Save.data.club); World.paintCrowd(me, me); World.setTier(tierOf(Save.data.rp));
    TimeCtl.reset(); FX.clear();
    UI.hideOverlays(); UI.show('lobby');
    Touch.fsTip();
    Showcase.show();
    Sfx.setCrowd(0.2);
    Net.where('menu');
  },
  /* ---------- the match intro (owner, Nov 2026: "when a match starts there is an animation and you can actually take a position, so not always the same")
     The camera flies in over the stadium to your player while both teams stand at kickoff; meanwhile you pick your
     position. PLAY (or ENTER, or the countdown) starts the kickoff. Not on the very first match, the tutorial or free kicks.
     Tests skip it unless introTest is true (they drive matches frame by frame); introTest false turns it off for a test
     that pretends to be a real browser. */
  introOn(mode) { const c = MODES[mode] || {}; return !c.tutorial && !c.practice && (this.introTest != null ? !!this.introTest : !navigator.webdriver); },
  beginIntro() {
    const m = this.match;
    if (!m || !m.human) return;
    this.intro = { t: 0, left: INTRO_AUTO };
    document.body.classList.add('intro');
    Input.releaseLock();
    Sfx.setCrowd(0.9);
    UI.showIntro(m);
  },
  /** tap a position: you swap places with the bot who had it (they take yours) */
  pickRole(r) {
    const m = this.match;
    if (!m || !this.intro || !m.human) return false;
    const h = m.human;
    if (h.role === r) return true;
    const o = m.teams[h.team].find((p) => p.role === r && !p.isHuman);
    if (!o) return false;
    m.swapRoles(h, o); // in goal: the keeper's kit and number 1 come with it
    m.setupKickoff(0, true, true);
    Save.data.pos = r; Save.save();
    UI.renderIntro(m);
    return true;
  },
  endIntro() {
    if (!this.intro) return;
    this.stopIntro();
    const m = this.match;
    if (!m) return;
    m.setupKickoff(0, true); // the real kickoff: the banner, everyone on their spot
    Cam.reset(0);
    this.keeperTip(m);
    Sfx.init(); Sfx.setCrowd(0.55); Touch.autoFs(); Input.consumeEdges(); Input.requestLock(); UI.lockHint();
  },
  /** you are in goal: how to save */
  keeperTip(m) { if (m && m.human && m.human.isGK && !m.fk) m.toast(Touch.on ? 'YOU ARE IN GOAL · TAP DIVE TO SAVE' : Input.usingPad ? 'YOU ARE IN GOAL · B TO DIVE' : 'YOU ARE IN GOAL · C TO DIVE, HOLD SPACE FOR A HIGH ONE', 'gold', m.human); },
  stopIntro() { this.intro = null; Net.intro = null; document.body.classList.remove('intro'); UI.hideIntro(); },
  introTick(rdt, m) {
    const I = this.intro, E = Input.edges;
    I.t += rdt; I.left -= rdt;
    if (Input.locked) Input.releaseLock(); // a lock that arrived late (it is asked for asynchronously)
    if (E.has('Enter') || E.has('Space') || I.left <= 0) { Input.consumeEdges(); this.endIntro(); return; }
    const roles = UI.introRoles || [];
    for (let i = 0; i < roles.length; i++) if (E.has('Digit' + (i + 1)) || E.has('Numpad' + (i + 1))) { Sfx.click(); this.pickRole(roles[i]); }
    for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) E.delete(k);
    m.phaseT = 0; // hold the kickoff: everyone breathes and looks around, nobody plays
    m.update(rdt);
    FX.update(rdt);
    Cam.intro(rdt, m, I.t);
    UI.updateHud(m, rdt);
    UI.introCount(I.left);
  },
  startMatch(mode, o = {}) {
    Touch.autoFs(); Touch.hideTip(); $('tut-gate').hidden = true; this.gate = false; this.stopIntro();
    if (this.match) { this.match.dispose(); this.match = null; }
    Reveal.stop(); Showcase.hide();
    UI.hideOverlays();
    Sfx.init();
    TimeCtl.reset(); FX.clear();
    let skill = difficultyFor(Save.data.rp), size = teamSizeFor(mode, Save.data.rp);
    const ramp = this.rampFor(mode);
    if (ramp) { size = Math.min(size, ramp[0]); skill = Math.min(skill, ramp[1]); }
    const intro = !o.noIntro && this.introOn(mode);
    const st = STYLES[Save.data.style];
    this.match = new Match(mode, skill, { size, role: Save.data.pos || (st && st.gk ? 'GK' : null), intro }); // a keeper style with no position picked yet starts in goal
    this.lastMode = mode; this.ended = false;
    Replay.reset(this.match);
    World.paintCrowd(TEAM[0], TEAM[1]); World.setTier(this.match.tier);
    World.setSun(SUN_MATCH);
    Cam.reset(0);
    if (this.match.fk) Cam.fkFace(this.match.human.yaw, this.match.fk.dist, true); // free kicks: start looking at the goal
    this.state = 'match';
    UI.show('hud'); UI.buildHud(this.match);
    Sfx.setCrowd(0.55);
    Net.where('match');
    if (!intro) Input.requestLock(); // the intro wants the mouse free for the position buttons
    Input.consumeEdges();
    Cam.look(0); Cam.follow(1, this.match);
    if (intro) this.beginIntro(); else this.keeperTip(this.match);
    this.matchReady();
  },
  /** a match (offline or online) is set up: build every shader now, not mid-match the first time something shows,
      and give the auto graphics a fresh start that skips the loading moments */
  matchReady() {
    try { World.renderer.compile(World.scene, World.camera); } catch (e) {}
    const P = this.perf; P.skip = 2.5; P.t = P.frames = P.long = 0; P.min = 1;
  },
  pause() {
    if (this.state === 'online') { Net.paused = true; this.pausedAt = performance.now(); Input.releaseLock(); UI.showPause(true); return; } // the server keeps playing
    if (this.state !== 'match' || !this.match) return;
    this.state = 'paused'; this.match.paused = true; this.pausedAt = performance.now();
    Input.releaseLock();
    UI.showPause(true);
  },
  resume() {
    if (this.state === 'online') { Net.paused = false; UI.showPause(false); Touch.autoFs(); Input.consumeEdges(); Input.requestLock(); UI.lockHint(); return; }
    if (this.state !== 'paused') return;
    this.state = 'match'; this.match.paused = false;
    UI.showPause(false);
    Touch.autoFs(); // ESC left fullscreen as well: RESUME goes back to only the game
    Input.consumeEdges();
    Input.requestLock();
    UI.lockHint();
  },
  onEscape() {
    if (this.state === 'replay') { Replay.stop(); return; }
    if (this.state === 'online') { if (!Net.paused) this.pause(); else if (performance.now() - this.pausedAt > 350) this.resume(); return; }
    if (this.state === 'match' && this.intro) return; // the intro: PLAY or the countdown starts it
    if (this.state === 'match') this.pause();
    else if (this.state === 'paused' && performance.now() - this.pausedAt > 350) this.resume();
  },
  forfeit() { UI.showPause(false); if (this.state === 'online') { Net.leaveMatch(); return; } this.finishMatch(true); },
  finishMatch(forfeit) {
    if (this.ended || !this.match) return;
    this.ended = true;
    const m = this.match, d = Save.data;
    Replay.offer = null; Replay.hideOffer();
    if (m.cfg.tutorial) { // the tutorial: a small reward the first time, then off to a real match
      if (forfeit) { this.toLobby(); return; }
      const first = !d.tutorial; d.tutorial = true; if (first) d.emeralds += TUT_REWARD;
      Save.save();
      this.state = 'results'; m.paused = true; this.lastMode = 'quick';
      Input.releaseLock();
      UI.showTutorialDone(first);
      Sfx.setCrowd(0.3);
      return;
    }
    if (m.cfg.practice) { // free kick practice: your score and your best, no rewards
      if (forfeit) { this.toLobby(); return; }
      const P = m.result.practice || { goals: 0, total: 0, log: [] }, best = d.fkBest || 0;
      if (P.goals > best) d.fkBest = P.goals;
      Save.save();
      this.state = 'results'; m.paused = true;
      Input.releaseLock();
      UI.showPractice(Object.assign({ best: Math.max(best, P.goals), newBest: P.goals > best }, P));
      if (P.goals > best) Sfx.fanfare(2);
      Sfx.setCrowd(0.3);
      return;
    }
    const res = forfeit ? 'forfeit' : m.result.res;
    const hs = forfeit ? (m.human ? Object.assign({}, m.human.stats) : { goals: 0, assists: 0, shots: 0, tackles: 0 }) : (m.result.human || { goals: 0, assists: 0, shots: 0, tackles: 0 });
    const fun = !forfeit && !m.online && !m.cfg.rewards; // offline King of the Hill, Volleys and Duels are just for fun
    const idle = !forfeit && !!(m.result.idle || m.result.noReward || fun); // online: a bot played for you, or they were far below your rank: nothing
    const earned = idle ? 'forfeit' : res; // what rewards are worked out from
    const earn = [];
    if (!forfeit && !idle) {
      earn.push([res === 'win' ? 'WIN' : res === 'draw' ? 'DRAW' : 'LOSS', res === 'win' ? 150 : res === 'draw' ? 80 : 50]);
      if (hs.goals) earn.push([hs.goals + (hs.goals === 1 ? ' GOAL' : ' GOALS'), 20 * hs.goals]);
      if (hs.assists) earn.push([hs.assists + (hs.assists === 1 ? ' ASSIST' : ' ASSISTS'), 10 * hs.assists]);
    }
    const emeralds = earn.reduce((a, e) => a + e[1], 0);
    d.emeralds += emeralds;
    const rpBefore = d.rp;
    if (m.cfg.ranked) d.rp = Math.max(0, d.rp + Math.min(idle ? 0 : 99, res === 'win' ? 25 : res === 'draw' ? 5 : -15));
    if (!fun) { // just-for-fun matches do not count toward GOALS (their blueprints are rewards too)
      d.stats.played++;
      if (res === 'win') d.stats.wins++; else if (res === 'draw') d.stats.draws++; else d.stats.losses++;
      d.stats.goals += hs.goals || 0; d.stats.assists += hs.assists || 0;
      const ft = m.feats || {}; d.stats.tackles += hs.tackles || 0; d.stats.ankles += ft.ankles || 0; d.stats.awakens += ft.awakens || 0;
    }
    const goalsDone = fun ? [] : Goals.check(d);
    // XP, the match history (last 20) and best stats
    const xp = matchXp(earned, hs), lvBefore = levelOf(d.xp).level;
    d.xp += xp;
    d.history.push({ t: Date.now(), mode: m.mode, size: m.size, score: m.score.slice(), res, g: hs.goals || 0, a: hs.assists || 0, style: d.style, club: TEAM[0].club, opp: TEAM[1].club, rp: m.cfg.ranked ? d.rp - rpBefore : null });
    if (d.history.length > 20) d.history.splice(0, d.history.length - 20);
    const B = d.best;
    B.goals = Math.max(B.goals, hs.goals || 0); B.assists = Math.max(B.assists, hs.assists || 0);
    B.run = res === 'win' ? B.run + 1 : 0; B.streak = Math.max(B.streak, B.run); B.peakRp = Math.max(B.peakRp, d.rp);
    const pass = Pass.award(d, m, earned, hs);
    const daily = Daily.award(d, m, earned, hs);
    Save.save();
    this.state = 'results'; m.paused = true;
    Input.releaseLock();
    UI.showResults({ res, score: m.score.slice(), human: hs, earn, emeralds, ranked: m.cfg.ranked, rpBefore, rpAfter: d.rp, modeName: m.cfg.name + (!forfeit && m.result.battle ? ' · FREE KICK BATTLE ' + m.result.battle.join('-') : ''), xp, level: levelOf(d.xp).level, levelUp: levelOf(d.xp).level > lvBefore, pass, idle, noReward: !forfeit && (fun ? 'fun' : m.result.noReward), daily, goalsDone });
    if (res === 'win') Sfx.fanfare(2);
    if (res === 'win' && !idle) Portal.happy();
    Portal.midgame();
    Sfx.setCrowd(0.3);
  },
  /** auto graphics: watch for dropped frames (a frame much longer than the screen's own), which look like stutter even at a
      decent average, and step down a notch at a time: fewer pixels first, then no shadows */
  perfCheck(rdt) {
    const P = this.perf;
    if (Save.data.settings.quality !== 'auto' || this.autoStep >= AUTO_STEPS.length - 1) return;
    if (this.autoWant != null) { // switching shadows off rebuilds every material (a short stop): wait for a break in play, 6s at most
      this.autoWait += rdt;
      const m = this.match;
      if (!m || m.phase !== 'play' || this.autoWait > 6) { this.autoStep = this.autoWant; this.autoWant = null; World.setQuality(...AUTO_STEPS[this.autoStep]); P.skip = 1.5; }
      return;
    }
    if (P.skip > 0) { P.skip -= rdt; return; } // the first moments of a match load things; do not judge them
    P.t += rdt; P.frames++; P.min = Math.min(P.min, rdt);
    if (rdt > Math.max(P.min * 1.5, 0.021)) P.long++;
    if (P.t < 3) return;
    const fps = P.frames / P.t, dropped = P.long / P.frames;
    P.t = 0; P.frames = 0; P.long = 0; P.min = 1;
    if (fps < 40 || dropped > 0.1) { // quietly: no message (it only made the game look heavy)
      const next = this.autoStep + 1;
      if (QUALITY[AUTO_STEPS[next][0]].shadows !== QUALITY[AUTO_STEPS[this.autoStep][0]].shadows) { this.autoWant = next; this.autoWait = 0; }
      else { this.autoStep = next; World.setQuality(...AUTO_STEPS[next]); P.skip = 1.5; } // let it settle before judging again
    }
  },
  loop(now, doRender = true) {
    let rdt = (now - this.last) / 1000; this.last = now;
    if (!(rdt > 0)) rdt = 0;
    rdt = Math.min(rdt, 0.05);
    this.time += rdt;
    Portal.tick();
    Sfx.crowdTick(rdt);
    Input.pollPad();
    Net.inviteKeys();
    PadNav.tick(rdt);
    Admin.tick();
    Touch.sync();
    const m = this.match;
    if (m && (this.state === 'match' || this.state === 'paused' || this.state === 'results' || this.state === 'replay')) {
      if (this.state === 'match' && Replay.offer && (Input.edges.has('Enter') || Input.edges.has('PadRS'))) { Input.consumeEdges(); Replay.start(); }
      if (this.state === 'match' && m.cfg && m.cfg.tutorial && m.phase !== 'end' && Input.edges.has('Enter')) { Input.consumeEdges(); this.skipTutorial(); return; }
      if (this.state === 'replay') {
        if (['Enter', 'Space', 'PadA', 'PadB'].some((k) => Input.edges.has(k))) Replay.stop();
        Input.consumeEdges();
        Replay.update(rdt);
        Shake.update(rdt);
      } else if (this.state === 'match' && this.intro) {
        this.introTick(rdt, m);
      } else if (this.state === 'match') {
        UI.emoteKeys();
        Cam.look(rdt);
        m.ctl = Input.controls();
        const sdt = this.gate ? 0 : TimeCtl.step(rdt); // the first visit waits at kickoff for the click
        if (sdt > 0) {
          let rem = sdt, first = true;
          while (rem > 1e-5) {
            const h = Math.min(rem, 1 / 60);
            m.update(h); rem -= h;
            if (first) { first = false; Input.consumeEdges(); m.ctl = Input.controls(); }
          }
        }
        FX.update(sdt);
        Shake.update(rdt);
        Cam.follow(rdt, m);
        if (sdt > 0) Replay.record(m);
        Replay.tick(m, rdt);
        UI.updateHud(m, rdt);
        this.perfCheck(rdt);
        this.crowdT -= rdt;
        if (this.crowdT <= 0) {
          this.crowdT = 0.6;
          const b = m.ball, near = Math.max(0, 1 - (F.L - Math.abs(b.pos.z)) / 18);
          Sfx.setCrowd(0.45 + near * 0.7);
        }
        if (m.phase === 'end' && m.phaseT > 3.2 && !this.ended) this.finishMatch(false);
      } else { Shake.update(rdt); }
    } else if (this.state === 'online' && Net.nm) {
      Net.frame(rdt);
      this.perfCheck(rdt);
    } else {
      Reveal.update(rdt);
      Showcase.update(rdt);
      Shake.update(rdt);
      FX.update(rdt);
    }
    Account.tick(rdt);
    World.update(rdt);
    Input.endFrame();
    BallCue.frame(rdt);
    if (doRender) World.render();
  },
  /** test hook: advance n frames at a fixed 60fps without waiting on the GPU */
  stepManual(n, render) { this.manual = true; for (let i = 0; i < n; i++) this.loop(this.last + 1000 / 60, render && i === n - 1); },
};

/* debug + test hooks (harmless in normal play) */
window.EGO = {
  TIER_SKILL, tierOf, featuredAt, MODES, levelOf, matchXp, Pass, passXp, seasonAt, weekChallenges, CHALLENGES, PASS_REWARDS,
  Game, World, Save, AI, Match, FX, TimeCtl, UI, Touch, Input, Cam, Showcase, Reveal, Replay, Net, Friends, Tips, BallCue, PadNav, Admin, unlockAll, ROOKIE_RAMP, rookieRamp, Account, Portal, Player, TEAM, rollRarity, poolFor,
  Goals, GOALS, BP_COST, SKIN_SLOTS, Sfx, Music, MUSIC_BPM, MUSIC_VOL,
  EMOTES, FK_TYPES, fkIdeal, FK_TOL, FKHud, ShotHud, CURVE_ANGLE, CURVE_MIN, TUT_STEPS, TutHud, CODES, GIFT_CODE, codeHash, redeemCode, codeTopUp,
  CLUBS, CLUB_IDS, sideFor, matchSides, standTop, kitClash, STYLES, STYLE_IDS, GK_IDS, botStyle, ABILITIES, Sfx, FLOWS, SKINS, Daily, DAILY_CHALLENGES, PITCH: F,
  /** run a full bot-vs-bot match off-screen and report what happened */
  /** teamD: [home skill, away skill] to pit two levels against each other, e.g. [0.2, 0.95] for Wood vs Obsidian */
  simulate(mode = 'quick', d = 0.5, seconds = 240, size = 0, teamD = null) {
    const m = new Match(mode, d, { noHuman: true, autopilot: true, length: seconds, size: size || (mode === 'ranked' ? 5 : 3), teamD });
    const log = { goals: 0, outs: 0, saves: 0, tackles: 0, passes: 0, shots: 0, possessionSwaps: 0, abilities: 0, flows: 0, phases: {} };
    const origOut = m.onOut.bind(m); m.onOut = function () { log.outs++; return origOut(); };
    const origAb = m.useAbility.bind(m); m.useAbility = function (p, i) { const r = origAb(p, i); if (r) log.abilities++; return r; };
    const origFlow = m.activateFlow.bind(m); m.activateFlow = function (p) { const r = origFlow(p); if (r) log.flows++; return r; };
    log.tackleTries = 0; log.ankles = 0; log.dodges = 0;
    const oT = m.tackle.bind(m); m.tackle = function (p, x, z) { const r = oT(p, x, z); if (r) log.tackleTries++; return r; };
    const oA = m.ankleBreak.bind(m); m.ankleBreak = function (a, b) { log.ankles++; return oA(a, b); };
    log.slideVsCarrier = 0; log.slideNoCarrier = 0; log.missDist = [];
    const oB = m.beginSlide.bind(m); m.beginSlide = function (p) { const c = m.ball.owner; if (c && c.team !== p.team) { log.slideVsCarrier++; p._tgt = c; } else { log.slideNoCarrier++; p._tgt = null; } return oB(p); };
    const oU = m.updateSlides.bind(m); m.updateSlides = function () { for (const p of m.players) { if (p.state === 'slide' && p.stateT + 1 / 60 >= p.stateDur && p.slide && !p.slide.hit && p._tgt) { log.missDist.push(+dist2D(p.pos, p._tgt.pos).toFixed(1)); p._tgt = null; } } return oU(); };
    const oD = m.dodge.bind(m); m.dodge = function (p, x, z) { const r = oD(p, x, z); if (r) log.dodges++; return r; };
    let lastOwnerTeam = -1, t = 0;
    while (m.phase !== 'end' && t < seconds * 3 + 200) {
      m.update(1 / 60); t += 1 / 60;
      FX.update(1 / 60);
      const o = m.ball.owner;
      if (o && o.team !== lastOwnerTeam) { log.possessionSwaps++; lastOwnerTeam = o.team; }
      log.phases[m.phase] = (log.phases[m.phase] || 0) + 1 / 60;
      for (const p of m.players) { if (p.awakeT > 0 && !p._awSeen) { p._awSeen = true; log.awakens = (log.awakens || 0) + 1; } else if (p.awakeT <= 0) p._awSeen = false; }
    }
    for (const p of m.players) { log.saves += p.stats.saves; log.tackles += p.stats.tackles; log.passes += p.stats.passes; log.shots += p.stats.shots; }
    log.score = m.score.slice(); log.goals = m.score[0] + m.score[1]; log.simSeconds = Math.round(t);
    m.dispose();
    return log;
  },
};

window.addEventListener('load', () => {
  try {
    if (typeof THREE === 'undefined') throw new Error('3D engine failed to load. Check your connection and reload the page.');
    Portal.boot().then(() => { try { Game.start(); Portal.ready(); } catch (err) { bootFail(err); } });
  } catch (err) { bootFail(err); }
});
function bootFail(err, stopped = false) {
  const b = document.getElementById('boot') || document.getElementById('app');
  const msg = err && err.message ? err.message : String(err);
  const gl = /webgl|context/i.test(msg) && !stopped ? '<br><br>This browser could not start 3D graphics. Try Chrome, close other apps and tabs, or restart the device.' : '';
  if (b) {
    b.style.display = 'grid'; b.style.zIndex = 999; b.style.position = 'fixed'; b.style.inset = '0'; b.style.placeItems = 'center'; b.style.background = '#090b16';
    b.innerHTML = '<div style="max-width:40ch;text-align:center;font-family:var(--font-body);font-size:18px;padding:16px;color:#eef1f4">' + (stopped ? '' : 'SCORZ could not start.<br><br>') + esc(msg) + gl + '<br><br><button type="button" class="btn blue" id="boot-reload">RELOAD</button></div>';
    const rb = document.getElementById('boot-reload'); if (rb) rb.addEventListener('click', () => location.reload());
  }
  console.error(err);
}
