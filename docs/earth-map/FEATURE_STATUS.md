# Feature status (feat/earth-map)

Statuses: **Implemented**, **Partial**, **Blocked by data**, **Not started**. "Auto" means an automated test in `npm test`; "Edge" means a scripted run in real Edge
(scripts kept outside the repository; results are in the final report). Run the tests with
`EARTHPULSE_PYTHON=...\python.exe npm test`; the page is `/pages/studio.html`.

## Product items

| Item (spec section) | Status | Evidence / note |
|---|---|---|
| 02 Entry: one sentence, "Start exploring", no autoplay | Implemented | `studio.js` `startStudio`; Auto (SAFETY), Edge |
| 02 Mode dialog: Guided Voice / Pure Sonification, switchable any time | Implemented | `openModeDialog`; focus trap, Escape; Auto (state), Edge |
| 03 Top bar: phenomenon switch, date/season picker, AR/EN, help, source and verification status | Implemented | AR/EN is the shared site header switch |
| 03 Forests shown disabled with the reason | Implemented (as "not available") | GEDI is six spatial footprints, not a time series |
| 03 Tabs Explore / Find signals / Find similar on the same map; switching keeps position, date, findings, matches | Implemented | Auto (state machine), Edge |
| 03 Info panel: sample id, value, unit, time window, source, data type, sound meaning, coverage, provenance | Implemented | |
| 03 Bottom bar: timeline over the sampled dates, play/stop, real waveform, measure and unit | Implemented | waveform from the transport's AnalyserNode |
| 03 Mobile: map first, bottom sheet for tools, three tabs and mode button always visible, targets >= 44 px | Implemented | Edge audit: 0 controls under 44 px; screenshots |
| 11 State machine and events | Implemented | `state.js`; Auto: VOICE-C and the "must never happen" cases |
| F01 three phenomena (Dust, Rain, Wind) on one map with documented scales | Implemented | `datasets.js` `PHENOMENA` |
| F01 smooth registered layer, zoom/pan/pinch/keyboard, pan limited to the coverage, "outside coverage" message | Implemented | |
| F01 arrow keys over the 1000 cells (row by row, geography never mirrored), Enter selects, R and "Explain my position" | Implemented | |
| F01 auto scan, speed, mute, replay, stop, return to last position | Implemented | area scan 0.5x to 4x, path, "Return to last position" |
| F01 area scan and path as extra tools; compare dates; places A/B; share link | Implemented | kept from the Studio, now for all three phenomena |
| F02 Hunter: highest values | Implemented | Auto |
| F02 Hunter: threshold exceedance (`value >= threshold`, in the unit; dust preset 0.20) | Implemented | |
| F02 Hunter: largest increase and decrease between two dates (delta, percent only when valid) | Implemented | blocked across build labels with the catalog reason |
| F02 Hunter: anomaly versus a baseline | **Blocked by data** (shown as "Not available") | 13 snapshots from different seasons are not a baseline; nothing is called anomalous |
| F02 ranking metric, date, stable id; scope label; no confidence %; all UI states; cancellable worker | Implemented | `hunter-core.js`, `hunter.worker.js`, `analysis-client.js` |
| F02 open a finding: map moves, cell highlighted, panel updated, sound if enabled, "How was this found?" | Implemented | |
| F03 Echo: monthly series per cell (12 dates on the 15th; 2025-08-19 excluded), one build group | Implemented | usable build has 9 monthly samples (March to November 2025) |
| F03 Echo: Shape mode (z-score with a flat guard, Euclidean and DTW with a 1-month band) and Level mode | Implemented | Auto, independently recomputed in Edge |
| F03 Echo: output as spec 10.5; chart; results pinned on the same map; two curves; listen source then match | Implemented | alternating playback (source/match/source) is not offered |
| F03 Echo: build A (3 monthly samples) | **Blocked by data** | "at least 6 comparable samples are needed" |
| F03 Echo: dust while the Decode dates are locked | **Blocked by data** until Decode is finished | needs 2025-08-15; never silently shortened |
| 07 Guided Voice: speechSynthesis only with a voice for `ar`/`en`, live-region fallback, debounce 550 ms, cancel on context change, ducking, separate volumes, "What can I do here?" | Implemented | Auto with a fake synth, Edge with a spy |
| 07 Pure Sonification: zero automatic TTS, ARIA and text stay, speech can be re-enabled | Implemented | explicit requests (R, Explain) still speak by design |
| 08 Sonification `earthmap-v1` for three phenomena, fixed documented limits | Implemented | `SONIFICATION_MAPPING.md` |
| 08 Dust as "filtered noise" | **Partial** | approximated by a dense deterministic pulse train (the transport has no noise source) |
| 08 Optional realistic wind sound layer | Not started | optional, off by default |
| 09 Provenance manifest per dataset, 09.1 inventory | Implemented | `DATA_PROVENANCE.md`, `provenance.json`, `DATA_INVENTORY.md` |
| 10 Backend / API routes | **Partial** | static data, no server; the same `Finding[]` and `matches` JSON contracts are produced by a Web Worker (spec 10.3 allows this) |
| 12 Semantic HTML, roles, live regions, focus, reduced motion, RTL, 2D fallback | Implemented | |
| 12 Offline-friendly | Partial | the data are static files; no service worker |
| 15 Docs | Implemented | this folder |

