# Earth Sound Studio (`/pages/studio.html`)

An interactive map of real NASA GMAO GEOS-FP dust (`DFPT3NXAER`, `DUEXTTAU`, dust extinction AOT at 550 nm,
dimensionless unit `1`) over North Africa and the Mediterranean (west -20, east 50, south 15, north 45). The data
are Mohammad's dust-v2 layer: 13 sampled three-hour means (the 15th of each month from December 2024 to November 2025,
plus 2025-08-19), each aggregated to 25 x 40 = 1,000 cells of 1.2 degrees x 1.75 degrees (see `docs/dust-v2-data.md`).
The brief's night-lights example is only an example; the Studio uses this dataset and the same scientific rules.

Code: `web/studio/` (page logic, maths, mapping, renderers), `web/pages/studio.html`, `tests/studio.test.mjs`. It imports
`web/sources/decode/dust-visual.js`, `web/audio/transport.js` and `web/audio/voices.js`, and the site shell
(`web/cinematic/site/*`). Nothing there was copied or edited.

## Rules the Studio never breaks

- Real values only. Every displayed number is read from a cell of the loaded snapshot (or from a published or computed
  difference of two snapshots). Colour never supplies numbers.
- Each snapshot is **one three-hour mean**, not a daily, monthly or seasonal average. The date picker lists only the
  13 real snapshots, grouped by the catalog's meteorological seasons, which only enumerate sampled dates.
- Missing values stay missing: hatched on the map, a soft click in sound, counted (never averaged) in summaries,
  and "unavailable" in changes. They are never zero and never "no change".
- Changes are only offered where they are scientifically allowed (see Compare).
- Unlocked only after Decode has been finished once (`earthpulse.decode.completed.v1`); "Show anyway (spoils the
  challenge)" unlocks the current tab only.

## Map and layer

The map is plate carree (x linear in longitude, y linear in latitude), the projection documented for the grid. A
WebGL fragment shader (`renderer-gl.js`, three.js vendored in `web/vendor/three/`) turns each pixel into longitude and
latitude, samples the NASA Blue Marble texture (`web/assets/earth/`) at that longitude and latitude, and blends the dust
field sampled at the same longitude and latitude. Both layers share one coordinate, so the dust stays registered to the
Earth at every zoom and pan. No grid lines or tiles are drawn.

Display smoothing: values are blended between cell centres with a cubic B-spline for a continuous colour field. It is
labelled in the UI. Readouts, sound, summaries and statistics always use the cell values, never the smoothed field.

Fixed scales (the same for every date, so dates are comparable): value `0.001 to 2.5` on a log scale (all 13 real
snapshots lie inside it; a test checks this); change `+/-1.5`, with a "near zero" display band of `|change| < 0.02`
drawn neutral. These are display bands, not scientific thresholds.

The 2D canvas renderer (`renderer-2d.js`) draws the same layer (same spline, same colour tables) when WebGL is not
available (`?renderer=2d` forces it).

Interaction: mouse wheel, pinch, drag, toolbar buttons; keyboard `+`/`-`, `Home`, Shift+arrows (pan). The view is
clamped to the dataset region (zoom 1 to 18).

## Sound mapping `studio-v1`

| Quantity | Sound | Notes |
|---|---|---|
| dust value | pitch `220 * 2^(3 * t)` Hz, `t` = position of the value on the fixed log scale | 220 Hz at 0.001, 1760 Hz at 2.5; one scale for the whole catalog |
| longitude | stereo pan -1 (west) to +1 (east) | never mirrored in Arabic |
| loudness | constant (gain 0.16, below the shared ceiling 0.22) | loudness carries nothing, so volume changes never change the meaning |
| missing | one soft click (`crackleVoice`, 700 Hz, 28 ms) and a "missing" readout | distinct from any tone |
| change (second minus first) | two-note step around 440 Hz: rising for an increase, falling for a decrease, wider for a bigger change (1 to 12 semitones); one steady 440 Hz note inside the near-zero band | |

Deterministic: the sound is a pure function of (value, longitude) for hovering, and of the ordered cell list for scans,
so the same place with the same settings sounds identical. Hovering is throttled to one new tone per 90 ms (the last
position always plays) and a tone only repeats when the cell changes.

**Why the Studio maps value to pitch while Decode maps north to pitch.** Decode is a listening game: pitch carries
latitude and pan carries longitude, so the player has to find the value from loudness without being told it. The Studio
is a reading tool: the value is the point, so pitch carries the value and position is carried by pan and the on-screen
cursor. The UI states this next to the mapping.

Sound starts only after the user presses "Enable sound" (a user gesture). It uses `createTransport` with the same
analyser tap the rest of the site uses, so the waveform shown is the real output.

Touch: with sound on, one finger pressed and dragged listens; two fingers pan and zoom. Keyboard: the map is focusable;
arrows move a cursor cell by cell (left is always west), `R` reads the value as text, `Space` plays the cell.

## Play an area (M3)

