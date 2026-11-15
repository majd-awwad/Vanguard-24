# Final UI overhaul: what changed

Branch `feat/final-ui` (from `feat/earth-map`). No science, data, audio-engine, contract or teammate-module code was changed.

## Information architecture
- Navigation: logo · Decode · Explore Earth · Sound Studio · Science · About · accessibility icon · EN | العربية. Five links, active page underlined with `aria-current`. On phones: logo + menu + language, full-screen sheet.
- **Home is now Decode** (`web/index.html`). The old Sound Atlas moved to `web/atlas.html` and stays reachable from the footer ("Archive: Sound Atlas v1"). This is the one commit that touches shared files: `home: Decode becomes the landing page (needs Majd's approval)`.
- `web/decode-3d.html` and `web/pages/sound-lab.html` redirect (to `/` and `science.html#sound`).
- Settings are a drawer opened from the accessibility icon on every page; the full page `pages/settings.html` remains.
- Shared footer on every page (data credit, "not endorsed by NASA", archive link).

## Design system
`tokens.css` (colour, type scale, spacing, radius, motion, touch target 44 px) → `shell.css` (nav, drawer, sheet, buttons, segmented control, switch, chip, tooltip, toast, footer) → `site.css` (page base). Arabic uses bundled IBM Plex Sans Arabic. High contrast, text size and reduced motion are token overrides.

## Sound Studio (full redesign)
- The map is the page: edge to edge under the nav, coverage fills the screen (cropped on the long axis; the compass button restores it).
- Top left: phenomenon segmented control (Forests disabled with its reason) and date. Top right: sound pill (on/off, Guided/Pure, data volume, waveform).
- Left icon rail: Explore · Area · Path · Compare · Find signals · Find similar, with tooltips. One flyout at a time; Esc closes it and returns focus to the rail button.
- Right inspector card opens on selection: big value, unit, location, date and time window, "model (GEOS-FP)" badge, one-line sound meaning, "How was this computed?" sheet, copy link.
- Bottom: compact legend, 13 dates grouped by season, play/pause through the dates.
- Default first state: the data cell nearest the coverage centre is selected and shown with a real value; sound off.
- Results of Find signals / Find similar are a numbered list and numbered pins; hovering links them; opening one flies the map.
- `?` opens a help sheet (what the sound means, keyboard, data notes).
- Phones: full-screen map, tool rail becomes a bottom icon bar, flyout and inspector share one bottom sheet with three snap points.

## Other pages
- Science: new **How it sounds** section (`#sound`) with Hear low / Hear high buttons that run the real Studio engine on real GEOS-FP cells.
- Explore Earth: calmer layout, bigger map, lock screen over the Earth.
- Decode, About, Settings: use the shared shell, tokens and footer.

## Tests
`tests/final-ui.test.mjs` added (nav, redirect, home, Studio default state, single flyout, settings). Two old Studio UI tests updated to the new structure.

## Studio interaction model (second pass)
- One layer, always stated: a layer chip in the toolbar ("Dust · 2025-04-15" or "Dust change · 04-15 → 07-15" with an × back to the snapshot); the date control matches the layer shown.
- One active tool. Switching tools clears the previous tool's drawings (area box, path, pins, change layer) and coming back restores that tool's own state. Explore has no panel.
- Selected place = a card anchored on the map next to the cell (value, unit, coordinates, one-line sound meaning, Replay, How computed). Hover shows a value-only tooltip. The side panel is only for the active tool, with icon, name and close.
- Find signals: one sentence ("Show the 10 highest Dust values on 2025-04-15"), kinds highest / above threshold / biggest rises / biggest drops (anomaly only explained in the info icon), human rows (rank, value with a bar, coordinates, code small), one header line with an info icon, clustered pins, designed empty / loading / unavailable / error states. Find similar, Area, Path and Compare follow the same pattern.
- Spoiler lock: dust 2025-08-15 and 2025-08-19 are disabled (lock + tooltip) in the date select, the timeline, Compare and Find signals until Decode is finished or "Show anyway".
- Fixed a latent bug: a published date comparison (for example dust 15 Apr to 15 Jul) failed to load because its file path was dropped.

## Design restore (third pass)
- Studio back to the first-pass look (full-bleed map, left icon rail with one flyout, floating compact inspector that collapses to a value pill, sound pill with a live waveform, one slim season row that becomes a date popover below 700 px height and on phones), with every functional fix kept: layer chip, one active tool with cleanup/restore, human result rows, clustered pins, spoiler lock everywhere, designed states.
- The whole coverage fits the free area (rail, top pills, bottom bar, open flyout, expanded inspector are excluded) on load, resize, compass and layout changes; contain, never cover.
- Layer cross-fade on date, phenomenon and change-layer switches (skipped under reduced motion).
- One path through the site: a "next step" band ends Decode (Explore the data), Explore Earth and Science (Open the Sound Studio), About and Settings (Decode). Explore Earth has one selected-cell card and Compare in a drawer. Science and About sections carry icons; About has a data to rules to sound diagram.

