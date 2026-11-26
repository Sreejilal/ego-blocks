// STORY scenes acted out in 3D (Movie, STORY_FILMS): every event's scenes are scripted with known actors, actions and
// shots; a scene really moves people, the ball and the camera; every scene of the story plays through without errors and
// puts the world back (look, crowd, models, camera); the scene after a win plays over the results and hides the match.
// node test/movie.js   (run `npm run build` first)
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

process.on('unhandledRejection', (e) => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
(async () => {
  const { browser, page, logs } = await open({ wait: 1500 });
  // ---- the scripts ----
  const lint = await page.evaluate(() => {
    const E = EGO, bad = [], verbs = ['walk', 'jog', 'run', 'sprint', 'dribble', 'glide', 'face', 'wait', 'emote', 'juggle', 'trap', 'shoot', 'kick', 'pass', 'slide', 'feint', 'fall', 'jump', 'glow', 'giant', 'join', 'hide', 'show', 'charge', 'glare'];
    const world = ['at', 'cheer', 'whistle', 'sfx', 'flash', 'boom', 'lightning', 'fireworks', 'confetti', 'ball', 'ballup', 'moon', 'goals', 'crowd', 'cores', 'snapfx', 'trophy', 'prop', 'give', 'drop', 'slow', 'impact', 'lines', 'panels', 'word', 'dark'];
    const shots = ['close', 'ots', 'two', 'low', 'orbit', 'track', 'follow', 'lead', 'wide', 'fly', 'goal', 'group', 'eyes', 'face', 'zoom', 'ballcam'];
    const layouts = ['cols3', 'rows3', 'rows2', 'band'];
    let films = 0, acts = 0;
    for (const ev of E.STORY_EVENTS) for (const part of ['intro', 'outro']) {
      const f = E.STORY_FILMS[ev.id] && E.STORY_FILMS[ev.id][part];
      if (!f) { bad.push(ev.id + ' ' + part + ': no film'); continue; }
      films++;
      const who = new Set([...Object.keys(f.set), ...ev[part].map((l) => l[0])]);
      if ((f.lines || []).length > ev[part].length) bad.push(ev.id + ' ' + part + ': more film lines than lines');
      const beats = [f.open, f.end, ...(f.lines || [])].filter(Boolean);
      for (const B of beats) {
        for (const s of [B.cam, ...(B.cams || []).map((c) => c[1])].filter(Boolean)) if (!shots.includes(s[0])) bad.push(ev.id + ': shot ' + s[0]);
        for (const a of B.do || []) {
          acts++;
          if (a[0] === '*') {
            const w = a[1] === 'at' ? a.slice(3) : a.slice(1);
            if (!world.includes(a[1]) || (a[1] === 'at' && !world.includes(w[0]))) bad.push(ev.id + ': world ' + w[0]);
            if (w[0] === 'panels') { if (!layouts.includes(w[1])) bad.push(ev.id + ': page ' + w[1]); for (const s of w[2] || []) if (!shots.includes(s[0]) || (s[1] && !who.has(s[1]))) bad.push(ev.id + ': panel ' + s.join(' ')); }
            if (w[0] === 'dark' && w[1] && !who.has(w[1])) bad.push(ev.id + ': dark ' + w[1]);
          }
          else if (!who.has(a[0])) bad.push(ev.id + ' ' + part + ': ' + a[0] + ' is not on stage');
          else if (!verbs.includes(a[1])) bad.push(ev.id + ': verb ' + a[1]);
        }
      }
    }
    return { films, acts, bad };
  });
  check('every story event has a scene before and after it, and every action and shot in them is a real one', lint.films === 24 && lint.acts > 150 && !lint.bad.length, lint);

  // ---- a scene really moves ----
  await page.evaluate(() => { EGO.Save.data.story.done = []; EGO.UI.show('story'); EGO.Cutscene.full = true; EGO.Cutscene.noAuto = true; });
  const seen0 = await page.evaluate(() => EGO.World.scene.children.length);
  await page.click('.st-ev.now [data-ev]');
  await page.waitForTimeout(2100); // the CHAPTER 1 card
  const s0 = await page.evaluate(() => {
    const M = EGO.Movie, G = EGO.Game, A = M.A;
    G.manual = true; G.stepManual(6, false);
    const b0 = M.ball.pos.y, cam0 = EGO.World.camera.position.clone();
    const ys = []; for (let i = 0; i < 12; i++) { G.stepManual(5, false); ys.push(M.ball.pos.y); }
    return { on: M.on, mv: document.getElementById('cutscene').classList.contains('mv'), body: document.body.classList.contains('movie'), cast: Object.keys(A).sort(), phase: EGO.Cutscene.phase, juggle: Math.max(...ys) - Math.min(...ys), camMoved: EGO.World.camera.position.distanceTo(cam0) > 0.05, place: document.getElementById('cs-pname').textContent, look: EGO.World.look };
  });
  check('PLAY on event 1: the 3D scene starts on the back pitch with you, the coach and their captain; you juggle and the camera flies in', s0.on && s0.mv && s0.body && s0.phase === 'open' && ['COACH', 'RIVAL', 'YOU'].every((k) => s0.cast.includes(k)) && s0.juggle > 0.5 && s0.camMoved && s0.place === 'THE BACK PITCH' && s0.look === 'sunset', s0);
  await page.evaluate(() => EGO.Game.stepManual(40, true));
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_open.png', timeout: 120000 }).catch(() => {});
  // ANIME MOMENTS in the opening: the eye close-up, the wind-up, the impact frame, slow motion and the trail of light
  const eyes = await page.evaluate(() => {
    const G = EGO.Game, M = EGO.Movie; let n = 0;
    while (M.shot.s[0] !== 'eyes' && n++ < 200) G.stepManual(1, false); // the chapter card ran on the real clock, so wait for the cut
    G.stepManual(8, true);
    const P = M.A.YOU.p.P, ol = M.olMat;
    let lines = 0; P.root.traverse((o) => { if (o.material === ol) lines++; });
    return { shot: M.shot.s[0], strip: document.getElementById('cutscene').classList.contains('strip'), glow: P.eyes.visible, glare: M.A.YOU.glare, speed: !document.getElementById('cs-speed').hidden, outlines: lines };
  });
  check('anime: the camera cuts to your eyes in a thin strip, they glow, speed lines round them, black lines round the players', eyes.shot === 'eyes' && eyes.strip && eyes.glow && eyes.glare && eyes.speed && eyes.outlines >= 6, eyes);
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_eyes.png', timeout: 120000 }).catch(() => {});
  const hit = await page.evaluate(() => {
    const G = EGO.Game, M = EGO.Movie, Y = M.A.YOU.p; let wound = 0, n = 0;
    while (!document.body.classList.contains('mv-hit') && n++ < 150) { G.stepManual(1, false); if (Y.charging) wound = Math.max(wound, Y.charge); }
    G.stepManual(1, true);
    return { n, wound: +wound.toFixed(2), hit: document.body.classList.contains('mv-hit') || document.body.classList.contains('mv-hit2'), frozen: M.ts === 0, power: !!M.ball.power, strip: document.getElementById('cutscene').classList.contains('strip') };
  });
  check('anime: you wind up, and when your boot hits the ball the picture flips to black and white and the action freezes', hit.n < 150 && hit.wound > 0.8 && hit.hit && hit.frozen && hit.power && !hit.strip, hit);
  await page.waitForTimeout(250); await page.screenshot({ path: __dirname + '/shots/movie_impact.png', timeout: 120000 }).catch(() => {});
  const slow = await page.evaluate(() => {
    const G = EGO.Game, M = EGO.Movie; G.stepManual(24, true);
    return { ts: +M.ts.toFixed(2), filter: document.body.classList.contains('mv-hit') || document.body.classList.contains('mv-hit2'), power: !!M.ball.power, fly: M.ball.fly, shot: M.shot.s[0] };
  });
  check('anime: then slow motion while the ball flies with its trail, filmed from behind the ball', slow.ts < 0.6 && !slow.filter && slow.power && slow.fly && slow.shot === 'ballcam', slow);
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_ballcam.png', timeout: 120000 }).catch(() => {});
  const shot = await page.evaluate(() => { const G = EGO.Game, M = EGO.Movie; G.stepManual(200, false); return { inNet: M.ball.inNet, z: +M.ball.pos.z.toFixed(1), ts: M.ts }; });
  check('the opening shot: your shot ends in the net and time is back to normal', shot.inNet && shot.z > 55 && shot.ts === 1, shot);
  await page.evaluate(() => EGO.Cutscene.next()); // the first line
  const l0 = await page.evaluate(() => {
    const G = EGO.Game, M = EGO.Movie, c = M.A.COACH.p, p0 = c.pos.clone();
    G.stepManual(90, false);
    return { name: document.getElementById('cs-name').textContent, face: !!document.querySelector('#cs-face canvas'), walked: +c.pos.distanceTo(p0).toFixed(2), speaker: M.speaker, shot: M.shot.s[0] };
  });
  check('line 1: COACH BRICK talks (portrait in the box) and walks over to you, filmed from the side', l0.name === 'COACH BRICK' && l0.face && l0.walked > 2 && l0.speaker === 'COACH' && l0.shot === 'two', l0);
  await page.evaluate(() => EGO.Game.stepManual(2, true));
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_line1.png', timeout: 120000 }).catch(() => {});
  const l3 = await page.evaluate(() => {
    const C = EGO.Cutscene, G = EGO.Game, M = EGO.Movie;
    for (let i = 0; i < 3; i++) { if (C.typing) C.finishLine(); G.stepManual(3, false); C.next(); G.stepManual(3, false); }
    const r = M.A.RIVAL.p, p0 = r.pos.clone(); G.stepManual(150, true);
    return { name: document.getElementById('cs-name').textContent, i: C.i, moved: +r.pos.distanceTo(p0).toFixed(1), coach: M.A.COACH.p.pos.distanceTo(M.A.YOU.p.pos) < 4.5 };
  });
  check('line 4: their captain jogs in and laughs; skipping lines left everyone where they should be', /CAPTAIN/.test(l3.name) && l3.i === 3 && l3.moved > 3 && l3.coach, l3);
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_rival.png', timeout: 120000 }).catch(() => {});
  const vs = await page.evaluate(() => { const C = EGO.Cutscene, G = EGO.Game; if (C.typing) C.finishLine(); G.stepManual(3, false); C.next(); G.stepManual(3, false); const ph1 = C.phase; C.next(); G.stepManual(3, true); return { ph1, ph2: C.phase, vs: !document.getElementById('cs-vs').hidden, text: document.getElementById('cs-vs').textContent.replace(/\s+/g, ' ').trim() }; });
  check('after the last line: the closing shot, then the VS card with the goal', vs.ph1 === 'end' && vs.ph2 === 'vs' && vs.vs && /VS/.test(vs.text) && /GOAL: WIN/.test(vs.text), vs);
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_vs.png', timeout: 120000 }).catch(() => {});
  await page.evaluate(() => EGO.Cutscene.next());
  const st = await page.evaluate(() => ({ state: EGO.Game.state, story: EGO.Game.match && EGO.Game.match.story && EGO.Game.match.story.id, on: EGO.Movie.on, body: document.body.classList.contains('movie') }));
  check('then the match starts and the scene is gone', st.state === 'match' && st.story === 'bp1' && !st.on && !st.body, st);

  // ---- every scene, start to finish ----
  const all = await page.evaluate(() => {
    const G = EGO.Game, C = EGO.Cutscene, M = EGO.Movie, errs = [], pics = {};
    if (G.match) { G.match.dispose(); G.match = null; } G.toLobby();
    const look0 = EGO.World.look, kids0 = EGO.World.scene.children.length;
    for (const ev of EGO.STORY_EVENTS) for (const part of ['intro', 'outro']) {
      let done = false;
      try {
        C.story(ev, part, () => { done = true; });
        if (C.phase === 'title') C.begin();
        G.stepManual(30, false);
        let guard = 0;
        while (!done && guard++ < 40) { if (C.typing) C.finishLine(); G.stepManual(40, false); C.next(); G.stepManual(40, false); }
        if (!done) errs.push(ev.id + ' ' + part + ' never ended');
      } catch (e) { errs.push(ev.id + ' ' + part + ': ' + e.message); C.end(); }
    }
    return { errs, look: EGO.World.look === look0, kids: EGO.World.scene.children.length - kids0, on: M.on, body: document.body.classList.contains('movie') };
  });
  check('all 24 scenes play through to the end, and afterwards the sky, the stage and the page are as before', !all.errs.length && all.look && all.kids <= 0 && !all.on && !all.body, all);

  // ---- WATCH: the scenes of an event you finished, again ----
  const watch = await page.evaluate(() => {
    const G = EGO.Game, C = EGO.Cutscene; EGO.Save.data.story.done = ['bp1']; EGO.UI.show('story');
    const btns = document.querySelectorAll('[data-watch]').length;
    document.querySelector('[data-watch="bp1"]').click(); if (C.phase === 'title') C.begin();
    const first = { open: !document.getElementById('cutscene').hidden, part: EGO.Movie.part };
    let guard = 0, parts = new Set(), vs = false;
    while (!document.getElementById('cutscene').hidden && guard++ < 40) { parts.add(EGO.Movie.part); if (C.phase === 'vs') vs = true; if (C.typing) C.finishLine(); G.stepManual(20, false); C.next(); }
    return { btns, first, parts: [...parts], vs, cur: EGO.UI.cur, state: G.state, match: !!G.match };
  });
  check('WATCH on a finished event plays its scene before and after (no VS, no match), then you are back on the story screen', watch.btns === 1 && watch.first.open && watch.parts.join() === 'intro,outro' && !watch.vs && watch.cur === 'story' && !watch.match, watch);

  // ---- a few pictures of the big moments ----
  const pic = async (id, part, lineI, frames, name) => {
    await page.evaluate(([id, part, lineI, frames]) => {
      const G = EGO.Game, C = EGO.Cutscene, ev = EGO.STORY_EVENTS.find((e) => e.id === id);
      C.story(ev, part, () => {}); if (C.phase === 'title') C.begin();
      G.stepManual(5, false);
      for (let i = 0; i <= lineI; i++) { if (C.typing) C.finishLine(); G.stepManual(2, false); C.next(); }
      G.stepManual(frames, true);
    }, [id, part, lineI, frames]);
    await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_' + name + '.png', timeout: 120000 }).catch(() => {});
    await page.evaluate(() => EGO.Cutscene.end());
  };
  await pic('bp1', 'outro', 1, 90, 'shirt');
  await pic('bp3', 'intro', 0, 120, 'boom');
  await pic('bp4', 'outro', 0, 90, 'join');
  await pic('vc1', 'intro', 2, 115, 'snap');
  await pic('vc4', 'outro', 2, 200, 'cup');
  await pic('vc3', 'intro', 2, 30, 'band');
  await pic('vc2', 'intro', 2, 70, 'zoom');

  // ---- anime: the manga page (the face-off before event 1's match) ----
  const page1 = await page.evaluate(() => {
    const G = EGO.Game, C = EGO.Cutscene, M = EGO.Movie, ev = EGO.STORY_EVENTS[0];
    C.story(ev, 'intro', () => {}); if (C.phase === 'title') C.begin();
    let guard = 0; while (C.phase !== 'end' && guard++ < 20) { if (C.typing) C.finishLine(); G.stepManual(2, false); C.next(); }
    G.stepManual(62, false); G.stepManual(50, true);
    const box = getComputedStyle(document.getElementById('cs-next')).visibility;
    return { phase: C.phase, pan: !!M.pan, imgs: M.pan ? M.pan.imgs.length : 0, shown: !document.getElementById('cs-pan').hidden, cls: document.getElementById('cutscene').classList.contains('pan'), frozen: M.ts === 0, box };
  });
  check('anime: at the face-off the moment freezes and a manga page of both pairs of eyes slams in', page1.phase === 'end' && page1.pan && page1.imgs === 2 && page1.shown && page1.cls && page1.frozen && page1.box === 'hidden', page1);
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_panels.png', timeout: 120000 }).catch(() => {});
  const page2 = await page.evaluate(() => { const G = EGO.Game, M = EGO.Movie; G.stepManual(150, true); const r = { pan: !!M.pan, shown: !document.getElementById('cs-pan').hidden, cls: document.getElementById('cutscene').classList.contains('pan'), ts: M.ts }; EGO.Cutscene.end(); return r; });
  check('then the page breaks apart and the scene goes on', !page2.pan && !page2.shown && !page2.cls && page2.ts === 1, page2);

  // ---- anime: SOLARIS powers up in a dark world, and the world comes back on the next line ----
  const dark = await page.evaluate(() => {
    const G = EGO.Game, C = EGO.Cutscene, M = EGO.Movie, W = EGO.World, ev = EGO.STORY_EVENTS.find((e) => e.id === 'vc4');
    C.story(ev, 'intro', () => {}); if (C.phase === 'title') C.begin();
    const far0 = W.scene.fog.far; // the night final's fog, before anyone powers up
    C.next(); G.stepManual(80, true);
    const on = { void: M.voidM.visible, far: W.scene.fog.far, glare: M.A.SOLARIS.glare, eyes: M.A.SOLARIS.p.P.eyes.visible, shot: M.shot.s[0] };
    return { far0, on };
  });
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_dark.png', timeout: 120000 }).catch(() => {});
  const dark2 = await page.evaluate(() => { const G = EGO.Game, C = EGO.Cutscene, M = EGO.Movie, W = EGO.World; if (C.typing) C.finishLine(); C.next(); G.stepManual(5, false); const r = { void: M.voidM.visible, far: W.scene.fog.far }; C.end(); return r; });
  check('anime: SOLARIS powers up in a dark world with glowing eyes; the next line brings the stadium back', dark.on.void && dark.on.far < 40 && dark.on.glare && dark.on.eyes && !dark2.void && dark2.far === dark.far0, { dark, dark2 });

  // ---- anime: the step-over past IRONCLAD in slow motion with the camera going round ----
  const bullet = await page.evaluate(() => {
    const G = EGO.Game, C = EGO.Cutscene, M = EGO.Movie, ev = EGO.STORY_EVENTS.find((e) => e.id === 'cl4');
    C.story(ev, 'outro', () => {}); if (C.phase === 'title') C.begin();
    G.stepManual(66, true);
    return { phase: C.phase, ts: +M.ts.toFixed(2), shot: M.shot.s[0] };
  });
  check('anime: the step-over past IRONCLAD plays in slow motion while the camera circles you', bullet.phase === 'open' && bullet.ts < 0.6 && bullet.shot === 'orbit', bullet);
  await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_bullet.png', timeout: 120000 }).catch(() => {});
  await page.evaluate(() => EGO.Cutscene.end());
  const clean = await page.evaluate(() => ({ hit: document.body.classList.contains('mv-hit') || document.body.classList.contains('mv-hit2'), strip: document.getElementById('cutscene').classList.contains('strip'), speed: !document.getElementById('cs-speed').hidden, word: !document.getElementById('cs-word').hidden, void: EGO.Movie.voidM.visible }));
  check('after the anime moments nothing is left over (no black and white, no strip, no lines, no words, no dark world)', !clean.hit && !clean.strip && !clean.speed && !clean.word && !clean.void, clean);

  // ---- after a win: over the results, the match out of the way ----
  const res = await page.evaluate(() => {
    const G = EGO.Game, ev = EGO.STORY_EVENTS[0]; EGO.Save.data.story.done = [];
    G.startMatch(ev.mode, { story: ev }); const m = G.match, me = m.human.team; G.manual = true;
    m.score[me] = 2; m.score[1 - me] = 0; m.phase = 'play'; m.clock = 0.02; G.stepManual(400, false);
    const during = { on: EGO.Movie.on, state: G.state, hidden: m.players.every((p) => !p.P.root.visible), results: !document.getElementById('scr-results').hidden };
    EGO.Cutscene.end();
    return { during, after: { on: EGO.Movie.on, shown: m.players.some((p) => p.P.root.visible), state: G.state } };
  });
  check('after the win the scene plays over the results with the match players hidden; skipping brings back the results', res.during.on && res.during.state === 'results' && res.during.hidden && res.during.results && !res.after.on && res.after.shown && res.after.state === 'results', res);

  // ---- phones: the speech box and the VS card fit (sideways and upright) ----
  for (const [w, h] of [[844, 390], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    const fit = await page.evaluate(() => {
      const G = EGO.Game, C = EGO.Cutscene, ev = EGO.STORY_EVENTS[3];
      if (G.match) { G.match.dispose(); G.match = null; } G.toLobby(); EGO.UI.show('story');
      C.story(ev, 'intro', () => {}); if (C.phase === 'title') C.begin(); C.next(); if (C.typing) C.finishLine(); G.stepManual(30, true);
      const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      const box = r('cs-next'), text = r('cs-text'), face = r('cs-face');
      return { box, text, face, W: innerWidth, H: innerHeight, scroll: document.documentElement.scrollWidth > innerWidth };
    });
    const inside = (b) => b[0] >= 0 && b[1] >= 0 && b[2] <= fit.W && b[3] <= fit.H;
    await page.waitForTimeout(700); await page.screenshot({ path: __dirname + '/shots/movie_phone_' + w + 'x' + h + '.png', timeout: 120000 }).catch(() => {});
    const vs = await page.evaluate(() => { const C = EGO.Cutscene; while (C.phase === 'lines') { if (C.typing) C.finishLine(); C.next(); } if (C.phase === 'end') C.next(); const b = document.querySelector('.vs-goal').getBoundingClientRect(); return { phase: C.phase, goal: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }; });
    await page.waitForTimeout(900); await page.screenshot({ path: __dirname + '/shots/movie_phone_vs_' + w + 'x' + h + '.png', timeout: 120000 }).catch(() => {});
    check(w + 'x' + h + ': the speech box, its text and the portrait are on screen, and the VS card fits', inside(fit.box) && inside(fit.text) && inside(fit.face) && fit.text[0] >= fit.face[2] && !fit.scroll && vs.phase === 'vs' && inside(vs.goal), { fit, vs });
    await page.evaluate(() => EGO.Cutscene.end());
  }

  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.filter((l) => l.startsWith('PAGEERROR')).slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
