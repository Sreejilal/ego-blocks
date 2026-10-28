#!/usr/bin/env node
/*
 * Makes the three CrazyGames cover images from the game itself, with only the title on them
 * (their rules: no other text, no icons or logos, no borders):
 *   landscape 1920x1080, portrait 800x1200, square 800x800  ->  dist/covers/
 *
 *   npm run build      (once, so docs/index.html is up to date)
 *   npm run covers
 *
 * The images are for the submission form only. They are not part of the game and are not committed.
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'covers');
// where the title and the player go on each cover, in % of the image
const COVERS = [
  { name: 'cover-landscape-1920x1080.png', w: 1920, h: 1080, title: { left: 7, top: 33, size: 330 }, stage: { left: 50, top: 3, width: 44, height: 95 } },
  { name: 'cover-portrait-800x1200.png', w: 800, h: 1200, title: { left: 0, top: 5, size: 230, center: true }, stage: { left: 8, top: 25, width: 84, height: 73 } },
  { name: 'cover-square-800x800.png', w: 800, h: 800, title: { left: 6, top: 6, size: 190 }, stage: { left: 34, top: 14, width: 62, height: 84 } },
];
const LOOK = { style: 'THUNDER', look: { hair: 'MOHAWK' }, club: 'EMBER' }; // a flashy player for the covers

(async () => {
  const page = path.join(ROOT, 'docs', 'index.html');
  if (!fs.existsSync(page)) { console.error('Run npm run build first.'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const c of COVERS) {
    const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(pathToFileURL(page).href);
    await p.waitForFunction(() => window.EGO && EGO.Game.state === 'lobby', null, { timeout: 30000 });
    await p.evaluate((L) => {
      const d = EGO.Save.data;
      d.style = L.style; Object.assign(d.look, L.look); d.club = L.club; d.settings.quality = 'high';
      EGO.Game.applyQuality(); EGO.Showcase.ensure(); EGO.UI.renderLobby();
      EGO.Showcase.setStage('lob-stage', 'locker'); // standing still, face to the camera, the ball not in the way
      // covers may show only the title, so the words on the advertising boards go
      EGO.World.scene.traverse((o) => { if (o.material && o.material.map && o.material.map === EGO.World.T.ads) o.visible = false; });
    }, LOOK);
    const t = c.title, s = c.stage;
    await p.addStyleTag({ content: `
      #scr-lobby .topbar, #scr-lobby .tagline, #scr-lobby .menu, #scr-lobby .lobby-foot { visibility: hidden !important; }
      #scr-lobby .lob-stage { position: fixed !important; left: ${s.left}% !important; top: ${s.top}% !important; width: ${s.width}% !important; height: ${s.height}% !important; margin: 0 !important; }
      #scr-lobby .title { position: fixed !important; top: ${t.top}% !important; ${t.center ? 'left: 0 !important; right: 0 !important; text-align: center;' : `left: ${t.left}% !important;`} font-size: ${t.size}px !important; margin: 0 !important; }
      #scr-lobby .title .t1 { text-shadow: ${t.size / 30}px ${t.size / 30}px 0 var(--blue-deep), ${t.size / 15}px ${t.size / 15}px 0 var(--ink) !important; }
      #scr-lobby .title .t2 { text-shadow: ${t.size / 30}px ${t.size / 30}px 0 var(--ink), ${t.size / 15}px ${t.size / 15}px 0 rgba(0,0,0,.4) !important; }
    ` });
    await p.waitForTimeout(5000); // let the player settle into the new box and the lights warm up
    await p.evaluate(() => EGO.FX.clear()); await p.waitForTimeout(150); // no sparkles floating over the face
    await p.screenshot({ path: path.join(OUT, c.name) });
    console.log('saved dist/covers/' + c.name);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e.message.split('\n')[0]); process.exit(1); });
