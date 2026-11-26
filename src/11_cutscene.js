/* =====================================================================
   Cutscene: the STORY scenes (owner, Nov 2026: "story mode has no actual story like a cutscene"). A comic scene over the
   whole screen: a place drawn in its colours with speed lines, the speaker's big portrait sliding in from their side, a
   speech box that types the line out, a CHAPTER card before a chapter's first event, and a JOINS YOUR TEAM moment.
   Tap, click, SPACE, ENTER or A goes on (a line still typing finishes first); SKIP or ESC ends it. Our own drawings.
   Cutscene.story(event, 'intro' | 'outro', done)
   ===================================================================== */
const CS_PLACES = { // the backdrop of each place: sky, ground, light
  backpitch: ['#2b3a5e', '#1d5a2e', '#ffb86b'], street: ['#4a2a3a', '#5a3a2a', '#ff8a2a'], stadium: ['#13204a', '#1f6b3a', '#a9c7ff'],
  city: ['#2a1d4a', '#2c3463', '#ff5fb0'], training: ['#123a44', '#1d5a4a', '#7ff5bd'], night: ['#090b22', '#13304a', '#c9d2ff'],
  storm: ['#2a2f3a', '#28402e', '#dfe6ff'], final: ['#3a2a07', '#1f5a2a', '#ffd54a'],
};
const CS_CPS = 42; // letters a second
const Cutscene = {
  lines: null, i: 0, shown: 0, typing: false, done: null, ev: null, tmr: 0,
  tpl() {
    return `<section id="cutscene" class="cs" hidden aria-live="polite">
      <div class="cs-bg" id="cs-bg"><i class="cs-sky"></i><i class="cs-ground"></i><i class="cs-lines"></i></div>
      <div class="cs-title" id="cs-title" hidden><span id="cs-ch"></span><b id="cs-chname"></b></div>
      <div class="cs-join" id="cs-join" hidden><span class="cs-jface" id="cs-jface"></span><b id="cs-jname"></b><span>JOINS YOUR TEAM!</span></div>
      <div class="cs-face" id="cs-face"></div>
      <button class="btn small cs-skip" id="cs-skip" type="button">SKIP</button>
      <button class="cs-box" id="cs-next" type="button"><b class="cs-name" id="cs-name"></b><span class="cs-text" id="cs-text"></span><i class="cs-more">TAP TO GO ON</i></button>
    </section>`;
  },
  bind() {
    $('cs-next').addEventListener('click', () => this.next());
    $('cs-skip').addEventListener('click', () => { Sfx.click(); this.end(); });
    window.addEventListener('keydown', (e) => {
      if ($('cutscene').hidden) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) this.next(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.end(); }
    }, true);
  },
  /** who a speaker is: name, portrait and colour (RIVAL: the opponent's captain; YOU: your own player) */
  who(key) {
    const ev = this.ev;
    if (key === 'YOU') return { name: 'YOU', canvas: () => portraitCanvas(Save.data.style, 160, Save.data.look), hex: '#3d7dff', side: 'l' };
    if (key === 'RIVAL') { const c = ev && CLUBS[ev.foe] || CLUBS.EMBER; return { name: c.nick + ' CAPTAIN', canvas: () => portraitCanvas(RIVAL_FACE[ev && ev.foe] || 'BLITZ', 160, { sig: true }), hex: c.crest[0], side: 'r' }; }
    const C = STORY_CAST[key] || STORY_CAST.COACH;
    return { name: C.name, canvas: () => portraitCanvas(C.face, 160, { sig: true }), hex: C.hex, side: key === 'COACH' ? 'l' : 'r' };
  },
  /** a story event's scene: before it ('intro', with a CHAPTER card for the chapter's first event) or after you met its goal */
  story(ev, part, done) {
    const lines = ev && ev[part];
    if (!lines || !lines.length) { if (done) done(); return; }
    const first = part === 'intro' && STORY[ev.ch].events[0] === ev;
    this.play(lines, { ev, place: ev.place, title: first ? ['CHAPTER ' + (ev.ch + 1), STORY[ev.ch].name] : null }, done);
  },
  play(lines, o, done) {
    this.lines = lines; this.i = -1; this.done = done || null; this.ev = o.ev || null; this.last = null;
    const P = CS_PLACES[o.place] || CS_PLACES.stadium, bg = $('cs-bg');
    bg.style.setProperty('--sky', P[0]); bg.style.setProperty('--ground', P[1]); bg.style.setProperty('--light', P[2]);
    $('cs-join').hidden = true; $('cs-face').innerHTML = ''; $('cs-text').textContent = ''; $('cs-name').textContent = '';
    $('cutscene').hidden = false; Music.set(true);
    if (o.title) { // CHAPTER 2 · THE CITY LEAGUE slams in first
      $('cs-ch').textContent = o.title[0]; $('cs-chname').textContent = o.title[1];
      const t = $('cs-title'); t.hidden = false; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
      $('cs-next').hidden = true; Sfx.cutin();
      clearTimeout(this.tmr); this.tmr = setTimeout(() => { t.hidden = true; $('cs-next').hidden = false; this.next(); }, navigator.webdriver ? 50 : 1700);
    } else { $('cs-title').hidden = true; $('cs-next').hidden = false; this.next(); }
  },
  next() {
    if ($('cutscene').hidden || !$('cs-title').hidden) return;
    if (this.typing) { this.shown = 1e9; return; } // finish the line first
    $('cs-join').hidden = true;
    this.i++;
    if (this.i >= this.lines.length) { this.end(); return; }
    const [key, text, extra] = this.lines[this.i], W = this.who(key), box = $('cs-next');
    box.style.setProperty('--sc', W.hex); box.classList.toggle('r', W.side === 'r');
    $('cs-name').textContent = W.name;
    if (this.last !== key) { // a new speaker slides in from their side
      const f = $('cs-face'), cv = W.canvas(); cv.className = 'px';
      f.innerHTML = ''; f.appendChild(cv); f.className = 'cs-face ' + W.side; f.style.setProperty('--sc', W.hex);
      void f.offsetWidth; f.classList.add('in'); Sfx.open && Sfx.open();
    }
    this.last = key;
    if (extra === 'join' && STYLES[key]) this.join(key);
    this.type(text);
  },
  /** the line appears letter by letter */
  type(text) {
    const el = $('cs-text'); this.shown = 0; this.typing = true; el.textContent = '';
    const step = () => {
      if ($('cutscene').hidden) { this.typing = false; return; }
      this.shown += CS_CPS / 30;
      const n = Math.min(text.length, Math.floor(this.shown));
      el.textContent = text.slice(0, n);
      if (n % 4 === 1) Sfx.tick();
      if (n >= text.length) { this.typing = false; return; }
      this.tmr = setTimeout(step, 33);
    };
    clearTimeout(this.tmr); step();
  },
  /** ROGUE JOINS YOUR TEAM! with a flash */
  join(id) {
    const j = $('cs-join'), f = $('cs-jface'), cv = portraitCanvas(id, 128, { sig: true }); cv.className = 'px';
    f.innerHTML = ''; f.appendChild(cv); $('cs-jname').textContent = STYLES[id].name;
    j.style.setProperty('--sc', STYLES[id].aura); j.hidden = false; j.classList.remove('go'); void j.offsetWidth; j.classList.add('go');
    Sfx.fanfare(2);
  },
  end() {
    clearTimeout(this.tmr); this.typing = false;
    if ($('cutscene').hidden) return;
    $('cutscene').hidden = true;
    const d = this.done; this.done = null;
    if (d) d();
  },
};
