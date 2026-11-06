/* =====================================================================
   UI: lobby, HUD, scoreboard, pause, results, spins, locker, how to play
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEYS3 = ['Q', 'E', 'R'];

const UI = {
  labels: [], toastsN: 0, bannerT: 0, spinning: false, spinKind: 'style', lockerTab: 'style', lockerSel: null, skinSlot: 'hair',
  init() {
    const app = $('app');
    // player labels sit under the touch buttons and the menus; the scoreboard and flash sit over everything
    app.innerHTML = this.tplLobby() + this.tplSpins() + this.tplLocker() + this.tplHowto() + this.tplProfile() + this.tplPass() + this.tplGoals() + Net.tpl() + this.tplDaily() + '<section id="friend-card" class="overlay" hidden><div class="dialog panel fc"><div class="fc-body"></div><button class="btn" id="fc-close" type="button">CLOSE</button></div></section>' + this.tplHud() + '<div id="labels"></div>' + this.tplCutin() + this.tplPause() + this.tplResults() + '<div id="scoreboard" class="panel" hidden></div><div id="flash"></div>' + Net.chatPopTpl() + this.tplEmotes();
    $('labels').style.pointerEvents = 'none'; $('scoreboard').style.pointerEvents = 'none';
    for (let i = 0; i < 14; i++) { const d = document.createElement('div'); d.className = 'flabel'; d.hidden = true; $('labels').appendChild(d); this.labels.push({ el: d, p: null, t: 0, text: '', color: '' }); }
    this.youLabel = document.createElement('div'); this.youLabel.className = 'flabel me'; this.youLabel.textContent = 'YOU'; this.youLabel.hidden = true; $('labels').appendChild(this.youLabel);
    this.bind();
    Hud.toast = (t, c) => this.toast(t, c);
    Hud.label = (p, t, c, dur) => this.flabel(p, t, c, dur);
    Hud.banner = (big, small, color, quick) => this.banner(big, small, color, quick ? 1.1 : 2.0);
    Hud.goal = (team, scorer, assister, own) => { this.goalBanner(team, scorer, assister, own); if (Touch.on && Game.match && Game.match.human && Game.match.human.team === team) Touch.buzz([30, 50, 30]); };
    Hud.flowReady = () => {};
    Hud.lockHint = () => this.lockHint();
    Hud.cutin = (p, name) => this.cutin(p, name);
    Hud.freeKick = (yaw, dist) => Cam.fkFace(yaw, dist, false); // a new free kick: the camera turns to the goal
    Hud.flash = (hex) => { const fl = $('flash'); fl.className = ''; fl.style.background = hex || '#ffffff'; fl.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: 260, easing: 'steps(4)' }); };
    this.renderLobby();
  },
  /* ---------- templates ---------- */
  tplLobby() {
    return `<section id="scr-lobby" class="screen">
      <div class="topbar">
        <div class="left"><span class="chip">SEASON 1 &middot; VOXEL CUP</span><button class="btn small pass" id="go-tut" type="button" hidden><span><span class="tut-long">NEW? PLAY THE </span>TUTORIAL</span></button></div>
        <div class="right">
          <span class="emer" title="Emeralds"><img class="px" id="lob-em-ico" alt=""><span id="lob-em">0</span></span>
          <button class="iconbtn" id="btn-fs" type="button" hidden>FULLSCREEN</button>
          <button class="iconbtn" id="btn-mute" type="button">SOUND ON</button>
          <button class="iconbtn" id="btn-gfx" type="button">GRAPHICS: AUTO</button>
        </div>
      </div>
      <div class="lobby-main">
        <h1 class="title"><span class="t1">SCOR<em class="t2">Z</em></span></h1>
        <p class="tagline">Voxel football, 3v3 up to 5v5. Pick a style, find your Flow, climb from Wood to Obsidian.</p>
        <nav class="menu" aria-label="Main menu">
          <button class="btn blue" id="go-ranked" type="button">RANKED <span class="sub" id="rank-sub">WOOD</span></button>
          <button class="btn" id="go-quick" type="button">QUICK MATCH <span class="sub">3V3 &middot; NO RANK CHANGE</span></button>
          <button class="btn friends" id="go-online" type="button">PLAY WITH FRIENDS <span class="sub">ONLINE ROOM</span></button>
          <button class="btn hazard" id="go-lawless" type="button">LAWLESS <span class="sub">3V3 &middot; ITEMS</span></button>
          <button class="btn featured" id="go-featured" type="button"><span id="feat-name">FEATURED</span> <span class="sub" id="feat-sub">NEW MODE IN 3:00:00</span></button>
          <div class="meta-row"><button class="btn emerald" id="go-spins" type="button">SPINS <span class="sub">FROM 100</span></button><button class="btn" id="go-locker" type="button">LOCKER <span class="sub" id="locker-sub">ROOKIE</span></button><button class="btn pass" id="go-pass" type="button">GAME PASS <span class="sub" id="pass-sub">TIER 0 / 30</span></button></div>
          <div class="ghosts"><button class="btn ghost daily" id="go-daily" type="button">DAILY <i class="dot"></i></button><button class="btn ghost goals" id="go-goals" type="button">BLUEPRINTS <b class="bp-n" id="bp-n">0</b></button><button class="btn ghost" id="go-fk" type="button">FREE KICKS</button><button class="btn ghost" id="go-howto" type="button">HOW TO PLAY</button><button class="btn ghost" id="go-profile" type="button"><span>PROFILE<span class="ph-x"> &amp; HISTORY</span></span></button></div>
        </nav>
      </div>
      <div class="lob-stage" id="lob-stage" aria-hidden="true"></div>
      <div class="lobby-foot">
        <div class="profile panel" id="lob-profile" role="button" tabindex="0" title="Open your profile and match history">
          <img class="badge px" id="pro-badge" alt="">
          <div><div class="label">RANK</div><div class="tier" id="pro-tier">WOOD</div></div>
          <div><div class="rpbar" id="pro-rp"></div><div class="label" id="pro-rptxt" style="margin-top:6px">0 RP</div></div>
          <div class="equip-row"><span class="label">STYLE</span><b id="pro-style">ROOKIE</b><span class="rar" id="pro-style-r" data-r="Rare">RARE</span><span class="label">FLOW</span><b id="pro-flow">NONE</b><span class="label">CLUB</span><b id="pro-club">ROVERS</b></div>
          <div class="label" id="pro-rec" style="grid-column:1/-1">0 W &middot; 0 D &middot; 0 L</div>
        </div>
        <p class="notice" id="lob-notice"></p>
      </div>
    </section>`;
  },
  tplSpins() {
    return `<section id="scr-spins" class="screen sub-screen" hidden>
      <div class="sub-wrap sp-wrap">
        <div class="sub-head"><h2>SPINS</h2><div class="right" style="display:flex;gap:12px;align-items:center"><span class="emer"><img class="px" id="spin-em-ico" alt=""><span id="spin-em">0</span></span><button class="btn small" id="spin-back" type="button">BACK</button></div></div>
        <div class="tabs" role="tablist"><button class="tab" id="tab-style" role="tab" type="button">STYLE SPIN</button><button class="tab" id="tab-flow" role="tab" type="button">FLOW SPIN</button><button class="tab" id="tab-skin" role="tab" type="button">SKIN SPIN</button></div>
        <div class="sp-stage"><div class="sp-fit" id="sp-fit"></div><button class="btn small" id="spin-skip" type="button" hidden>SKIP</button><div class="sp-result panel" id="spin-result"></div></div>
        <div class="spin-ctl">
          <button class="btn emerald" id="spin-go" type="button">SPIN <span class="sub">200 EMERALDS</span></button>
          <div style="display:grid;gap:6px"><span class="label" id="spin-pity">LEGENDARY+ GUARANTEED IN 30 SPINS</span><div class="odds" id="spin-odds"></div></div>
        </div>
        <div class="label" id="spin-owned"></div>
      </div>
    </section>`;
  },
  tplLocker() {
    return `<section id="scr-locker" class="screen sub-screen" hidden>
      <div class="sub-wrap lk-wrap">
        <div class="sub-head"><h2>LOCKER</h2><button class="btn small" id="locker-back" type="button">BACK</button></div>
        <div class="locker">
          <div class="lk-stage"><div class="lk-fit" id="lk-fit" title="Drag to turn your player"><span class="label lk-drag">DRAG TO TURN</span></div><div class="lk-cap panel" id="lk-cap"></div></div>
          <div class="lk-side">
            <div class="tabs" role="tablist"><button class="tab" id="ltab-style" role="tab" type="button">STYLES</button><button class="tab" id="ltab-flow" role="tab" type="button">FLOWS</button><button class="tab" id="ltab-skin" role="tab" type="button">SKINS</button><button class="tab" id="ltab-club" role="tab" type="button">CLUB</button></div>
            <div class="tabs slots" id="lk-slots" role="tablist" hidden></div>
            <div class="lk-body"><div class="grid-cards" id="locker-grid"></div><div class="panel detail" id="locker-detail"></div></div>
          </div>
        </div>
      </div>
    </section>`;
  },
  tplHowto() {
    const row = (k, t) => `<span>${k}</span><span>${t}</span>`;
    const key = (k) => `<span class="key">${k}</span>`;
    return `<section id="scr-howto" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>HOW TO PLAY</h2><button class="btn small" id="howto-back" type="button">BACK</button></div>
        <button class="btn blue tut-btn" id="howto-tut" type="button">PLAY THE TUTORIAL <span class="sub">2 MINUTES, LEARN EVERY CONTROL</span></button>
        <div class="howto">
          <section class="panel touchsec"><h3>TOUCH</h3><div class="ctrl">
            ${row(key('LEFT THUMB'), 'Touch anywhere on the left and drag to move. Push past the outer ring to sprint')}
            ${row(key('RIGHT THUMB'), 'Drag anywhere on the right to turn the camera. The crosshair is where shots go')}
            ${row(key('SHOOT'), 'Hold to charge, let go to shoot. Drag on it while holding to aim')}
            ${row(key('PASS'), 'Tap to pass to the teammate nearest your aim. Hold for a lob. Without the ball it calls for it: your teammate looks up, then picks the pass')}
            ${row(key('FEINT') + key('TACKLE'), 'One button. With the ball it feints (a step-over nobody can tackle you through, every 5s), without it you slide')}
            ${row(key('JUMP'), 'Jump. With the ball it flicks it over a defender')}
            ${row(key('ARC'), 'Your three style abilities, then FLOW when the bar is full')}
            ${row(key('DOUBLE TAP'), 'Double tap the right side to face the goal')}
            ${row(key('SCORE'), 'Tap the score for the scoreboard. The top right button pauses')}
            ${row(key('CAMERA'), 'The camera button at the top switches between third person and first person')}
            ${row(key('EMOTE'), 'The smiley button at the top opens the emote wheel')}
            ${row(key('CHAT'), 'Online: the bubble next to pause opens quick chat. Typing needs an account')}
            ${row(key('REPLAY'), 'After a goal, a nutmeg or an ankle breaker, tap REPLAY to watch it again')}
          </div></section>
          <section class="panel"><h3>KEYBOARD + MOUSE</h3><div class="ctrl">
            ${row(key('W') + key('A') + key('S') + key('D'), 'Move')}
            ${row(key('MOUSE'), 'Aim the camera. Click the pitch to lock the mouse')}
            ${row(key('SHIFT'), 'Sprint. It uses stamina. Run it empty and you are out of breath (the bar flashes red): no sprint and a slower jog until it is a third full. Stand still to get it back faster')}
            ${row(key('HOLD LMB'), 'Charge a shot, release to shoot where you aim')}
            ${row(key('RMB'), 'Pass to the teammate nearest your aim. Hold for a lob. Without the ball it calls for a pass: your teammate looks up, then picks one. Sprint into space for a through ball')}
            ${row(key('SPACE'), 'Jump. With the ball it flicks it over defenders')}
            ${row(key('C'), 'Feint: a step-over cut to the side. Nobody can tackle you through it. Once every 5 seconds')}
            ${row(key('F'), 'Slide tackle')}
            ${row(key('Q') + key('E') + key('R'), 'Style abilities. Big moves get a quick cut-in; turn them off in the pause menu')}
            ${row(key('G'), 'Activate Flow when the bar is full')}
            ${row(key('Z'), 'Awakened, your style\'s signature move (once). Awakening comes by itself at random moments, sooner after big plays')}
            ${row(key('X'), 'Use item (Lawless)')}
            ${row(key('TAB'), 'Scoreboard')}
            ${row(key('1') + key('2') + key('3') + key('4'), 'Online: quick chat. PASS!, NICE!, GG, ON ME')}
            ${row(key('T'), 'Online: open chat. Typing needs an account, quick chat works for everyone')}
            ${row(key('ESC') + key('P'), 'Pause')}
            ${row(key('ENTER'), 'Watch the replay after a goal, a nutmeg or an ankle breaker. SAVE CLIP downloads it as a video')}
            ${row(key('ARROWS'), 'Turn the camera if the mouse cannot lock')}
            ${row(key('V'), 'Switch camera: third person (behind you) or first person (your eyes)')}
            ${row(key('B'), 'Emote wheel: wave, clap, robot, shush, flex, point up, salute, bow, air drums. Pick with 1 to 9. Not while you have the ball')}
            ${row(key('L'), 'Shift lock: your player always faces where you look, so A and D step sideways with the ball in front. The camera sits over your shoulder')}
          </div></section>
          <section class="panel"><h3>CONTROLLER</h3><div class="ctrl">
            ${row(key('L STICK'), 'Move')}${row(key('R STICK'), 'Camera')}${row(key('LB'), 'Sprint')}${row(key('RT'), 'Charge and shoot')}
            ${row(key('LT') + key('RB'), 'Pass (hold for a lob)')}${row(key('A'), 'Jump / flick')}${row(key('B'), 'Feint')}${row(key('X'), 'Slide tackle')}
            ${row(key('D-PAD') , 'Left, Up, Right = abilities. Down = item')}${row(key('Y'), 'Flow')}${row(key('START'), 'Pause')}${row(key('VIEW'), 'Scoreboard')}${row(key('VIEW') + key('D-PAD'), 'Online: hold VIEW and press the D-pad for quick chat')}${row(key('D-PAD DOWN'), 'Emote wheel (not in Lawless), then the D-pad chooses and A plays it')}${row(key('R3'), 'Switch camera. When a replay is offered, R3 watches it')}
          </div></section>
          <section class="panel"><h3>WINNING THE BALL</h3><ul>
            <li><b>Run into a loose ball</b> to dribble it. You cannot run through a carrier, you have to tackle.</li>
            <li><b>Slide tackles</b> pop the ball loose and floor the carrier. Miss, and you are stuck on the grass.</li>
            <li><b>Feint right as the tackle comes in.</b> A tackle that hits your feint is an ankle breaker and fills your Flow.</li>
            <li><b>You have the ball</b> when a bright ring glows round your feet and the crosshair turns gold.</li>
            <li><b>Hold A or D (or the stick left or right) as you release a shot</b> to bend it.</li>
            <li><b>The keeper</b> reacts to where the ball is going. Corners, curlers and fakes beat him.</li>
          </ul></section>
          <section class="panel"><h3>FLOW, SPINS, RANK</h3><ul>
            <li><b>Awakening</b> is your style's own power-up. It comes by itself at random moments, and goals, assists, shots on target, tackles and tricks make it come sooner. For 20 seconds your cooldowns reset and recharge twice as fast, your abilities last longer, you get your style's own boost, and Z does its signature move once.</li>
            <li><b>Flow</b> fills from completed passes, feints, tackles and shots on target. Press G (or tap FLOW) for 15s of your Flow's buff.</li>
            <li><b>Emeralds:</b> win 150, draw 80, loss 50, plus 20 a goal and 10 an assist.</li>
            <li><b>Style spins</b> give you a style to play with until your next style spin replaces it. <b>Blueprints</b> keep a style for good: earn them from GOALS on the BLUEPRINTS screen (start screen) and spend them in the Locker.</li>
            <li><b>Spins</b>: styles cost 200, Flows 150 and skins 100. Legendary or better is guaranteed within 30 spins. Duplicates refund 50.</li>
            <li><b>Clubs:</b> pick the club you play for in the Locker. If both teams' kits look alike, the away team changes into its away kit.</li>
            <li><b>Skin spins</b> give haircuts, hair colours, boots, gloves, extras and goal celebrations. Skins only change your looks, never your stats. Try them on in the Locker.</li>
            <li><b>Ranked:</b> win +25, draw +5, loss -15. Wood, Stone, Iron, Gold, Diamond, Obsidian. Every tier is a step up: bots react faster, pass and tackle smarter, keepers get better, and the stadium gets bigger, fuller and louder.</li>
            <li><b>Play with friends:</b> create a room, send the code or invite link, pick teams and a mode. The host picks BOTS: FILL puts bots in the empty spots, KEEPERS ONLY is just you and your friends with computer keepers, NONE is only you and your friends. Keyboard, controller and phone players can all join the same room.</li>
            <li><b>Game pass:</b> free, 30 tiers a season (8 weeks). Earn pass XP by playing well and from 4 weekly skill challenges. Rewards are emeralds, skins and celebrations, never stats. Standing around earns nothing.</li>
            <li><b>Tutorial:</b> new to the game? The button at the top of this page walks you through every control, one at a time.</li>
            <li><b>Free kick battle:</b> still level after golden goal? 3 free kicks each, then sudden death. When they take one, you stand in the wall: jump at the right moment to block it. Winning the battle counts as a win.</li>
            <li><b>Free kicks</b> (on the start screen): 10 free kicks against a keeper and a wall. Turn the camera to aim, hold shoot for power, and try your shooting abilities. It keeps your best score. No rewards, just practice.</li>
            <li><b>Featured mode</b> changes every 3 hours, the same for everyone: King of the Hill (hold the ball in the moving ring, a point a second, goals are worth 3), Volleys Only (only volleys and headers count: press JUMP with the ball to flick it up, then shoot it before it lands), 1v1 Duels (first to 3) and Lawless.</li>
            <li><b>Rewards</b> (emeralds, XP, pass, GOALS) come from full-time matches: Quick Match, Ranked and Lawless. King of the Hill, Volleys and Duels are just for fun, unless you play them with friends: every friends match gives rewards. Leaving early gives nothing.</li>
            <li><b>Team size:</b> Quick Match and Lawless are 3v3. Ranked is 3v3 at Wood and Stone, 4v4 at Iron and Gold, and 5v5 at Diamond and Obsidian.</li>
            <li><b>Lawless</b> drops item blocks on the pitch. Rocket fists, boom blocks, slime, jetpacks. No rank change.</li>
            <li><b>Golden goal</b> if it is level at full time. Still level after 2 more minutes, it is a draw.</li>
          </ul></section>
        </div>
      </div>
    </section>`;
  },
  tplProfile() {
    return `<section id="scr-profile" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>PROFILE</h2><button class="btn small" id="profile-back" type="button">BACK</button></div>
        <section class="panel pf-acc" id="pf-acc"></section>
        <div class="pf-top"><div class="panel pf-card" id="pf-card"></div><div class="panel pf-best" id="pf-best"></div></div>
        <section class="panel pf-code"><h3>CODES</h3>
          <form class="pf-code-row" id="pf-code-form" autocomplete="off"><input class="on-in" id="pf-code" maxlength="40" placeholder="TYPE A CODE" aria-label="Code" spellcheck="false" autocapitalize="characters"><button class="btn blue" type="submit">REDEEM</button></form>
          <p class="label" id="pf-code-msg" aria-live="polite"></p></section>
        <section class="panel pf-hist"><h3>MATCH HISTORY</h3><div id="pf-hist"></div></section>
      </div>
    </section>`;
  },
  /** the profile card: level and XP, rank, what you have equipped, and your best stats. Built from saved data,
      so the same card can show a friend's profile later */
  profileCard(d) {
    const tier = tierOf(d.rp), lv = levelOf(d.xp), st = STYLES[d.style], fl = d.flow ? FLOWS[d.flow] : null;
    const skins = SKIN_SLOTS.map((sl) => `<div class="pf-skin" data-id="${d.look[sl.id]}"><span class="sv"></span><span class="label">${sl.name}</span><b>${esc(SKINS[d.look[sl.id]].name)}</b></div>`).join('');
    return `<div class="pf-head"><span class="pf-face"></span><div class="pf-lv"><span class="label">LEVEL</span><b>${lv.level}</b></div>
        <div class="pf-xp"><div class="xpbar"><i style="width:${(lv.into / lv.need * 100).toFixed(1)}%"></i></div><span class="label">${lv.into} / ${lv.need} XP TO LEVEL ${lv.level + 1}</span></div>
        <div class="pf-rank"><img class="px" src="${badgeURL(tier)}" alt=""><div><span class="label">RANK</span><b>${TIER_NAMES[tier]}</b><span class="label">${d.rp} RP</span></div></div></div>
      <div class="pf-eq"><div><span class="label">STYLE</span><b>${esc(st.name)}</b><span class="rar" data-r="${st.rarity}">${st.rarity.toUpperCase()}</span></div>
        <div><span class="label">FLOW</span><b>${fl ? esc(fl.name) : 'NONE'}</b>${fl ? `<span class="rar" data-r="${fl.rarity}">${fl.rarity.toUpperCase()}</span>` : ''}</div>
        <div><span class="label">CLUB</span><b>${esc(CLUBS[d.club].name)}</b></div></div>
      <div class="pf-skins">${skins}</div>`;
  },
  renderProfile() {
    const d = Save.data, B = d.best, S = d.stats;
    const card = $('pf-card');
    card.innerHTML = this.profileCard(d);
    card.querySelector('.pf-face').replaceWith(portraitCanvas(d.style, 88, lookFor(d.style, d.look)));
    card.querySelectorAll('.pf-skin').forEach((el) => el.querySelector('.sv').replaceWith(skinCanvas(el.dataset.id, 32)));
    const stat = (k, v) => `<div><span class="label">${k}</span><b>${v}</b></div>`;
    $('pf-best').innerHTML = '<h3>BEST</h3><div class="pf-grid">' + [
      stat('MOST GOALS IN A MATCH', B.goals), stat('MOST ASSISTS IN A MATCH', B.assists), stat('BEST WIN STREAK', B.streak),
      stat('PEAK RANK', TIER_NAMES[tierOf(B.peakRp)]), stat('MATCHES', S.played), stat('W / D / L', S.wins + ' / ' + S.draws + ' / ' + S.losses),
      stat('TOTAL GOALS', S.goals), stat('TOTAL ASSISTS', S.assists),
    ].join('') + '</div>';
    $('pf-hist').innerHTML = this.historyRows(d.history) || '<p class="label">NO MATCHES YET. PLAY ONE AND IT SHOWS UP HERE.</p>';
    const acc = $('pf-acc'); acc.innerHTML = Account.html(); Account.bind(acc);
  },
  /** match history rows, newest first (yours, or a friend's recent matches) */
  historyRows(history) {
    const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const when = (t) => { const x = new Date(t); return x.getDate() + ' ' + MON[x.getMonth()] + ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
    const short = (c) => (CLUBS[c] ? CLUBS[c].short : '');
    return history.slice().reverse().map((h) => {
      h = Object.assign({ g: 0, a: 0, style: '', club: '', opp: '', score: [0, 0], res: 'draw', mode: 'quick', t: 0 }, h);
      const mode = MODES[h.mode] ? MODES[h.mode].name : h.mode.toUpperCase();
      const rp = h.rp == null ? '' : `<span class="pf-rp ${h.rp >= 0 ? 'up' : 'down'}">${h.rp >= 0 ? '+' : ''}${h.rp} RP</span>`;
      return `<div class="pf-row"><span class="label">${when(h.t)}</span><span class="pf-mode">${esc(mode)}${h.size && h.mode !== 'duel' ? ' · ' + h.size + 'V' + h.size : ''}</span>
        <span class="pf-score">${short(h.club)} ${h.score[0]} : ${h.score[1]} ${short(h.opp)}</span><span class="pf-res ${h.res}">${h.res.toUpperCase()}</span>
        <span class="label">${h.g} G · ${h.a} A${STYLES[h.style] ? ' · ' + esc(STYLES[h.style].name) : ''}</span>${rp}</div>`;
    }).join('');
  },
  tplGoals() {
    return `<section id="scr-goals" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>BLUEPRINTS</h2><button class="btn small" id="goals-back" type="button">BACK</button></div>
        <section class="panel gl-top" id="gl-top"></section>
        <section class="panel"><div class="gp-ch" id="gl-list"></div></section>
      </div>
    </section>`;
  },
  renderGoals() {
    const d = Save.data;
    $('gl-top').innerHTML = `<b class="gl-bp">${d.bp} <small>BLUEPRINTS</small></b><p class="gp-note">A style you spin is yours until your next style spin. Earn blueprints by finishing the GOALS below. Spend them in the LOCKER: open a style and press KEEP, and it is yours for good. Rare costs ${BP_COST.Rare}, Epic ${BP_COST.Epic}, Legendary ${BP_COST.Legendary}, Mythic ${BP_COST.Mythic}, Generational ${BP_COST.Generational}. Every goal below pays blueprints at each step, and some pay a skin you cannot spin.</p><button class="btn small emerald" id="gl-locker" type="button">SPEND THEM IN THE LOCKER</button>`;
    $('gl-locker').addEventListener('click', () => { Sfx.click(); this.openLocker(); });
    $('gl-list').innerHTML = GOALS.map((g) => {
      const step = d.goalSteps[g.id] || 0, have = d.stats[g.stat] || 0, done = step >= g.steps.length;
      const next = done ? g.steps[g.steps.length - 1] : g.steps[step], prev = step > 0 ? g.steps[step - 1] : 0;
      const pct = done ? 100 : clamp((have - prev) / (next - prev) * 100, 0, 100);
      const skin = !done && g.skins && g.skins[step] ? ' + ' + SKINS[g.skins[step]].name : '';
      return `<div class="gp-c ${done ? 'done' : ''}"><b>${esc(g.name)} ${done ? '' : next}</b><span class="label">${done ? 'ALL DONE' : have + ' / ' + next + ' · +' + g.bp[step] + ' BLUEPRINT' + (g.bp[step] > 1 ? 'S' : '') + esc(skin)}</span><div class="xpbar"><i style="width:${pct.toFixed(0)}%"></i></div><span class="label">STEP ${Math.min(step + 1, g.steps.length)} OF ${g.steps.length}</span></div>`;
    }).join('');
  },
  tplPass() {
    return `<section id="scr-pass" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>GAME PASS</h2><button class="btn small" id="pass-back" type="button">BACK</button></div>
        <section class="panel gp-top" id="gp-top"></section>
        <section class="panel gp-week"><h3>THIS WEEK</h3><div class="gp-ch" id="gp-ch"></div></section>
        <section class="panel gp-track-box"><h3>REWARDS</h3><div class="gp-track" id="gp-track"></div></section>
      </div>
    </section>`;
  },
  renderPass() {
    const d = Save.data; Pass.sync(d);
    const S = seasonAt(), P = d.pass, tier = Pass.tier(d), into = tier >= PASS_TIERS ? PASS_TIER_XP : P.xp % PASS_TIER_XP;
    const days = (ms) => { const h = Math.floor(ms / 3600e3); return h >= 48 ? Math.floor(h / 24) + ' DAYS' : h + 'H ' + Math.floor(ms / 60e3) % 60 + 'M'; };
    $('gp-top').innerHTML = `<div class="gp-tier"><span class="label">SEASON ${S.season} · ENDS IN ${days(S.seasonLeft)}</span><b>TIER ${tier} <small>/ ${PASS_TIERS}</small></b></div>
      <div class="gp-bar"><div class="xpbar pass"><i style="width:${into / PASS_TIER_XP * 100}%"></i></div><span class="label">${tier >= PASS_TIERS ? 'PASS COMPLETE' : into + ' / ' + PASS_TIER_XP + ' XP TO TIER ' + (tier + 1)}</span></div>
      <p class="gp-note">Free for everyone. Earn pass XP by playing well: goals, assists, shots on target, tackles, passes and wins. Standing around earns nothing. Rewards only change your looks.</p>`;
    $('gp-ch').innerHTML = `<span class="label">NEW CHALLENGES IN ${days(S.weekLeft)}</span>` + weekChallenges(P.week).map((id) => {
      const C = CHALLENGES[id], n = Math.min(C.goal, P.prog[id] || 0), done = P.done.includes(id);
      return `<div class="gp-c ${done ? 'done' : ''}"><b>${esc(C.name)}</b><span class="label">${done ? 'DONE' : n + ' / ' + C.goal} · +${C.xp} XP</span><div class="xpbar"><i style="width:${n / C.goal * 100}%"></i></div></div>`;
    }).join('');
    $('gp-track').innerHTML = PASS_REWARDS.map((r, i) => {
      const n = i + 1, got = P.got >= n, now = n === tier + 1;
      return `<div class="gp-t ${got ? 'got' : ''} ${now ? 'next' : ''}" data-i="${i}"><span class="label">TIER ${n}</span><span class="gv"></span><b>${esc(Pass.rewardName(r))}</b><span class="label">${got ? 'EARNED' : now ? 'NEXT' : ''}</span></div>`;
    }).join('');
    $('gp-track').querySelectorAll('.gp-t').forEach((el) => {
      const r = PASS_REWARDS[+el.dataset.i], cv = r.skin ? skinCanvas(r.skin, 40) : iconCanvas('emerald');
      cv.className = 'px'; el.querySelector('.gv').replaceWith(cv);
    });
  },
  tplHud() {
    return `<section id="hud" hidden>
      <div class="hud-mode"><span class="chip" id="hud-mode">RANKED</span><img class="px" id="hud-badge" alt=""></div>
      <div class="scorebar"><div class="team blue"><span class="nm" id="sc0-nm">HOME</span><span id="sc0">0</span></div><div class="clock"><span id="clock">4:00</span><small id="clock-sub"></small></div><div class="team orange"><span id="sc1">0</span><span class="nm" id="sc1-nm">AWAY</span></div></div>
      <div class="hud-em emer"><img class="px" id="hud-em-ico" alt=""><span id="hud-em">0</span></div>
      <div class="crosshair" id="xhair"></div>
      <div class="balltag" id="balltag" hidden>BALL</div>
      <div class="charge" id="charge" hidden><i id="charge-fill"></i><span id="charge-txt">POWER</span></div>
      <div class="toasts" id="toasts"></div>
      <div class="chatfeed" id="chatfeed" aria-live="polite"></div>
      <div class="awakeside" id="awakeside" hidden><span class="aw-name" id="aws-name"></span><div class="aw-track"><i id="aws-fill"></i></div><b id="aws-txt">0%</b><span class="key k">Z</span></div>
      <div class="idle-warn" id="idle-warn" hidden role="alert"><b id="idle-big"></b><span id="idle-small"></span></div>
      <div class="banner" id="banner" hidden><div class="big" id="banner-big"></div><div class="small" id="banner-small"></div></div>
      <canvas id="minimap" width="132" height="200"></canvas>
      <div class="tutbox panel" id="tutbox" hidden><span class="label" id="tut-n"></span><b id="tut-title"></b><p id="tut-text"></p></div>
      <div class="dock">
        <div class="fkpanel panel" id="fkpanel" hidden>
          <div class="fk-row"><span class="label">TYPE</span><b id="fk-type">CURVE</b><span class="label" id="fk-desc"></span><span class="key k" id="fk-typekey">RMB</span></div>
          <div class="fk-row"><span class="label">CURVE</span><div class="fk-curve"><i id="fk-cmark"></i></div><span class="key k" id="fk-curvekey">A D</span></div>
          <div class="fk-row"><span class="label">POWER</span><div class="fk-pow"><em id="fk-zone"></em><i id="fk-pfill"></i></div><span class="key k" id="fk-powkey">LMB</span></div>
        </div>
        <div class="flowbar" id="flowbar"><div class="lbl"><span id="flow-name">FLOW</span><b id="flow-txt">0%</b></div><div class="track"><div class="fill" id="flow-fill"></div><div class="ticks"></div></div></div>
        <div class="flowbar awakebar" id="awakebar"><div class="lbl"><span id="awake-name">AWAKENING</span><b id="awake-txt">0%</b></div><div class="track"><div class="fill" id="awake-fill"></div></div></div>
        <div class="stamina" id="stamina"></div>
        <div class="hotbar" id="hotbar"></div>
      </div>
      <div class="itemslot" id="itemslot" hidden><div class="slot"><img class="px" id="item-img" alt=""><span class="key k">X</span><span class="nm" id="item-nm"></span></div></div>
      <div class="hint" id="hint" hidden></div>
    </section>`;
  },
  tplEmotes() {
    return `<div id="emote-pop" class="panel" hidden><div class="cp-head"><span class="label">EMOTES</span><button class="btn ghost" id="em-close" type="button">CLOSE</button></div>
      <div class="em-grid">${EMOTES.map((e, i) => `<button class="btn small" type="button" data-em="${i}"><span class="key">${i + 1}</span> ${e.name}</button>`).join('')}</div>
      <p class="label em-pad">CONTROLLER: D-PAD TO CHOOSE, A TO PLAY</p></div>`;
  },
  emoteOpen: false, emoteSel: 0,
  /** open or close the emote wheel (B, the EMOTE button, D-pad down) */
  toggleEmotes(on = !this.emoteOpen) {
    if (on && !Game.playing()) return;
    this.emoteOpen = on; $('emote-pop').hidden = !on;
    if (on) this.markEmote(0);
    if (on) Input.releaseLock(); else if (Game.playing() && !Net.paused && !Touch.on) Input.requestLock();
  },
  pickEmote(i) { Input.emotePick = i; Sfx.click(); this.toggleEmotes(false); },
  /** the controller's choice in the wheel (3 across) */
  markEmote(i) { const n = EMOTES.length; this.emoteSel = ((i % n) + n) % n; document.querySelectorAll('#emote-pop [data-em]').forEach((b, k) => b.classList.toggle('sel', k === this.emoteSel)); },
  /** in a match: B opens the wheel; while it is open 1 to 9 pick, or the D-pad moves and A picks */
  emoteKeys() {
    const E = Input.edges;
    if (E.has('KeyB') || (E.has('PadDown') && !this.emoteOpen && !(Game.match && Game.match.cfg && Game.match.cfg.items))) { E.delete('KeyB'); E.delete('PadDown'); this.toggleEmotes(); return; }
    if (!this.emoteOpen) return;
    for (let i = 0; i < EMOTES.length; i++) if (E.has('Digit' + (i + 1)) || E.has('Numpad' + (i + 1))) { E.delete('Digit' + (i + 1)); E.delete('Numpad' + (i + 1)); this.pickEmote(i); return; }
    const mv = { PadLeft: -1, PadRight: 1, PadUp: -3, PadDown: 3 };
    for (const k in mv) if (E.has(k)) { E.delete(k); this.markEmote(this.emoteSel + mv[k]); Sfx.hover(); }
    if (E.has('PadA')) { E.delete('PadA'); this.pickEmote(this.emoteSel); return; }
    if (E.has('PadB')) this.toggleEmotes(false);
  },
  tplDaily() {
    return `<section id="scr-daily" class="overlay" hidden>
      <div class="dialog panel daily-box">
        <h2>DAILY</h2>
        <div class="dl-card"><span class="label">TODAY'S GIFT</span><div id="dl-gift"></div></div>
        <div class="dl-card"><span class="label">TODAY'S CHALLENGE</span><div id="dl-ch"></div></div>
        <p class="label">A new gift and a new challenge every day. No streaks: missing a day costs nothing.</p>
        <button class="btn" id="dl-close" type="button">CLOSE</button>
      </div>
    </section>`;
  },
  renderDaily() {
    const d = Save.data; Daily.sync(d);
    const C = DAILY_CHALLENGES[d.daily.ch];
    $('dl-gift').innerHTML = Daily.giftReady(d) ? '<button class="btn emerald" id="dl-open" type="button">OPEN TODAY\'S GIFT</button>'
      : `<b class="dl-big">${esc(this.giftText || 'OPENED')}</b><span class="label">NEXT GIFT IN ${Daily.untilTomorrow()}</span>`;
    const pct = C ? d.daily.prog / C.goal * 100 : 0;
    $('dl-ch').innerHTML = C ? `<b class="dl-big">${esc(C.name)}</b><div class="xpbar"><i style="width:${pct.toFixed(0)}%"></i></div>`
      + `<span class="label">${d.daily.done ? 'DONE! NEW CHALLENGE IN ' + Daily.untilTomorrow() : d.daily.prog + ' / ' + C.goal + ' · REWARD +' + DAILY_REWARD.emeralds + ' EMERALDS, +' + DAILY_REWARD.xp + ' XP'}</span>` : '';
    const o = $('dl-open');
    if (o) o.addEventListener('click', () => {
      Sfx.init();
      const g = Daily.openGift(Save.data); if (!g) return;
      Save.save();
      this.giftText = g.emeralds ? (g.jackpot ? 'JACKPOT! ' : '') + '+' + g.emeralds + ' EMERALDS' : '+' + g.xp + ' XP';
      if (g.jackpot) Sfx.fanfare(2); else Sfx.coin();
      this.renderDaily(); this.renderLobby();
    });
  },
  tplCutin() {
    return `<div id="cutin" hidden aria-hidden="true"><div class="ci-lines"></div><div class="ci-panel"><span class="ci-face" id="ci-face"></span><div class="ci-text"><b id="ci-name"></b><span id="ci-style"></span></div></div></div>`;
  },
  /** comic-style cut-in for a big move: your portrait and the move name slam across the screen (0.8s) */
  cutin(p, name) {
    const el = $('cutin');
    el.style.setProperty('--ci', p.aura);
    const face = $('ci-face'); face.innerHTML = ''; face.appendChild(portraitCanvas(p.styleId, 120, p.look));
    $('ci-name').textContent = name; $('ci-style').textContent = p.style.name + ' STYLE';
    el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    clearTimeout(this.ciT); this.ciT = setTimeout(() => { el.hidden = true; el.classList.remove('go'); }, 820);
  },
  tplPause() {
    return `<section id="scr-pause" class="overlay" hidden>
      <div class="dialog panel">
        <h2>PAUSED</h2>
        <div class="set">
          <span>Graphics</span><div class="seg" id="set-q"><button type="button" data-q="auto">AUTO</button><button type="button" data-q="low">LOW</button><button type="button" data-q="med">MED</button><button type="button" data-q="high">HIGH</button></div>
          <span>Sky</span><div class="seg" id="set-sky"><button type="button" data-v="day">DAY</button><button type="button" data-v="sunset">SUNSET</button></div>
          <label for="set-sens">Look sensitivity</label><input type="range" id="set-sens" min="0.3" max="2.5" step="0.05">
          <span>Shift lock</span><div class="seg" id="set-sl"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span>Camera</span><div class="seg" id="set-cam"><button type="button" data-v="third">3RD PERSON</button><button type="button" data-v="first">1ST PERSON</button></div>
          <span>Invert camera Y</span><div class="seg" id="set-inv"><button type="button" data-v="0">OFF</button><button type="button" data-v="1">ON</button></div>
          <span class="t-only">Button size</span><div class="seg t-only" id="set-btn"><button type="button" data-v="0.85">S</button><button type="button" data-v="1">M</button><button type="button" data-v="1.15">L</button></div>
          <span>Aim assist</span><div class="seg" id="set-assist"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span>Chat</span><div class="seg" id="set-chat">${CHAT_SHOW.map(([v, n]) => `<button type="button" data-v="${v}">${n}</button>`).join('')}</div>
          <span>Cut-ins</span><div class="seg" id="set-cut"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span>Sound</span><div class="seg" id="set-snd"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span class="fs-only" hidden>Fullscreen</span><div class="seg fs-only" id="set-fs" hidden><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
        </div>
        <div class="p-people" id="p-people" hidden></div>
        <div class="row"><button class="btn blue" id="p-resume" type="button">RESUME</button><button class="btn" id="p-forfeit" type="button">FORFEIT</button></div>
        <p class="label" id="p-note">Click the pitch after resuming to lock the mouse again.</p>
      </div>
    </section>`;
  },
  tplResults() {
    return `<section id="scr-results" class="overlay" hidden>
      <div class="dialog panel" style="width:min(620px,100%)">
        <h2 id="r-title">VICTORY</h2>
        <div class="res-score" id="r-score"></div>
        <div class="res-grid" id="r-stats"></div>
        <div class="earn" id="r-earn"></div>
        <div class="rankline" id="r-rank"></div>
        <div class="xpline" id="r-xp"></div>
        <div class="passline" id="r-pass"></div>
        <div class="passline" id="r-daily"></div>
        <div class="row"><button class="btn blue" id="r-again" type="button">PLAY AGAIN</button><button class="btn" id="r-lobby" type="button">LOBBY</button></div>
      </div>
    </section>`;
  },
  /* ---------- wiring ---------- */
  /** menu sounds for every button: a soft tick on mouse hover, a tock on press (lower for BACK and CLOSE, a blip for tabs),
      a whoosh when a screen or pop-up opens or closes. Touch controls are not buttons, so they stay quiet */
  bindSounds() {
    const BTN = 'button, .tab, [role=button]';
    let hov = null;
    document.addEventListener('pointerdown', () => Sfx.init(), true);
    document.addEventListener('pointerover', (e) => {
      const b = e.target.closest ? e.target.closest(BTN) : null;
      if (b === hov) return;
      hov = b;
      if (b && e.pointerType === 'mouse' && !b.disabled) Sfx.hover();
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest ? e.target.closest(BTN) : null;
      if (!b || b.disabled) return;
      if (b.dataset.sfx === 'equip') { Sfx.equip(); return; }
      const t = b.textContent.trim();
      Sfx.press(/-(back|close)$/.test(b.id) || t === 'BACK' || t === 'CLOSE' ? 'back' : b.classList.contains('tab') ? 'tab' : 'go');
    }, true);
    const pops = ['friend-card', 'scr-daily', 'scr-pause', 'emote-pop'].map((id) => $(id)).filter(Boolean);
    const mo = new MutationObserver((list) => { for (const r of list) { const was = r.oldValue !== null, now = r.target.hidden; if (was !== now) { if (now) Sfx.close(); else Sfx.open(); } } });
    for (const el of pops) mo.observe(el, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
  },
  bind() {
    this.bindSounds();
    const click = (id, fn) => $(id).addEventListener('click', () => { Sfx.init(); Sfx.click(); fn(); });
    click('go-ranked', () => Game.startMatch('ranked'));
    click('go-quick', () => Game.startMatch('quick'));
    click('go-lawless', () => Game.startMatch('lawless'));
    click('go-featured', () => Game.startMatch(featuredAt().mode));
    click('go-spins', () => this.openSpins());
    click('go-locker', () => this.openLocker());
    click('go-howto', () => this.show('howto'));
    click('go-daily', () => { this.renderDaily(); $('scr-daily').hidden = false; });
    click('dl-close', () => { $('scr-daily').hidden = true; });
    click('em-close', () => this.toggleEmotes(false));
    $('emote-pop').addEventListener('click', (e) => { const b = e.target.closest('[data-em]'); if (b) this.pickEmote(+b.dataset.em); });
    click('go-profile', () => this.show('profile'));
    click('go-pass', () => this.show('pass'));
    click('go-online', () => Net.open());
    click('pass-back', () => this.show('lobby'));
    click('goals-back', () => this.show('lobby'));
    click('go-goals', () => this.show('goals'));
    click('go-fk', () => Game.startMatch('freekick'));
    click('go-tut', () => Game.startMatch('tutorial'));
    click('howto-tut', () => Game.startMatch('tutorial'));
    click('lob-profile', () => this.show('profile'));
    $('lob-profile').addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.show('profile'); } });
    click('profile-back', () => this.show('lobby'));
    $('pf-code-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = redeemCode(Save.data, $('pf-code').value);
      $('pf-code-msg').textContent = r.msg; $('pf-code-msg').dataset.ok = r.ok ? '1' : '';
      if (r.ok) { $('pf-code').value = ''; Save.save(); Sfx.fanfare(2); this.renderProfile(); } else Sfx.deny();
    });
    click('fc-close', () => { $('friend-card').hidden = true; });
    click('spin-back', () => { if (!this.spinning) this.show('lobby'); });
    click('locker-back', () => this.show('lobby'));
    click('howto-back', () => this.show('lobby'));
    click('tab-style', () => { if (!this.spinning) { this.spinKind = 'style'; this.renderSpins(true); } });
    click('tab-flow', () => { if (!this.spinning) { this.spinKind = 'flow'; this.renderSpins(true); } });
    click('tab-skin', () => { if (!this.spinning) { this.spinKind = 'skin'; this.renderSpins(true); } });
    click('spin-go', () => this.spin());
    click('spin-skip', () => Reveal.skip());
    click('ltab-style', () => { this.lockerTab = 'style'; this.lockerSel = Save.data.style; this.renderLocker(); });
    click('ltab-flow', () => { this.lockerTab = 'flow'; this.lockerSel = Save.data.flow || 'NONE'; this.renderLocker(); });
    click('ltab-club', () => { this.lockerTab = 'club'; this.lockerSel = Save.data.club; this.renderLocker(); });
    click('ltab-skin', () => { this.lockerTab = 'skin'; this.lockerSel = this.skinSlot === 'tone' ? 'TONE' + Save.data.tone : Save.data.look[this.skinSlot]; this.renderLocker(); });
    $('lk-slots').addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (!b) return; Sfx.click(); this.skinSlot = b.dataset.slot; this.lockerSel = this.skinSlot === 'tone' ? 'TONE' + Save.data.tone : Save.data.look[this.skinSlot]; this.renderLocker(); });
    click('btn-mute', () => { Save.data.settings.mute = !Save.data.settings.mute; Portal.applyMute(); Save.save(); this.renderLobby(); });
    click('btn-gfx', () => { const order = ['auto', 'low', 'med', 'high']; const s = Save.data.settings; s.quality = order[(order.indexOf(s.quality) + 1) % 4]; Game.applyQuality(); Save.save(); this.renderLobby(); });
    click('p-resume', () => Game.resume());
    $('p-forfeit').addEventListener('click', () => {
      Sfx.click();
      const b = $('p-forfeit');
      if (b.dataset.armed) { delete b.dataset.armed; Game.forfeit(); }
      else { b.dataset.armed = '1'; b.textContent = Game.state === 'online' ? 'CONFIRM: A BOT TAKES OVER' : Game.match && Game.match.cfg.ranked ? 'CONFIRM: -15 RP' : 'CONFIRM FORFEIT'; }
    });
    click('r-again', () => { if (Game.lastMode === 'online') { Game.toLobby(); Net.open(); } else Game.startMatch(Game.lastMode || 'quick'); });
    click('r-lobby', () => { if (Game.lastMode === 'online') Net.send({ t: 'leave' }); Game.toLobby(); });
    $('set-q').addEventListener('click', (e) => { const q = e.target.dataset.q; if (!q) return; Save.data.settings.quality = q; Game.applyQuality(); Save.save(); this.renderPause(); });
    $('set-sens').addEventListener('input', (e) => { Save.data.settings.sens = parseFloat(e.target.value) || 1; Save.save(); });
    $('set-inv').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.invertY = v === '1'; Save.save(); this.renderPause(); });
    $('set-chat').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Net.setChatShow(v); this.renderPause(); });
    $('set-sky').addEventListener('click', (e) => { const v = e.target.dataset.v; if (!v) return; Save.data.settings.sky = v; World.setLook(v); Save.save(); this.renderPause(); });
    $('set-cut').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.cutins = v === '1'; Save.save(); this.renderPause(); });
    $('set-snd').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.mute = v === '0'; Portal.applyMute(); Save.save(); this.renderPause(); });
    $('set-btn').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.btn = parseFloat(v) || 1; Save.save(); Touch.layout(); this.renderPause(); });
    $('set-assist').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.assist = v === '1'; Save.save(); this.renderPause(); });
    $('set-sl').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null || (v === '1') === !!Save.data.settings.shiftLock) return; Cam.toggleShiftLock(); this.renderPause(); });
    $('set-cam').addEventListener('click', (e) => { const v = e.target.dataset.v; if (!v || v === Save.data.settings.cam) return; Cam.toggle(); this.renderPause(); });
    $('set-fs').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.autoFs = v === '1'; Save.save(); if ((v === '1') !== Touch.isFs()) Touch.toggleFs(); });
    click('btn-fs', () => { Save.data.settings.autoFs = !Touch.isFs(); Save.save(); Touch.toggleFs(); });
    window.addEventListener('keydown', (e) => {
      if (Game.playing() || Game.state === 'paused') return;
      if (e.code === 'Escape' && !$('friend-card').hidden) { $('friend-card').hidden = true; return; }
      if (e.code === 'Escape' && !$('scr-daily').hidden) { $('scr-daily').hidden = true; return; }
      if (e.code === 'Escape' && (this.cur === 'spins' || this.cur === 'locker' || this.cur === 'howto' || this.cur === 'profile' || this.cur === 'pass' || this.cur === 'goals' || this.cur === 'online') && !this.spinning && !(e.target && e.target.tagName === 'INPUT')) this.show('lobby');
    });
  },
  show(name) {
    const was = this.cur;
    this.cur = name;
    if (was && was !== name && was !== 'hud' && name !== 'hud') { if (name === 'lobby') Sfx.close(); else Sfx.open(); } // menus whoosh in and out (matches have their own sounds)
    const map = { lobby: 'scr-lobby', spins: 'scr-spins', locker: 'scr-locker', howto: 'scr-howto', profile: 'scr-profile', pass: 'scr-pass', goals: 'scr-goals', online: 'scr-online', hud: 'hud' };
    for (const k in map) $(map[k]).hidden = k !== name;
    if (name !== 'hud') { $('scoreboard').hidden = true; this.youLabel.hidden = true; for (const l of this.labels) { l.p = null; l.el.hidden = true; } }
    if (name === 'locker') Showcase.setStage('lk-fit', 'locker'); else if (name === 'spins') Showcase.setStage('sp-fit', 'reveal'); else Showcase.setStage('lob-stage', 'lobby');
    if (name !== 'spins') Reveal.stop();
    if (name === 'lobby') { this.renderLobby(); Showcase.ensure(); }
    if (name === 'howto') { Save.data.howto = true; Save.save(); }
    if (name === 'profile') this.renderProfile();
    if (name === 'pass') this.renderPass();
    if (name === 'goals') this.renderGoals();
  },
  /* ---------- lobby ---------- */
  renderLobby() {
    const d = Save.data, tier = tierOf(d.rp);
    const em = iconURL('emerald');
    $('lob-em-ico').src = em; $('lob-em').textContent = d.emeralds;
    $('btn-mute').textContent = d.settings.mute ? 'SOUND OFF' : 'SOUND ON';
    $('btn-gfx').textContent = 'GRAPHICS: ' + d.settings.quality.toUpperCase();
    const sz = teamSizeFor('ranked', d.rp);
    $('rank-sub').textContent = TIER_NAMES[tier] + ' · ' + sz + 'V' + sz;
    $('locker-sub').textContent = STYLES[d.style].name + (d.flow ? ' · ' + FLOWS[d.flow].name : '');
    $('bp-n').textContent = d.bp; // blueprints: earned on this screen's GOALS, spent in the Locker
    Daily.sync(d); $('go-daily').classList.toggle('ready', Daily.giftReady(d));
    $('go-tut').hidden = d.tutorial || d.stats.played >= 3; // new players: a way into the tutorial
    $('pro-badge').src = badgeURL(tier);
    Pass.sync(d); $('pass-sub').textContent = 'TIER ' + Pass.tier(d) + ' / ' + PASS_TIERS;
    $('pro-tier').textContent = TIER_NAMES[tier];
    const inTier = tier >= 5 ? 10 : Math.floor((d.rp % 100) / 10);
    $('pro-rp').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < inTier ? 'on' : ''}"></i>`).join('');
    $('pro-rptxt').textContent = tier >= 5 ? d.rp + ' RP · TOP TIER' : d.rp + ' RP · ' + (100 - (d.rp % 100)) + ' TO ' + TIER_NAMES[tier + 1];
    $('pro-style').textContent = STYLES[d.style].name;
    $('pro-style-r').dataset.r = STYLES[d.style].rarity; $('pro-style-r').textContent = STYLES[d.style].rarity.toUpperCase();
    $('pro-flow').textContent = d.flow ? FLOWS[d.flow].name : 'NONE';
    $('pro-club').textContent = CLUBS[d.club].nick;
    $('pro-rec').textContent = 'LEVEL ' + levelOf(d.xp).level + ' · ' + d.stats.wins + ' W · ' + d.stats.draws + ' D · ' + d.stats.losses + ' L · ' + d.stats.goals + ' GOALS';
    const notes = [];
    if (!Save.ok) notes.push('<span>This browser is blocking storage, so progress will not be saved after you close the page.</span>');
    if (Touch.on) notes.push('<span class="n-touch">' + (window.innerHeight > window.innerWidth ? 'Touch controls are on. Turn your phone sideways for a much wider view of the pitch.' : 'Touch controls are on. Left thumb moves, right thumb aims and shoots.') + '</span>');
    $('lob-notice').innerHTML = notes.join(' ');
    const fsb = $('btn-fs');
    fsb.hidden = !(Touch.on && Touch.fsAvailable());
    fsb.textContent = Touch.isFs() ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
  },
  /** the featured slot: this mode's name and the countdown to the next one (ticks once a second) */
  tickFeatured() {
    const f = featuredAt(), sec = Math.ceil(f.left / 1000);
    if (sec === this._featSec && f.mode === this._featMode) return;
    this._featSec = sec; this._featMode = f.mode;
    const hms = Math.floor(sec / 3600) + ':' + String(Math.floor(sec / 60) % 60).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    $('feat-name').textContent = MODES[f.mode].name;
    $('feat-sub').textContent = (MODES[f.mode].rewards ? 'FEATURED' : 'NO REWARDS') + ' · NEXT IN ' + hms;
  },
  /* ---------- HUD ---------- */
  buildHud(m) {
    const p = m.human;
    $('hud-mode').textContent = m.cfg.name + (m.mode === 'duel' || m.fk || m.tut ? '' : ' · ' + m.size + 'V' + m.size) + (m.cfg.ranked ? ' · VS ' + TIER_NAMES[m.tier] : '');
    $('hud-badge').src = badgeURL(tierOf(Save.data.rp)); $('hud-badge').hidden = !m.cfg.ranked;
    $('hud-em-ico').src = iconURL('emerald'); $('hud-em').textContent = Save.data.emeralds;
    for (const t of [0, 1]) { // the score bar wears each club's shirt
      const s = TEAM[t], el = $('sc' + t).parentElement;
      el.style.background = s.kit.shirt; el.style.color = hexLum(s.kit.shirt) > 0.55 ? 'var(--ink)' : 'var(--text)';
      el.style.boxShadow = 'inset 0 -5px 0 ' + s.kit.alt;
      $('sc' + t + '-nm').textContent = s.short;
    }
    const hb = $('hotbar');
    let html = '';
    p.abil.forEach((a, i) => {
      html += `<div class="slot" id="slot${i}"><img class="px" src="${iconURL(a.def.icon, p.aura)}" alt=""><span class="key k">${KEYS3[i]}</span><div class="cd"></div><div class="num"></div><span class="nm">${esc(a.def.name)}</span></div>`;
    });
    html += '<div class="sep"></div>';
    html += `<div class="slot small" id="slot-c"><img class="px" src="${iconURL('dash', '#ffffff')}" alt=""><span class="key k">C</span><div class="cd"></div><div class="pips"><i></i></div><span class="nm">FEINT</span></div>`;
    html += `<div class="slot small" id="slot-g"><img class="px" src="${iconURL('flame', p.aura)}" alt=""><span class="key k">G</span><div class="cd"></div><span class="nm">FLOW</span></div>`;
    hb.innerHTML = html;
    this.slots = [0, 1, 2].map((i) => ({ el: $('slot' + i), cd: $('slot' + i).querySelector('.cd'), num: $('slot' + i).querySelector('.num'), last: -1 }));
    this.slotC = { el: $('slot-c'), cd: $('slot-c').querySelector('.cd'), pips: $('slot-c').querySelectorAll('.pips i') };
    this.slotG = { el: $('slot-g') };
    const st = $('stamina');
    st.innerHTML = '';
    this.drums = [];
    for (let i = 0; i < 10; i++) { const im = document.createElement('img'); im.className = 'px'; im.alt = ''; st.appendChild(im); this.drums.push({ el: im, v: '' }); }
    this.drumURL = { full: iconURL('drum'), half: iconURL('drum', '#fff', 'half'), empty: iconURL('drum', '#fff', 'empty') };
    $('flowbar').style.setProperty('--aura', p.aura);
    $('flow-name').textContent = p.flowId ? 'FLOW · ' + FLOWS[p.flowId].name : 'FLOW';
    if (p.flowId && FLOWS[p.flowId]) $('flowbar').style.setProperty('--aura', FLOWS[p.flowId].color);
    $('awakebar').style.setProperty('--aura', p.aura); $('awakebar').hidden = true;
    $('awakeside').style.setProperty('--aura', p.aura); $('awakeside').hidden = true;
    $('aws-name').textContent = p.style.awaken ? p.style.awaken.name : '';
    $('awake-name').textContent = p.style.awaken ? (Touch.on ? '' : 'AWAKENING · ') + p.style.awaken.name : 'AWAKENING'; // phones: just the name, the bar is narrow
    $('itemslot').hidden = !m.cfg.items;
    this.mm = $('minimap').getContext('2d');
    this.hudCache = {};
    $('banner').hidden = true; $('toasts').innerHTML = '';
    this.hintT = Save.data.stats.played < 2 ? 9 : 0;
    if (Touch.on && window.innerHeight > window.innerWidth) this.hintT = Math.max(this.hintT, 6);
    Touch.build(m);
    this.lockHint();
  },
  setText(id, v) { const c = this.hudCache; if (c[id] !== v) { c[id] = v; $(id).textContent = v; } },
  updateHud(m, dt) {
    const p = m.human; if (!p) return;
    FKHud.update(m); TutHud.update(m);
    this.setText('sc0', String(m.score[0])); this.setText('sc1', String(m.score[1]));
    if (m.tut) { this.setText('clock', Math.min(m.tut.step + 1, TUT_STEPS.length) + '/' + TUT_STEPS.length); this.setText('clock-sub', 'TUTORIAL'); }
    else if (m.fk && m.fk.battle) { this.setText('clock', m.fk.bs[0] + '-' + m.fk.bs[1]); this.setText('clock-sub', 'FK BATTLE'); }
    else if (m.fk) { this.setText('clock', Math.min(m.fk.n, m.fk.total) + '/' + m.fk.total); this.setText('clock-sub', 'FREE KICK'); }
    else if (m.golden) { this.setText('clock', fmtTime(m.goldenClock)); this.setText('clock-sub', 'GOLDEN GOAL'); }
    else { this.setText('clock', fmtTime(m.clock)); this.setText('clock-sub', ''); }
    this.setText('hud-em', String(Save.data.emeralds));
    p.abil.forEach((a, i) => {
      const s = this.slots[i], frac = a.cd > 0 ? a.cd / (a.def.cd) : 0;
      const key = a.cd > 0 ? Math.ceil(frac * 60) + '|' + Math.ceil(a.cd) : 'ready'; // never 'ready' while any cooldown is left, so the last moment always redraws

      if (s.last !== key) { s.last = key; s.cd.style.setProperty('--p', (frac * 360).toFixed(1) + 'deg'); s.num.textContent = a.cd > 0 ? Math.ceil(a.cd) : ''; s.el.classList.toggle('ready', a.cd <= 0); }
    });
    const FXOF = { burst: 'burst', turbo: 'turbo', undeadShuffle: 'shuffle', lockdown: 'lockdown', skyTrap: 'skyTrap', vision: 'vision', scent: 'scent', loaded: 'loaded' };
    this.slots.forEach((s, i) => { const k = FXOF[p.abil[i].id]; s.el.classList.toggle('active', !!k && p.fx[k] > 0); });
    const C = this.slotC;
    C.pips.forEach((pip, i) => pip.classList.toggle('on', i < p.dodgeCharges));
    C.cd.style.setProperty('--p', (p.dodgeCharges >= 1 ? 0 : (1 - p.dodgeRe / FEINT_CD) * 360).toFixed(1) + 'deg');
    const has = m.ball.owner === p; $('xhair').classList.toggle('ball', has); $('balltag').hidden = !has; // a frame and BALL while you have the ball
    this.slotG.el.classList.toggle('ready', p.flow >= 100 && p.flowT <= 0);
    this.slotG.el.classList.toggle('active', p.flowT > 0);
    const fpct = p.flowT > 0 ? p.flowT / 15 * 100 : p.flow;
    $('flow-fill').style.width = fpct.toFixed(1) + '%';
    this.setText('flow-txt', p.flowT > 0 ? 'IN FLOW ' + Math.ceil(p.flowT) + 's' : p.flow >= 100 ? (Touch.on ? 'READY' : 'READY [G]') : Math.floor(p.flow) + '%');
    $('flowbar').classList.toggle('ready', p.flow >= 100 && p.flowT <= 0);
    if (p.style.awaken) {
      const ar = false; // no bar to fill: it comes by itself
      $('awakeside').hidden = $('awakebar').hidden = !(p.awakeT > 0); // only while you are awakened
      const apct = (p.awakeT > 0 ? p.awakeT / AWAKEN_TIME * 100 : p.awake).toFixed(1) + '%';
      $('awake-fill').style.width = apct; $('aws-fill').style.height = apct;
      this.setText('aws-txt', p.awakeT > 0 ? Math.ceil(p.awakeT) + 's' + (!p.awakeMoveUsed && p.style.awaken.move ? ' · Z: ' + p.style.awaken.move.name : '') : ar ? 'READY' : Math.floor(p.awake) + '%');
      $('awakeside').classList.toggle('ready', ar); $('awakeside').classList.toggle('active', p.awakeT > 0);
      this.setText('awake-txt', p.awakeT > 0 ? (Touch.on ? '' : 'AWAKENED ') + Math.ceil(p.awakeT) + 's' : ar ? (Touch.on ? 'READY' : 'READY [Z]') : Math.floor(p.awake) + '%');
      $('awakebar').classList.toggle('ready', ar); $('awakebar').classList.toggle('active', p.awakeT > 0);
    }
    $('stamina').classList.toggle('tired', !!p.exhausted); // out of breath: the drums flash red
    for (let i = 0; i < 10; i++) {
      const v = p.stamina - i * 10, want = v >= 7.5 ? 'full' : v >= 2.5 ? 'half' : 'empty';
      if (this.drums[i].v !== want) { this.drums[i].v = want; this.drums[i].el.src = this.drumURL[want]; }
    }
    const ch = $('charge');
    if (p.charging || p.passHold > 0.24) {
      ch.hidden = false;
      const lob = !p.charging;
      ch.classList.toggle('lob', lob);
      $('charge-fill').style.width = (lob ? 100 : Math.max(28, p.charge * 100)).toFixed(0) + '%';
      this.setText('charge-txt', lob ? 'LOB' : p.charge >= 1 ? 'MAX POWER' : 'POWER');
    } else ch.hidden = true;
    $('xhair').style.filter = m.aimOnTarget ? 'drop-shadow(0 0 0 #ffcb3d)' : '';
    $('xhair').classList.toggle('on', m.aimOnTarget);
    if (m.cfg.items) {
      const it = p.item ? ITEMS[p.item] : null;
      const key = it ? p.item : '';
      if (this.hudCache.item !== key) { this.hudCache.item = key; $('item-img').src = it ? iconURL(it.icon) : iconURL('lock'); $('item-nm').textContent = it ? it.name : 'NO ITEM'; $('item-img').style.opacity = it ? 1 : 0.35; }
    }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').hidden = true; }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.lockHint(); }
    this.drawMinimap(m);
    this.updateLabels(m, dt);
    Touch.update(m, dt);
    const board = Input.controls().board;
    if (board) this.renderScoreboard(m);
    $('scoreboard').hidden = !board;
  },
  lockHint() {
    const h = $('hint'); if (!h) return;
    if (!Game.playing()) { h.hidden = true; return; }
    let txt = '';
    const fk = Game.match && Game.match.human && Game.match.human.fkHold; // your free kick
    if (fk && this.hintT > 0 && !(Input.lockFailed || (!Input.locked && !Input.usingPad && !Touch.on))) txt = Touch.on && !Input.usingPad ? 'DRAG TO AIM · STICK CURVES · TYPE CHANGES THE KICK · HOLD SHOOT' : Input.usingPad ? 'RIGHT STICK AIMS · LEFT STICK CURVES · LT CHANGES THE KICK · HOLD RT' : 'MOUSE AIMS · A D CURVE · RMB CHANGES THE KICK · HOLD LMB'; // free kicks
    else if (Touch.on && !Input.usingPad) {
      if (this.hintT > 0) {
        const ctl = 'LEFT THUMB MOVES · DRAG THE RIGHT SIDE TO AIM · HOLD SHOOT, LET GO TO FIRE';
        const tall = window.innerHeight > window.innerWidth;
        txt = !tall ? ctl : Save.data.stats.played < 2 ? 'TURN SIDEWAYS FOR A WIDER VIEW · HOLD SHOOT, LET GO TO FIRE' : 'TURN YOUR PHONE SIDEWAYS FOR A WIDER VIEW';
      }
    } else if (Input.lockFailed && !Input.usingPad) txt = 'MOUSE LOCK IS BLOCKED HERE. TURN THE CAMERA WITH THE ARROW KEYS.';
    else if (!Input.locked && !Input.usingPad) txt = 'CLICK THE PITCH TO LOCK THE MOUSE';
    else if (this.hintT > 0) txt = 'HOLD LMB TO SHOOT · RMB TO PASS · C TO FEINT · F TO SLIDE';
    h.textContent = txt; h.hidden = !txt;
  },
  drawMinimap(m) {
    const g = this.mm; if (!g) return;
    const W = 132, H = 200, kx = W / (F.BOARD_X * 2 + 1), kz = H / (F.BOARD_Z * 2 + 1);
    const X = (x) => (F.BOARD_X + 0.5 - x) * kx, Z = (z) => (F.BOARD_Z + 0.5 - z) * kz;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(46,110,40,0.85)'; g.fillRect(X(F.W), Z(F.L), (F.W * 2) * kx, (F.L * 2) * kz);
    g.strokeStyle = 'rgba(245,239,224,0.7)'; g.lineWidth = 1;
    g.strokeRect(Math.round(X(F.W)) + 0.5, Math.round(Z(F.L)) + 0.5, Math.round(F.W * 2 * kx), Math.round(F.L * 2 * kz));
    g.beginPath(); g.moveTo(X(F.W), Math.round(Z(0)) + 0.5); g.lineTo(X(-F.W), Math.round(Z(0)) + 0.5); g.stroke();
    g.fillStyle = TEAM[1].hex; g.fillRect(X(F.GW), Z(F.L + 1.5), F.GW * 2 * kx, 2);
    g.fillStyle = TEAM[0].hex; g.fillRect(X(F.GW), Z(-F.L) - 0, F.GW * 2 * kx, 2);
    for (const it of m.items) { g.fillStyle = '#ffcb3d'; g.fillRect(X(it.x) - 2, Z(it.z) - 2, 4, 4); }
    if (m.hill) { const H = m.hill; g.strokeStyle = H.holder >= 0 ? TEAM[H.holder].hex : '#f5efe0'; g.lineWidth = 2; g.beginPath(); g.ellipse(X(H.x), Z(H.z), H.r * kx, H.r * kz, 0, 0, TAU); g.stroke(); }
    for (const p of m.players) {
      const x = X(p.pos.x), z = Z(p.pos.z);
      g.fillStyle = '#090b16'; g.fillRect(x - 3.5, z - 3.5, 7, 7);
      g.fillStyle = p.isGK ? TEAM[p.team].keeper.shirt : TEAM[p.team].hex; g.fillRect(x - 2.5, z - 2.5, 5, 5);
      if (p.isHuman) { g.strokeStyle = '#ffcb3d'; g.lineWidth = 2; g.strokeRect(x - 4.5, z - 4.5, 9, 9); }
    }
    const b = m.ball; g.fillStyle = '#ffffff'; g.fillRect(X(b.pos.x) - 2, Z(b.pos.z) - 2, 4, 4);
    if (m.human) {
      const h = m.human, x = X(h.pos.x), z = Z(h.pos.z), fx = Math.sin(m.camYaw), fz = Math.cos(m.camYaw);
      g.strokeStyle = 'rgba(255,203,61,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, z); g.lineTo(x - fx * 12, z - fz * 12 * (kz / kx)); g.stroke();
    }
  },
  /* floating labels above players */
  flabel(p, text, color, dur) {
    if (!p || !Game.playing()) return;
    let slot = this.labels.find((l) => l.p === p && l.t > 0) || this.labels.find((l) => l.t <= 0) || this.labels.reduce((a, b) => (a.t < b.t ? a : b));
    slot.p = p; slot.t = slot.dur = dur || (text === '!' ? 0.9 : 1.25); slot.text = text; slot.color = color || '#f5efe0'; slot.think = text === '...';
    slot.el.textContent = text; slot.el.style.setProperty('--c', slot.color);
    slot.el.classList.toggle('call', text === '!'); slot.el.classList.toggle('think', slot.think);
    slot.el.hidden = false;
  },
  updateLabels(m, dt) {
    const cam = World.camera, w = window.innerWidth, h = window.innerHeight;
    const proj = (p, yOff) => { _v4.set(p.pos.x, p.pos.y + yOff, p.pos.z).project(cam); return { x: (_v4.x * 0.5 + 0.5) * w, y: (-_v4.y * 0.5 + 0.5) * h, ok: _v4.z < 1 && Math.abs(_v4.x) < 1.1 && Math.abs(_v4.y) < 1.1 }; };
    for (const l of this.labels) {
      if (l.t <= 0 || !l.p) { if (!l.el.hidden) l.el.hidden = true; continue; }
      l.t -= dt;
      const s = proj(l.p, 2.35 + (l.think ? 0 : (l.dur - l.t) * 0.4));
      if (!s.ok || l.t <= 0) { l.el.hidden = true; continue; }
      l.el.hidden = false;
      l.el.style.left = s.x.toFixed(0) + 'px'; l.el.style.top = s.y.toFixed(0) + 'px';
      l.el.style.opacity = Math.min(1, l.t * 3).toFixed(2);
    }
    const hp = m.human;
    if (hp && (m.phase === 'kickoff' || m.phase === 'out')) {
      const s = proj(hp, 2.5);
      this.youLabel.hidden = !s.ok; this.youLabel.style.left = s.x.toFixed(0) + 'px'; this.youLabel.style.top = s.y.toFixed(0) + 'px';
    } else this.youLabel.hidden = true;
  },
  toast(text, cls = '') {
    if (!Game.playing()) return;
    const wrap = $('toasts');
    while (wrap.children.length >= 4) wrap.removeChild(wrap.firstChild);
    const d = document.createElement('div');
    d.className = 'toast ' + cls; d.textContent = text;
    wrap.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 1700);
  },
  banner(big, small, color, dur = 2.0) {
    const b = $('banner');
    $('banner-big').textContent = big; $('banner-small').textContent = small || '';
    b.style.setProperty('--bc', color || '#3d7dff');
    b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    this.bannerT = dur;
  },
  goalBanner(team, scorer, assister, own) {
    let small = own ? 'OWN GOAL' : (scorer ? '#' + scorer.number + ' ' + scorer.name + ' · ' + scorer.style.name + ' STYLE' : '');
    if (assister) small += '  ·  ASSIST #' + assister.number + ' ' + assister.name;
    this.banner('GOAL!', small, TEAM[team].hex, 3.4);
  },
  renderScoreboard(m) {
    const now = m.time;
    if (this._sbT && now - this._sbT < 0.25) return;
    this._sbT = now;
    const rows = (team) => m.teams[team].map((p) => `<tr class="${p.isHuman ? 'me' : ''}"><td class="tb" style="background:${TEAM[team].hex}"></td><td>#${p.number} ${esc(p.name)}</td><td>${p.isGK ? 'KEEPER' : esc(p.style.name)}</td><td>${p.stats.goals}</td><td>${p.stats.assists}</td><td>${p.stats.shots}</td><td>${p.stats.tackles}</td><td>${p.stats.saves}</td></tr>`).join('');
    const th = (lg, sm) => `<th><span class="lg">${lg}</span><span class="sm">${sm}</span></th>`;
    $('scoreboard').innerHTML = `<table><thead><tr><th class="tb"></th><th>PLAYER</th><th>STYLE</th><th>G</th><th>A</th>${th('SHOTS', 'SH')}${th('TACKLES', 'TK')}${th('SAVES', 'SV')}</tr></thead><tbody>${rows(0)}${rows(1)}</tbody></table>`;
  },
  /* ---------- pause + results ---------- */
  renderPause() {
    const s = Save.data.settings;
    $('set-q').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.q === s.quality));
    $('set-inv').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!s.invertY));
    $('set-snd').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === !s.mute));
    $('set-cut').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === (s.cutins !== false)));
    $('set-sky').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === s.sky));
    $('set-chat').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === s.chat));
    $('set-cam').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === s.cam));
    $('set-sl').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!s.shiftLock));
    Net.renderPeople();
    $('set-sens').value = s.sens;
    $('set-btn').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', Math.abs(parseFloat(b.dataset.v) - (s.btn || 1)) < 0.01));
    $('set-assist').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === (s.assist !== false)));
    const fs = Touch.on && Touch.fsAvailable();
    document.querySelectorAll('#scr-pause .fs-only').forEach((el) => { el.hidden = !fs; });
    $('set-fs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === Touch.isFs()));
    $('p-note').textContent = Touch.on ? 'Tip: double tap the right side of the screen to face the goal you attack.' : 'Click the pitch after resuming to lock the mouse again.';
    const f = $('p-forfeit'); delete f.dataset.armed; f.textContent = Game.state === 'online' ? 'LEAVE MATCH' : 'FORFEIT';
    $('p-note').textContent = Game.state === 'online' ? 'Online matches keep going while this menu is open.' : $('p-note').textContent;
    $('scr-pause').querySelector('h2').textContent = Game.state === 'online' ? 'MENU' : 'PAUSED';
  },
  showPause(on) {
    if (on && Net.chatOpen) Net.closeChat(false);
    if (on && this.emoteOpen) this.toggleEmotes(false);
    if (on) { this.renderPause(); $('scoreboard').hidden = true; Touch.board = false; for (const l of this.labels) { l.t = 0; l.el.hidden = true; } this.youLabel.hidden = true; }
    $('scr-pause').hidden = !on;
  },
  showResults(r) {
    $('r-again').textContent = 'PLAY AGAIN'; $('r-lobby').textContent = 'LOBBY';
    const titles = { win: ['VICTORY', '#2ee38f'], draw: ['DRAW', '#ffcb3d'], loss: ['DEFEAT', '#ff4d5e'], forfeit: ['FORFEIT', '#ff4d5e'] };
    const [t, c] = titles[r.res];
    $('r-title').textContent = t; $('r-title').style.color = c;
    $('r-score').innerHTML = `<span style="color:${TEAM[0].hex}">${TEAM[0].short} ${r.score[0]}</span><span>:</span><span style="color:${TEAM[1].hex}">${r.score[1]} ${TEAM[1].short}</span><span class="chip">${esc(r.modeName)}</span>`;
    const s = r.human || { goals: 0, assists: 0, shots: 0, tackles: 0 };
    $('r-stats').innerHTML = [['GOALS', s.goals], ['ASSISTS', s.assists], ['SHOTS', s.shots], ['TACKLES', s.tackles]].map(([k, v]) => `<div><span class="label">${k}</span><b>${v}</b></div>`).join('');
    $('r-earn').innerHTML = (r.idle ? `<div class="idle-note"><span>${r.noReward === 'rank' ? 'THEY WERE FAR BELOW YOUR RANK, SO THIS MATCH GIVES NO REWARDS' : r.noReward === 'fun' ? 'THIS MODE IS JUST FOR FUN, SO IT GIVES NO REWARDS. QUICK MATCH, RANKED AND LAWLESS DO, AND SO DOES EVERY MODE WITH FRIENDS' : 'A BOT PLAYED FOR YOU, SO THIS MATCH GIVES NO REWARDS'}</span></div>` : '') + r.earn.map(([k, v]) => `<div><span>${esc(k)}</span><span>+${v}</span></div>`).join('') + `<div class="tot"><span>EMERALDS EARNED</span><span>+${r.emeralds}</span></div>`;
    if (r.ranked) {
      const tier = tierOf(r.rpAfter), moved = tierOf(r.rpBefore) !== tier;
      const delta = r.rpAfter - r.rpBefore;
      $('r-rank').innerHTML = `<img class="px" src="${badgeURL(tier)}" alt=""><div><div class="label">${moved ? (tier > tierOf(r.rpBefore) ? 'PROMOTED' : 'DEMOTED') : 'RANK'}</div><div style="font-family:var(--font-display);font-size:34px;line-height:1">${TIER_NAMES[tier]} · ${r.rpAfter} RP <span style="color:${delta >= 0 ? 'var(--emerald)' : 'var(--danger)'}">${delta >= 0 ? '+' : ''}${delta}</span></div></div>`;
      $('r-rank').hidden = false;
    } else { $('r-rank').hidden = true; }
    const lv = levelOf(Save.data.xp);
    $('r-xp').innerHTML = `<span class="label">${r.levelUp ? '<b class="lvup">LEVEL UP!</b> ' : ''}LEVEL ${lv.level} · +${r.xp || 0} XP</span><div class="xpbar"><i style="width:${(lv.into / lv.need * 100).toFixed(1)}%"></i></div>`;
    const P = r.pass || { xp: 0, challenges: [], tiers: [] }, pd = Save.data.pass;
    $('r-pass').innerHTML = `<span class="label">GAME PASS · TIER ${Pass.tier(Save.data)} / ${PASS_TIERS} · +${P.xp} XP${P.xp ? '' : (r.res === 'forfeit' || r.idle ? '' : ' (DO SOMETHING ON THE BALL TO EARN PASS XP)')}</span><div class="xpbar pass"><i style="width:${(pd.xp % PASS_TIER_XP) / PASS_TIER_XP * 100}%"></i></div>`
      + P.challenges.map((c) => `<span class="label pl-ch">CHALLENGE DONE: ${esc(c)}</span>`).join('') + P.tiers.map((t) => `<span class="label pl-tier">${esc(t)}</span>`).join('');
    $('r-daily').dataset.goals = '';
    const D = r.daily;
    $('r-daily').innerHTML = !D ? '' : D.now ? `<span class="label pl-ch">DAILY CHALLENGE DONE: ${esc(D.name)} +${DAILY_REWARD.emeralds} EMERALDS +${DAILY_REWARD.xp} XP</span>`
      : `<span class="label">DAILY CHALLENGE · ${esc(D.name)} · ${D.done ? 'DONE' : D.prog + ' / ' + D.goal}</span>`;
    if (r.goalsDone && r.goalsDone.length) $('r-daily').innerHTML += r.goalsDone.map((t) => `<span class="label pl-tier">GOAL DONE: ${esc(t)}</span>`).join('');
    $('hint').hidden = true;
    $('scr-results').hidden = false;
  },
  /** the tutorial is done: a first-time reward and a button straight into a quick match */
  showTutorialDone(first) {
    $('r-again').textContent = 'PLAY A QUICK MATCH'; $('r-lobby').textContent = 'LOBBY';
    $('r-title').textContent = 'TUTORIAL DONE'; $('r-title').style.color = '#2ee38f';
    $('r-score').innerHTML = '<span>YOU ARE READY</span><span class="chip">TUTORIAL</span>';
    $('r-stats').innerHTML = '';
    $('r-earn').innerHTML = first ? `<div class="tot"><span>FIRST TIME BONUS</span><span>+${TUT_REWARD}</span></div>` : '<div class="idle-note"><span>YOU CAN PLAY IT AGAIN ANY TIME FROM HOW TO PLAY</span></div>';
    $('r-rank').hidden = true; $('r-xp').innerHTML = ''; $('r-pass').innerHTML = ''; $('r-daily').innerHTML = '';
    $('hint').hidden = true;
    $('scr-results').hidden = false;
  },
  /** free kick practice: your score, your best, what happened to each kick */
  showPractice(r) {
    $('r-again').textContent = 'AGAIN'; $('r-lobby').textContent = 'LOBBY';
    $('r-title').textContent = r.goals + ' / ' + r.total; $('r-title').style.color = r.goals >= 7 ? '#2ee38f' : r.goals >= 4 ? '#ffcb3d' : '#ff4d5e';
    $('r-score').innerHTML = `<span>${r.newBest ? 'NEW BEST!' : 'BEST ' + r.best + ' / ' + r.total}</span><span class="chip">FREE KICKS</span>`;
    const n = (w) => r.log.filter((x) => x === w).length;
    $('r-stats').innerHTML = [['GOALS', n('GOAL')], ['SAVED', n('SAVED')], ['BLOCKED', n('BLOCKED')], ['MISSED', n('MISS')]].map(([k, v]) => `<div><span class="label">${k}</span><b>${v}</b></div>`).join('');
    $('r-earn').innerHTML = '<div class="idle-note"><span>PRACTICE GIVES NO REWARDS. JUST GET BETTER</span></div>';
    $('r-rank').hidden = true; $('r-xp').innerHTML = ''; $('r-pass').innerHTML = ''; $('r-daily').innerHTML = '';
    $('hint').hidden = true;
    $('scr-results').hidden = false;
  },
  hideOverlays() { $('scr-results').hidden = true; $('scr-pause').hidden = true; },
  /* ---------- spins ---------- */
  openSpins() { this.show('spins'); this.renderSpins(true); },
  renderSpins(resetReel) {
    const d = Save.data, kind = this.spinKind;
    for (const k of ['style', 'flow', 'skin']) $('tab-' + k).setAttribute('aria-selected', kind === k);
    $('spin-em-ico').src = iconURL('emerald'); $('spin-em').textContent = d.emeralds;
    const left = 30 - d.pity[kind];
    $('spin-pity').textContent = 'LEGENDARY OR BETTER GUARANTEED IN ' + left + (left === 1 ? ' SPIN' : ' SPINS');
    $('spin-odds').innerHTML = RARITIES.map((r, i) => `<span class="rar" data-r="${r}">${r.toUpperCase()} ${RARITY_ODDS[i]}%</span>`).join('');
    const cost = SPIN_COST[kind];
    $('spin-go').disabled = this.spinning || d.emeralds < cost;
    $('spin-go').innerHTML = d.emeralds < cost ? 'SPIN <span class="sub">NEED ' + cost + ' EMERALDS</span>' : 'SPIN <span class="sub">' + cost + ' EMERALDS</span>';
    const owned = kind === 'style' ? d.styles.length + ' / ' + STYLE_IDS.length + ' STYLES OWNED' : kind === 'flow' ? d.flows.length + ' / ' + FLOW_IDS.length + ' FLOWS OWNED' : d.skins.filter((k) => !SKINS[k].pass).length + ' / ' + SKIN_IDS.length + ' SKINS OWNED (LOOKS ONLY)';
    $('spin-owned').textContent = owned + '. WIN MATCHES TO EARN MORE EMERALDS.';
    if (resetReel) { $('spin-result').innerHTML = ''; $('spin-result').classList.remove('show'); Reveal.ready(); }
  },
  spin() {
    if (this.spinning) return;
    const d = Save.data, kind = this.spinKind;
    const cost = SPIN_COST[kind];
    if (d.emeralds < cost) { Sfx.deny(); return; }
    Sfx.init();
    // the roll: same odds and 30-spin guarantee as always; the 3D reveal only shows the result
    d.emeralds -= cost;
    const pity = d.pity[kind];
    const r = rollRarity(pity);
    d.pity[kind] = r >= 2 ? 0 : pity + 1;
    const pool = poolFor(kind, r);
    const id = pick(pool);
    const owned = kind === 'style' ? d.styles : kind === 'flow' ? d.flows : d.skins;
    const dupe = owned.includes(id);
    let replaced = null;
    if (dupe) d.emeralds += 50;
    else if (kind === 'style') { replaced = d.spunStyle !== id ? d.spunStyle : null; d.spunStyle = id; d.style = id; } // yours (and on) until your next style spin
    else owned.push(id);
    this.spinReplaced = replaced;
    d.stats.spins = (d.stats.spins || 0) + 1;
    Save.save();
    this.spinning = true;
    this.renderSpins(false);
    $('spin-result').classList.remove('show'); $('spin-skip').hidden = false;
    Reveal.start({ kind, id, r, dupe }, () => this.spinDone(kind, id, r, dupe));
  },
  spinDone(kind, id, r, dupe) {
    this.spinning = false;
    $('spin-skip').hidden = true;
    const src = kind === 'style' ? STYLES[id] : kind === 'flow' ? FLOWS[id] : SKINS[id];
    const tag = dupe ? `<span class="tag dupe">${kind === 'style' ? 'ALREADY YOURS' : 'DUPLICATE'} · +50 EMERALDS</span>`
      : kind === 'style' ? `<span class="tag">YOURS UNTIL YOUR NEXT STYLE SPIN${this.spinReplaced ? ' · REPLACES ' + esc(STYLES[this.spinReplaced].name) : ''}</span>` : '<span class="tag">NEW</span>';
    const slotName = kind === 'skin' ? '<span class="label">' + SKIN_SLOTS.find((sl) => sl.id === src.slot).name + ' SKIN</span>' : '';
    const res = $('spin-result');
    const keep = kind === 'style' && !dupe ? `<span class="label">KEEP IT FOR GOOD: ${BP_COST[src.rarity]} BLUEPRINTS (YOU HAVE ${Save.data.bp})</span>`
      + (Save.data.bp >= BP_COST[src.rarity] ? '<button class="btn small emerald" id="spin-keep" type="button">KEEP IT</button>' : '') : '';
    res.innerHTML = `<span class="cv"></span><span class="rar" data-r="${src.rarity}">${src.rarity.toUpperCase()}</span><span>${esc(src.name)}</span>${slotName}${tag}${!dupe && kind !== 'style' ? '<button class="btn small blue" id="spin-equip" type="button">EQUIP</button>' : ''}${keep}`;
    res.querySelector('.cv').replaceWith(kind === 'style' ? portraitCanvas(id, 48) : kind === 'flow' ? flowEmblemCanvas(id, 48) : skinCanvas(id, 48));
    res.classList.add('show');
    const eq = $('spin-equip');
    const kp = $('spin-keep');
    if (kp) kp.addEventListener('click', () => { if (Goals.unlock(Save.data, id)) { Save.save(); Sfx.coin(); kp.textContent = 'YOURS FOR GOOD'; kp.disabled = true; } });
    if (eq) eq.addEventListener('click', () => { Sfx.click(); if (kind === 'style') Save.data.style = id; else if (kind === 'flow') Save.data.flow = id; else Save.data.look[src.slot] = id; Save.save(); eq.textContent = 'EQUIPPED'; eq.disabled = true; });
    this.renderSpins(false);
  },
  /* ---------- locker ---------- */
  openLocker() { this.lockerTab = 'style'; this.lockerSel = Save.data.style; this.show('locker'); this.renderLocker(); },
  /** what a card in the current tab stands for */
  lockerItem(id) {
    const d = Save.data, tab = this.lockerTab;
    if (tab === 'style') { const st = STYLES[id], spun = d.spunStyle === id; return { name: st.name, rarity: st.rarity, owned: d.styles.includes(id) || spun, spun, equipped: d.style === id, from: 'STYLE SPINS OR ' + BP_COST[st.rarity] + ' BLUEPRINTS', bp: BP_COST[st.rarity] }; }
    if (tab === 'club') { const c = CLUBS[id]; return { name: c.name, rarity: 'Rare', chip: c.short, owned: true, equipped: d.club === id }; }
    if (tab === 'flow') { const fl = id === 'NONE' ? null : FLOWS[id]; return { name: fl ? fl.name : 'NO FLOW', rarity: fl ? fl.rarity : 'Rare', base: !fl, owned: !fl || d.flows.includes(id), equipped: (d.flow || 'NONE') === id, from: 'FLOW SPINS' }; }
    if (id.startsWith('TONE')) { const n = +id.slice(4); return { name: 'SKIN ' + (n + 1), rarity: 'Rare', base: true, owned: true, equipped: d.tone === n }; }
    const sk = SKINS[id];
    return { name: sk.name, rarity: sk.rarity, base: !!sk.base, owned: !!sk.base || d.skins.includes(id), equipped: d.look[sk.slot] === id, from: sk.pass ? 'GAME PASS TIER ' + (PASS_REWARDS.findIndex((r) => r.skin === id) + 1) : 'SKIN SPINS' };
  },
  lockerArt(id, size) {
    const tab = this.lockerTab;
    if (tab === 'club') return crestCanvas(id, size);
    const look = Object.assign(lookFor(Save.data.style, Save.data.look), { skin: SKIN_TONES[Save.data.tone] });
    if (id.startsWith && id.startsWith('TONE')) return portraitCanvas(Save.data.style, size, Object.assign(look, { skin: SKIN_TONES[+id.slice(4)] }));
    return tab === 'style' ? portraitCanvas(id, size, Object.assign(lookFor(id, Save.data.look), { skin: SKIN_TONES[Save.data.tone] })) : tab === 'flow' ? flowEmblemCanvas(id === 'NONE' ? null : id, size) : skinCanvas(id, size);
  },
  renderLocker() {
    const d = Save.data, tab = this.lockerTab;
    for (const t of ['style', 'flow', 'skin', 'club']) $('ltab-' + t).setAttribute('aria-selected', tab === t);
    const slots = $('lk-slots');
    slots.hidden = tab !== 'skin';
    if (tab === 'skin') slots.innerHTML = `<button class="tab" type="button" role="tab" data-slot="tone" aria-selected="${this.skinSlot === 'tone'}">SKIN</button>` + SKIN_SLOTS.map((sl) => `<button class="tab" type="button" role="tab" data-slot="${sl.id}" aria-selected="${this.skinSlot === sl.id}">${sl.name}</button>`).join('');
    const ids = tab === 'club' ? CLUB_IDS : tab === 'style' ? STYLE_IDS : tab === 'flow' ? ['NONE'].concat(FLOW_IDS)
      : this.skinSlot === 'tone' ? SKIN_TONES.map((t, i) => 'TONE' + i)
      : [SKIN_SLOTS.find((sl) => sl.id === this.skinSlot).base].concat(LOCKER_SKIN_IDS.filter((k) => SKINS[k].slot === this.skinSlot).sort((a, b) => RARITIES.indexOf(SKINS[a].rarity) - RARITIES.indexOf(SKINS[b].rarity)));
    const grid = $('locker-grid');
    grid.innerHTML = ids.map((id) => {
      const it = this.lockerItem(id);
      return `<button type="button" class="lcard ${it.owned ? '' : 'locked'}" data-id="${id}" aria-pressed="${this.lockerSel === id}" style="--rc:${it.base ? '#5a5f78' : RARITY_HEX[it.rarity]}"><span class="art"><span class="cv"></span><span class="nm">${esc(it.name)}</span></span><span class="meta">${it.chip || it.base ? `<span class="chip">${it.chip || 'FREE'}</span>` : `<span class="rar" data-r="${it.rarity}">${it.rarity.toUpperCase()}</span>`}<span class="label">${it.equipped ? 'EQUIPPED' : it.spun ? 'FROM SPIN' : it.owned ? 'OWNED' : 'LOCKED'}</span></span></button>`;
    }).join('');
    grid.querySelectorAll('.lcard').forEach((b) => {
      b.querySelector('.cv').replaceWith(this.lockerArt(b.dataset.id, 40));
      b.addEventListener('click', () => { Sfx.click(); this.lockerSel = b.dataset.id; this.renderLocker(); });
    });
    this.renderLockerDetail();
    // the 3D player tries on whatever card is picked, owned or not
    const id = this.lockerSel, spec = { look: {} };
    if (tab === 'style') spec.style = id;
    else if (tab === 'club') spec.club = id;
    else if (tab === 'flow') spec.flow = id === 'NONE' ? null : id;
    else if (id.startsWith('TONE')) spec.tone = +id.slice(4);
    else { spec.look[SKINS[id].slot] = id; spec.celebrate = SKINS[id].slot === 'celeb'; }
    Showcase.preview(spec);
  },
  renderLockerDetail() {
    const d = Save.data, tab = this.lockerTab, id = this.lockerSel, it = this.lockerItem(id);
    const det = $('locker-detail');
    const head = (sub, blurb) => `<div class="head"><span class="cv"></span><div style="display:grid;gap:6px">${it.chip ? `<span class="chip" style="justify-self:start">${it.chip}</span>` : it.base ? '<span class="chip" style="justify-self:start">FREE</span>' : `<span class="rar" data-r="${it.rarity}" style="justify-self:start">${it.rarity.toUpperCase()}</span>`}<h3>${esc(it.name)}</h3>${sub ? `<span class="label">${sub}</span>` : ''}${blurb ? `<p style="margin:0;color:var(--muted);max-width:46ch">${esc(blurb)}</p>` : ''}</div></div>`;
    if (tab === 'style') {
      const st = STYLES[id];
      det.innerHTML = head('', st.blurb) + `<div class="ab-list">${st.abilities.map((a, i) => { const A = ABILITIES[a]; return `<div class="ab"><img class="px" src="${iconURL(A.icon, st.aura)}" alt=""><div><div class="t"><span class="key">${KEYS3[i]}</span><b>${esc(A.name)}</b><span class="label">${A.cd}S COOLDOWN</span></div><p>${esc(A.desc)}</p></div></div>`; }).join('')}`
        + (st.awaken ? `<div class="ab awaken"><img class="px" src="${iconURL('flame', st.aura)}" alt=""><div><div class="t"><span class="key">Z</span><b>AWAKENING · ${esc(st.awaken.name)}</b><span class="label">${AWAKEN_TIME}S</span></div><p>${esc(st.awaken.desc + ' ' + AWAKEN_ALL)}</p></div></div>` : '')
        + (st.awaken && st.awaken.move ? `<div class="ab awaken"><img class="px" src="${iconURL('flame', '#ffffff')}" alt=""><div><div class="t"><span class="key">Z</span><b>${esc(st.awaken.move.name)}</b><span class="label">AWAKENED · ONCE</span></div><p>${esc(st.awaken.move.desc)}</p></div></div>` : '') + '</div>';
    } else if (tab === 'club') {
      const c = CLUBS[id];
      det.innerHTML = head('', 'The club you play for. Your team wears its kit, and its fans fill your stands.') + `<div class="kits">${[['HOME', c.home], ['AWAY', c.away], ['KEEPER', c.keeper]].map(([n]) => `<div class="kitbox"><span class="kv"></span><span class="label">${n}</span></div>`).join('')}</div>
        <p style="margin:0;color:var(--muted)">When both clubs' colours are too close, the away team changes into its away kit.</p>`;
      det.querySelectorAll('.kv').forEach((el, i) => el.replaceWith(kitCanvas([c.home, c.away, c.keeper][i], 56)));
    } else if (tab === 'flow') {
      const fl = id === 'NONE' ? null : FLOWS[id];
      det.innerHTML = head('', '') + `<p style="margin:0;font-size:22px">${esc(fl ? fl.desc : RAW_FLOW_DESC)}</p>
        <p style="margin:0;color:var(--muted)">Fill the Flow bar with completed passes, feints, tackles and shots on target. Press G for 15 seconds of Flow: glowing eyes, a swirling aura and this buff.</p>`;
    } else if (id.startsWith('TONE')) {
      det.innerHTML = head('SKIN COLOUR', 'Pick the skin colour of your player. All of them are free, and you can change any time.');
    } else {
      const sk = SKINS[id], slot = SKIN_SLOTS.find((sl) => sl.id === sk.slot);
      det.innerHTML = head(slot.name + ' SKIN' + (sk.pass ? ' · GAME PASS ONLY' : ''), sk.desc || '') + `<p style="margin:0;color:var(--muted)">Skins only change how you look. They never change your stats.${sk.slot === 'celeb' ? ' You play it when you score.' : ''}</p>`;
    }
    det.querySelector('.cv').replaceWith(this.lockerArt(id, 96));
    // name, rarity and the equip button sit under the 3D preview
    const cap = $('lk-cap');
    cap.innerHTML = `${it.chip || it.base ? `<span class="chip">${it.chip || 'FREE'}</span>` : `<span class="rar" data-r="${it.rarity}">${it.rarity.toUpperCase()}</span>`}<b>${esc(it.name)}</b>`
      + (it.owned ? `<button class="btn small ${it.equipped ? '' : 'blue'}" id="lk-equip" data-sfx="equip" type="button" ${it.equipped ? 'disabled' : ''}>${it.equipped ? 'EQUIPPED' : 'EQUIP'}</button>` : `<span class="label lk-lock">LOCKED · ${it.from}</span>`)
      + (tab === 'style' && (it.spun || !it.owned) ? (d.bp >= it.bp ? `<button class="btn small emerald" id="lk-keep" type="button">KEEP FOR ${it.bp} BLUEPRINTS</button>` : `<span class="label lk-lock">${it.spun ? 'YOURS UNTIL YOUR NEXT SPIN · ' : ''}${it.bp} BLUEPRINTS KEEP IT (YOU HAVE ${d.bp})</span>`) : '');
    const kp = $('lk-keep');
    if (kp) kp.addEventListener('click', () => { if (Goals.unlock(d, id)) { d.style = id; Save.save(); Sfx.coin(); this.renderLocker(); this.renderLobby(); } });
    const eq = $('lk-equip');
    if (eq) eq.addEventListener('click', () => {
      if (tab === 'style') d.style = id; else if (tab === 'club') d.club = id; else if (tab === 'flow') d.flow = id === 'NONE' ? null : id; else if (id.startsWith('TONE')) d.tone = +id.slice(4); else d.look[SKINS[id].slot] = id;
      Save.save(); this.renderLocker();
    });
  },
};
