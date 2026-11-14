# Decode v2 integration contract

## DOM and exports

| Mount | Owner | Responsibility |
|---|---|---|
| `#decode-stage` | Majd | Shared extent for the two layers. |
| `#decode-visual` | Roaa | Inert, aria-hidden and pointer-transparent SVG. Use the same bounds and row/column geometry as the interactive grid. |
| `#decode-grid` | Israa | The only named `role=grid`. Render rows and accessible cells with native buttons using `.dg-cell[data-row][data-col]`. Use one roving Tab stop. Each guess exposes its pressed state. |
| `#decode-status` | Israa | Polite live region for actions, playback completion and revealed results. Skip per-tone announcements. |

The signatures are in `decode.d.ts`. Majd provides `validateDecodeCase`. Mohammad supplies `loadDecodeCase` from `web/sources/decode/index.js`. Andreh supplies `makeSpatialPlan` and `heardClass` from `web/audio/spatial-plan.js`. Yaman supplies `createDecodeSession` and `scoreGuesses` from `web/experiences/decode/session.js` and `score.js`. Roaa supplies `mountDecodeVisual` from `web/visual/decode-visual.js`. Israa supplies `mountDecodeGrid` and `decodeMessage` from `web/accessibility/decode-grid.js` and `web/i18n/decode-messages.js`.

## Interaction and disclosure

### Coastline geography

`mountDecodeVisual(root, session, { t })` remains valid. After validating the loaded case, the integration layer may pass `geography: { caseId, bounds, projection: "plate-carree" }`. Use the validated case's ID and bounds. The mount option contains geographic metadata only.

Render the coastline only when geography is present and its `caseId` matches `snapshot.caseId`. Clear the previous coastline on a case change. Integration disposes the old visual mount and remounts it once the new case has validated geography, keeping the session and interactive grid mounted.

Project longitude linearly to x and latitude inversely to y in the grid's drawing rectangle. West is left and north is up in both LTR and RTL. Quick and Advanced use the same geographic extent. The coastline is the Decode basemap. Any SVS frame is separate evidence and requires independently verified registration before it can be treated as geographically aligned.

Row 0 is north; column 0 is west in Arabic and English. The only shared focus is `snapshot.focus`. Arrows move it. Pointer activation and Space use the same toggle. Enter probes, P sweeps, L plays calibration, R reads and S submits. Scope character shortcuts to the grid. Keep Tab exits and visible controls. An active playback event does not move keyboard focus. Both layers read the active cell from the integrated renderer snapshot and share the transport clock.

In Discovery before Reveal, cells contain only `row`, `col`, `lat` and `lon`. Keep values, statuses, event counts, source imagery, truth and scores out of the visual and accessibility trees. The v2 `expectedCount` hint must be the same in every compared condition when used. Only relay `lastProbe.heard` after a permitted probe; it is a qualitative cue. In a text-only trial it cannot relay an unplayed audio probe. Learning may expose readings and does not submit or score. After Reveal, keep guesses locked. Fixtures must have a visible test-data label when exercised by later integration.

### Playback highlight

The integration layer publishes `snapshot.activeCell` as zero-based `[row, col]` or `null`. Treat absence in older session snapshots as `null`. `web/decode.js` resolves the event privately against the currently loaded plan using `transport.activeEventId` and matching `planRevision`, case and level. A silent slot has the same timing rules as a sounding slot. Clear the highlight while idle, starting, paused, seeking, in pre-roll, at the end, during Legend, or when revision or cell identity does not match. Resume from the next published playing snapshot. Neither renderer receives the plan or changes grid focus to follow playback.

### Reveal handoff

After the session publishes a locked Discovery Reveal snapshot, integration derives the cell markers from that snapshot's guesses and evidence cells. In v2 a `measured` status is at or above the case threshold. An exact match is correct, an unmatched guess is incorrect, and an unguessed threshold cell is missed. This follows the session's default zero-tolerance score. A missing value is still labelled missing in the evidence table.

Integration calls `prepareReveal()` once for the new Reveal and immediately applies the returned callback using that snapshot's outcomes. `#decode-outcome-labels` is inside the accessible evidence section, outside the inert SVG. Setup may return `null`. The visual mount invalidates older callbacks when the phase, case or level changes. On Reset or explicit case selection integration calls `clearReveal()` before dispatch. Older visual mounts can omit these methods. The numeric evidence table and separate links for the GEOS-FP data and SVS context frame are available after Reveal.

## Validation and sources

The validator accepts the truth rule literal `value >= threshold`. Quick uses either `mean of 2x2 advanced cells` for continuous data or `sum of 2x2 advanced cells` for intermittent counts. Each Quick cell is missing if any child is missing. Use one threshold across levels and recompute the truth for each level. Grids are rectangular, equally subdivided in WGS84 and ordered north-to-south, west-to-east. Source granule IDs stay strings; record authenticated download links, checksums, QA and native-to-advanced aggregation in the science provenance. Propose any additional rule explicitly before using it in a case.

Validation checks structure and internal consistency. `SAME_DATA` requires independent evidence of the frame's source run, time, field, domain and registration. [SVS 5669](https://svs.gsfc.nasa.gov/5669/) credits GEOS-FP 2 km Replay. MERRA-2 uses `RELATED_CONTEXT` with an explicit note and independent attribution.
