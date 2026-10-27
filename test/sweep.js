// Bug sweep: every screen at three sizes (errors, sideways scroll, clipped text, buttons off screen or on top of
// each other), then every mode played with keyboard, controller and touch input. Prints what it finds.
const { open } = require('./harness');
const issues = [];
const note = (where, what, info) => issues.push(where + ': ' + what + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sizes = [['desktop', { width: 1280, height: 720 }, false], ['phone-side', { width: 844, height: 390 }, true], ['phone-up', { width: 390, height: 844 }, true]];

// look at whatever is on screen right now
async function inspect(page, where) {
  const r = await page.evaluate(() => {
    const out = { overflowX: [], clipped: [], offscreen: [], overlap: [] };
    const vis = (el) => { if (el.closest('[hidden]')) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    for (const s of document.querySelectorAll('.screen, .overlay, .dialog')) if (vis(s) && s.scrollWidth > s.clientWidth + 1) out.overflowX.push(s.id || s.className);
    const btns = Array.from(document.querySelectorAll('#app button, #app .tab, #app [role=button]')).filter(vis);
    for (const b of btns) {
      if (b.scrollWidth > b.clientWidth + 2) out.clipped.push((b.id || b.className) + ':' + b.textContent.trim().slice(0, 24));
      const r = b.getBoundingClientRect();
      if (r.right > innerWidth + 1 || r.left < -1) out.offscreen.push((b.id || b.className) + ':' + b.textContent.trim().slice(0, 24));
    }
    for (const lb of document.querySelectorAll('#touch .tb .lb')) if (vis(lb) && lb.textContent && lb.scrollWidth > lb.clientWidth + 1) out.clipped.push('touch label:' + lb.textContent);
    // buttons covering each other (ignore ones inside the same button)
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], b = btns[j]; if (a.contains(b) || b.contains(a)) continue;
      const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
      const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (w > 4 && h > 4) out.overlap.push((a.id || a.className.split(' ')[0]) + ' x ' + (b.id || b.className.split(' ')[0]));
    }
    // text that spills out of its box
    for (const el of document.querySelectorAll('#app .nm, #app b, #app h2, #app h3, #app .label')) {
      if (!vis(el)) continue;
      const box = el.closest('.panel, .btn, .lcard, .card, .slot, .gp-t, .pf-skin, .kitbox');
      if (!box) continue;
      const e = el.getBoundingClientRect(), bx = box.getBoundingClientRect();
      if (e.right > bx.right + 3 || e.left < bx.left - 3) out.clipped.push('spill ' + (box.id || box.className.split(' ')[0]) + ':' + el.textContent.trim().slice(0, 24));
    }
    return out;
  });
  for (const k of ['overflowX', 'clipped', 'offscreen', 'overlap']) if (r[k].length) note(where, k, Array.from(new Set(r[k])).slice(0, 8));
}

