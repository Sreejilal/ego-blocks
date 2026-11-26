/* =====================================================================
   UI: lobby, HUD, scoreboard, pause, results, spins, locker, how to play
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEYS3 = ['KeyQ', 'KeyE', 'KeyR']; // shown with KeyNames.of: Q E R, or A E R on a French keyboard

const SPOT_EVERY = 3200; // ms between modes in the start screen spotlight
const UI = {
  labels: [], toastsN: 0, bannerT: 0, spinning: false, spinKind: 'style', lockerTab: 'style', lockerSel: null, skinSlot: 'hair',
  init() {
    const app = $('app');
    // player labels sit under the touch buttons and the menus; the scoreboard and flash sit over everything
    app.innerHTML = this.tplLobby() + this.tplSpins() + this.tplLocker() + this.tplHowto() + this.tplProfile() + this.tplPass() + this.tplGoals() + Net.tpl() + this.tplDaily() + this.tplModes() + StoryUI.tpl() + TeamUI.tpl() + TrainUI.tpl() + '<section id="friend-card" class="overlay" hidden><div class="dialog panel fc"><div class="fc-body"></div><button class="btn" id="fc-close" type="button">CLOSE</button></div></section>' + this.tplHud() + '<div id="labels"></div>' + this.tplCutin() + this.tplAwake() + this.tplIntro() + this.tplPause() + this.tplResults() + '<div id="scoreboard" class="panel" hidden></div><div id="outro" hidden><i class="ot-lines"></i><b id="ot-big"></b><span id="ot-sub"></span><span id="ot-star"></span><span class="ot-skip" id="ot-skip">SHOOT TO SKIP</span></div><div id="flash"></div>' + Net.chatPopTpl() + Net.invitePopTpl() + this.tplEmotes() + Admin.tpl();
    $('labels').style.pointerEvents = 'none'; $('scoreboard').style.pointerEvents = 'none'; $('outro').style.pointerEvents = 'none';
    for (let i = 0; i < 14; i++) { const d = document.createElement('div'); d.className = 'flabel'; d.hidden = true; $('labels').appendChild(d); this.labels.push({ el: d, p: null, t: 0, text: '', color: '' }); }
    this.ntags = []; for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'ntag'; d.hidden = true; $('labels').appendChild(d); this.ntags.push(d); } // online: a friend's name above their head
    this.youLabel = document.createElement('div'); this.youLabel.className = 'flabel me'; this.youLabel.textContent = 'YOU'; this.youLabel.hidden = true; $('labels').appendChild(this.youLabel);
    this.bind();
    Hud.toast = (t, c) => this.toast(t, c);
    Hud.bomb = (x, z) => bombBlast(x, z); // BOMB BALL
    Hud.switched = () => { const m = Game.match; if (m && m.human) { this.buildHud(m); Touch.build(m); } }; // STORY: you took control of a teammate
    Hud.label = (p, t, c, dur) => this.flabel(p, t, c, dur);
    Hud.banner = (big, small, color, quick) => this.banner(big, small, color, quick ? 1.1 : 2.0);
    Hud.goal = (team, scorer, assister, own) => { this.goalBanner(team, scorer, assister, own); if (Touch.on && Game.match && Game.match.human && Game.match.human.team === team) Touch.buzz([30, 50, 30]); };
    Hud.flowReady = () => {};
    Hud.steal = (team, rs, p) => this.stealPop(team, rs, p);
    Hud.lockHint = () => this.lockHint();
    Hud.cutin = (p, name) => this.cutin(p, name);
    Hud.awaken = (p) => this.awakenStory(p);
    Hud.lightning = (x, z) => this.lightning(x, z);
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
          <button class="iconbtn cg-acct" id="cg-acct" type="button" hidden>LOG IN</button>
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
          <button class="btn friends" id="go-online" type="button">PLAY ONLINE <span class="sub">RANDOM OR FRIENDS</span></button>
          <button class="btn blue play" id="go-quick" type="button">PLAY <span class="sub" id="quick-sub">QUICK MATCH &middot; 4V4</span></button>
          <div class="duo"><button class="btn" id="go-ranked" type="button">RANKED <span class="sub" id="rank-sub">WOOD</span></button><button class="btn story" id="go-story" type="button">STORY <span class="sub" id="story-sub">CHAPTER 1</span></button></div>
          <button class="btn hazard" id="go-lawless" type="button">LAWLESS <span class="sub">3V3 &middot; BLASTERS</span></button>
          <div class="spot" id="spot"><button class="btn spot-main" id="spot-play" type="button"><span class="spot-in" id="spot-in"></span><span class="spot-go">PLAY</span><span class="spot-dots" id="spot-dots"></span></button><button class="btn spot-all" id="go-modes" type="button">ALL<br>MODES</button></div>
          <div class="meta-row"><button class="btn emerald" id="go-spins" type="button">SPINS <span class="sub">FROM 100</span></button><button class="btn" id="go-locker" type="button">LOCKER <span class="sub" id="locker-sub">ROOKIE</span></button><button class="btn tm" id="go-team" type="button">TEAM <span class="sub" id="team-sub">OVR 70</span></button><button class="btn pass" id="go-pass" type="button">PASS <span class="sub" id="pass-sub">TIER 0 / 30</span></button></div>
          <div class="ghosts"><button class="btn ghost daily" id="go-daily" type="button">DAILY <i class="dot"></i></button><button class="btn ghost goals" id="go-goals" type="button">BLUEPRINTS <b class="bp-n" id="bp-n">0</b></button><button class="btn ghost" id="go-train" type="button">TRAINING</button><button class="btn ghost" id="go-howto" type="button">HOW TO PLAY</button><button class="btn ghost" id="go-profile" type="button"><span>PROFILE<span class="ph-x"> &amp; HISTORY</span></span></button></div>
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
        <button class="gift" id="lob-admin" type="button" hidden>ADMIN PANEL</button>
        <button class="gift" id="lob-gift" type="button" hidden>FREE GIFT: CODE <b>${GIFT_CODE}</b> IN PROFILE</button>
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
            <div class="tabs" role="tablist"><button class="tab" id="ltab-style" role="tab" type="button">STYLES</button><button class="tab" id="ltab-flow" role="tab" type="button">FLOWS</button><button class="tab" id="ltab-skin" role="tab" type="button">SKINS</button><button class="tab" id="ltab-club" role="tab" type="button">CLUB</button><button class="tab" id="ltab-preset" role="tab" type="button">PRESETS</button></div>
            <div class="tabs slots" id="lk-slots" role="tablist" hidden></div>
            <div class="lk-body"><div class="grid-cards" id="locker-grid"></div><div class="panel detail" id="locker-detail"></div></div>
          </div>
        </div>
      </div>
    </section>`;
  },
  tplHowto() {
    const row = (k, t) => `<span>${k}</span><span>${t}</span>`;
    const key = (k) => `<span class="key">${k}</span>`, kk = (c) => `<span class="key" data-kc="${c}">${KeyNames.of(c)}</span>`; // kk: a letter key that moves on a French keyboard
    return `<section id="scr-howto" class="screen sub-screen" hidden>
      <div class="sub-wrap">
        <div class="sub-head"><h2>HOW TO PLAY</h2><button class="btn small" id="howto-back" type="button">BACK</button></div>
        <button class="btn blue tut-btn" id="howto-tut" type="button">PLAY THE TUTORIAL <span class="sub">2 MINUTES, LEARN EVERY CONTROL</span></button>
        <div class="howto">
          <section class="panel touchsec"><h3>TOUCH</h3><div class="ctrl">
            ${row(key('LEFT THUMB'), 'Touch anywhere on the left and drag to move. Push past the outer ring to sprint')}
            ${row(key('RIGHT THUMB'), 'Drag anywhere on the right to turn the camera. The crosshair is where shots go')}
            ${row(key('SHOOT'), 'Hold to charge, let go to shoot. Drag on it while holding to aim')}
            ${row(key('CURVE'), 'While you hold SHOOT, push the move stick left or right to bend the shot. It still ends up where you aim')}
            ${row(key('PASS'), 'Tap to pass to the teammate nearest your aim. Hold for a lob. Without the ball it calls for it: your teammate looks up, then picks the pass')}
            ${row(key('FEINT') + key('TACKLE'), 'One button. With the ball it feints (a step-over nobody can tackle you through, every 5s), without it you slide')}
            ${row(key('FEINT') + key('FEINT'), 'Slow-mo: with the ball, tap FEINT twice fast. Players near you slow right down and nobody can tackle you for 2.5s, or until you pass or shoot. Every 20s')}
            ${row(key('JUMP'), 'Jump. With the ball it flicks it over a defender')}
            ${row(key('ARC'), 'Your three style abilities, then FLOW when the bar is full')}
            ${row(key('DOUBLE TAP'), 'Double tap the right side to face the goal')}
            ${row(key('SCORE'), 'Tap the score for the scoreboard. The top right button pauses')}
            ${row(key('CAMERA'), 'The camera button at the top switches between third person and first person')}
            ${row(key('EMOTE'), 'The smiley button at the top opens the emote wheel')}
            ${row(key('CHAT'), 'Online: the bubble next to pause opens quick chat. Typing needs an account')}
            ${row(key('REPLAY'), 'After a goal, a nutmeg or an ankle breaker, tap REPLAY to watch it again')}
            ${row(key('JOIN'), 'Someone invited you: tap JOIN to go to their room, or NO THANKS')}
          </div></section>
          <section class="panel"><h3>KEYBOARD + MOUSE</h3><div class="ctrl">
            ${row(kk('KeyW') + kk('KeyA') + kk('KeyS') + kk('KeyD'), 'Move')}
            ${row(key('MOUSE'), 'Aim the camera. Click the pitch to lock the mouse')}
            ${row(key('SHIFT'), 'Sprint. It uses stamina. Run it empty and you are out of breath (the bar flashes red): no sprint and a slower jog until it is a third full. Stand still to get it back faster')}
            ${row(key('HOLD LMB'), 'Charge a shot, release to shoot where you aim')}
            ${row(key('LMB') + kk('KeyA') + kk('KeyD'), 'Curve shot: hold A or D while you charge. The ball swings out and bends back in to where you aim, round the keeper')}
            ${row(key('RMB'), 'Pass to the teammate nearest your aim. Hold for a lob. Without the ball it calls for a pass: your teammate looks up, then picks one. Sprint into space for a through ball')}
            ${row(key('SPACE'), 'Jump. With the ball it flicks it over defenders')}
            ${row(key('C'), 'Feint: a step-over cut to the side. Nobody can tackle you through it. Once every 5 seconds')}
            ${row(key('C') + key('C'), 'Slow-mo: with the ball, tap C twice fast. Players near you slow right down and nobody can tackle you for 2.5s, or until you pass or shoot. Once every 20 seconds')}
            ${row(key('F'), 'Slide tackle')}
            ${row(kk('KeyQ') + kk('KeyE') + kk('KeyR'), 'Style abilities. Big moves get a quick cut-in; turn them off in the pause menu')}
            ${row(key('G'), 'Activate Flow when the bar is full')}
            ${row(kk('KeyZ'), 'Awakened, your style\'s signature move (once). Awakening comes by itself at random moments, sooner after big plays')}
            ${row(key('X'), 'Use item (Lawless) or core power (Omega Cores)')}
            ${row(key('TAB'), 'Scoreboard')}
            ${row(key('1') + key('2') + key('3') + key('4'), 'Online: quick chat. PASS!, NICE!, GG, ON ME')}
            ${row(key('T'), 'Online: open chat (or the CHAT button over the map, and CHAT in the pause menu). Typing needs an account, quick chat works for everyone')}
            ${row(key('ESC') + key('P'), 'Pause')}
            ${row(key('ENTER'), 'Watch the replay after a goal, a nutmeg or an ankle breaker. SAVE CLIP downloads it as a video')}
            ${row(key('ARROWS'), 'Turn the camera if the mouse cannot lock')}
            ${row(key('V'), 'Switch player: you take over the teammate with the ball, or the one nearest it (SWITCH on a phone, R3 on a controller). In STORY matches you always play the teammate with the ball')}
            ${row(key('H'), 'Switch camera: third person (behind you) or first person (your eyes). The camera button on a phone')}
            ${row(key('B'), 'Emote wheel: wave, clap, robot, shush, flex, point up, salute, bow, air drums. Pick with 1 to 9. Not while you have the ball')}
            ${row(key('J') + key('N'), 'Someone invited you: J joins their room, N says no thanks')}
            ${row(key('FULLSCREEN') + key('F11'), 'Fill the whole screen: the FULLSCREEN button at the top of the start screen or in the pause menu, or F11. ESC leaves it (P still pauses)')}
            ${row(key('L'), 'Shift lock: your player always faces where you look, so A and D step sideways with the ball in front. The camera sits over your shoulder')}
          </div></section>
          <section class="panel"><h3>CONTROLLER</h3><div class="ctrl">
            ${row(key('A') + key('B'), 'Someone invited you: in the menus or the pause menu, A joins their room and B says no thanks')}
            ${row(key('L STICK'), 'Move')}${row(key('R STICK'), 'Camera')}${row(key('LB'), 'Sprint')}${row(key('RT'), 'Charge and shoot')}${row(key('RT') + key('L STICK'), 'Curve shot: push the left stick left or right while you charge')}
            ${row(key('LT') + key('RB'), 'Pass (hold for a lob)')}${row(key('A'), 'Jump / flick')}${row(key('B'), 'Feint')}${row(key('B') + key('B'), 'Slow-mo: tap B twice fast with the ball')}${row(key('X'), 'Slide tackle')}
            ${row(key('D-PAD') , 'Left, Up, Right = abilities. Down = item')}${row(key('Y'), 'Flow')}${row(key('START'), 'Pause')}${row(key('R3'), 'Switch player')}${row(key('VIEW'), 'Scoreboard')}${row(key('VIEW') + key('D-PAD'), 'Online: hold VIEW and press the D-pad for quick chat')}${row(key('D-PAD DOWN'), 'Emote wheel (not in Lawless), then the D-pad chooses and A plays it')}${row(key('R3'), 'Switch camera. When a replay is offered, R3 watches it')}
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
            <li><b>Random match:</b> PLAY ONLINE, then RANDOM MATCH puts you in a match with other players who are online. It starts by itself after a few seconds; bots fill any empty spots, and new players take a bot's place. Each match is a different mode (Quick, Turbo, Moon Ball and more).</li>
            <li><b>Play with friends:</b> create a room, send the code or invite link, pick teams and a mode. The host picks BOTS: FILL puts bots in the empty spots, KEEPERS ONLY is just you and your friends with computer keepers, NONE is only you and your friends. Keyboard, controller and phone players can all join the same room.</li>
            <li><b>Players online:</b> on PLAY ONLINE you can see who else has the game open. INVITE asks them into your room (it makes one if you have none), ADD FRIEND asks to be friends (you both need an account), JOIN walks into a friend's room. Friends also show on the Profile screen with an INVITE button. Do not want to be seen or invited? Turn SHOW ME HERE off, or set INVITES FROM to FRIENDS or NOBODY.</li>
            <li><b>Game pass:</b> free, 30 tiers a season (8 weeks). Earn pass XP by playing well and from 4 weekly skill challenges. Rewards are emeralds, skins and celebrations, never stats. Standing around earns nothing.</li>
            <li><b>Your position:</b> before each match the camera flies in and you pick where you play: striker, midfield, wing, defence or in goal. The game remembers it for next time.</li>
            <li><b>In goal:</b> JUMP, then A or D while you are in the air dives that way (W dives forward). Hold A or D as you press JUMP for a dive along the ground. C (B on a controller, DIVE on a phone) dives too. At a shot, the dive goes to where the ball is going, as high as it is. Where you stand is up to you, so you can come off your line. With the ball in your hands, PASS throws it and SHOOT kicks it long.</li>
            <li><b>Keeper styles:</b> FORTRESS and LYNX come from style spins (or blueprints) like any style, and their powers work when you play in goal. In goal you can play any other style too and use its moves.</li>
            <li><b>Their box:</b> against bots, once you get into their box their defenders wait outside it for 5 seconds, so you get a fair go at a shot.</li>
            <li><b>Tutorial:</b> new to the game? The button at the top of this page walks you through every control, one at a time.</li>
            <li><b>Free kick battle:</b> still level after golden goal? 3 free kicks each, then sudden death. When they take one, you stand in the wall: jump at the right moment to block it. Winning the battle counts as a win.</li>
            <li><b>Free kicks</b> (on the start screen): 10 free kicks against a keeper and a wall. Turn the camera to aim, hold shoot for power, and try your shooting abilities. It keeps your best score. No rewards, just practice.</li>
            <li><b>More modes</b> (the MORE MODES button): Chaos (every 25 seconds the rules change for everyone for a while: moon ball, turbo, mega goals, tiny goals, giants or rocket shots), Bomb Ball (the ball is a bomb with a 15 second fuse that starts again at every kickoff; when it goes off it knocks everyone near over, and if it was in your half the other team gets a point, so kick it into their half), Tiny Goals (small goals and no keepers), Omega Cores (each team has power cores on its crossbar; score and your player grabs their best core and locks it into the band on their arm; every core has its own power that you get when you take it, used once with the item button: Quake, Pull, Cannon, Freeze and Giant; the team whose cores are worth more at the end wins, takes every core and snaps, and the other team shatters; half way through a Generational core drops and the next goal takes it), Mega Goal (the goal is as wide as the whole pitch), King of the Hill (hold the ball in the moving ring, a point a second, goals are worth 3), Volleys Only (only volleys and headers count: press JUMP with the ball to flick it up, then shoot it before it lands), 1v1 Duels (first to 3), Free Kicks and the Tutorial. One of them is FEATURED, and it changes every 3 hours.</li>
            <li><b>Rewards</b> (emeralds, XP, pass, GOALS) come from full-time matches: Quick Match, Ranked and Lawless. King of the Hill, Volleys and Duels are just for fun, unless you play them with friends: every friends match gives rewards. Leaving early gives nothing.</li>
            <li><b>Team size:</b> Quick Match is 4v4: a keeper, a defender, a midfielder and a striker. Lawless is 3v3. Ranked is 3v3 at Wood and Stone, 4v4 at Iron and Gold, and 5v5 at Diamond and Obsidian.</li>
            <li><b>Lawless</b> drops item blocks on the pitch: blasters (three quick shots) and scatter blasters (a spread up close) that knock players over, rocket fists, boom blocks, slime, jetpacks. Use one with the item button. No rank change.</li>
            <li><b>Training</b> (TRAINING at the bottom of the start screen): the Sprint Drill (run through 8 gates against the clock) and the Defending Drill (stop 5 attacks of two attackers) give up to 3 stars, and each star pays out the first time. Free kicks, keeper practice and the tutorial are there too.</li>
            <li><b>Daily</b>: a gift every day and a 7 day login calendar (a big reward on day 7). Missing a day never resets it.</li>
            <li><b>Story</b> (next to Ranked): take your club from the back pitch to the Voxel Cup, one event at a time. Each event has its own rules and goal, like win by 2 or score 2 yourself, and pays out emeralds, blueprints or a character you can only get there (ROGUE, IRONCLAD, SOLARIS) the first time you meet it. Pick a character for each spot of your team, and in story matches you take control of whoever you pass to. Before and after every event the story plays out in the stadium: the characters walk, kick, shoot and celebrate while they talk (tap to go on, SKIP to skip). WATCH on a finished event shows its scenes again.</li>
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
        <section class="panel pf-reset"><h3>START OVER</h3>
          <p class="pf-note">Delete all your progress and start fresh: emeralds, styles, skins, rank, level and stats all go. Your settings, name, friends and codes stay. This cannot be undone.</p>
          <div class="on-row"><button class="btn small hazard" id="pf-reset" type="button">RESET PROGRESS</button><span class="label" id="pf-reset-msg" aria-live="polite"></span></div></section>
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
        <section class="panel gp-track-box">
          <div class="gp-th"><h3>REWARDS</h3><span class="gp-th-l">All 30 tiers. Scroll sideways.</span><div class="gp-nav"><button class="btn small gp-arr" type="button" id="gp-prev" aria-label="Earlier rewards"><i class="arr l"></i></button><button class="btn small gp-arr" type="button" id="gp-next" aria-label="Later rewards"><i class="arr r"></i></button></div></div>
          <div class="gp-scroll" id="gp-scroll"><div class="gp-track" id="gp-track"></div></div>
        </section>
        <section class="panel gp-week"><div class="gp-th"><h3>THIS WEEK</h3><span class="gp-th-l" id="gp-week-l"></span></div><div class="gp-ch" id="gp-ch"></div></section>
      </div>
    </section>`;
  },
  renderPass() {
    const d = Save.data; Pass.sync(d);
    const S = seasonAt(), P = d.pass, tier = Pass.tier(d), full = tier >= PASS_TIERS, into = full ? PASS_TIER_XP : P.xp % PASS_TIER_XP;
    const days = (ms) => { const h = Math.floor(ms / 3600e3); return h >= 48 ? Math.floor(h / 24) + ' days' : h + 'h ' + Math.floor(ms / 60e3) % 60 + 'm'; };
    const hexOf = (r) => (r.skin ? RARITY_HEX[SKINS[r.skin].rarity] || '#a4a9cf' : '#2ee38f'); // a skin in its rarity colour, emeralds green
    const art = (r, size) => { const cv = r.skin ? skinCanvas(r.skin, size) : iconCanvas('emerald'); cv.className = 'px'; return cv; };
    const next = full ? null : PASS_REWARDS[tier];
    $('gp-top').innerHTML = `<div class="gp-badge"><span class="gp-season">SEASON ${S.season}</span><b>${tier}</b><span class="gp-of">OF ${PASS_TIERS}</span></div>
      <div class="gp-prog"><span class="gp-goal">${full ? 'Pass complete. Every reward is yours.' : (PASS_TIER_XP - into) + ' XP to tier ' + (tier + 1)}</span>
        <div class="gp-bar"><i style="width:${into / PASS_TIER_XP * 100}%"></i><span>${into} / ${PASS_TIER_XP} XP</span></div>
        <p class="gp-note">Free for everyone. Goals, assists, shots on target, tackles, passes and wins earn pass XP. Season ${S.season} ends in ${days(S.seasonLeft)}.</p></div>
      ${next ? `<div class="gp-next" style="--rc:${hexOf(next)}"><span class="gp-next-l">NEXT REWARD</span><span class="gv"></span><b>${esc(Pass.rewardName(next))}</b><span class="gp-next-l">TIER ${tier + 1}</span></div>` : ''}`;
    if (next) $('gp-top').querySelector('.gv').replaceWith(art(next, 64));
    $('gp-track').innerHTML = PASS_REWARDS.map((r, i) => {
      const n = i + 1, got = P.got >= n, now = !got && n === tier + 1, fill = got ? 100 : now ? into / PASS_TIER_XP * 100 : 0;
      return `<div class="gp-t ${got ? 'got' : now ? 'next' : 'locked'}${n % 10 === 0 ? ' big' : ''}" data-i="${i}" style="--rc:${hexOf(r)}">
        <div class="gp-card"><span class="gv"></span><b>${esc(Pass.rewardName(r))}</b>${got ? '<span class="gp-ok">EARNED</span>' : now ? '<span class="gp-here">NEXT</span>' : ''}</div>
        <span class="gp-rail"><i style="width:${fill}%"></i></span><span class="gp-node">${n}</span></div>`;
    }).join('');
    $('gp-track').querySelectorAll('.gp-t').forEach((el) => el.querySelector('.gv').replaceWith(art(PASS_REWARDS[+el.dataset.i], el.classList.contains('big') ? 60 : 44)));
    $('gp-week-l').textContent = 'New challenges in ' + days(S.weekLeft) + '.';
    $('gp-ch').innerHTML = weekChallenges(P.week).map((id) => {
      const C = CHALLENGES[id], n = Math.min(C.goal, P.prog[id] || 0), done = P.done.includes(id);
      return `<div class="gp-c ${done ? 'done' : ''}"><span class="gp-ck"></span><span class="gp-cm"><b>${esc(C.name)}</b><span class="xpbar"><i style="width:${done ? 100 : n / C.goal * 100}%"></i></span></span><span class="gp-xp"><b>+${C.xp} XP</b><span>${done ? 'DONE' : n + ' / ' + C.goal}</span></span></div>`;
    }).join('');
    requestAnimationFrame(() => { // start the track at the tier you are on
      const sc = $('gp-scroll'), at = sc.querySelector('.gp-t.next') || sc.querySelector('.gp-t.got:last-of-type') || sc.querySelector('.gp-t:last-child');
      if (at) sc.scrollLeft = Math.max(0, at.offsetLeft - sc.clientWidth * 0.3);
    });
  },
  tplHud() {
    return `<section id="hud" hidden>
      <div class="hud-mode"><span class="chip" id="hud-mode">RANKED</span><img class="px" id="hud-badge" alt=""></div>
      <div class="scorebar"><div class="team blue"><span class="nm" id="sc0-nm">HOME</span><span id="sc0">0</span></div><div class="clock"><span id="clock">4:00</span><small id="clock-sub"></small></div><div class="team orange"><span id="sc1">0</span><span class="nm" id="sc1-nm">AWAY</span></div></div>
      <div class="vaultbar" id="vaultbar" hidden><div class="vb blue" id="vault0"></div><span class="label">CORES</span><div class="vb orange" id="vault1"></div></div>
      <div class="steal" id="steal" hidden><div class="st-band"><i class="st-lines"></i><div class="st-face" id="steal-face"></div><div class="st-words"><b id="steal-big"></b><span id="steal-small"></span><span class="st-pow" id="steal-pow"></span></div></div></div>
      <div class="hud-em emer"><img class="px" id="hud-em-ico" alt=""><span id="hud-em">0</span></div>
      <div class="slowfx" id="slowfx" hidden><b id="slowfx-txt">SLOW-MO</b></div>
      <div class="crosshair" id="xhair"></div>
      <div class="balltag" id="balltag" hidden>BALL</div>
      <div class="charge" id="charge" hidden><i id="charge-fill"></i><b class="cmark" id="charge-cmark"></b><span id="charge-txt">POWER</span></div>
      <div class="toasts" id="toasts"></div>
      <div class="chatfeed" id="chatfeed" aria-live="polite"></div>
      <button class="btn ghost hud-chat" id="hud-chat" type="button" hidden><span class="key">T</span>CHAT</button>
      <div class="awakeside" id="awakeside" hidden><span class="aw-name" id="aws-name"></span><div class="aw-track"><i id="aws-fill"></i></div><b id="aws-txt">0%</b><span class="key k">Z</span></div>
      <div class="idle-warn" id="idle-warn" hidden role="alert"><b id="idle-big"></b><span id="idle-small"></span></div>
      <div class="banner" id="banner" hidden><div class="big" id="banner-big"></div><div class="small" id="banner-small"></div></div>
      <canvas id="minimap" width="132" height="200"></canvas>
      <div class="tutbox panel" id="tutbox" hidden><span class="label" id="tut-n"></span><b id="tut-title"></b><div class="tut-keys" id="tut-keys" hidden></div><p id="tut-text"></p><button class="btn ghost tiny tut-skip" id="tut-skip" type="button">SKIP <span class="key">ENTER</span></button></div>
      <div class="tipbox panel" id="tipbox" hidden><div class="tut-keys" id="tip-keys" hidden></div><div class="tip-words"><b id="tip-title"></b><p id="tip-text"></p></div></div>
      <div class="tut-gate" id="tut-gate" hidden><b class="tg-title">SCOR<em>Z</em></b><span class="tg-go" id="tg-go">CLICK TO PLAY</span><div class="tut-keys tg-keys" id="tg-keys" hidden></div><span class="label">YOUR FIRST MATCH. SCORE MORE GOALS THAN THEM</span></div>
      <div class="dock">
        <div class="fkpanel panel" id="fkpanel" hidden>
          <div class="fk-row"><span class="label">TYPE</span><b id="fk-type">CURVE</b><span class="label" id="fk-desc"></span><span class="key k" id="fk-typekey">RMB</span></div>
          <div class="fk-row"><span class="label">CURVE</span><div class="fk-curve"><i id="fk-cmark"></i></div><span class="key k" id="fk-curvekey">A D</span></div>
          <div class="fk-row"><span class="label">POWER</span><div class="fk-pow"><em id="fk-zone"></em><i id="fk-pfill"></i></div><span class="key k" id="fk-powkey">LMB</span></div>
        </div>
        <div class="flowbar" id="flowbar"><div class="lbl"><span id="flow-name">FLOW</span><b id="flow-txt">0%</b></div><div class="track"><div class="fill" id="flow-fill"></div><div class="ticks"></div></div></div>
        <div class="flowbar awakebar" id="awakebar"><div class="lbl"><span id="awake-name">AWAKENING</span><b id="awake-txt">0%</b></div><div class="track"><div class="fill" id="awake-fill"></div></div></div>
        <div class="stamina" id="stamina"><img class="px" id="st-ico" alt=""><div class="st-track"><div class="st-fill" id="st-fill"></div><div class="ticks"></div></div><b class="st-lbl">STAMINA</b></div>
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
    if (E.has('KeyB') || (E.has('PadDown') && !this.emoteOpen && !(Game.match && Game.match.cfg && (Game.match.cfg.items || Game.match.cfg.heist)))) { E.delete('KeyB'); E.delete('PadDown'); this.toggleEmotes(); return; }
    if (!this.emoteOpen) return;
    for (let i = 0; i < EMOTES.length; i++) if (E.has('Digit' + (i + 1)) || E.has('Numpad' + (i + 1))) { E.delete('Digit' + (i + 1)); E.delete('Numpad' + (i + 1)); this.pickEmote(i); return; }
    const mv = { PadLeft: -1, PadRight: 1, PadUp: -3, PadDown: 3 };
    for (const k in mv) if (E.has(k)) { E.delete(k); this.markEmote(this.emoteSel + mv[k]); Sfx.hover(); }
    if (E.has('PadA')) { E.delete('PadA'); this.pickEmote(this.emoteSel); return; }
    if (E.has('PadB')) this.toggleEmotes(false);
  },
  /** MORE MODES: every mode that is not on the main menu, just for fun (offline they give no rewards) */
  tplModes() {
    return `<section id="scr-modes" class="overlay" hidden>
      <div class="dialog panel modes-box">
        <div class="md-head"><h2>MORE MODES</h2><p class="md-sub">Just for fun, so no rewards. Quick Match, Ranked and Lawless give rewards.</p></div>
        <div class="md-pick" id="md-pick"><div id="md-hero"></div><div class="md-grid" id="md-grid"></div></div>
        <button class="btn" id="md-close" type="button">CLOSE</button>
      </div>
    </section>`;
  },
  /** the start screen's mode spotlight (owner, Nov 25 2026: "when the featured game is displayed you should be able to choose
      it instantly, and see a switch animation every couple of seconds"): the featured mode first, then the others in turn
      every SPOT_EVERY ms with a flip; PLAY starts the one showing; it holds still while you point at it */
  spotList() { const f = featuredAt().mode; return [f].concat(Object.keys(MODE_ART).filter((k) => MODE_ART[k].group && MODE_ART[k].group !== 'practice' && k !== f && MODES[k])); },
  spotShow(step) {
    const L = this.spotList(); this.spotI = (((this.spotI || 0) + step) % L.length + L.length) % L.length;
    const k = L[this.spotI], A = MODE_ART[k], el = $('spot-in'), b = $('spot-play');
    if (!el || (b.dataset.mode === k && !step)) return;
    el.innerHTML = `<img class="px" alt="" src="${modeIcon(k)}"><span class="spot-t"><span class="spot-tag">${this.spotI === 0 ? 'FEATURED NOW' : A.group === 'new' ? 'NEW MODE' : 'TRY THIS'}</span><b>${MODES[k].name}</b></span>`;
    if (step) this.spotPrev = { k: b.dataset.mode, t: performance.now() }; // a tap right as it flips is for the mode you were looking at
    b.style.setProperty('--mc', A.hex); b.dataset.mode = k; b.setAttribute('aria-label', 'Play ' + MODES[k].name);
    $('spot-dots').innerHTML = L.map((_, i) => `<i${i === this.spotI ? ' class="on"' : ''}></i>`).join('');
    if (step) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); }
  },
  openModes() {
    const F = featuredAt(), feat = MODE_ART[F.mode] && MODES[F.mode] ? F.mode : null, online = new Set(NET_MODES.map((x) => x[0]));
    const h = Math.floor(F.left / 3600e3), mins = Math.floor(F.left / 60e3) % 60;
    const name = (k) => `<span class="md-n"><b>${MODES[k].name}</b>${online.has(k) ? '<i class="md-on">ONLINE TOO</i>' : ''}</span>`;
    const card = (k) => `<button class="md-card" type="button" data-mode="${k}" style="--mc:${MODE_ART[k].hex}"><span class="md-tile"><img class="px" alt="" src="${modeIcon(k)}"></span><span class="md-txt">${name(k)}<span class="md-d">${MODE_ART[k].line}</span></span></button>`;
    $('md-hero').innerHTML = feat ? `<button class="md-hero" type="button" data-mode="${feat}" style="--mc:${MODE_ART[feat].hex}">
        <span class="md-art"><img class="px" alt="" src="${modeIcon(feat)}"></span>
        <span class="md-txt"><span class="md-meta"><span class="md-tag">FEATURED</span><span class="md-left">Changes in ${h ? h + 'h ' : ''}${mins}m</span></span>${name(feat)}<span class="md-d">${MODE_ART[feat].line}</span></span>
        <span class="md-play">PLAY</span></button>` : '';
    $('md-grid').innerHTML = MODE_GROUPS.map(([g, title]) => {
      const ks = Object.keys(MODE_ART).filter((k) => MODE_ART[k].group === g && k !== feat && MODES[k]);
      return ks.length ? `<h3 class="md-h">${title}</h3><div class="md-row">${ks.map(card).join('')}</div>` : '';
    }).join('');
    $('scr-modes').hidden = false;
    $('md-pick').scrollTop = 0;
  },
  tplDaily() {
    return `<section id="scr-daily" class="overlay" hidden>
      <div class="dialog panel daily-box">
        <h2>DAILY</h2>
        <div class="dl-card"><span class="label">TODAY'S GIFT</span><div id="dl-gift"></div></div>
        <div class="dl-card"><span class="label">LOGIN REWARDS · COME BACK EVERY DAY</span><div class="dl-week" id="dl-week"></div><span class="label" id="dl-week-l"></span></div>
        <div class="dl-card"><span class="label">TODAY'S CHALLENGE</span><div id="dl-ch"></div></div>
        <p class="label">A new gift, a new day of the calendar and a new challenge every day. Missing a day costs nothing: the calendar waits for you.</p>
        <button class="btn" id="dl-close" type="button">CLOSE</button>
      </div>
    </section>`;
  },
  renderDaily() {
    const d = Save.data; Daily.sync(d);
    const C = DAILY_CHALLENGES[d.daily.ch];
    $('dl-gift').innerHTML = Daily.giftReady(d) ? '<button class="btn emerald" id="dl-open" type="button">OPEN TODAY\'S GIFT</button>'
      : `<b class="dl-big">${esc(this.giftText || 'OPENED')}</b><span class="label">NEXT GIFT IN ${Daily.untilTomorrow()}</span>`;
    const got = d.daily.login % LOGIN_REWARDS.length, ready = Daily.giftReady(d), cycle = Math.floor(d.daily.login / LOGIN_REWARDS.length); // the login calendar
    const shown = !ready && got === 0 && d.daily.login > 0 ? LOGIN_REWARDS.length : got; // just finished a week: show it full
    $('dl-week').innerHTML = LOGIN_REWARDS.map((r, i) => `<div class="dl-day${i < shown ? ' got' : ''}${i === got && ready ? ' now' : ''}${i === 6 ? ' big' : ''}"><span>DAY ${i + 1}</span>${r.em ? `<img class="px" alt="" src="${iconURL('emerald')}">` : ''}<b>${loginText(r).replace(' EMERALDS', '').replace(' BLUEPRINTS', ' BP').replace(' BLUEPRINT', ' BP')}</b></div>`).join('');
    $('dl-week-l').textContent = ready ? 'OPEN TODAY\'S GIFT TO GET DAY ' + (got + 1) + ': ' + loginText(LOGIN_REWARDS[got]) : 'DAY ' + (shown || LOGIN_REWARDS.length) + ' DONE. COME BACK TOMORROW FOR DAY ' + ((got % LOGIN_REWARDS.length) + 1) + (cycle && got === 0 ? ' OF A NEW WEEK' : '');
    const pct = C ? d.daily.prog / C.goal * 100 : 0;
    $('dl-ch').innerHTML = C ? `<b class="dl-big">${esc(C.name)}</b><div class="xpbar"><i style="width:${pct.toFixed(0)}%"></i></div>`
      + `<span class="label">${d.daily.done ? 'DONE! NEW CHALLENGE IN ' + Daily.untilTomorrow() : d.daily.prog + ' / ' + C.goal + ' · REWARD +' + DAILY_REWARD.emeralds + ' EMERALDS, +' + DAILY_REWARD.xp + ' XP'}</span>` : '';
    const o = $('dl-open');
    if (o) o.addEventListener('click', () => {
      Sfx.init();
      const g = Daily.openGift(Save.data); if (!g) return;
      Save.save();
      this.giftText = (g.emeralds ? (g.jackpot ? 'JACKPOT! ' : '') + '+' + g.emeralds + ' EMERALDS' : '+' + g.xp + ' XP') + (g.login ? ' · DAY ' + g.login.day + ': ' + loginText(g.login.r) : '');
      if (g.jackpot) Sfx.fanfare(2); else Sfx.coin();
      this.renderDaily(); this.renderLobby();
    });
  },
  tplCutin() {
    return `<div id="cutin" hidden aria-hidden="true"><div class="ci-lines"></div><div class="ci-panel"><span class="ci-face" id="ci-face"></span><div class="ci-text"><b id="ci-name"></b><span id="ci-style"></span></div></div></div>`;
  },
  tplAwake() {
    // the screen breaking: 8 shards round the middle, each flying its own way (--dx, --dy, --r)
    const shards = Array.from({ length: 8 }, (_, i) => {
      const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU, am = (a0 + a1) / 2, P = (a, r) => `${(50 + Math.cos(a) * r).toFixed(1)}% ${(50 + Math.sin(a) * r).toFixed(1)}%`;
      const poly = [P(am + 0.3, 4), P(a0, 90), P(am, 70 + (i % 3) * 12), P(a1, 90)].join(',');
      return `<i style="clip-path:polygon(${poly});--dx:${(Math.cos(am) * 60).toFixed(0)}vw;--dy:${(Math.sin(am) * 60).toFixed(0)}vh;--r:${i % 2 ? 24 : -18}deg"></i>`;
    }).join('');
    return `<div id="awk" hidden aria-hidden="true"><div class="awk-lines"></div><canvas id="awk-scene" width="160" height="90"></canvas>
      <div class="awk-mem"><span class="label">A MEMORY</span><b id="awk-mem"></b></div>
      <div class="awk-eye"><canvas id="awk-eye" width="64" height="16"></canvas><i class="awk-iris l"></i><i class="awk-iris r"></i><i class="awk-flare"></i></div>
      <div class="awk-flash"></div><div class="awk-shards">${shards}</div><div class="awk-lines2"></div>
      <div class="awk-big">AWAKENING</div>
      <div class="awk-now"><span class="awk-face" id="awk-face"></span><div class="awk-words"><b id="awk-quote"></b><span id="awk-name"></span></div></div></div>`;
  },
  /** the Awakening (about 2.9s, the match in slow motion). Owner, Nov 2026: "make the animations cooler like [anime]
      awakenings". Like a comic-book anime moment, all our own drawing: the memory as a black and white panel with speed
      lines, then a close-up of their eyes lighting up in their colour with a streak of light, the screen breaking, and
      AWAKENING with what they say now. Each style's story is in AWAKEN_STORY */
  awakenStory(p) {
    const el = $('awk'), st = AWAKEN_STORY[p.styleId] || ['crowd', 'THEY SAID I COULD NOT DO IT', 'WATCH ME NOW!'];
    el.style.setProperty('--ci', p.aura);
    this.drawMemory(st[0], $('awk-scene'));
    this.drawEyes(p, $('awk-eye'));
    $('awk-mem').textContent = st[1]; $('awk-quote').textContent = st[2];
    $('awk-name').textContent = p.style.name + ' · ' + p.style.awaken.name;
    const face = $('awk-face'); face.innerHTML = ''; face.appendChild(portraitCanvas(p.styleId, 140, p.look));
    el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    clearTimeout(this.awkT); this.awkT = setTimeout(() => { el.hidden = true; el.classList.remove('go'); }, 3000);
  },
  /** a pixel close-up of their eyes (64x16, drawn big): skin, a fringe of their hair, fierce brows, and eyes in their colour */
  drawEyes(p, c) {
    const g = c.getContext('2d'), L = p.look || {}, skin = L.skin || SKIN_TONES[1], hair = L.hair || p.style.hair || '#3b2a22';
    const shade = (hex, k) => { const n = parseInt(String(hex).slice(1, 7), 16) || 0; const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
    g.fillStyle = skin; g.fillRect(0, 0, 64, 16);
    g.fillStyle = shade(skin, 0.82); g.fillRect(0, 12, 64, 4); // shadow under the eyes
    g.fillStyle = hair; g.fillRect(0, 0, 64, 3); // the fringe, with a jagged edge
    for (let x = 0; x < 64; x += 4) g.fillRect(x, 3, 3, (x * 7) % 3 + 1);
    for (const s of [1, -1]) { // left eye (s 1) and right eye, mirrored round the middle
      const X = (x) => (s > 0 ? x : 63 - x - 0);
      g.fillStyle = shade(hair, 0.55); // brows sloping down to the middle: fierce
      for (let i = 0; i < 12; i++) g.fillRect(Math.min(X(15 + i), X(15 + i)), 5 + (i > 7 ? 1 : 0), 1, 2);
      g.fillStyle = '#ffffff'; g.fillRect(Math.min(X(16), X(27)), 8, 12, 4);
      g.fillStyle = p.aura; g.fillRect(Math.min(X(19), X(24)), 8, 6, 4); // the iris in their colour
      g.fillStyle = '#0b0b12'; g.fillRect(Math.min(X(21), X(22)), 9, 2, 3);
      g.fillStyle = '#ffffff'; g.fillRect(X(20), 8, 1, 1); // a shine
      g.fillStyle = shade(skin, 0.6); g.fillRect(Math.min(X(16), X(27)), 7, 12, 1); // the upper lid
    }
  },
  /** a little faded picture of the memory: a race, a goal, the rain, a night sky, a crowd or the park */
  drawMemory(kind, c) {
    const g = c.getContext('2d'), W = 160, H = 90, R = mulberry32(kind.length * 7 + 3);
    const D = '#2e2014', M = '#6b4c30', L = '#b8935f', HI = '#ecd9b0';
    const person = (x, y, col, down) => { g.fillStyle = col; if (down) { g.fillRect(x - 4, y - 3, 9, 3); g.fillRect(x + 5, y - 5, 3, 3); return; } g.fillRect(x, y - 13, 3, 3); g.fillRect(x - 1, y - 10, 5, 6); g.fillRect(x - 1, y - 4, 2, 4); g.fillRect(x + 2, y - 4, 2, 4); };
    g.fillStyle = M; g.fillRect(0, 0, W, H);
    if (kind === 'race') {
      g.fillStyle = L; g.fillRect(0, 0, W, 38); g.fillStyle = M; g.fillRect(0, 38, W, 52);
      g.fillStyle = HI; for (let i = 0; i < 4; i++) g.fillRect(0, 46 + i * 11, W, 1);
      for (let y = 38; y < 90; y += 4) for (let x = 0; x < 8; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? D : HI; g.fillRect(120 + x, y, 4, 4); }
      person(132, 64, D); person(112, 75, D, false); g.fillStyle = HI; g.fillRect(126, 40, 16, 2); // one step behind at the line
    } else if (kind === 'goal') {
      g.fillStyle = L; g.fillRect(0, 60, W, 30);
      g.fillStyle = HI; g.fillRect(40, 20, 80, 3); g.fillRect(40, 20, 3, 42); g.fillRect(117, 20, 3, 42);
      g.fillStyle = M; for (let x = 44; x < 116; x += 6) g.fillRect(x, 24, 1, 37); for (let y = 26; y < 60; y += 6) g.fillRect(43, y, 74, 1);
      g.fillStyle = HI; g.fillRect(96, 50, 5, 5); person(70, 82, D, true);
    } else if (kind === 'rain') {
      g.fillStyle = D; g.fillRect(0, 0, W, H); g.fillStyle = M; g.fillRect(0, 66, W, 24);
      g.fillStyle = L; for (let i = 0; i < 70; i++) g.fillRect(Math.floor(R() * W), Math.floor(R() * H), 1, 4);
      person(78, 72, HI);
    } else if (kind === 'night') {
      g.fillStyle = D; g.fillRect(0, 0, W, H); g.fillStyle = HI; for (let i = 0; i < 40; i++) g.fillRect(Math.floor(R() * W), Math.floor(R() * 55), 1, 1);
      g.fillRect(120, 12, 10, 10); g.fillStyle = D; g.fillRect(124, 12, 6, 6); // the moon
      g.fillStyle = M; g.fillRect(0, 70, W, 20); g.fillRect(30, 64, 60, 6); person(58, 64, L);
      g.fillStyle = HI; g.fillRect(20, 20, 6, 1); g.fillRect(14, 19, 6, 1); // a shooting star
    } else if (kind === 'crowd') {
      g.fillStyle = D; g.fillRect(0, 0, W, 40);
      for (let x = 2; x < W; x += 6) for (let r = 0; r < 3; r++) { g.fillStyle = r % 2 ? M : L; g.fillRect(x + (r % 2) * 3, 8 + r * 10, 4, 6); }
      g.fillStyle = L; g.fillRect(0, 40, W, 50); g.fillStyle = HI; g.fillRect(0, 58, W, 1);
      person(80, 80, D, true);
    } else { // the park
      g.fillStyle = L; g.fillRect(0, 0, W, 50); g.fillStyle = M; g.fillRect(0, 50, W, 40);
      g.fillStyle = D; for (const x of [16, 132]) { g.fillRect(x, 22, 4, 28); g.fillRect(x - 8, 10, 20, 14); }
      for (let i = 0; i < 4; i++) person(50 + i * 8, 76, D); person(120, 78, HI); // all of them together, one on their own
    }
    g.fillStyle = 'rgba(0,0,0,0.1)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1); // faint old film lines
  },
  /** a lightning strike: a white flash, a bolt from the clouds to the spot, the thunder a moment later */
  lightning(x, z) {
    const f = $('flash'); if (f) { f.style.background = '#e8f0ff'; f.style.transition = 'none'; f.style.opacity = '0.85'; void f.offsetWidth; f.style.transition = 'opacity .45s ease-out'; f.style.opacity = '0'; }
    FX.beam(V3(x + rand(-4, 4), 60, z + rand(-4, 4)), { pos: V3(x, 0, z) }, '#cfe2ff');
    FX.ring(x, 0.2, z, '#cfe2ff', 3.2, 30); FX.sparks(x, 0.5, z, '#ffffff', 30, 9, 0.2, 0.7);
    Shake.add(0.5); Sfx.thud(1); setTimeout(() => { Sfx.roar(0.25); Sfx.thud(0.8); }, 260);
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
          <span>Graphics</span><div class="seg" id="set-q"><button type="button" data-q="auto">AUTO</button><button type="button" data-q="low">LOW</button><button type="button" data-q="med">MED</button><button type="button" data-q="high">HIGH</button><button type="button" data-q="ultra">ULTRA</button></div>
          <span>Sky</span><div class="seg" id="set-sky"><button type="button" data-v="day">DAY</button><button type="button" data-v="sunset">SUNSET</button><button type="button" data-v="night">NIGHT</button></div>
          <span>Weather</span><div class="seg" id="set-wx"><button type="button" data-v="clear">CLEAR</button><button type="button" data-v="rain">RAIN</button></div>
          <label for="set-sens">Look sensitivity</label><input type="range" id="set-sens" min="0.3" max="2.5" step="0.05">
          <span>Shift lock</span><div class="seg" id="set-sl"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span>Camera</span><div class="seg" id="set-cam"><button type="button" data-v="third">3RD PERSON</button><button type="button" data-v="first">1ST PERSON</button></div>
          <span>Invert camera Y</span><div class="seg" id="set-inv"><button type="button" data-v="0">OFF</button><button type="button" data-v="1">ON</button></div>
          <span class="t-only">Button size</span><div class="seg t-only" id="set-btn"><button type="button" data-v="0.85">S</button><button type="button" data-v="1">M</button><button type="button" data-v="1.15">L</button></div>
          <span>Ball marker</span><div class="seg" id="set-ball"><button type="button" data-v="auto">AUTO</button><button type="button" data-v="on">ON</button><button type="button" data-v="off">OFF</button></div>
          <span>Aim assist</span><div class="seg" id="set-assist"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span>Chat</span><div class="seg" id="set-chat">${CHAT_SHOW.map(([v, n]) => `<button type="button" data-v="${v}">${n}</button>`).join('')}</div>
          <span>Cut-ins</span><div class="seg" id="set-cut"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span>Sound</span><div class="seg" id="set-snd"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span>Music</span><div class="seg" id="set-music"><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
          <span class="fs-only" hidden>Fullscreen</span><div class="seg fs-only" id="set-fs" hidden><button type="button" data-v="1">ON</button><button type="button" data-v="0">OFF</button></div>
        </div>
        <div class="p-people" id="p-people" hidden></div>
        <div class="row"><button class="btn blue" id="p-resume" type="button">RESUME</button><button class="btn" id="p-forfeit" type="button">FORFEIT</button><button class="btn" id="p-subs" type="button" hidden>SUBS</button><button class="btn" id="p-admin" type="button" hidden>ADMIN</button><button class="btn" id="p-chat" type="button" hidden>CHAT</button></div>
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
    const pops = ['friend-card', 'scr-daily', 'scr-modes', 'scr-pause', 'emote-pop'].map((id) => $(id)).filter(Boolean);
    const mo = new MutationObserver((list) => { for (const r of list) { const was = r.oldValue !== null, now = r.target.hidden; if (was !== now) { if (now) Sfx.close(); else Sfx.open(); } } });
    for (const el of pops) mo.observe(el, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
  },
  bind() {
    this.bindSounds();
    const click = (id, fn) => $(id).addEventListener('click', () => { Sfx.init(); Sfx.click(); fn(); });
    click('go-ranked', () => Game.startMatch('ranked'));
    click('go-quick', () => Game.startMatch('quick'));
    click('go-lawless', () => Game.startMatch('lawless'));
    click('go-modes', () => this.openModes());
    click('md-close', () => { $('scr-modes').hidden = true; });
    $('md-pick').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; $('scr-modes').hidden = true; Sfx.init(); Game.startMatch(b.dataset.mode); });
    click('go-spins', () => this.openSpins());
    click('go-locker', () => this.openLocker());
    click('go-howto', () => this.show('howto'));
    click('go-daily', () => { this.renderDaily(); $('scr-daily').hidden = false; });
    click('dl-close', () => { $('scr-daily').hidden = true; });
    click('em-close', () => this.toggleEmotes(false));
    $('emote-pop').addEventListener('click', (e) => { const b = e.target.closest('[data-em]'); if (b) this.pickEmote(+b.dataset.em); });
    click('go-profile', () => this.show('profile'));
    click('go-pass', () => this.show('pass'));
    const gpGo = (dir) => { const sc = $('gp-scroll'); sc.scrollBy({ left: dir * sc.clientWidth * 0.8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
    click('gp-prev', () => gpGo(-1)); click('gp-next', () => gpGo(1));
    $('gp-scroll').addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('gp-scroll').scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); // the mouse wheel moves along the track
    click('go-online', () => Net.open());
    click('pass-back', () => this.show('lobby'));
    click('goals-back', () => this.show('lobby'));
    click('go-goals', () => this.show('goals'));
    click('go-train', () => this.show('train'));
    click('go-tut', () => Game.startMatch('tutorial'));
    click('howto-tut', () => Game.startMatch('tutorial'));
    click('lob-profile', () => this.show('profile'));
    $('lob-profile').addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.show('profile'); } });
    click('profile-back', () => this.show('lobby'));
    click('lob-gift', () => { this.show('profile'); $('pf-code').value = GIFT_CODE; $('pf-code').focus(); });
    $('pf-code-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = redeemCode(Save.data, $('pf-code').value);
      $('pf-code-msg').textContent = r.msg; $('pf-code-msg').dataset.ok = r.ok ? '1' : '';
      if (r.ok) { $('pf-code').value = ''; Save.save(); Sfx.fanfare(2); this.renderProfile(); } else Sfx.deny();
    });
    // RESET PROGRESS: press, then press again within 5 seconds (SURE?)
    $('pf-reset').addEventListener('click', () => {
      const b = $('pf-reset'), msg = $('pf-reset-msg');
      if (!this.resetArmed) { this.resetArmed = true; b.textContent = 'SURE? PRESS AGAIN'; msg.textContent = Save.data.account ? 'YOUR SCORZ ACCOUNT STARTS OVER TOO' : 'EVERYTHING YOU EARNED GOES'; clearTimeout(this.resetT); this.resetT = setTimeout(() => { this.resetArmed = false; b.textContent = 'RESET PROGRESS'; msg.textContent = ''; }, 5000); Sfx.deny(); return; }
      clearTimeout(this.resetT); this.resetArmed = false;
      Save.reset(); Net.hello();
      this.renderProfile(); this.renderLobby(); Showcase.ensure();
      b.textContent = 'RESET PROGRESS'; $('pf-reset-msg').textContent = 'DONE. A FRESH START!'; Sfx.coin();
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
    click('ltab-preset', () => { this.lockerTab = 'preset'; this.lockerSel = 'P' + Math.max(0, Save.data.preset); this.presetWarn = null; this.renderLocker(); });
    click('ltab-skin', () => { this.lockerTab = 'skin'; this.lockerSel = this.skinSlot === 'tone' ? 'TONE' + Save.data.tone : Save.data.look[this.skinSlot]; this.renderLocker(); });
    $('lk-slots').addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (!b) return; Sfx.click(); this.skinSlot = b.dataset.slot; this.lockerSel = this.skinSlot === 'tone' ? 'TONE' + Save.data.tone : Save.data.look[this.skinSlot]; this.renderLocker(); });
    click('btn-mute', () => { // SOUND ON, then MUSIC OFF (sounds but no music), then SOUND OFF
      const s = Save.data.settings;
      if (s.mute) { s.mute = false; s.music = true; } else if (s.music) s.music = false; else s.mute = true;
      Portal.applyMute(); Music.apply(); Save.save(); this.renderLobby();
    });
    click('btn-gfx', () => { const order = ['auto', 'low', 'med', 'high', 'ultra']; const s = Save.data.settings; s.quality = order[(order.indexOf(s.quality) + 1) % order.length]; Game.applyQuality(); Save.save(); this.renderLobby(); });
    click('cg-acct', () => Portal.acctClick());
    click('hud-chat', () => Net.openChat());
    click('p-chat', () => { $('p-resume').click(); setTimeout(() => Net.openChat(), 0); });
    click('in-go', () => Game.endIntro());
    $('in-roles').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { Sfx.click(); Game.pickRole(b.dataset.r); } });
    click('p-resume', () => Game.resume());
    Admin.bind();
    StoryUI.bind();
    TeamUI.bind();
    TrainUI.bind();
    click('tut-skip', () => Game.skipTutorial());
    $('tut-gate').addEventListener('pointerdown', (e) => { e.preventDefault(); Game.gateGo(); });
    $('p-forfeit').addEventListener('click', () => {
      Sfx.click();
      const b = $('p-forfeit');
      if (Game.match && Game.match.cfg.tutorial && Game.state !== 'online') { UI.showPause(false); Game.skipTutorial(); return; } // no need to confirm a skip
      if (b.dataset.armed) { delete b.dataset.armed; Game.forfeit(); }
      else { b.dataset.armed = '1'; b.textContent = Game.state === 'online' ? 'CONFIRM: A BOT TAKES OVER' : Game.match && Game.match.cfg.ranked ? 'CONFIRM: -15 RP' : 'CONFIRM FORFEIT'; }
    });
    click('r-again', () => {
      if (Game.lastMode === 'online') { Game.toLobby(); Net.open(); }
      else if (Game.lastStory) StoryUI.go(Game.storyNext || Game.lastStory); // STORY: the next event (its scene first), or this one again
      else Game.startMatch(Game.lastMode || 'quick');
    });
    click('r-lobby', () => { if (Game.lastMode === 'online') Net.send({ t: 'leave' }); const st = !!Game.lastStory, tr = !!(MODES[Game.lastMode] && MODES[Game.lastMode].drill); Game.toLobby(); if (st) this.show('story'); else if (tr) this.show('train'); });
    click('go-story', () => this.show('story'));
    click('go-team', () => this.show('team'));
    click('p-subs', () => TeamUI.openSubs());
    click('spot-play', () => { const P = this.spotPrev, k = P && performance.now() - P.t < 400 ? P.k : $('spot-play').dataset.mode; if (k && MODES[k]) Game.startMatch(k); });
    const spot = $('spot');
    spot.addEventListener('pointerenter', () => { this.spotHold = true; }); spot.addEventListener('pointerleave', () => { this.spotHold = false; });
    spot.addEventListener('focusin', () => { this.spotHold = true; }); spot.addEventListener('focusout', () => { this.spotHold = false; });
    setInterval(() => { if (this.cur === 'lobby' && !this.spotHold && !document.hidden && $('scr-modes').hidden && !$('scr-lobby').hidden) this.spotShow(1); }, SPOT_EVERY);
    $('set-q').addEventListener('click', (e) => { const q = e.target.dataset.q; if (!q) return; Save.data.settings.quality = q; Game.applyQuality(); Save.save(); this.renderPause(); });
    $('set-sens').addEventListener('input', (e) => { Save.data.settings.sens = parseFloat(e.target.value) || 1; Save.save(); });
    $('set-inv').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.invertY = v === '1'; Save.save(); this.renderPause(); });
    $('set-chat').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Net.setChatShow(v); this.renderPause(); });
    $('set-sky').addEventListener('click', (e) => { const v = e.target.dataset.v; if (!v) return; Save.data.settings.sky = v; World.setLook(v); Save.save(); this.renderPause(); });
    $('set-wx').addEventListener('click', (e) => { const v = e.target.dataset.v; if (!v) return; Save.data.settings.weather = v; World.setWeather(v); Save.save(); this.renderPause(); });
    $('set-cut').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.cutins = v === '1'; Save.save(); this.renderPause(); });
    $('set-music').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.music = v === '1'; Music.apply(); Save.save(); this.renderPause(); });
    $('set-snd').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.mute = v === '0'; Portal.applyMute(); Save.save(); this.renderPause(); });
    $('set-btn').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.btn = parseFloat(v) || 1; Save.save(); Touch.layout(); this.renderPause(); });
    $('set-ball').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v == null) return; Save.data.settings.ballCue = v; Save.save(); this.renderPause(); });
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
    if (name === 'team' && this.cur !== 'team') TeamUI.from = this.cur === 'story' ? 'story' : 'lobby'; // BACK goes where you came from
    const map = { train: 'scr-train', team: 'scr-team', story: 'scr-story', lobby: 'scr-lobby', spins: 'scr-spins', locker: 'scr-locker', howto: 'scr-howto', profile: 'scr-profile', pass: 'scr-pass', goals: 'scr-goals', online: 'scr-online', hud: 'hud' };
    for (const k in map) $(map[k]).hidden = k !== name;
    if (name !== 'hud') { $('scoreboard').hidden = true; this.youLabel.hidden = true; for (const t of this.ntags) t.hidden = true; for (const l of this.labels) { l.p = null; l.el.hidden = true; } }
    if (name === 'locker') Showcase.setStage('lk-fit', 'locker'); else if (name === 'spins') Showcase.setStage('sp-fit', 'reveal'); else Showcase.setStage('lob-stage', 'lobby');
    if (name !== 'spins') Reveal.stop();
    if (name === 'lobby') { this.renderLobby(); Showcase.ensure(); }
    if (name === 'howto') { Save.data.howto = true; Save.save(); }
    if (name === 'profile') this.renderProfile();
    if (name === 'pass') this.renderPass();
    if (name === 'story') StoryUI.render();
    if (name === 'team') TeamUI.render();
    if (name === 'train') TrainUI.render();
    if (name === 'lobby' && !navigator.webdriver && Save.data.onboarded && Daily.giftReady(Save.data) && this.dailySeen !== dayKey()) { // a new day: the DAILY gift and calendar open by themselves, once
      this.dailySeen = dayKey(); setTimeout(() => { if (this.cur === 'lobby' && !Game.match) { this.renderDaily(); $('scr-daily').hidden = false; } }, 700);
    }
    if (name === 'lobby') { this.spotI = 0; this.spotShow(0); } // the spotlight starts on the featured mode
    if (name === 'goals') this.renderGoals();
    Friends.place(); // the FRIENDS panel on the side: start screen, room screen and pause menu only
    Music.set(name !== 'hud'); // music in the menus; a match has the crowd
  },
  /* ---------- lobby ---------- */
  renderLobby() {
    const d = Save.data, tier = tierOf(d.rp);
    const em = iconURL('emerald');
    $('lob-em-ico').src = em; $('lob-em').textContent = d.emeralds;
    $('btn-mute').textContent = d.settings.mute ? 'SOUND OFF' : d.settings.music === false ? 'MUSIC OFF' : 'SOUND ON';
    $('btn-gfx').textContent = 'GRAPHICS: ' + d.settings.quality.toUpperCase();
    const sz = Game.sizeFor('ranked'), qs = Game.sizeFor('quick'); // a new player's first matches are smaller, and the buttons say so
    $('quick-sub').textContent = 'QUICK MATCH · ' + qs + 'V' + qs;
    $('rank-sub').textContent = TIER_NAMES[tier] + ' · ' + sz + 'V' + sz;
    $('locker-sub').textContent = STYLES[d.style].name + (d.flow ? ' · ' + FLOWS[d.flow].name : '');
    $('bp-n').textContent = d.bp; // blueprints: earned on this screen's GOALS, spent in the Locker
    Daily.sync(d); $('go-daily').classList.toggle('ready', Daily.giftReady(d));
    $('go-tut').hidden = d.tutorial || d.stats.played >= 3; // new players: a way into the tutorial
    $('pro-badge').src = badgeURL(tier);
    Pass.sync(d); $('pass-sub').textContent = 'TIER ' + Pass.tier(d) + ' / ' + PASS_TIERS;
    $('story-sub').textContent = StoryUI.sub();
    $('team-sub').textContent = 'OVR ' + teamOvr(d);
    this.spotShow(0);
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
    $('lob-admin').hidden = !Admin.is();
    $('lob-gift').hidden = Save.data.codes.includes(codeHash(GIFT_CODE)); // gone once you used it
    const fsb = $('btn-fs');
    fsb.hidden = !Touch.fsAvailable(); // phones and laptops alike (not on portals: their page has its own button)
    fsb.textContent = Touch.isFs() ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    fsb.classList.toggle('nag', Touch.fsNag()); // a phone with the browser bars showing: the button stands out in gold
  },
  /* ---------- HUD ---------- */
  buildHud(m) {
    const p = m.human;
    $('hud-mode').textContent = m.cfg.name + (m.mode === 'duel' || m.fk || m.tut || m.drill ? '' : ' · ' + m.size + 'V' + m.size) + (m.cfg.ranked ? ' · VS ' + TIER_NAMES[m.tier] : '');
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
      html += `<div class="slot" id="slot${i}"><img class="px" src="${iconURL(a.def.icon, p.aura)}" alt=""><span class="key k">${KeyNames.of(KEYS3[i])}</span><div class="cd"></div><div class="num"></div><span class="nm">${esc(a.def.name)}</span></div>`;
    });
    html += '<div class="sep"></div>';
    html += `<div class="slot small" id="slot-c"><img class="px" src="${iconURL('dash', '#ffffff')}" alt=""><span class="key k">C</span><div class="cd"></div><div class="pips"><i></i></div><span class="nm">FEINT</span></div>`;
    html += `<div class="slot small" id="slot-s"><img class="px" src="${iconURL('hourglass', '#9fb4ff')}" alt=""><span class="key k">CC</span><div class="cd"></div><span class="nm">SLOW-MO</span></div>`;
    html += `<div class="slot small" id="slot-g"><img class="px" src="${iconURL('flame', p.aura)}" alt=""><span class="key k">G</span><div class="cd"></div><span class="nm">FLOW</span></div>`;
    const mv = p.style.awaken && p.style.awaken.move; // owner: "every awakening they get 1 special move, only in their awakening, along with their normal skill set"
    html += `<div class="slot awk" id="slot-z" hidden><img class="px" src="${iconURL('flame', '#ffffff')}" alt=""><span class="key k">Z</span><span class="nm">${esc(mv ? mv.name : 'AWAKENED')}</span></div>`;
    hb.innerHTML = html;
    this.slots = [0, 1, 2].map((i) => ({ el: $('slot' + i), cd: $('slot' + i).querySelector('.cd'), num: $('slot' + i).querySelector('.num'), last: -1 }));
    this.slotC = { el: $('slot-c'), cd: $('slot-c').querySelector('.cd'), pips: $('slot-c').querySelectorAll('.pips i') };
    this.slotS = { el: $('slot-s'), cd: $('slot-s').querySelector('.cd') };
    this.slotG = { el: $('slot-g') }; this.slotZ = $('slot-z');
    $('st-ico').src = iconURL('bolt', '#ffd23d'); this.stLast = -1;
    $('flowbar').style.setProperty('--aura', p.aura);
    $('flow-name').textContent = p.flowId ? 'FLOW · ' + FLOWS[p.flowId].name : 'FLOW';
    if (p.flowId && FLOWS[p.flowId]) $('flowbar').style.setProperty('--aura', FLOWS[p.flowId].color);
    $('awakebar').style.setProperty('--aura', p.aura); $('awakebar').hidden = true;
    $('awakeside').style.setProperty('--aura', p.aura); $('awakeside').hidden = true;
    $('aws-name').textContent = p.style.awaken ? p.style.awaken.name : '';
    $('awake-name').textContent = p.style.awaken ? (Touch.on ? '' : 'AWAKENING · ') + p.style.awaken.name : 'AWAKENING'; // phones: just the name, the bar is narrow
    $('itemslot').hidden = !(m.cfg.items || m.cfg.heist); // OMEGA CORES: the slot holds your core power
    $('vaultbar').hidden = !m.cfg.heist; $('steal').hidden = true; clearTimeout(this.stealTO);
    this.mm = $('minimap').getContext('2d');
    this.hudCache = {};
    $('banner').hidden = true; $('toasts').innerHTML = '';
    this.hintT = Save.data.stats.played < 2 ? 9 : 0;
    Tips.start(m); // new players: the HUD fills in as each part comes up
    if (Touch.on && window.innerHeight > window.innerWidth) this.hintT = Math.max(this.hintT, 6);
    Touch.build(m);
    $('hud-chat').hidden = !(m.online && Portal.chatAllowed()); // online on a computer: shows where the chat is (phones have the bubble button)
    this.lockHint();
  },
  setText(id, v) { const c = this.hudCache; if (c[id] !== v) { c[id] = v; $(id).textContent = v; } },
  updateHud(m, dt) {
    const p = m.human; if (!p) return;
    FKHud.update(m); TutHud.update(m); ShotHud.update(m); Tips.update(m, dt);
    this.setText('sc0', String(m.score[0])); this.setText('sc1', String(m.score[1]));
    if (m.tut) { this.setText('clock', Math.min(m.tut.step + 1, TUT_STEPS.length) + '/' + TUT_STEPS.length); this.setText('clock-sub', 'TUTORIAL'); }
    else if (m.fk && m.fk.battle) { this.setText('clock', m.fk.bs[0] + '-' + m.fk.bs[1]); this.setText('clock-sub', 'FK BATTLE'); }
    else if (m.fk) { this.setText('clock', Math.min(m.fk.n, m.fk.total) + '/' + m.fk.total); this.setText('clock-sub', 'FREE KICK'); }
    else if (m.drill) { const D = m.drill; this.setText('clock', D.kind === 'run' ? D.t.toFixed(1) : D.stops + '/' + DRILL_ATTACKS); this.setText('clock-sub', D.kind === 'run' ? 'GATE ' + Math.min(D.n + 1, D.gates.length) + ' OF ' + D.gates.length : 'STOPPED · ATTACK ' + Math.min(D.n + 1, DRILL_ATTACKS)); } // TRAINING: your time, or the attacks stopped
    else if (m.golden) { this.setText('clock', fmtTime(m.goldenClock)); this.setText('clock-sub', 'GOLDEN GOAL');
      const sec = Math.ceil(m.goldenClock), hot = sec <= 15 && sec > 0; $('clock').classList.toggle('stress', hot); // owner: "gives you that stress"
      if (hot && sec !== this.goldTick) { this.goldTick = sec; Sfx.tick(); } }
    else {
      const tw = m.twist ? m.twist() : null; // CHAOS: the twist on now; BOMB BALL: the fuse
      this.setText('clock', fmtTime(m.clock));
      this.setText('clock-sub', m.heist && m.heist.jack === 1 ? 'JACKPOT OUT' : m.bomb ? 'BOMB ' + Math.max(0, Math.ceil(m.bomb.t)) : tw ? tw.name : '');
      $('clock-sub').classList.toggle('hot', !!(m.bomb && m.bomb.t < 5 && m.phase === 'play'));
    }
    if (m.heist) { // OMEGA CORES: each team's cores in their rarity colours, best first
      const H = m.heist, key = H.v[0].join() + '|' + H.v[1].join();
      if (this.hudCache.vault !== key) { this.hudCache.vault = key; const sq = (a) => a.slice().sort((x, y) => y - x).map((r) => `<i style="background:${RARITY_HEX[RARITIES[r]]}"></i>`).join(''); $('vault0').innerHTML = sq(H.v[0]); $('vault1').innerHTML = sq(H.v[1]); }
    }
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
    // SLOW-MO: its own slot, a blue edge round the screen while yours runs, a grey one while you are caught in someone's
    const S = this.slotS, smOn = p.fx.slowmo > 0, sdOn = p.fx.slowed > 0;
    S.cd.style.setProperty('--p', (smOn ? 0 : clamp((p.slowRe || 0) / SLOWMO_CD, 0, 1) * 360).toFixed(1) + 'deg');
    S.el.classList.toggle('ready', !(p.slowRe > 0) && !smOn); S.el.classList.toggle('active', smOn);
    const sfx = $('slowfx'); sfx.hidden = !(smOn || sdOn); sfx.classList.toggle('caught', !smOn && sdOn); this.setText('slowfx-txt', smOn ? 'SLOW-MO' : 'SLOWED DOWN');
    if (smOn && !this.slowWas) Sfx.slowmo(); else if (sdOn && !this.slowedWas && !smOn) Sfx.slowmo(true);
    this.slowWas = smOn; this.slowedWas = sdOn;
    const has = m.ball.owner === p; $('xhair').classList.toggle('ball', has); $('balltag').hidden = !has; // a frame and BALL while you have the ball
    this.slotG.el.classList.toggle('ready', p.flow >= 100 && p.flowT <= 0);
    if (this.slotZ) { const z = p.awakeT > 0 && !p.awakeMoveUsed && !!(p.style.awaken && p.style.awaken.move); if (this.slotZ.hidden === z) this.slotZ.hidden = !z; } // the special move: only while awakened, until used
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
      this.setText('awake-txt', p.awakeT > 0 ? (Touch.on ? '' : 'AWAKENED ') + Math.ceil(p.awakeT) + 's' : ar ? (Touch.on ? 'READY' : 'READY [' + KeyNames.of('KeyZ') + ']') : Math.floor(p.awake) + '%');
      $('awakebar').classList.toggle('ready', ar); $('awakebar').classList.toggle('active', p.awakeT > 0);
    }
    const stEl = $('stamina'), sv = Math.round(clamp(p.stamina, 0, 100));
    stEl.classList.toggle('tired', !!p.exhausted); // out of breath: the bar flashes red
    stEl.classList.toggle('low', !p.exhausted && sv < 30);
    if (sv !== this.stLast) { this.stLast = sv; $('st-fill').style.width = sv + '%'; }
    const ch = $('charge');
    if (p.charging || p.passHold > 0.24) {
      ch.hidden = false;
      const lob = !p.charging;
      ch.classList.toggle('lob', lob);
      const cv = lob ? 0 : p.shotCurve || 0, curl = Math.abs(cv) >= CURVE_MIN; // A/D (the stick) while charging: a curve shot
      ch.classList.toggle('curl', curl);
      $('charge-fill').style.width = (lob ? 100 : Math.max(28, p.charge * 100)).toFixed(0) + '%';
      $('charge-cmark').style.left = (50 + clamp(cv, -1, 1) * 50).toFixed(1) + '%';
      this.setText('charge-txt', lob ? 'LOB' : curl ? (cv < 0 ? 'CURVE LEFT' : 'CURVE RIGHT') + (p.charge >= 1 ? ' MAX' : '') : p.charge >= 1 ? 'MAX POWER' : 'POWER');
    } else ch.hidden = true;
    $('xhair').style.filter = m.aimOnTarget ? 'drop-shadow(0 0 0 #ffcb3d)' : '';
    $('xhair').classList.toggle('on', m.aimOnTarget);
    if (m.cfg.items) {
      const it = p.item ? ITEMS[p.item] : null;
      const key = it ? p.item : '';
      if (this.hudCache.item !== key) { this.hudCache.item = key; $('item-img').src = it ? iconURL(it.icon) : iconURL('lock'); $('item-nm').textContent = it ? it.name : 'NO ITEM'; $('item-img').style.opacity = it ? 1 : 0.35; }
    } else if (m.cfg.heist) { // your core power, in the core's colour
      const r = p.corePow, cp = r != null ? CORE_POWERS[r] : null, key = cp ? 'core' + r : '';
      if (this.hudCache.item !== key) {
        this.hudCache.item = key;
        $('item-img').src = cp ? iconURL(cp.icon, RARITY_HEX[RARITIES[r]]) : iconURL('lock'); $('item-nm').textContent = cp ? cp.name : 'NO POWER'; $('item-img').style.opacity = cp ? 1 : 0.35;
        $('itemslot').style.setProperty('--rc', cp ? RARITY_HEX[RARITIES[r]] : ''); $('itemslot').classList.toggle('core', !!cp);
      }
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
    else if (this.hintT > 0 && !Tips.active) txt = 'HOLD LMB TO SHOOT · RMB TO PASS · C TO FEINT · F TO SLIDE'; // new players get one tip at a time instead
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
    // online: every other real player wears their name, in their team's colour, so you can tell friends from bots
    let nt = 0;
    if (m.online) for (const p of m.players) {
      if (!p.netId || p === m.human || nt >= this.ntags.length) continue;
      const s = proj(p, 2.2); if (!s.ok) continue;
      const el = this.ntags[nt++];
      if (el.textContent !== p.name) el.textContent = p.name;
      el.dataset.t = p.team; el.hidden = false;
      el.style.left = s.x.toFixed(0) + 'px'; el.style.top = s.y.toFixed(0) + 'px';
    }
    for (; nt < this.ntags.length; nt++) if (!this.ntags[nt].hidden) this.ntags[nt].hidden = true;
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
    this.banner('GOAL!', small, TEAM[team].hex, Game.match && Game.match.heist ? 1.5 : 3.4); // OMEGA CORES: out of the way of the core grab
  },
  /** OMEGA CORES: the cut-in when a core is locked in (rs: rarity indexes, the GENERATIONAL jackpot too; p: who took it).
      A slanted comic band with speed lines in the core's colour, their face and the core's name (our own drawing) */
  stealPop(team, rs, p) {
    const el = $('steal'), m = Game.match, mine = m && m.human && m.human.team === team;
    const best = Math.max(...rs), names = rs.slice().sort((a, b) => b - a).map((r) => RARITIES[r].toUpperCase());
    $('steal-big').textContent = (best === HEIST_JACK ? 'JACKPOT! ' : '') + names.join(' + ') + (rs.length > 1 ? ' CORES' : ' CORE');
    $('steal-small').textContent = (p ? 'LOCKED IN' : 'TAKEN') + ' · +' + rs.reduce((a, r) => a + HEIST_VAL[r], 0) + ' TO ' + (mine ? 'YOUR TEAM' : TEAM[team].name);
    const cp = CORE_POWERS[best], yours = m && m.human && m.human.corePow === best; // the core's power, and whether it is yours now
    $('steal-pow').textContent = 'POWER: ' + cp.name + (yours ? ' · YOURS, ' + (Touch.on && !Input.usingPad ? 'TAP ITEM' : Input.usingPad ? 'D-PAD DOWN' : 'PRESS X') : '');
    const face = $('steal-face'); face.innerHTML = ''; face.hidden = !p;
    if (p) face.appendChild(portraitCanvas(p.styleId, 96, p.look));
    el.style.setProperty('--rc', RARITY_HEX[RARITIES[best]]); el.style.setProperty('--tc', TEAM[team].hex);
    el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(this.stealTO); this.stealTO = setTimeout(() => { el.hidden = true; }, 2600);
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
    $('set-music').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === (s.music !== false)));
    $('set-cut').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === (s.cutins !== false)));
    $('set-sky').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === s.sky));
    $('set-wx').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === (s.weather || 'clear')));
    $('set-chat').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === s.chat));
    $('set-cam').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === s.cam));
    $('set-sl').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!s.shiftLock));
    Net.renderPeople();
    $('set-sens').value = s.sens;
    $('set-btn').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', Math.abs(parseFloat(b.dataset.v) - (s.btn || 1)) < 0.01));
    $('set-ball').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === (s.ballCue || 'auto')));
    $('set-assist').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === (s.assist !== false)));
    const fs = Touch.fsAvailable();
    document.querySelectorAll('#scr-pause .fs-only').forEach((el) => { el.hidden = !fs; });
    $('set-fs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.v === '1') === Touch.isFs()));
    $('p-note').textContent = Touch.on ? 'Tip: double tap the right side of the screen to face the goal you attack.' : 'Click the pitch after resuming to lock the mouse again.';
    $('p-admin').hidden = !(Admin.is() && Admin.inMatch());
    const sm = Game.match; $('p-subs').hidden = !(sm && !sm.online && sm.human && sm.bench && sm.bench.length && !sm.fk && !sm.tut && sm.phase !== 'end'); // MY TEAM: substitutions
    $('p-chat').hidden = !(Game.state === 'online' && Portal.chatAllowed()); // online: the chat, one press away
    const f = $('p-forfeit'); delete f.dataset.armed; f.textContent = Game.state === 'online' ? 'LEAVE MATCH' : Game.match && Game.match.cfg.tutorial ? 'SKIP TUTORIAL' : 'FORFEIT';
    $('p-note').textContent = Game.state === 'online' ? 'Online matches keep going while this menu is open.' : $('p-note').textContent;
    $('scr-pause').querySelector('h2').textContent = Game.state === 'online' ? 'MENU' : 'PAUSED';
  },
  /** the keyboard's own letters are known (KeyNames): relabel the keys already drawn */
  relabelKeys() { document.querySelectorAll('[data-kc]').forEach((el) => { el.textContent = KeyNames.of(el.dataset.kc); }); },
  /** the match intro: who plays who, and your position (Game.beginIntro) */
  tplIntro() {
    return `<section id="intro" class="intro" hidden>
      <div class="in-top"><div class="in-vs"><span id="in-t0">HOME</span><b>VS</b><span id="in-t1">AWAY</span></div><span class="label in-mode" id="in-mode"></span></div>
      <div class="in-pick panel">
        <span class="label">PICK YOUR POSITION</span>
        <div class="in-roles" id="in-roles"></div>
        <button class="btn blue" id="in-go" type="button" data-padfirst>PLAY</button>
        <span class="label in-keys" id="in-keys"></span>
      </div>
    </section>`;
  },
  introRoles: [],
  /** online: only the team names (the server picks the positions) */
  showIntro(m, online = false) {
    const t0 = $('in-t0'), t1 = $('in-t1');
    t0.textContent = TEAM[0].full; t0.style.color = TEAM[0].hex;
    t1.textContent = TEAM[1].full; t1.style.color = TEAM[1].hex;
    $('in-mode').textContent = (online ? 'ONLINE · ' : '') + m.cfg.name + ' · ' + m.size + 'V' + m.size + (m.cfg.tip ? ' · ' + m.cfg.tip : '');
    document.querySelector('#intro .in-pick').hidden = online;
    if (online) { this.introRoles = []; $('intro').hidden = false; return; }
    // every spot on your team, from the back (in goal) to the front
    const back = (r) => (r === 'GK' ? 99 : ROLE_ORDER.indexOf(r));
    this.introRoles = m.teams[m.human.team].map((p) => p.role).sort((a, b) => back(b) - back(a));
    $('in-keys').textContent = Touch.on ? '' : 'KEYS 1-' + this.introRoles.length + ' PICK · ENTER PLAYS';
    $('in-roles').innerHTML = this.introRoles.map((r, i) => `<button class="btn in-role${roleFits(m.human.styleId, r) ? ' fit' : ''}" type="button" data-r="${r}"><span>${ROLE_INFO[r][0]}${roleFits(m.human.styleId, r) ? ' <i class="in-fit">YOUR ROLE</i>' : ''}</span><span class="sub">${Touch.on ? '' : '<b>' + (i + 1) + '</b> '}${ROLE_INFO[r][1]}</span></button>`).join('');
    this.renderIntro(m);
    $('intro').hidden = false;
  },
  renderIntro(m) { document.querySelectorAll('#in-roles .in-role').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === m.human.role))); },
  introCount(left) { const b = $('in-go'), t = 'PLAY ' + Math.max(1, Math.ceil(left)); if (b.textContent !== t) b.textContent = t; },
  hideIntro() { const el = $('intro'); if (el) el.hidden = true; },
  showPause(on) {
    if (on && Net.chatOpen) Net.closeChat(false);
    if (on && this.emoteOpen) this.toggleEmotes(false);
    if (on) { this.renderPause(); $('scoreboard').hidden = true; Touch.board = false; for (const l of this.labels) { l.t = 0; l.el.hidden = true; } this.youLabel.hidden = true; }
    $('scr-pause').hidden = !on;
    if (!on) { $('admin').hidden = true; document.body.classList.remove('adm-open'); }
    Friends.place();
  },
  showResults(r) {
    $('r-again').textContent = 'PLAY AGAIN'; $('r-lobby').textContent = 'LOBBY';
    const titles = { win: ['VICTORY', '#2ee38f'], draw: ['DRAW', '#ffcb3d'], loss: ['DEFEAT', '#ff4d5e'], forfeit: ['FORFEIT', '#ff4d5e'] };
    const [t, c] = titles[r.res];
    $('r-title').textContent = t; $('r-title').style.color = c;
    $('r-score').innerHTML = `<span style="color:${TEAM[0].hex}">${TEAM[0].short} ${r.score[0]}</span><span>:</span><span style="color:${TEAM[1].hex}">${r.score[1]} ${TEAM[1].short}</span><span class="chip">${esc(r.modeName)}</span>`;
    const s = r.human || { goals: 0, assists: 0, shots: 0, tackles: 0 };
    $('r-stats').innerHTML = [['GOALS', s.goals], ['ASSISTS', s.assists], ['SHOTS', s.shots], ['TACKLES', s.tackles]].map(([k, v]) => `<div><span class="label">${k}</span><b>${v}</b></div>`).join('');
    if (r.story) { // STORY: did you meet the goal, and what it gave you
      const S = r.story, e = S.e;
      $('r-again').textContent = S.ok && S.next ? 'NEXT EVENT' : S.ok ? 'PLAY AGAIN' : 'TRY AGAIN'; $('r-lobby').textContent = 'STORY';
      $('r-earn').innerHTML = `<div class="st-res ${S.ok ? 'ok' : 'no'}"><b>${S.ok ? 'EVENT DONE' : 'NOT YET'}: ${esc(e.title)}</b><span>GOAL: ${Story.goalText(e.goal)}</span>`
        + (S.first ? S.got.map((t) => `<span class="st-got">${esc(t)}</span>`).join('') : S.ok ? '<span>YOU HAD THIS EVENT\'S REWARD ALREADY</span>' : '<span>TRY AGAIN. THE REWARD IS STILL WAITING</span>') + '</div>';
    } else
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
    $('scr-results').hidden = false; Music.set(true); // the music comes back on the results
  },
  /** TRAINING: a drill's result (Drill.finish): the time or the attacks stopped, the stars, the rewards for new stars */
  showDrill(o) {
    const r = o.r, D = DRILLS[r.mode];
    $('r-again').textContent = 'TRY AGAIN'; $('r-lobby').textContent = 'TRAINING';
    $('r-title').textContent = D.name; $('r-title').style.color = D.hex;
    $('r-score').innerHTML = `<span>${r.kind === 'run' ? r.score.toFixed(2) + ' SECONDS' : r.score + ' OF ' + DRILL_ATTACKS + ' STOPPED'}</span><span class="chip">${o.better ? 'NEW BEST' : TrainUI.best(r.mode, o.rec)}</span>`;
    $('r-stats').innerHTML = `<div class="dr-res">${TrainUI.stars(r.stars)}<span class="label">${r.kind === 'run' ? 'STARS AT ' + r.par.map((t) => t.toFixed(1) + 'S').join(', ') : 'STARS AT 3, 4 AND 5 STOPPED'}</span></div>`;
    $('r-earn').innerHTML = o.got.length ? o.got.map((t) => `<div><span>${esc(t)}</span><span></span></div>`).join('') : `<div class="idle-note"><span>${o.rec.stars >= 3 ? 'ALL 3 STARS ARE YOURS. GO FOR A NEW BEST' : 'NO NEW STAR THIS TIME. NEXT STAR: ' + loginText(D.reward[o.rec.stars])}</span></div>`;
    $('r-rank').hidden = true; $('r-xp').innerHTML = ''; $('r-pass').innerHTML = ''; $('r-daily').innerHTML = '';
    $('hint').hidden = true;
    $('scr-results').hidden = false; Music.set(true);
    if (o.got.length) Sfx.fanfare(2);
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
    $('scr-results').hidden = false; Music.set(true); // the music comes back on the results
  },
  /** free kick practice: your score, your best, what happened to each kick */
  showPractice(r) {
    $('r-again').textContent = 'AGAIN'; $('r-lobby').textContent = 'LOBBY';
    $('r-title').textContent = r.goals + ' / ' + r.total + (r.keeper ? ' KEPT OUT' : ''); $('r-title').style.color = r.goals >= 7 ? '#2ee38f' : r.goals >= 4 ? '#ffcb3d' : '#ff4d5e';
    $('r-score').innerHTML = r.keeper ? '<span>YOU IN GOAL</span><span class="chip">KEEPER PRACTICE</span>' : `<span>${r.newBest ? 'NEW BEST!' : 'BEST ' + r.best + ' / ' + r.total}</span><span class="chip">FREE KICKS</span>`;
    const n = (w) => r.log.filter((x) => x === w).length;
    $('r-stats').innerHTML = [['GOALS', n('GOAL')], ['SAVED', n('SAVED')], ['BLOCKED', n('BLOCKED')], ['MISSED', n('MISS')]].map(([k, v]) => `<div><span class="label">${k}</span><b>${v}</b></div>`).join('');
    $('r-earn').innerHTML = '<div class="idle-note"><span>PRACTICE GIVES NO REWARDS. JUST GET BETTER</span></div>';
    $('r-rank').hidden = true; $('r-xp').innerHTML = ''; $('r-pass').innerHTML = ''; $('r-daily').innerHTML = '';
    $('hint').hidden = true;
    $('scr-results').hidden = false; Music.set(true); // the music comes back on the results
  },
  hideOverlays() { $('scr-results').hidden = true; $('scr-pause').hidden = true; $('st-pick').hidden = true; $('scr-modes').hidden = true; $('subs').hidden = true; },
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
    else if (kind === 'style') { replaced = d.spunStyle !== id ? d.spunStyle : null; d.spunStyle = id; d.style = id; d.preset = -1; } // yours (and on) until your next style spin (and no longer the preset you wore)
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
    res.querySelector('.cv').replaceWith(kind === 'style' ? portraitCanvas(id, 48, { sig: true }) : kind === 'flow' ? flowEmblemCanvas(id, 48) : skinCanvas(id, 48));
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
    if (tab === 'style') { const st = STYLES[id], spun = d.spunStyle === id; return { gk: !!st.gk, role: ROLES[st.role].name, name: st.name, rarity: st.rarity, owned: d.styles.includes(id) || spun, spun, equipped: d.style === id, from: 'STYLE SPINS OR ' + BP_COST[st.rarity] + ' BLUEPRINTS', bp: BP_COST[st.rarity] }; }
    if (tab === 'club') { const c = CLUBS[id]; return { name: c.name, rarity: 'Rare', chip: c.short, owned: true, equipped: d.club === id }; }
    if (tab === 'preset') {
      if (id === 'PNEW') return { name: '+ NEW PRESET', rarity: 'Rare', chip: d.presets.length + '/' + PRESET_MAX, base: true, owned: true, preset: true, add: true };
      const i = +id.slice(1), p = d.presets[i];
      return { name: p.n, rarity: p.s ? STYLES[p.s.style].rarity : 'Rare', chip: p.pos ? ROLE_INFO[p.pos][0] : 'ANY', base: true, owned: true, equipped: d.preset === i && this.presetOn(i), preset: true, empty: !p.s };
    }
    if (tab === 'flow') { const fl = id === 'NONE' ? null : FLOWS[id]; return { name: fl ? fl.name : 'NO FLOW', rarity: fl ? fl.rarity : 'Rare', base: !fl, owned: !fl || d.flows.includes(id), equipped: (d.flow || 'NONE') === id, from: 'FLOW SPINS' }; }
    if (id.startsWith('TONE')) { const n = +id.slice(4); return { name: 'SKIN ' + (n + 1), rarity: 'Rare', base: true, owned: true, equipped: d.tone === n }; }
    const sk = SKINS[id];
    return { name: sk.name, rarity: sk.rarity, base: !!sk.base, owned: !!sk.base || d.skins.includes(id), equipped: d.look[sk.slot] === id, from: sk.pass ? 'GAME PASS TIER ' + (PASS_REWARDS.findIndex((r) => r.skin === id) + 1) : 'SKIN SPINS' };
  },
  lockerArt(id, size) {
    const tab = this.lockerTab;
    if (tab === 'club') return crestCanvas(id, size);
    if (tab === 'preset') return this.presetArt(id === 'PNEW' ? -1 : +id.slice(1), size);
    const look = Object.assign(lookFor(Save.data.style, Save.data.look), { skin: SKIN_TONES[Save.data.tone] });
    if (id.startsWith && id.startsWith('TONE')) return portraitCanvas(Save.data.style, size, Object.assign(look, { skin: SKIN_TONES[+id.slice(4)] }));
    return tab === 'style' ? portraitCanvas(id, size, { skin: SKIN_TONES[Save.data.tone], sig: true }) : tab === 'flow' ? flowEmblemCanvas(id === 'NONE' ? null : id, size) : skinCanvas(id, size);
  },
  renderLocker() {
    const d = Save.data, tab = this.lockerTab;
    for (const t of ['style', 'flow', 'skin', 'club', 'preset']) $('ltab-' + t).setAttribute('aria-selected', tab === t);
    const slots = $('lk-slots');
    slots.hidden = tab !== 'skin';
    if (tab === 'skin') slots.innerHTML = `<button class="tab" type="button" role="tab" data-slot="tone" aria-selected="${this.skinSlot === 'tone'}">SKIN</button>` + SKIN_SLOTS.map((sl) => `<button class="tab" type="button" role="tab" data-slot="${sl.id}" aria-selected="${this.skinSlot === sl.id}">${sl.name}</button>`).join('');
    const byRar = (M) => (a, b) => RARITIES.indexOf(M[a].rarity) - RARITIES.indexOf(M[b].rarity); // Rare first, Generational last
    const ids = tab === 'preset' ? d.presets.map((p, i) => 'P' + i).concat(d.presets.length < PRESET_MAX ? ['PNEW'] : []) : tab === 'club' ? CLUB_IDS : tab === 'style' ? STYLE_IDS.slice().sort(byRar(STYLES)) : tab === 'flow' ? ['NONE'].concat(FLOW_IDS.slice().sort(byRar(FLOWS)))
      : this.skinSlot === 'tone' ? SKIN_TONES.map((t, i) => 'TONE' + i)
      : Object.keys(SKINS).filter((k) => SKINS[k].base && SKINS[k].slot === this.skinSlot).concat(LOCKER_SKIN_IDS.filter((k) => SKINS[k].slot === this.skinSlot).sort((a, b) => RARITIES.indexOf(SKINS[a].rarity) - RARITIES.indexOf(SKINS[b].rarity)));
    const grid = $('locker-grid');
    grid.innerHTML = ids.map((id) => {
      const it = this.lockerItem(id);
      return `<button type="button" class="lcard ${it.owned ? '' : 'locked'}" data-id="${id}" aria-pressed="${this.lockerSel === id}" style="--rc:${it.base ? '#5a5f78' : RARITY_HEX[it.rarity]}"><span class="art"><span class="cv"></span><span class="nm">${esc(it.name)}</span></span><span class="meta">${it.chip || it.base ? `<span class="chip">${it.chip || 'FREE'}</span>` : `<span class="rar" data-r="${it.rarity}">${it.rarity.toUpperCase()}</span>`}<span class="label">${it.role ? it.role + ' · ' : ''}${it.preset ? (it.add ? 'TAP TO ADD' : it.equipped ? 'WEARING' : it.empty ? 'EMPTY' : 'TAP TO WEAR') : it.equipped ? 'EQUIPPED' : it.spun ? 'FROM SPIN' : it.owned ? 'OWNED' : 'LOCKED'}</span></span></button>`;
    }).join('');
    grid.querySelectorAll('.lcard').forEach((b) => {
      b.querySelector('.cv').replaceWith(this.lockerArt(b.dataset.id, 40));
      b.addEventListener('click', () => { if (tab === 'preset') { this.tapPreset(b.dataset.id); return; } Sfx.click(); this.lockerSel = b.dataset.id; this.renderLocker(); });
    });
    this.renderLockerDetail();
    // the 3D player tries on whatever card is picked, owned or not
    const id = this.lockerSel, spec = { look: {} };
    if (tab === 'preset') { const p = d.presets[+id.slice(1)]; if (p && p.s) Object.assign(spec, { style: p.s.style, flow: p.s.flow || null, tone: p.s.tone, look: Object.assign({}, p.s.look), pos: p.pos }); }
    else if (tab === 'style') spec.style = id;
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
      det.innerHTML = head(st.gk ? 'KEEPER STYLE · ITS POWERS WORK IN GOAL' : 'ROLE: ' + ROLES[st.role].name + ' · ' + ROLE_WHERE[st.role], st.blurb) + `<div class="ab-list">${st.abilities.map((a, i) => { const A = ABILITIES[a]; return `<div class="ab"><img class="px" src="${iconURL(A.icon, st.aura)}" alt=""><div><div class="t"><span class="key">${KeyNames.of(KEYS3[i])}</span><b>${esc(A.name)}</b><span class="label">${A.cd}S COOLDOWN</span></div><p>${esc(A.desc)}</p></div></div>`; }).join('')}`
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
    } else if (tab === 'preset') {
      const i = +id.slice(1), p = d.presets[i], on = d.preset === i && this.presetOn(i);
      const sum = p.s ? '<div class="pre-sum">' + [['STYLE', STYLES[p.s.style].name], ['FLOW', p.s.flow ? FLOWS[p.s.flow].name : 'NONE']].concat(SKIN_SLOTS.filter((sl) => ['kit', 'hair', 'boots', 'gloves', 'acc', 'ball'].includes(sl.id)).map((sl) => [sl.name, SKINS[p.s.look[sl.id]].name])).map(([k, v]) => `<span class="label">${k}</span><b>${esc(v)}</b>`).join('') + '</div>' : '';
      const pos = ['ST', 'LW', 'MID', 'DEF', 'GK', null].map((r) => `<button class="tab" type="button" data-ppos="${r || ''}" aria-selected="${(p.pos || null) === r}">${r ? ROLE_INFO[r][0] : 'ANY'}</button>`).join('');
      det.innerHTML = head(on ? 'YOU ARE WEARING THIS' : p.s ? 'PRESET ' + (i + 1) : 'EMPTY PRESET', on ? 'Anything you EQUIP in the other tabs now goes into this preset by itself.' : p.s ? 'Tap its card to wear all of it at once.' : 'Tap its card to start it from what you are wearing.')
        + (this.presetWarn && this.presetWarn.length ? `<p class="pre-warn">NOT YOURS ANY MORE, SO IT STAYED AS IT WAS: ${esc(this.presetWarn.join(', '))}</p>` : '')
        + `<label class="label" for="pre-name">NAME: TYPE ANYTHING</label><input class="on-in pre-name" id="pre-name" type="text" maxlength="${PRESET_NAME_MAX}" autocomplete="off" spellcheck="false" value="${esc(p.n)}">`
        + sum + `<div class="label">START MATCHES IN THIS POSITION</div><div class="tabs slots" id="pre-pos" role="tablist">${pos}</div>`
        + `<div class="pre-act">${on ? '<button class="btn small blue" id="pre-edit" type="button">CHANGE THE LOOK</button>' : ''}${d.presets.length > 1 ? '<button class="btn small" id="pre-del" type="button">DELETE</button>' : ''}</div>`
        + '<p style="margin:0;color:var(--muted)">Skins never change your stats. Online, the room picks the positions.</p>';
      det.querySelectorAll('[data-ppos]').forEach((b) => b.addEventListener('click', () => { this.setPresetPos(i, b.dataset.ppos || null); this.renderLocker(); }));
      const nm = $('pre-name');
      nm.addEventListener('input', () => { // the card, the title and the caption follow as you type
        this.renamePreset(i, nm.value, false);
        for (const el of [document.querySelector(`#locker-grid .lcard[data-id="P${i}"] .nm`), det.querySelector('h3'), document.querySelector('#lk-cap b')]) if (el) el.textContent = p.n;
      });
      nm.addEventListener('change', () => { this.renamePreset(i, nm.value, true); nm.value = p.n; this.renderLocker(); });
      nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') nm.blur(); });
      const ed = $('pre-edit');
      if (ed) ed.addEventListener('click', () => { this.lockerTab = 'skin'; this.lockerSel = this.skinSlot === 'tone' ? 'TONE' + d.tone : d.look[this.skinSlot]; this.renderLocker(); });
      const del = $('pre-del');
      if (del) del.addEventListener('click', () => { if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'SURE? DELETE IT'; return; } this.deletePreset(i); this.renderLocker(); });
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
      + (it.preset ? (it.equipped ? '<span class="label lk-lock">WEARING</span>' : `<button class="btn small blue" id="lk-equip" data-sfx="equip" type="button">${it.empty ? 'START IT FROM MY LOOK' : 'WEAR IT'}</button>`)
      : it.owned ? `<button class="btn small ${it.equipped ? '' : 'blue'}" id="lk-equip" data-sfx="equip" type="button" ${it.equipped ? 'disabled' : ''}>${it.equipped ? 'EQUIPPED' : 'EQUIP'}</button>` : `<span class="label lk-lock">LOCKED · ${it.from}</span>`)
      + (tab === 'style' && (it.spun || !it.owned) ? (d.bp >= it.bp ? `<button class="btn small emerald" id="lk-keep" type="button">KEEP FOR ${it.bp} BLUEPRINTS</button>` : `<span class="label lk-lock">${it.spun ? 'YOURS UNTIL YOUR NEXT SPIN · ' : ''}${it.bp} BLUEPRINTS KEEP IT (YOU HAVE ${d.bp})</span>`) : '');
    const kp = $('lk-keep');
    if (kp) kp.addEventListener('click', () => { if (Goals.unlock(d, id)) { d.style = id; this.syncPreset(); Save.save(); Sfx.coin(); this.renderLocker(); this.renderLobby(); } });
    const eq = $('lk-equip');
    if (eq) eq.addEventListener('click', () => {
      if (tab === 'preset') { this.tapPreset(id); return; }
      if (tab === 'style') d.style = id; else if (tab === 'club') d.club = id; else if (tab === 'flow') d.flow = id === 'NONE' ? null : id; else if (id.startsWith('TONE')) d.tone = +id.slice(4); else d.look[SKINS[id].slot] = id;
      this.syncPreset(); Save.save(); this.renderLocker();
    });
  },
  /* ---------- presets (owner, Nov 2026: "1 preset its like striker then goalie", then up to 20, any name, and
     "the look didn't change": tap a card to wear it, and what you EQUIP while wearing one goes into it) ---------- */
  /** true when your style, Flow, skin colour and skins are exactly this preset's */
  presetOn(i) {
    const d = Save.data, p = d.presets[i];
    if (!p || !p.s) return false;
    return p.s.style === d.style && (p.s.flow || null) === (d.flow || null) && p.s.tone === d.tone && SKIN_SLOTS.every((sl) => p.s.look[sl.id] === d.look[sl.id]);
  },
  /** put a preset on: style, Flow, skin colour, every skin and the position. Returns the names of what you no longer own (left as it was) */
  usePreset(i) {
    const d = Save.data, p = d.presets[i], missing = [];
    if (!p || !p.s) return missing;
    const s = p.s;
    if (d.styles.includes(s.style) || d.spunStyle === s.style) d.style = s.style; else missing.push(STYLES[s.style].name);
    if (!s.flow || d.flows.includes(s.flow)) d.flow = s.flow || null; else missing.push(FLOWS[s.flow].name);
    d.tone = s.tone;
    for (const sl of SKIN_SLOTS) { const id = s.look[sl.id], sk = SKINS[id]; if (sk && sk.slot === sl.id && (sk.base || d.skins.includes(id))) d.look[sl.id] = id; else if (id !== d.look[sl.id]) missing.push(sk ? sk.name : sl.name); }
    d.pos = p.pos || null; d.posFor = d.style; d.preset = i;
    Save.save();
    return missing;
  },
  /** start a preset from what you wear now (you wear it from now on, its position too) */
  savePreset(i) {
    const d = Save.data;
    d.presets[i].s = { style: d.style, flow: d.flow || null, tone: d.tone, look: Object.assign({}, d.look) };
    d.pos = d.presets[i].pos || null; d.posFor = d.style; d.preset = i;
    Save.save();
  },
  /** tap a card: wear it (an empty one starts from what you wear); the + card adds one. The 3D player spins round to show the change */
  tapPreset(id) {
    const d = Save.data;
    if (id === 'PNEW') {
      if (d.presets.length >= PRESET_MAX) return;
      d.presets.push({ n: 'PRESET ' + (d.presets.length + 1), pos: null, s: null });
      id = 'P' + (d.presets.length - 1);
    }
    const i = +id.slice(1), p = d.presets[i];
    if (!p) return;
    this.presetWarn = p.s ? this.usePreset(i) : (this.savePreset(i), null);
    Sfx.equip();
    this.lockerSel = id;
    this.renderLocker();
    Showcase.turn -= Math.PI * 2;
  },
  /** while you wear a preset, what you EQUIP goes into it */
  syncPreset() {
    const d = Save.data, p = d.presets[d.preset];
    if (p && p.s) p.s = { style: d.style, flow: d.flow || null, tone: d.tone, look: Object.assign({}, d.look) };
  },
  /** a name you type (anything, up to PRESET_NAME_MAX letters). While typing it can be empty; when you finish it cannot */
  renamePreset(i, text, done) {
    const p = Save.data.presets[i];
    let n = String(text == null ? '' : text).replace(/[\u0000-\u001f<>]/g, '').slice(0, PRESET_NAME_MAX);
    if (done) n = n.trim() || 'PRESET ' + (i + 1);
    p.n = n;
    Save.save();
  },
  deletePreset(i) {
    const d = Save.data;
    if (d.presets.length <= 1) return;
    d.presets.splice(i, 1);
    if (d.preset === i) d.preset = -1; else if (d.preset > i) d.preset--;
    this.lockerSel = 'P' + Math.min(i, d.presets.length - 1);
    Save.save();
  },
  setPresetPos(i, pos) {
    const d = Save.data;
    d.presets[i].pos = pos;
    if (d.preset === i) { d.pos = pos; d.posFor = d.style; } // wearing it: your next match starts there too
    Save.save();
  },
  /** a preset's card picture: its own player, or a plus when it is empty (or the + card) */
  presetArt(i, size) {
    const p = Save.data.presets[i];
    if (p && p.s) return portraitCanvas(p.s.style, size, Object.assign(lookFor(p.s.style, p.s.look), { skin: SKIN_TONES[p.s.tone] || SKIN_TONES[1] }));
    const c = document.createElement('canvas'); c.width = c.height = 16; c.className = 'px';
    const g = c.getContext('2d'); g.fillStyle = '#2a2f45'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#8a90b0'; g.fillRect(7, 3, 2, 10); g.fillRect(3, 7, 10, 2);
    return c;
  },
};
