// Menu sounds: hovering a button ticks, pressing one tocks, screens whoosh in and out, EQUIP has its own sound,
// muted means silent, and the touch controls are not buttons (so shooting and passing never tock).
// Counts the sound makers (oscillators and noise sources) the page asks the browser for.
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

(async () => {
  const { browser, page, logs } = await open({ wait: 1200 });
  await page.addInitScript(() => {
    window.__snd = { osc: 0, noise: 0 };
    const A = window.AudioContext || window.webkitAudioContext, P = A.prototype;
    const o = P.createOscillator, n = P.createBufferSource;
    P.createOscillator = function () { window.__snd.osc++; return o.call(this); };
    P.createBufferSource = function () { window.__snd.noise++; return n.call(this); };
  });
  await page.reload(); await page.waitForTimeout(1500);
  const snap = () => page.evaluate(() => Object.assign({}, window.__snd));
  const centre = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  await page.mouse.click(5, 5); // the first touch of the page starts the sound
  await page.waitForTimeout(200);

  const a = await snap(); const p = await centre('#go-locker');
  await page.mouse.move(p.x, p.y); await page.waitForTimeout(150);
  const b = await snap();
  check('hovering a button ticks', b.osc - a.osc === 1, { before: a, after: b });

  await page.mouse.click(p.x, p.y); await page.waitForTimeout(300);
  const c = await snap();
  const onLocker = await page.evaluate(() => EGO.UI.cur);
  check('pressing a button tocks once, and the new screen whooshes in', onLocker === 'locker' && c.osc - b.osc >= 3 && c.osc - b.osc <= 6 && c.noise - b.noise >= 2, { screen: onLocker, osc: c.osc - b.osc, noise: c.noise - b.noise });

  const q = await centre('#locker-back');
  await page.mouse.click(q.x, q.y); await page.waitForTimeout(300);
  const d = await snap();
  check('BACK tocks lower and the screen whooshes out', (await page.evaluate(() => EGO.UI.cur)) === 'lobby' && d.osc - c.osc >= 2 && d.noise - c.noise >= 1, { osc: d.osc - c.osc, noise: d.noise - c.noise });

  // EQUIP: its own sound, not a tock on top
  await page.evaluate(() => { const s = EGO.Save.data; if (!s.styles.includes('SPARK')) s.styles.push('SPARK'); EGO.UI.openLocker(); EGO.UI.lockerSel = 'SPARK'; EGO.UI.renderLocker(); });
  await page.waitForTimeout(300);
  const e0 = await snap();
  await page.evaluate(() => document.getElementById('lk-equip').click()); await page.waitForTimeout(200);
  const e1 = await snap();
  check('EQUIP plays its own sound (three notes, no extra tock)', e1.osc - e0.osc === 3 && (await page.evaluate(() => EGO.Save.data.style)) === 'SPARK', { osc: e1.osc - e0.osc });

  // muted: silence
  await page.evaluate(() => { EGO.Sfx.setMuted(true); });
  const m0 = await snap();
  await page.evaluate(() => document.getElementById('locker-back').click()); await page.waitForTimeout(200);
  const m1 = await snap();
  check('muted, the menus are silent', m1.osc === m0.osc && m1.noise === m0.noise, { osc: m1.osc - m0.osc });
  await page.evaluate(() => { EGO.Sfx.setMuted(false); });

  const touchBtns = await page.evaluate(() => document.querySelectorAll('#touch button, #touch [role=button], #touch .tab').length);
  check('the touch controls are not buttons, so shooting and passing never tock', touchBtns === 0, touchBtns);

  check('no errors in the console', !logs.some((l) => /PAGEERROR|error/i.test(l)), logs.slice(0, 5));
  console.log(results.join('\n'));
  await browser.close();
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
