# SCORZ (formerly EGO BLOCKS): notes for Claude Code

A voxel football game (anime "ego striker" feel, blocky art) that runs in a web browser. Quick Match and Lawless
are 3v3; Ranked grows from 3v3 to 4v4 to 5v5. Rosters are in `ROSTERS` (07_data.js): 3v3 GK DEF MID, 4v4 adds ST, 5v5 is
`SETUPS_5` picked at random per team (ultra defensive: two DEFs, ultra attacking: ST + FW). You play the most attacking
role (`leadRole`), which also takes kickoffs.
The whole game is one HTML page built from the small files in `src/`. No frameworks, no bundler.

## Commands

- `npm install` once. It gets Three.js r128 and the fonts (so the build can put them inside the page) and Playwright for tests.
- `npm run build` builds `docs/index.html`. That single file is the game: open it in Chrome or Edge to play.
- `npm test` runs a quick health check (`test/check.js`). Needs `npx playwright install chromium` once.
- `npm run test:touch` checks the phone controls with real multi-touch on an emulated phone.
- `npm run test:all` runs the main suites.
- Always run `npm run build` after editing anything in `src/`, then `npm test`.

## How the code fits together

`build.js` joins `src/00_head.html` (title, all CSS, the two root elements) and every `src/NN_*.js`
file in file-name order into ONE function scope. There are no imports or exports: a top-level
`const` in `01_core.js` is visible in every later file. Keep top-level names unique across files.

| File | What lives there |
| --- | --- |
| `01_core.js` | math helpers, pitch size `F`, physics constants, `Save` (localStorage), `Sfx` (synth sounds) |
| `02_textures.js` | everything drawn on canvas: pixel font, block textures, pitch lines, player skins, icons (`ICON_MAPS`), rank badges, portraits |
| `03_world.js` | Three.js renderer, scene, camera, stadium, crowd, lights, sky, `QUALITY` presets, `LOOKS` (the bright `day` look by default, or `sunset`: `World.setLook`, saved as `settings.sky`, Sky in the pause menu) |
| `04_fx.js` | particles, beams, screen shake (`Shake`), hit stop and slow motion (`TimeCtl`) |
| `05_player.js` | `Player`: voxel model, animations, movement physics, states (free, dash, slide, down...) |
| `06_ball.js` | `Ball` physics, `solveLaunch` for aimed shots |
| `07_data.js` | `STYLES`, `ABILITIES`, `FLOWS`, `ITEMS`, ranks, spin odds. Most balance numbers live here |
| `08_match.js` | `Match`: rules, kicks, passes, tackles, abilities, goals, restarts, Flow, Lawless items |
| `09_ai.js` | `AI`: bot roles, passing and shooting decisions, keepers |
| `10_input.js` | keyboard, mouse, pointer lock, gamepad, and the camera (`Cam`: third person by default, first person with V / R3 / the touch camera button, saved as `settings.cam`; your own model hides in first person and `Cam.unhide()` shows it again) |
| `10_touch.js` | `Touch`: phone controls (floating stick, drag to look, thumb arc of buttons). `Touch.autoFs()` goes fullscreen when a match starts or online opens (needs a tap, so call it from click handlers), unless `settings.autoFs` is off |
| `11_account.js` | `Account`: optional sign-in, progress sync to the server, friends and their profile cards |
| `11_crazy.js` | `Portal`: the CrazyGames SDK, only active in the CrazyGames build (gameplay start/stop, Data module saves, their account, mute and chat settings, midgame ad at the final whistle, rooms and invites) |
| `11_net.js` | `Net`: online rooms (code, invite link, teams) and `NetMatch`, which draws an online match from server snapshots and sends your controls |
| `11_replay.js` | `Replay`: records the last 10s (player poses + ball every frame), offers replays after your goals, nutmegs and ankle breakers, saves clips with MediaRecorder |
| `11_reveal.js` | `Reveal`: the 3D spin (block drops, shakes in the rarity colour, cracks open). The roll happens in `UI.spin()` first |
| `11_showcase.js` | `Showcase`: your player on a lit spot on the start screen. The camera fits the player into the `#lob-stage` box |
| `11_ui.js` | `UI`: all menus and the HUD (lobby, pause, results, spins, locker, how to play) |
| `12_main.js` | `Game`: state machine, main loop, rewards, auto graphics (`perfCheck` watches for dropped frames and steps down `AUTO_STEPS`: fewer pixels via `World.scale` first, then no shadows; `matchReady` builds all shaders when a match starts), `window.EGO` test hooks |

## Restarts

