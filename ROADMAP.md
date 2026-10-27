# Roadmap: your feature list as Claude Code prompts

Paste **one** prompt into Claude Code, play-test the result, run `npm test`, commit, then move on.
This is your list, put in an order where nothing has to be built twice: everything that works
offline comes first, and online play comes later because it changes how the whole game runs.

Notes in *italics* are where I pushed back on the original idea.

---

## Part 1: offline (works in the single page you have now)

### 1. Rename to SCORZ
A small first job to get used to Claude Code.

> Rename the game from EGO BLOCKS to SCORZ everywhere a player can see it: the page title, the lobby logo, the meta description, banners and the How to Play screen. Existing players must keep their progress, so move the old save (localStorage key 'egoblocks.save.v1') to a new key instead of losing it. Build and run npm test.

### 2. A real 3D start screen
*The game is already fully 3D. The start screen is what looks flat, because on a phone the menu covers the 3D scene.*

> Replace the flat lobby with a 3D start screen like a console shooter's main menu: my player stands on a lit spot in the stadium in my equipped style, with an idle animation, and turns a little toward the mouse or a finger drag. The camera frames the player on one side and the menu on the other, with a dark gradient only behind the buttons so the 3D scene stays visible. On a phone held upright the player stands above the buttons. Reuse the Player model from 05_player.js. Keep every current button and the profile card. Check 1280x720, 844x390 and 390x844 and look at the screenshots.

### 3. Skins with a live 3D preview
> Add cosmetic skins that only change looks: hair styles and colours, boots, gloves, one accessory (headband, mask or chain) and a goal celebration. Skins come from spins and later the game pass, and never change stats. In the Locker, show my player in 3D and update the preview the moment I click a style or skin, so I see how I'll look before I equip it. Dragging rotates the preview. Save equipped skins in Save with defaults and sanitizing.

### 4. Proper team kits
> Give each team a real football kit instead of plain colours: a shirt pattern (stripes, hoops, sash or halves), different sleeve colour, collar, number on the back, a small crest on the chest, matching shorts and socks, and a separate keeper kit. Make 6 original clubs with names, crests, and home and away kits, and switch to the away kit automatically when the two teams' colours clash. Draw it all on the existing canvas skin texture, no image files.

### 5. Bigger pitch
> Before changing anything, ask me whether I want to keep 5v5 or switch to 4v4. Then make the pitch about 20 percent longer and wider (not more), and update the goals, boards, stands, camera limits, minimap and AI formation positions to match. Run EGO.simulate a few times and check that a 4 minute match still has about 3 to 10 goals.

### 6. Teammates who think before passing
> When I call for the ball (PASS without the ball), my teammate should not pass instantly. They look up for a moment (0.3 to 0.9 seconds, longer under pressure), show a small thinking icon, then pick the pass that fits the space: a ground pass, a lofted ball over a defender, a through ball into my run, or now and then a flashy one (outside of the boot, backheel, rabona, no-look) with its own animation. If I'm tightly marked they hold the ball, dribble, or show "WAIT" instead of forcing it. Check with EGO.simulate that this doesn't make the team lose the ball more often.

### 7. A cooler spin
> Make spins feel like an event: a 3D block drops onto the pitch, shakes and glows in the rarity colour (sometimes faking a better colour first), then cracks open to show my player posing in the new style, with the name, the rarity and a fanfare. Rarer pulls get a longer, flashier reveal. Keep the current odds and the 30-spin pity exactly the same, and add a Skip button.

### 8. Better graphics option
*Not shooter-style realism, just a sharper, glowier version of the current look.*

> Add an ULTRA graphics setting for strong PCs and phones: higher resolution, softer shadows with a bigger shadow map, bloom glow on auras, lights and beams, grass with more variation, and more fans in the stands. AUTO must still drop down when FPS falls under 45, and LOW must stay smooth on weak phones.

