// The app's icon and store pictures (npm run appicons): our own blocky ball on SCORZ blue, drawn on a canvas.
// Writes the Android launcher icons into app/android and the Play Store pictures into app/store/.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), RES = path.join(ROOT, 'app/android/app/src/main/res'), STORE = path.join(ROOT, 'app/store');
const SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const cover = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'dist/covers/cover-landscape-1920x1080.png')).toString('base64');
  const out = await page.evaluate(async ({ SIZES, cover }) => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
    // the ball: a circle on a 14 x 14 grid of blocks, white with dark patches and a shaded edge
    const ball = (ctx, cx, cy, r) => {
      const N = 14, s = (r * 2) / N, dark = ['5,2', '6,2', '7,2', '8,2', '6,3', '7,3', '2,6', '2,7', '3,6', '3,7', '2,8', '10,6', '11,6', '10,7', '11,7', '11,8', '6,6', '7,6', '6,7', '7,7', '5,7', '8,7', '6,8', '7,8', '5,11', '6,11', '7,11', '8,11', '6,10', '7,10'];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - N / 2, dy = y + 0.5 - N / 2, d = Math.hypot(dx, dy);
        if (d > N / 2) continue;
        const edge = d > N / 2 - 1.3, low = dy > 2.5 && dx > -5;
        ctx.fillStyle = dark.includes(x + ',' + y) ? '#141a2e' : edge ? (low ? '#b9c2d6' : '#dfe5f2') : low && d > 4 ? '#d3daea' : '#ffffff';
        ctx.fillRect(Math.round(cx - r + x * s), Math.round(cy - r + y * s), Math.ceil(s), Math.ceil(s));
      }
    };
    const bg = (ctx, S) => { const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#3d7dff'); g.addColorStop(1, '#16308f'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#2f9e4f'; ctx.fillRect(0, S * 0.8, S, S * 0.2); ctx.fillStyle = '#3bb85f'; ctx.fillRect(0, S * 0.8, S, S * 0.035); };
    const full = mk(1024); { const c = full.getContext('2d'); bg(c, 1024); c.fillStyle = 'rgba(9,11,22,.35)'; c.fillRect(1024 * 0.26, 1024 * 0.8, 1024 * 0.52, 1024 * 0.03); ball(c, 512, 500, 330); }
    const fore = mk(1024); ball(fore.getContext('2d'), 512, 512, 250); // adaptive icon: keep inside the safe middle
    const scale = (src, S, round) => { const c = mk(S), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; if (round) { x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, 7); x.clip(); } x.drawImage(src, 0, 0, S, S); return c.toDataURL('image/png'); };
    const files = {};
    for (const [k, S] of Object.entries(SIZES)) { files[`mipmap-${k}/ic_launcher.png`] = scale(full, S); files[`mipmap-${k}/ic_launcher_round.png`] = scale(full, S, true); files[`mipmap-${k}/ic_launcher_foreground.png`] = scale(fore, Math.round(S * 108 / 48)); }
    files['STORE/icon-512.png'] = scale(full, 512);
    const img = new Image(); img.src = cover; await img.decode();
    const f = mk(1024, 500), fx = f.getContext('2d'); fx.imageSmoothingQuality = 'high'; fx.drawImage(img, 0, 40, 1920, 937, 0, 0, 1024, 500); // the Play Store feature graphic, from our cover
    files['STORE/feature-1024x500.png'] = f.toDataURL('image/png');
    return files;
  }, { SIZES, cover });
  fs.mkdirSync(STORE, { recursive: true });
  for (const [name, url] of Object.entries(out)) { const p = name.startsWith('STORE/') ? path.join(STORE, name.slice(6)) : path.join(RES, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64')); }
  await browser.close();
  console.log('made', Object.keys(out).length, 'pictures: launcher icons in app/android, store pictures in app/store');
})().catch((e) => { console.error(e); process.exit(1); });
