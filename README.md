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

### Option C: CrazyGames (later, when the game is more finished)

- Submit at the CrazyGames developer portal: https://developer.crazygames.com
- Start with **Basic Launch**: no SDK is needed, but there are no ads or earnings, and the content has to fit PEGI 12.
- If they pick your game for **Full Launch**, you add the CrazyGames SDK (gameplay start and stop events), and ads are only allowed through their SDK.
- Size is not a problem: this game is about 1 MB and the limit for the first download is 50 MB.
- Online multiplayer there needs your own server, their room and invite features, chat moderation (at least a swear filter), and CrazyGames usernames shown in game.
- Their requirement pages: https://docs.crazygames.com/requirements/intro/

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
test/           automatic tests (npm test)
CLAUDE.md       instructions Claude Code reads
ROADMAP.md      your feature list as prompts
```

## Credits

- 3D engine: Three.js r128, MIT license (included inside `docs/index.html` with its license notice).
- Fonts: Jersey 10, Jersey 15 and Silkscreen, SIL Open Font License 1.1.
