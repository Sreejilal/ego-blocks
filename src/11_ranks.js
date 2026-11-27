/* =====================================================================
   RankUI: the RANK ROAD (owner, Nov 27 2026: "ranked has no rewards to fight for that you can see"). Every step of
   RANK_ROAD with its reward, your RP on the road, what you already got, the next one, and the skin at every new rank.
   Opened from the rank panel on the start screen (and its RANK ROAD button) and from RANKED results. Rewards are paid by
   Rank.claim after a ranked match (Game.finishMatch) and when the road is opened (an old save with RP already)
   ===================================================================== */
const RankUI = {
  tpl() {
    return `<section id="scr-ranks" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>RANK ROAD</h2><button class="btn small" id="ranks-back" type="button">BACK</button></div>
        <section class="panel rr-top" id="rr-top"></section>
        <section class="panel rr-box"><div class="rr-road" id="rr-road"></div></section>
      </div>
    </section>`;
  },
  bind() {
    $('ranks-back').addEventListener('click', () => { Sfx.click(); UI.show('lobby'); });
    $('scr-ranks').addEventListener('click', (e) => { if (e.target.closest('#rr-play')) { Sfx.init(); Sfx.click(); Game.startMatch('ranked'); } });
  },
  open() {
    const got = Rank.claim(Save.data);
    if (got.length) { Save.save(); UI.toast('RANK ROAD: ' + got.map((s) => Rank.text(s)).join(', '), 'gold'); Sfx.fanfare(2); }
    UI.show('ranks');
  },
  render() {
    const d = Save.data, tier = tierOf(d.rp), nx = Rank.next(d), top = RANK_ROAD[RANK_ROAD.length - 1].rp;
    $('rr-top').innerHTML = `<img class="px rr-badge" src="${badgeURL(tier)}" alt=""><div class="rr-now"><span class="label">YOUR RANK</span><b>${TIER_NAMES[tier]} · ${d.rp} RP</b>`
      + `<div class="rr-bar"><i style="width:${Math.min(100, d.rp / top * 100).toFixed(1)}%"></i></div>`
      + `<span class="rr-next">${nx ? 'NEXT: ' + Rank.text(nx) + ' AT ' + nx.rp + ' RP (' + Math.max(0, nx.rp - d.rp) + ' TO GO)' : 'THE WHOLE ROAD IS YOURS. KEEP CLIMBING FOR GLORY'}</span></div>`
      + `<button class="btn blue" id="rr-play" type="button">PLAY RANKED</button>`;
    $('rr-road').innerHTML = RANK_ROAD.map((s) => {
      const have = s.rp <= (d.rankGot || 0), next = nx === s, rk = s.skin ? SKINS[s.skin].rank : -1;
      return `<div class="rr-step${have ? ' got' : ''}${next ? ' next' : ''}${s.skin ? ' big' : ''}">
        <span class="rr-rp">${s.rp} RP</span>${s.skin ? `<img class="px rr-tb" src="${badgeURL(rk)}" alt=""><b class="rr-tn">${TIER_NAMES[rk]}</b>` : ''}
        ${s.skin ? `<i class="rr-art" data-skin="${s.skin}"></i>` : `<img class="px rr-ico" alt="" src="${s.bp && !s.em ? iconURL('shield', '#4aa8ff') : iconURL('emerald')}">`}
        <span class="rr-what">${Rank.text(s)}</span><span class="rr-state">${have ? 'YOURS' : next ? 'NEXT' : 'LOCKED'}</span></div>`;
    }).join('');
    for (const el of document.querySelectorAll('#rr-road .rr-art')) { const cv = skinCanvas(el.dataset.skin, 56); cv.className = 'px rr-skin'; el.replaceWith(cv); }
    const n = document.querySelector('#rr-road .rr-step.next'); if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest', inline: 'center' });
  },
};
