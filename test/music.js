// Music (Nov 2026, CrazyGames quality: "music that complements the visual experience"): our own tune made by the game
// (no files). Renders the 16-bar loop offline and checks it never clips and sits under the sound effects, saves it as
// test/shots/music-preview.wav to listen to, then checks in the page: music on the start screen and the results, off in a
// match (the crowd), the SOUND button goes SOUND ON -> MUSIC OFF -> SOUND OFF, the pause menu has a Music row, mute stops it.
const fs = require('fs');
const path = require('path');
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

(async () => {
  const { browser, page, logs } = await open();
  // 1. the whole loop, rendered offline through the same instruments
  const r = await page.evaluate(async () => {
    const M = EGO.Music, SR = 44100, s16 = 60 / EGO.MUSIC_BPM / 4, len = 256 * s16 + 1;
    const off = new OfflineAudioContext(2, Math.ceil(SR * len), SR);
    const noise = off.createBuffer(1, SR * 2, SR); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const out = off.createGain(); out.gain.value = EGO.MUSIC_VOL * 0.75; out.connect(off.destination); // the music volume times the master volume
    const realMusic = EGO.Sfx.music; EGO.Sfx.music = () => ({ ctx: off, out, noise });
    M.ctx = off; M.out = out;
    for (let st = 0; st < 256; st++) M.play(st, 0.05 + st * s16);
    const buf = await off.startRendering();
    EGO.Sfx.music = realMusic; M.ctx = null; M.out = null;
    const L = buf.getChannelData(0); let peak = 0, sum = 0;
    for (let i = 0; i < L.length; i++) { const v = Math.abs(L[i]); if (v > peak) peak = v; sum += L[i] * L[i]; }
    // a 16-bit WAV to listen to (mono)
    const n = L.length, wav = new DataView(new ArrayBuffer(44 + n * 2)), w = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); wav.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
    wav.setUint32(24, SR, true); wav.setUint32(28, SR * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); w(36, 'data'); wav.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    let bin = ''; const bytes = new Uint8Array(wav.buffer); for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return { seconds: +(n / SR).toFixed(1), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / L.length).toFixed(3), wav: btoa(bin) };
  });
  const file = path.join(__dirname, 'shots', 'music-preview.wav');
  fs.writeFileSync(file, Buffer.from(r.wav, 'base64'));
  check('the loop is 16 bars, about 33 seconds', r.seconds > 32 && r.seconds < 35, r.seconds);
  check('it never clips, and sits under the sound effects (quiet enough to talk over)', r.peak < 0.9 && r.rms > 0.02 && r.rms < 0.2, { peak: r.peak, rms: r.rms });

  // 2. in the page
  const p = await page.evaluate(() => {
    const M = EGO.Music, G = EGO.Game, d = EGO.Save.data, out = {};
    M.test = true; EGO.Sfx.init(); G.toLobby();
    out.lobby = M.on;
    G.startMatch('quick'); G.stepManual(2); out.match = M.on;
    G.pause(); out.pauseRow = !!document.getElementById('set-music'); document.querySelector('#set-music [data-v="0"]').click(); out.rowOff = d.settings.music === false; document.querySelector('#set-music [data-v="1"]').click(); G.resume();
    G.finishMatch(true); out.after = { state: G.state, music: M.on };
    G.toLobby();
    const btn = document.getElementById('btn-mute'), texts = [btn.textContent];
    for (let i = 0; i < 3; i++) { btn.click(); texts.push(btn.textContent + ':' + (M.on ? 'music' : 'quiet')); }
    out.cycle = texts;
    d.settings.mute = true; EGO.Portal.applyMute(); out.muted = M.on; d.settings.mute = false; EGO.Portal.applyMute(); out.unmuted = M.on;
    return out;
  });
  check('music plays on the start screen', p.lobby === true, p);
  check('a match fades it out (you hear the crowd)', p.match === false, p);
  check('the pause menu has a Music ON/OFF row that works', p.pauseRow && p.rowOff, p);
  check('the SOUND button goes SOUND ON, MUSIC OFF, SOUND OFF and back', p.cycle.join() === 'SOUND ON,MUSIC OFF:quiet,SOUND OFF:quiet,SOUND ON:music', p.cycle);
  check('mute (also CrazyGames\' mute) stops it, unmute brings it back', p.muted === false && p.unmuted === true, p);
  check('no page errors', !logs.some((l) => /PAGEERROR/.test(l)), logs.slice(0, 3));
  await browser.close();
  console.log(results.join('\n'));
  const failed = results.filter((x) => x.startsWith('FAIL')).length;
  console.log(failed ? failed + ' FAILED' : 'ALL ' + results.length + ' PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e); process.exit(1); });
