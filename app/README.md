# SCORZ Android app

The app is the same game page inside an Android shell (Capacitor). It opens full screen and sideways, works with no
internet (bot matches), and plays online on the same server as the website.

This PC has no Android tools, so **GitHub builds the app in the cloud** (`.github/workflows/android.yml`) every time the
game changes. The files land on the repo's **Releases** page under "SCORZ Android app":

- `SCORZ.apk`: install it on an Android phone to try the app.
- `SCORZ.aab`: the file to upload to Google Play. It is only made once the two secrets below exist.

Folders: `www/` (the built page, from `npm run build:app` in the main folder), `android/` (the Android project),
`store/` (icon, feature picture and the store text). `npm run appicons` redraws the icons.

## What a grown-up has to do (about 1 hour, then Google's waiting time)

1. **Add the upload key to GitHub** (once). Open github.com/Sreejilal/ego-blocks > Settings > Secrets and variables >
   Actions > New repository secret. Make two secrets from the files in `Desktop\SCORZ-APP-KEY`:
   - `KEYSTORE_BASE64`: paste everything in `KEYSTORE_BASE64.txt`
   - `KEYSTORE_PASSWORD`: paste everything in `KEYSTORE_PASSWORD.txt`

   Then Actions > Android app > Run workflow. Keep a copy of the `SCORZ-APP-KEY` folder somewhere safe and private.
2. **Make a Google Play developer account** at play.google.com/console: 25 US dollars once, the account owner must be 18
   or older and Google checks an ID. A new personal account must first run a **closed test with at least 12 testers for
   14 days** before the app can go public (Google's rule).
3. **Create the app** in Play Console: name SCORZ, Game, Free. The package name `com.scorz.football` comes from the file.
4. **Fill in the store page** with the text in `store/listing.md`, `store/icon-512.png`, `store/feature-1024x500.png`
   and at least 2 phone screenshots (take them in the app).
5. **Answer Google's forms**: privacy policy link `https://scorz.onrender.com/privacy.html`; ads: no; content rating
   questionnaire (football, no violence, online play with filtered chat); target age 13 and up; Data safety answers are
   in `store/listing.md`.
6. **Upload `SCORZ.aab`** from the Releases page to Testing > Closed testing, add the testers' emails and send them the
   link. After 14 days apply for production.

Updates: every push that changes the game makes a new `SCORZ.aab` with a bigger version number. Upload it as a new release.

## iPhone

An App Store app needs a Mac and an Apple developer account (99 US dollars a year). Not set up. On iPhones the website
already works from the home screen: Share > Add to Home Screen.
