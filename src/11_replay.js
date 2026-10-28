/* =====================================================================
   Replay: records the last 10 seconds of the match (every player's pose
   and the ball, every frame). After your goal, nutmeg or ankle breaker
   it offers an instant replay: slow motion with an orbiting camera,
   skippable, and SAVE CLIP records it to a video file to download.
   ===================================================================== */
const REC_N = 600, REC_F = 16, REC_B = 7; // frames kept, numbers per player, numbers for the ball
const REPLAY_BEFORE = 3.5, REPLAY_AFTER = 0.6;
const Replay = {
  m: null, head: 0, count: 0, offer: null, offerT: 0, play: null, rec: null,
  init() {
    const el = document.createElement('div');
    el.id = 'replay';
    el.innerHTML = `<button class="btn small rp-offer" id="rp-offer" type="button" hidden>REPLAY <span class="sub" id="rp-key">ENTER</span></button>
      <div class="rp-on" id="rp-on" hidden><span class="chip rp-badge"><b>REPLAY</b> <span id="rp-kind">GOAL</span></span>
        <div class="rp-ctl"><button class="btn small" id="rp-skip" type="button">SKIP</button><button class="btn small emerald" id="rp-save" type="button">SAVE CLIP</button></div>
        <span class="label rp-note" id="rp-note"></span></div>`;
    $('app').appendChild(el);
    $('rp-offer').addEventListener('click', () => { Sfx.click(); this.start(); });
    $('rp-skip').addEventListener('click', () => { Sfx.click(); this.stop(); });
    $('rp-save').addEventListener('click', () => { Sfx.click(); this.saveClip(); });
  },
  /* ---------- recording ---------- */
  reset(m) {
    this.m = m; this.head = 0; this.count = 0; this.offer = null; this.hideOffer();
    const n = m.players.length;
    this.times = new Float32Array(REC_N); this.pl = new Float32Array(REC_N * n * REC_F); this.ball = new Float32Array(REC_N * REC_B);
  },
  record(m) {
    if (m !== this.m) this.reset(m);
    const i = this.head, n = m.players.length;
    this.times[i] = m.time;
    m.players.forEach((p, k) => {
      const P = p.P, o = (i * n + k) * REC_F, a = this.pl;
      a[o] = P.root.position.x; a[o + 1] = P.root.position.y; a[o + 2] = P.root.position.z; a[o + 3] = P.root.rotation.y;
      a[o + 4] = P.body.position.y; a[o + 5] = P.body.rotation.x; a[o + 6] = P.body.rotation.z;
      a[o + 7] = P.headP.rotation.x; a[o + 8] = P.headP.rotation.y;
      a[o + 9] = P.armL.rotation.x; a[o + 10] = P.armL.rotation.z; a[o + 11] = P.armR.rotation.x; a[o + 12] = P.armR.rotation.z;
      a[o + 13] = P.legL.rotation.x; a[o + 14] = P.legR.rotation.x; a[o + 15] = P.legR.rotation.z;
    });
    const b = m.ball.mesh, ob = i * REC_B;
    this.ball[ob] = b.position.x; this.ball[ob + 1] = b.position.y; this.ball[ob + 2] = b.position.z;
    this.ball[ob + 3] = b.quaternion.x; this.ball[ob + 4] = b.quaternion.y; this.ball[ob + 5] = b.quaternion.z; this.ball[ob + 6] = b.quaternion.w;
    this.head = (i + 1) % REC_N; this.count = Math.min(this.count + 1, REC_N);
  },
  /** frame slots oldest to newest */
  slot(j) { return (this.head - this.count + j + REC_N) % REC_N; },
  /* ---------- offering ---------- */
  /** something worth seeing again just happened (only your own moments in the live match) */
  event(m, kind, p) {
    if (m !== Game.match || m.autopilot || !m.human || Game.state !== 'match') return;
    this.offer = { kind, t: m.time, focus: m.players.indexOf(p), until: kind === 'GOAL' ? 'goal' : null };
    this.offerT = kind === 'GOAL' ? 99 : 3;
    const b = $('rp-offer');
    $('rp-key').textContent = Touch.on && !Input.usingPad ? 'TAP' : Input.usingPad ? 'R3' : 'ENTER';
    b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  },
  hideOffer() { const b = $('rp-offer'); if (b) b.hidden = true; },
  tick(m, rdt) {
    if (!this.offer || Game.state !== 'match') return;
    this.offerT -= rdt;
    if (this.offerT <= 0 || (this.offer.until === 'goal' && m.phase !== 'goal')) { this.offer = null; this.hideOffer(); }
  },
  /* ---------- playback ---------- */
  start() {
    const m = Game.match, o = this.offer;
    if (!m || !o || Game.state !== 'match' || this.count < 10) return false;
    this.hideOffer(); Cam.unhide();
    const t1 = o.t + REPLAY_AFTER, t0 = Math.max(this.times[this.slot(0)], o.t - REPLAY_BEFORE);
    this.play = { kind: o.kind, focus: o.focus, ev: o.t, t0, t1: Math.min(t1, this.times[this.slot(this.count - 1)]), t: t0, cam: null, a: null };
    this.offer = null;
    Game.state = 'replay';
    Input.releaseLock();
    document.body.classList.add('replaying');
    $('rp-kind').textContent = o.kind; $('rp-note').textContent = '';
    $('rp-on').hidden = false;
    return true;
  },
  /** slow motion for the last moment before the event */
  speedAt(t) { const p = this.play; return t > p.ev - 1.0 && t < p.ev + 0.3 ? 0.4 : 0.9; },
  update(rdt) {
    const p = this.play;
    if (!p) return;
    p.t += rdt * this.speedAt(p.t);
    if (p.t >= p.t1) { if (this.rec) { this.finishClip(); } this.stop(); return; }
    this.apply(p.t);
  },
  /** put every model where it was at match time t (blending the two nearest frames) */
  apply(t) {
    const m = this.m, n = m.players.length;
    let lo = 0, hi = this.count - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.times[this.slot(mid)] <= t) lo = mid; else hi = mid; }
    const i0 = this.slot(lo), i1 = this.slot(hi), ta = this.times[i0], tb = this.times[i1];
    const k = tb > ta ? clamp((t - ta) / (tb - ta), 0, 1) : 0;
    const A = this.pl, L = (q) => A[i0 * n * REC_F + q] + (A[i1 * n * REC_F + q] - A[i0 * n * REC_F + q]) * k;
    m.players.forEach((pl, j) => {
      const P = pl.P, o = j * REC_F, v = (q) => L(o + q);
      P.root.position.set(v(0), v(1), v(2));
      const y0 = A[i0 * n * REC_F + o + 3], y1 = A[i1 * n * REC_F + o + 3]; P.root.rotation.y = y0 + wrapA(y1 - y0) * k;
      P.body.position.y = v(4); P.body.rotation.x = v(5); P.body.rotation.z = v(6);
      P.headP.rotation.x = v(7); P.headP.rotation.y = v(8);
      P.armL.rotation.x = v(9); P.armL.rotation.z = v(10); P.armR.rotation.x = v(11); P.armR.rotation.z = v(12);
      P.legL.rotation.x = v(13); P.legR.rotation.x = v(14); P.legR.rotation.z = v(15);
      pl.blob.position.set(v(0), 0.025, v(2));
    });
    const B = this.ball, b0 = i0 * REC_B, b1 = i1 * REC_B, bl = (q) => B[b0 + q] + (B[b1 + q] - B[b0 + q]) * k;
    const mesh = m.ball.mesh;
    mesh.position.set(bl(0), bl(1), bl(2));
    _q1.set(B[b0 + 3], B[b0 + 4], B[b0 + 5], B[b0 + 6]); mesh.quaternion.set(B[b1 + 3], B[b1 + 4], B[b1 + 5], B[b1 + 6]); mesh.quaternion.slerp(_q1, 1 - k);
    m.ball.blob.position.set(bl(0), 0.02, bl(2));
    this.camera(mesh.position, m.players[this.play.focus]);
  },
  /** cinematic camera: a slow orbit round the ball and the player who made the moment, closing in */
  camera(ball, who) {
    const p = this.play, cam = World.camera, u = clamp((p.t - p.t0) / (p.t1 - p.t0), 0, 1);
    const fx = who ? lerp(ball.x, who.P.root.position.x, 0.35) : ball.x, fz = who ? lerp(ball.z, who.P.root.position.z, 0.35) : ball.z;
    if (p.a == null) p.a = (who ? who.P.root.rotation.y : 0) + Math.PI * 0.7;
    const a = p.a + u * 1.1, R = lerp(9, 5.5, u), h = lerp(3.2, 1.5, u);
    const tx = fx + Math.sin(a) * R, ty = h, tz = fz + Math.cos(a) * R;
    if (!p.cam) p.cam = V3(tx, ty, tz); else { p.cam.x = damp(p.cam.x, tx, 6, 1 / 60); p.cam.y = damp(p.cam.y, ty, 6, 1 / 60); p.cam.z = damp(p.cam.z, tz, 6, 1 / 60); }
    cam.position.copy(p.cam);
    cam.lookAt(fx, Math.max(0.8, ball.y * 0.5 + 0.6), fz);
  },
  stop() {
    if (!this.play) return;
    if (this.rec && this.rec.state === 'recording') { this.finishClip(); }
    this.play = null;
    $('rp-on').hidden = true;
    document.body.classList.remove('replaying');
    if (Game.state === 'replay') { Game.state = 'match'; Input.consumeEdges(); Input.requestLock(); UI.lockHint(); }
  },
  /* ---------- clips ---------- */
  clipType() {
    if (!window.MediaRecorder || !$('gl').captureStream) return null;
    return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || null;
  },
  /** play the replay again from the start while recording the 3D view, then download it */
  saveClip() {
    const p = this.play, type = this.clipType();
    if (!p) return;
    if (!type) { $('rp-note').textContent = 'THIS BROWSER CANNOT SAVE CLIPS'; return; }
    if (this.rec) return;
    const chunks = [];
    try {
      const stream = $('gl').captureStream(30);
      this.rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6000000 });
    } catch (e) { $('rp-note').textContent = 'THIS BROWSER CANNOT SAVE CLIPS'; this.rec = null; return; }
    const kind = p.kind.toLowerCase().replace(/\s+/g, '-');
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    this.rec.onstop = () => {
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'scorz-' + kind + (type.includes('mp4') ? '.mp4' : '.webm');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.lastClip = { size: blob.size, type };
    };
    p.t = p.t0; p.cam = null;
    $('rp-save').disabled = true; $('rp-note').textContent = 'RECORDING CLIP...';
    this.rec.start(250);
  },
  finishClip() {
    const r = this.rec; this.rec = null;
    $('rp-save').disabled = false; $('rp-note').textContent = 'CLIP SAVED TO YOUR DOWNLOADS';
    try { if (r && r.state === 'recording') r.stop(); } catch (e) {}
  },
};
