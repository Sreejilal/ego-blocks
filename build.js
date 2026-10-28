#!/usr/bin/env node
/*
 * Build script: joins src/ into one playable HTML file.
 *
 *   node build.js              -> docs/index.html  (the public game: open it, or host it anywhere)
 *   node build.js --artifact   -> also dist/ego-blocks.html (body-only version for a claude.ai artifact)
 *   node build.js --crazygames -> also dist/crazygames/index.html (with the CrazyGames SDK, for their portal)
 *
 * SCORZ_SERVER=wss://your-server/ws bakes an online server address into the builds
 * (needed on CrazyGames and on GitHub Pages, which cannot run the server themselves).
 *
 * docs/index.html is fully self-contained when `npm install` has been run:
 * Three.js and the three pixel fonts are inlined, so it works offline, on
 * itch.io as a single file, on GitHub Pages (folder /docs) and on game portals.
 * Without node_modules it falls back to the Three.js CDN and Google Fonts.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const FONTS = [
  // [css family, @fontsource package, file, weight]
  ['Jersey 10', 'jersey-10', 'jersey-10-latin-400-normal.woff2', 400],
  ['Jersey 15', 'jersey-15', 'jersey-15-latin-400-normal.woff2', 400],
  ['Silkscreen', 'silkscreen', 'silkscreen-latin-400-normal.woff2', 400],
  ['Silkscreen', 'silkscreen', 'silkscreen-latin-700-normal.woff2', 700],
];

// ---- 1. read sources -------------------------------------------------------
const head = fs.readFileSync(path.join(SRC, '00_head.html'), 'utf8');
const modules = fs.readdirSync(SRC).filter((f) => /^\d\d_.*\.js$/.test(f)).sort();
const js = modules.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

// every module shares one scope inside this wrapper, in file-name order
const guard = "if (typeof THREE === 'undefined') { var bt = document.getElementById('boot'); if (bt) bt.textContent = 'COULD NOT LOAD THE 3D ENGINE. CHECK YOUR CONNECTION AND RELOAD.'; return; }";
const SERVER = String(process.env.SCORZ_SERVER || '').trim();
if (SERVER && !/^wss?:\/\/[^\s'"<>]+$/.test(SERVER)) { console.error('SCORZ_SERVER must look like wss://your-server/ws'); process.exit(1); }
const gameFor = (cfg) => "(function () {\n'use strict';\n" + guard + '\nconst BUILD = ' + JSON.stringify(cfg) + ';\n' + js + '\n})();\n';
const game = gameFor({ portal: null, server: SERVER });

// ---- 2. syntax check without running anything ------------------------------
try { new vm.Script(game, { filename: 'game.js' }); }
catch (e) { console.error('SYNTAX ERROR in the game code:\n' + e.stack.split('\n').slice(0, 6).join('\n')); process.exit(1); }

// ---- 3. split 00_head.html into its <head> part and its <body> part --------
const titleM = head.match(/<title>[\s\S]*?<\/title>/);
const styleM = head.match(/<style>[\s\S]*?<\/style>/);
if (!titleM || !styleM) { console.error('src/00_head.html needs a <title> and a <style> block'); process.exit(1); }
const fontLinks = head.split('\n').filter((l) => /fonts\.(googleapis|gstatic)\.com/.test(l)).join('\n');
const bodyPart = head.slice(styleM.index + styleM[0].length).trim();

// ---- 4. optional inlining of Three.js and fonts ----------------------------
const safeScript = (code) => code.replace(/<\/script/gi, '<\\/script');
const threeFile = path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js');
let threeTag, fontTag, inlined = [];
if (fs.existsSync(threeFile)) { threeTag = '<script>\n' + safeScript(fs.readFileSync(threeFile, 'utf8')) + '\n</script>'; inlined.push('three.js'); }
else threeTag = `<script src="${THREE_CDN}"></script>`;
const fontFiles = FONTS.map(([fam, pkg, file, w]) => ({ fam, w, p: path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files', file) }));
if (fontFiles.every((f) => fs.existsSync(f.p))) {
  fontTag = '<style>\n' + fontFiles.map((f) => `@font-face{font-family:'${f.fam}';font-style:normal;font-weight:${f.w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(f.p).toString('base64')}) format('woff2');}`).join('\n') + '\n</style>';
  inlined.push('fonts');
} else fontTag = fontLinks;

// ---- 5. the public page ----------------------------------------------------
const pageFor = (code, extraHead) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#090b16">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="SCORZ: voxel football in your browser, 3v3 up to 5v5. Pick a style, find your Flow, climb from Wood to Obsidian.">
${titleM[0]}${extraHead}
${fontTag}
${styleM[0]}
</head>
<body>
${bodyPart}
${threeTag}
<script>
${safeScript(code)}</script>
</body>
</html>
`;
const page = pageFor(game, '');
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'index.html'), page);
console.log('built docs/index.html', (page.length / 1024).toFixed(0) + ' KB,', modules.length, 'modules,', inlined.length ? 'inlined: ' + inlined.join(' + ') : 'using CDN (run npm install to inline)');

// ---- 6. the CrazyGames page: their SDK in <head>, nothing else changes ------
if (process.argv.includes('--crazygames')) {
  const cg = pageFor(gameFor({ portal: 'crazygames', server: SERVER }), '\n<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>');
  const outDir = process.env.SCORZ_CG_OUT || path.join(ROOT, 'dist', 'crazygames'); // tests build into a temp folder
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), cg);
  console.log('built ' + path.relative(ROOT, path.join(outDir, 'index.html')), (cg.length / 1024).toFixed(0) + ' KB,', SERVER ? 'online server ' + SERVER : 'no online server (PLAY WITH FRIENDS is hidden; set SCORZ_SERVER)');
}

// ---- 7. claude.ai artifact version (body only; the host adds the skeleton) --
if (process.argv.includes('--artifact')) {
  const out = head + `\n<script src="${THREE_CDN}"></script>\n<script>\n${safeScript(game)}</script>\n`;
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist', 'ego-blocks.html'), out);
  console.log('built dist/ego-blocks.html', (out.length / 1024).toFixed(0) + ' KB');
}
