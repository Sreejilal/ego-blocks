// Style power: a team of each style against a team of another (ROOKIE by default), same bot skill, ends swapped every match.
// Runs on the server's copy of the game (fast). Results swing about a goal from run to run, so use 16 or more matches.
// Usage: node test/stylepower.js [matches] [team size] [styles,... or all] [against]
const G = require('../server/headless').load();
const N = +(process.argv[2] || 16), SIZE = +(process.argv[3] || 3), VS = process.argv[5] || 'ROOKIE';
const list = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : Object.keys(G.STYLES).filter((s) => s !== VS);
for (const st of list) {
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (let i = 0; i < N; i++) {
    const side = i % 2;
    const m = new G.Match('quick', 0.6, { noHuman: true, autopilot: true, length: 240, size: SIZE, teamD: [0.6, 0.6], teamStyle: side ? [VS, st] : [st, VS] });
    for (let t = 0; m.phase !== 'end' && t < 900; t += 1 / 60) m.update(1 / 60);
    const a = m.score[side], b = m.score[1 - side];
    gf += a; ga += b; if (a > b) w++; else if (a < b) l++; else d++;
    m.dispose();
  }
  console.log(st.padEnd(10), G.STYLES[st].rarity.padEnd(12), 'W' + w, 'D' + d, 'L' + l, ' goals for ' + (gf / N).toFixed(2), ' against ' + (ga / N).toFixed(2), ' difference ' + ((gf - ga) / N).toFixed(2));
}
