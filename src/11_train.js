/* =====================================================================
   TrainUI: the TRAINING screen (owner, Nov 2026: "add training stuff like defending or running"): the SPRINT and DEFENDING
   drills with their stars, best result and the reward for each star, then FREE KICKS, KEEPER PRACTICE and the TUTORIAL.
   A drill ends with UI.showDrill (from Game.finishMatch, Drill.finish)
   ===================================================================== */
const TrainUI = {
  tpl() {
    return `<section id="scr-train" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>TRAINING</h2><button class="btn small" id="train-back" type="button">BACK</button></div>
        <section class="panel tr-box"><div class="gp-th"><h3>DRILLS</h3><span class="gp-th-l">Earn up to 3 stars. Each star pays out the first time you reach it.</span></div><div class="tr-grid" id="tr-drills"></div></section>
        <section class="panel tr-box"><div class="gp-th"><h3>PRACTICE</h3><span class="gp-th-l">No clock, no pressure.</span></div><div class="tr-grid" id="tr-practice"></div></section>
      </div>
    </section>`;
  },
  bind() {
    $('train-back').addEventListener('click', () => { Sfx.click(); UI.show('lobby'); });
    $('scr-train').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b || !MODES[b.dataset.mode]) return; Sfx.init(); Sfx.click(); Game.startMatch(b.dataset.mode); });
  },
  stars(n) { return `<span class="dr-stars" aria-label="${n} of 3 stars">${[1, 2, 3].map((k) => `<i${k <= n ? ' class="on"' : ''}></i>`).join('')}</span>`; },
  best(id, rec) { return rec && rec.best != null ? (id === 'drillrun' ? 'BEST ' + rec.best.toFixed(2) + 'S' : 'BEST ' + rec.best + ' / ' + DRILL_ATTACKS) : 'NOT TRIED YET'; },
  render() {
    const d = Save.data;
    $('tr-drills').innerHTML = Object.keys(DRILLS).map((id) => {
      const D = DRILLS[id], rec = d.drills[id] || { best: null, stars: 0 };
      const next = D.reward[rec.stars] ? 'NEXT STAR: ' + loginText(D.reward[rec.stars]) : 'ALL 3 STARS';
      return `<button class="tr-card" type="button" id="go-${id}" data-mode="${id}" style="--mc:${D.hex}"><span class="md-tile"><img class="px" alt="" src="${iconURL(D.icon, D.hex)}"></span>
        <span class="md-txt"><span class="md-n"><b>${D.name}</b></span><span class="md-d">${D.line}</span><span class="tr-meta">${this.stars(rec.stars)}<span>${this.best(id, rec)}</span><span class="tr-next">${next}</span></span></span></button>`;
    }).join('');
    const prac = [['freekick', 'go-fk', 'BEST ' + (d.fkBest || 0) + ' GOALS'], ['fkkeeper', 'go-fkk', ''], ['tutorial', 'go-tut2', d.tutorial ? 'DONE' : 'NEW? START HERE']];
    $('tr-practice').innerHTML = prac.map(([k, id, meta]) => `<button class="tr-card" type="button" id="${id}" data-mode="${k}" style="--mc:${MODE_ART[k].hex}"><span class="md-tile"><img class="px" alt="" src="${modeIcon(k)}"></span>
      <span class="md-txt"><span class="md-n"><b>${MODES[k].name}</b></span><span class="md-d">${MODE_ART[k].line}</span>${meta ? `<span class="tr-meta"><span>${meta}</span></span>` : ''}</span></button>`).join('');
  },
};
