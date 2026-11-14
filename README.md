# EARTHPULSE 2.0 — The Sound Atlas

Team Vanguard’s bilingual Earth-science listening platform. Explore ocean heat, rainfall, active-fire detections and forest structure through their numerical evidence. The atlas opens the three temporal cases in a common Sonic Lens. The Forest route (`forest.html`) retains the original discrete track and vertical waveform instrument. The browser uses only packaged assets and needs no credentials or network connection for playback.

## Run locally

Use Node.js 22 or later. From this directory, run:

```sh
npm start
```

Open <http://127.0.0.1:4173/>. Run `npm run build` to generate the portable static site in `dist/`. Serve that directory over HTTP, including when hosting it under a path prefix. The build checks the pinned scientific subsets and GEDI context frame, then packages the source evidence.

On the managed Windows workspace, if Node reports an `EPERM` while resolving the user profile, run this in PowerShell before running npm:

```powershell
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
npm.cmd start
```

## Verify

```sh
npm test
python -B science/gedi/validate_sample.py
```

The Node tests also call the existing Python reference, which uses the standard library for event generation. Set `EARTHPULSE_PYTHON` if your executable is named something other than `python`. With the local server running, run `node tests/atlas-browser.mjs` and `node tests/browser-smoke.mjs` with Playwright available, or set `EARTHPULSE_PLAYWRIGHT` to the absolute path of its `index.mjs` and `EARTHPULSE_BROWSER` to the Chrome executable. Set `EARTHPULSE_URL` to test a different deployment base URL.

The browser suite covers the keyboard journey, playback and plot synchronization, pinned evidence, Arabic and English switching at mobile widths, data-load recovery and visual playback after audio initialization fails. A manual NVDA session and human listening study remain open. The science checkpoint records the open V002 and SVS alignment questions.

## Measurements and sound

The [source ledger](docs/source-status.md) records the temporal cases, original queries and granules, processing rules, EIC visual status, and verification limits.

The current mapping uses the GEDI checkpoint’s background-corrected, thresholded return fraction in a fixed −10 to 22 m window above estimated ground. The vertical scan plays one-metre bands at 0.13 seconds per metre at 1×. The track scan plays one event per footprint at its measured along-track distance divided by 65 metres per playback second at 1×. Both modes use a 440 Hz sine tone, 95 ms duration, 9 ms attack and 26 ms release at 1×. Peak gain is `0.32 × sqrt(fraction)`. The volume control scales all events together. A bin below the threshold is available for inspection as a silent event. The gaps between footprints have no events.

[The GEDI checkpoint](science/gedi/README.md) records the extraction, stress tests, units and scientific limits. [The provenance manifest](science/gedi/provenance.json) includes the granule identifiers, download links, and SHA-256 checksums. NASA's [GEDI Forest Height visualization](https://svs.gsfc.nasa.gov/4950/) supplies mission context through its L2B RH100 map. The frame-to-shot relationship remains unverified.

The opening and instrument use `web/assets/gedi/cerrado-dusk.jpg`, an AI-generated landscape illustration. The track view places the footprints schematically with proportional spacing based on their measured along-track distances. The beam illustration connects the active height band to the waveform. Fonts are Instrument Serif, Instrument Sans and IBM Plex Mono, with their OFL notices in `web/assets/fonts/`. The exhibit code was written with Codex.
