/* =====================================================================
   Game: state machine, main loop, rewards, auto quality
   ===================================================================== */
const Game = {
  state: 'boot', match: null, lastMode: null, last: 0, time: 0, ended: false, autoQ: 'med', pausedAt: 0,
  perf: { t: 0, frames: 0 }, crowdT: 0,
  /** a match is being played here, offline or online */
  playing() { return this.state === 'match' || this.state === 'online'; },
  start() {
    Save.load(); Save.validate();
    Portal.applyMute();
    World.init($('gl'));
    FX.init(World.scene);
    Touch.detect();
    UI.init();
    Showcase.init();
    Reveal.init();
    Replay.init();
    Net.init();
    Account.init();
    Input.init($('gl'));
    Touch.init();
    this.applyQuality();
    window.addEventListener('resize', () => World.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'match') this.pause(); });
    this.toLobby();
    if (Net.joinCode) Net.open(); // opened from an invite link
    this.last = performance.now();
    const tick = (t) => { requestAnimationFrame(tick); if (!this.manual) this.loop(t); };
    requestAnimationFrame(tick);
  },
  applyQuality() { const q = Save.data.settings.quality; World.setQuality(q === 'auto' ? this.autoQ : q); },
  toLobby() {
    Replay.stop(); Replay.offer = null; Replay.hideOffer(); Net.closeChat(false);
    if (this.match) { this.match.dispose(); this.match = null; }
    Net.nm = null; Net.paused = false;
    Input.releaseLock();
    this.state = 'lobby';
    World.setSun(SUN_LOBBY);
    const me = sideFor(Save.data.club); World.paintCrowd(me, me); World.setTier(tierOf(Save.data.rp));
    TimeCtl.reset(); FX.clear();
    UI.hideOverlays(); UI.show('lobby');
    Showcase.show();
    Sfx.setCrowd(0.2);
  },
  startMatch(mode) {
    Touch.autoFs();
    if (this.match) { this.match.dispose(); this.match = null; }
    Reveal.stop(); Showcase.hide();
    UI.hideOverlays();
    Sfx.init();
    TimeCtl.reset(); FX.clear();
    this.match = new Match(mode, difficultyFor(Save.data.rp), { size: teamSizeFor(mode, Save.data.rp) });
    this.lastMode = mode; this.ended = false;
    Replay.reset(this.match);
    World.paintCrowd(TEAM[0], TEAM[1]); World.setTier(this.match.tier);
    World.setSun(SUN_MATCH);
    Cam.reset(0);
    this.state = 'match';
    UI.show('hud'); UI.buildHud(this.match);
    Sfx.setCrowd(0.55);
    Input.requestLock();
    Input.consumeEdges();
    Cam.look(0); Cam.follow(1, this.match);
  },
  pause() {
    if (this.state === 'online') { Net.paused = true; this.pausedAt = performance.now(); Input.releaseLock(); UI.showPause(true); return; } // the server keeps playing
    if (this.state !== 'match' || !this.match) return;
    this.state = 'paused'; this.match.paused = true; this.pausedAt = performance.now();
    Input.releaseLock();
    UI.showPause(true);
  },
  resume() {
    if (this.state === 'online') { Net.paused = false; UI.showPause(false); Input.consumeEdges(); Input.requestLock(); UI.lockHint(); return; }
    if (this.state !== 'paused') return;
    this.state = 'match'; this.match.paused = false;
    UI.showPause(false);
    Input.consumeEdges();
    Input.requestLock();
    UI.lockHint();
  },
  onEscape() {
    if (this.state === 'replay') { Replay.stop(); return; }
    if (this.state === 'online') { if (!Net.paused) this.pause(); else if (performance.now() - this.pausedAt > 350) this.resume(); return; }
    if (this.state === 'match') this.pause();
    else if (this.state === 'paused' && performance.now() - this.pausedAt > 350) this.resume();
  },
  forfeit() { UI.showPause(false); if (this.state === 'online') { Net.leaveMatch(); return; } this.finishMatch(true); },
  finishMatch(forfeit) {
    if (this.ended || !this.match) return;
    this.ended = true;
    const m = this.match, d = Save.data;
    Replay.offer = null; Replay.hideOffer();
    const res = forfeit ? 'forfeit' : m.result.res;
    const hs = forfeit ? (m.human ? Object.assign({}, m.human.stats) : { goals: 0, assists: 0, shots: 0, tackles: 0 }) : (m.result.human || { goals: 0, assists: 0, shots: 0, tackles: 0 });
    const idle = !forfeit && !!m.result.idle; // online: a bot played for you, so this match gives nothing
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
    d.stats.played++;
    if (res === 'win') d.stats.wins++; else if (res === 'draw') d.stats.draws++; else d.stats.losses++;
    d.stats.goals += hs.goals || 0; d.stats.assists += hs.assists || 0;
    // XP, the match history (last 20) and best stats
    const xp = matchXp(earned, hs), lvBefore = levelOf(d.xp).level;
    d.xp += xp;
    d.history.push({ t: Date.now(), mode: m.mode, size: m.size, score: m.score.slice(), res, g: hs.goals || 0, a: hs.assists || 0, style: d.style, club: TEAM[0].club, opp: TEAM[1].club, rp: m.cfg.ranked ? d.rp - rpBefore : null });
    if (d.history.length > 20) d.history.splice(0, d.history.length - 20);
    const B = d.best;
    B.goals = Math.max(B.goals, hs.goals || 0); B.assists = Math.max(B.assists, hs.assists || 0);
    B.run = res === 'win' ? B.run + 1 : 0; B.streak = Math.max(B.streak, B.run); B.peakRp = Math.max(B.peakRp, d.rp);
    const pass = Pass.award(d, m, earned, hs);
    Save.save();
    this.state = 'results'; m.paused = true;
    Input.releaseLock();
    UI.showResults({ res, score: m.score.slice(), human: hs, earn, emeralds, ranked: m.cfg.ranked, rpBefore, rpAfter: d.rp, modeName: m.cfg.name, xp, level: levelOf(d.xp).level, levelUp: levelOf(d.xp).level > lvBefore, pass, idle });
    if (res === 'win') Sfx.fanfare(2);
    if (res === 'win' && !idle) Portal.happy();
    Portal.midgame();
    Sfx.setCrowd(0.3);
  },
  perfCheck(rdt) {
    if (Save.data.settings.quality !== 'auto') return;
    const P = this.perf; P.t += rdt; P.frames++;
    if (P.t >= 4) {
      const fps = P.frames / P.t; P.t = 0; P.frames = 0;
      if (fps < 45 && World.quality !== 'low') {
        this.autoQ = World.quality === 'high' ? 'med' : 'low';
        World.setQuality(this.autoQ);
        UI.toast('GRAPHICS LOWERED TO KEEP IT SMOOTH', 'gold');
      }
    }
  },
  loop(now, doRender = true) {
    let rdt = (now - this.last) / 1000; this.last = now;
    if (!(rdt > 0)) rdt = 0;
    rdt = Math.min(rdt, 0.05);
    this.time += rdt;
    Portal.tick();
    Input.pollPad();
    Touch.sync();
    const m = this.match;
    if (m && (this.state === 'match' || this.state === 'paused' || this.state === 'results' || this.state === 'replay')) {
      if (this.state === 'match' && Replay.offer && (Input.edges.has('Enter') || Input.edges.has('PadRS'))) { Input.consumeEdges(); Replay.start(); }
      if (this.state === 'replay') {
        if (['Enter', 'Space', 'PadA', 'PadB'].some((k) => Input.edges.has(k))) Replay.stop();
        Input.consumeEdges();
        Replay.update(rdt);
        Shake.update(rdt);
      } else if (this.state === 'match') {
        Cam.look(rdt);
        m.ctl = Input.controls();
        const sdt = TimeCtl.step(rdt);
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
    } else {
      Reveal.update(rdt);
      Showcase.update(rdt);
      if (UI.cur === 'lobby') UI.tickFeatured();
      Shake.update(rdt);
      FX.update(rdt);
    }
    Account.tick(rdt);
    World.update(rdt);
    Input.endFrame();
    if (doRender) World.render();
  },
  /** test hook: advance n frames at a fixed 60fps without waiting on the GPU */
  stepManual(n, render) { this.manual = true; for (let i = 0; i < n; i++) this.loop(this.last + 1000 / 60, render && i === n - 1); },
};

/* debug + test hooks (harmless in normal play) */
window.EGO = {
  TIER_SKILL, tierOf, featuredAt, MODES, levelOf, matchXp, Pass, passXp, seasonAt, weekChallenges, CHALLENGES, PASS_REWARDS,
  Game, World, Save, AI, Match, FX, TimeCtl, UI, Touch, Input, Cam, Showcase, Reveal, Replay, Net, Account, Portal, Player, TEAM, rollRarity, poolFor,
  CLUB_IDS, sideFor, matchSides, kitClash, STYLES, STYLE_IDS, ABILITIES, Sfx,
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
function bootFail(err) {
  const b = document.getElementById('boot') || document.getElementById('app');
  if (b) { b.style.display = 'grid'; b.innerHTML = '<div style="max-width:40ch;text-align:center;font-family:var(--font-body);font-size:18px;padding:16px">SCORZ could not start.<br><br>' + esc(err && err.message ? err.message : String(err)) + '</div>'; }
  console.error(err);
}