### 9. Ranked that gets harder as you climb
> Make each rank tier (Wood, Stone, Iron, Gold, Diamond, Obsidian) a clear step up: bots get faster reactions, better passing, smarter tackles and better keepers, and higher tiers play in a bigger, louder stadium with more fans. Show the opponent's tier before kickoff. Use EGO.simulate to check that a Wood-level bot team loses badly to an Obsidian-level one.

### 10. More skills and anime moments
*Copy the feeling, not the names: anything named after a real anime's characters or moves can get the game taken down.*

> Add 3 new styles with 3 abilities each: a predator striker who reads loose balls, a trick dribbler and a long-range bomber, all with original names. Give every big ability a short cinematic: slow motion, a quick camera zoom, a comic-style cut-in with my player's portrait and the move name, speed lines, then straight back to play. Keep each cut-in under 1 second, and add a setting to turn them off.

### 11. Replays
> Record the last 10 seconds of play (player and ball positions every frame). After a goal, a nutmeg or an ankle breaker, offer an instant replay with a cinematic camera that I can skip. Add a "Save clip" button that records the replay as a video file I can download.

### 12. Rotating game modes
> Add a Featured mode slot that changes every 3 hours on a fixed schedule from the clock, so everyone sees the same mode at the same time. Modes: King of the Hill (hold the ball inside a moving circle to earn points), Volleys Only (only headers and volleys count), 1v1 Duels (first to 3) and Lawless. Show a countdown to the next mode in the lobby.

### 13. Match history and a profile card
> Save my last 20 matches (date, mode, score, result, my goals and assists, style, rank change) and show them on a Match History screen. Add a profile card with my level (XP from matches), equipped style, Flow, skins, rank badge and best stats. Keep it all in Save so it survives reloads.

### 14. A free game pass
*Free and earned by playing. A paid pass would need a real payment system, and anything that sells stats makes the game pay-to-win.*

> Add a free game pass with 30 tiers. XP comes from playing and from weekly skill challenges that take real skill (score with a curler, win the ball back with a tackle, keep a clean sheet, win a Diamond match). Rewards are emeralds, skins and celebrations, never stats. A normal player should finish it in a season, but standing around should earn nothing.

### 15. Bug sweep
> Play-test the whole game: every menu and mode, keyboard, controller and touch, phone sideways and upright. List every bug you find, fix them one at a time, and run npm test after each fix. Bugs I've noticed: [write yours here].

---

## Part 2: online (needs a game server you run)

*This is the biggest step by far. Phones, keyboards and controllers can only play together fairly if one server runs the match. The page can't do that alone, and hosting a server usually costs a little money each month.*

### 16. Online matches with friends
> Add online multiplayer. Write a small Node.js game server in a new server/ folder using WebSockets. The server runs the match using the same game logic as src/ and sends snapshots about 20 times a second, and players send their inputs. A player creates a room and shares a code or invite link, bots fill empty spots, and the same group can rematch after a match. Keyboard, controller and touch players can all join one room. The offline game must keep working with no server. Explain how to run the server on my computer first, then how to host it.

### 17. Accounts
> Add optional accounts. Guests can still play instantly. Signing in saves progress on the server and lets friends find each other and see each other's profile cards: level, style, skins, rank and recent matches.

### 18. Chat
*Voice chat with strangers is the hardest thing in this list to make safe. Games like this attract young players, which is why big platforms age-check voice. Keep voice friends-only, and add it last.*

> Add chat to online rooms: quick-chat phrases for everyone (Pass!, Nice!, GG, On me), typed chat only for signed-in players, with a swear filter plus mute and report buttons.

### 19. Idle players
*Better than streaks or rank decay, which pressure people to log in. This only stops someone from wasting a match for others.*

> In online matches, if a player does nothing for 30 seconds, warn them, then hand their player to a bot. They earn no rewards or rank points for that match.

---

## Part 3: CrazyGames

### 20. Get it ready for CrazyGames
> Prepare the game for CrazyGames. Follow https://docs.crazygames.com/requirements/intro/ and add their HTML5 SDK: gameplay start and stop events at the right moments, and their user module for names. Check their technical, gameplay and mobile requirements one by one, then tell me exactly what to upload and what to fill in on the submission form.
