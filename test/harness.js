// Shared Playwright harness: opens the built game (docs/index.html) in headless Chromium.
// Software WebGL (SwiftShader) is slow, so tests drive frames with EGO.Game.stepManual(n)
// instead of waiting on real time. Run `node build.js` first.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'docs', 'index.html');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true }); // screenshots land here

async function open(opts = {}) {
  if (!fs.existsSync(PAGE)) throw new Error('docs/index.html is missing. Run `node build.js` first.');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctxOpts = { viewport: opts.viewport || { width: 1280, height: 720 } };
  if (opts.mobile) Object.assign(ctxOpts, { hasTouch: true, isMobile: true, deviceScaleFactor: opts.dpr || 2 });
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning' || opts.verbose) logs.push(t + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  // only used when the build fell back to the CDN (no node_modules at build time)
  const three = path.join(ROOT, 'node_modules/three/build/three.min.js');
  if (fs.existsSync(three)) await page.route('**/three.min.js', (r) => r.fulfill({ path: three, contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
  if (opts.clearStorage !== false) await page.addInitScript(() => { try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } } catch (e) {} });
  await page.goto('file://' + PAGE);
  await page.waitForTimeout(opts.wait || 2500);
  return { browser, page, logs, context };
}
module.exports = { open, ROOT };
