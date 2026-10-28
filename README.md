# SCORZ

Voxel football that runs in a web browser, 3v3 up to 5v5: ranked play, 10 styles with abilities,
Flow, skins, clubs and kits, a game pass, replays, featured modes, online rooms with friends, and
keyboard, controller and phone touch controls.

**To play right now:** open `docs/index.html` in Chrome or Edge. That one file is the whole game,
and it works offline.

---

## 1. Set up your computer (one time)

You need four free programs. Install them in this order (Windows links; each site also has a Mac version):

1. **VS Code**, the code editor: https://code.visualstudio.com
2. **Node.js**, the LTS version: https://nodejs.org. It rebuilds the game after every change.
3. **Git**: https://git-scm.com/downloads/win. It saves versions of your work so you can undo mistakes. Claude Code also uses it.
4. **Claude Code for VS Code**: open VS Code, press `Ctrl+Shift+X`, search **Claude Code**, and install the one made by Anthropic. You sign in with your Claude account (a paid plan: Pro, Max, Team or Enterprise).

## 2. Open the project

1. Unzip this folder somewhere easy to find, for example `Documents\ego-blocks`.
2. In VS Code: **File > Open Folder** and pick the `ego-blocks` folder.
3. Open the terminal at the bottom: **Terminal > New Terminal**. Then type these one at a time and press Enter after each:

   ```
   npm install
   npm run build
   npx playwright install chromium
   npm test
   ```

   - `npm install` downloads the 3D engine, fonts and test tools (only once).
   - `npm run build` makes `docs/index.html` from the files in `src/`.
   - `npx playwright install chromium` downloads a test browser (only once, about 150 MB).
   - `npm test` plays the game automatically for a minute and prints `PASS` or `FAIL` lines.

4. Double-click `docs/index.html` in File Explorer to play your copy.

## 3. Make changes with Claude Code

1. Click the **Spark icon** (top right of an open file, or in the left sidebar) to open Claude.
2. The first time, sign in with your Claude account.
3. Claude reads `CLAUDE.md` by itself. That file explains how this game is built, so you don't have to.
4. Open `ROADMAP.md`. It has your whole feature list as ready-made prompts, in a good order. Paste **one** prompt at a time.

**The loop for every change:**

1. Paste one prompt. Add "plan it first and wait for my OK" if it's a big one.
2. Read what Claude says it will do. Say yes, or tell it what to change.
3. When it's done, play the game (`docs/index.html`). Claude normally rebuilds it, but if you're unsure run `npm run build` yourself.
4. Run `npm test`.
5. If it works, save a version: tell Claude **"commit my changes"**. If it broke something, tell Claude what went wrong, or ask it to go back to the last commit.

Small, specific prompts work best. "The pass button feels slow on phone, make passes leave the foot faster" beats "make it better".

## 4. Put it online so anyone can play

### Option A: itch.io (easiest, free, made for games)

1. Make an account at https://itch.io and choose **Upload new project**.
2. Set **Kind of project** to **HTML**.
3. Upload `docs/index.html` and mark it as the file played in the browser. One file is fine, no zip needed.
4. In the embed options, pick **Click to launch in fullscreen** (or set the size to 1280 x 720), tick **Mobile friendly**, and turn on the **Fullscreen button**.
5. Set **Visibility** to **Public** and save. You get a link to share.

To update it later: run `npm run build` and upload the new `docs/index.html`.

### Option B: GitHub Pages (free, your own link, updates when you push)

1. Make an account at https://github.com.
2. In VS Code open the **Source Control** panel (`Ctrl+Shift+G`) and click **Publish to GitHub**. Choose a **public** repository.
3. On github.com open your repository, then **Settings > Pages**. Under **Build and deployment** pick **Deploy from a branch**, branch **main**, folder **/docs**, and click **Save**.
4. After a minute or two the Pages screen shows your game's link (usually `https://YOUR-NAME.github.io/ego-blocks/`).
5. From then on: build, commit, and push (Claude can do all three: "build, commit and push"). The site updates by itself.

