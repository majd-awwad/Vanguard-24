# Data inventory (phase A audit)

Audited on `feat/earth-map` (created from `feat/sound-studio`) on 2026-11-15, from the real files of Mohammad's
package `deliverables/EarthPulse-JSON-ONLY/` (64 files, master `catalog.json`, schema `earthpulse.json-export/1`),
taken from `origin/JSON_Files` with `git checkout origin/JSON_Files -- deliverables/EarthPulse-JSON-ONLY` only. The
folder is never edited. Numbers below were computed from the files, not copied from the spec.

## Starting point

- Branch state before the work: clean; `npm test` 183 tests, 182 pass, 0 fail, 1 skipped (with
  `EARTHPULSE_PYTHON` set).
- Existing product code: the Earth Sound Studio (`web/pages/studio.html`, `web/studio/**`) for the dust-v2 layer only:
  smooth registered layer on the NASA Blue Marble (WebGL, 2D canvas fallback), zoom/pan, hover/touch/keyboard
  listening, area scan, path, date comparison, place fingerprints, share link, spoiler lock. It reads
  `web/assets/decode/dust-v2/**` and is dust-specific in its scales, colours and sound mapping.

## Integrity finding (important)

The master catalog's `sha256` and `bytes` hash the exact **LF** bytes of each file (`integrityPolicy`). On this
Windows checkout `core.autocrlf=true` converted the package to CRLF, so a naive hash of the working tree fails for
**all 63 files**. After CRLF to LF normalisation **63/63 match** (sha256 and byte count), and no file is unlisted.
`scripts/earth-map/copy-package.mjs` therefore reads LF-normalised bytes, verifies every file against the master
catalog, and writes the generated copy `web/assets/earthpulse-json/` (with `.gitattributes: * -text` so git never
converts it again). The browser applies the same normalisation when it verifies a file.

**What the app uses:** Dust, Rain and Wind. The package carries one more phenomenon folder (15 files) that the app intentionally does not use: `copy-package.mjs` does not copy it, so the served copy holds 48 verified files (the 63 source files are still all verified in the source package, which is never edited).

## Common facts

| Item | Value |
|---|---|
| Region | North Africa and the Eastern Mediterranean: west -20, east 50, south 15, north 45 |
| Grid | 25 rows x 40 columns = 1,000 cells of 1.2 degrees x 1.75 degrees; row 0 north, column 0 west |
| Native grid | 0.25 degrees latitude x 0.3125 degrees longitude (area-weighted aggregation; any invalid contributor makes the cell null) |
| Dates | 13 selected snapshots: the 15th of each month 2024-12-15 to 2025-11-15, plus 2025-08-19 |
| Time meaning | Each is **one selected snapshot**: a three-hour mean (dust) or one-hour mean (others). Never a daily, monthly or seasonal average, never a climatology |
| Seasons | winter-2024-2025 (3), spring-2025 (3), summer-2025 (4), autumn-2025 (3): membership lists only |
| Missing values | 0 nulls in all 13 x 1000 values of every measure in this release; code still handles null |
| Data type | **model output** (NASA GMAO GEOS-FP), never "measured" or "observed" |
| Build labels | Same for all three phenomena the app uses: **A** `GEOSadas-5_29_5-p6 experiment_id: f5295_fp` (2024-12-15, 2025-01-15, 2025-02-15) and **B** `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp` (the other 10, incl. 2025-08-19) |

