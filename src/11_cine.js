/* =====================================================================
   Cine: the cinematic moments, drawn on top of the normal camera. It runs after Cam.follow every frame (Game's loop
   offline, Net.frame online) and only moves the camera and the models, never the match itself:
   - OMEGA CORES: a close-up of the scorer catching a core and locking it into the band on their arm
   - the OMEGA SNAP: the winners hold every core, their hero snaps and the other team shatters into blocks
   - the ending after every match: the camera circles the star player, confetti, the losers on their knees, VICTORY
   Our own moments and drawings (owner, Nov 2026: "like a big superhero film and an anime"), no names or art from them
   ===================================================================== */
const OUTRO_TEXT_AT = 1.2; // when VICTORY / DEFEAT slams in (seconds into the final whistle)
const SNAP_WAVE = 0.6; // after the snap: a beat of quiet, then the wave and the other team goes
const Cine = {
  m: null, st: null,
  begin(m) {
    this.m = m; this.st = { hero: null, heroLocked: false, w: -1, shown: false, snapped: false, waved: false, gone: new Set(), confT: 0, fw: 0 };
    $('outro').hidden = true; document.body.classList.remove('cine');
  },
  /** results, the lobby or a new match: everything back to normal */
  stop() {
    this.m = null; this.st = null;
    const o = document.getElementById('outro'); if (o) o.hidden = true;
    document.body.classList.remove('cine');
  },
  update(m, rdt) {
    if (!m) return;
    if (m !== this.m) this.begin(m);
    let on = false;
    const vc = m.vaultView && m.vaultView.claim;
    if (vc && m.phase === 'goal' && vc.p && vc.p.P && vc.t < 2.4) { this.claimCam(vc); on = true; }
    if (m.phase === 'end' && this.real(m)) { this.outro(m, rdt); on = true; }
    else if (this.st.shown) { $('outro').hidden = true; this.st.shown = false; }
    document.body.classList.toggle('cine', on);
  },
  /** a real result (not free kick practice or the tutorial): online matches have no result until the server's end message */
  real(m) { return !m.tut && !(m.fk && !m.fk.battle) && (!m.result || ['win', 'loss', 'draw'].includes(m.result.res)); },
  /** put the camera somewhere on the pitch (never in the stands) and point it */
  look(px, py, pz, lx, ly, lz) {
    const cam = World.camera, bx = F.BOARD_X - 0.8, bz = F.BOARD_Z - 0.8;
    cam.position.set(clamp(px, -bx, bx), Math.max(0.35, py), clamp(pz, -bz, bz));
    cam.lookAt(lx, ly, lz);
  },
  /** from a player towards the middle of the pitch: the camera goes that side, so it is never behind a goal */
  inward(p) { const l = Math.hypot(p.pos.x, p.pos.z); return l > 2 ? { x: -p.pos.x / l, z: -p.pos.z / l } : { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }; },
  /** turn a model to face the camera (after its own animation, before the picture is drawn) */
  face(p, f) { if (p.P) p.P.root.rotation.y = Math.atan2(f.x, f.z); },
  /** OMEGA CORES: low and close in front of the scorer, looking up at the catch, then at the band */
  claimCam(vc) {
    const p = vc.p, f = this.inward(p), sx = f.z, sz = -f.x;
    const k = Math.min(1, vc.t / 2.4), d = 2.8 - 0.7 * k, up = lerp(2.35, 1.75, clamp((vc.t - 0.4) / 0.45, 0, 1));
    this.face(p, f);
    this.look(p.pos.x + f.x * d + sx * 0.75, p.pos.y + 0.95, p.pos.z + f.z * d + sz * 0.75, p.pos.x, p.pos.y + up, p.pos.z);
  },
  outro(m, rdt) {
    const S = this.st, t = m.phaseT, snap = !!(m.heist && m.heist.cleaned != null), W = SNAP_T + SNAP_WAVE;
    if (!S.heroLocked) { // online the SNAP pose comes with the next snapshot, so keep looking for a moment
      S.w = winnerOf(m); S.hero = pickHero(m, S.w);
      if (t > 0.6 || (S.hero && S.hero.emote === 'snap' && S.hero.state === 'emote')) S.heroLocked = true;
    }
    if (!S.clean) { S.clean = true; const sp = document.getElementById('steal'); if (sp) sp.hidden = true; } // the last core's cut-in is over: the ending fills the screen
    const h = S.hero; if (!h) return;
    const f = this.inward(h);
    if (snap) this.snap(m, t, h);
    if (snap && t < W) { // low and close, looking up at the hand with every core round it; after the snap, in on the face
      const q = clamp((t - SNAP_T) / SNAP_WAVE, 0, 1), d = 3.1 - 0.6 * q;
      this.face(h, f);
      this.look(h.pos.x + f.x * d + f.z * 0.5, h.pos.y + 0.7 + 0.5 * q, h.pos.z + f.z * d - f.x * 0.5, h.pos.x, h.pos.y + 2.4 - 0.6 * q, h.pos.z);
    } else if (snap) { // cut on the white wave: the hero in front, the other team shattering behind them, then rising slowly round
      if (!S.lc) {
        const L = m.players.filter((p) => p.team !== S.w), n = L.length || 1;
        S.lc = L.length ? { x: L.reduce((a, p) => a + p.pos.x, 0) / n, z: L.reduce((a, p) => a + p.pos.z, 0) / n } : { x: -h.pos.x, z: -h.pos.z };
      }
      const t0 = t - W, a = Math.atan2(h.pos.x - S.lc.x, h.pos.z - S.lc.z) + t0 * 0.12, g = { x: Math.sin(a), z: Math.cos(a) };
      const d = Math.min(12, 6.5 + t0 * 1.0), y = Math.min(6, 2.6 + t0 * 0.6);
      this.face(h, g);
      this.look(h.pos.x + g.x * d, h.pos.y + y, h.pos.z + g.z * d, lerp(h.pos.x, S.lc.x, 0.3), h.pos.y + 0.8, lerp(h.pos.z, S.lc.z, 0.3));
    } else { // round the star player, rising and pulling back
      const a = Math.atan2(f.x, f.z) + t * 0.3, d = Math.min(7.5, 3 + t * 0.9), y = Math.min(3.3, 1.0 + t * 0.45);
      if (!(h.state === 'celebrate' && h.look && h.look.celeb === 'spin')) this.face(h, f);
      this.look(h.pos.x + Math.sin(a) * d, h.pos.y + y, h.pos.z + Math.cos(a) * d, h.pos.x, h.pos.y + 1.4, h.pos.z);
    }
    // confetti over the winners (gold and white for a draw), and a few fireworks over their end
    const hexes = S.w >= 0 ? [TEAM[S.w].hex, '#ffffff', '#ffd54a'] : ['#ffd54a', '#ffffff'];
    S.confT -= rdt;
    if (t > (snap ? W + 1.0 : 0.6) && S.confT <= 0) {
      S.confT = S.w >= 0 ? 0.08 : 0.2;
      for (let i = 0; i < 5; i++) FX.lit.spawn(h.pos.x + rand(-8, 8), rand(8, 11), h.pos.z + rand(-8, 8), rand(-1, 1), rand(-1.5, 0), rand(-1, 1), rand(0.1, 0.16), rand(2.5, 3.5), col(pick(hexes)), 0.16, 1.4, 0);
    }
    if (S.w >= 0 && S.fw < 3 && t > (snap ? W + 1.4 : 1.0) + S.fw * 0.7) { S.fw++; FX.rocket(rand(-14, 14), (S.w === 0 ? -1 : 1) * (F.L + rand(3, 7)), hexes); }
    if (!S.shown && t >= (snap ? W + 1.7 : OUTRO_TEXT_AT)) this.showText(m, snap);
  },
  /** the OMEGA SNAP: one click of the fingers with every core in the hand (sparks in the cores' colours), a beat of quiet,
      then a white wave rolls out over the pitch and the other team shatters one by one, nearest first */
  snap(m, t, h) {
    const S = this.st, W = SNAP_T + SNAP_WAVE;
    if (!S.snapped && t >= SNAP_T) {
      S.snapped = true;
      const v = V3(h.pos.x, h.pos.y + 2.6, h.pos.z);
      if (h.P) { h.P.root.updateMatrixWorld(true); h.P.armL.localToWorld(v.set(0, -0.8, 0)); }
      Sfx.snap(); Shake.add(0.15);
      FX.sparks(v.x, v.y, v.z, '#ffffff', 18, 6, 0.08, 0.35); FX.ring(v.x, v.y, v.z, '#ffffff', 0.6, 16);
      const fin = m.vaultView && m.vaultView.fin, hexes = new Set(fin ? fin.list.map((b) => RARITY_HEX[RARITIES[b.r]]) : []);
      for (const hx of hexes) FX.sparks(v.x, v.y, v.z, hx, 10, 4, 0.08, 0.6);
    }
    if (!S.waved && t >= W) {
      S.waved = true;
      Hud.flash('#ffffff'); Shake.add(0.6); Sfx.boom();
      for (let i = 0; i < 5; i++) FX.after(i * 0.1, () => FX.ring(h.pos.x, 0.25, h.pos.z, i % 2 ? '#ffffff' : '#ffe9a8', 2 + i * 4, 30 + i * 10));
    }
    if (t >= W + 0.2) {
      const losers = m.players.filter((p) => p.team !== S.w).sort((a, b) => dist2D(a.pos, h.pos) - dist2D(b.pos, h.pos));
      losers.forEach((p, i) => { if (!S.gone.has(p) && t >= W + 0.2 + i * 0.22) { S.gone.add(p); this.shatter(p); } });
    }
    for (const p of S.gone) { if (p.P) p.P.root.visible = false; if (p.blob) p.blob.visible = false; } // they are no more
  },
  /** a player breaks into blocks in their team colour */
  shatter(p) {
    const hex = TEAM[p.team].hex, x = p.pos.x, z = p.pos.z;
    for (let i = 0; i < 46; i++) FX.lit.spawn(x + rand(-0.35, 0.35), rand(0.1, 1.9), z + rand(-0.35, 0.35), rand(-4, 4), rand(1, 6), rand(-4, 4), rand(0.12, 0.3), rand(0.9, 1.6), col(i % 3 ? hex : i % 2 ? '#ffffff' : '#1a1622'), 1, 0.4);
    FX.sparks(x, 1.1, z, hex, 18, 5, 0.18, 0.5);
    Sfx.thud(0.7);
  },
  showText(m, snap) {
    const S = this.st, w = S.w, me = m.human ? m.human.team : -1, h = S.hero;
    const won = me >= 0 && w === me, lost = me >= 0 && w >= 0 && w !== me;
    let big, color;
    if (snap) { big = 'SHATTERED!'; color = '#ffffff'; }
    else if (w < 0) { big = 'DRAW'; color = '#ffcb3d'; }
    else if (me < 0) { big = TEAM[w].name + ' WIN'; color = TEAM[w].hex; }
    else if (won) { big = 'VICTORY!'; color = '#ffcb3d'; }
    else { big = 'DEFEAT'; color = '#ff4d5e'; }
    const sub = snap ? (won ? 'YOU TOOK EVERY CORE' : lost ? 'THEY TOOK EVERY CORE' : TEAM[w].name + ' TOOK EVERY CORE') + '  ·  ' + m.score[0] + ' : ' + m.score[1]
      : TEAM[0].name + '  ' + m.score[0] + ' : ' + m.score[1] + '  ' + TEAM[1].name;
    const g = h && h.stats ? h.stats.goals : 0;
    $('ot-big').textContent = big; $('ot-sub').textContent = sub;
    $('ot-star').textContent = h ? 'STAR · #' + h.number + ' ' + h.name + (g ? ' · ' + g + (g > 1 ? ' GOALS' : ' GOAL') : '') : '';
    $('ot-skip').hidden = !!m.online;
    const o = $('outro'); o.style.setProperty('--oc', color);
    o.hidden = false; o.classList.remove('go'); void o.offsetWidth; o.classList.add('go');
    S.shown = true;
    if (won) Sfx.fanfare(3); else if (lost) Sfx.ooh(); else Sfx.fanfare(1);
  },
};