### Option C: CrazyGames (their own build of the game)

CrazyGames gets a special copy of the game that talks to their website through their SDK. The
GitHub and itch.io copies stay exactly as they are.

**What the CrazyGames copy does differently**

- Loads their SDK and tells them when a match starts and stops (pause, results and replays count as stops).
- Saves progress in their Data module, so signed-in CrazyGames players keep it on every device. A save
  already on that device is copied in once.
- Uses the CrazyGames account: our own name-and-password accounts and friends are hidden there (their
  rules allow no other logins). Signed-in players play under their CrazyGames name. Typed chat is off
  there because it needs our accounts; quick chat still works.
- Follows their mute and chat-off settings. Their mute wins over the game's sound button.
- Asks for a video ad at the final whistle. Their SDK decides if one plays (at most one every 3 minutes,
  and none at all in Basic Launch). The game is paused and silent while it plays.
- Celebrates wins with their `happytime` effect.
- Online rooms: shares the room with their page so their invite and JOIN buttons work, uses their invite
  link, opens straight into a room when a friend's invite is used, and starts a new room right away when
  they launch the game in instant multiplayer mode.
- No fullscreen button (their page has one) and no server address box. P pauses as well as ESC, because
  ESC leaves fullscreen.

**Step 1: make the files**

```
npm run build:crazygames
npm run covers
```

- `dist/crazygames/index.html` is the game for CrazyGames (about 1.1 MB, one file).
- `dist/covers/` has the three cover pictures they ask for: `cover-landscape-1920x1080.png`,
  `cover-portrait-800x1200.png` and `cover-square-800x800.png` (title only, as their rules say).

Online play on CrazyGames needs your hosted server (see section 5). Build with its address baked in:

```
$env:SCORZ_SERVER="wss://your-server-address/ws"; npm run build:crazygames
```

Without it, PLAY WITH FRIENDS is simply hidden in the CrazyGames copy and everything else works.

**Step 2: upload**

1. Make a developer account at https://developer.crazygames.com and start a new game submission.
2. Choose HTML5 as the type. Upload `dist/crazygames/index.html`. If the form asks for a folder or a zip,
   zip the `dist/crazygames` folder (it only holds `index.html`) and upload that.
3. Use their preview to play one match on a computer and one on a phone before you submit.

**Step 3: the form** (what to put in each part)

- **Title:** SCORZ
- **Description:** Voxel football for 3v3 up to 5v5. Pick a style with three abilities, fill your Flow
  bar, and climb ranked from Wood to Obsidian. Play quick matches, Lawless mode with items, a featured
  mode that changes every 3 hours, and online rooms with friends.
- **Controls:** WASD move, mouse aims, Shift sprints, hold left click to shoot, right click passes,
  Space jumps, C dodges, F slide tackles, Q E R abilities, G Flow, ESC or P pauses. Controller and touch
  are supported (the How to Play screen lists them all).
- **Genre and tags:** Sports, Football (Soccer), 3D, Multiplayer.
- **Orientation:** landscape. **Mobile:** yes (touch controls are built in).
- **SDK:** yes, the CrazyGames HTML5 SDK v3.
- **Progress save:** pick "Yes, using the Data Module from the CrazyGames SDK". If you skip this, their
  Data module is off and the game falls back to saving on the device only.
- **Multiplayer:** yes if you baked in a server. Lobby size: 2 to 8 players per room (the rest are bots).
- **Covers:** the three files from `dist/covers/`.
- **Preview video:** optional. If you add one, it must be 15 to 20 seconds, no sound, 1080p landscape and
  portrait, and start on your cover picture.
- **Age:** it fits PEGI 12. There is no blood or fighting, just football and slide tackles.

**What happens next**

- They start with **Basic Launch**: real players try it, ads stay off, and they look at how long people play.
- If they pick it for **Full Launch**, ads turn on (already wired in), and you earn a share of the ad money.
- Their rules change sometimes. Check https://docs.crazygames.com/requirements/intro/ before you submit.

## 5. Play online with friends (the SCORZ server)

