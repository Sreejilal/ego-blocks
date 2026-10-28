/* =====================================================================
   Cube particles, vision paths, screen shake, hit-stop and slow-mo
   ===================================================================== */
class CubePool {
  constructor(max, material, opts = {}) {
    this.max = max; this.n = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    const f = () => new Float32Array(max);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.maxLife = f(); this.size = f(); this.grav = f(); this.drag = f();
    this.rx = f(); this.ry = f(); this.sx = f(); this.sy = f(); this.bounce = new Uint8Array(max);
    this.cr = f(); this.cg = f(); this.cb = f();
    this.floor = opts.floor == null ? 0 : opts.floor;
  }
  spawn(x, y, z, vx, vy, vz, size, life, col, grav = 1, drag = 0.4, bounce = 1) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = Math.floor(Math.random() * this.max);
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.size[i] = size; this.life[i] = this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.bounce[i] = bounce;
    this.rx[i] = Math.random() * TAU; this.ry[i] = Math.random() * TAU;
    this.sx[i] = (Math.random() - 0.5) * 12; this.sy[i] = (Math.random() - 0.5) * 12;
    this.cr[i] = col.r; this.cg[i] = col.g; this.cb[i] = col.b;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (const k of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'maxLife', 'size', 'grav', 'drag', 'rx', 'ry', 'sx', 'sy', 'bounce', 'cr', 'cg', 'cb']) this[k][i] = this[k][j];
  }
  clear() { this.n = 0; this.mesh.count = 0; }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= dr; this.vz[i] *= dr; this.vy[i] = this.vy[i] * dr - GRAV * this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      const hs = this.size[i] * 0.5;
      if (this.bounce[i] && this.py[i] < this.floor + hs) { this.py[i] = this.floor + hs; this.vy[i] = -this.vy[i] * 0.3; this.vx[i] *= 0.6; this.vz[i] *= 0.6; this.sx[i] *= 0.5; this.sy[i] *= 0.5; }
      this.rx[i] += this.sx[i] * dt; this.ry[i] += this.sy[i] * dt;
      i++;
    }
    const m = this.mesh.instanceMatrix.array, c = this.mesh.instanceColor.array;
    for (let k = 0; k < this.n; k++) {
      const lf = this.life[k] / this.maxLife[k];
      const s = this.size[k] * Math.min(1, lf * 2.2);
      const ca = Math.cos(this.rx[k]), sa = Math.sin(this.rx[k]), cb = Math.cos(this.ry[k]), sb = Math.sin(this.ry[k]);
      const o = k * 16;
      m[o] = cb * s; m[o + 1] = 0; m[o + 2] = -sb * s; m[o + 3] = 0;
      m[o + 4] = sb * sa * s; m[o + 5] = ca * s; m[o + 6] = cb * sa * s; m[o + 7] = 0;
      m[o + 8] = sb * ca * s; m[o + 9] = -sa * s; m[o + 10] = cb * ca * s; m[o + 11] = 0;
      m[o + 12] = this.px[k]; m[o + 13] = this.py[k]; m[o + 14] = this.pz[k]; m[o + 15] = 1;
      c[k * 3] = this.cr[k]; c[k * 3 + 1] = this.cg[k]; c[k * 3 + 2] = this.cb[k];
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

const COL = {};
function col(hex) { return COL[hex] || (COL[hex] = lin(hex)); }

const FX = {
  lit: null, glow: null, paths: null, timers: [],
  init(scene) {
    this.lit = new CubePool(1400, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.glow = new CubePool(1600, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), { floor: -100 });
    scene.add(this.lit.mesh, this.glow.mesh);
    const pm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.paths = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), pm, 260);
    this.paths.setColorAt(0, new THREE.Color(1, 1, 1));
    this.paths.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.paths.count = 0; this.paths.frustumCulled = false;
    scene.add(this.paths);
    this.pathN = 0;
    this.beams = [];
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 3; i++) {
      const outer = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      const core = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      outer.visible = core.visible = false; outer.frustumCulled = core.frustumCulled = false;
      scene.add(outer, core);
      this.beams.push({ outer, core, t: 0, life: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), ball: null });
    }
  },
  clear() { this.lit.clear(); this.glow.clear(); this.paths.count = 0; this.timers.length = 0; if (this.beams) for (const b of this.beams) { b.life = 0; b.outer.visible = b.core.visible = false; } },
  /** glowing beam that stretches behind a ball while it flies (Impact Shot) */
  beam(from, ball, hex) {
    const b = this.beams.reduce((a, c) => (a.life - a.t < c.life - c.t ? a : c));
    b.from.copy(from); b.to.copy(ball.pos); b.ball = ball; b.t = 0; b.life = 1.1;
    b.outer.material.color.copy(col(hex)); b.core.material.color.set(0xffffff);
    b.outer.visible = b.core.visible = true;
  },
  updateBeams(dt) {
    for (const b of this.beams) {
      if (b.life <= 0 || b.t >= b.life) { if (b.outer.visible) { b.outer.visible = b.core.visible = false; } continue; }
      b.t += dt;
      if (b.ball && b.t < 0.7 && b.ball.kick && b.ball.kick.special === 'impact') b.to.copy(b.ball.pos);
      const len = b.from.distanceTo(b.to);
      if (len < 0.05) continue;
      const k = 1 - b.t / b.life;
      _v1.addVectors(b.from, b.to).multiplyScalar(0.5);
      for (const [mesh, w, op] of [[b.outer, 0.95, 0.5], [b.core, 0.3, 0.95]]) {
        mesh.position.copy(_v1); mesh.lookAt(b.to);
        const ww = w * (0.6 + 0.4 * k);
        mesh.scale.set(ww, ww, len);
        mesh.material.opacity = op * k;
      }
    }
  },
  after(t, fn) { this.timers.push({ t, fn }); },
  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); } }
    this.lit.update(dt); this.glow.update(dt);
    this.updateBeams(dt);
  },
  /* ----- emitters ----- */
  dirt(x, z, dx, dz, n = 12, power = 1) {
    const pal = ['#7a5233', '#5d3a22', '#5aa83f', '#47892f', '#8a6040'];
    for (let i = 0; i < n; i++) {
      const sp = rand(1.5, 4.5) * power;
      this.lit.spawn(x + rand(-0.3, 0.3), 0.1, z + rand(-0.3, 0.3), dx * sp + rand(-1.5, 1.5), rand(2, 5) * power, dz * sp + rand(-1.5, 1.5), rand(0.08, 0.18), rand(0.5, 0.9), col(pick(pal)), 1, 0.6);
    }
  },
  feathers(x, y, z, hex = '#f5f1e6', n = 8) {
    for (let i = 0; i < n; i++) this.lit.spawn(x + rand(-0.4, 0.4), y + rand(0, 1.2), z + rand(-0.4, 0.4), rand(-1.6, 1.6), rand(0.5, 2.2), rand(-1.6, 1.6), rand(0.07, 0.13), rand(0.8, 1.4), col(hex), 0.12, 2.2);
  },
  dust(x, z, n = 3) {
    for (let i = 0; i < n; i++) this.lit.spawn(x + rand(-0.3, 0.3), 0.15, z + rand(-0.3, 0.3), rand(-0.8, 0.8), rand(0.4, 1.4), rand(-0.8, 0.8), rand(0.12, 0.22), rand(0.4, 0.7), col(pick(['#b8a07a', '#9c8562', '#c9b590'])), 0.15, 1.5);
  },
  trail(x, y, z, hex, size = 0.18, life = 0.35) {
    this.glow.spawn(x + rand(-0.05, 0.05), y + rand(-0.05, 0.05), z + rand(-0.05, 0.05), rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), size, life, col(hex), 0, 1, 0);
  },
  sparks(x, y, z, hex, n = 16, speed = 6, size = 0.16, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const th = Math.random() * TAU, ph = Math.acos(rand(-1, 1)), sp = speed * rand(0.4, 1);
      this.glow.spawn(x, y, z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp, size * rand(0.7, 1.3), life * rand(0.7, 1.2), col(hex), 0.25, 1.4, 0);
    }
  },
  shatter(x, y, z, n = 6) {
    const pal = ['#5aa83f', '#7a5233', '#eef1f4', '#8c8f99'];
    for (let i = 0; i < n; i++) this.lit.spawn(x + rand(-0.3, 0.3), Math.max(0.1, y + rand(-0.2, 0.2)), z + rand(-0.3, 0.3), rand(-3, 3), rand(1.5, 5), rand(-3, 3), rand(0.1, 0.24), rand(0.5, 1.0), col(pick(pal)), 1, 0.5);
  },
  firework(x, y, z, hexes) {
    const c = pick(hexes);
    this.sparks(x, y, z, c, 46, 11, 0.32, 1.5);
    this.sparks(x, y, z, '#ffffff', 10, 5, 0.22, 0.7);
  },
  rocket(x, z, hexes, delay = 0) {
    this.after(delay, () => {
      const h = rand(16, 26);
      const steps = 12;
      for (let i = 0; i < steps; i++) this.after(i * 0.045, () => this.trail(x + rand(-0.1, 0.1), (i / steps) * h, z, '#fff2c0', 0.22, 0.5));
      this.after(steps * 0.045, () => { this.firework(x, h, z, hexes); Sfx.thud(0.9); });
    });
  },
  explosion(x, y, z) {
    this.sparks(x, y + 0.5, z, '#ffb02e', 40, 10, 0.35, 0.8);
    this.sparks(x, y + 0.5, z, '#ff4d2e', 26, 7, 0.3, 0.7);
    for (let i = 0; i < 26; i++) this.lit.spawn(x, y + 0.4, z, rand(-7, 7), rand(3, 10), rand(-7, 7), rand(0.15, 0.35), rand(0.8, 1.5), col(pick(['#3a3a3a', '#5a5a5a', '#7a5233', '#5aa83f'])), 1, 0.4);
  },
  ring(x, y, z, hex, r = 1.2, n = 18) {
    for (let i = 0; i < n; i++) { const a = i / n * TAU; this.glow.spawn(x + Math.cos(a) * r, y, z + Math.sin(a) * r, Math.cos(a) * 3, 0.5, Math.sin(a) * 3, 0.16, 0.45, col(hex), 0, 2, 0); }
  },
  aura(p, hex, dt) {
    p._auraAcc = (p._auraAcc || 0) + dt * 34;
    while (p._auraAcc > 1) {
      p._auraAcc -= 1;
      const a = Math.random() * TAU, r = rand(0.45, 0.8);
      this.glow.spawn(p.pos.x + Math.cos(a) * r, p.pos.y + rand(0.1, 1.8), p.pos.z + Math.sin(a) * r, -Math.sin(a) * 2.2, rand(1, 2.4), Math.cos(a) * 2.2, rand(0.08, 0.16), rand(0.35, 0.6), col(hex), 0, 0.5, 0);
    }
  },
  /** awakened: a strong aura in your style's colour with white light streaking up */
  awaken(p, dt) {
    this.aura(p, p.aura, dt * 1.7);
    if (Math.random() < dt * 30) this.glow.spawn(p.pos.x + rand(-0.5, 0.5), p.pos.y + 0.1, p.pos.z + rand(-0.5, 0.5), 0, rand(5, 8), 0, rand(0.06, 0.1), 0.45, col('#ffffff'), -0.3, 0.3, 0);
  },
  /** the moment you awaken: sparks, two rings and a pillar of light */
  awakenBurst(p) {
    const x = p.pos.x, z = p.pos.z;
    this.sparks(x, 1.1, z, p.aura, 70, 11, 0.22, 0.8); this.sparks(x, 1.1, z, '#ffffff', 30, 7, 0.14, 0.6);
    this.ring(x, 0.2, z, p.aura, 1.6, 30); this.ring(x, 0.25, z, '#ffffff', 2.6, 36);
    for (let i = 0; i < 44; i++) this.glow.spawn(x + rand(-0.35, 0.35), rand(0, 0.5), z + rand(-0.35, 0.35), 0, rand(8, 16), 0, rand(0.12, 0.22), rand(0.5, 0.9), col(i % 3 ? p.aura : '#ffffff'), -0.2, 0.6, 0);
  },
  /** each Flow has its own look: wind, afterimage, venom, coins, blue fire, a crown. No Flow: your style's aura */
  flow(p, id, dt) {
    const f = id ? FLOWS[id] : null;
    if (!f) { this.aura(p, p.aura, dt); return; }
    const c = col(f.color), x = p.pos.x, y = p.pos.y, z = p.pos.z, t = (p._flowClock = (p._flowClock || 0) + dt);
    const often = (perSec) => Math.random() < perSec * dt;
    switch (f.fx) {
      case 'wind': // green ribbons spiralling up around you
        for (let i = 0; i < 3; i++) if (often(42)) { const a = t * 9 + i * TAU / 3, r = 0.8; this.glow.spawn(x + Math.cos(a) * r, y + 0.15, z + Math.sin(a) * r, -Math.sin(a) * 3.4, 3.6, Math.cos(a) * 3.4, 0.15, 0.6, c, 0, 0.2, 0); }
        this.aura(p, f.color, dt * 0.35);
        break;
      case 'speed': { // an orange afterimage streaming behind you, sparks off your boots
        const sp = len2D(p.vel.x, p.vel.z);
        if (often(12)) this.glow.spawn(x + rand(-0.4, 0.4), y + rand(0.2, 1.9), z + rand(-0.4, 0.4), 0, 0.6, 0, 0.1, 0.4, c, 0, 0.5, 0);
        if (sp > 3) for (let i = 0; i < 2; i++) if (often(45)) this.glow.spawn(x + rand(-0.3, 0.3), y + rand(0.3, 1.8), z + rand(-0.3, 0.3), -p.vel.x * 0.3, 0, -p.vel.z * 0.3, 0.15, 0.28, c, 0, 2, 0);
        if (sp > 5 && p.onGround && often(14)) this.sparks(x, 0.1, z, '#ffd27a', 2, 3, 0.08, 0.3);
        break;
      }
      case 'venom': // green drops falling off you (the tackle ring is drawn by the player)
        if (often(26)) this.glow.spawn(x + rand(-0.45, 0.45), y + rand(0.7, 1.5), z + rand(-0.45, 0.45), 0, -0.4, 0, rand(0.08, 0.13), 0.7, c, 1.3, 0.2, 0);
        break;
      case 'coins': // gold blocks circling over your head
        for (let i = 0; i < 3; i++) if (often(28)) { const b = t * 5 + i * TAU / 3, r = 0.65; this.glow.spawn(x + Math.cos(b) * r, y + 2.05 + Math.sin(t * 4 + i) * 0.12, z + Math.sin(b) * r, -Math.sin(b) * 1.4, 0.1, Math.cos(b) * 1.4, 0.15, 0.32, c, 0, 0.6, 0); }
        if (often(4)) this.sparks(x, y + 2.1, z, '#fff3b0', 3, 2.5, 0.07, 0.4);
        break;
      case 'flame': // blue fire on your head and shoulders
        for (let i = 0; i < 3; i++) if (often(40)) { const ox = rand(-0.38, 0.38), oz = rand(-0.22, 0.22); this.glow.spawn(x + ox, y + rand(1.45, 2.05), z + oz, ox * 0.6, rand(2.6, 4.2), oz * 0.6, rand(0.12, 0.21), rand(0.22, 0.42), Math.random() < 0.3 ? col('#c9e4ff') : c, -0.5, 0.8, 0); }
        break;
      case 'crown': // a slowly turning crown of light, with a soft gold glow
        for (let i = 0; i < 2; i++) if (often(55)) { const k = Math.floor(Math.random() * 8), b = k * TAU / 8 + t * 0.9, r = 0.34; this.glow.spawn(x + Math.cos(b) * r, y + 2.28 + (k % 2) * 0.14, z + Math.sin(b) * r, 0, 0.04, 0, 0.12, 0.22, col(k % 2 ? '#ffffff' : '#ffd54a'), 0, 3, 0); }
        this.aura(p, '#ffe9a8', dt * 0.45);
        break;
      default: this.aura(p, f.color, dt);
    }
  },
  /* glowing block paths (Vision) */
  pathBegin() { this.pathN = 0; },
  pathLine(a, b, hex, step = 1.1, t = 0) {
    const d = dist2D(a, b), n = Math.min(60, Math.floor(d / step));
    const c = col(hex);
    for (let i = 1; i <= n; i++) {
      if (this.pathN >= 260) return;
      const k = i / (n + 1);
      const x = lerp(a.x, b.x, k), z = lerp(a.z, b.z, k), y = lerp(a.y, b.y, k) + Math.sin(t * 6 + i * 0.7) * 0.05;
      _m1.makeRotationY(t * 2 + i); _m1.setPosition(x, y, z);
      this.paths.setMatrixAt(this.pathN, _m1);
      this.paths.setColorAt(this.pathN, c);
      this.pathN++;
    }
  },
  pathEnd() { this.paths.count = this.pathN; this.paths.instanceMatrix.needsUpdate = true; if (this.paths.instanceColor) this.paths.instanceColor.needsUpdate = true; },
};

