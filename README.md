# EARTHPULSE — Hear the Unseen

One frontend: the cinematic 3D Earth interface in `web/index.html`. Arabic is the default; English is available from the language switch. The experience includes the sound guide, globe-to-map transition, dust decoding challenge and NASA evidence.

## Run

Use Node.js 22 or later. No dependency installation is needed.

```powershell
cd C:\Users\moham\Desktop\Frontend
npm.cmd start
```

Open **http://127.0.0.1:4174/**. For English, open **http://127.0.0.1:4174/?lang=en**. Stop the server with Ctrl+C. Restart after source edits to rebuild.

`npm run build` checks the dust dataset and replaces the generated `dist/` directory. `web/` is the source; do not edit `dist/`. Port 4174 avoids the other local project on 4173. To choose another port after building, run `node scripts/serve.mjs 4180`.

If the managed Windows environment reports `EPERM` while resolving the user profile:

```powershell
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
npm.cmd start
```

## Structure

- `web/index.html`: the only page and application entry.
- `web/cinematic/`: globe rendering, camera flight, particles, hero and bilingual copy.
- `web/decode.js`, `web/experiences/decode/`: challenge interface and session logic.
- `web/audio/`, `web/accessibility/`, `web/visual/`: sound, keyboard grid and styles. The SVG renderer is a fallback inside this same interface when WebGL is unavailable.
- `web/assets/`, `web/vendor/`: local textures, fonts, dataset and three.js.
- `science/`: research, source extracts and provenance; these are reference materials, not alternative frontends.

The previous Atlas, Forest and flat Decode pages and their unused code/assets have been removed. Old page URLs redirect to the main page on the local server. Historical research notes may still describe earlier experiments.

## Verify

```powershell
npm.cmd test
npm.cmd run build
```

For browser checks, have Playwright available or set `EARTHPULSE_PLAYWRIGHT` to its absolute `index.mjs` path and `EARTHPULSE_BROWSER` to a Chromium-based browser executable. With the server running:

```powershell
node tests/cinematic-browser.mjs
```

`EARTHPULSE_URL` can override the default URL. Browser checks cover the 3D renderer, Arabic and English, mobile layout, navigation, audio controls, the challenge and the WebGL fallback.

The numerical case uses GEOS-FP dust optical depth. Its related NASA SVS frame is a separate model run. See [dataset documentation](docs/decode-data.md) and [Earth texture sources and licenses](docs/earth-assets.md). Manual screen-reader and human listening checks remain open.