- `onOut` sets a THROW-IN, CORNER or GOAL KICK; `doRestart` places the taker and sets `p.setPiece` (`throw`, `corner`, `goalkick`) and `m.setPieceBy`. The taker stands still (`maxSpeed` 0), opponents keep back (`updateSetPiece`), pass/shoot play it (`takeSetPiece`, `throwBall`), bots wait `sp.wait`, a human gets 6s. A ball held for a set piece never counts as out. Test: `node test/setpieces.js`.

## Flows, Awakenings, kits, daily

- Each Flow in `FLOWS` has a `color`, an `fx` look (drawn by `FX.flow`, also on the start screen) and `mods`; `start` effects run when it switches on (`stamina`, `resetCd`).
- Each style in `STYLES` has `awaken` (name, desc, `mods`, optional `perk`: `dodge` or `tank`, and `move`: its signature move). Awakening comes by itself: `updateAwakening` rolls `awakenChance(p)` once a second, and big plays (`flowAdd` amounts of 10+) fill the hidden `p.awake` meter that raises the chance. It lasts `AWAKEN_TIME`: cooldowns reset and run x2, ability `fx` set while awakened last 50% longer, and Z (or the Flow button) does the `move` once (`awakenMove`). Online sends `aw`/`awt`/`amu` in `me` and flag 128.
- Emotes: `EMOTES` (07_data.js, shared with the server). B, the smiley touch button or D-pad down opens `#emote-pop` (`UI.toggleEmotes`, `UI.emoteKeys`), `Match.emote` plays the `emote` state. Online sends `em`. Test: `node test/emotes.js`.
- Online rank gap: two or more tiers above every real player on the other team means no rewards for a win or draw (`nm.result.noReward`). Test: `node test/rankgap.js`.
- The `kit` skin slot: skins with `pattern` and `trim`, drawn on the team's colours (`makePlayerSkin`), so sides stay readable. Keepers keep their kit.
- Spin prices are `SPIN_COST` (07_data.js): style 200, Flow 150, skin 100. A duplicate gives 50 back.
- Style spins set `Save.data.spunStyle` (yours until the next style spin replaces it); `d.styles` are kept for good. Blueprints (`d.bp`) are on the start screen's BLUEPRINTS button (`go-goals`, shows the count; the screen lists the GOALS and has a button to the Locker). They come from `GOALS` steps (`Goals.check` after each match, from `d.stats`) and `Goals.unlock` keeps a style (`BP_COST` by rarity). GOALS-only skins have `obj: true` and never come from spins. Test: `node test/blueprints.js`.
- `Daily` (07_data.js): `Save.data.daily`, a gift once per local day and one challenge from `DAILY_CHALLENGES`. No streaks on purpose. Test: `node test/extras.js`.

## Free kick practice

- Mode `freekick` (`MODES.freekick.practice`, FREE KICKS on the start screen): you, a keeper, a wall of 2 to 4 (closer in, bigger) and defenders in the box (`p.wall`, the AI skips them). `startFreeKicks`, `nextFreeKick`, `updateFreeKick`, `fkResult`, `endFreeKicks` in 08_match.js; `m.fk` holds the round. No clock, no Awakening, no rewards; `Game.finishMatch` shows `UI.showPractice` and keeps `Save.data.fkBest`.
- Free kick controls (`p.fkHold`, `freeKickControls`): the camera aims (the target always sits on the goal, `Cam.computeAim`; `Cam.fkFace` turns to it), move X sets `p.fkShot.curve`, pass cycles `FK_TYPES` (CURVE, POWER, DIP), hold shoot for power: off `fkIdeal(D)` by more than `FK_TOL` it flies over the bar or into the wall (`fkLaunch`). DIP uses `ball.gMul` (more gravity). Abilities are off. The keeper is screened until the ball passes the wall and reads knuckleballs late (09_ai.js). `FKHud` (11_fk.js) draws the target, the first part of the path (`fkPath`) and the panel. Test: `node test/freekicks.js`.

## Tutorial

- Mode `tutorial` (`MODES.tutorial`): you, a teammate and one defender, no keeper, no clock. `TUT_STEPS` (07_data.js) has each step's words for keyboard (`k`), controller (`pad`) and phone (`touch`). `startTutorial`, `tutStep` (sets the step up), `updateTutorial` (checks it is done) and `endTutorial` in 08_match.js; `m.tut` holds the state. The others are `p.wall` (the AI skips them) and only do what the step scripts. `TutHud` (11_fk.js) draws the box and the gold square. The first finish gives `TUT_REWARD` and sets `Save.data.tutorial`; the NEW? PLAY THE TUTORIAL button (`go-tut`) shows until then (or 3 matches). Also on How to Play (`howto-tut`). Test: `node test/tutorial.js`.

