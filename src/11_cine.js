/* =====================================================================
   Cine: the cinematic moments, drawn on top of the normal camera. It runs after Cam.follow every frame (Game's loop
   offline, Net.frame online) and only moves the camera and the models, never the match itself:
   - OMEGA CORES: a close-up of the scorer catching a core and locking it into the band on their arm
   - the OMEGA CRUSH: a team that took every core punches the ground and the other team shatters into blocks
   - the ending after every match: the camera circles the star player, confetti, the losers on their knees, VICTORY
   Our own moments and drawings (owner, Nov 2026: "like a big superhero film and an anime"), no names or art from them
   ===================================================================== */
const OUTRO_TEXT_AT = 1.2; // when VICTORY / DEFEAT slams in (seconds into the final whistle)
const Cine = {
  m: null, st: null,
  begin(m) {
    this.m = m; this.st = { hero: null, heroLocked: false, w: -1, shown: false, crushed: false, gone: new Set(), confT: 0, fw: 0 };
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
    const S = this.st, t = m.phaseT, crush = !!(m.heist && m.heist.cleaned != null);
    if (!S.heroLocked) { // online the CRUSH pose comes with the next snapshot, so keep looking for a moment
      S.w = winnerOf(m); S.hero = pickHero(m, S.w);
      if (t > 0.6 || (S.hero && S.hero.emote === 'crush' && S.hero.state === 'emote')) S.heroLocked = true;
    }
    const h = S.hero; if (!h) return;
    const f = this.inward(h);
    if (crush) this.crush(m, t, h);
    if (crush && t < CRUSH_T) { // low and close, looking up at the fist with every core round it
      this.face(h, f);
      this.look(h.pos.x + f.x * 3.1 + f.z * 0.5, h.pos.y + 0.7, h.pos.z + f.z * 3.1 - f.x * 0.5, h.pos.x, h.pos.y + 2.4, h.pos.z);
    } else { // round the star player, rising and pulling back (wide after a CRUSH, to see the other team go)
      const t0 = crush ? t - CRUSH_T : t, a = Math.atan2(f.x, f.z) + t0 * 0.3 + (crush ? 0.6 : 0);
      const d = crush ? Math.min(13, 9 + t0 * 1.2) : Math.min(7.5, 3 + t0 * 0.9), y = crush ? Math.min(6.5, 4 + t0 * 0.6) : Math.min(3.3, 1.0 + t0 * 0.45);
      if (crush || !(h.state === 'celebrate' && h.look && h.look.celeb === 'spin')) this.face(h, f);
      this.look(h.pos.x + Math.sin(a) * d, h.pos.y + y, h.pos.z + Math.cos(a) * d, h.pos.x, h.pos.y + (crush ? 1.0 : 1.4), h.pos.z);
    }
    // confetti over the winners (gold and white for a draw), and a few fireworks over their end
    const hexes = S.w >= 0 ? [TEAM[S.w].hex, '#ffffff', '#ffd54a'] : ['#ffd54a', '#ffffff'];
    S.confT -= rdt;
    if (t > (crush ? CRUSH_T + 1.2 : 0.6) && S.confT <= 0) {
      S.confT = S.w >= 0 ? 0.08 : 0.2;
      for (let i = 0; i < 5; i++) FX.lit.spawn(h.pos.x + rand(-8, 8), rand(8, 11), h.pos.z + rand(-8, 8), rand(-1, 1), rand(-1.5, 0), rand(-1, 1), rand(0.1, 0.16), rand(2.5, 3.5), col(pick(hexes)), 0.16, 1.4, 0);
    }
    if (S.w >= 0 && S.fw < 3 && t > (crush ? CRUSH_T + 1.6 : 1.0) + S.fw * 0.7) { S.fw++; FX.rocket(rand(-14, 14), (S.w === 0 ? -1 : 1) * (F.L + rand(3, 7)), hexes); }
    if (!S.shown && t >= (crush ? CRUSH_T + 1.7 : OUTRO_TEXT_AT)) this.showText(m, crush);
  },
  /** the OMEGA CRUSH: the punch lands (a flash, shockwaves, the ground cracks), then the other team shatters one by one */
  crush(m, t, h) {
    const S = this.st;
    if (!S.crushed && t >= CRUSH_T) {
      S.crushed = true;
      Hud.flash('#ffffff'); Shake.add(0.9); Sfx.boom(); Sfx.punch();
      for (let i = 0; i < 4; i++) FX.after(i * 0.08, () => FX.ring(h.pos.x, 0.25, h.pos.z, i % 2 ? '#ffffff' : '#ffe9a8', 1.5 + i * 1.7, 30 + i * 8));
      FX.sparks(h.pos.x, 0.5, h.pos.z, '#ffffff', 50, 12, 0.3, 0.9);
      FX.dirt(h.pos.x, h.pos.z, 0, 0, 24, 1.6);
    }
    if (t >= CRUSH_T + 0.2) {
      const losers = m.players.filter((p) => p.team !== S.w).sort((a, b) => dist2D(a.pos, h.pos) - dist2D(b.pos, h.pos));
      losers.forEach((p, i) => { if (!S.gone.has(p) && t >= CRUSH_T + 0.2 + i * 0.22) { S.gone.add(p); this.shatter(p); } });
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
  showText(m, crush) {
    const S = this.st, w = S.w, me = m.human ? m.human.team : -1, h = S.hero;
    const won = me >= 0 && w === me, lost = me >= 0 && w >= 0 && w !== me;
    let big, color;
    if (crush) { big = 'SHATTERED!'; color = '#ffffff'; }
    else if (w < 0) { big = 'DRAW'; color = '#ffcb3d'; }
    else if (me < 0) { big = TEAM[w].name + ' WIN'; color = TEAM[w].hex; }
    else if (won) { big = 'VICTORY!'; color = '#ffcb3d'; }
    else { big = 'DEFEAT'; color = '#ff4d5e'; }
    const sub = crush ? (won ? 'YOU TOOK EVERY CORE' : lost ? 'THEY TOOK EVERY CORE' : TEAM[w].name + ' TOOK EVERY CORE')
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
