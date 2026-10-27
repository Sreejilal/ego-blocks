/* =====================================================================
   AI: team shape, pressing, marking, runs, carrier decisions, keepers
   ===================================================================== */
const AI = {
  update(m, dt) {
    m.aiTeamT = (m.aiTeamT || 0) - dt;
    if (m.aiTeamT <= 0) { m.aiTeamT = 0.18; this.predict(m); this.assign(m, 0); this.assign(m, 1); }
    for (const p of m.players) {
      if (p.isHuman && !m.autopilot) continue;
      if (p.isGK) this.keeper(m, p, dt);
      else this.outfield(m, p, dt);
    }
  },
  predict(m) {
    const b = m.ball, pts = m.pred; pts.length = 0;
    let x = b.pos.x, y = b.pos.y, z = b.pos.z, vx = b.vel.x, vy = b.vel.y, vz = b.vel.z, st = b.straightT;
    let cx = b.curve.x, cz = b.curve.z;
    const h = 0.05;
    if (b.owner) { pts.push({ x, y, z, t: 0 }); return; }
    for (let i = 1; i <= 56; i++) {
      if (st > 0) st -= h; else vy -= BALL_G * h;
      vx += cx * h; vz += cz * h;
      if (b.curveDecay > 0) { const k = Math.exp(-h / b.curveDecay); cx *= k; cz *= k; }
      x += vx * h; y += vy * h; z += vz * h;
      if (y < BALL_R) {
        y = BALL_R; st = 0;
        if (vy < -2.2) { vy = -vy * 0.52; vx *= 0.88; vz *= 0.88; }
        else { vy = 0; cx *= 0.7; cz *= 0.7; const hs = Math.hypot(vx, vz); if (hs > 0) { const k = Math.max(0, hs - (ROLL_A + ROLL_B * hs) * h) / hs; vx *= k; vz *= k; } }
      }
      if (Math.abs(x) > F.BOARD_X || Math.abs(z) > F.BOARD_Z) break;
      if (i % 2 === 0) pts.push({ x, y, z, t: i * h });
    }
  },
  interceptPoint(m, p, maxH = 1.6) {
    const sp = SPRINT_SPEED * p.mods.speed * 0.92, pts = m.pred;
    if (p.fx.skyTrap > 0) maxH = 3.3;
    for (const q of pts) {
      if (q.y > maxH) continue;
      const d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z) - 0.75;
      if (d / sp <= q.t + 0.05) return V3(q.x, 0, q.z);
    }
    if (pts.length) { const l = pts[pts.length - 1]; return V3(l.x, 0, l.z); }
    return V3(m.ball.pos.x, 0, m.ball.pos.z);
  },
  interceptTime(m, p) {
    const b = m.ball;
    if (b.owner) return dist2D(p.pos, b.pos) / SPRINT_SPEED;
    const sp = SPRINT_SPEED * p.mods.speed * 0.92;
    for (const q of m.pred) {
      if (q.y > 1.6) continue;
      const d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z) - 0.75;
      if (d / sp <= q.t + 0.05) return q.t;
    }
    const l = m.pred.length ? m.pred[m.pred.length - 1] : b.pos;
    return 2.8 + Math.hypot(l.x - p.pos.x, l.z - p.pos.z) / sp;
  },
  assign(m, team) {
    const mates = m.teams[team], opps = m.teams[1 - team], b = m.ball, owner = b.owner;
    const st = owner ? (owner.team === team ? 'att' : 'def') : 'loose';
    m.teamState[team] = st;
    const field = mates.filter((p) => !p.isGK && (!p.isHuman || m.autopilot));
    for (const p of field) { p.ai.task = 'pos'; p.ai.mark = null; }
    const humanHere = m.human && m.human.team === team && !m.autopilot ? m.human : null;
    if (st === 'loose') {
      let best = null, bt = 1e9, second = null, st2 = 1e9;
      for (const p of mates) {
        if (p.isGK || p.state === 'down' || p.state === 'frozen') continue;
        const t = this.interceptTime(m, p);
        if (t < bt) { second = best; st2 = bt; best = p; bt = t; } else if (t < st2) { second = p; st2 = t; }
      }
      if (best && field.includes(best)) best.ai.task = 'chase';
      // a second runner joins when the ball is in our half or the first chaser is the human
      if (second && field.includes(second) && (best === humanHere ? st2 < bt + 1.2 : (m.prog(team, b.pos) < -8 && st2 < bt + 0.6))) second.ai.task = 'chase';
    } else if (st === 'def') {
      const sorted = field.slice().sort((a, c) => dist2D(a.pos, owner.pos) - dist2D(c.pos, owner.pos));
      const humanPress = humanHere && dist2D(humanHere.pos, owner.pos) < 3.5;
      if (sorted[0]) sorted[0].ai.task = humanPress ? 'cover' : 'press';
      const danger = (o) => -Math.hypot(o.pos.x, m.ownGoalZ(team) - o.pos.z);
      const threats = opps.filter((o) => !o.isGK && o !== owner).sort((a, c) => danger(c) - danger(a));
      const free = field.filter((p) => p.ai.task === 'pos');
      for (const t of threats) {
        if (!free.length) break;
        let bi = 0, bd = 1e9;
        free.forEach((p, i) => { const d = dist2D(p.pos, t.pos); if (d < bd) { bd = d; bi = i; } });
        const p = free.splice(bi, 1)[0]; p.ai.task = 'mark'; p.ai.mark = t;
      }
    }
  },
  context(m, p) {
    const b = m.ball, owner = b.owner, s = m.dir(p.team);
    const c = p.ai.ctx || (p.ai.ctx = {});
    c.hasBall = owner === p;
    c.mateHasBall = !!owner && owner.team === p.team && owner !== p;
    c.carrierOpp = !!owner && owner.team !== p.team;
    c.defending = c.carrierOpp || (!owner && b.lastTeam >= 0 && b.lastTeam !== p.team);
    const gz = m.oppGoalZ(p.team);
    c.dGoal = Math.hypot(p.pos.x, gz - p.pos.z);
    c.dOwnGoal = Math.hypot(p.pos.x, m.ownGoalZ(p.team) - p.pos.z);
    const a1 = Math.atan2(-F.GW + 0.4 - p.pos.x, gz - p.pos.z), a2 = Math.atan2(F.GW - 0.4 - p.pos.x, gz - p.pos.z);
    c.angle = Math.abs(wrapA(a2 - a1));
    c.angleOK = c.angle > 0.2 && m.prog(p.team, p.pos) < F.L - 1;
    const gdx = -p.pos.x, gdz = gz - p.pos.z, gl = Math.hypot(gdx, gdz) || 1;
    let near = 99, nearFront = 99, behind = 99;
    c.oppNearBall = 0;
    for (const o of m.opponents(p)) {
      if (o.state === 'down' || o.state === 'frozen') continue;
      const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (!o.isGK) near = Math.min(near, d);
      const dot = (dx * gdx + dz * gdz) / gl / (d || 1);
      if (dot > 0.3 && d < nearFront && !o.isGK) nearFront = d;
      if (dot < -0.2 && d < behind) behind = d;
      if (dist2D(o.pos, b.pos) < 6) c.oppNearBall++;
    }
    c.nearOpp = near; c.pressure = near; c.oppInFront = nearFront < 4.5; c.spaceAhead = nearFront > 7.5; c.open = near;
    c.chasedBy = c.hasBall && behind < 4;
    c.ballDist = dist2D(b.pos, p.pos);
    c.looseDist = owner ? 99 : c.ballDist;
    c.carrierDist = c.carrierOpp ? dist2D(owner.pos, p.pos) : 99;
    if (c.carrierOpp) { const dx = owner.pos.x - p.pos.x, dz = owner.pos.z - p.pos.z; c.carrierInFront = (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / (c.carrierDist || 1) > 0.55; } else c.carrierInFront = false;
    c.chasing = p.ai.task === 'chase'; c.chaseDist = c.ballDist;
    c.highBallNear = !owner && b.pos.y > 1.5 && c.ballDist < 8 && b.vel.y < 5;
    c.progAhead = owner ? m.prog(p.team, p.pos) - m.prog(p.team, owner.pos) : 0;
    c.goodPass = false; c.runnerAhead = false; c.bestPass = null;
    if (c.hasBall) {
      c.bestPass = this.bestPass(m, p, m.skill(p));
      c.goodPass = !!c.bestPass && c.bestPass.score > 5;
      c.runnerAhead = !!this.bestRunner(m, p);
    }
    return c;
  },
  outfield(m, p, dt) {
    const a = p.ai, b = m.ball;
    a.abilIn -= dt;
    if (a.runT > 0) a.runT -= dt;
    if (m.phase === 'goal' || m.phase === 'end') {
      const f = this.formation(m, p, 'loose');
      a.target.set(f.x, 0, f.z); a.sprint = false; this.steer(m, p, dt, 0.6); return;
    }
    if (m.phase === 'out') {
      const f = this.formation(m, p, m.restart && m.restart.team === p.team ? 'att' : 'def');
      a.target.set(f.x, 0, f.z); a.sprint = false; this.steer(m, p, dt); return;
    }
    if (p.state !== 'free') { if (p.state !== 'dash') { p.mx = 0; p.mz = 0; } return; }
    if (a.waitT > 0) a.waitT -= dt;
    // a teammate called for it: look up for a moment (the thinking bubble), shield the ball, then pick the pass
    if (a.look) {
      if (b.owner !== p) a.look = null;
      else {
        a.look.t -= dt;
        if (a.look.t <= 0) { a.look = null; this.callPass(m, p); return; }
        this.steer(m, p, dt, 0.45);
        return;
      }
    }
    if (a.dodgeIn > 0) {
      a.dodgeIn -= dt;
      if (a.dodgeIn <= 0) {
        a.dodgeIn = -1;
        const t = a.dodgeFrom;
        if (t && b.owner === p) {
          const dx = p.pos.x - t.pos.x, dz = p.pos.z - t.pos.z, l = len2D(dx, dz) || 1;
          let sx = -dz / l, sz = dx / l;
          const s = m.dir(p.team);
          if ((sx * (-p.pos.x) + sz * (s * F.L - p.pos.z)) < 0) { sx = -sx; sz = -sz; }
          m.dodge(p, sx * 0.8 + 0.2 * Math.sin(p.yaw), sz * 0.8 + 0.2 * Math.cos(p.yaw));
          return;
        }
      }
    }
    a.think -= dt;
    if (a.think <= 0) { a.think = lerp(0.34, 0.14, m.skill(p)) * rand(0.8, 1.25); this.decide(m, p); }
    if (a.wantShot) {
      if (b.owner !== p || p.state !== 'free') { a.wantShot = null; p.charging = false; p.charge = 0; }
      else {
        a.wantShot.at -= dt; p.charging = true; p.charge = Math.min(1, p.charge + dt / 0.9);
        if (a.wantShot.at <= 0) { const w = a.wantShot; a.wantShot = null; p.charging = false; p.charge = 0; m.shootAt(p, w.t, w.power); return; }
      }
    }
    if (a.task === 'press' || (a.task === 'chase' && b.owner && b.owner.team !== p.team) || p.fx.lockdown > 0) this.tryTackle(m, p, dt);
    this.steer(m, p, dt);
  },
  decide(m, p) {
    const sk = m.skill(p), c = this.context(m, p), a = p.ai;
    if (a.abilIn <= 0 && m.phase === 'play') {
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      for (const i of order) {
        const ab = p.abil[i];
        if (ab.cd > 0) continue;
        if (ab.def.ai(p, m, c) && chance(0.3 + 0.5 * sk)) {
          if (m.useAbility(p, i)) { a.abilIn = rand(1.2, 3.2) * (1.6 - sk); if (p.state !== 'free' || m.ball.owner !== p && c.hasBall) return; break; }
        }
      }
    }
    if (p.flow >= 100 && p.flowT <= 0 && ((c.hasBall && c.dGoal < 32) || (c.defending && c.carrierDist < 10)) && chance(0.5)) m.activateFlow(p);
    if (p.item && ITEMS[p.item].ai(p, m, c) && chance(0.55)) m.useItem(p);
    if (p.state !== 'free') return;
    if (m.ball.owner === p) this.decideCarrier(m, p, c, sk);
    else this.decideOff(m, p, c, sk);
  },
  decideCarrier(m, p, c, sk) {
    const a = p.ai;
    if (a.wantShot) return;
    const h = m.caller;
    if (m.thinkPass && h && h !== p && h.team === p.team && h.callT > 0 && !(a.waitT > 0) && !(c.dGoal < 9 && c.angleOK)) {
      // longer under pressure: it takes a moment to find the pass with someone on your back
      const pr = clamp((5 - c.pressure) / 4, 0, 1), t = lerp(0.3, 0.9, pr) * rand(0.9, 1.1);
      a.look = { t };
      m.label(p, '...', '#f5efe0', t + 0.05);
      a.target.set(p.pos.x + Math.sin(p.yaw) * 3, 0, p.pos.z + Math.cos(p.yaw) * 3); a.sprint = false;
      return;
    }
    const range = 12 + 9 * sk + (p.flowT > 0 ? 3 : 0);
    if (c.dGoal < range && c.angleOK) {
      const pShoot = clamp((range - c.dGoal) / range * 1.3 + (c.pressure < 2.6 ? 0.25 : 0) + (c.dGoal < 9 ? 0.4 : 0), 0.1, 0.97);
      if (chance(pShoot)) { this.shoot(m, p, c, sk); return; }
    }
    if (c.dGoal >= range && c.dGoal < 30 && c.angleOK && chance(0.025 + 0.04 * sk)) { this.shoot(m, p, c, sk); return; }
    const bp = c.bestPass;
    let keep = (c.spaceAhead ? 6 : 2) + (c.dGoal < 20 ? 2 : 0) - (c.pressure < 2.6 ? 4.5 : 0) - (c.chasedBy ? 1.5 : 0);
    if (p.isGK) keep = -10;
    if (bp && (bp.score > keep + 2.5 || (c.pressure < 2.6 && bp.score > keep - 2 && chance(0.55)))) {
      m.passTo(p, bp.mate, { lob: bp.blocked || bp.d > 24 });
      return;
    }
    // dribble: head for goal, slide around defenders, stay off the lines
    const gz = m.oppGoalZ(p.team);
    let dx = -p.pos.x * 0.6, dz = gz - p.pos.z;
    let l = len2D(dx, dz) || 1; dx /= l; dz /= l;
    let ax = dx, az = dz;
    for (const o of m.opponents(p)) {
      if (o.state === 'down') continue;
      const ox = o.pos.x - p.pos.x, oz = o.pos.z - p.pos.z, d = Math.hypot(ox, oz);
      if (d > 7 || d < 0.01) continue;
      const ahead = (ox * dx + oz * dz) / d;
      if (ahead < -0.3) continue;
      const w = (7 - d) / 7 * 1.7;
      const side = (ox * -dz + oz * dx) > 0 ? -1 : 1; // perpendicular away
      ax += -dz * side * w; az += dx * side * w;
    }
    if (Math.abs(p.pos.x) > F.W - 4) ax += -sgn(p.pos.x) * 1.4;
    const pz = m.prog(p.team, p.pos);
    if (pz > F.L - 5) { az -= m.dir(p.team) * 1.2; ax += -sgn(p.pos.x) * 0.8; }
    l = len2D(ax, az) || 1; ax /= l; az /= l;
    a.target.set(p.pos.x + ax * 6, 0, p.pos.z + az * 6);
    a.sprint = c.spaceAhead && p.stamina > 25;
  },
  /** the pass after a call: hold it if you are tightly marked, a through ball into your run,
      a lob over a defender in the lane, a ground pass, or now and then something flashy */
  callPass(m, p) {
    const h = m.caller, sk = m.skill(p), opps = m.opponents(p), s = m.dir(p.team);
    let mark = 99; for (const o of opps) if (!o.isGK && o.state !== 'down' && o.state !== 'frozen') mark = Math.min(mark, dist2D(o.pos, h.pos));
    if (mark < 1.8 || (h.state !== 'free' && h.state !== 'dash')) { m.label(p, 'WAIT', '#ffcb3d'); p.ai.waitT = 0.8; h.callT = 0; return false; } // call again once you are free
    const d = dist2D(p.pos, h.pos);
    let blocked = false;
    for (const o of opps) { const sd = segDist2D(o.pos, p.pos, h.pos); if (sd.t > 0.1 && sd.t < 0.92 && sd.d < 1.4) { blocked = true; break; } }
    const run = h.vel.z * s, speed = len2D(h.vel.x, h.vel.z);
    let space = 99;
    for (const o of opps) { if (o.isGK) continue; const ahead = (o.pos.z - h.pos.z) * s; if (ahead > 0 && ahead < 12) space = Math.min(space, dist2D(o.pos, h.pos)); }
    if (run > 4.5 && speed > 6 && space > 4 && !blocked && m.prog(p.team, h.pos) < F.L - 8) { m.throughBall(p, h); m.label(p, 'THROUGH BALL', p.aura); return true; }
    if (!blocked && mark > 3 && d > 5 && d < 20 && chance(0.12 + 0.12 * sk)) {
      const dx = h.pos.x - p.pos.x, dz = h.pos.z - p.pos.z, behind = (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / (d || 1) < -0.4;
      const style = behind && d < 14 ? 'backheel' : pick(['outside', 'rabona', 'nolook']);
      if (m.passTo(p, h, { style })) { m.label(p, { backheel: 'BACKHEEL!', outside: 'OUTSIDE BOOT!', rabona: 'RABONA!', nolook: 'NO LOOK!' }[style], p.aura); return true; }
    }
    return m.passTo(p, h, { lob: blocked || d > 26 });
  },
  shoot(m, p, c, sk) {
    const t = this.shotTarget(p, m, sk);
    const power = clamp(0.48 + c.dGoal / 30, 0.55, 1);
    p.ai.wantShot = { t, power, at: rand(0.1, 0.24) + (1 - sk) * 0.12 };
    p.charging = true; p.charge = 0;
  },
  shotTarget(p, m, sk) {
    if (sk == null) sk = m.skill(p);
    const gz = m.oppGoalZ(p.team), gk = m.teams[1 - p.team][0];
    const side = gk.pos.x > 0.5 ? -1 : gk.pos.x < -0.5 ? 1 : (chance(0.5) ? 1 : -1);
    let x = side * rand(2.0, F.GW - 0.55), y = rand(0.45, 2.3);
    const err = (1 - sk) * 2.1 + 0.4;
    x += rand(-err, err); y += rand(-err * 0.45, err * 0.45);
    return V3(x, clamp(y, 0.3, 3.8), gz);
  },
  bestShotPoint(m, p) {
    const gz = m.oppGoalZ(p.team), gk = m.teams[1 - p.team][0];
    const side = gk.pos.x > 0 ? -1 : 1;
    return V3(side * (F.GW - 0.85), 0.9, gz);
  },
  bestPass(m, p, sk) {
    let best = null;
    const opps = m.opponents(p), myProg = m.prog(p.team, p.pos);
    for (const t of m.teams[p.team]) {
      if (t === p || (t.state !== 'free' && t.state !== 'dash')) continue;
      if (t.isGK && myProg > -12) continue;
      const d = dist2D(p.pos, t.pos);
      if (d < 4 || d > 44) continue;
      const prog = m.prog(t.team, t.pos) - myProg;
      let open = 9; for (const o of opps) open = Math.min(open, dist2D(o.pos, t.pos));
      let blocked = false;
      for (const o of opps) { const sd = segDist2D(o.pos, p.pos, t.pos); if (sd.t > 0.08 && sd.t < 0.95 && sd.d < 1.5) { blocked = true; break; } }
      let score = prog * 0.5 + open * 1.1 - d * 0.08 - (blocked ? 8 : 0) - (open < 1.8 ? 6 : 0); // a defender right on them: hold it instead
      if (t.isHuman || t === m.caller) score += 3 + (t.callT > 0 ? 9 : 0) + (t.fx.call > 0 ? 30 : 0);
      if (t.ai.runT > 0) score += 3;
      if (m.prog(t.team, t.pos) > F.L - 12 && Math.abs(t.pos.x) < 10) score += 3;
      score += rand(-1.5, 1.5) * (1 - sk);
      if (!best || score > best.score) best = { mate: t, score, d, blocked };
    }
    return best;
  },
  bestRunner(m, p) {
    let best = null, bs = -1e9;
    const myProg = m.prog(p.team, p.pos);
    for (const t of m.teams[p.team]) {
      if (t === p || t.isGK || t.state !== 'free') continue;
      const prog = m.prog(t.team, t.pos) - myProg;
      if (prog < 3) continue;
      let open = 9; for (const o of m.opponents(p)) open = Math.min(open, dist2D(o.pos, t.pos));
      const sc = prog * 0.4 + open + (t.ai.runT > 0 ? 4 : 0) + (t.isHuman ? 2 : 0);
      if (open > 2.5 && sc > bs) { bs = sc; best = t; }
    }
    return best;
  },
  /** where a bot stands for its role. Worked out on the first pitch's scale, then stretched to this one */
  formation(m, p, st) {
    const s = m.dir(p.team), bu = m.ball.pos.x * s / PITCH_KX, bv = m.ball.pos.z * s / PITCH_KZ;
    let u, v;
    const r = p.role;
    if (st === 'att') {
      if (r === 'DEF') { u = bu * 0.3; v = clamp(bv - 13, -24, 6); }
      else if (r === 'MID') { u = bu > 0 ? -8 : 8; v = clamp(bv - 1, -12, 20); } // the spare runner offers width on the far side
      else if (r === 'LW') { u = 12.5; v = clamp(bv + 5, -6, 25); }
      else if (r === 'RW') { u = -12.5; v = clamp(bv + 5, -6, 25); }
      else { u = clamp(-bu * 0.35, -7, 7); v = clamp(bv + 9, 2, 26); }
    } else {
      if (r === 'DEF') { u = bu * 0.5; v = clamp(bv - 7, -29, -6); }
      else if (r === 'MID') { u = bu * 0.45; v = clamp(bv - 6, -26, 4); }
      else if (r === 'LW') { u = clamp(bu * 0.4 + 7, -14, 15); v = clamp(bv - 4, -24, 8); }
      else if (r === 'RW') { u = clamp(bu * 0.4 - 7, -15, 14); v = clamp(bv - 4, -24, 8); }
      else { u = bu * 0.3; v = clamp(bv + 3, -4, 12); }
    }
    const a = p.ai;
    a.offT -= 0.2;
    if (a.offT <= 0) { a.offT = rand(10, 20); a.offU = rand(-2.5, 2.5); a.offV = rand(-2.5, 2.5); }
    u = clamp((u + a.offU) * PITCH_KX, -F.W + 1.5, F.W - 1.5); v = clamp((v + a.offV) * PITCH_KZ, -F.L + 2, F.L - 2);
    return { x: u * s, z: v * s };
  },
  decideOff(m, p, c, sk) {
    const a = p.ai, b = m.ball, s = m.dir(p.team);
    let tgt = null, sprint = false;
    const k = b.kick;
    if (!b.owner && k && k.type === 'pass' && k.to === p) { tgt = k.passPoint && a.runT > 0 ? k.passPoint : this.interceptPoint(m, p); sprint = true; }
    else if (a.runT > 0 && a.runTo) { tgt = a.runTo; sprint = true; }
    else {
      switch (a.task) {
        case 'chase': tgt = this.interceptPoint(m, p, p.fx.skyTrap > 0 ? 3.3 : 1.6); sprint = true; break;
        case 'press': {
          const o = b.owner;
          if (o) {
            const g = m.ownGoalZ(p.team), gx = -o.pos.x, gzz = g - o.pos.z, gl = Math.hypot(gx, gzz) || 1;
            tgt = V3(o.pos.x + gx / gl * 1.0 + o.vel.x * 0.25, 0, o.pos.z + gzz / gl * 1.0 + o.vel.z * 0.25);
            sprint = dist2D(o.pos, p.pos) > 2.5 || sk > 0.6;
          }
          break;
        }
        case 'cover': {
          const o = b.owner;
          if (o) { const g = m.ownGoalZ(p.team), gx = -o.pos.x, gzz = g - o.pos.z, gl = Math.hypot(gx, gzz) || 1; tgt = V3(o.pos.x + gx / gl * 5, 0, o.pos.z + gzz / gl * 5); sprint = true; }
          break;
        }
        case 'mark': {
          const o = a.mark;
          if (o) {
            const g = m.ownGoalZ(p.team), gx = -o.pos.x * 0.6 - o.pos.x * 0.0, gzz = g - o.pos.z, gl = Math.hypot(gx, gzz) || 1;
            const tight = 1.6 + (1 - sk) * 1.4;
            tgt = V3(o.pos.x + gx / gl * tight, 0, o.pos.z + gzz / gl * tight);
            sprint = dist2D(tgt, p.pos) > 3;
          }
          break;
        }
      }
      if (!tgt) {
        const st = m.teamState[p.team];
        const f = this.formation(m, p, st);
        tgt = V3(f.x, 0, f.z); sprint = dist2D(tgt, p.pos) > 9;
        if (st === 'att' && p.role !== 'DEF' && a.runT <= 0 && chance(0.06 + 0.1 * sk)) {
          const bv = m.prog(p.team, b.pos);
          const v = clamp(bv + rand(10, 16) * PITCH_KZ, -5, F.L - 5);
          const u = clamp(p.pos.x * s * 0.7 + rand(-5, 5), -F.W + 3, F.W - 3);
          a.runTo = V3(u * s, 0, v * s); a.runT = rand(1.8, 2.8);
          tgt = a.runTo; sprint = true;
        }
      }
    }
    // interceptions: step into a passing lane we can reach
    if (!b.owner && k && k.type === 'pass' && k.to && k.to.team !== p.team && a.task !== 'chase') {
      const it = this.interceptTime(m, p);
      if (it < 0.9 + sk * 0.5) { tgt = this.interceptPoint(m, p); sprint = true; }
    }
    if (!b.owner && c.ballDist < 4.5 && b.pos.y < 1.6 && !(k && k.type === 'pass' && k.to && k.to.team === p.team && k.to !== p)) { tgt = this.interceptPoint(m, p); sprint = true; }
    if (p === m.caller && c.mateHasBall && p.callT <= 0 && chance(0.05)) p.callT = 1.6; // test caller: calls like a human, open or not
    if (c.mateHasBall && c.open > 5 && c.progAhead > 3 && p.callT <= 0 && chance(0.12)) {
      p.callT = 1.2;
      if (m.human && p.team === m.human.team) m.label(p, '!', '#2ee38f');
    }
    a.target.set(tgt.x, 0, tgt.z); a.sprint = sprint && p.stamina > 12;
  },
  tryTackle(m, p, dt) {
    const c = m.ball.owner;
    if (!c || c.team === p.team || p.tackleCd > 0 || p.state !== 'free') return;
    if (c.isGK && c.state === 'hold') return;
    const d = dist2D(c.pos, p.pos), sk = m.skill(p);
    const trig = (2.2 + 0.6 * sk) * p.mods.tackleRange;
    const away = d > 0.01 ? (c.vel.x * (c.pos.x - p.pos.x) + c.vel.z * (c.pos.z - p.pos.z)) / d : 0;
    if (away > 5.5 && d > 1.4 && chance(0.4 + 0.5 * sk)) return;
    if (d < trig && d > 0.5 && Math.random() < (1.0 + 3.0 * sk) * dt) {
      const lead = 0.14;
      m.tackle(p, c.pos.x + c.vel.x * lead - p.pos.x, c.pos.z + c.vel.z * lead - p.pos.z);
    }
  },
  reactTackle(m, c, t) {
    const sk = m.skill(c);
    if (c.dodgeCharges < 1 || c.stamina < 8 || c.state !== 'free') return;
    if (!chance(0.1 + 0.32 * sk)) return;
    c.ai.dodgeIn = rand(0.05, 0.2 - 0.08 * sk); c.ai.dodgeFrom = t;
  },
  steer(m, p, dt, speedK = 1) {
    const a = p.ai, b = m.ball;
    const dx = a.target.x - p.pos.x, dz = a.target.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.3) { const k = (d < 1.5 ? d / 1.5 : 1) * speedK; p.mx = dx / d * k; p.mz = dz / d * k; }
    else { p.mx = 0; p.mz = 0; }
    p.sprint = a.sprint;
    if (a.wantShot) p.faceYaw = yawTo(p.pos, a.wantShot.t);
    else if (d < 0.7 && b.owner !== p) p.faceYaw = yawTo(p.pos, b.pos);
    else p.faceYaw = null;
  },
  /* ---------- keepers ---------- */
  keeper(m, p, dt) {
    const a = p.ai, b = m.ball, s = m.dir(p.team), gz = m.ownGoalZ(p.team), sk = m.skill(p);
    if (m.phase !== 'play') {
      if (p.state === 'free' || p.state === 'hold') { a.target.set(0, 0, gz + s * 1.3); a.sprint = false; this.steer(m, p, dt, 0.7); }
      return;
    }
    if (p.state === 'hold') {
      p.mx = 0; p.mz = 0; p.faceYaw = s > 0 ? 0 : Math.PI;
      a.holdT -= dt;
      if (a.holdT <= 0) this.distribute(m, p);
      return;
    }
    if (p.state !== 'free') { p.mx = 0; p.mz = 0; return; }
    // 1) shots coming at goal
    if (!b.owner && b.vel.z * s < -5) {
      const t = (gz - b.pos.z) / b.vel.z;
      if (t > 0 && t < 1.8) {
        const px = b.pos.x + b.vel.x * t + 0.5 * b.curve.x * t * t;
        let py = b.straightT > 0 ? b.pos.y + b.vel.y * t : b.pos.y + b.vel.y * t - 0.5 * BALL_G * t * t;
        if (py < BALL_R) py = BALL_R + Math.min(1.2, Math.abs(py) * 0.4);
        if (Math.abs(px) < F.GW + 1.0 && py < F.GH + 0.9) {
          if (a.react == null) a.react = lerp(0.3, 0.09, sk) * rand(0.8, 1.2);
          a.react -= dt;
          if (a.react <= 0) {
            const tk = Math.max(0.06, (p.pos.z - b.pos.z) / b.vel.z);
            const kx = b.pos.x + b.vel.x * tk + 0.5 * b.curve.x * tk * tk;
            let ky = b.straightT > 0 ? b.pos.y + b.vel.y * tk : b.pos.y + b.vel.y * tk - 0.5 * BALL_G * tk * tk;
            if (ky < BALL_R) ky = BALL_R;
            const dx = kx - p.pos.x;
            if (Math.abs(dx) > 0.75 || ky > 2.1) { this.dive(m, p, dx, ky, tk, sk); a.react = null; return; }
            a.target.set(kx, 0, p.pos.z); a.sprint = true; this.steer(m, p, dt); p.faceYaw = s > 0 ? 0 : Math.PI;
            return;
          }
        }
      }
    } else a.react = null;
    // 2) claim loose balls in the box
    if (!b.owner && m.inOwnBox(p, b.pos) && b.pos.y < 1.8) {
      const myT = this.interceptTime(m, p);
      let oppT = 99; for (const o of m.opponents(p)) oppT = Math.min(oppT, this.interceptTime(m, o));
      if (myT < oppT + 0.3) { const ip = this.interceptPoint(m, p); a.target.set(ip.x, 0, ip.z); a.sprint = true; this.steer(m, p, dt); return; }
    }
    // 3) narrow the angle; come off the line against a carrier
    const o = b.owner;
    let tx = clamp(b.pos.x * 0.36, -3.3, 3.3), tz = gz + s * 1.2;
    if (o && o.team !== p.team) {
      const dg = Math.hypot(o.pos.x, gz - o.pos.z);
      if (dg < 16) {
        const k = clamp((16 - dg) / 16, 0, 1) * (1.4 + 2.6 * sk);
        const dx = o.pos.x, dz = o.pos.z - gz, l = Math.hypot(dx, dz) || 1;
        tx = dx / l * k; tz = gz + dz / l * k;
      }
      if (dist2D(o.pos, p.pos) < 2.1 && p.tackleCd <= 0 && Math.random() < (0.6 + 2.2 * sk) * dt) m.tackle(p, o.pos.x - p.pos.x, o.pos.z - p.pos.z);
    }
    a.target.set(tx, 0, tz); a.sprint = dist2D(a.target, p.pos) > 3;
    this.steer(m, p, dt);
    p.faceYaw = yawTo(p.pos, b.pos);
  },
  dive(m, p, dx, ky, tk, sk) {
    const side = sgn(dx), dur = 0.36, rs = 10 + 6 * sk;
    const vx = clamp(dx / Math.max(0.16, Math.min(tk, dur)), -rs, rs);
    const s = m.dir(p.team);
    p.yaw = s > 0 ? 0 : Math.PI;
    const localX = side * Math.cos(p.yaw);
    p.dive = { vx, vz: 0, dur, rest: 0.6, side: sgn(localX), high: ky > 1.7, ux: side, uz: 0 };
    p.setState('dive');
    if (ky > 1.7) { p.vel.y = clamp((ky - 0.9) * 3.4, 3, 7.5); p.onGround = false; }
    Sfx.swoosh();
  },
  keeperBite(m, p) {
    const side = chance(0.5) ? 1 : -1;
    p.yaw = m.dir(p.team) > 0 ? 0 : Math.PI;
    p.dive = { vx: side * 10, vz: 0, dur: 0.32, rest: 0.75, side: sgn(side * Math.cos(p.yaw)), high: false, ux: side, uz: 0 };
    p.setState('dive');
    m.label(p, 'BIT', TEAM[p.team].hex);
  },
  distribute(m, p) {
    const opps = m.opponents(p);
    let best = null, bs = -1e9;
    for (const t of m.teams[p.team]) {
      if (t.isGK || t.state !== 'free') continue;
      let open = 9; for (const o of opps) open = Math.min(open, dist2D(o.pos, t.pos));
      const d = dist2D(t.pos, p.pos);
      const sc = open * 1.4 - d * 0.05 + (t.isHuman ? 2 : 0) + m.prog(t.team, t.pos) * 0.04 + rand(-1, 1);
      if (sc > bs) { bs = sc; best = t; }
    }
    p.setState('free');
    if (best) m.passTo(p, best, { lob: dist2D(best.pos, p.pos) > 15 });
    else { const s = m.dir(p.team); m.kick(p, rand(-4, 4), 11, s * 20, { type: 'clear' }); }
  },
};
