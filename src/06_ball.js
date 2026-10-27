/* =====================================================================
   The ball: voxel look, sphere physics, dribble follow, goal frame
   ===================================================================== */
const ROLL_A = 2.6, ROLL_B = 0.2; // rolling friction: decel = A + B * speed
let BALL_GEO = null;
class Ball {
  constructor(m) {
    this.m = m;
    this.pos = V3(0, BALL_R, 0); this.vel = V3(); this.curve = V3(); this.curveDecay = 1.4;
    this.straightT = 0; this.owner = null; this.held = false; this.inGoal = 0;
    this.lastTouch = null; this.prevTouch = null; this.lastTeam = -1; this.lastKicker = null;
    this.kick = null; this.ignore = null; this.ignoreT = 0;
    this.quat = new THREE.Quaternion(); this.spinAxis = V3(1, 0, 0); this.spinRate = 0;
    this.last = V3(0, BALL_R, 0);
    if (!BALL_GEO) BALL_GEO = makeBallGeometry();
    this.mesh = new THREE.Mesh(BALL_GEO, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.mesh.castShadow = true;
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), blobMat);
    this.blob.rotation.x = -Math.PI / 2;
    m.scene.add(this.mesh, this.blob);
  }
  dispose() { this.m.scene.remove(this.mesh, this.blob); }
  reset(x = 0, z = 0, y = BALL_R) {
    this.owner = null; this.held = false; this.inGoal = 0; this.kick = null; this.straightT = 0;
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.curve.set(0, 0, 0); this.last.copy(this.pos); this.spinRate = 0;
  }
  touch(p) {
    if (!p) return;
    if (this.lastTouch !== p) { this.prevTouch = this.lastTouch; this.lastTouch = p; }
    this.lastTeam = p.team;
    const lp = this.m.lastPass;
    if (lp && p.team !== lp.from.team) this.m.lastPass = null;
  }
  release() { this.owner = null; this.held = false; }
  update(dt) {
    if (this.ignoreT > 0) { this.ignoreT -= dt; if (this.ignoreT <= 0) this.ignore = null; }
    this.last.copy(this.pos);
    if (this.owner) this.follow(dt); else this.simulate(dt);
    // rolling / spinning visual
    const dx = this.pos.x - this.last.x, dz = this.pos.z - this.last.z, d = len2D(dx, dz);
    if (this.pos.y < BALL_R + 0.06 && d > 1e-5) {
      this.spinAxis.set(dz / d, 0, -dx / d); this.spinRate = dt > 0 ? (d / BALL_R) / dt : 0;
      _q1.setFromAxisAngle(this.spinAxis, d / BALL_R); this.quat.premultiply(_q1);
    } else if (this.spinRate > 0) {
      _q1.setFromAxisAngle(this.spinAxis, this.spinRate * dt); this.quat.premultiply(_q1); this.spinRate *= Math.exp(-0.5 * dt);
    }
    this.mesh.position.copy(this.pos); this.mesh.quaternion.copy(this.quat);
    const h = Math.max(0, this.pos.y - BALL_R);
    this.blob.position.set(this.pos.x, 0.02, this.pos.z);
    const bs = clamp(1 - h / 12, 0.35, 1); this.blob.scale.set(bs, bs, 1);
    this.blob.material.opacity = 0.42 * clamp(1 - h / 14, 0.15, 1);
    // trails
    const k = this.kick;
    if (!this.owner && k && k.trail && this.vel.lengthSq() > 64) {
      if (k.special === 'impact') {
        for (let i = 0; i < 3; i++) FX.trail(lerp(this.last.x, this.pos.x, i / 3), lerp(this.last.y, this.pos.y, i / 3), lerp(this.last.z, this.pos.z, i / 3), k.trail, 0.42, 0.45);
        if (Math.random() < 0.7) FX.shatter(this.pos.x, Math.max(0.1, this.pos.y - 0.4), this.pos.z, 2);
      } else FX.trail(this.pos.x, this.pos.y, this.pos.z, k.trail, 0.22, 0.32);
    }
  }
  follow(dt) {
    const p = this.owner;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let tx, ty, tz, kf = 26;
    if (this.held) { tx = p.pos.x + fx * 0.42; ty = p.pos.y + 1.0; tz = p.pos.z + fz * 0.42; kf = 30; }
    else {
      const sp = len2D(p.vel.x, p.vel.z);
      const ph0 = p.dribblePhase;
      p.dribblePhase += dt * (3 + sp * 1.1);
      if (sp > 8 && p.onGround && Math.floor(ph0 / Math.PI) !== Math.floor(p.dribblePhase / Math.PI)) { FX.dirt(this.pos.x, this.pos.z, -Math.sin(p.yaw), -Math.cos(p.yaw), 2, 0.4); if (Math.random() < 0.35) FX.feathers(this.pos.x, 0.1, this.pos.z, '#9fd97a', 1); }
      let reach = 0.62 + 0.2 * Math.max(0, Math.sin(p.dribblePhase)) * clamp(sp / 7, 0, 1);
      if (p.fx.shuffle > 0) reach = 0.82 + Math.sin(p.dribblePhase * 1.5) * 0.12;
      tx = p.pos.x + fx * reach; tz = p.pos.z + fz * reach; ty = p.pos.y + BALL_R + (p.onGround ? 0 : 0.2);
    }
    const k = 1 - Math.exp(-kf * dt);
    this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k;
    this.vel.copy(p.vel);
  }
  simulate(dt) {
    const sp0 = this.vel.length();
    const n = clamp(Math.ceil(sp0 * dt / 0.16), 1, 10);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      if (this.straightT > 0) this.straightT -= h; else this.vel.y -= BALL_G * h;
      if (this.curve.x !== 0 || this.curve.z !== 0) {
        this.vel.x += this.curve.x * h; this.vel.z += this.curve.z * h;
        if (this.curveDecay > 0) { const k = Math.exp(-h / this.curveDecay); this.curve.x *= k; this.curve.z *= k; }
      }
      if (this.pos.y > BALL_R + 0.02 && this.straightT <= 0) { const k = 1 - 0.05 * h; this.vel.x *= k; this.vel.z *= k; this.vel.y *= k; }
      this.pos.x += this.vel.x * h; this.pos.y += this.vel.y * h; this.pos.z += this.vel.z * h;
      if (this.pos.y < BALL_R) {
        this.pos.y = BALL_R;
        if (this.straightT > 0) this.straightT = 0;
        if (this.vel.y < -2.2) {
          if (this.vel.y < -6) Sfx.thud(clamp(-this.vel.y / 16, 0.2, 1));
          this.vel.y = -this.vel.y * 0.52; this.vel.x *= 0.88; this.vel.z *= 0.88;
          this.curve.multiplyScalar(0.4);
        } else {
          this.vel.y = 0;
          this.curve.multiplyScalar(Math.exp(-h * 6));
          const hs = len2D(this.vel.x, this.vel.z);
          if (hs > 0) { const kk = Math.max(0, hs - (ROLL_A + ROLL_B * hs) * h) / hs; this.vel.x *= kk; this.vel.z *= kk; }
        }
      }
      this.collideGoal();
      this.collideBoards();
    }
    // stop simulating a ball that left the stadium
    if (Math.abs(this.pos.x) > 70 || Math.abs(this.pos.z) > 80) { this.vel.set(0, 0, 0); this.pos.y = Math.max(this.pos.y, BALL_R); }
  }
  collideGoal() {
    const p = this.pos, v = this.vel, r = BALL_R;
    const az = Math.abs(p.z);
    if (az < F.L - 1.2 || Math.abs(p.x) > F.GW + F.POST + 1 || p.y > F.GH + F.POST + 1) return;
    for (const b of World.goalBoxes) {
      const cx = clamp(p.x, b.min.x, b.max.x), cy = clamp(p.y, b.min.y, b.max.y), cz = clamp(p.z, b.min.z, b.max.z);
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r * r) continue;
      let d = Math.sqrt(d2), nx, ny, nz;
      if (d < 1e-5) { nx = 0; ny = 1; nz = 0; } else { nx = dx / d; ny = dy / d; nz = dz / d; }
      p.x = cx + nx * r; p.y = cy + ny * r; p.z = cz + nz * r;
      const vn = v.x * nx + v.y * ny + v.z * nz;
      if (vn < 0) {
        v.x -= 1.62 * vn * nx; v.y -= 1.62 * vn * ny; v.z -= 1.62 * vn * nz;
        this.curve.set(0, 0, 0); this.straightT = 0;
        if (-vn > 5) { Sfx.clang(); this.m.onWoodwork(); }
      }
    }
    const s = sgn(p.z);
    if (!this.inGoal && az > F.L - r && az < F.L + 0.9 && Math.abs(p.x) < F.GW && p.y < F.GH && v.z * s > 0) this.inGoal = s;
    if (this.inGoal) {
      const S = this.inGoal;
      const xm = F.GW - r, ym = F.GH - r, zb = F.L + F.GD - F.POST - r;
      if (Math.abs(p.x) > xm) { p.x = sgn(p.x) * xm; v.x *= -0.15; v.y *= 0.7; v.z *= 0.7; }
      if (p.y > ym) { p.y = ym; v.y = -Math.abs(v.y) * 0.15; v.x *= 0.7; v.z *= 0.7; }
      if (p.z * S > zb) {
        p.z = S * zb;
        if (Math.abs(v.z) > 3) World.netBulge[S > 0 ? 0 : 1] = Math.min(1, Math.abs(v.z) / 22);
        v.z *= -0.12; v.x *= 0.5; v.y *= 0.5;
      }
      if (p.z * S < F.L - 1.2) this.inGoal = 0;
    } else {
      const x0 = F.GW + F.POST, zA = F.L, zB = F.L + F.GD, yTop = F.GH + F.POST;
      if (az > zA && az < zB + r && Math.abs(p.x) < x0 + r && p.y < yTop + r) {
        const px = x0 + r - Math.abs(p.x), py = yTop + r - p.y, pz = zB + r - az;
        const mn = Math.min(px, py, pz);
        if (mn === px) { p.x = sgn(p.x) * (x0 + r); if (v.x * sgn(p.x) < 0) v.x *= -0.25; }
        else if (mn === py) { p.y = yTop + r; if (v.y < 0) v.y *= -0.25; }
        else { p.z = s * (zB + r); if (v.z * s < 0) v.z *= -0.25; }
        v.x *= 0.85; v.z *= 0.85;
      }
    }
  }
  collideBoards() {
    const p = this.pos, v = this.vel, r = BALL_R;
    if (p.y > 1.0 + r) return;
    const bx = F.BOARD_X - 0.15 - r, bz = F.BOARD_Z - 0.15 - r;
    if (Math.abs(p.x) > bx && Math.abs(p.x) < bx + 0.7) { p.x = sgn(p.x) * bx; if (v.x * sgn(p.x) > 0) { v.x *= -0.5; if (Math.abs(v.x) > 4) Sfx.thud(0.6); } }
    if (Math.abs(p.z) > bz && Math.abs(p.z) < bz + 0.7) { p.z = sgn(p.z) * bz; if (v.z * sgn(p.z) > 0) { v.z *= -0.5; if (Math.abs(v.z) > 4) Sfx.thud(0.6); } }
  }
}
/** launch velocity that lands on `to` at the given speed (low arc). g=0 for straight shots */
function solveLaunch(from, to, speed, g) {
  const dx = to.x - from.x, dz = to.z - from.z, D = Math.hypot(dx, dz) || 0.001, H = to.y - from.y;
  let ang;
  if (g <= 0) ang = Math.atan2(H, D);
  else {
    const v2 = speed * speed, disc = v2 * v2 - g * (g * D * D + 2 * H * v2);
    ang = disc >= 0 ? Math.atan((v2 - Math.sqrt(disc)) / (g * D)) : Math.PI / 4;
  }
  ang = clamp(ang, -0.4, 1.0);
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: dx / D * c * speed, y: s * speed, z: dz / D * c * speed };
}
/** initial speed for a ground pass that still has `vEnd` when it has rolled distance D */
function groundSpeedFor(D, vEnd = 7) {
  const a = ROLL_A, b = ROLL_B;
  const dist = (v0) => (v0 - vEnd) / b - (a / (b * b)) * Math.log((a + b * v0) / (a + b * vEnd));
  let lo = vEnd, hi = 48;
  for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (dist(mid) < D) lo = mid; else hi = mid; }
  return hi;
}
