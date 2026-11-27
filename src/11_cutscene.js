/* =====================================================================
   Cutscene: the STORY scenes (owner, Nov 2026: "story mode has no actual story like a cutscene", then Nov 26: "the story is
   just like a text only, I want an actual animation of the characters moving and the story to follow that").
   The scene is acted out in 3D by Movie (11_movie.js, scripts in STORY_FILMS) between black film bars: the place's name
   first, an opening shot with no words, then every line in a speech box with the speaker's small portrait while the
   characters do what they say; each line goes on by itself once the action has played (tap, click, SPACE, ENTER or A goes
   on sooner; a line still typing finishes first), then a closing shot and, before a match, a VS card. SKIP or ESC ends it.
   A CHAPTER card comes before a chapter's first event, and JOINS YOUR TEAM when someone joins. Without a film (or without
   WebGL) it falls back to the comic background. Test robots (navigator.webdriver) skip the opening, closing and VS shots
   and the waiting, unless Cutscene.full.
   Cutscene.story(event, 'intro' | 'outro', done)
   ===================================================================== */
const CS_PLACES = { // the comic backdrop of each place (only without a 3D film): sky, ground, light
  backpitch: ['#2b3a5e', '#1d5a2e', '#ffb86b'], street: ['#4a2a3a', '#5a3a2a', '#ff8a2a'], stadium: ['#13204a', '#1f6b3a', '#a9c7ff'],
  city: ['#2a1d4a', '#2c3463', '#ff5fb0'], training: ['#123a44', '#1d5a4a', '#7ff5bd'], night: ['#090b22', '#13304a', '#c9d2ff'],
  storm: ['#2a2f3a', '#28402e', '#dfe6ff'], final: ['#3a2a07', '#1f5a2a', '#ffd54a'],
};
const CS_CPS = 42; // letters a second
const Cutscene = {
  lines: null, i: 0, shown: 0, typing: false, done: null, ev: null, tmr: 0, autoT: 0, phase: 'lines', mv: false, film: null, vs: false, full: false, noAuto: false,
  tpl() {
    return `<section id="cutscene" class="cs" hidden aria-live="polite">
      <div class="cs-bg" id="cs-bg"><i class="cs-sky"></i><i class="cs-ground"></i><i class="cs-lines"></i></div>
      <canvas class="cs-speed" id="cs-speed" hidden></canvas>
      <i class="cs-bar t"></i><i class="cs-bar b"></i><i class="cs-flash" id="cs-flash"></i>
      <canvas class="cs-pan" id="cs-pan" hidden></canvas>
      <b class="cs-word" id="cs-word" hidden></b>
      <div class="cs-place" id="cs-place" hidden><span id="cs-pname"></span><b id="cs-ptitle"></b></div>
      <div class="cs-title" id="cs-title" hidden><span id="cs-ch"></span><b id="cs-chname"></b></div>
      <div class="cs-join" id="cs-join" hidden><span class="cs-jface" id="cs-jface"></span><b id="cs-jname"></b><span>JOINS YOUR TEAM!</span></div>
      <div class="cs-vs" id="cs-vs" hidden></div>
      <button class="btn small cs-skip" id="cs-skip" type="button">SKIP</button>
      <button class="cs-box" id="cs-next" type="button"><span class="cs-face" id="cs-face"></span><b class="cs-name" id="cs-name"></b><span class="cs-text" id="cs-text"></span><i class="cs-more">TAP TO GO ON</i></button>
    </section>`;
  },
  bind() {
    $('cutscene').addEventListener('click', (e) => { if (!e.target.closest('#cs-skip')) this.next(); }); // anywhere on the scene goes on
    $('cs-skip').addEventListener('click', () => { Sfx.click(); this.end(); });
    window.addEventListener('keydown', (e) => {
      if ($('cutscene').hidden) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) this.next(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.end(); }
    }, true);
  },
  /** the opening and closing shots, the VS card and the waiting: real players only (or a test that asks: full; noAuto keeps
      them but waits for next(), so a slow test robot never falls behind the clock) */
  long() { return !navigator.webdriver || this.full; },
  auto(fn, ms) { clearTimeout(this.autoT); if (!this.noAuto) this.autoT = setTimeout(fn, ms); },
  /** who a speaker is: name, portrait and colour (RIVAL: the opponent's captain; YOU: your own player) */
  who(key) {
    const ev = this.ev;
    if (key === 'YOU') return { name: 'YOU', canvas: () => portraitCanvas(Save.data.style, 96, Save.data.look), hex: '#3d7dff', side: 'l' };
    if (key === 'RIVAL') { const c = ev && CLUBS[ev.foe] || CLUBS.EMBER; return { name: c.nick + ' CAPTAIN', canvas: () => portraitCanvas(RIVAL_FACE[ev && ev.foe] || 'BLITZ', 96, { sig: true }), hex: c.crest[0], side: 'r' }; }
    const C = STORY_CAST[key] || STORY_CAST.COACH;
    return { name: C.name, canvas: () => portraitCanvas(C.face, 96, { sig: true }), hex: C.hex, side: key === 'COACH' ? 'l' : 'r' };
  },
  /** a story event's scene: before it ('intro', with a CHAPTER card for the chapter's first event) or after you met its goal */
  story(ev, part, done, o = {}) {
    const lines = ev && ev[part];
    if (!lines || !lines.length) { if (done) done(); return; }
    const first = part === 'intro' && STORY[ev.ch].events[0] === ev;
    const film = STORY_FILMS[ev.id] && STORY_FILMS[ev.id][part];
    this.play(lines, { ev, part, film, place: ev.place, vs: part === 'intro' && !o.watch && !MODES[ev.mode].drill, title: first ? ['CHAPTER ' + (ev.ch + 1), STORY[ev.ch].name] : null }, done); // WATCH: no VS card
  },
  play(lines, o, done) {
    clearTimeout(this.tmr); clearTimeout(this.autoT);
    this.lines = lines; this.i = -1; this.done = done || null; this.ev = o.ev || null; this.last = null; this.typing = false;
    this.film = o.film && Movie.ok() ? o.film : null; this.mv = !!this.film; this.vs = !!o.vs && this.mv && !!this.ev;
    const P = CS_PLACES[o.place] || CS_PLACES.stadium, bg = $('cs-bg'), root = $('cutscene');
    bg.style.setProperty('--sky', P[0]); bg.style.setProperty('--ground', P[1]); bg.style.setProperty('--light', P[2]);
    $('cs-join').hidden = true; $('cs-vs').hidden = true; $('cs-place').hidden = true; $('cs-face').innerHTML = ''; $('cs-text').textContent = ''; $('cs-name').textContent = '';
    $('cs-next').hidden = true;
    root.classList.toggle('mv', this.mv);
    root.hidden = false; Music.set(true);
    if (this.mv) Movie.start(this.ev, o.part, this.film);
    if (o.title) { // CHAPTER 2 · THE CITY LEAGUE slams in first
      this.phase = 'title';
      $('cs-ch').textContent = o.title[0]; $('cs-chname').textContent = o.title[1];
      const t = $('cs-title'); t.hidden = false; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
      Sfx.cutin();
      this.tmr = setTimeout(() => this.begin(), navigator.webdriver ? 50 : 1900);
    } else this.begin();
  },
  /** after the chapter card: where we are, the opening shot, then the lines */
  begin() {
    $('cs-title').hidden = true;
    const op = this.film && this.film.open;
    if (this.mv) { this.where(); Movie.beat(op); }
    if (op && this.long()) { this.phase = 'open'; this.auto(() => this.next(), op.t * 1000); }
    else { this.phase = 'lines'; this.i = -1; this.next(); }
  },
  /** THE BACK PITCH / FIRST TOUCH in the corner for the first moments */
  where() {
    const ev = this.ev, P = ev && MV_PLACES[(this.film && this.film.place) || ev.place];
    if (!P) return;
    $('cs-pname').textContent = P.name; $('cs-ptitle').textContent = ev.title;
    const el = $('cs-place'); el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  },
  next() {
    if ($('cutscene').hidden || this.phase === 'title') return;
    clearTimeout(this.autoT);
    if (this.phase === 'open') { this.phase = 'lines'; this.i = -1; }
    else if (this.phase === 'end') { this.toVs(); return; }
    else if (this.phase === 'vs') { this.end(); return; }
    if (this.typing) { this.finishLine(); return; } // finish the line first
    $('cs-join').hidden = true;
    this.i++;
    if (this.i >= this.lines.length) { this.closing(); return; }
    const [key, text, extra] = this.lines[this.i], W = this.who(key), box = $('cs-next');
    box.hidden = false;
    box.style.setProperty('--sc', W.hex); box.classList.toggle('r', W.side === 'r' && !this.mv);
    $('cs-name').textContent = W.name;
    if (this.last !== key) { // a new speaker: their portrait pops in
      const f = $('cs-face'), cv = W.canvas(); cv.className = 'px';
      f.innerHTML = ''; f.appendChild(cv); f.style.setProperty('--sc', W.hex);
      f.classList.remove('in'); void f.offsetWidth; f.classList.add('in');
    }
    this.last = key;
    if (this.mv) Movie.line(this.i, key, extra); // the actors act it out (a 'join' happens in 3D, then the card)
    else if (extra === 'join' && STYLES[key]) this.join(key);
    this.type(text);
  },
  /** the line appears letter by letter; in a 3D scene it goes on by itself once the action has played out */
  type(text) {
    const el = $('cs-text'); this.shown = 0; this.typing = true; el.textContent = ''; this.text = text;
    const step = () => {
      if ($('cutscene').hidden) { this.typing = false; return; }
      this.shown += CS_CPS / 30;
      const n = Math.min(text.length, Math.floor(this.shown));
      el.textContent = text.slice(0, n);
      if (n % 4 === 1) Sfx.tick();
      if (n >= text.length) { this.typing = false; this.wait(text); return; }
      this.tmr = setTimeout(step, 33);
    };
    clearTimeout(this.tmr); step();
  },
  /** a tap while the line types: all of it at once */
  finishLine() { clearTimeout(this.tmr); this.typing = false; $('cs-text').textContent = this.text || ''; this.wait(this.text || ''); },
  wait(text) {
    if (!this.mv || !this.long() || this.phase !== 'lines') return;
    const L = this.film.lines && this.film.lines[this.i], typed = text.length / CS_CPS;
    const ms = Math.max(1100 + text.length * 30, ((L && L.hold) || 0) * 1000 - typed * 1000);
    this.auto(() => this.next(), ms);
  },
  /** after the last line: the closing shot */
  closing() {
    const en = this.film && this.film.end;
    if (en && this.long()) { this.phase = 'end'; $('cs-next').hidden = true; Movie.line(this.lines.length, null); Movie.beat(en); this.auto(() => this.toVs(), en.t * 1000); }
    else this.toVs();
  },
  /** before a match: your club VS theirs, and what you have to do */
  toVs() {
    if (!this.vs || !this.long()) { this.end(); return; }
    this.phase = 'vs'; $('cs-next').hidden = true;
    const ev = this.ev, d = Save.data, star = ['IRONCLAD', 'SOLARIS'].find((k) => ev.intro.some((l) => l[0] === k));
    const foe = ev.foe !== d.club ? ev.foe : CLUB_IDS.find((c) => c !== d.club), A = CLUBS[d.club], B = CLUBS[foe];
    const el = $('cs-vs');
    el.innerHTML = `<div class="vs-side l" style="--vc:${A.crest[0]}"><i class="vs-crest" data-club="${d.club}"></i><b>${A.nick}</b><span>YOU</span></div>
      <b class="vs-x">VS</b>
      <div class="vs-side r" style="--vc:${B.crest[0]}"><i class="vs-crest" data-club="${foe}"></i><b>${B.nick}</b><span>${star ? STYLES[star].name : 'THEIR CAPTAIN'}</span></div>
      <p class="vs-goal">${MODES[ev.mode].name} · ${ev.size}V${ev.size} · GOAL: ${Story.goalText(ev.goal)}</p>`;
    for (const c of el.querySelectorAll('.vs-crest')) { const cv = crestCanvas(c.dataset.club, 96); cv.className = 'px'; c.replaceWith(cv); }
    el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    Sfx.cutin(); Sfx.whistle(1);
    this.auto(() => this.end(), 2400);
  },
  /** ROGUE JOINS YOUR TEAM! with a flash */
  join(id) {
    const j = $('cs-join'), f = $('cs-jface'), cv = portraitCanvas(id, 128, { sig: true }); cv.className = 'px';
    f.innerHTML = ''; f.appendChild(cv); $('cs-jname').textContent = STYLES[id].name;
    j.style.setProperty('--sc', STYLES[id].aura); j.hidden = false; j.classList.remove('go'); void j.offsetWidth; j.classList.add('go');
    Sfx.fanfare(2);
  },
  /** leave without going on (another screen took over): the scene closes, nothing starts */
  abort() { this.done = null; this.end(); },
  end() {
    clearTimeout(this.tmr); clearTimeout(this.autoT); this.typing = false;
    if ($('cutscene').hidden) return;
    $('cutscene').hidden = true; $('cs-vs').hidden = true; $('cs-place').hidden = true;
    if (this.mv) Movie.stop();
    this.mv = false; this.phase = 'lines';
    const d = this.done; this.done = null;
    if (d) d();
  },
};
