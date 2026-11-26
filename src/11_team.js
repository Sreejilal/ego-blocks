/* =====================================================================
   TeamUI: MY TEAM (owner, Nov 2026: "the team system should be like [a big mobile football game] where you can have subs").
   Cards on a pitch for the five spots (SQUAD_SLOTS) with each character's rating (ovrOf, lower out of position), the team's
   OVR, your own card in your spot, and a bench of up to 3 (Save.data.squad.bench). Your team plays every offline match; in
   a match the pause menu's SUBS brings a bench character on for one of your bots (Match.subIn, SUBS_MAX a match).
   The character picker is the story screen's (#st-pick, StoryUI.openPick)
   ===================================================================== */
const TM_SPOTS = { ST: [50, 16], WING: [17, 37], MID: [83, 37], DEF: [50, 58], GK: [50, 84] }; // where each spot's card sits on the pitch (%)
const TeamUI = {
  from: 'lobby', subPick: null,
  tpl() {
    return `<section id="scr-team" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>MY TEAM</h2><div class="tm-ovr" id="tm-ovr"></div><button class="btn small" id="team-back" type="button">BACK</button></div>
        <section class="panel tm-box">
          <div class="tm-pitch" id="tm-pitch"><i class="tm-half"></i><i class="tm-circle"></i><i class="tm-box1"></i><i class="tm-box2"></i></div>
          <div class="tm-side">
            <h3>BENCH</h3><p class="tm-note">Up to 3. In a match, the pause menu's SUBS brings them on (3 subs a match).</p>
            <div class="tm-bench" id="tm-bench"></div>
            <p class="tm-note">Tap a card to pick who plays there. The number is the rating: higher for rarer characters, 6 lower out of their position. You play your own spot: change your character in the LOCKER.</p>
          </div>
        </section>
      </div>
    </section>
    <section id="subs" class="overlay" hidden>
      <div class="dialog panel subs-box"><h2>SUBS</h2><p class="md-sub" id="subs-msg"></p>
        <div class="subs-cols"><div><h3>BENCH</h3><div class="subs-list" id="subs-bench"></div></div><div><h3>COMING OFF</h3><div class="subs-list" id="subs-on"></div></div></div>
        <button class="btn" id="subs-close" type="button">CLOSE</button></div>
    </section>`;
  },
  bind() {
    const click = (id, fn) => $(id).addEventListener('click', () => { Sfx.init(); Sfx.click(); fn(); });
    click('team-back', () => UI.show(this.from || 'lobby'));
    click('subs-close', () => { $('subs').hidden = true; });
    const pick = (e) => {
      const b = e.target.closest('[data-slot]'); if (!b) return;
      Sfx.click();
      if (b.classList.contains('me')) { UI.openLocker(); return; }
      StoryUI.openPick(b.dataset.slot);
    };
    $('tm-pitch').addEventListener('click', pick); $('tm-bench').addEventListener('click', pick);
    $('subs-bench').addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (!b) return; Sfx.click(); this.subPick = b.dataset.sub; this.renderSubs(); });
    $('subs-on').addEventListener('click', (e) => {
      const b = e.target.closest('[data-off]'), m = Game.match; if (!b || !m || !this.subPick) return;
      const old = m.players[+b.dataset.off], p = m.subIn(old, this.subPick);
      if (p) { Sfx.coin(); this.subPick = null; $('subs-msg').textContent = STYLES[p.styleId].name + ' IS ON. ' + m.subsLeft + ' SUBS LEFT'; this.renderSubs(true); }
    });
  },
  /** put a character in a spot or on the bench (null: AUTO / empty); a character already somewhere else moves here */
  assign(d, slot, id) {
    const S = d.squad; S.bench = S.bench || [];
    if (id) { for (const k of SQUAD_KEYS) if (S[k] === id) delete S[k]; S.bench = S.bench.filter((x) => x !== id); }
    if (slot[0] === 'B') { const i = +slot.slice(1); if (id) S.bench[Math.min(i, S.bench.length)] = id; else S.bench.splice(i, 1); S.bench = S.bench.filter(Boolean).slice(0, BENCH_MAX); }
    else if (id) S[slot] = id; else delete S[slot];
  },
  /** a player card: the rating, the spot, the face, the name (in its rarity colour) */
  card(id, slot, o = {}) {
    const st = STYLES[id], bench = slot[0] === 'B', key = bench ? 'BENCH' : slot, ovr = st ? ovrOf(id, key) : 0, out = st && !bench && st.role !== slot;
    const pos = o.me ? 'YOU' : bench ? (st ? ROLES[st.role].name.slice(0, 3) : 'SUB') : slot === 'WING' ? 'WG' : slot;
    return `<button class="fc-card${o.me ? ' me' : ''}${st ? '' : ' empty'}${o.sel ? ' sel' : ''}" type="button" ${o.attr || `data-slot="${slot}"`} style="--rc:${st ? RARITY_HEX[st.rarity] : '#5a5f78'}${o.xy ? `;left:${o.xy[0]}%;top:${o.xy[1]}%` : ''}">
      <span class="fc-ovr${out ? ' out' : ''}">${st ? ovr : bench ? '+' : '?'}</span><span class="fc-pos">${pos}</span><i class="fc-pt" data-port="${st ? id : ''}"></i><b class="fc-name">${st ? st.name : bench ? 'EMPTY' : 'AUTO'}</b></button>`;
  },
  /** swap the placeholder of each card for its portrait */
  ports(root) {
    for (const el of root.querySelectorAll('.fc-pt')) { const id = el.dataset.port, cv = id ? portraitCanvas(id, 56, { sig: true }) : iconCanvas('smile', '#a4a9cf'); cv.className = 'px fc-face'; el.replaceWith(cv); }
  },
  render() {
    if (!$('tm-pitch')) return;
    const d = Save.data, me = mySlot(d);
    $('tm-ovr').innerHTML = `<span>TEAM OVR</span><b>${teamOvr(d)}</b>`;
    const P = $('tm-pitch'); P.querySelectorAll('.fc-card').forEach((c) => c.remove());
    P.insertAdjacentHTML('beforeend', SQUAD_KEYS.map((k) => (k === me ? this.card(d.style, k, { me: true, xy: TM_SPOTS[k] }) : this.card(d.squad[k], k, { xy: TM_SPOTS[k] }))).join(''));
    $('tm-bench').innerHTML = [0, 1, 2].map((i) => this.card(d.squad.bench[i], 'B' + i)).join('');
    this.ports(P); this.ports($('tm-bench'));
  },
  /** the story screen's small version: the five cards and the OVR */
  mini() {
    const d = Save.data, me = mySlot(d);
    return `<div class="tm-mini">${SQUAD_KEYS.map((k) => (k === me ? this.card(d.style, k, { me: true }) : this.card(d.squad[k], k))).join('')}</div>`;
  },
  /** SUBS in the pause menu: pick someone on the bench, then who comes off */
  openSubs() { this.subPick = null; $('subs-msg').textContent = ''; this.renderSubs(); $('subs').hidden = false; },
  renderSubs(keepMsg) {
    const m = Game.match; if (!m) return;
    if (!keepMsg) $('subs-msg').textContent = m.subsLeft > 0 ? (this.subPick ? 'NOW PICK WHO COMES OFF' : 'PICK A PLAYER ON THE BENCH') + ' · ' + m.subsLeft + ' SUBS LEFT' : 'NO SUBS LEFT THIS MATCH';
    $('subs-bench').innerHTML = m.bench.map((id) => this.card(id, 'B0', { attr: `data-sub="${id}"`, sel: this.subPick === id })).join('') || '<p class="tm-note">YOUR BENCH IS EMPTY. FILL IT IN MY TEAM.</p>';
    const on = m.players.map((p, i) => [p, i]).filter(([p]) => p.team === m.human.team && !p.isHuman && !p.isGK);
    $('subs-on').innerHTML = on.map(([p, i]) => this.card(p.styleId, SQUAD_OF[p.role] || 'MID', { attr: `data-off="${i}"` })).join('');
    $('subs-on').classList.toggle('off', !this.subPick || m.subsLeft <= 0);
    this.ports($('subs-bench')); this.ports($('subs-on'));
  },
};
