// The owner's admin panel: hidden for everyone else (even the old retired code), on the start screen it gives things,
// in the pause menu of a bot match it controls the match (score, clock, ball, freeze, speed, stamina, win), never online.
// The secret code is never typed here: the test marks the save as the game's own list says.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await open({ wait: 2000 });
  const vis = (id) => page.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.hidden && e.offsetParent !== null; }, id);
  const give = (retired) => page.evaluate((r) => { const C = EGO.CODES, h = Object.keys(C).find((k) => C[k].give === 'all' && !!C[k].retired === r); EGO.Save.data.codes = [h]; EGO.Save.save(); EGO.UI.renderLobby(); }, retired);

  check('a normal player sees no admin button', !(await vis('lob-admin')) && !(await page.evaluate(() => EGO.Admin.is())));
  await give(true);
  check('the old retired code does not open it', !(await vis('lob-admin')));
  await page.evaluate(() => { EGO.Save.data.codes = []; EGO.Save.save(); EGO.UI.renderLobby(); });
  await page.evaluate(() => EGO.Game.startMatch('ranked')); await page.evaluate(() => EGO.Game.stepManual(4)); await page.keyboard.press('KeyP'); await sleep(300);
  check('a normal player has no ADMIN button in the pause menu', !(await vis('p-admin')));
  await page.evaluate(() => EGO.Admin.open(true));
  check('and it cannot be opened by hand', await page.evaluate(() => document.getElementById('admin').hidden));
  await page.evaluate(() => { EGO.Game.forfeit(); EGO.Game.toLobby(); }); await sleep(300);

  await give(false);
  check('the owner sees ADMIN PANEL on the start screen', await vis('lob-admin'));
  await page.click('#lob-admin'); await sleep(200);
  const d0 = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, bp: EGO.Save.data.bp, lv: EGO.levelOf(EGO.Save.data.xp).level, rp: EGO.Save.data.rp }));
  for (const a of ['em', 'bp', 'xp', 'rp+', 'all']) { await page.click(`#adm-body [data-a="${a}"]`); await sleep(80); }
  const d1 = await page.evaluate(() => ({ em: EGO.Save.data.emeralds, bp: EGO.Save.data.bp, lv: EGO.levelOf(EGO.Save.data.xp).level, rp: EGO.Save.data.rp, saved: JSON.parse(localStorage.getItem(EGO.Save.key)).emeralds }));
  check('it gives emeralds, blueprints, a level and rank, and saves them', d1.em === d0.em + 10000 && d1.bp === d0.bp + 100 && d1.lv === d0.lv + 1 && d1.rp === d0.rp + 100 && d1.saved === d1.em, { d0, d1 });
  await page.screenshot({ path: __dirname + '/shots/admin1_lobby.png', timeout: 120000 }).catch(() => {});
  await page.click('#adm-close');

  await page.evaluate(() => EGO.Game.startMatch('ranked')); await page.evaluate(() => EGO.Game.stepManual(220)); // past the kickoff
  await page.keyboard.press('KeyP'); await sleep(300);
  check('the owner has ADMIN in the pause menu', await vis('p-admin'));
  await page.click('#p-admin'); await sleep(200);
  check('the admin panel opens over the pause menu', await vis('admin'));
  const c0 = await page.evaluate(() => ({ s: EGO.Game.match.score.slice(), t: EGO.Game.match.clock, me: EGO.Game.match.human.team }));
  for (const a of ['us+', 'us+', 'them+', 't+', 'freeze', 'fast', 'stam', 'ball']) { await page.click(`#adm-body [data-a="${a}"]`); await sleep(80); }
  await page.screenshot({ path: __dirname + '/shots/admin2_match.png', timeout: 120000 }).catch(() => {});
  const c1 = await page.evaluate(() => { const m = EGO.Game.match; return { s: m.score.slice(), t: m.clock, owner: m.ball.owner === m.human, msg: document.getElementById('adm-msg').textContent, spd: m.human.speedMul }; });
  check('score buttons change the score', c1.s[c0.me] === c0.s[c0.me] + 2 && c1.s[1 - c0.me] === c0.s[1 - c0.me] + 1, { c0, c1 });
  check('+30 SEC adds time', Math.abs(c1.t - c0.t - 30) < 0.5, { before: c0.t, after: c1.t });
  check('BALL TO ME gives you the ball (or says to wait for play)', c1.owner || /WAIT/.test(c1.msg), c1);
  check('SUPER SPEED makes you faster', c1.spd > 1.5, c1.spd);
  await page.click('#adm-close'); await page.click('#p-resume'); await sleep(100);
  await page.evaluate(() => { const m = EGO.Game.match; m.human.stamina = 5; EGO.Game.stepManual(20); });
  const c2 = await page.evaluate(() => { const m = EGO.Game.match; return { stam: m.human.stamina, frozen: m.phase === 'play' ? m.teams[1 - m.human.team].every((o) => o.state === 'frozen') : 'not in play: ' + m.phase }; });
  check('NEVER TIRED keeps stamina full', c2.stam >= 99, c2);
  check('FREEZE THEM freezes the other team in open play', c2.frozen === true || /not in play/.test(String(c2.frozen)), c2);
  await page.keyboard.press('KeyP'); await sleep(200); await page.click('#p-admin'); await sleep(100);
  await page.click('#adm-body [data-a="freeze"]'); await page.click('#adm-close'); await page.click('#p-resume');
  await page.evaluate(() => EGO.Game.stepManual(5));
  check('turning FREEZE off unfreezes them', await page.evaluate(() => { const m = EGO.Game.match; return m.teams[1 - m.human.team].every((o) => o.state !== 'frozen'); }));
  await page.keyboard.press('KeyP'); await sleep(200); await page.click('#p-admin'); await sleep(100);
  await page.evaluate(() => { const m = EGO.Game.match; m.score[m.human.team] = 0; m.score[1 - m.human.team] = 3; });
  await page.click('#adm-body [data-a="win"]'); await sleep(100);
  await page.evaluate(() => EGO.Game.stepManual(260));
  const r = await page.evaluate(() => ({ state: EGO.Game.state, res: EGO.Game.match && EGO.Game.match.result && EGO.Game.match.result.res, admin: document.getElementById('admin').hidden }));
  check('WIN NOW ends the match as a win', r.res === 'win' && r.state === 'results' && r.admin, r);
  check('no errors', logs.filter((l) => !/willReadFrequently|GPU stall|WebGL/i.test(l)).length === 0, logs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
