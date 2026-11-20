// The content pack (owner, Nov 2026: "make like way more content"): six new characters (in the spin pools, each with three
// working powers, an Awakening and a pose), three new Flows, fifteen new skins and three new goal celebrations
// (SPIN turns you round, DANCE sways side to side, HEART puts both hands over your head with pink hearts).
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const NEW_STYLES = ['VORTEX', 'NOVA', 'SENTINEL', 'JESTER', 'TEMPEST', 'ACE'];
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const data = await page.evaluate((NEW) => {
    const out = { styles: {}, flows: ['STAMPEDE', 'ECLIPSE', 'PHOENIX'].map((f) => !!EGO.FLOWS[f]), skins: ['NEON_PINK', 'LAVA_BOOTS', 'GOLD_GLOVES', 'STAR_SHADES', 'MIDNIGHT', 'SPIN_CELEB', 'DANCE_CELEB', 'HEART_CELEB'].map((k) => !!EGO.SKINS[k]) };
    for (const id of NEW) { const st = EGO.STYLES[id], r = ['Rare', 'Epic', 'Legendary', 'Mythic', 'Generational'].indexOf(st.rarity); out.styles[id] = { abil: st.abilities.every((a) => EGO.ABILITIES[a]), awaken: !!(st.awaken && st.awaken.move), spin: EGO.poolFor('style', r).includes(id) }; }
    return out;
  }, NEW_STYLES);
  check('six new characters, each with three powers and an Awakening, all in the spin pools', NEW_STYLES.every((id) => data.styles[id].abil && data.styles[id].awaken && data.styles[id].spin), data.styles);
  check('three new Flows and the new skins exist', data.flows.every(Boolean) && data.skins.every(Boolean), data);
  // each new character's powers work in a match
  const powers = await page.evaluate((NEW) => {
    const G = EGO.Game, out = {};
    for (const id of NEW) {
      G.startMatch('quick'); const m = G.match, h = m.human; G.toLobby();
      out[id] = h.abil.map((a) => a.id);
    }
    // try each power the way a player would: in play, with the ball, an opponent close by
    const tried = {};
    for (const id of NEW) {
      EGO.Save.data.style = id; EGO.Save.data.styles.push(id);
      G.startMatch('quick'); const m = G.match, h = m.human; m.phase = 'play'; h.setState('free');
      const opp = m.teams[1].find((p) => !p.isGK); opp.setState('free'); opp.pos.set(h.pos.x + 1.6, 0, h.pos.z + 2); m.ball.reset(h.pos.x, h.pos.z + 0.5); m.possess(h);
      tried[id] = h.abil.map((a, i) => { a.cd = 0; if (m.ball.owner !== h) { m.ball.release(); m.ball.reset(h.pos.x, h.pos.z + 0.5); m.possess(h); } h.setState('free'); const r = a.def.use(h, m); G.stepManual(20); return r === true ? 'ok' : r; });
      G.toLobby();
    }
    EGO.Save.data.style = 'ROOKIE';
    return { abil: out, tried };
  }, NEW_STYLES);
  const worked = NEW_STYLES.map((id) => powers.tried[id].filter((r) => r === 'ok').length);
  check('every new character gets its own powers in a match, and most work straight away (with the ball, a defender near)', NEW_STYLES.every((id, i) => powers.abil[id].length === 3) && worked.every((n) => n >= 2), powers.tried);
  // the three new celebrations
  const celeb = await page.evaluate(() => {
    const G = EGO.Game, out = {};
    for (const c of ['spin', 'dance', 'heart']) {
      G.startMatch('quick'); const m = G.match, h = m.human; h.look.celeb = c; h.setState('celebrate', 99);
      const P = h.P, s = []; for (let i = 0; i < 40; i++) { G.stepManual(1); s.push([P.root.rotation.y, P.body.rotation.z, P.armL.rotation.x, P.armL.rotation.z]); }
      const range = (k) => Math.max(...s.map((v) => v[k])) - Math.min(...s.map((v) => v[k]));
      out[c] = { turn: +range(0).toFixed(2), sway: +range(1).toFixed(2), armX: +s[39][2].toFixed(2), armZ: +s[39][3].toFixed(2) };
      G.toLobby();
    }
    return out;
  });
  check('SPIN turns you round, DANCE sways, HEART puts both hands over your head', celeb.spin.turn > 3 && celeb.dance.sway > 0.15 && celeb.heart.armX < -2.4 && celeb.heart.armZ < 0, celeb);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n').slice(0, 18).join(' | ')); process.exit(1); });