(async () => {
  for (const [name, viewport, mobile] of sizes) {
    const { browser, page, logs } = await open({ wait: 1500, viewport, mobile });
    await page.evaluate(() => { EGO.Game.manual = true; const d = EGO.Save.data; d.emeralds = 5000; d.skins.push('MOHAWK', 'GOLD_CHAIN', 'BACKFLIP'); d.styles.push('THUNDER'); EGO.Save.save(); EGO.UI.renderLobby(); EGO.Game.stepManual(4, true); });
    await inspect(page, name + ' lobby');
    for (const scr of ['spins', 'locker', 'howto', 'profile', 'pass']) {
      await page.evaluate((s) => { if (s === 'spins') EGO.UI.openSpins(); else if (s === 'locker') EGO.UI.openLocker(); else EGO.UI.show(s); EGO.Game.stepManual(3, true); }, scr);
      await inspect(page, name + ' ' + scr);
      if (scr === 'spins') for (const k of ['flow', 'skin']) { await page.evaluate((k) => { EGO.UI.spinKind = k; EGO.UI.renderSpins(true); }, k); await inspect(page, name + ' spins/' + k); }
      if (scr === 'locker') for (const t of ['flow', 'skin', 'club']) {
        await page.evaluate((t) => { const U = EGO.UI; U.lockerTab = t; U.lockerSel = t === 'flow' ? 'NONE' : t === 'club' ? 'ROVERS' : EGO.Save.data.look[U.skinSlot]; U.renderLocker(); EGO.Game.stepManual(2, true); }, t);
        await inspect(page, name + ' locker/' + t);
      }
    }
    // a match: pause menu, then results
    await page.evaluate(() => { EGO.UI.show('lobby'); EGO.Game.startMatch('ranked'); EGO.Game.stepManual(60, true); });
    await inspect(page, name + ' hud');
    // every style's ability names on the touch buttons, and Lawless item names
    for (const sid of ['ROOKIE', 'SPRINTER', 'PHANTOM', 'TRICKSTER', 'ENFORCER', 'SHAMBLER', 'PROWLER', 'MAGNET', 'THUNDER', 'RAILGUN']) {
      await page.evaluate((sid) => { const d = EGO.Save.data; if (!d.styles.includes(sid)) d.styles.push(sid); d.style = sid; EGO.Game.startMatch('lawless'); EGO.Game.stepManual(4, true); }, sid);
      await inspect(page, name + ' touch/' + sid);
    }
    for (const it of ['fist', 'boom', 'slime', 'jet', 'snow', 'magnet', 'bubble', 'wall', 'mine', 'bolt']) {
      await page.evaluate((it) => { EGO.Game.match.human.item = it; EGO.Game.stepManual(2, true); }, it);
      await inspect(page, name + ' item/' + it);
    }
    await page.evaluate(() => { EGO.Save.data.style = 'ROOKIE'; EGO.Game.startMatch('ranked'); EGO.Game.stepManual(30, true); });
    await page.evaluate(() => { EGO.Game.pause(); });
    await inspect(page, name + ' pause');
    await page.evaluate(() => { EGO.Game.pausedAt = 0; EGO.Game.resume(); const m = EGO.Game.match; m.score = [2, 1]; m.human.stats.goals = 2; m.clock = 0.1; for (let i = 0; i < 60 * 20 && EGO.Game.state !== 'results'; i++) EGO.Game.stepManual(1, false); EGO.Game.stepManual(1, true); });
    await inspect(page, name + ' results');
    if (logs.length) note(name, 'console errors', logs.slice(0, 5));
    await browser.close();
  }

  // every mode, three ways to play
  const { browser, page, logs } = await open({ wait: 1500 });
  const modes = await page.evaluate(async () => {
    const out = [];
    const G = EGO.Game, I = EGO.Input;
    // a pretend controller the game can read
    let pad = null;
    navigator.getGamepads = () => [pad];
    const mkPad = () => ({ buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] });
    for (const mode of ['ranked', 'quick', 'lawless', 'koth', 'volleys', 'duel']) {
      for (const how of ['keys', 'pad', 'touch']) {
        G.toLobby(); EGO.Touch.setOn(how === 'touch'); pad = how === 'pad' ? mkPad() : null; I.usingPad = how === 'pad';
        G.startMatch(mode); G.manual = true;
        const m = G.match, h = m.human, c0 = m.clock;
        let shots = 0, err = null, moved = 0, last = h.pos.clone();
        try {
          for (let f = 0; f < 60 * 25; f++) {
            const t = f / 60;
            if (how === 'keys') {
              I.down.clear(); I.down.add(['KeyW', 'KeyA', 'KeyD', 'KeyS'][Math.floor(t / 1.3) % 4]); if (t % 3 < 1.5) I.down.add('ShiftLeft');
              if (f % 50 === 0) { I.mouseL = true; I.edges.add('Mouse0'); } if (f % 50 === 30) { I.mouseL = false; I.up.add('Mouse0'); }
              if (f % 90 === 45) I.edges.add('Mouse2'); if (f % 90 === 47) I.up.add('Mouse2');
              if (f % 120 === 10) I.edges.add(['KeyQ', 'KeyE', 'KeyR', 'KeyC', 'KeyF', 'Space', 'KeyG', 'KeyX'][(f / 120 | 0) % 8]);
              I.mdx = Math.sin(t) * 4;
            } else if (how === 'pad') {
              pad.axes[0] = Math.sin(t * 0.8); pad.axes[1] = -Math.cos(t * 0.5); pad.axes[2] = Math.sin(t * 0.3) * 0.5;
              pad.buttons[7] = { pressed: f % 50 < 30, value: f % 50 < 30 ? 1 : 0 };
              for (const b of [0, 1, 2, 3, 5, 12, 13, 14, 15]) pad.buttons[b] = { pressed: f % 120 === 10 + b * 7, value: 0 };
            } else {
              const T = EGO.Touch; T.stickId = 1; T.moveX = Math.sin(t * 0.7); T.moveY = Math.cos(t * 0.4); T.sprint = t % 4 < 2;
              if (f % 50 === 0) { T.held.add('shoot'); I.edges.add('T_shoot'); } if (f % 50 === 30) { T.held.delete('shoot'); I.up.add('T_shoot'); }
              if (f % 120 === 10) I.edges.add('T_' + ['ab0', 'ab1', 'ab2', 'dodge', 'tackle', 'jump', 'pass', 'flow', 'item'][(f / 120 | 0) % 9]);
              T.lookDX = Math.sin(t) * 3;
            }
            G.stepManual(1, f % 300 === 299);
            if (G.state !== 'match') { if (G.state === 'paused') { G.pausedAt = 0; G.resume(); } else if (G.state === 'replay') EGO.Replay.stop(); }
            moved += h.pos.distanceTo(last); last.copy(h.pos);
          }
          shots = h.stats.shots;
        } catch (e) { err = e.message; }
        I.down.clear(); EGO.Touch.stickId = null; EGO.Touch.held.clear();
        out.push({ mode, how, err, state: G.state, clockMoved: +(c0 - m.clock).toFixed(1), moved: Math.round(moved), shots, score: m.score.join('-') });
      }
    }
    G.toLobby(); EGO.Touch.setOn(false); pad = null;
    return out;
  });
  for (const r of modes) {
    if (r.err) note('play ' + r.mode + '/' + r.how, 'error', r.err);
    else if (r.moved < 20 || r.clockMoved < 10) note('play ' + r.mode + '/' + r.how, 'player or clock did not move', r);
  }
  console.log(modes.map((r) => JSON.stringify(r)).join('\n'));
  if (logs.length) note('play', 'console errors', logs.slice(0, 6));
  await browser.close();
  console.log('\nISSUES (' + issues.length + ')\n' + (issues.join('\n') || 'none'));
})().catch((e) => { console.error(e); process.exit(1); });
