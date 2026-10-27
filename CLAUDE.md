# SCORZ (formerly EGO BLOCKS): notes for Claude Code

A voxel football game (anime "ego striker" feel, blocky art) that runs in a web browser. Quick Match and Lawless
are 3v3; Ranked grows from 3v3 to 4v4 (Iron) to 5v5 (Diamond). Rosters are in `ROSTERS` (07_data.js).
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
| `03_world.js` | Three.js renderer, scene, camera, stadium, crowd, lights, sky, `QUALITY` presets |
| `04_fx.js` | particles, beams, screen shake (`Shake`), hit stop and slow motion (`TimeCtl`) |
| `05_player.js` | `Player`: voxel model, animations, movement physics, states (free, dash, slide, down...) |
| `06_ball.js` | `Ball` physics, `solveLaunch` for aimed shots |
| `07_data.js` | `STYLES`, `ABILITIES`, `FLOWS`, `ITEMS`, ranks, spin odds. Most balance numbers live here |
| `08_match.js` | `Match`: rules, kicks, passes, tackles, abilities, goals, restarts, Flow, Lawless items |
| `09_ai.js` | `AI`: bot roles, passing and shooting decisions, keepers |
| `10_input.js` | keyboard, mouse, pointer lock, gamepad, and the camera (`Cam`) |
| `10_touch.js` | `Touch`: phone controls (floating stick, drag to look, thumb arc of buttons) |
| `11_net.js` | `Net`: online rooms (code, invite link, teams) and `NetMatch`, which draws an online match from server snapshots and sends your controls |
| `11_replay.js` | `Replay`: records the last 10s (player poses + ball every frame), offers replays after your goals, nutmegs and ankle breakers, saves clips with MediaRecorder |
| `11_reveal.js` | `Reveal`: the 3D spin (block drops, shakes in the rarity colour, cracks open). The roll happens in `UI.spin()` first |
| `11_showcase.js` | `Showcase`: your player on a lit spot on the start screen. The camera fits the player into the `#lob-stage` box |
| `11_ui.js` | `UI`: all menus and the HUD (lobby, pause, results, spins, locker, how to play) |
| `12_main.js` | `Game`: state machine, main loop, rewards, auto graphics, `window.EGO` test hooks |

## Online server

- `server/server.js` runs online matches; `server/headless.js` loads `src/01` to `src/09` into Node with stand-ins for canvas, sound, camera and particles. Anything those files call must exist there, so keep browser-only code out of them (put it in 10_ and later files) or give it a stand-in in headless.js.
- `npm run server` starts it on port 8787 (or `PORT`). `MATCH_SECONDS` and `GOLDEN_SECONDS` shorten matches for tests.
- Online modes: quick, koth, volleys, duel (not Lawless yet). Several humans per match: `Match` takes `opts.humans`, each human has `p.ctl`, `p.camYaw`, `p.aimV`, and toasts take the player they are for.
- Tests: `node test/server_proto.js` (protocol) and `node test/online.js` (two real browsers).

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
- `node test/balance.js [matches] [sizes] [skills]` runs those matches for every team size and a few bot skill levels and prints the averages. Results swing a lot from match to match, so use 4 or more matches per setting.
- Bot positions are tuned on the first, smaller pitch and scaled by `PITCH_KX` / `PITCH_KZ` (01_core.js), so changing `F` keeps the AI shape.
- Screenshots from tests are saved in `test/shots/`. Look at them after UI changes.

## Working with the owner

- The owner is learning. Explain what you changed in simple words, and do one feature at a time.
- If an idea would make the game worse, harder to play or unsafe for players, say so and suggest a better version before building it.
- Their feature list, in order, is in `ROADMAP.md`.
