/* =====================================================================
   TeamUI: MY CLUB (owner, Nov 2026: "the team system should be like [a big mobile football game] where you can have subs";
   Nov 26: drag and drop, every character on the side, outfits; Nov 27: "you should see the captain of the team, then the
   team at the side done properly, then the market, and a players locker room where you can customise every character, and
   you should see the changes you made").
   Three tabs, each with the 3D stage (Showcase in 'locker' mode, drag to turn) showing who you are looking at:
   - SQUAD: your CAPTAIN (your own player) in 3D, the pitch with the five spots (SQUAD_SLOTS, a spot nobody was put in is
     ROOKIE) and the bench of 3, and YOUR PLAYERS beside it. Drag any card onto a spot or the bench (cards on the pitch swap
     places, back onto YOUR PLAYERS takes it off), or tap a spot and then a player.
   - LOCKER ROOM: every character you have, the captain first; each one's number, hair, hair colour, face, boots, gloves,
     extra, kit pattern and Flow (only what you own, always in the club's colours). The 3D model changes as you change it.
     Squad characters: Save.data.squadLook; the captain: your own look (Save.data.look, flow, capNum).
   - MARKET: today's characters for emeralds and the ones you sold (priced up), and selling yours (Market in 07_data.js).
   In a match the pause menu's SUBS brings a bench character on for one of your bots (Match.subIn, SUBS_MAX a match).
   The story screen's small team still uses the story picker (#st-pick, StoryUI.openPick)
   ===================================================================== */