const Shake = {
  trauma: 0, x: 0, y: 0, t: 0,
  add(a) { this.trauma = Math.min(1, this.trauma + a); },
  update(dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const s = this.trauma * this.trauma * 0.55;
    this.x = s * (Math.sin(this.t * 47.3) * 0.6 + Math.sin(this.t * 91.7) * 0.4);
    this.y = s * (Math.sin(this.t * 53.1 + 1.7) * 0.6 + Math.sin(this.t * 77.9) * 0.4);
  },
};

const TimeCtl = {
  hit: 0, slowT: 0, slowScale: 1, slowDur: 1,
  reset() { this.hit = 0; this.slowT = 0; this.slowScale = 1; },
  hitStop(s) { this.hit = Math.max(this.hit, s); },
  slowMo(scale, dur) {
    if (this.slowT > 0) this.slowScale = Math.min(this.slowScale, scale); else this.slowScale = scale;
    this.slowT = Math.max(this.slowT, dur); this.slowDur = this.slowT;
  },
  get scale() {
    if (this.slowT <= 0) return 1;
    const tail = Math.min(0.35, this.slowDur * 0.4);
    if (this.slowT < tail) return lerp(1, this.slowScale, this.slowT / tail);
    return this.slowScale;
  },
  step(realDt) {
    if (this.hit > 0) { this.hit -= realDt; return 0; }
    const s = this.scale;
    if (this.slowT > 0) this.slowT -= realDt;
    return realDt * s;
  },
};
