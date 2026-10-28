// The CrazyGames build, with a stand-in for their SDK that records every call:
// loading and gameplay start/stop, progress in their Data module (and an old save copied in), their account
// and username, their mute and chat settings, the video ad at the final whistle, rooms, invites,
// joining from their page and instant multiplayer. The normal build must not load any of it.
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18792, ROOT = path.join(__dirname, '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'scorz-cg-')), OUT2 = fs.mkdtempSync(path.join(os.tmpdir(), 'scorz-cg2-'));
execFileSync(process.execPath, ['build.js', '--crazygames'], { cwd: ROOT, env: Object.assign({}, process.env, { SCORZ_SERVER: 'ws://localhost:' + PORT + '/ws', SCORZ_CG_OUT: OUT }) });
execFileSync(process.execPath, ['build.js', '--crazygames'], { cwd: ROOT, env: Object.assign({}, process.env, { SCORZ_SERVER: '', SCORZ_CG_OUT: OUT2 }) });
const CG = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'), CG_NOSERVER = fs.readFileSync(path.join(OUT2, 'index.html'), 'utf8');
const PUBLIC = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');

// the stand-in SDK: same names as theirs (docs.crazygames.com/sdk), it records what the game calls
const FAKE_SDK = `(() => {
  const P = window.__cgPreset || {};
  const cg = window.__cg = { calls: [], listeners: {}, user: P.user || null, settings: P.settings || { muteAudio: false, disableChat: false }, data: P.data || {}, invite: P.invite || null, instant: !!P.instant, adOn: false };
  const rec = (n) => (...a) => { cg.calls.push(a.length ? n + ':' + JSON.stringify(a[0]) : n); };
  window.CrazyGames = { SDK: {
    environment: 'crazygames',
    init: () => new Promise((r) => setTimeout(r, 60)),
    game: {
      gameplayStart: rec('gameplayStart'), gameplayStop: rec('gameplayStop'), loadingStart: rec('loadingStart'), loadingStop: rec('loadingStop'), happytime: rec('happytime'),
      get settings() { return cg.settings; },
      addSettingsChangeListener: (f) => { cg.listeners.settings = f; }, addJoinRoomListener: (f) => { cg.listeners.join = f; },
      updateRoom: rec('updateRoom'), leftRoom: rec('leftRoom'),
      inviteLink: (p) => 'https://www.crazygames.com/game/scorz?room=' + p.room,
      get inviteParams() { return cg.invite; }, get isInstantMultiplayer() { return cg.instant; },
      getInviteParam: (k) => (cg.invite && cg.invite[k]) || null,
    },
    user: {
      get isUserAccountAvailable() { return true; },
      getUser: async () => cg.user,
      showAuthPrompt: async () => { cg.user = { username: 'Cool Kid77', profilePictureUrl: '' }; return cg.user; },
      addAuthListener: (f) => { cg.listeners.auth = f; },
      systemInfo: { countryCode: 'GB', locale: 'en-GB', device: { type: 'desktop' } },
    },
    data: { getItem: (k) => (k in cg.data ? cg.data[k] : null), setItem: (k, v) => { cg.data[k] = String(v); }, removeItem: (k) => { delete cg.data[k]; }, clear: () => { cg.data = {}; } },
    ad: {
      requestAd: (type, cb) => { cg.calls.push('ad:' + type); setTimeout(() => { cg.adOn = true; cb.adStarted && cb.adStarted(); setTimeout(() => { cg.adOn = false; cb.adFinished && cb.adFinished(); }, 700); }, 80); },
      hasAdblock: async () => false,
    },
  } };
})();`;

(async () => {
  const srv = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), MATCH_SECONDS: '30' }) });
  let out = ''; srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 50 && !/SCORZ server/.test(out); i++) await sleep(100);
  // the page here is injected by the test, so Chrome cannot tell it comes from localhost; on CrazyGames both ends are public
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=LocalNetworkAccessChecks'] });
  const logs = [];
  const mk = async (opts, preset, html, local) => {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    p.on('pageerror', (e) => logs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.route('https://sdk.crazygames.com/**', (r) => r.fulfill({ body: FAKE_SDK, contentType: 'text/javascript' }));
    // served from the test server's address, so the page may talk to it (Chrome blocks public pages from reaching localhost)
    await p.route((u) => u.pathname.startsWith('/cg'), (r) => r.fulfill({ body: html || CG, contentType: 'text/html' }));
    await p.addInitScript(([pre, loc]) => { window.__cgPreset = pre; if (loc) for (const k in loc) localStorage.setItem(k, loc[k]); }, [preset || {}, local || null]);
    await p.goto('http://localhost:' + PORT + '/cg/'); await sleep(2500); return p;
  };
  const calls = (p) => p.evaluate(() => window.__cg.calls.slice());

  check('the CrazyGames page loads their SDK in <head>, the normal page does not', /<head>[\s\S]*sdk\.crazygames\.com\/crazygames-sdk-v3\.js[\s\S]*<\/head>/.test(CG) && !/crazygames-sdk/.test(PUBLIC));
  // an old local save is copied into their Data module once
  const oldSave = JSON.stringify({ emeralds: 4321, xp: 100 });
  const A = await mk({ viewport: { width: 1280, height: 720 } }, {}, null, { 'scorz.save.v1': oldSave });
  const boot = await A.evaluate(() => ({ on: EGO.Portal.on, em: EGO.Save.data.emeralds, inData: !!window.__cg.data['scorz.save.v1'], fs: !document.getElementById('btn-fs') || document.getElementById('btn-fs').hidden, adv: !!document.querySelector('.on-adv'), online: !document.getElementById('go-online').hidden }));
  const c0 = await calls(A);
  check('their SDK starts first and loading start/stop are reported', boot.on && c0[0] === 'loadingStart' && c0.includes('loadingStop'), c0);
  check('an older save on this device moves into their Data module', boot.em === 4321 && boot.inData, boot);
  check('no fullscreen button and no server address box; PLAY WITH FRIENDS is there', boot.fs && !boot.adv && boot.online, boot);

  // gameplay start and stop
  await A.click('#go-quick'); await sleep(1500);
  await A.keyboard.press('KeyP'); await sleep(500);
  const paused = await A.evaluate(() => EGO.Game.state);
  await A.keyboard.press('KeyP'); await sleep(500);
  const c1 = await calls(A);
  const gp = c1.filter((c) => /^gameplay/.test(c));
  check('gameplay start when the match starts, stop when paused, start again on resume (P pauses too)', paused === 'paused' && gp.join(',') === 'gameplayStart,gameplayStop,gameplayStart', gp);
  // a win: happytime, the results, and the ad
  await A.evaluate(() => { const m = EGO.Game.match; m.score = [2, 0]; m.result = { res: 'win', human: { goals: 2, assists: 0, shots: 3, tackles: 1 } }; EGO.Game.finishMatch(false); });
  await sleep(250);
  const during = await A.evaluate(() => ({ block: !document.getElementById('ad-block').hidden, muted: EGO.Sfx.muted, ad: window.__cg.adOn }));
  await sleep(1200);
  const after = await A.evaluate(() => ({ block: !document.getElementById('ad-block').hidden, muted: EGO.Sfx.muted, saved: JSON.parse(window.__cg.data['scorz.save.v1']).stats.played }));
  const c2 = await calls(A);
  check('the final whistle: gameplay stop, happytime for a win, then a midgame ad', c2.slice(c1.length).filter((c) => /gameplay|happytime|ad:/.test(c)).join(',') === 'gameplayStop,happytime,ad:midgame', c2.slice(c1.length));
  check('during the ad the screen is blocked and the sound is off', during.block && during.muted && during.ad, during);
  check('after the ad: unblocked, sound back on, progress saved in their Data module', !after.block && !after.muted && after.saved === 1, after);
  await A.evaluate(() => EGO.Game.toLobby()); await sleep(300);

  // their account
  await A.click('#go-profile'); await sleep(300);
  const acc0 = await A.evaluate(() => document.getElementById('pf-acc').textContent);
  check('the profile offers CrazyGames sign in, not our own accounts', /SIGN IN/.test(acc0) && !/CREATE ACCOUNT/.test(acc0) && !/PASSWORD/.test(acc0), acc0.slice(0, 120));
  await A.click('#cg-in'); await sleep(500);
  const acc1 = await A.evaluate(() => ({ text: document.getElementById('pf-acc').textContent, name: EGO.Save.data.name }));
  check('after signing in, the game uses the CrazyGames username', /CRAZYGAMES ACCOUNT/.test(acc1.text) && /Cool Kid77/.test(acc1.text) && acc1.name === 'COOL KID77', acc1);
  await A.screenshot({ path: __dirname + '/shots/cg1_profile.png' });
  // their mute setting wins over the in-game sound setting
  await A.evaluate(() => { window.__cg.listeners.settings({ muteAudio: true, disableChat: false }); EGO.Save.data.settings.mute = false; EGO.Portal.applyMute(); });
  const mute = await A.evaluate(() => EGO.Sfx.muted);
  await A.evaluate(() => window.__cg.listeners.settings({ muteAudio: false, disableChat: false }));
  check('when their page mutes the game, it stays muted', mute === true);

  // rooms and invites
  await A.evaluate(() => EGO.UI.show('lobby')); await A.click('#go-online'); await sleep(300);
  const nameBox = await A.evaluate(() => ({ v: document.getElementById('on-name').value, ro: document.getElementById('on-name').readOnly }));
  await A.click('#on-create'); await sleep(900);
  const code = await A.evaluate(() => EGO.Net.room && EGO.Net.room.code);
  const link = await A.evaluate(() => EGO.Net.inviteLink());
  const c3 = await calls(A);
  const upd = c3.filter((c) => c.startsWith('updateRoom:')).map((c) => JSON.parse(c.slice(11)));
  check('online uses the CrazyGames name (and it cannot be changed)', nameBox.v === 'COOL KID77' && nameBox.ro, nameBox);
  check('the room is shared with their page (room id, joinable, invite params)', upd.length && upd[upd.length - 1].roomId === code && upd[upd.length - 1].isJoinable === true && upd[upd.length - 1].inviteParams.room === code, upd.slice(-1));
  check('the invite link is their link', link === 'https://www.crazygames.com/game/scorz?room=' + code, link);
  const chat0 = await A.evaluate(() => ({ panel: !document.getElementById('on-chat').hidden, type: !document.querySelector('#on-chat .chat-type').hidden, note: document.querySelector('#on-chat .chat-guest').textContent }));
  check('quick chat only (typed chat needs our accounts, which are off here)', chat0.panel && !chat0.type && /TYPED CHAT IS OFF/.test(chat0.note), chat0);
  await A.evaluate(() => window.__cg.listeners.settings({ muteAudio: false, disableChat: true })); await sleep(200);
  const chat1 = await A.evaluate(() => !document.getElementById('on-chat').hidden);
  check('their disableChat setting hides chat', chat1 === false);
  await A.evaluate(() => window.__cg.listeners.settings({ muteAudio: false, disableChat: false }));
  await A.screenshot({ path: __dirname + '/shots/cg2_room.png' });

  // a friend arrives from their invite (the page opens with invite params) and joins straight away
  const B = await mk({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, { invite: { room: code } });
  for (let i = 0; i < 30; i++) { if (await B.evaluate(() => !!(EGO.Net.room)).catch(() => false)) break; await sleep(250); }
  const bIn = await B.evaluate(() => ({ code: EGO.Net.room && EGO.Net.room.code, cur: EGO.UI.cur }));
  check('opened from their invite: straight into the room', bIn.code === code && bIn.cur === 'online', bIn);
  await B.screenshot({ path: __dirname + '/shots/cg3_room_phone.png' });
  // leaving tells their page; their JOIN button (the join listener) brings you back
  await B.click('#on-leave'); await sleep(400);
  const bLeft = (await calls(B)).includes('leftRoom');
  await B.evaluate((c) => window.__cg.listeners.join({ room: c }), code); await sleep(900);
  const bBack = await B.evaluate(() => EGO.Net.room && EGO.Net.room.code);
  check('leaving the room tells their page, and their JOIN button brings you back', bLeft && bBack === code, { bLeft, bBack });
  // instant multiplayer: straight into a new room
  const D = await mk({ viewport: { width: 1280, height: 720 } }, { instant: true });
  for (let i = 0; i < 30; i++) { if (await D.evaluate(() => !!(EGO.Net.room)).catch(() => false)) break; await sleep(250); }
  const dIn = await D.evaluate(() => ({ room: !!EGO.Net.room, host: EGO.Net.room && EGO.Net.room.host === EGO.Net.id }));
  check('instant multiplayer: you land in your own new room', dIn.room && dIn.host, dIn);
  // a CrazyGames build without a server hides online play
  const E = await mk({ viewport: { width: 1280, height: 720 } }, {}, CG_NOSERVER);
  const eOnline = await E.evaluate(() => document.getElementById('go-online').hidden);
  check('without a server address, PLAY WITH FRIENDS is hidden', eOnline === true);
  await E.screenshot({ path: __dirname + '/shots/cg4_lobby_noserver.png' });
  // readable at their test sizes with a device pixel ratio of 1
  const sizes = [[907, 510], [1216, 684], [1366, 768], [800, 450]];
  const fit = [];
  for (const [w, h] of sizes) {
    await E.setViewportSize({ width: w, height: h }); await sleep(400);
    fit.push(await E.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, h: innerHeight })));
  }
  check('their sizes (907x510, 1216x684, 1366x768, 800x450): nothing spills off the screen', fit.every((f) => f.sw <= f.w && f.sh <= f.h), fit);
  await E.setViewportSize({ width: 907, height: 510 }); await sleep(300);
  await E.screenshot({ path: __dirname + '/shots/cg5_lobby_907.png' });

  check('no page errors', logs.length === 0, logs.slice(0, 4));
  check('no server errors', !/Error/.test(out), out.split('\n').slice(1, 5));
  await browser.close(); srv.kill();
  fs.rmSync(OUT, { recursive: true, force: true }); fs.rmSync(OUT2, { recursive: true, force: true });
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.log(results.join('\n')); console.error(e.message.split('\n')[0]); process.exit(1); });