## Studio in the first-Studio look (fourth pass)
- Reference: the first Studio (b932dc9) was served from a temporary worktree and screenshotted at 1366x768 and 1440x900; the worktree was deleted afterwards.
- Layout: desktop = a sticky map on the left (the whole coverage fitted, contain) and a scrolling column of cards on the right: Data (phenomenon, date, season timeline, layer chip), Sound, Selected place, Tools (one tab bar, only the active tool's question and results), How it works (collapsed). Phones = one column with a 55 vh sticky map on top. Footer at the end.
- Same rhythm on every page: 96 px between sections on desktop, 56 px on phones, and a next-step button at the end.

## About: the real team photo
- `web/assets/team/team-vanguard-nablus-2026.jpg` (1600x1066, 275,264 bytes, SHA-256 `4678b1c455435ce8334ed90c83cd115225b9f3ad4516f686606d3c23ce9a8ac0`) and `web/assets/team/team-vanguard-nablus-2026-800.jpg` (800x533, 78,929 bytes, SHA-256 `9cfd8ffb1f26ff4bfae9d6404e25f4f7824ae4d72d30cf4b7283cc89a8be5af5`, used through `srcset` on phones).
- Re-encoded from the original in a canvas, so no EXIF or GPS metadata is carried over. The original (2048x1365) stays outside the repo.
- Shown in "Meet the team" with the EN/AR caption and alt text, `loading="lazy"`, width/height set, rounded corners and a soft glow; the six names sit beside it (below it on phones). No one in the photo is labelled. The footer keeps the "not endorsed by NASA" note.

## Ambient sound pack (optional ambience layer)
- 9 MP3s and `manifest.json` in `web/assets/ambient/` (from `earthpulse-ambient-sounds.zip`). Illustrative recordings, **not data**. SHA-256 of every file is checked in `tests/ambience.test.mjs`.
- Behaviour and breakpoints: `docs/earth-map/SONIFICATION_MAPPING.md`. Licences are **TO VERIFY** for every file, including the Freesound and WhatsApp ones; they are listed on the Science page credits too.

| File | Source (as recorded in the manifest) | Licence | SHA-256 |
|---|---|---|---|
| dust-high.mp3 | WhatsApp_Audio_2026-11-15_at_7.37.38_AM_1.mpeg | to verify | `9091a2270d74ec3da2851e43f0b6017f3df255ebe340adfb1a90e28d8b3766eb` |
| dust-low.mp3 | WhatsApp_Audio_2026-11-15_at_7.37.39_AM.mpeg | to verify | `4253cc7ad75e2fc8e0aacfefeed3f5a801477ce2000989b8aa2cabccd5ebdc7c` |
| dust-mid.mp3 | WhatsApp_Audio_2026-11-15_at_7.37.38_AM.mpeg | to verify | `67d2b889e6818eb240008f002f1f97d2623382d8cf2cda5c43bba1e6c780956c` |
| rain-high.mp3 | Mixkit #2399 heavy rain drops | to verify | `edac7559acba1146a422e0abdd57190ca9b5c269ef7039472a69afb611d551eb` |
| rain-low.mp3 | Freesound #810468 by designerschoice (rain-samsung-galaxy-smartphone ... light) | to verify | `900226c62bcd7f9b0f2e19f0ad10cb930fc1aef72986c30ac014813fcdd722ef` |
| rain-mid.mp3 | Freesound #217236 by roofusj (steady rain in the city) | to verify | `cdd5609f92b1f29f41c484d6452d7064117590942d338d6b2b2c10370ae78776` |
| wind-high.mp3 | WhatsApp_Audio_2026-11-15_at_7.35.24_AM.mpeg | to verify | `b6af8a890650f16f08c1fa45be9a4be1f900d0cd33cd10eb0ce9ae819ad6bb7d` |
| wind-low.mp3 | WhatsApp_Audio_2026-11-15_at_7.35.24_AM_2.mpeg | to verify | `ba8433a72ddc1573b13b354996793804645fa5517948370afee95aad5c687c07` |
| wind-mid.mp3 | WhatsApp_Audio_2026-11-15_at_7.35.24_AM_1.mpeg | to verify | `e4f4d1d5c6b1e5ecbc774657334791a606dd8851f6b4e19851a5ba6d7126debe` |

## Data sync from main (Mohammad's PR #9, 3bb5f7b)
- `git merge origin/main` into feat/final-ui: clean, no conflicts; only `deliverables/EarthPulse-JSON-ONLY/**` changed and was not edited by us.
- `node scripts/earth-map/copy-package.mjs` refreshed `web/assets/earthpulse-json/`: 63/63 files match the new master catalog SHA-256 and byte counts. Five dust snapshots were re-serialized (same values, new hashes); every catalog gained `modelSource` per snapshot, and rainfall and wind gained `compatibilityGroups` and `compatibilityPolicy`.
- The app now uses the catalog's `compatibilityGroups` and `compatibilityPolicy` directly; the derived rule (literal `modelSource` of each snapshot) is only the fallback. Blocked cross-build comparisons show the catalog's policy text. Find signals and Find similar read the build from the same groups.
- Rain ambience: below 0.1 mm/h is silence; the levels are the 33rd and 66th percentiles (0.1637 and 0.3115 mm/h) of the 1,074 values at or above 0.1 mm/h across the 13 dates.

## Dry dates
- A date with almost no signal (rain: fewer than 10% of cells at or above 0.1 mm/h; the same pattern is ready for wind below 0.3 m/s) shows a notice on the map with the three wettest real dates, counted from the data (rain: 15 Aug 15%, 15 Jul 11%, 15 Nov 11% of cells). On phones the notice sits in the Data card so it does not cover the small map. Hovering a dry cell says "no measurable rain (< 0.1 mm/h)" and the selected-place card says it too. English and Arabic. Tests: `tests/dry-dates.test.mjs`.

## Sound is the user's recordings only (3 levels by real value)
- The Sound Studio, Explore Earth listening, the Science "How it sounds" examples and the Hunter/Echo listening play only the nine recordings (dust, rain, wind × low/mid/high), chosen from the real value with the documented breakpoints. The synthesized data tones are no longer played anywhere outside Decode.
- One sound button and one volume. The sound-style selector and the separate ambience toggle are gone (spoken guidance follows the "Spoken instructions" setting). Old stored sound settings are reset once.
- Scans, paths, Region A/B and Echo play one slice (about 0.7 s, 80 ms fades) of the matching recording per step, in order, with the clock and playhead in sync. Pan follows longitude.
- Credits: every recording is listed with its source in the manifest, the Science page credits and the table above; all licences are "to verify".

## Guided Voice / Pure Sonification restored (recordings stay the only sound)
- The entry dialog (two choices) and the Guided / Pure switch in the Studio sound controls are back. Guided Voice = spoken guidance (live region and visible text when no voice exists) plus the recordings, ducked while speaking. Pure Sonification = the recordings only, no automatic speech.
- One source of truth: the "Spoken instructions" setting (`guidance`). The dialog, the Studio switch, the settings drawer and the settings page all read and write it and stay in sync through the `earthpulse:settings` event. Switching keeps position, tab, findings and matches.

## Meaning of each value (Guided Voice and a badge in every mode)
- A short relative phrase (for example "Dust: high compared with this dataset") from the same level that picks the recording. Rain below 0.1 mm/h says "no measurable rain"; a missing value says "no data here".
- Guided Voice speaks: phrase, value with unit, place (1 decimal), date only when it changed. The same phrase shows as a small badge in the selected-place card and the hover tooltip; Pure Sonification never speaks it.

## Temperature removed from the product (the app uses Dust, Rain and Wind)
- The Sound Studio (phenomenon switch, timeline labels, Hunter, Echo, Compare, Region A/B, share links, Guided Voice phrases, tooltips, help), Explore Earth, Science, About and every EN/AR text no longer have a temperature phenomenon. There is no disabled button and no note: it does not exist. Old share links with `phen=temperature` fall back to Dust.
- Code: the temperature dataset entry, its colour scale, breakpoints, sound mapping and branches are deleted; the Studio's "no recording" branches are gone because all three phenomena have their three recordings.
- Data copy: `web/assets/earthpulse-json/temperature/` is removed and `scripts/earth-map/copy-package.mjs` skips it (the copy verifies 48/48 files; the source package is still verified 63/63). `provenance.mjs` no longer builds a temperature manifest.
- Docs updated: SONIFICATION_MAPPING.md, DATA_INVENTORY.md, DATA_PROVENANCE.md (regenerated), FEATURE_STATUS.md, provenance.json and this file. A test (`tests/no-temperature.test.mjs`) fails if our pages, scripts, UI strings or Earth Map docs mention it again.
- Scope: the separate Atlas "Ocean heat" case (sea-surface temperature, `web/platform.js`, `web/atlas.html`) is a different dataset and is untouched; the vendored NASA source pages under `science/decode/` are untouched.
- **NOTE:** the package `deliverables/EarthPulse-JSON-ONLY/temperature/` (Mohammad's verified package) is not edited or deleted; the app intentionally does not use it. The master `catalog.json` copy stays verbatim, so it still lists those files.
