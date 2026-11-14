# Guided Discovery

The Sound Atlas links to `dust.html`. The guided page links to the existing Earth Detective experience as Quick (3 × 4) and Advanced (6 × 8), and to the Dust Observatory for dated snapshots. Direct links to `decode.html` still default to Quick.

## Comparing bands

The shared Decode v2 loader validates the production GEOS-FP case before the guided page uses it. Each band is one row of the Quick grid. Its result is the arithmetic mean of its available cells, with equal weight per cell. Zero and below-threshold values contribute. Missing values are excluded, the Reveal shows coverage, and a band with no usable values is unranked. This is a mean of Quick cell means, not a new area-weighted extraction from the source grid.

Available band means are sorted from smallest to largest. Values within an absolute tolerance of 10⁻¹² of their rank group's smallest mean share its rank. The result can have multiple strongest bands. The short practice clip is synthetic. Real playback uses one to three notes to convey rank, with the same pitch, gain and 1.5-second band duration. Solo playback and paired previews keep their rank from across all three bands. A silent missing slot is explicitly identified. Opening the transcript provides a readable cue history and polite note counts as each band finishes. Pausing freezes clues and resuming starts the current band again so first notes are preserved.

The spatial grid's 0.20 threshold is a challenge rule. Guided comparison includes readings below it. Dust optical depth describes attenuation through the atmospheric column. It is not a ground-level PM2.5 or health measurement.

## Map and provenance

The guided map uses `web/visual/dust-basemap.js` to reproject the Natural Earth 1:110m land path. North remains up and west remains left in both languages. The three equal-height bands mark the Quick rows. During playback, the map shows the current band and draws each note as it starts. After Reveal, the result includes the original cells from west to east so a reader can audit each average.

The numbers come from the NASA GEOS-FP three-hour mean. SVS 5669 is a separate 2 km Replay frame. The Reveal identifies the relationship and links to the model source and SVS separately. The frame is never an overlay on the basemap.

## Browser verification

With a built site running locally, run `node tests/guided-dust-browser.mjs`. Like the existing Decode browser scripts, it uses Playwright and supports `EARTHPULSE_PLAYWRIGHT`, `EARTHPULSE_BROWSER` and `EARTHPULSE_URL`.
