# Site pages (feat/site-pages)

Five pages share one header, one design system and one settings store. Built in this order: Science & Dataset, About,
Sound Lab, Accessibility & Settings, Explore Earth. Status is tracked at the bottom.

## Layout

- `web/pages/*.html`: one HTML file per page (served as `/pages/<name>.html`).
- `web/cinematic/site/`: shared `site.css`, `nav.js`, `settings.js`, `cells.js`, `dom.js` and per-page modules.
- Cells are always named letter = row from the north (A is northernmost), number = column from the west; bounds and sizes are computed from the case.

## Honesty rules in the code

- Every number comes from the case JSON or from `docs/decode-data.md`. The two literals taken from the docs (native resolution, raw file SHA-256) are checked by `tests/site-pages.test.mjs`.
- Three kinds of content carry a badge: real data, related NASA visualization (SVS 5669, never projected), decorative.
- No NASA logo, no endorsement claim, no invented threshold bands, no count of positive cells (that would hint at the Decode answer).

## Notes for Majd

- `web/index.html` should link to the pages (Explore Earth, Sound Lab, Science & Dataset, About, Settings). Not changed here.
- The Science page shows no cell values and no count of cells at/above the threshold, on purpose.

## Status

- [x] Science & Dataset: `/pages/science.html`
- [x] About: `/pages/about.html` (six first names only, no roles, bios or photos; listening study stated as planned)
- [x] Sound Lab: `/pages/sound-lab.html`
- [x] Accessibility & Settings: `/pages/settings.html`
- [x] Explore Earth: `/pages/explore.html` (locked until Decode finished once; "Show anyway" per tab)

## Notes for Majd (additions)

- `web/cinematic/main.js` (Decode 3D) now reads the shared settings and sets `earthpulse.decode.completed.v1` when a *discovery* session reaches Reveal; no file outside the allowed set changed.
- `web/decode.js` could expose a stable `onComplete` hook so the flag does not depend on the snapshot shape.
- Sound Lab hides the numeric value, the threshold result and the gain of a cell until Decode is finished (or "Show anyway"), because gain is a monotonic function of the value.
- In the spatial plan only `measured` cells sound: below-threshold cells are silent. Pages say "silence does not mean dust-free".
- Explore Earth zoom scales the registered stage (1x to 1.35x); the scene's own `zoom()` only affects the hero pose.

## Limitations

- Audio verified through the real AnalyserNode in headless Edge (a signal is present), not by ears.
- Arabic text is a first translation and needs native review.
- Spoken instructions are offered only if a voice for the current language is installed.