## Tests of spec section 14

| Test | Status | Automated | Edge |
|---|---|---|---|
| F01-A real sample shows value, unit, date, source | Implemented | `earth-map-core` (package, scales), `earth-map-ui` (SOURCE) | info panel for all three phenomena |
| F01-B different sample changes the sound per the documented rule | Implemented | `earth-map-core` "each phenomenon changes the right quantity" | analyser signal for all four |
| VOICE-A Guided reads options and the value after the selection settles | Implemented | `earth-map-core` speech tests | spy: nothing during movement, one announcement after |
| VOICE-B Pure: no automatic TTS on pointer or arrow movement | Implemented | `earth-map-core` speech test | spy: 0 calls during movement |
| VOICE-C switching modes keeps location, tab, data | Implemented | `earth-map-core` state test | before/after identical |
| HUNTER-A largest increase returns the highest real delta | Implemented | `earth-map-analysis` (synthetic and real data) | worker result equals an independent calculation |
| HUNTER-B open a result: same map, evidence, listen | Implemented | state test | Edge |
| HUNTER-C no baseline, no anomaly claim | Implemented | `earth-map-analysis` | radio disabled with the reason |
| ECHO-A same data and settings, same order | Implemented | `earth-map-analysis` (synthetic labelled) | independent DTW recomputation matches |
| ECHO-B incompatible or short data: clear message, no matches | Implemented | `earth-map-analysis` | build A and locked dust |
| ECHO-C open a match: location and series play | Implemented | state test | listen source then match with an audio signal |
| ACCESS-A keyboard use and meaning without sound | Implemented | `earth-map-ui` (roles, keys) | full keyboard-only run |
| RESPONSIVE desktop, mobile, AR, EN | Implemented | `earth-map-ui` (CSS rules) | overflow 0 and 0 targets under 44 px in 4 views; screenshots |
| SAFETY no autoplay, comfortable levels, no leaked nodes | Implemented | `earth-map-ui` | no sound until "Enable sound"; one transport |
| SOURCE every result documents dataset, variable, unit, coverage, method | Implemented | `earth-map-ui`, `earth-map-analysis` (evidence fields) | "How was this found?" |

## Team work preserved

Nothing outside the allowed paths was changed except `web/cinematic/site/nav.js` and `site.css` (the "Sound Studio" nav link and a 44 px menu button).
Untouched, and still passing their tests: `web/decode*.html`, `web/decode.js`, `web/experiences/decode/**`, `web/audio/**` (Andreh; imported, not copied:
`transport.js`, `voices.js`), `web/contracts/**`, `web/visual/**`, `web/accessibility/**`, `web/sources/decode/**` (Mohammad's `dust-visual.js` and the dust-v2
data stay in the repository), `web/cinematic/{scene,globe,hero,main,...}.js` (cinematic Decode page; only `main.js` was already shared-settings aware),
`deliverables/EarthPulse-JSON-ONLY/**` (Mohammad; never edited), the site pages (Science, About, Sound Lab, Settings, Explore Earth), and the earlier Sound Studio
modules (`field.js`, `view.js`, `mapping.js`, `renderer-gl.js`, `renderer-2d.js`, `tools.js`, `compare.js`, `share.js`) which are now generalised rather than replaced.
Mohammad's commit `49a9406` (which deletes files) is not merged anywhere on this branch.
