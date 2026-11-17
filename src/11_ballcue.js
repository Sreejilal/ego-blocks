/* =====================================================================
   BallCue: helps you see the ball (playtest, Nov 2026: "new players
   cannot see the ball"). In third person your own player stands between
   the camera and the ball you dribble, and far away the ball is a small
   white dot on a bright pitch. So:
   - the ball shows through anything in front of it (your own player,
     the net, a crowd of players) as a yellow shape
   - while you are new (your first BALL_CUE_MATCHES matches, or Ball
     marker ON in the pause menu) the ball also looks bigger, a yellow
     arrow floats over it (over the player who has it), a yellow ring
     sits on the grass under a loose ball, and an arrow at the edge of
     the screen points to it when it is off screen
   Only the picture changes: the ball's real size for the physics stays.
   ===================================================================== */
const BALL_CUE_MATCHES = 10;
const BALL_BIG = 1.3;
const BALL_CUE_COLOR = '#ffd23d';
const _bc1 = V3(), _bc2 = V3();
const BallCue = {
  ghost: null, ring: null, mark: null, edge: null, t: 0,
  init() {
    const L = $('labels');
    this.mark = document.createElement('div'); this.mark.className = 'ballcue ballmark'; this.mark.id = 'ballmark';
    this.edge = document.createElement('div'); this.edge.className = 'ballcue balledge'; this.edge.id = 'balledge';
    for (const el of [this.mark, this.edge]) { el.innerHTML = '<i></i>'; el.hidden = true; L.appendChild(el); }
  },
  /** settings.ballCue: 'auto' (help while you are new), 'on' or 'off' */
  mode() { return Save.data.settings.ballCue || 'auto'; },
  /** the bigger ball, the arrows and the ring */
  help() { const v = this.mode(); return v === 'on' || (v === 'auto' && Save.data.stats.played < BALL_CUE_MATCHES); },
  build() {
    const ghostMat = new THREE.MeshBasicMaterial({ color: lin(BALL_CUE_COLOR), transparent: true, opacity: 0.8, depthWrite: false, depthFunc: THREE.GreaterDepth, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false });
    this.ghost = new THREE.Mesh(BALL_GEO || makeBallGeometry(), ghostMat); // only drawn where something is in front of the ball
    this.ghost.renderOrder = 40; this.ghost.frustumCulled = false;
    const ringMat = new THREE.MeshBasicMaterial({ color: lin(BALL_CUE_COLOR), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.98, 28), ringMat);
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 6;
    this.ghost.visible = this.ring.visible = false;
    World.scene.add(this.ghost, this.ring);
  },
  /** the match on screen now (offline or online), or null */
  cur() {
    const s = Game.state;
    if (s === 'online') return Net.nm || null;
    if ((s === 'match' || s === 'paused' || s === 'results' || s === 'replay') && Game.match) return Game.match;
    return null;
  },
  /** the ball's picture at size s, still sitting on the grass. Safe to call every frame, also when nothing moved it */
  size(mesh, s) {
    const ud = mesh.userData;
    let y = mesh.position.y;
    if (ud.cueY === y) y -= ud.cueOff || 0;
    const off = BALL_R * (s - 1);
    mesh.position.y = y + off; ud.cueY = mesh.position.y; ud.cueOff = off;
    if (mesh.scale.x !== s) mesh.scale.setScalar(s);
  },
  hide() {
    if (this.ghost) this.ghost.visible = this.ring.visible = false;
    if (this.mark && !this.mark.hidden) this.mark.hidden = true;
    if (this.edge && !this.edge.hidden) this.edge.hidden = true;
  },
  /** every drawn frame, just before the picture is drawn */
  frame(rdt) {
    const m = this.cur(), b = m && m.ball;
    if (!b || !b.mesh || !this.mark) { this.hide(); return; }
    const mode = this.mode(), help = mode !== 'off' && this.help();
    this.size(b.mesh, help ? BALL_BIG : 1);
    if (!this.ghost) this.build();
    this.t += rdt || 0;
    const bp = b.mesh.position, shown = b.mesh.visible !== false;
    this.ghost.visible = mode !== 'off' && shown;
    if (this.ghost.visible) { this.ghost.position.copy(bp); this.ghost.quaternion.copy(b.mesh.quaternion); this.ghost.scale.copy(b.mesh.scale); }
    const live = Game.playing() && !(Game.state === 'online' && Net.paused) && !Game.gate && !Game.intro && m.phase !== 'goal' && m.phase !== 'end' && !m.fk && shown;
    const owner = b.owner, mine = !!owner && owner === m.human;
    this.ring.visible = help && live && !owner;
    if (this.ring.visible) { this.ring.position.set(bp.x, 0.04, bp.z); const k = 1 + Math.sin(this.t * 5) * 0.06; this.ring.scale.set(k, k, 1); }
    if (!help || !live || mine) { this.mark.hidden = true; this.edge.hidden = true; return; }
    // the arrow over the ball, or over the head of the player who has it
    const cam = World.camera, W = window.innerWidth, H = window.innerHeight;
    if (owner) _bc1.set(owner.pos.x, owner.pos.y + 2.75, owner.pos.z); else _bc1.set(bp.x, bp.y + BALL_R * BALL_BIG + 0.45, bp.z);
    _bc2.copy(_bc1).project(cam);
    if (_bc2.z < 1 && Math.abs(_bc2.x) < 0.97 && Math.abs(_bc2.y) < 0.94) {
      const x = (_bc2.x * 0.5 + 0.5) * W, y = (-_bc2.y * 0.5 + 0.5) * H - 6 - Math.abs(Math.sin(this.t * 4)) * 6;
      this.mark.hidden = false; this.edge.hidden = true;
      this.mark.style.transform = `translate(${(x - 14).toFixed(0)}px, ${(y - 16).toFixed(0)}px)`;
      return;
    }
    // off screen: an arrow at the edge points the way (down when it is behind you)
    _bc2.set(bp.x, bp.y, bp.z).applyMatrix4(cam.matrixWorldInverse);
    let dx = _bc2.x, dy = _bc2.y;
    if (_bc2.z > 0) dy -= _bc2.z + Math.abs(dx) * 0.2; // behind the camera
    const sx = dx, sy = -dy, n = Math.hypot(sx, sy) || 1, ux = sx / n, uy = sy / n;
    const mx = 40, hw = W / 2 - mx, hh = H / 2 - mx;
    const k = Math.min(hw / Math.max(Math.abs(ux), 1e-4), hh / Math.max(Math.abs(uy), 1e-4));
    const x = W / 2 + ux * k, y = H / 2 + uy * k, ang = Math.atan2(uy, ux) * 180 / Math.PI - 90;
    this.mark.hidden = true; this.edge.hidden = false;
    this.edge.style.transform = `translate(${(x - 14).toFixed(0)}px, ${(y - 8).toFixed(0)}px) rotate(${ang.toFixed(0)}deg)`;
  },
};