Because every phenomenon has the same two build groups, **cross-build differences and Echo matches are blocked for all
three** (the dust catalog publishes `compatibilityGroups` and `unavailableComparisons`; the rainfall and wind
catalogs publish neither, so the rule is derived from each snapshot's `source.modelSource`, which was checked here).

## Per phenomenon

### Dust
- Product / variable: GEOS-FP `DFPT3NXAER`, `DUEXTTAU` (dust extinction AOT at 550 nm). Unit `1` (dimensionless).
- Window: three-hour mean 18:00-21:00 UTC (centre 19:30 UTC).
- Files: master 18 JSON in `dust/`: catalog, grid, 13 snapshots (`values`: array of 1000), 2 published comparisons
  (April to July, July to October), the Decode case (`dust/decode/...`, 3x4 and 6x8, threshold 0.20).
- Range over all 13 dates: 0.0016 to 2.173 (heavily skewed: median about 0.07).
- Related visualization: SVS 5669, `RELATED_CONTEXT`, only for 2025-08-19 (separate 2 km Replay at 20:00 UTC; not
  registered numeric pixels).
- **Spoiler rule:** 2025-08-15 and 2025-08-19 are hidden until `earthpulse.decode.completed.v1` is set.

### Rainfall
- Product / variable: GEOS-FP `DFPT1NXFLX`, `PRECTOT`. `sourceType` = model. Not IMERG, not satellite.
- Units: `rateKgM2S` (kg m-2 s-1) and derived `intervalAccumulationMm` (PRECTOT x 3600 s, mm of water over the one-hour interval).
- Window: one-hour mean 19:00-20:00 UTC (centre 19:30 UTC).
- Files: 15 JSON (catalog, grid, 13 snapshots), no comparisons.
- Range: rate 0 to 1.08e-3 kg m-2 s-1; accumulation 0 to 3.87 mm (very skewed).
- Related visualization: IMERG / SVS 4285 may appear only as `RELATED_CONTEXT` (different product).

### Wind
- Product / variable: GEOS-FP `DFPT1NXSLV`, `U10M` (eastward) and `V10M` (northward) at 10 m.
- Measures: `uMps`, `vMps`, derived `speedMps` and `directionFromDegrees` (meteorological, the direction the wind blows
  **from**, clockwise from true north; **null for calm**).
- Window: one-hour mean 19:00-20:00 UTC. Files: 15 JSON.
- Range: speed 0.027 to 15.59 m s-1; u -12.6 to 14.1; v -12.2 to 13.5. No calm (null) direction occurs in these 13 snapshots,
  but the code treats null as calm and never averages directions.
- No related EIC visualization in the package.

### Forests
Not in this package. GEDI footprints elsewhere in the repo are six spatial checkpoints, not time series. The UI shows
"Forests: not available in this release" with that reason and never uses them for Hunter or Echo.

## Where the code uses each (planned and existing)

| Need | Module |
|---|---|
| Verified load of the package | `scripts/earth-map/copy-package.mjs`, `web/studio/datasets.js` (browser SHA-256 check) |
| Per-phenomenon scales, colours, units | `web/studio/datasets.js` (`PHENOMENA`) |
| Map layer, zoom, hover, scan, path | `web/studio/studio.js`, `renderer-gl.js`, `renderer-2d.js`, `tools.js` (existing, generalised) |
| Sonification | `web/studio/sonify.js` over `web/audio/transport.js` and `voices.js` |
| Speech guide | `web/studio/speech.js` |
| Hunter | `web/studio/hunter-core.js` (pure) run in `web/studio/hunter.worker.js` |
| Echo | `web/studio/echo-core.js` (pure) run in `web/studio/echo.worker.js` |

## Verdict

- **Feature 01 (map):** fits all three phenomena (Dust, Rain, Wind) at full 25x40 resolution. The existing Studio is generalised from dust to
  three phenomena rather than rebuilt.
- **Hunter:** fits. Highest values, threshold exceedance and largest increase/decrease work per phenomenon and date; changes
  only inside one build group. **Anomaly versus a baseline is "Not available"**: 12-13 selected snapshots of different
  seasons are not a baseline.
- **Echo:** time series per cell exist (monthly samples on the 15th). Spacing is regular only without 2025-08-19, which
  is excluded. The 12 monthly dates split into build A (3 dates) and build B (9 dates). Echo runs inside one build group
  only, so it can use build B's 9 monthly points (March to November 2025); build A's 3 points are "insufficient comparable
  samples". Dust Echo additionally needs 2025-08-15, so it stays locked until Decode is finished.
