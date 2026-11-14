# EARTHPULSE V2

An independent listening instrument for the NASA Earth Information Jukebox. The first exhibit scans the change colors from one actual NASA Earth Information Center frame. It includes four insets, 48 inspectable bands and bilingual English and Arabic views.

## Run and demonstrate

Use Node.js 22 or later from this directory. There are no npm dependencies to install.

```sh
npm start
npm test
npm run verify
```

Open [the local exhibit](http://127.0.0.1:4206/). Start listening, then choose India on the image and move the band slider. Play the default Western Europe–India comparison to hear the dominant voice reverse. Select any band in either Sonic DNA row to inspect its position and read its numbers. The no-sound entry and "Play data tones" toggle keep the same image, timeline and values. The standalone static root is `site/`.

Browser testing: run `node tests/browser.mjs` against the running server. Use an available Playwright installation and optionally set `EARTHPULSE_PLAYWRIGHT` to its `index.mjs` path and `EARTHPULSE_BROWSER` to the Chromium executable. `EARTHPULSE_URL` overrides the loopback URL. The browser test writes images to `release/screens/`.

On the managed Windows checkout, if Node cannot resolve the profile, run `$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'` before `npm.cmd start`.

## Architecture

- `tools/extract.py` converts the pinned NASA video into a fixed raster, presentation images and a verified pixel manifest.
- `site/science.js` validates the manifest. `site/score.js` produces deterministic sound events. `site/player.js` owns scheduling, pauses, seeking and the clock used by the active band and envelope indicators.
- `site/canvas.js` positions image controls and the matching crop. `site/app.js` binds the instrument, comparison, keyboard controls and native evidence table. `site/i18n.js` translates interface and scientific readouts.

The app was introduced in its own `jukebox/` directory on a dedicated local branch based on `4b7138b`. To integrate, review that branch's addition and serve `jukebox/site/` as its own entry or site root. The legacy `web/`, tests, assets and branches remain available. Publishing is a separate owner action.

See [scientific provenance and sound mapping](PROVENANCE.md).