Online rooms need the SCORZ server running somewhere. The game itself still works offline without it.

### On your own computer first

1. Open the terminal in VS Code (**Terminal > New Terminal**) and type:

   ```
   npm install
   npm run build
   npm run server
   ```

2. It prints `SCORZ server on http://localhost:8787`. Leave that terminal open.
3. Open **http://localhost:8787** in Chrome or Edge, pick **PLAY WITH FRIENDS** and **CREATE A ROOM**.
4. To try it with a second player on the same computer, open the invite link in a second window.
5. People on the same Wi-Fi can join too: find your computer's address (in PowerShell run `ipconfig`
   and look for the IPv4 address, for example `192.168.1.20`) and they open `http://192.168.1.20:8787`.
   Windows may ask to allow Node.js through the firewall: allow it on private networks only.

Press `Ctrl+C` in the terminal to stop the server.

### Hosting it so anyone can join

The server is one Node.js program that also serves the game page, so a host only has to run
`npm install` and `npm run server`. Most hosts give you `https://` for free, which the game needs
(it then connects with `wss://`, a secure connection, automatically).

Good options to look at, from simplest: **Render** (a Web Service from your GitHub repo),
**Railway**, or **Fly.io**. Small servers usually cost a few dollars a month; free plans tend to
fall asleep when nobody is playing, which makes the first join slow.

On any of them:

1. Connect your GitHub repository.
2. Build command: `npm install && npm run build`. Start command: `npm run server`.
3. The host sets `PORT` for you; the server reads it.
4. When it is running, open the address the host gives you (for example `https://scorz.onrender.com`).
   That page is the game, and its rooms work right away. Share that address with friends.

If you want the GitHub Pages copy of the game to use your server too, open **PLAY WITH FRIENDS >
SERVER ADDRESS** and enter `wss://your-server-address/ws`. Invite links made from there carry the
server address with them.

Accounts (optional for players) are kept in `server/data/accounts.json`, or in the folder you set with
the `DATA_DIR` setting. On hosts with a free plan that folder is often wiped when the server restarts,
so add a **persistent disk** (Render and Fly.io both have one) and point `DATA_DIR` at it. Back it up now
and then. Never put that file on GitHub (it is already in `.gitignore`). Accounts only hold a name, a
hashed password and game progress, no email or real names.

**Chat safety.** Quick chat (PASS!, NICE!, GG and so on) works for everyone. Typing messages needs an
account. The server hides swear words and removes links, emails, @names and phone numbers before anyone
sees a message, and slows down anyone who sends too many. Every player has MUTE and REPORT next to the
other players' names (in the room, and in the menu during a match). Reports are saved to
`server/data/reports.jsonl`, one line each, with what that player said. Read it now and then. When two
players in a room report someone (or the only other player does), that person's typed chat stops in
that room. Players can also set chat to ALL, QUICK or OFF. There is no voice chat on purpose.

**Idle players.** If someone online does nothing for 30 seconds while the ball is in play, they see
ARE YOU THERE? with a 10 second countdown, then a bot plays for them. Any button gives them their player
back, but that match gives them no emeralds, XP or pass XP. Change the times with the `IDLE_SECONDS` and
`IDLE_GRACE` settings.

Things to know: one server runs every room; 20 or so players at once is fine on a small plan. There
is no player prediction yet, so the further players are from the server, the more lag they feel.
Pick a server region close to you and your friends.

## 6. Where things are

```
src/            the game's source code (edit these)
  00_head.html  page title, all the CSS
  01..12_*.js   game code, joined in order by build.js
build.js        builds docs/index.html
docs/index.html the finished game (play it, upload it)
server/         the online server (npm run server)
tools/covers.js makes the CrazyGames cover pictures (npm run covers)
test/           automatic tests (npm test)
CLAUDE.md       instructions Claude Code reads
ROADMAP.md      your feature list as prompts
```

## Credits

- 3D engine: Three.js r128, MIT license (included inside `docs/index.html` with its license notice).
- Fonts: Jersey 10, Jersey 15 and Silkscreen, SIL Open Font License 1.1.
