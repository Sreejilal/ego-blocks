/*
 * Runs the game's own match code (src/01 to src/09) inside Node, so the server plays exactly the same
 * football as the browser. Everything that only makes sense on screen (canvas, sound, camera, touch,
 * particles, slow motion) is replaced with a stand-in that does nothing.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const THREE = require('three');

const SRC = path.join(__dirname, '..', 'src');
const FILES = ['01_core.js', '02_textures.js', '03_world.js', '04_fx.js', '05_player.js', '06_ball.js', '07_data.js', '08_match.js', '09_ai.js'];

// a canvas that accepts every drawing call and draws nothing
const PRELUDE = `
const fakeCtx = new Proxy({}, {
  get: (t, k) => (k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) : () => {}),
  set: () => true,
});
const document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => fakeCtx, toDataURL: () => '' }), getElementById: () => null, body: { classList: { toggle() {}, add() {}, remove() {} } } };
const window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };
const Touch = { on: false, faceGoal() {} };
const Replay = { event() {} };
const Cam = { punch() {} };
`;
const EPILOGUE = `
World.scene = new THREE.Scene();
World.T = makeBlockTextures();
World.buildGoals();
FX.init(World.scene);
FX.lit.spawn = FX.glow.spawn = () => {};
FX.beam = FX.rocket = () => {};
TimeCtl.slowMo = TimeCtl.hitStop = () => {};
Shake.add = () => {};
Save.data = Save.defaults();
Save.data.settings.cutins = false;
return { Match, World, Save, Hud, TEAM, MODES, ROSTERS, CLUBS, CLUB_IDS, STYLES, FLOWS, SKINS, SKIN_SLOTS, matchSides, teamSizeFor, lookFor };
`;

function load() {
  const code = FILES.map((f) => '/* ---- ' + f + ' ---- */\n' + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  const src = "(function () {\n'use strict';\n" + PRELUDE + code + EPILOGUE + '\n})()';
  const ctx = vm.createContext({ THREE, console, Math, Date, performance: { now: () => Date.now() }, setTimeout, clearTimeout, Proxy, Uint8ClampedArray, Float32Array, Uint8Array, Map, Set, JSON });
  return vm.runInContext(src, ctx, { filename: 'scorz-headless.js' });
}

module.exports = { load };
