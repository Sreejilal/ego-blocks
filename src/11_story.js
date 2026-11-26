/* =====================================================================
   StoryUI: the STORY screen (owner, Nov 25 2026: "a story mode where you progress through a story of events"). Your team
   on top (a character for each kind of spot, Save.data.squad), then the chapters (STORY in 07_data.js): finished events
   with a tick and REPLAY, the one you are on open with its story and PLAY, the rest locked. Story matches start with
   Game.startMatch(event.mode, { story: event }); Game.finishMatch hands out the reward (Story.finish)
   ===================================================================== */
const StoryUI = {
  slot: null,
  tpl() {
    return `<section id="scr-story" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>STORY</h2><button class="btn small" id="story-back" type="button">BACK</button></div>
        <section class="panel st-intro" id="st-intro"></section>
        <section class="panel st-team"><div class="gp-th"><h3>YOUR TEAM</h3><span class="gp-th-l">In story matches you always play the teammate with the ball.</span><button class="btn small blue" id="st-edit" type="button">EDIT TEAM</button></div><div id="st-squad"></div></section>
        <div class="st-chapters" id="st-chapters"></div>
      </div>
    </section>
    <section id="st-pick" class="overlay" hidden>
      <div class="dialog panel st-pick-box"><h2 id="st-pick-t">STRIKER</h2><p class="md-sub">Characters you own. AUTO lets the game pick.</p><div class="st-pick-grid" id="st-pick-grid"></div><button class="btn" id="st-pick-close" type="button">CLOSE</button></div>
    </section>` + Cutscene.tpl();
  },
  bind() {
    const click = (id, fn) => $(id).addEventListener('click', () => { Sfx.init(); Sfx.click(); fn(); });
    Cutscene.bind();
    click('st-edit', () => UI.show('team'));
    click('story-back', () => UI.show('lobby'));
    click('st-pick-close', () => { $('st-pick').hidden = true; });
    $('st-squad').addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (!b) return; Sfx.click(); if (b.classList.contains('me')) UI.openLocker(); else this.openPick(b.dataset.slot); });
    $('st-pick-grid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-style]'); if (!b) return;
      Sfx.equip ? Sfx.equip() : Sfx.click();
      const d = Save.data;
      TeamUI.assign(d, this.slot, b.dataset.style === 'AUTO' ? null : b.dataset.style);
      Save.save(); $('st-pick').hidden = true; if (UI.cur === 'story') this.render(); TeamUI.render(); UI.renderLobby();
    });
    $('st-chapters').addEventListener('click', (e) => {
      const w = e.target.closest('[data-watch]');
      if (w) { const ev = STORY_EVENTS.find((x) => x.id === w.dataset.watch); if (ev && Story.done(Save.data, ev)) { Sfx.init(); Sfx.click(); this.watch(ev); } return; }
      const b = e.target.closest('[data-ev]'); if (!b) return;
      const ev = STORY_EVENTS.find((x) => x.id === b.dataset.ev);
      if (ev && Story.open(Save.data, ev)) { Sfx.init(); Sfx.click(); this.go(ev); }
    });
  },
  /** play an event: its scene first the first time, then the match (a replay goes straight in) */
  go(ev) {
    const start = () => Game.startMatch(ev.mode, { story: ev });
    if (Story.done(Save.data, ev)) start(); else Cutscene.story(ev, 'intro', start);
  },
  /** WATCH: an event you finished, its scene before and its scene after, back to the story screen (no match) */
  watch(ev) { Cutscene.story(ev, 'intro', () => Cutscene.story(ev, 'outro', () => { if (UI.cur === 'story') this.render(); }), { watch: true }); },
  /** the lobby button's line: how far you are */
  sub() { const d = Save.data, n = d.story.done.length, nx = Story.next(d); return nx ? 'CHAPTER ' + (nx.ch + 1) + ' · ' + n + '/' + STORY_EVENTS.length : 'FINISHED'; },
  rewards(r) {
    return (r.em ? `<span class="st-rw"><img class="px" alt="" src="${iconURL('emerald')}">${r.em}</span>` : '')
      + (r.bp ? `<span class="st-rw bp">${r.bp} BLUEPRINTS</span>` : '')
      + (r.style ? `<span class="st-rw ch" data-port="${r.style}" style="--rc:${RARITY_HEX[STYLES[r.style].rarity]}"><i class="st-pt"></i>${STYLES[r.style].name}</span>` : '');
  },
  render() {
    const d = Save.data, cur = Story.next(d), n = d.story.done.length;
    $('st-intro').innerHTML = `<div class="st-prog"><b>${n} / ${STORY_EVENTS.length}</b><span>EVENTS DONE</span></div>
      <p class="st-lead">${cur ? 'Take your club from the back pitch to the Voxel Cup. Every event pays out once, and three characters only come from here: ROGUE, IRONCLAD and SOLARIS.' : 'You won the Voxel Cup. Replay any event you like, the rewards are already yours.'}</p>`;
    $('st-squad').innerHTML = `<div class="st-tovr">TEAM OVR <b>${teamOvr(d)}</b></div>` + TeamUI.mini(); TeamUI.ports($('st-squad'));
    $('st-chapters').innerHTML = STORY.map((c, ci) => {
      const got = c.events.filter((e) => Story.done(d, e)).length, locked = !c.events.some((e) => Story.open(d, e));
      return `<section class="panel st-ch${locked ? ' locked' : ''}"><div class="gp-th"><h3>CHAPTER ${ci + 1}: ${c.name}</h3><span class="gp-th-l">${locked ? 'Finish the chapter before to open it.' : got + ' of ' + c.events.length + ' done'}</span></div>
        <div class="st-evs">${c.events.map((e) => {
          const done = Story.done(d, e), now = cur === e, st = done ? 'done' : now ? 'now' : 'locked';
          return `<div class="st-ev ${st}"><span class="st-num">${done ? '' : e.n}</span>
            <div class="st-main"><b>${e.title}</b><span class="st-goal">${MODES[e.mode].name} · ${e.size}V${e.size} · GOAL: ${Story.goalText(e.goal)}</span>${now ? `<p class="st-text">${e.text}</p>` : ''}</div>
            <div class="st-rws">${this.rewards(e.reward)}</div>
            ${done || now ? `<span class="st-btns">${done ? `<button class="btn small ghost st-watch" type="button" data-watch="${e.id}">WATCH</button>` : ''}<button class="btn small ${now ? 'blue' : ''} st-go" type="button" data-ev="${e.id}">${now ? 'PLAY' : 'REPLAY'}</button></span>` : '<span class="st-lock">LOCKED</span>'}</div>`;
        }).join('')}</div></section>`;
    }).join('');
    for (const el of document.querySelectorAll('#scr-story [data-port]')) { // portraits of the characters
      const id = el.dataset.port, t = el.classList.contains('st-pt') ? el : el.querySelector('.st-pt');
      if (!t) continue;
      const cv = id && STYLES[id] ? portraitCanvas(id, 48, { sig: true }) : iconCanvas('smile', '#a4a9cf'); cv.className = 'px';
      t.replaceWith(cv);
    }
    const now = document.querySelector('#st-chapters .st-ev.now');
    if (now) requestAnimationFrame(() => now.scrollIntoView({ block: 'nearest' }));
  },
  /** the characters you own for a spot of your team or the bench: keeper styles only in goal, never your own character;
      the best for the spot first. A character already in the team says where */
  openPick(slot) {
    this.slot = slot;
    const d = Save.data, bench = slot[0] === 'B', gk = slot === 'GK', key = bench ? 'BENCH' : slot;
    const cur = bench ? d.squad.bench[+slot.slice(1)] : d.squad[slot];
    const where = (id) => { const k = SQUAD_KEYS.find((x) => d.squad[x] === id); return k ? (SQUAD_SLOTS.find((x) => x[0] === k) || [0, k])[1] : (d.squad.bench || []).includes(id) ? 'BENCH' : ''; };
    const ids = d.styles.filter((id) => STYLES[id] && !!STYLES[id].gk === gk && id !== d.style).sort((a, b) => ovrOf(b, key) - ovrOf(a, key));
    $('st-pick-t').textContent = bench ? 'BENCH' : (SQUAD_SLOTS.find((x) => x[0] === slot) || [0, 'TEAM'])[1];
    $('st-pick-grid').innerHTML = `<button class="st-card" type="button" data-style="AUTO" aria-pressed="${!cur}" style="--rc:#5a5f78"><i class="st-pt"></i><b>${bench ? 'EMPTY' : 'AUTO'}</b><span>${bench ? 'NOBODY HERE' : 'THE GAME PICKS'}</span></button>`
      + ids.map((id) => `<button class="st-card" type="button" data-style="${id}" aria-pressed="${cur === id}" style="--rc:${RARITY_HEX[STYLES[id].rarity]}"><i class="st-pt" data-port="${id}"></i><b>${STYLES[id].name} <em class="st-ovr">${ovrOf(id, key)}</em></b><span>${ROLES[STYLES[id].role].name}${!bench && STYLES[id].role === slot ? ' · FITS' : ''}${where(id) && cur !== id ? ' · IN TEAM: ' + where(id) : ''}</span></button>`).join('');
    for (const el of document.querySelectorAll('#st-pick-grid .st-pt')) { const id = el.dataset.port, cv = id ? portraitCanvas(id, 48, { sig: true }) : iconCanvas('smile', '#a4a9cf'); cv.className = 'px'; el.replaceWith(cv); }
    $('st-pick').hidden = false;
  },
};
