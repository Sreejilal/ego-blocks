/* ---------- controller in the menus (owner, Nov 2026: "on controller you cannot navigate the menus") ----------
   The D-pad or the left stick moves a gold box from button to button (the nearest one that way on the screen), A presses
   it, B goes back, the right stick scrolls a long list. Only what you can really press counts: a button hidden under a
   dialog is skipped, so dialogs trap the box by themselves. Off while you are playing (the match uses the same buttons). */
const PadNav = {
  cur: null, rep: 0, dir: null, shown: false,
  SEL: 'button, input, select, summary, a[href], [role="button"]',
  /** menus are up: not in live play (a paused match and the first-visit TAP TO PLAY screen count as menus) */
  active() {
    const s = Game.state;
    if (s === 'replay') return false;
    if (s === 'match') return !!Game.gate;
    if (s === 'online' && Net.nm) return !!Net.paused;
    return true;
  },
  scroller(el) { for (let p = el && el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p; } return null; },
  onTop(el, x, y) { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); },
  /** every control you could press right now, with its box on screen */
  list() {
    const W = window.innerWidth, H = window.innerHeight, out = [];
    for (const el of document.querySelectorAll(this.SEL)) {
      if (el.disabled || el.closest('[hidden], #touch, #hud, #labels') || el.type === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      let ok;
      if (x >= 0 && x < W && y >= 0 && y < H) ok = this.onTop(el, x, y) || this.onTop(el, r.left + 4, r.top + 4);
      if (!ok) { // scrolled out of sight in a list: it still counts when the list itself is the thing on top
        const sc = this.scroller(el);
        if (!sc) continue;
        const b = sc.getBoundingClientRect(), bx = clamp(x, b.left + 6, b.right - 6), by = clamp(b.top + b.height / 2, 0, H - 1);
        if (x < Math.max(0, b.left) || x > Math.min(W, b.right) || b.bottom < 0 || b.top > H) continue; // off to the side (a panel that slid away) is not in a list
        if (y > Math.max(0, b.top) && y < Math.min(H, b.bottom)) continue; // in view but covered by something
        const t = document.elementFromPoint(clamp(bx, 0, W - 1), by);
        if (!t || !(sc === t || sc.contains(t))) continue;
      }
      out.push({ el, r, x, y });
    }
    return out;
  },
  /** the first box: what the screen wants pressed (the blue button), else the first control */
  first(L) { return (L.find((c) => c.el.matches('.btn.blue, [data-padfirst]')) || L[0] || {}).el || null; },
  focus(el) {
    if (this.cur && this.cur !== el) this.cur.classList.remove('padfocus');
    this.cur = el;
    if (!el) return;
    el.classList.add('padfocus');
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    const a = document.activeElement; if (a && a !== el && a.blur && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) a.blur();
  },
  clear() { if (this.cur) this.cur.classList.remove('padfocus'); this.cur = null; },
  /** move the box one step: dx, dy is -1, 0 or 1 */
  move(dx, dy) {
    const L = this.list();
    if (!L.length) { this.clear(); return; }
    const me = L.find((c) => c.el === this.cur);
    if (!me) { this.focus(this.first(L)); Sfx.hover && Sfx.hover(); return; }
    // a slider: left and right change it
    if (dx && me.el.tagName === 'INPUT' && me.el.type === 'range') {
      const el = me.el, st = +el.step || 1, v = clamp(+el.value + dx * st * 2, +el.min, +el.max);
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    let best = null, bs = Infinity;
    for (const c of L) {
      if (c === me) continue;
      // how far that way (edge to edge), and how far off to the side (0 when the boxes line up)
      const along = dx ? (dx > 0 ? c.r.left - me.r.right : me.r.left - c.r.right) : (dy > 0 ? c.r.top - me.r.bottom : me.r.top - c.r.bottom);
      const cAlong = dx ? (c.x - me.x) * dx : (c.y - me.y) * dy;
      if (cAlong < 6) continue; // not that way
      const side = dx ? Math.max(0, Math.max(c.r.top - me.r.bottom, me.r.top - c.r.bottom)) : Math.max(0, Math.max(c.r.left - me.r.right, me.r.left - c.r.right));
      const off = dx ? Math.abs(c.y - me.y) : Math.abs(c.x - me.x);
      const s = Math.max(0, along) + side * 3 + off * 0.3 + (along < -2 ? 40 : 0);
      if (s < bs) { bs = s; best = c; }
    }
    if (best) { this.focus(best.el); if (Sfx.hover) Sfx.hover(); }
    else if (dy) { const sc = this.scroller(me.el); if (sc) sc.scrollTop += dy * 140; }
  },
  press() {
    const L = this.list(), me = L.find((c) => c.el === this.cur);
    if (!me) { this.focus(this.first(L)); return; }
    const el = me.el;
    if (el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'button' && el.type !== 'submit') { if (!el.readOnly) el.focus(); return; } // a text box: the on-screen or real keyboard types
    el.click();
  },
  /** B: the screen's own way out (BACK, CLOSE, RESUME, NO), else the pause menu closes */
  back() {
    const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) { a.blur(); return; }
    const L = this.list();
    const isBack = (el) => /(^|-)(back|close|cancel|no|x)$/.test(el.id || '') || /^(BACK|CLOSE|CANCEL|RESUME|NO|NOT NOW|LATER|X)$/.test((el.textContent || '').trim().toUpperCase());
    const b = L.filter((c) => isBack(c.el));
    if (b.length) { b[b.length - 1].el.click(); return; } // the last one in the page is the one on top (dialogs come after screens)
    if (Game.state === 'paused' || (Game.state === 'online' && Net.paused)) Game.onEscape();
  },
  /** every frame, after the controller is read */
  tick(rdt) {
    if (!Input.pad || !this.active()) { if (this.shown) { this.shown = false; document.body.classList.remove('padnav'); this.clear(); } this.dir = null; return; }
    if (this.shown !== Input.usingPad) { this.shown = Input.usingPad; document.body.classList.toggle('padnav', this.shown); if (!this.shown) this.clear(); }
    if (!Input.usingPad) { this.dir = null; return; }
    const E = Input.edges;
    if (Game.state === 'match' && Game.gate) { if (E.has('PadA') || E.has('PadStart')) { E.delete('PadA'); Game.gateGo(); } return; }
    if (this.cur && !this.cur.isConnected) this.cur = null;
    // the D-pad or the left stick, with a repeat while held
    const ax = Input.axis(0), ay = Input.axis(1);
    const dx = (Input.padHeld(PAD.RIGHT) || ax > 0.6 ? 1 : 0) - (Input.padHeld(PAD.LEFT) || ax < -0.6 ? 1 : 0);
    const dy = (Input.padHeld(PAD.DOWN) || ay > 0.6 ? 1 : 0) - (Input.padHeld(PAD.UP) || ay < -0.6 ? 1 : 0);
    const d = dy ? 'y' + dy : dx ? 'x' + dx : null;
    if (d !== this.dir) { this.dir = d; this.rep = 0.38; if (d) this.move(dy ? 0 : dx, dy); }
    else if (d) { this.rep -= rdt; if (this.rep <= 0) { this.rep = 0.13; this.move(dy ? 0 : dx, dy); } }
    // the right stick scrolls the list the box is in (or the screen's own long list)
    const ry = Input.axis(3);
    if (ry) { const from = this.cur || (this.list()[0] || {}).el, sc = from && this.scroller(from); if (sc) sc.scrollTop += ry * 900 * rdt; }
    if (E.has('PadA')) { E.delete('PadA'); this.press(); }
    else if (E.has('PadB')) { E.delete('PadB'); this.back(); }
  },
};
