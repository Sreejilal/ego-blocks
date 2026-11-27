// MY CLUB's MARKET (owner, Nov 27 2026: "sell and buy players from the market"; players you sell go up): a daily list of
// characters you do not have, bought with emeralds; selling pays half and puts them back on the market for more; story
// characters and your captain stay. Plus pictures of the three tabs (SQUAD with the captain in 3D, LOCKER ROOM, MARKET).
// node test/market.js   (run `npm run build` first)
const G = require('../server/headless').load();
const { open } = require('./harness');
const results = [];
const check = (name, ok, info) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

process.on('unhandledRejection', (e) => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
(async () => {
  // ---- the rules ----
  const d = G.Save.defaults(); d.emeralds = 20000; d.styles.push('ROGUE', 'BASTION');
  const l1 = G.Market.list(d, '2026-11-27'), l1b = G.Market.list(d, '2026-11-27'), l2 = G.Market.list(d, '2026-11-28');
  check('a list of characters you do not have yet (never story characters), the same all day, a new one tomorrow', l1.length === 6 && l1.every((o) => !d.styles.includes(o.id) && !G.STYLES[o.id].story && o.price === G.MKT_PRICE[G.STYLES[o.id].rarity]) && l1.map((o) => o.id).join() === l1b.map((o) => o.id).join() && l1.map((o) => o.id).join() !== l2.map((o) => o.id).join(), l1.map((o) => o.id + ':' + o.price));
  const want = l1[0].id, em0 = d.emeralds;
  const b = G.Market.buy(d, want);
  check('buying one: it is yours for good, the emeralds are paid, it leaves the list', b === true && d.styles.includes(want) && d.emeralds === em0 - l1[0].price && !G.Market.list(d, '2026-11-27').some((o) => o.id === want), { b, paid: em0 - d.emeralds });
  const em1 = d.emeralds; d.squad = { DEF: 'BASTION', bench: [] };
  const s = G.Market.sell(d, 'BASTION'), back = G.Market.list(d, '2026-11-27').find((o) => o.id === 'BASTION');
  check('selling one pays half its price, takes it off your team, and puts it back on the market priced up', s === true && !d.styles.includes('BASTION') && d.emeralds === em1 + G.MKT_PRICE.Epic * 0.5 && !d.squad.DEF && back && back.mine && back.price === Math.round(G.MKT_PRICE.Epic * G.MKT_UP / 10) * 10, { s, back });
  G.Market.buy(d, 'BASTION'); G.Market.sell(d, 'BASTION');
  const again = G.Market.list(d, '2026-11-27').find((o) => o.id === 'BASTION');
  check('sell the same one again and its price goes up again', again && again.price > back.price, { first: back.price, now: again && again.price });
  check('story characters and your captain cannot be sold', G.Market.sell(d, 'ROGUE') !== true && G.Market.sell(d, d.style) !== true && d.styles.includes('ROGUE'));
  const poor = G.Save.defaults(); poor.emeralds = 10; const pl = G.Market.list(poor);
  check('not enough emeralds: nothing happens', G.Market.buy(poor, pl[0].id) === 'NOT ENOUGH EMERALDS' && !poor.styles.includes(pl[0].id));

  // ---- on screen ----
  const { browser, page, logs } = await open({ wait: 1500 });
  page.setDefaultTimeout(60000);
  await page.evaluate(() => { const d = EGO.Save.data; d.emeralds = 5000; for (const k of ['RAILGUN', 'BASTION', 'THUNDER', 'ZENITH']) if (!d.styles.includes(k)) d.styles.push(k); d.squad = { DEF: 'RAILGUN', MID: 'ZENITH', bench: ['THUNDER'] }; EGO.Save.save(); EGO.UI.show('lobby'); });
  await page.evaluate(() => document.getElementById('go-team').click());
  const sq = await page.evaluate(() => ({ cur: EGO.UI.cur, tab: EGO.TeamUI.tab, stage: EGO.Showcase.stageId, style: EGO.Showcase.p && EGO.Showcase.p.styleId, cap: document.getElementById('cl-capinfo').textContent, cards: document.querySelectorAll('#tm-pitch .fc-card').length }));
  check('MY CLUB opens on SQUAD: your captain in 3D with name, rating and moves, the team on the pitch beside', sq.cur === 'team' && sq.tab === 'squad' && sq.stage === 'cl-fit-squad' && !!sq.style && /CAPTAIN/.test(sq.cap) && /CUSTOMISE/.test(sq.cap) && sq.cards === 5, sq);
  await page.waitForTimeout(500); await page.screenshot({ path: __dirname + '/shots/club_squad.png', timeout: 120000 }).catch(() => {});
  await page.click('#cl-tab-room');
  await page.waitForTimeout(500); await page.screenshot({ path: __dirname + '/shots/club_room.png', timeout: 120000 }).catch(() => {});
  await page.click('#cl-tab-market');
  const m0 = await page.evaluate(() => ({ buy: document.querySelectorAll('#mk-buy .mk-row').length, sell: [...document.querySelectorAll('#mk-sell [data-mk^="sell:"]')].map((b) => b.dataset.mk.slice(5)), stage: EGO.Showcase.stageId, first: (document.querySelector('#mk-buy [data-mk^="buy:"]') || {}).dataset }));
  check('MARKET: today\'s players to buy, your players to sell (not your captain), the 3D stage shows the one you pick', m0.buy >= 1 && m0.sell.includes('RAILGUN') && !m0.sell.includes('ROOKIE') && m0.stage === 'cl-fit-market', m0);
  await page.waitForTimeout(500); await page.screenshot({ path: __dirname + '/shots/club_market.png', timeout: 120000 }).catch(() => {});
  const id = m0.first.mk.slice(4);
  await page.click(`[data-mk="buy:${id}"]`);
  const half = await page.evaluate((id) => ({ owned: EGO.Save.data.styles.includes(id), btn: document.querySelector(`[data-mk="buy:${id}"]`).textContent }), id);
  await page.click(`[data-mk="buy:${id}"]`);
  const done = await page.evaluate((id) => ({ owned: EGO.Save.data.styles.includes(id), em: EGO.Save.data.emeralds }), id);
  check('BUY needs a second tap to be sure, then the player is yours', !half.owned && /TAP AGAIN/.test(half.btn) && done.owned && done.em < 5000, { half, done });
  await page.click('[data-mk="sell:RAILGUN"]'); await page.click('[data-mk="sell:RAILGUN"]');
  const sold = await page.evaluate(() => ({ owned: EGO.Save.data.styles.includes('RAILGUN'), def: EGO.Save.data.squad.DEF || null, listed: [...document.querySelectorAll('#mk-buy .mk-row')].some((r) => /RAILGUN/.test(r.textContent) && /PRICE UP/.test(r.textContent)) }));
  check('SELL (two taps): gone from your club and your team, and back on the market priced up', !sold.owned && sold.def === null && sold.listed, sold);
  for (const [w, h] of [[390, 844], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    const fit = await page.evaluate(() => { const r = {}; for (const t of ['squad', 'room', 'market']) { EGO.TeamUI.setTab(t); r[t] = document.documentElement.scrollWidth <= innerWidth && document.getElementById('scr-team').scrollWidth <= innerWidth + 1; } EGO.TeamUI.setTab('squad'); return r; });
    check(w + 'x' + h + ': all three tabs fit the screen', fit.squad && fit.room && fit.market, fit);
    await page.waitForTimeout(400); await page.screenshot({ path: __dirname + '/shots/club_squad_' + w + 'x' + h + '.png', timeout: 120000 }).catch(() => {});
  }
  check('no errors on the page', !logs.some((l) => l.startsWith('PAGEERROR')), logs.filter((l) => l.startsWith('PAGEERROR')).slice(0, 5));
  await browser.close();
  console.log(results.join('\n'));
  process.exit(results.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})();
