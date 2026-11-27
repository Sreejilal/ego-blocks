/* =====================================================================
   TeamUI: MY TEAM (owner, Nov 2026: "the team system should be like [a big mobile football game] where you can have subs";
   Nov 26 2026: "change the team with a drag and drop, when you click a position it should show all your characters, and an
   option to customise their numbers and their outfits, not the club colours").
   Cards on a pitch for the five spots (SQUAD_SLOTS) with each character's rating (ovrOf, lower out of position), the team's
   OVR, your own card in your spot, and a bench of up to 3 (Save.data.squad.bench). Beside it: the spot you picked (tap a
   card) with that player's OUTFIT (number, hair, hair colour, face, boots, gloves, extra, kit pattern: Save.data.squadLook,
   only skins you own, always in the club's colours) and YOUR PLAYERS, every character you have. Drag any card onto a spot
   or the bench (cards on the pitch swap places), or tap a spot and then a player. Your team plays every offline match; in a
   match the pause menu's SUBS brings a bench character on for one of your bots (Match.subIn, SUBS_MAX a match).
   The story screen's small team still uses the story picker (#st-pick, StoryUI.openPick)
   ===================================================================== */
const TM_SPOTS = { ST: [50, 16], WING: [17, 37], MID: [83, 37], DEF: [50, 58], GK: [50, 84] }; // where each spot's card sits on the pitch (%)
const TM_OUTFIT = [['hair', 'HAIR'], ['color', 'HAIR COLOUR'], ['face', 'FACE'], ['boots', 'BOOTS'], ['gloves', 'GLOVES'], ['acc', 'EXTRA'], ['kit', 'KIT PATTERN']];
const TeamUI = {
  from: 'lobby', subPick: null, sel: null, drag: null,
  tpl() {
    return `<section id="scr-team" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>MY TEAM</h2><div class="tm-ovr" id="tm-ovr"></div><button class="btn small" id="team-back" type="button">BACK</button></div>
        <section class="panel tm-box">
          <div class="tm-left">
            <div class="tm-pitch" id="tm-pitch"><i class="tm-half"></i><i class="tm-circle"></i><i class="tm-box1"></i><i class="tm-box2"></i></div>
            <div class="tm-benchrow"><h3>BENCH</h3><div class="tm-bench" id="tm-bench"></div></div>
            <p class="tm-note">In a match, the pause menu's SUBS brings the bench on (3 subs a match). The number on a card is the rating: higher for rarer characters, 6 lower out of their position.</p>
          </div>
          <div class="tm-side">
            <div class="tm-sel" id="tm-sel"></div>
            <div class="tm-rhead"><h3>YOUR PLAYERS</h3><span class="tm-note" id="tm-rnote"></span></div>
            <div class="tm-roster" id="tm-roster"></div>
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
    // tap a spot: it is the one you change (your own spot: the LOCKER)
    const pick = (e) => {
      if (this.dragged) { this.dragged = false; return; } // the click that ends a drag
      const b = e.target.closest('[data-slot]'); if (!b) return;
      Sfx.click(); this.sel = b.dataset.slot; this.render();
    };
    $('tm-pitch').addEventListener('click', pick); $('tm-bench').addEventListener('click', pick);
    // tap one of your players: they go into the spot you picked
    $('tm-roster').addEventListener('click', (e) => {
      if (this.dragged) { this.dragged = false; return; }
      const b = e.target.closest('[data-pick]'); if (!b) return;
      this.place(b.dataset.pick, this.sel);
    });
    $('tm-sel').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      Sfx.click();
      if (b.id === 'tm-locker') { UI.openLocker(); return; }
      if (b.id === 'tm-out') { TeamUI.assign(Save.data, this.sel, null); Save.save(); this.changed(); return; }
      if (b.dataset.num) { this.setNum(+b.dataset.num); return; }
      if (b.dataset.of) this.cycle(b.dataset.of, +b.dataset.dir);
    });
    this.bindDrag();
    $('subs-bench').addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (!b) return; Sfx.click(); this.subPick = b.dataset.sub; this.renderSubs(); });
    $('subs-on').addEventListener('click', (e) => {
      const b = e.target.closest('[data-off]'), m = Game.match; if (!b || !m || !this.subPick) return;
      const old = m.players[+b.dataset.off], p = m.subIn(old, this.subPick);
      if (p) { Sfx.coin(); this.subPick = null; $('subs-msg').textContent = STYLES[p.styleId].name + ' IS ON. ' + m.subsLeft + ' SUBS LEFT'; this.renderSubs(true); }
    });
  },
  /* ---------- drag and drop (mouse, touch and pen: pointer events) ---------- */
  bindDrag() {
    const root = $('scr-team');
    root.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.fc-card[data-drag]'); if (!c || e.button > 0) return;
      this.drag = { el: c, id: c.dataset.drag, from: c.dataset.slot || null, x0: e.clientX, y0: e.clientY, on: false, pid: e.pointerId, over: null };
    });
    window.addEventListener('pointermove', (e) => {
      const D = this.drag; if (!D || e.pointerId !== D.pid) return;
      if (!D.on) {
        if (Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < 9) return;
        D.on = true; D.ghost = D.el.cloneNode(true); D.ghost.className = D.el.className + ' tm-ghost'; D.ghost.removeAttribute('data-slot'); D.ghost.removeAttribute('data-drag');
        document.body.appendChild(D.ghost); D.el.classList.add('dragging'); Sfx.click();
      }
      D.ghost.style.left = e.clientX + 'px'; D.ghost.style.top = e.clientY + 'px';
      const t = document.elementFromPoint(e.clientX, e.clientY), s = t && t.closest('#scr-team [data-slot]');
      if (D.over && D.over !== s) D.over.classList.remove('drop');
      D.over = s && s !== D.el && this.fits(D.id, s.dataset.slot) ? s : null;
      if (D.over) D.over.classList.add('drop');
      e.preventDefault();
    }, { passive: false });
    const end = (e, ok) => {
      const D = this.drag; if (!D || e.pointerId !== D.pid) return;
      this.drag = null;
      if (!D.on) return;
      D.ghost.remove(); D.el.classList.remove('dragging'); if (D.over) D.over.classList.remove('drop');
      this.dragged = true; setTimeout(() => { this.dragged = false; }, 0); // the click right after a drag is not a tap
      if (ok && D.over) this.dropOn(D, D.over.dataset.slot);
      else if (ok && D.from) { const t = document.elementFromPoint(e.clientX, e.clientY); if (t && t.closest('#tm-roster')) { this.assign(Save.data, D.from, null); Save.save(); this.changed(); } } // dragged back to YOUR PLAYERS: off the team
    };
    window.addEventListener('pointerup', (e) => end(e, true));
    window.addEventListener('pointercancel', (e) => end(e, false));
  },
  /** who is in a spot ('ST', 'B0' for the bench...), or null */
  at(d, slot) { return slot[0] === 'B' ? (d.squad.bench || [])[+slot.slice(1)] || null : d.squad[slot] || null; },
  /** can a character go there: keepers only in goal (their powers only work there), anyone can go in goal; not your spot */
  fits(id, slot) {
    const st = STYLES[id]; if (!st || !slot) return false;
    if (slot === mySlot(Save.data)) return false;
    return slot === 'GK' || !st.gk;
  },
  /** a card dropped on a spot: from the pitch or the bench the two swap, from YOUR PLAYERS it simply goes there */
  dropOn(D, slot) {
    const d = Save.data;
    if (!this.fits(D.id, slot)) { Sfx.deny(); return; }
    if (D.from && D.from !== slot) {
      const other = this.at(d, slot);
      this.assign(d, slot, D.id);
      if (other && this.fits(other, D.from)) this.assign(d, D.from, other);
    } else this.assign(d, slot, D.id);
    this.sel = slot; Sfx.equip ? Sfx.equip() : Sfx.click(); Save.save(); this.changed();
  },
  /** tap a player with a spot picked */
  place(id, slot) {
    if (!slot || !this.fits(id, slot)) { Sfx.deny(); UI.toast(slot === mySlot(Save.data) ? 'THAT IS YOUR SPOT: CHANGE YOUR CHARACTER IN THE LOCKER' : STYLES[id] && STYLES[id].gk ? 'KEEPERS ONLY PLAY IN GOAL' : 'TAP A SPOT FIRST'); return; }
    Sfx.equip ? Sfx.equip() : Sfx.click();
    this.assign(Save.data, slot, id); Save.save(); this.changed();
  },
  changed() { this.render(); if (UI.cur === 'story') StoryUI.render(); UI.renderLobby(); },
  /** put a character in a spot or on the bench (null: ROOKIE plays the spot / the bench place is empty); a character already somewhere else moves here */
  assign(d, slot, id) {
    const S = d.squad; S.bench = S.bench || [];
    if (id) { for (const k of SQUAD_KEYS) if (S[k] === id) delete S[k]; S.bench = S.bench.filter((x) => x !== id); }
    if (slot[0] === 'B') { const i = +slot.slice(1); if (id) S.bench[Math.min(i, S.bench.length)] = id; else S.bench.splice(i, 1); S.bench = S.bench.filter(Boolean).slice(0, BENCH_MAX); }
    else if (id) S[slot] = id; else delete S[slot];
  },
  /* ---------- outfits: one per character, kept in Save.data.squadLook ---------- */
  look(id) { const d = Save.data; d.squadLook = d.squadLook || {}; return d.squadLook[id] || (d.squadLook[id] = {}); },
  /** a slot's choices: its free one first, then the skins you own */
  options(slot) {
    const d = Save.data, base = (SKIN_SLOTS.find((x) => x.id === slot) || {}).base;
    return [base, ...Object.keys(SKINS).filter((k) => SKINS[k].slot === slot && k !== base && (SKINS[k].base || d.skins.includes(k)))].filter((k) => SKINS[k]);
  },
  cycle(slot, dir) {
    const id = this.at(Save.data, this.sel); if (!id) return;
    const L = this.look(id), opts = this.options(slot), base = opts[0], i = Math.max(0, opts.indexOf(L[slot] || base));
    const k = opts[(i + dir + opts.length) % opts.length];
    if (k === base) delete L[slot]; else L[slot] = k;
    Save.save(); this.render();
  },
  setNum(dir) {
    const id = this.at(Save.data, this.sel); if (!id) return;
    const L = this.look(id), n0 = L.n || (this.sel === 'GK' ? 1 : 0);
    let n = n0 ? n0 + dir : dir > 0 ? 2 : 99;
    if (n > 99) n = 1; if (n < 1) n = 99;
    L.n = n; Save.save(); this.render();
  },
  /** a player card: the rating, the spot, the face, the name (in its rarity colour) */
  card(id, slot, o = {}) {
    const st = STYLES[id], bench = slot[0] === 'B', key = bench ? 'BENCH' : slot, ovr = st ? ovrOf(id, key) : 0, out = st && !bench && slot !== 'LIST' && st.role !== slot;
    const pos = o.me ? 'YOU' : bench || slot === 'LIST' ? (st ? ROLES[st.role].name.slice(0, 3) : 'SUB') : slot === 'WING' ? 'WG' : slot;
    const num = st && !o.me && Save.data.squadLook && Save.data.squadLook[id] && Save.data.squadLook[id].n;
    const drag = st && !o.me && !o.attr && !o.filler ? ` data-drag="${id}"` : ''; // filler: ROOKIE in a spot nobody was put in (owner: never AUTO)
    return `<button class="fc-card${o.me ? ' me' : ''}${st ? '' : ' empty'}${o.sel ? ' sel' : ''}${o.dim ? ' dim' : ''}" type="button" ${o.attr || `data-slot="${slot}"`}${drag} style="--rc:${st ? RARITY_HEX[st.rarity] : '#5a5f78'}${o.xy ? `;left:${o.xy[0]}%;top:${o.xy[1]}%` : ''}">
      <span class="fc-ovr${out ? ' out' : ''}">${st ? ovr : bench ? '+' : '?'}</span><span class="fc-pos">${pos}</span>${num ? `<span class="fc-num">${num}</span>` : ''}<i class="fc-pt" data-port="${st ? id : ''}"></i><b class="fc-name">${st ? st.name : bench ? 'EMPTY' : 'AUTO'}</b>${o.tag ? `<span class="fc-tag">${o.tag}</span>` : ''}</button>`;
  },
  /** swap the placeholder of each card for its portrait (wearing their outfit) */
  ports(root) {
    const L = Save.data.squadLook || {};
    for (const el of root.querySelectorAll('.fc-pt')) { const id = el.dataset.port, cv = id ? portraitCanvas(id, 56, L[id] ? Object.assign(lookFor(id, L[id]), { sig: true }) : { sig: true }) : iconCanvas('smile', '#a4a9cf'); cv.className = 'px fc-face'; el.replaceWith(cv); }
  },
  /** every character you have (your own one plays your spot, so it is not here) */
  roster(d) { const ids = d.styles.slice(); if (d.spunStyle && STYLES[d.spunStyle] && !ids.includes(d.spunStyle)) ids.push(d.spunStyle); return ids.filter((id) => STYLES[id] && id !== d.style); },
  render() {
    if (!$('tm-pitch')) return;
    const d = Save.data, me = mySlot(d);
    if (!this.sel || (this.sel[0] === 'B' ? false : !SQUAD_KEYS.includes(this.sel))) this.sel = SQUAD_KEYS.find((k) => k !== me) || 'ST';
    $('tm-ovr').innerHTML = `<span>TEAM OVR</span><b>${teamOvr(d)}</b>`;
    const P = $('tm-pitch'); P.querySelectorAll('.fc-card').forEach((c) => c.remove());
    P.insertAdjacentHTML('beforeend', SQUAD_KEYS.map((k) => (k === me ? this.card(d.style, k, { me: true, xy: TM_SPOTS[k], sel: this.sel === k }) : this.card(d.squad[k] || 'ROOKIE', k, { xy: TM_SPOTS[k], sel: this.sel === k, filler: !d.squad[k] }))).join(''));
    $('tm-bench').innerHTML = [0, 1, 2].map((i) => this.card(d.squad.bench[i], 'B' + i, { sel: this.sel === 'B' + i })).join('');
    this.renderSel(d, me);
    const where = (id) => { const k = SQUAD_KEYS.find((x) => d.squad[x] === id); return k ? (k === 'WING' ? 'WG' : k) : (d.squad.bench || []).includes(id) ? 'BENCH' : ''; };
    const ids = this.roster(d).sort((a, b) => ovrOf(b, this.sel[0] === 'B' ? 'BENCH' : this.sel) - ovrOf(a, this.sel[0] === 'B' ? 'BENCH' : this.sel));
    $('tm-roster').innerHTML = ids.map((id) => this.card(id, 'LIST', { attr: `data-pick="${id}" data-drag="${id}"`, dim: !this.fits(id, this.sel), tag: where(id) || (STYLES[id].gk ? 'KEEPER' : '') })).join('') || '<p class="tm-note">NO OTHER CHARACTERS YET. GET THEM FROM SPINS AND STORY MODE.</p>';
    $('tm-rnote').textContent = ids.length + (ids.length === 1 ? ' PLAYER' : ' PLAYERS') + ' · DRAG ONE ONTO A SPOT';
    this.ports(P); this.ports($('tm-bench')); this.ports($('tm-roster')); this.ports($('tm-sel'));
  },
  /** the spot you picked: who plays there and their outfit */
  renderSel(d, me) {
    const s = this.sel, nm = s[0] === 'B' ? 'BENCH ' + (+s.slice(1) + 1) : (SQUAD_SLOTS.find((x) => x[0] === s) || [0, s])[1], el = $('tm-sel');
    if (s === me) { el.innerHTML = `<div class="tm-who"><i class="fc-pt" data-port="${d.style}"></i><div><span class="label">${nm} · YOU</span><b>${STYLES[d.style].name}</b><p class="tm-note">This is your spot. Change your character and your look in the LOCKER.</p></div></div><button class="btn small blue" id="tm-locker" type="button">OPEN LOCKER</button>`; return; }
    const id = this.at(d, s);
    if (!id) { el.innerHTML = `<div class="tm-who"><i class="fc-pt" data-port="${s[0] === 'B' ? '' : 'ROOKIE'}"></i><div><span class="label">${nm}</span><b>${s[0] === 'B' ? 'EMPTY' : 'ROOKIE'}</b><p class="tm-note">${s[0] === 'B' ? 'Nobody here yet.' : 'ROOKIE plays here until you pick someone.'} Tap one of your players below, or drag them here.</p></div></div>`; return; }
    const L = (d.squadLook || {})[id] || {}, num = L.n || (s === 'GK' ? 1 : 0);
    const row = ([slot, label]) => { const opts = this.options(slot), cur = SKINS[L[slot] || opts[0]]; return `<div class="tm-orow"><span class="label">${label}</span><button class="btn small" type="button" data-of="${slot}" data-dir="-1" aria-label="previous ${label.toLowerCase()}">&lt;</button><b>${cur ? esc(cur.name) : 'FREE'}</b><button class="btn small" type="button" data-of="${slot}" data-dir="1" aria-label="next ${label.toLowerCase()}">&gt;</button></div>`; };
    el.innerHTML = `<div class="tm-who"><i class="fc-pt" data-port="${id}"></i><div><span class="label">${nm} · RATING ${ovrOf(id, s[0] === 'B' ? 'BENCH' : s)}</span><b>${STYLES[id].name}</b></div><button class="btn small" id="tm-out" type="button">TAKE OFF</button></div>
      <h3 class="tm-oh">OUTFIT</h3>
      <div class="tm-outfit"><div class="tm-orow"><span class="label">NUMBER</span><button class="btn small" type="button" data-num="-1" aria-label="lower number">-</button><b class="tm-n">${num || 'ANY'}</b><button class="btn small" type="button" data-num="1" aria-label="higher number">+</button></div>${TM_OUTFIT.map(row).join('')}</div>
      <p class="tm-note">Only skins you own. The club's colours stay: spin for more skins.</p>`;
  },
  /** the story screen's small version: the five cards and the OVR */
  mini() {
    const d = Save.data, me = mySlot(d);
    return `<div class="tm-mini">${SQUAD_KEYS.map((k) => (k === me ? this.card(d.style, k, { me: true }) : this.card(d.squad[k] || 'ROOKIE', k, { attr: `data-slot="${k}"` }))).join('')}</div>`;
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