const TM_SPOTS = { ST: [50, 16], WING: [17, 37], MID: [83, 37], DEF: [50, 58], GK: [50, 84] }; // where each spot's card sits on the pitch (%)
const TM_OUTFIT = [['hair', 'HAIR'], ['color', 'HAIR COLOUR'], ['face', 'FACE'], ['boots', 'BOOTS'], ['gloves', 'GLOVES'], ['acc', 'EXTRA'], ['kit', 'KIT PATTERN']];
const TM_TABS = [['squad', 'SQUAD'], ['room', 'LOCKER ROOM'], ['market', 'MARKET']];
const TeamUI = {
  from: 'lobby', subPick: null, sel: null, drag: null, tab: 'squad', who: null, mk: null,
  tpl() {
    return `<section id="scr-team" class="screen sub-screen club" hidden>
      <div class="sub-wrap cl-wrap">
        <div class="sub-head cl-head"><h2>MY CLUB</h2>
          <div class="cl-tabs" role="tablist">${TM_TABS.map(([k, n]) => `<button class="cl-tab" type="button" role="tab" data-tab="${k}" id="cl-tab-${k}">${n}</button>`).join('')}</div>
          <div class="tm-ovr" id="tm-ovr"></div><span class="cl-em" id="cl-em"></span><button class="btn small" id="team-back" type="button">BACK</button></div>
        <section class="cl-body cl-squad" id="cl-squad">
          <div class="cl-col cl-cap"><div class="cl-stage" id="cl-fit-squad" title="Drag to turn"><span class="label lk-drag">CAPTAIN · DRAG TO TURN</span></div><div class="cl-info panel" id="cl-capinfo"></div></div>
          <div class="cl-col tm-left panel">
            <div class="tm-pitch" id="tm-pitch"><i class="tm-half"></i><i class="tm-circle"></i><i class="tm-box1"></i><i class="tm-box2"></i></div>
            <div class="tm-benchrow"><h3>BENCH</h3><div class="tm-bench" id="tm-bench"></div></div>
          </div>
          <div class="cl-col tm-side panel">
            <div class="tm-sel" id="tm-sel"></div>
            <div class="tm-rhead"><h3>YOUR PLAYERS</h3><span class="tm-note" id="tm-rnote"></span></div>
            <div class="tm-roster" id="tm-roster"></div>
            <p class="tm-note">In a match, the pause menu's SUBS brings the bench on (3 a match). The big number is the rating: 6 lower out of position.</p>
          </div>
        </section>
        <section class="cl-body cl-room" id="cl-room" hidden>
          <div class="cl-col panel"><h3>YOUR PLAYERS</h3><div class="lr-list" id="lr-list"></div></div>
          <div class="cl-col cl-mid"><div class="cl-stage" id="cl-fit-room" title="Drag to turn"><span class="label lk-drag">DRAG TO TURN</span></div></div>
          <div class="cl-col panel lr-edit" id="lr-edit"></div>
        </section>
        <section class="cl-body cl-market" id="cl-market" hidden>
          <div class="cl-col panel"><h3>FOR SALE TODAY</h3><p class="tm-note">A new list every day. Players you sell come back here, for more.</p><div class="mk-list" id="mk-buy"></div></div>
          <div class="cl-col cl-mid"><div class="cl-stage" id="cl-fit-market" title="Drag to turn"><span class="label lk-drag">DRAG TO TURN</span></div><div class="cl-info panel" id="mk-info"></div></div>
          <div class="cl-col panel"><h3>SELL YOUR PLAYERS</h3><p class="tm-note">You get half their price. Story characters and your captain stay.</p><div class="mk-list" id="mk-sell"></div></div>
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
    document.querySelector('#scr-team .cl-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; Sfx.click(); this.setTab(b.dataset.tab); });
    // SQUAD: tap a spot, then one of your players
    const pick = (e) => {
      if (this.dragged) { this.dragged = false; return; } // the click that ends a drag
      const b = e.target.closest('[data-slot]'); if (!b) return;
      Sfx.click(); this.sel = b.dataset.slot; this.render();
    };
    $('tm-pitch').addEventListener('click', pick); $('tm-bench').addEventListener('click', pick);
    $('tm-roster').addEventListener('click', (e) => {
      if (this.dragged) { this.dragged = false; return; }
      const b = e.target.closest('[data-pick]'); if (!b) return;
      this.place(b.dataset.pick, this.sel);
    });
    $('tm-sel').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      Sfx.click();
      if (b.id === 'tm-out') { TeamUI.assign(Save.data, this.sel, null); Save.save(); this.changed(); return; }
      if (b.dataset.room) { this.who = b.dataset.room; this.setTab('room'); }
    });
    $('cl-capinfo').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; Sfx.click(); if (b.id === 'cl-locker') UI.openLocker(); else { this.who = 'CAPTAIN'; this.setTab('room'); } });
    // LOCKER ROOM: pick who, then change their outfit (the 3D model changes with it)
    $('lr-list').addEventListener('click', (e) => { const b = e.target.closest('[data-who]'); if (!b) return; Sfx.click(); this.who = b.dataset.who; this.renderRoom(); });
    $('lr-edit').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      Sfx.click();
      if (b.id === 'lr-locker') { UI.openLocker(); return; }
      if (b.dataset.num) this.setNum(+b.dataset.num); else if (b.dataset.of) this.cycle(b.dataset.of, +b.dataset.dir);
    });
    // MARKET: tap a player to see them, BUY or SELL (a second tap to be sure)
    const mk = (e) => {
      const b = e.target.closest('[data-mk]'); if (!b) return;
      const [act, id] = b.dataset.mk.split(':');
      if (act === 'see') { Sfx.click(); this.mk = id; this.renderMarket(); return; }
      if (b.dataset.armed !== '1') { Sfx.click(); this.mk = id; this.renderMarket(); const nb = document.querySelector(`[data-mk="${act}:${id}"]`); if (nb) { nb.dataset.armed = '1'; nb.textContent = act === 'buy' ? 'TAP AGAIN TO BUY' : 'TAP AGAIN TO SELL'; } return; }
      const d = Save.data, r = act === 'buy' ? Market.buy(d, id) : Market.sell(d, id);
      if (r === true) { Sfx.coin(); Save.save(); UI.toast(act === 'buy' ? STYLES[id].name + ' JOINED YOUR CLUB' : 'SOLD ' + STYLES[id].name + ' FOR ' + Market.sellPrice(d, id) + ' EMERALDS', 'gold'); this.mk = act === 'buy' ? id : null; UI.renderLobby(); }
      else { Sfx.deny(); UI.toast(r, 'bad'); }
      this.render();
    };
    $('mk-buy').addEventListener('click', mk); $('mk-sell').addEventListener('click', mk);
    this.bindDrag();
    $('subs-bench').addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (!b) return; Sfx.click(); this.subPick = b.dataset.sub; this.renderSubs(); });
    $('subs-on').addEventListener('click', (e) => {
      const b = e.target.closest('[data-off]'), m = Game.match; if (!b || !m || !this.subPick) return;
      const old = m.players[+b.dataset.off], p = m.subIn(old, this.subPick);
      if (p) { Sfx.coin(); this.subPick = null; $('subs-msg').textContent = STYLES[p.styleId].name + ' IS ON. ' + m.subsLeft + ' SUBS LEFT'; this.renderSubs(true); }
    });
  },
  setTab(t) { this.tab = TM_TABS.some((x) => x[0] === t) ? t : 'squad'; this.render(); },
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
  /* ---------- outfits: a squad character's in Save.data.squadLook, the captain's is your own look ---------- */
  look(id) { const d = Save.data; d.squadLook = d.squadLook || {}; return d.squadLook[id] || (d.squadLook[id] = {}); },
  /** a slot's choices: its free one first, then the skins you own */
  options(slot) {
    const d = Save.data, base = (SKIN_SLOTS.find((x) => x.id === slot) || {}).base;
    return [base, ...Object.keys(SKINS).filter((k) => SKINS[k].slot === slot && k !== base && (SKINS[k].base || d.skins.includes(k)))].filter((k) => SKINS[k]);
  },
  flows() { return [null, ...Save.data.flows.filter((f) => FLOWS[f])]; },
  cycle(slot, dir) {
    const d = Save.data, cap = this.who === 'CAPTAIN', id = cap ? d.style : this.who; if (!id || !STYLES[id]) return;
    if (slot === 'flow') { const F = this.flows(), cur = cap ? d.flow || null : this.look(id).flow || null, k = F[(Math.max(0, F.indexOf(cur)) + dir + F.length) % F.length]; if (cap) d.flow = k; else if (k) this.look(id).flow = k; else delete this.look(id).flow; }
    else {
      const opts = this.options(slot), base = opts[0], cur = cap ? d.look[slot] || base : this.look(id)[slot] || base, k = opts[(Math.max(0, opts.indexOf(cur)) + dir + opts.length) % opts.length];
      if (cap) d.look[slot] = k; else if (k === base) delete this.look(id)[slot]; else this.look(id)[slot] = k;
    }
    Save.save(); this.renderRoom(); if (cap) UI.renderLobby();
  },
  setNum(dir) {
    const d = Save.data, cap = this.who === 'CAPTAIN', id = cap ? d.style : this.who; if (!id) return;
    const n0 = cap ? d.capNum || 10 : this.look(id).n || 0;
    let n = n0 ? n0 + dir : dir > 0 ? 2 : 99;
    if (n > 99) n = 1; if (n < 1) n = 99;
    if (cap) d.capNum = n; else this.look(id).n = n;
    Save.save(); this.renderRoom();
  },
  /** a player card: the rating, the spot, the face, the name (in its rarity colour) */
  card(id, slot, o = {}) {
    const st = STYLES[id], bench = slot[0] === 'B', key = bench ? 'BENCH' : slot, ovr = st ? ovrOf(id, key) : 0, out = st && !bench && slot !== 'LIST' && st.role !== slot;
    const pos = o.me ? 'YOU' : bench || slot === 'LIST' ? (st ? ROLES[st.role].name.slice(0, 3) : 'SUB') : slot === 'WING' ? 'WG' : slot;
    const num = o.me ? Save.data.capNum || 10 : st && !o.filler && Save.data.squadLook && Save.data.squadLook[id] && Save.data.squadLook[id].n;
    const drag = st && !o.me && !o.attr && !o.filler ? ` data-drag="${id}"` : ''; // filler: ROOKIE in a spot nobody was put in (owner: never AUTO)
    return `<button class="fc-card${o.me ? ' me' : ''}${st ? '' : ' empty'}${o.sel ? ' sel' : ''}${o.dim ? ' dim' : ''}" type="button" ${o.attr || `data-slot="${slot}"`}${drag} style="--rc:${st ? RARITY_HEX[st.rarity] : '#5a5f78'}${o.xy ? `;left:${o.xy[0]}%;top:${o.xy[1]}%` : ''}">
      <span class="fc-ovr${out ? ' out' : ''}">${st ? ovr : bench ? '+' : '?'}</span><span class="fc-pos">${pos}</span>${num ? `<span class="fc-num">${num}</span>` : ''}<i class="fc-pt" data-port="${st ? id : ''}"${o.me ? ' data-me="1"' : ''}></i><b class="fc-name">${st ? st.name : bench ? 'EMPTY' : 'ROOKIE'}</b>${o.tag ? `<span class="fc-tag">${o.tag}</span>` : ''}</button>`;
  },
  /** swap the placeholder of each card for its portrait (wearing their outfit; the captain wears your look) */
  ports(root) {
    const d = Save.data, L = d.squadLook || {};
    for (const el of root.querySelectorAll('.fc-pt')) {
      const id = el.dataset.port, me = el.dataset.me === '1';
      const cv = !id ? iconCanvas('smile', '#a4a9cf') : portraitCanvas(id, 56, me ? Object.assign(lookFor(id, d.look), { sig: true }) : L[id] ? Object.assign(lookFor(id, L[id]), { sig: true }) : { sig: true });
      cv.className = 'px fc-face'; el.replaceWith(cv);
    }
  },
  /** every character you have (your own one is the captain, so it is not here) */
  roster(d) { const ids = d.styles.slice(); if (d.spunStyle && STYLES[d.spunStyle] && !ids.includes(d.spunStyle)) ids.push(d.spunStyle); return ids.filter((id) => STYLES[id] && id !== d.style); },
  /** who the 3D stage shows, and where */
  stage(id, spec) { Showcase.setStage(id, 'locker'); Showcase.preview(spec); },
  specFor(id) { const L = (Save.data.squadLook || {})[id] || {}, gk = !!(STYLES[id] && STYLES[id].gk); return { style: id, flow: L.flow || null, look: squadLookIds(L), number: L.n || (gk ? 1 : 7), pos: gk ? 'GK' : 'ST' }; },
  render() {
    if (!$('tm-pitch')) return;
    const d = Save.data;
    for (const [k] of TM_TABS) { $('cl-' + k).hidden = k !== this.tab; $('cl-tab-' + k).setAttribute('aria-selected', String(k === this.tab)); }
    $('tm-ovr').innerHTML = `<span>TEAM OVR</span><b>${teamOvr(d)}</b>`;
    $('cl-em').innerHTML = `<img class="px" alt="" src="${iconURL('emerald')}"><b>${d.emeralds}</b>`;
    if (this.tab === 'room') this.renderRoom(); else if (this.tab === 'market') this.renderMarket(); else this.renderSquad();
  },
  renderSquad() {
    const d = Save.data, me = mySlot(d), st = STYLES[d.style];
    if (!this.sel || (this.sel[0] !== 'B' && !SQUAD_KEYS.includes(this.sel))) this.sel = SQUAD_KEYS.find((k) => k !== me) || 'ST';
    this.stage('cl-fit-squad', null); // the captain: your own player, as you look
    $('cl-capinfo').innerHTML = `<span class="label">CAPTAIN · ${(SQUAD_SLOTS.find((x) => x[0] === me) || [0, me])[1]}</span><b class="cl-capname">${st.name}</b>`
      + `<span class="cl-capline"><span class="rar" data-r="${st.rarity}">${st.rarity.toUpperCase()}</span> RATING ${ovrOf(d.style, me)} · #${d.capNum || 10} · ${d.flow && FLOWS[d.flow] ? 'FLOW ' + FLOWS[d.flow].name : 'NO FLOW'}</span>`
      + `<span class="cl-moves">${st.abilities.map((a) => `<i>${esc(ABILITIES[a].name)}</i>`).join('')}</span>`
      + `<span class="cl-btns"><button class="btn small blue" id="cl-custom" type="button">CUSTOMISE</button><button class="btn small" id="cl-locker" type="button">LOCKER</button></span>`;
    const P = $('tm-pitch'); P.querySelectorAll('.fc-card').forEach((c) => c.remove());
    P.insertAdjacentHTML('beforeend', SQUAD_KEYS.map((k) => (k === me ? this.card(d.style, k, { me: true, xy: TM_SPOTS[k], sel: this.sel === k }) : this.card(d.squad[k] || 'ROOKIE', k, { xy: TM_SPOTS[k], sel: this.sel === k, filler: !d.squad[k] }))).join(''));
    $('tm-bench').innerHTML = [0, 1, 2].map((i) => this.card(d.squad.bench[i], 'B' + i, { sel: this.sel === 'B' + i })).join('');
    this.renderSel(d, me);
    const where = (id) => { const k = SQUAD_KEYS.find((x) => d.squad[x] === id); return k ? (k === 'WING' ? 'WG' : k) : (d.squad.bench || []).includes(id) ? 'BENCH' : ''; };
    const key = this.sel[0] === 'B' ? 'BENCH' : this.sel, ids = this.roster(d).sort((a, b) => ovrOf(b, key) - ovrOf(a, key));
    $('tm-roster').innerHTML = ids.map((id) => this.card(id, 'LIST', { attr: `data-pick="${id}" data-drag="${id}"`, dim: !this.fits(id, this.sel), tag: where(id) || (STYLES[id].gk ? 'KEEPER' : '') })).join('') || '<p class="tm-note">NO OTHER CHARACTERS YET. GET THEM FROM SPINS, THE MARKET AND STORY MODE.</p>';
    $('tm-rnote').textContent = ids.length + (ids.length === 1 ? ' PLAYER' : ' PLAYERS') + ' · DRAG ONE ONTO A SPOT';
    this.ports($('tm-pitch')); this.ports($('tm-bench')); this.ports($('tm-roster'));
  },
  /** SQUAD: the spot you picked, in a line: who plays there, CUSTOMISE and TAKE OFF */
  renderSel(d, me) {
    const s = this.sel, nm = s[0] === 'B' ? 'BENCH ' + (+s.slice(1) + 1) : (SQUAD_SLOTS.find((x) => x[0] === s) || [0, s])[1], el = $('tm-sel'), id = this.at(d, s);
    if (s === me) { el.innerHTML = `<span class="label">${nm}</span><b>YOUR SPOT</b><span class="tm-note">Your captain plays here.</span>`; return; }
    if (!id) { el.innerHTML = `<span class="label">${nm}</span><b>${s[0] === 'B' ? 'EMPTY' : 'ROOKIE'}</b><span class="tm-note">${s[0] === 'B' ? 'Nobody here yet.' : 'ROOKIE plays here until you pick someone.'} Tap a player below or drag one here.</span>`; return; }
    el.innerHTML = `<span class="label">${nm} · RATING ${ovrOf(id, s[0] === 'B' ? 'BENCH' : s)}</span><b>${STYLES[id].name}</b><span class="tm-selbtns"><button class="btn small blue" type="button" data-room="${id}">CUSTOMISE</button><button class="btn small" id="tm-out" type="button">TAKE OFF</button></span>`;
  },
  /* ---------- LOCKER ROOM ---------- */
  renderRoom() {
    const d = Save.data, ids = this.roster(d);
    if (!this.who || (this.who !== 'CAPTAIN' && !ids.includes(this.who))) this.who = 'CAPTAIN';
    const cap = this.who === 'CAPTAIN', id = cap ? d.style : this.who, st = STYLES[id], L = cap ? null : (d.squadLook || {})[id] || {};
    this.stage('cl-fit-room', cap ? null : this.specFor(id));
    $('lr-list').innerHTML = [`<button class="lr-row${cap ? ' on' : ''}" type="button" data-who="CAPTAIN" style="--rc:${RARITY_HEX[STYLES[d.style].rarity]}"><i class="fc-pt" data-port="${d.style}" data-me="1"></i><b>${STYLES[d.style].name}</b><span>CAPTAIN · YOU · #${d.capNum || 10}</span></button>`]
      .concat(ids.map((x) => `<button class="lr-row${x === id && !cap ? ' on' : ''}" type="button" data-who="${x}" style="--rc:${RARITY_HEX[STYLES[x].rarity]}"><i class="fc-pt" data-port="${x}"></i><b>${STYLES[x].name}</b><span>${ROLES[STYLES[x].role].name}${(d.squadLook || {})[x] && d.squadLook[x].n ? ' · #' + d.squadLook[x].n : ''}</span></button>`)).join('');
    this.ports($('lr-list'));
    const cur = (slot) => (cap ? d.look[slot] : L[slot]) || this.options(slot)[0];
    const row = ([slot, label]) => { const k = SKINS[cur(slot)]; return `<div class="tm-orow"><span class="label">${label}</span><button class="btn small" type="button" data-of="${slot}" data-dir="-1" aria-label="previous ${label.toLowerCase()}">&lt;</button><b>${k ? esc(k.name) : 'FREE'}</b><button class="btn small" type="button" data-of="${slot}" data-dir="1" aria-label="next ${label.toLowerCase()}">&gt;</button></div>`; };
    const fl = cap ? d.flow : L.flow, num = cap ? d.capNum || 10 : L.n || 0;
    $('lr-edit').innerHTML = `<div class="lr-who"><span class="label">${cap ? 'CAPTAIN · YOU' : ROLES[st.role].name}</span><b>${st.name}</b><span class="rar" data-r="${st.rarity}">${st.rarity.toUpperCase()}</span></div>
      <div class="tm-outfit"><div class="tm-orow"><span class="label">NUMBER</span><button class="btn small" type="button" data-num="-1" aria-label="lower number">-</button><b class="tm-n">${num || 'ANY'}</b><button class="btn small" type="button" data-num="1" aria-label="higher number">+</button></div>
      ${TM_OUTFIT.map(row).join('')}
      <div class="tm-orow"><span class="label">FLOW</span><button class="btn small" type="button" data-of="flow" data-dir="-1" aria-label="previous flow">&lt;</button><b>${fl && FLOWS[fl] ? esc(FLOWS[fl].name) : 'NO FLOW'}</b><button class="btn small" type="button" data-of="flow" data-dir="1" aria-label="next flow">&gt;</button></div></div>
      <p class="tm-note">You see every change on the model. Only skins and Flows you own; the club's colours stay.${cap ? ' Change your character itself in the LOCKER.' : ''}</p>${cap ? '<button class="btn small" id="lr-locker" type="button">OPEN LOCKER</button>' : ''}`;
  },
  /* ---------- MARKET ---------- */
  renderMarket() {
    const d = Save.data, offers = Market.list(d), mine = d.styles.filter((id) => Market.canSell(d, id));
    if (!this.mk || !(offers.some((o) => o.id === this.mk) || mine.includes(this.mk))) this.mk = (offers[0] || {}).id || mine[0] || null;
    const id = this.mk, st = id && STYLES[id];
    this.stage('cl-fit-market', st ? this.specFor(id) : null);
    const row = (x, right) => `<div class="mk-row${x === id ? ' on' : ''}" style="--rc:${RARITY_HEX[STYLES[x].rarity]}"><button class="mk-see" type="button" data-mk="see:${x}"><i class="fc-pt" data-port="${x}"></i><b>${STYLES[x].name}</b><span><span class="rar" data-r="${STYLES[x].rarity}">${STYLES[x].rarity.toUpperCase()}</span> ${ROLES[STYLES[x].role].name} · ${ovrOf(x)}</span></button>${right}</div>`;
    $('mk-buy').innerHTML = offers.map((o) => row(o.id, `<span class="mk-price"><img class="px" alt="" src="${iconURL('emerald')}">${o.price}${o.mine ? '<em>YOU SOLD THEM: PRICE UP</em>' : ''}</span>${d.styles.includes(o.id) ? '<span class="tm-note">YOURS</span>' : `<button class="btn small ${d.emeralds >= o.price ? 'emerald' : ''}" type="button" data-mk="buy:${o.id}" ${d.emeralds >= o.price ? '' : 'disabled'}>BUY</button>`}`)).join('') || '<p class="tm-note">NOTHING LEFT TODAY. COME BACK TOMORROW.</p>';
    $('mk-sell').innerHTML = mine.map((x) => row(x, `<span class="mk-price"><img class="px" alt="" src="${iconURL('emerald')}">+${Market.sellPrice(d, x)}</span><button class="btn small" type="button" data-mk="sell:${x}">SELL</button>`)).join('') || '<p class="tm-note">NOBODY TO SELL: YOUR CAPTAIN AND STORY CHARACTERS STAY.</p>';
    $('mk-info').innerHTML = st ? `<span class="label">${ROLES[st.role].name} · RATING ${ovrOf(id)}</span><b class="cl-capname">${st.name}</b><span class="cl-moves">${st.abilities.map((a) => `<i>${esc(ABILITIES[a].name)}</i>`).join('')}</span>` : '<span class="tm-note">PICK A PLAYER TO SEE THEM</span>';
    this.ports($('mk-buy')); this.ports($('mk-sell'));
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
    $('subs-bench').innerHTML = m.bench.map((id) => this.card(id, 'B0', { attr: `data-sub="${id}"`, sel: this.subPick === id })).join('') || '<p class="tm-note">YOUR BENCH IS EMPTY. FILL IT IN MY CLUB.</p>';
    const on = m.players.map((p, i) => [p, i]).filter(([p]) => p.team === m.human.team && !p.isHuman && !p.isGK);
    $('subs-on').innerHTML = on.map(([p, i]) => this.card(p.styleId, SQUAD_OF[p.role] || 'MID', { attr: `data-off="${i}"` })).join('');
    $('subs-on').classList.toggle('off', !this.subPick || m.subsLeft <= 0);
    this.ports($('subs-bench')); this.ports($('subs-on'));
  },
};
