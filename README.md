# EARTHPULSE 2.0 — The Sound Atlas

Team Vanguard’s bilingual Earth-science listening platform. Start with cinematic Earth Detective or go directly to **The Invisible Forest**. The Atlas opens ocean temperature, rainfall and thermal detections in a common, geographically registered Sonic Lens. The Forest instrument explores a discrete GEDI track and return waveform. Playback uses only packaged assets and needs no credentials or internet access.

**Earth Sound Studio** is available at `web/studio.html`. Its current checked-in
mode explores three exact NASA SVS 5276 nighttime-lights frames through a smooth
global map, hover listening, visible-area scanning, drawn geographic trails and
A/B comparison. It is intentionally labeled `REFERENCE_IMAGE_ONLY`: image color
drives qualitative sound, while radiance values remain unavailable until the
two authenticated VNP46A4.002 h25v06 granules pass the bounded importer and
review described in `science/nightlights/README.md`.

## Walkthrough

1. From the home page, launch Earth Detective in 3D. Play the sound guide, Start Decoding, listen to a pass, select cells and reveal the modeled dust values. If WebGL is disabled, the same route switches to SVG. Separate 2D and text-cue links are also available.
2. Follow **Science** to the Sonic Lens or **Dataset** to the Atlas. Select Rainfall, zoom to or select a retained sample, step to a date, listen and open the evidence. The region and sampling are fixed to the packaged subset.
3. Open **The Invisible Forest** and compare the guided footprints across the same height band, then hold one footprint and scan its return vertically. The evidence lists the shot and processing details.

## Dust discovery

- [Guided Discovery](web/dust.html) lets you compare three latitude bands by ear, choose a hypothesis, and reveal the actual Quick-grid means. An optional practice clip and text cues make the comparison usable without headphones.
- [Earth Detective](web/decode.html) keeps the original spatial grid challenge. Quick has 12 cells and Advanced has 48. Pitch locates north and south, stereo places west and east, and loudness varies among qualifying cells. The 0.20 cutoff is a challenge rule. [Text cues without sound](web/decode.html?condition=text) make the challenge playable through qualitative cell cues.
- [Dust Observatory](web/dust-observatory.html) lets you inspect the 1,000-cell map across 13 verified three-hour snapshots and compare compatible dates. Open a cell's date history to read individual values and model builds, or start a comparison from that table. Each plotted point is a selected observation window.

See [the guided method](docs/guided-dust.md), [the data validation and extraction ledger](docs/dust-v2-data.md), [the demo and accessibility handoff](docs/dust-demo.md), and [the bilingual submission copy](docs/submission.md).

## Run locally

Use Node.js 22 or later. The runtime needs no npm dependency installation. From this directory, run:

```sh
npm start
```

Open <http://127.0.0.1:4173/>. Run `npm run build` to generate the portable static site in `dist/`. Serve that directory over HTTP, including when hosting it under a path prefix. The build checks the pinned scientific subsets and GEDI context frame, then packages the source evidence.

Run `npm run verify:build` to check the existing static output. Run `npm run release` to build and verify a fresh static archive. To host it, extract the ZIP and serve the directory containing `index.html` over HTTP.

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

The Node tests also call the existing Python reference, which uses the standard library for event generation. Set `EARTHPULSE_PYTHON` if your executable is named something other than `python`. With the local server running, run `node tests/cinematic-browser.mjs`, `node tests/atlas-browser.mjs` or `node tests/browser-smoke.mjs` with Playwright available. Set `EARTHPULSE_PLAYWRIGHT` to the absolute path of its `index.mjs` and `EARTHPULSE_BROWSER` to the Chrome executable if using a managed installation. Set `EARTHPULSE_URL` to test a different deployment base URL. See the [quality report](docs/QUALITY_REPORT.md) for all commands and the [architecture](docs/ARCHITECTURE.md) for source boundaries.

The browser suite covers the keyboard journey, playback and plot synchronization, pinned evidence, Arabic and English switching at mobile widths, data-load recovery and visual playback after audio initialization fails. A manual NVDA session and human listening study remain open. The science checkpoint records the open V002 and SVS alignment questions.

## Measurements and sound

The [data ledger](docs/DATA_PROVENANCE.md) records products, exact source windows, units, data versus illustration and limits. The [asset ledger](docs/ASSET_PROVENANCE.md) credits map, texture, font and other media. Optional GEDI V002 and additional scientific inputs are specified in [DATA_REQUEST.md](DATA_REQUEST.md).

The current mapping uses the GEDI checkpoint’s background-corrected, thresholded return fraction in a fixed −10 to 22 m window above estimated ground. The vertical scan plays one-metre bands at 0.13 seconds per metre at 1×. The track scan plays one event per footprint at its measured along-track distance divided by 65 metres per playback second at 1×. Both modes use a 440 Hz sine tone, 95 ms duration, 9 ms attack and 26 ms release at 1×. Peak gain is `0.32 × sqrt(fraction)`. The volume control scales all events together. A bin below the threshold is available for inspection as a silent event. The gaps between footprints have no events.

[The GEDI checkpoint](science/gedi/README.md) records the extraction, stress tests, units and scientific limits. [The provenance manifest](science/gedi/provenance.json) includes the granule identifiers, download links, and SHA-256 checksums. NASA's [GEDI Forest Height visualization](https://svs.gsfc.nasa.gov/4950/) supplies mission context through its L2B RH100 map. The frame-to-shot relationship remains unverified.

The opening and instrument use `web/assets/gedi/cerrado-dusk.jpg`, an AI-generated landscape illustration. The track view places the footprints schematically with proportional spacing based on their measured along-track distances. The beam illustration connects the active height band to the waveform. Fonts are Instrument Serif, Instrument Sans and IBM Plex Mono, with their OFL notices in `web/assets/fonts/`. The exhibit code was written with Codex.
