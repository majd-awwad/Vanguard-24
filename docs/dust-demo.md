# EARTHPULSE dust demo

Open the Sound Atlas, then choose **Explore dust with sound**. The entire path uses packaged files. For Arabic, switch the language in the header before starting.

## Judge walkthrough

1. Ask “Which region has the strongest modeled dust signal?” Open the short practice if the audience needs to learn the cue. One, two or three notes convey the order of the three band means. Pitch and loudness stay fixed in this stage.
2. Use the mission controls to listen or read the cues without audio. Compare all three bands, or replay a pair for a closer comparison. Let the judge choose a band before revealing.
3. Reveal the bars and the mean for each band. Open the calculation for the winning band and show which cells entered the mean. Each band uses its available Quick-grid cells, including values below the separate game threshold. Follow **Inspect centre** on a cell to open the finer map at the corresponding location and reference window.
4. In the Dust Observatory, open that cell’s date history and choose another date from the same model build. Explain that the difference is the second selected window minus the first. Use **Copy link to this view** to keep the exact dates and cell for review.
5. Open Earth Detective for cell-level exploration. Use Quick in the live demo and reserve Advanced for a deeper inspection. In this mode, pitch, stereo position, and loudness have different roles from the guided note count. The text-cue route supports the same guessing and Reveal flow without opening an audio device.

## What the data support

The quantities describe modeled dust optical depth through the full atmospheric column. They cannot establish ground-level PM2.5 exposure or a health outcome. Each Observatory date represents a selected three-hour window. Differences between two windows are not monthly or seasonal averages or a trend.

The August 19 context image from NASA SVS 5669 is a separate GEOS-FP 2 km Replay frame. The numerical case uses the standard GEOS-FP three-hour mean. Present the image beside the evidence as related context. The basemap coastlines come from Natural Earth.

## Rehearsal checklist

- Run `npm start` with Node.js 22 or newer. Verify the same path at the final deployment URL before using it in a demo.
- Ask a first-time listener to explain the note cue in their own words, select a band, and explain the evidence after Reveal. Record which step needed coaching.
- Run the Arabic and English flows with NVDA and record browser version, NVDA version, and the Speech Viewer output for the spoken band cue, selection, and Reveal. Verify that moving across Observatory cells announces available values and missing readings distinctly.
- Keep the text-cue path available for muted playback. Browser tests cover keyboard and rendered states. The human rehearsal is where we check whether the cues are understood.
