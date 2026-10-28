// The owner's second wish list: every Flow looks and plays differently, Awakenings (a bar and a power for each
// style), the CROP haircut, a smaller ball on the start screen, KIT skins, and the daily gift and challenge.
const { chromium } = require('playwright');
const path = require('path');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const URL = require('url').pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const mk = async (opts) => {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage(); p.setDefaultTimeout(120000);
    p.on('pageerror', (e) => logs.push(e.message));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(URL, { timeout: 120000 }); await p.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 120000 }); return p;
  };
  const A = await mk({ viewport: { width: 1280, height: 720 } });
  // a match that is in play, with you as the given style and Flow
  const match = (style, flow) => A.evaluate(([s, f]) => {
    const d = EGO.Save.data; d.style = s; d.flow = f; d.settings.cutins = false;
    if (EGO.Game.match) EGO.Game.toLobby();
    EGO.Game.startMatch('quick');
    for (let i = 0; i < 80 && EGO.Game.match.phase !== 'play'; i++) EGO.Game.stepManual(10, false);
    return EGO.Game.match.phase;
  }, [style, flow]);

  /* ---------- Flows ---------- */
  const flows = await A.evaluate(() => Object.keys(EGO.FLOWS).map((k) => ({ k, fx: EGO.FLOWS[k].fx, color: EGO.FLOWS[k].color })));
  check('every Flow has its own look and colour', new Set(flows.map((f) => f.fx)).size === flows.length && new Set(flows.map((f) => f.color)).size === flows.length, flows);
  await match('ROOKIE', 'SECOND_WIND');
  const wind = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; h.stamina = 20; h.flow = 100; m.activateFlow(h); EGO.Game.stepManual(2, false); return { st: Math.round(h.stamina), eyes: h.P.eyes.userData.hex, shown: h.P.eyes.visible }; });
  check('SECOND WIND refills your stamina at once, and your eyes glow in its colour', wind.st >= 95 && wind.eyes === '#7dffb0' && wind.shown, wind);
  await match('ROOKIE', 'BLUE_FLAME');
  const flame = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; for (const a of h.abil) a.cd = 9; h.flow = 100; m.activateFlow(h); return h.abil.map((a) => a.cd); });
  check('BLUE FLAME resets your ability cooldowns', flame.every((c) => c === 0), flame);
  await match('ROOKIE', 'VIPER');
  const viper = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; h.flow = 100; m.activateFlow(h); EGO.Game.stepManual(3, false); return { ring: !!(h.ring && h.ring.visible), c: h.ring && h.ring.userData.c }; });
  check('VIPER shows its tackle reach as a green ring', viper.ring && viper.c === '#5dff7a', viper);

  /* ---------- Awakenings ---------- */
  const styles = await A.evaluate(() => Object.keys(EGO.STYLES).map((k) => ({ k, aw: EGO.STYLES[k].awaken && EGO.STYLES[k].awaken.name })));
  check('every style has its own Awakening', styles.every((s) => s.aw) && new Set(styles.map((s) => s.aw)).size === styles.length, styles);
  await match('SPRINTER', null);
  const fill = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; h.awake = 0; m.flowAdd(h, 35); m.flowAdd(h, 4); return Math.round(h.awake); });
  check('big plays fill the Awakening bar, small ones do not', fill > 20 && fill < 30, fill);
  const aw = await A.evaluate(() => {
    const m = EGO.Game.match, h = m.human; for (const a of h.abil) a.cd = 8; h.awake = 100; h.flow = 0;
    EGO.Input.edges.add('KeyZ'); EGO.Game.stepManual(3, false);
    return { t: +h.awakeT.toFixed(1), cds: h.abil.map((a) => a.cd), cdRate: h.mods.cdRate, speed: +h.mods.speed.toFixed(2), drain: h.mods.stamDrain, bar: document.getElementById('awake-txt').textContent, slot: document.getElementById('slot-z').classList.contains('active') };
  });
  check('Z awakens you: 20s, cooldowns reset and recharge twice as fast', aw.t > 19 && aw.cds.every((c) => c < 0.1) && aw.cdRate === 2, aw);
  check("the style's own power: RED LINE is faster and sprinting is free", aw.speed >= 1.25 && aw.drain === 0, aw);
  check('the HUD shows the Awakening bar and the Z slot lit up', /AWAKENED/.test(aw.bar) && aw.slot, aw);
  const longer = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; h.fx.turbo = 0; const i = h.abil.findIndex((a) => a.def.name === 'TURBO'); h.abil[i].cd = 0; m.useAbility(h, i); return +h.fx.turbo.toFixed(2); });
  const normal = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; h.awakeT = 0; h.fx.turbo = 0; const i = h.abil.findIndex((a) => a.def.name === 'TURBO'); h.abil[i].cd = 0; m.useAbility(h, i); return +h.fx.turbo.toFixed(2); });
  check('awakened, abilities last 50% longer', normal > 0 && Math.abs(longer - normal * 1.5) < 0.05, { awakened: longer, normal });
  const viaG = await A.evaluate(() => { const m = EGO.Game.match, h = m.human; h.awakeT = 0; h.awake = 100; h.flow = 10; EGO.Input.edges.add('KeyG'); EGO.Game.stepManual(2, false); return h.awakeT > 0; });
  check('the Flow button (G) awakens you when only the Awakening bar is full', viaG);
  const bots = await A.evaluate(() => { const r = EGO.simulate('quick', 0.6, 120, 3); return r; });
  check('bots awaken too (about 1 to 2 times each in a match)', bots && bots.awakens >= 1, { awakens: bots && bots.awakens, goals: bots && bots.goals });

  /* ---------- the start screen: smaller ball, CROP, KIT ---------- */
  await A.evaluate(() => EGO.Game.toLobby());
  const lob = await A.evaluate(() => ({ ball: +EGO.Showcase.ball.scale.x.toFixed(2), crop: EGO.SKINS.CROP.shape }));
  check('the ball on the start screen is smaller', lob.ball < 0.8, lob);
  check('CROP is its own haircut now', lob.crop === 'crop', lob);
  const kits = await A.evaluate(() => Object.keys(EGO.SKINS).filter((k) => EGO.SKINS[k].slot === 'kit'));
  check('a KIT slot with kits to win', kits.length >= 7 && kits.includes('TEAM_KIT'), kits);
  const kit = await A.evaluate(() => {
    const d = EGO.Save.data; if (!d.skins.includes('LIGHTNING')) d.skins.push('LIGHTNING'); d.look.kit = 'LIGHTNING'; EGO.Save.save(); EGO.Showcase.ensure();
    const lobbyKit = EGO.Showcase.p.look.kitPattern;
    EGO.Game.startMatch('quick'); EGO.Game.stepManual(3, false);
    const m = EGO.Game.match, h = m.human, gk = m.teams[h.team][0];
    return { lobbyKit, matchKit: h.look.kitPattern, trim: h.look.kitTrim, keeperKit: gk.look ? gk.look.kitPattern || null : null };
  });
  check('the kit you pick is worn on the start screen and in matches', kit.lobbyKit === 'bolt' && kit.matchKit === 'bolt' && kit.trim === '#ffe14d', kit);
  await A.evaluate(() => EGO.Game.toLobby());
  await A.evaluate(() => { EGO.UI.show('locker'); const t = [...document.querySelectorAll('#scr-locker [role=tab], #scr-locker .tab')].find((b) => /SKINS/.test(b.textContent)); if (t) t.click(); const s = document.querySelector('[data-slot="kit"]'); if (s) s.click(); });
  await A.waitForTimeout(500);
  const locker = await A.evaluate(() => document.getElementById('scr-locker').textContent);
  check('the Locker has a KIT tab listing the kits', /KIT/.test(locker) && /LIGHTNING/.test(locker) && /CLUB KIT/.test(locker), locker.slice(0, 160));
  await A.screenshot({ path: __dirname + '/shots/ex1_locker_kits.png', timeout: 120000 });

  /* ---------- daily gift and challenge ---------- */
  await A.evaluate(() => { EGO.UI.show('lobby'); EGO.Save.data.daily.gift = ''; EGO.UI.renderLobby(); });
  const ready = await A.evaluate(() => document.getElementById('go-daily').classList.contains('ready'));
  await A.evaluate(() => document.getElementById('go-daily').click());
  const em0 = await A.evaluate(() => EGO.Save.data.emeralds + EGO.Save.data.xp);
  await A.evaluate(() => document.getElementById('dl-open').click());
  const after = await A.evaluate(() => ({ sum: EGO.Save.data.emeralds + EGO.Save.data.xp, text: document.getElementById('dl-gift').textContent, again: EGO.Daily.openGift(EGO.Save.data), dot: document.getElementById('go-daily').classList.contains('ready') }));
  check('the daily gift: ready on the start screen, opens once a day', ready && after.sum > em0 && /EMERALDS|XP/.test(after.text) && after.again === null && !after.dot, Object.assign(after, { ready }));
  await A.screenshot({ path: __dirname + '/shots/ex2_daily.png', timeout: 120000 });
  await A.evaluate(() => { document.getElementById('dl-close').click(); });
  const ch = await A.evaluate(() => {
    const d = EGO.Save.data; d.daily.day = ''; EGO.Daily.sync(d); d.daily.ch = 'goals'; d.daily.prog = 0; d.daily.done = false;
    const em = d.emeralds;
    EGO.Game.startMatch('quick'); EGO.Game.stepManual(3, false);
    const m = EGO.Game.match; m.score = [2, 0]; m.result = { res: 'win', human: { goals: 2, assists: 0, shots: 3, tackles: 0 } }; EGO.Game.finishMatch(false);
    return { done: d.daily.done, line: document.getElementById('r-daily').textContent, em: d.emeralds - em };
  });
  check('the daily challenge counts your match and pays out once', ch.done && /DAILY CHALLENGE DONE/.test(ch.line) && ch.em >= 150, ch);
  const next = await A.evaluate(() => { const d = EGO.Save.data; d.daily.day = '1999-01-01'; EGO.Daily.sync(d); return { prog: d.daily.prog, done: d.daily.done, ch: !!EGO.DAILY_CHALLENGES[d.daily.ch] }; });
  check('a new day brings a new challenge (no streak to lose)', next.prog === 0 && !next.done && next.ch, next);

  /* ---------- phones ---------- */
  for (const [nm, vp] of [['side', { width: 844, height: 390 }], ['up', { width: 390, height: 844 }]]) {
    const P = await mk({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await P.evaluate(() => { EGO.Save.data.settings.autoFs = false; EGO.Save.data.daily.gift = ''; document.getElementById('go-daily').click(); });
    const box = await P.evaluate(() => { const r = document.querySelector('#scr-daily .dialog').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sw: document.documentElement.scrollWidth }; });
    check('phone ' + nm + ': the daily box fits', box.l >= 0 && box.r <= box.w && box.sw <= box.w, box);
    await P.screenshot({ path: __dirname + '/shots/ex3_daily_' + nm + '.png', timeout: 120000 });
    await P.evaluate(() => { document.getElementById('dl-close').click(); EGO.Save.data.style = 'THUNDER'; EGO.Game.startMatch('quick'); for (let i = 0; i < 80 && EGO.Game.match.phase !== 'play'; i++) EGO.Game.stepManual(10, false); EGO.Game.match.human.awake = 100; EGO.Game.match.human.flow = 0; EGO.Game.stepManual(2, true); });
    const tb = await P.evaluate(() => ({ lb: document.querySelector('#touch [data-act="flow"] .lb').textContent, h: document.getElementById('awakebar').getBoundingClientRect().height }));
    check('phone ' + nm + ': the FLOW button becomes AWAKEN! and the bar stays on one line', tb.lb === 'AWAKEN!' && tb.h < 30, tb);
    await P.screenshot({ path: __dirname + '/shots/ex4_awaken_' + nm + '.png', timeout: 120000 });
  }
  check('no page errors', logs.length === 0, logs.slice(0, 4));
  await browser.close();
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