"Play visible area" scans the part of the dataset region currently on screen; "Play selected area" scans a rectangle
drawn with the Select-area tool (drag, or `Enter` at two corners). The scan reads cells west to east along each row,
rows from north to south, one tone per cell (0.07 s per cell at 1x; speed 0.5x to 4x). When an area has more than 300
cells, every k-th row and column is read (k shown in the summary), so a scan never exceeds 300 cells. A white line and a
box show the cell being read; they follow the transport's own clock, and the Understand panel shows the same cell
and value. When the scan ends, the summary gives the number of cells read, lowest, highest, and mean of the real cell
values, the number missing, and the area. The mean is a plain average of cell values (cells are equal in degrees, not
in area).

## Draw a path (M4)

With the Draw-path tool, click or tap to add points, or press `Enter` at the keyboard cursor (`Backspace` removes the
last point, `Escape` clears). The path is sampled at equal great-circle distance (about one sample per 130 km, at most
160), linear in longitude/latitude between points; each sample uses the value of the nearest cell (samples outside the
region count as missing). The path plays at 0.12 s per sample with a progress marker on the map and on the profile chart,
which plots the same real cell values on the fixed log scale, with missing samples drawn as grey bars. A summary
(samples, lowest, highest, mean, missing, distance) follows the end of playback.

## Compare (M5)

**Dates.** Pick any two of the 13 snapshots; the earlier is always the first and the change is *second minus first*.
- If the catalog publishes that pair (`catalog.comparisons`: 2025-04-15 to 2025-07-15, 2025-07-15 to 2025-10-15), the
  published file is loaded.
- Otherwise, if both dates are in the same compatibility group (same literal model build label), the difference is
  computed in the browser with `compareDustSnapshots`, and the page says so.
- Across the two build groups the comparison is **unavailable**, with the catalog's own reason
  ("Different literal model build labels; numerical build equivalence unverified."). Nothing is computed or drawn.
- Colours (fixed for every pair): increase purple, decrease orange, near zero neutral grey. The near-zero display band is
  `|change| < 0.02` (about 1% of the highest value in the catalog); it is a display band, not a scientific threshold.
  The colour scale saturates at +/-1.5. Missing is hatched grey and stays missing ("unavailable"), never zero or no change.
- Sound: a rising two-note step (440 Hz up) for an increase, a falling step for a decrease, a wider step for a bigger
  change (1 to 12 semitones), one steady 440 Hz note inside the near-zero band, a soft click for missing.

**Places A and B.** Set each place from the cursor cell or from the selected rectangle. Both show their real value (cell)
or min/max/mean/missing (area) and the difference of the means. "Play A then B" plays each place's sound fingerprint
back to back with a short gap: a cell repeats its tone three times; an area plays up to 24 of its cells west to east.

## Share link (optional)

"Copy link" stores `date`, `cmp` (two dates), `rect` and `path` in the URL. On load every field is validated against the
catalog and the region; an unavailable comparison or out-of-region point is dropped. No audio is stored.

## Accessibility

The map is one focusable region (`role="application"`): arrows move a cell cursor (left is always west, also in
Arabic), `R` reads the value as text in a live region, `Space` plays the cell, `+`/`-` zoom, `Home` resets, Shift+arrows pan,
and the tools have keyboard equivalents. All controls are real buttons, selects and sliders. Reduced motion turns off
view animation. Without WebGL a 2D canvas map shows the same layer (`?renderer=2d` forces it).

## Notes for Majd and Mohammad

- `web/sources/decode/dust-visual.js` was used as is. `compareDustSnapshots` validates statistics strictly, which the
  tests rely on. A `catalog.bounds` and a documented `validRange` would let the fixed scales be read from the catalog
  instead of being constants (`field.js`: `VALUE_MIN`, `VALUE_MAX`, `DIFF_MAX`); a test checks every real value lies inside.
- The catalog's `unavailableComparisons` lists only one pair; the Studio derives the others from `compatibilityGroups`
  and shows the catalog's reason text for all of them.
- `docs/dust-v2-data.md` says a season selection only enumerates sampled dates; the Studio follows that.
- The shared nav now has a "Sound Studio" link (`web/cinematic/site/nav.js`, also used by the Decode 3D page). Linking from
  `web/index.html` is still Majd's file.
- Mohammad's commit 49a9406 (which deletes atlas/forest files) is not merged into this branch.

## Limitations

- The Studio is a flat plate carree map textured with the same NASA Blue Marble used by the globe; the Decode globe's own
  scene (`web/cinematic/scene.js`, read-only for this feature) is locked to the Decode grid registration, so it was not
  reused as a renderer. The textures, three.js and site shell are shared.
- Sound was verified through the real Web Audio analyser in headless Edge (peak frequency matches the mapping), not by ear;
  touch listening was not tested on a real touch device.
- The 25 x 40 grid is 1.2 x 1.75 degrees; zoomed in, the smooth field is interpolation, which the page says.
