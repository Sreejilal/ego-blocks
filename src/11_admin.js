/* ---------- the owner's admin panel (owner, Nov 2026: "an admin mode only for me, where I can get everything and control the match") ----------
   Only a save that used the owner's secret code (the current 'give all' one in CODES, not the retired one) ever sees the ADMIN buttons.
   On the start screen it gives things; in the pause menu of a match against bots it controls the match.
   Online it does nothing: the server runs those matches, and friends must get a fair game. */
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
      h = g('SCORE ' + m.score[me] + ' : ' + m.score[1 - me] + ' (YOU : THEM)', [['us+', 'MY TEAM +1'], ['us-', 'MY TEAM -1'], ['them+', 'THEM +1'], ['them-', 'THEM -1']])
        + g('TIME LEFT ' + Math.ceil(m.clock) + ' SEC', [['t+', '+30 SEC'], ['t-', '-30 SEC']])
        + g('POWERS', [['ball', 'BALL TO ME'], ['awaken', 'AWAKEN NOW'], ['freeze', 'FREEZE THEM', !!A.freeze], ['fast', 'SUPER SPEED', !!A.fast], ['stam', 'NEVER TIRED', !!A.stam]])
        + g('FINISH', [['win', 'WIN NOW'], ['end', 'END MATCH']]);
    } else {
      const d = Save.data;
      h = g('EMERALDS ' + d.emeralds, [['em', '+10,000']]) + g('BLUEPRINTS ' + d.bp, [['bp', '+100']])
        + g('LEVEL ' + levelOf(d.xp).level, [['xp', '+1 LEVEL']]) + g('RANK ' + d.rp + ' RP', [['rp+', '+100 RP'], ['rp-', '-100 RP']])
        + g('ITEMS', [['all', 'UNLOCK EVERYTHING']]);
    }
    $('adm-body').innerHTML = h;
  },
  say(t) { $('adm-msg').textContent = t; },
  act(a) {
    if (!this.is()) return;
    const d = Save.data;
    if (this.inMatch()) {
      const m = Game.match, h = m.human, me = h.team, A = m.adm || (m.adm = {});
      const sc = (t, by) => { m.score[t] = Math.max(0, m.score[t] + by); };
      if (a === 'us+') sc(me, 1); else if (a === 'us-') sc(me, -1); else if (a === 'them+') sc(1 - me, 1); else if (a === 'them-') sc(1 - me, -1);
      else if (a === 't+') m.clock += 30;
      else if (a === 't-') m.clock = Math.max(1, m.clock - 30);
      else if (a === 'ball') { if (m.phase !== 'play') { this.say('WAIT FOR THE BALL TO BE IN PLAY'); return; } m.ball.reset(h.pos.x, h.pos.z); m.possess(h, true); this.say('YOU HAVE THE BALL'); }
      else if (a === 'awaken') { if (!h.style.awaken) { this.say('YOUR STYLE HAS NO AWAKENING'); return; } A.awaken = true; this.say('YOU AWAKEN WHEN YOU RESUME'); }
      else if (a === 'freeze' || a === 'fast' || a === 'stam') { A[a] = !A[a]; if (a === 'fast') h.speedMul = A.fast ? 1.6 : 1; }
      else if (a === 'win' || a === 'end') {
        if (a === 'win' && m.score[me] <= m.score[1 - me]) m.score[me] = m.score[1 - me] + 1;
        this.open(false); Game.resume(); m.endMatch(); return;
      } else return;
      this.render(); return;
    }
    if (a === 'em') d.emeralds += 10000;
    else if (a === 'bp') d.bp += 100;
    else if (a === 'xp') { const L = levelOf(d.xp).level; let n = 0; while (levelOf(d.xp).level === L && n++ < 2000) d.xp += 25; }
    else if (a === 'rp+') d.rp += 100;
    else if (a === 'rp-') d.rp = Math.max(0, d.rp - 100);
    else if (a === 'all') { const n = unlockAll(d); this.say(n ? n + ' NEW ITEMS UNLOCKED' : 'YOU ALREADY HAVE EVERYTHING'); }
    else return;
    Save.save(); UI.renderLobby(); this.render();
  },
  /** every frame of a live match: the switches that stay on */
  tick() {
    const m = Game.match, A = m && m.adm;
    if (!A || Game.state !== 'match' || m.online || !m.human) return;
    const h = m.human;
    if (A.stam) { h.stamina = 100; h.exhausted = false; }
    if (A.awaken && m.canAct(h)) { A.awaken = false; m.activateAwaken(h); }
    if (A.freeze || A.frozen) {
      const on = !!A.freeze && m.phase === 'play'; // only in open play: a frozen team could never take its own kickoff
      for (const o of m.teams[1 - h.team]) {
        if (on && o.state !== 'frozen') { if (m.ball.owner === o) m.ball.release(); o.setState('frozen', 9999); }
        else if (!on && o.state === 'frozen' && o.stateDur > 999) o.setState('free', 0);
      }
      A.frozen = on;
    }
  },
};