## Free kick battle

- An offline match still level when golden goal time runs out (`tickClock`, needs `m.human`, not online) goes to `startBattle`: 3 free kicks each (you first), then sudden death; `battleNext` ends it early when one side cannot catch up. It reuses the free kick code (`m.fk.battle`, `fk.shooter`, `fk.bs` goals, `fk.kicks`). Bots take theirs with `botFreeKick`; for theirs you stand in the wall (`p.inWall`: jump only). Battle goals go to `battleGoal`, never the match score. `endBattle` sets `result.res` to win or loss and `result.battle`. Matches with no human (sims, tests) still end as draws. Test: `node test/battle.js`.

## Codes

- The CODES box on the Profile screen: `CODES` in 07_data.js is keyed by `codeHash(text)` (spaces, case and symbols ignored), so the codes themselves never appear in the project. Never write a code in plain text in `src/`, tests, commits or docs (the repo is public). `redeemCode(d, text)` gives the reward once per save (`Save.data.codes`). `give: 'all'` is the owner's tester pack: every style, Flow and skin, +99999 emeralds, +999 blueprints (not rank or level). Test: `node test/codes.js` (set `SCORZ_TESTER_CODE` to check the real code).

## Builds

- `npm run build` makes `docs/index.html` (GitHub Pages, itch.io). `npm run build:crazygames` makes `dist/crazygames/index.html`, the same game with the CrazyGames SDK script in `<head>`.
- build.js puts `const BUILD = { portal, server }` at the top of the game code. `BUILD.portal` is `'crazygames'` only in that build. `SCORZ_SERVER=wss://.../ws` sets `BUILD.server`, the online server address baked into the page. Only use `BUILD` in files 10_ and later (the server's headless loader does not have it).
- Every `Portal` call does nothing when the SDK is not running, so the normal build behaves exactly as before. On CrazyGames our own accounts are hidden (no other logins allowed there).
- `npm run covers` makes the three cover images in `dist/covers/` from the lobby scene. Test: `node test/crazygames.js` (uses a stand-in SDK).

## Online server

- `server/server.js` runs online matches; `server/headless.js` loads `src/01` to `src/09` into Node with stand-ins for canvas, sound, camera and particles. Anything those files call must exist there, so keep browser-only code out of them (put it in 10_ and later files) or give it a stand-in in headless.js.
- Hosting: `render.yaml` runs it on Render's free plan (New > Blueprint in Render). The service link is the game and the server in one. Free instances sleep after 15 minutes with no traffic, so `Net.connect` first wakes a remote `wss:` server with a visit to `/health` ("WAKING THE SERVER UP"). The free filesystem is wiped on restarts, so accounts in `DATA_DIR` do not last there. The live server is https://ego-blocks.onrender.com (the game page and the server in one). `npm run build` bakes `wss://ego-blocks.onrender.com/ws` into the page by default (`DEFAULT_SERVER` in build.js; `SCORZ_SERVER=...` changes it, `SCORZ_SERVER=` leaves it out). `Net.serverUrl` uses the page's own server when a SCORZ server sent the page (localhost, home network, onrender.com: `servedByServer`), else the built-in one, so tests on localhost never touch Render.
- `npm run server` starts it on port 8787 (or `PORT`). `MATCH_SECONDS` and `GOLDEN_SECONDS` shorten matches for tests.
- Online modes: quick, koth, volleys, duel (not Lawless yet). The host's BOTS setting (`room.bots`): `fill` (bots in the empty spots), `keepers` (only computer keepers) or `none` (only the friends; `Match` option `bots`, `keeperOf(team)` is null, a field player takes goal kicks). With bots off each team needs a player. Test: `node test/nobots.js`. Several humans per match: `Match` takes `opts.humans`, each human has `p.ctl`, `p.camYaw`, `p.aimV`, and toasts take the player they are for.
- Drawing online (`Net.applySnapshots`): the picture runs `Net.delay` behind a steady guess of the server's clock (`offMin`, the quickest snapshot lately, on real time). The delay is `NET_DELAY` on a good connection and grows with how late snapshots come (`jit`, up to 0.3s). Past the newest snapshot, players and the ball keep going for up to `NET_COAST` instead of freezing. Test: `node test/netsmooth.js` (fake bumpy connection; `NET_JITTER=0` for a perfect one).
- Tests: `node test/server_proto.js` (protocol) and `node test/online.js` (two real browsers).
- Chat: quick phrases are `QUICK_CHAT` (07_data.js, shared with the server). The server checks every message (`chat()` and `report()` in server.js, the filter in `server/filter.js`): typed chat only for signed-in players, 5 messages per 8 seconds, reports go to `DATA_DIR/reports.jsonl`. Mute is on the player's side (`Net.muted`). Keys: 1 to 4 and T, VIEW + D-pad on a controller, the bubble button on touch. Test: `node test/chat.js`.
- Idle players: `idleStep()` in server.js counts time with no movement or buttons during play (`IDLE_SECONDS`, `IDLE_GRACE`, default 30 + 10), then sets `p.botFor` and takes the player out of `m.humans`. Any active input puts them back. The end message marks `idle`, and `Game.finishMatch` then gives no rewards. Test: `node test/idle.js`.
- Accounts: `server/accounts.js` (scrypt-hashed passwords, hashed tokens, JSON file in `DATA_DIR`), HTTP API under `/api/` in server.js, client in `src/11_account.js` on the Profile screen. Friends only ever get `Accounts.card()`, never the whole save. Test: `node test/accounts.js`.

## Rules to keep

- Three.js is **r128**, loaded as the global `THREE`. Do not use newer APIs (no `outputColorSpace`, no ES module imports from three).
- No image, model or sound files. Textures and icons are drawn on `<canvas>` with `NearestFilter`. Sounds are synthesized in `Sfx`.
- Original names and art only. No names, logos or music from Blue Lock, Minecraft, Roblox or any other brand.
- All three control schemes must keep working: keyboard and mouse, controller, and touch. When you add a player action, wire it into `Input.controls()` (10_input.js), give it a touch button in `10_touch.js`, and list it on the How to Play screen.
- Saved data goes through `Save`. New fields need a default in `Save.defaults()` and sanitizing in `Save.load()`, so old saves keep working.
- Keep `window.EGO` and `Game.stepManual()`. The tests depend on them.
- Layouts must work at 1280x720 (desktop), 844x390 (phone sideways) and 390x844 (phone upright), with no sideways scrolling.
- Player-facing text: short, plain words, no em dashes.

## Testing notes

- Tests run headless Chromium with software WebGL, which is very slow. They advance the game with `EGO.Game.stepManual(frames)` instead of waiting in real time.
- `EGO.simulate(mode, difficulty, seconds, teamSize)` plays a full bot match off screen and returns stats (goals, shots, passes, tackles). Use it to check balance after changing `07_data.js`, `08_match.js` or `09_ai.js`. Healthy: about 3 to 10 goals in a 4 minute match.
- `test/tiers.js` plays its bot matches on the server's copy of the game (`server/headless.js`) before opening the browser: much faster, and 16 games per pair of tiers so it is not luck.
- `node test/stylepower.js [matches] [size] [styles|all] [against]` plays each style's team against ROOKIE (or another style) on the server's copy of the game (`Match` option `teamStyle`). Use 16+ matches; results swing about a goal. Nov 2026 tuning (35 x 55 pitch): everything sits between about -1.5 and +2.5 goals a match against ROOKIE; SPRINTER and BLITZ top, THUNDER bottom (bots are poor long-range bombers). Speed and dash abilities matter most in bot play.
- Keepers (09_ai.js `keeper`): `crossAt` steps the ball's real path (curve, gravity, bounces) to find where it crosses the line; keepers step across and dive late (`tk < 0.5`, except free kicks) and react later to tricky shots (volley, overhead, knuckle, long bomb; free kick curlers and knuckleballs more). Bots aim their power abilities at the corners (`aimFor(p, m, true)`).
- `node test/balance.js [matches] [sizes] [skills]` runs those matches for every team size and a few bot skill levels and prints the averages. Results swing a lot from match to match, so use 4 or more matches per setting.
- Bot positions are tuned on the first, smaller pitch and scaled by `PITCH_KX` / `PITCH_KZ` (01_core.js), so changing `F` keeps the AI shape.
- `node test/soak.js` plays every mode start to finish with a button masher at uneven frame rates and checks every frame (NaN, players outside, the ball inside the stands, long stops, the match ending). `SOAK_MODES=quick,duel` and `SOAK_SECS` pick modes and length. `test/smooth.js` holds the checks for bugs found that way.
- The ball lands on and bounces off the stands (`standTop`, `STAND` in 01_core.js, `Ball.collideStands`); `World.buildStands` uses the same numbers.
- Screenshots from tests are saved in `test/shots/`. Look at them after UI changes.

## Working with the owner

- The owner is learning. Explain what you changed in simple words, and do one feature at a time.
- If an idea would make the game worse, harder to play or unsafe for players, say so and suggest a better version before building it.
- Their feature list, in order, is in `ROADMAP.md`.
