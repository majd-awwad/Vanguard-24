# Product and design system

## Exhibition flow

1. Launch Earth Detective in 3D from the home page. Give the visitor the question before asking them to learn the mapping. The sound guide demonstrates direction and intensity. Start enters the listening phase and moves keyboard focus to its heading.
2. Listen, locate, and reveal. The reveal carries the actual dust optical depth and source; the text-only path carries equivalent qualitative cues and reveals the same evidence. The challenge's 0.20 threshold is a game rule.
3. From Science or Dataset, continue into the Sonic Lens or Atlas. Rain, ocean and thermal anomalies each have a regional map, dates and selectable samples. The Forest entry opens the distinct flagship lidar instrument. Its guided path compares the same height band across two footprint IDs before inviting free exploration.
4. The Dust Observatory takes the dust question beyond one date. Visitors can select a cell, open its history and compare compatible time windows, with the date pair and exact value in evidence.

## Visual and interaction rules

- The Earth is the main image in the cinematic room. Use Blue Marble land, restrained atmospheric lighting and a local camera transition. Teal marks active navigation and the listening cursor. Gold identifies the focused position or the evidence affordance.
- The Atlas gives the basemap, measured centers, selection and legend separate layers. Keep missing markers distinguishable and show units near the map and in the evidence. Tracks and samples stay discrete.
- Use serif display type, sans controls and mono data identifiers. Arabic headings use an Arabic-capable system fallback where bundled fonts have no glyphs. Right-to-left reading must keep geographic west/east, chart positions, signed coordinates and scientific identifiers stable.
- Keep sound opt-in. Native buttons and selectors support the same core choices as the map; keyboard focus follows Start and returns when an evidence dialog closes. Honor reduced-motion preferences and offer a silent path. The smallest layouts keep Science and Dataset visible and place text on an opaque-to-transparent scrim over the Earth.
- Use the separate 2D and text links for immediate access. A failed WebGL startup selects the SVG renderer using the same challenge data. A failed audio context leaves text and visual evidence available.
