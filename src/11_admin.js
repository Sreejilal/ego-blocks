/* ---------- the owner's admin panel (owner, Nov 2026: "an admin mode only for me, where I can get everything and control the match";
   Nov 24: "my admin panel needs to be more OP") ----------
   Only a save that used the owner's secret code (the current 'give all' one in CODES, not the retired one) ever sees the ADMIN buttons.
   On the start screen it gives things; in the pause menu of a match against bots it controls the match.
   Online it does nothing: the server runs those matches, and friends must get a fair game.
   Switches (gold when on) stay on in `match.adm` and work every frame in `tick`; a few also live in the match code, which
   only reads them (`adm.shot` in Player.computeMods, `adm.moon` in Match.jump, homing shots in Match.keeperContact). */
const ADMIN_EM = [10000, 100000, 1000000];
const Admin = {
  is() { return Save.data.codes.some((h) => CODES[h] && CODES[h].give === 'all' && !CODES[h].retired); },
  /** a match you can control: against bots, not the tutorial, not over yet */
  inMatch() { const m = Game.match; return !!m && (Game.state === 'paused' || Game.state === 'match') && !m.online && !m.cfg.tutorial && !!m.human && m.phase !== 'end'; },
  tpl() { return '<section id="admin" class="overlay" hidden><div class="dialog panel adm"><h2>ADMIN</h2><div id="adm-body"></div><p class="label" id="adm-msg">&nbsp;</p><button class="btn" id="adm-close" type="button">CLOSE</button></div></section>'; },
  bind() {
    $('adm-close').addEventListener('click', () => this.open(false));
    $('adm-body').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) { Sfx.click(); this.act(b.dataset.a); } });
    $('p-admin').addEventListener('click', () => this.open(true));
    $('lob-admin').addEventListener('click', () => this.open(true));
  },
  open(on) { if (on && !this.is()) return; $('admin').hidden = !on; document.body.classList.toggle('adm-open', !!on); if (on) { $('adm-msg').innerHTML = '&nbsp;'; this.render(); } },
  render() {
    const g = (name, btns) => `<div class="adm-g"><span class="label">${name}</span><div class="adm-r">${btns.map(([a, t, on]) => `<button class="btn small" type="button" data-a="${a}"${on == null ? '' : ` aria-pressed="${!!on}"`}>${t}</button>`).join('')}</div></div>`;
    let h;
    if (this.inMatch()) {
      const m = Game.match, A = m.adm || {}, me = m.human.team;
      h = g('SCORE ' + m.score[me] + ' : ' + m.score[1 - me] + ' (YOU : THEM)', [['us+', 'MY TEAM +1'], ['us5', 'MY TEAM +5'], ['us-', 'MY TEAM -1'], ['them+', 'THEM +1'], ['them-', 'THEM -1']])
        + g('TIME LEFT ' + Math.ceil(m.clock) + ' SEC', [['t+', '+30 SEC'], ['t-', '-30 SEC'], ['clock', 'STOP THE CLOCK', !!A.clock]])
        + g('THE BALL', [['ball', 'BALL TO ME'], ['tele', 'TELEPORT TO THEIR GOAL'], ['goal', 'SCORE A GOAL NOW']])
        + g('YOU (GOLD = ON)', [['god', 'GOD MODE', !!A.god], ['giant', 'GIANT', !!A.giant], ['fast', 'SUPER SPEED', !!A.fast], ['shot', 'MEGA SHOT', !!A.shot], ['homing', 'HOMING SHOTS', !!A.homing], ['magnet', 'BALL MAGNET', !!A.magnet], ['moon', 'MOON JUMP', !!A.moon], ['nocd', 'NO COOLDOWNS', !!A.nocd], ['stam', 'NEVER TIRED', !!A.stam], ['awake', 'ALWAYS AWAKE', !!A.awake]])
        + g('SUPER MOVES (WHEN YOU GO BACK)', CORE_POWERS.slice(0, 4).map((c, i) => ['mv' + i, c.name]).concat([['awaken', 'AWAKEN NOW']]))
        + g('THEM', [['freeze', 'FREEZE THEM', !!A.freeze], ['slow', 'SLOW THEM', !!A.slow], ['sleep', 'KEEPER ASLEEP', !!A.sleep], ['flat', 'KNOCK THEM ALL DOWN']])
        + (m.heist ? g('OMEGA CORES', [['steal', 'TAKE THEIR BEST CORE'], ['snap', 'SNAP NOW']]) : '')
        + g('FINISH', [['win', 'WIN NOW'], ['end', 'END MATCH']]);
    } else {
      const d = Save.data;
      h = g('EMERALDS ' + d.emeralds.toLocaleString('en-US'), ADMIN_EM.map((n, i) => ['em' + (i || ''), '+' + n.toLocaleString('en-US')]))
        + g('BLUEPRINTS ' + d.bp, [['bp', '+100'], ['bp2', '+1,000']])
        + g('LEVEL ' + levelOf(d.xp).level, [['xp', '+1 LEVEL'], ['xp10', '+10 LEVELS']])
        + g('RANK ' + TIER_NAMES[tierOf(d.rp)] + ' · ' + d.rp + ' RP', [['rp+', '+100 RP'], ['rp-', '-100 RP'], ['rpmax', 'MAX RANK']])
        + g('GAME PASS TIER ' + Pass.tier(d) + ' / ' + PASS_TIERS, [['pass', '+1 TIER'], ['passmax', 'COMPLETE THE PASS']])
        + g('ITEMS', [['all', 'UNLOCK EVERYTHING']]);
    }
    $('adm-body').innerHTML = h;
  },
  say(t) { $('adm-msg').textContent = t; },
  /** close the panel and go straight back to the match, so you see it happen */
  back() { this.open(false); if (Game.state === 'paused') Game.resume(); },
  act(a) {
    if (!this.is()) return;
    const d = Save.data;
    if (this.inMatch()) {
      const m = Game.match, h = m.human, me = h.team, A = m.adm || (m.adm = {}), side = me === 0 ? 1 : -1;
      const sc = (t, by) => { m.score[t] = Math.max(0, m.score[t] + by); };
      const inPlay = () => { if (m.phase === 'play') return true; this.say('WAIT FOR THE BALL TO BE IN PLAY'); return false; };
      if (a === 'us+') sc(me, 1); else if (a === 'us5') sc(me, 5); else if (a === 'us-') sc(me, -1); else if (a === 'them+') sc(1 - me, 1); else if (a === 'them-') sc(1 - me, -1);
      else if (a === 't+') { m.clock += 30; A.clockAt = m.clock; }
      else if (a === 't-') { m.clock = Math.max(1, m.clock - 30); A.clockAt = m.clock; }
      else if (a === 'clock') { A.clock = !A.clock; A.clockAt = m.clock; }
      else if (a === 'ball') { if (!inPlay()) return; m.ball.reset(h.pos.x, h.pos.z); m.possess(h, true); this.say('YOU HAVE THE BALL'); }
      else if (a === 'tele') { // just outside their box, the ball at your feet, facing their goal
        if (!inPlay()) return;
        h.pos.set(0, 0, side * (F.L - 14)); h.vel.set(0, 0, 0); h.yaw = side > 0 ? 0 : Math.PI; h.setState('free');
        m.ball.reset(h.pos.x, h.pos.z); m.possess(h, true); FX.ring(h.pos.x, 0.2, h.pos.z, '#ffcb3d', 2, 30);
        this.back(); return;
      } else if (a === 'goal') { // a real goal: yours, with the celebration (and the core grab in OMEGA CORES)
        if (!inPlay()) return;
        const b = m.ball; if (b.owner) b.release();
        b.pos.set(0, 1, side * (F.L + 1)); b.vel.set(0, 0, 0); b.lastKicker = h; b.lastTouch = h; b.kick = { by: h, type: 'loose', t: m.time, aerial: true }; // aerial: counts in VOLLEYS ONLY too
        this.back(); m.onGoal(side); return;
      } else if (['god', 'giant', 'shot', 'homing', 'magnet', 'moon', 'nocd', 'stam', 'slow', 'freeze', 'sleep'].includes(a)) A[a] = !A[a];
      else if (a === 'fast') { A.fast = !A.fast; h.speedMul = A.fast ? 1.6 : 1; }
      else if (a === 'awake') { A.awake = !A.awake; if (A.awake && !(h.awakeT > 0) && h.style.awaken) A.awaken = true; }
      else if (a === 'awaken') { if (!h.style.awaken) { this.say('YOUR STYLE HAS NO AWAKENING'); return; } A.awaken = true; this.back(); return; }
      else if (a.startsWith('mv')) { A.move = +a.slice(2); this.back(); return; } // fired in tick as soon as you can move
      else if (a === 'flat') {
        if (!inPlay()) return;
        for (const o of m.opponents(h)) { const dx = o.pos.x - h.pos.x, dz = o.pos.z - h.pos.z, l = len2D(dx, dz) || 1; if (o.state === 'frozen') o.setState('free'); m.knockDown(o, 2.2, dx / l, dz / l, 5, h); }
        FX.ring(h.pos.x, 0.3, h.pos.z, '#ffffff', 8, 60); FX.ring(h.pos.x, 0.3, h.pos.z, '#ffcb3d', 14, 80); Shake.add(0.6); Sfx.boom();
        this.back(); return;
      } else if (a === 'steal' && m.heist) { // their best core flies to your band, with its power
        if (!inPlay()) return;
        m.lastGoal = { team: me, scorer: h, assister: null, own: false };
        m.heistSteal(me); const L = m.heist.last; if (L) m.heistPower(me, L.jack ? HEIST_JACK : L.r, h);
        this.back(); return;
      } else if (a === 'snap' && m.heist) { // every core is yours: the match ends with your OMEGA SNAP
        const H = m.heist; H.v[me].push(...H.v[1 - me]); H.v[1 - me] = []; H.cleaned = 1 - me;
        m.score[0] = heistValue(H.v[0]); m.score[1] = heistValue(H.v[1]);
        this.back(); m.endMatch(); return;
      } else if (a === 'win' || a === 'end') {
        if (a === 'win' && m.score[me] <= m.score[1 - me]) m.score[me] = m.score[1 - me] + 1;
        this.back(); m.endMatch(); return;
      } else return;
      this.render(); return;
    }
    const lvl = () => { const L = levelOf(d.xp).level; let n = 0; while (levelOf(d.xp).level === L && n++ < 4000) d.xp += 25; };
    if (a === 'em' || a === 'em1' || a === 'em2') d.emeralds += ADMIN_EM[+a.slice(2) || 0];
    else if (a === 'bp') d.bp += 100;
    else if (a === 'bp2') d.bp += 1000;
    else if (a === 'xp') lvl();
    else if (a === 'xp10') for (let i = 0; i < 10; i++) lvl();
    else if (a === 'rp+') d.rp += 100;
    else if (a === 'rp-') d.rp = Math.max(0, d.rp - 100);
    else if (a === 'rpmax') { d.rp = Math.max(d.rp, 500); d.best.peakRp = Math.max(d.best.peakRp || 0, d.rp); this.say('OBSIDIAN, THE TOP RANK'); }
    else if (a === 'pass' || a === 'passmax') { // pass XP, and the rewards of every tier reached, like after a match
      Pass.sync(d);
      d.pass.xp = a === 'passmax' ? PASS_TIERS * PASS_TIER_XP : Math.min(PASS_TIERS * PASS_TIER_XP, (Pass.tier(d) + 1) * PASS_TIER_XP);
      const got = []; while (d.pass.got < Pass.tier(d)) { d.pass.got++; got.push(Pass.grant(d, d.pass.got)); }
      this.say(got.length ? got.length + (got.length > 1 ? ' TIERS' : ' TIER') + ' OF REWARDS ADDED' : 'THE PASS IS COMPLETE');
    } else if (a === 'all') { d.topUpOff = false; const n = unlockAll(d); this.say(n ? n + ' NEW ITEMS UNLOCKED' : 'YOU ALREADY HAVE EVERYTHING'); }
    else return;
    Save.save(); UI.renderLobby(); this.render();
  },
  /** every frame of a live match: the switches that stay on, and the moves waiting for you to go back */
  tick(rdt = 1 / 60) {
    const m = Game.match, A = m && m.adm;
    if (!A || Game.state !== 'match' || m.online || !m.human) return;
    const h = m.human, play = m.phase === 'play';
    if (A.stam) { h.stamina = 100; h.exhausted = false; }
    if (A.clock && A.clockAt != null && play) m.clock = A.clockAt; // the clock stands still
    if (A.god) { h.tackleProof = Math.max(h.tackleProof, 0.25); h.fx.bubble = Math.max(h.fx.bubble || 0, 0.25); } // tackles, knocks and items bounce off
    if (A.giant) h.fx.giant = Math.max(h.fx.giant || 0, 0.3);
    if (A.magnet) h.fx.magnet = Math.max(h.fx.magnet || 0, 0.3);
    if (A.nocd) {
      for (const ab of h.abil) ab.cd = 0;
      h.dodgeCharges = 1; h.slowRe = 0; h.tackleCd = 0;
      if (!(h.flowT > 0)) h.flow = 100;
      if (h.awakeT > 0) h.awakeMoveUsed = false;
    }
    if (A.awake && h.awakeT > 0) h.awakeT = Math.max(h.awakeT, 5);
    if (A.awaken && m.canAct(h)) { A.awaken = false; m.activateAwaken(h); }
    if (A.move != null && play && m.canAct(h)) { // a super move from the panel: the power of a core, without the core
      const r = A.move, keep = h.corePow; A.move = null;
      if (CORE_POWERS[r].kind === 'bolt' && m.ball.owner !== h) { m.ball.reset(h.pos.x, h.pos.z); m.possess(h, true); } // CANNON: the ball comes to you first
      h.corePow = r; const res = m.useCore(h); h.corePow = keep;
      if (typeof res === 'string') m.toast(res, 'bad', h);
    }
    if (A.slow) for (const o of m.opponents(h)) o.fx.slowed = Math.max(o.fx.slowed || 0, 0.25);
    if (A.homing && play) this.home(m, h, rdt);
    if (A.freeze || A.sleep || A.frozen) { // only in open play: a frozen team could never take its own kickoff
      const want = (o) => play && (A.freeze || (A.sleep && o.isGK));
      for (const o of m.teams[1 - h.team]) {
        if (want(o) && o.state !== 'frozen') { if (m.ball.owner === o) m.ball.release(); o.setState('frozen', 9999); }
        else if (!want(o) && o.state === 'frozen' && o.stateDur > 999) o.setState('free', 0);
      }
      A.frozen = play && (A.freeze || A.sleep);
    }
  },
  /** HOMING SHOTS: your shot steers itself into the corner away from their keeper, high under the bar, and keepers
      cannot touch it (`kick.homing`, Match.keeperContact) */
  home(m, h, rdt) {
    const b = m.ball, k = b.kick;
    if (b.owner || !k || k.by !== h || (k.type !== 'shot' && k.type !== 'header')) return;
    const gz = m.oppGoalZ(h.team), gk = m.keeperOf(1 - h.team);
    if (k.homeX == null) k.homeX = (gk && gk.pos.x > 0 ? -1 : 1) * (F.GW - 0.9);
    const tx = k.homeX, ty = Math.min(F.GH - 0.7, 2.6), tz = gz + Math.sign(gz) * 1.5;
    const dx = tx - b.pos.x, dy = ty - b.pos.y, dz = tz - b.pos.z, d = Math.hypot(dx, dy, dz) || 1;
    const sp = Math.max(30, b.vel.length()), q = Math.min(1, rdt * 8);
    b.vel.x += (dx / d * sp - b.vel.x) * q; b.vel.y += (dy / d * sp - b.vel.y) * q; b.vel.z += (dz / d * sp - b.vel.z) * q;
    if (b.curve) b.curve.set(0, 0, 0);
    k.homing = true;
    FX.trail(b.pos.x, b.pos.y, b.pos.z, '#ffcb3d', 0.3, 0.3);
  },
};
