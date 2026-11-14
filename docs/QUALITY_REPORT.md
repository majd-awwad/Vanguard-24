# Quality report

Integration base `06c9fbb`; cinematic contribution `8daed14` imported at `1ec4426`. Validation ran in the isolated `feat/earthpulse-agency-rebuild` checkout against the packaged build and local browser server.

| Check | Result |
| --- | --- |
| `npm test` with `EARTHPULSE_PLAYWRIGHT` and `EARTHPULSE_BROWSER` | 167 passed, zero skipped. Includes the actual browser grid alignment and text zoom check, as well as scientific, audio and release cases. |
| `python -B science/gedi/validate_sample.py` | Six passed against the checked sample; checks joint IDs, flags, waveforms, ordered timing, missing states and contrast sensitivity. Raw HDF5 extraction was not repeated in this delivery. |
| `npm run build`; `npm run verify:build`; `npm run release`; `python -m zipfile -t release/earthpulse.zip` | 116 site files verified. Entry paths, data checksums, map imagery, and fixture exclusion verified. The ZIP passed its structure/checksum check, and PowerShell SHA-256 matched the separate fingerprint. |
| `node tests/cinematic-browser.mjs` | Chromium WebGL desktop and forced no-WebGL mobile at 390 px. Sound-guide waveform, Arabic RTL, keyboard start, focus, choice and evidence with all 12 rows, Science and Dataset anchors, and the manual text route. Browser used software rendering. |
| `node tests/atlas-browser.mjs` | Four cases and Forest navigation; date scrub, valid Rain pulses, VIIRS windows, keyboard pan and zoom, layer toggle, actual sample hit and evidence, Arabic and error recovery. |
| `node tests/browser-smoke.mjs` | Forest guided comparison and exploration, discrete gap/evidence identity, keyboard, Studio, mobile language switching, retry, and visual playback after audio failure. |
| `node tests/decode-integration-browser.mjs`; `node tests/decode-eyes-browser.mjs` | Decode with both languages, missing-fixture handling, production Web Audio scheduling, recovery, and text cues with AudioContext disabled, at 1440 and 375 px. |
| `node tests/dust-observatory-browser.mjs`; `node tests/guided-dust-browser.mjs` | AR/EN at 1440 and 375 px. Date/build comparison, keyboard, share links, and both challenge grids. |
| Visual and hosting smoke | Captured Home, WebGL, mobile Arabic SVG fallback, Arabic Rain Atlas and Arabic Forest to `release/screens/`. Opened them under a simulated `/showcase/` static prefix in Chromium while blocking third-party requests. |

## Remaining verification

- Browser tests cover labels, focus, reduced motion and a workflow without sound. Manual NVDA/VoiceOver, physical-device timing and perceptual listening remain open.
- The renderer releases resources and defers frame draws when hidden. Hardware frame rate and mobile memory have not been benchmarked.
- The repository does not define an independent lint or TypeScript pipeline. JavaScript is exercised through the build, unit and browser tests; type declarations document contracts.
- NASA SVS frames remain related mission or model context. Exact frame-to-granule matching and the V002 GEDI re-extraction require separately verified inputs. Hosting and event submission have not been performed.
