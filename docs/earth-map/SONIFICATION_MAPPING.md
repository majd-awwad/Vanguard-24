# Sonification mapping `earthmap-v1`

Code: `web/studio/sonify.js` (pure: value to voice parameters), `web/studio/datasets.js` (fixed scales),
`web/audio/transport.js` and `voices.js` (shared audio engine, unchanged). Everything is NASA GMAO GEOS-FP **model**
data; the sound is a representation of the numbers, not a recording of dust, rain, heat or wind.

## Pipeline

`value` -> `normalized = clamp((value - validMin) / (validMax - validMin), 0, 1)` (after the documented transform) ->
voice parameters -> shared `createTransport` (one AudioContext, one scheduler) -> speakers. The same normalisation
drives the colour of the map layer, so what you see and what you hear are the same fixed scale.

## Fixed limits (the same for all 13 dates, so dates are comparable)

Limits are rounded outward from the real data range over all 13 sampled dates (computed from the package; a test
checks every value lies inside them).

| Phenomenon | Measure and unit | Data range (13 dates) | validMin, validMax | Transform | Why |
|---|---|---|---|---|---|
| Dust | `DUEXTTAU`, unitless | 0.0016 to 2.173 | 0.001, 2.5 | log | very skewed (median about 0.07) |
| Rainfall | one-hour accumulation, mm | 0 to 3.870 | 0, 4 | square root | very skewed; most cells are near 0 |
| Wind | speed, m s-1 | 0.027 to 15.59 | 0, 16 | linear | |

Colour ramps use the same normalised value (`PHENOMENA[...].stops`). Changes between two dates use a signed scale per
phenomenon (display bands, not scientific thresholds): near-zero band / saturation: dust 0.02 / 1.5, rainfall 0.05 / 3 mm,
wind 0.3 / 12 m s-1.

## Mapping per phenomenon (legacy synthesized tones, no longer played; see "Studio sound" below)

| Phenomenon | Sound | Parameters (n = normalized, 0 to 1) | What changes with the value |
|---|---|---|---|
| Rainfall | short triangle pulses at a fixed 520 Hz | pulse rate = 1.5 + 12.5 n pulses/s, pulse 35 ms; no rain (<= 0.002 mm) is **silent** | more rain = **faster pulses** |
| Dust | dense pulse train, 22 ms pulses | density = 3 + 21 n pulses/s; brightness: centre frequency 900 x 2^(1.5 n) Hz and waveform triangle (n < 1/3), square (n < 2/3), sawtooth | more dust = **denser and brighter** |
| Wind | 70 ms triangle pulses at 180 Hz (tremolo) | rate = 2 + 14 n pulses/s; **pan** = east component of the flow = u / hypot(u, v) | stronger wind = **faster pulses**; the sound moves left or right with the east-west part of the wind |

Other rules:

- **Loudness never carries the value.** Gain is constant (0.14, below the shared 0.22 ceiling). The meaning is in pulse
  rate, pitch or brightness, and each has a one-sentence text explanation in the info panel.
- **Position:** for dust and rainfall the stereo pan is the cell's longitude (west left, east right,
  never mirrored in Arabic). Wind replaces it with the wind's east-west component.
- **Wind direction** is shown as text (`From SE (138 degrees)`) and sonified through pan only. It is **never averaged**.
  Calm (speed below 0.3 m s-1) or a `null` direction is centred; a direction is never guessed. Speed is what Hunter and Echo use.
- **Missing** is a soft click (700 Hz, 28 ms), never silence and never zero. (None occur in this release; the code handles null.)
- **Change layers** (second date minus first): a rising two-note step (440 Hz up) for an increase, a falling step for a
  decrease, one steady 440 Hz note inside the near-zero band; the step is 1 to 12 semitones wide, scaled by the
  phenomenon's own change scale.
- **Safety:** every voice is passed through `continuousVoice` (gain clamped to 0.22) with attack and release ramps (no sharp
  peaks); at most 24 pulses per event; one `AudioContext` (the transport's); a new hover tone replaces the previous plan
  (no overlapping sounds); sound starts only after the user presses "Enable sound"; hover tones are throttled to one per
  90 ms and only when the cell changes; `Mute` pauses the transport.
- **Determinism:** the sound is a pure function of (phenomenon, cell values, longitude, event length). The same cell with the
  same settings produces identical plans (tested).

## What changed from the Studio's `studio-v1` (dust)

`studio-v1` mapped the dust value to **pitch** (220 to 1760 Hz, log scale) with constant loudness. `earthmap-v1` maps the
dust value to **pulse density and brightness**, because:

1. all three phenomena now share one logic: each has its own natural channel (rate for rain and wind, density/brightness for a particulate), so dust, which has no natural pitch, no longer sounds like a pitch scale;
2. a clear distinction between layers when switching phenomenon: pulses mean rain, wind or dust;
3. the spec asks for a density/brightness mapping for dust.

Limitation: the shared transport only schedules oscillators, so dust "filtered noise" is approximated by a dense,
deterministic pulse train whose rate and centre frequency (brightness) follow the value. A real noise source would need
a new audio voice in `web/audio` (a note for Andreh). `studio-v1` is still documented in `docs/sound-studio.md` and its
tests still pass; the optional realistic wind-sound layer is **not implemented** (it is optional and off by default).

## Speech and ducking

Guided Voice announces after the cursor has settled (550 ms, inside the 400 to 700 ms window), cancels stale speech
whenever the context changes, and ducks the data sound to 35% while speaking, then restores it over 300 ms. Voice volume
and data volume are separate sliders. Pure Sonification never speaks automatically.


## Studio sound = the user's recordings, chosen by the real value (current)

**This replaces the synthesized tones described in the sections above for the Sound Studio, Explore Earth, the Science "How it sounds" examples and the Hunter/Echo listening.** The tone mapping above (`earthmap-v1`, `studio-v1`) is legacy: its code (`sonify.js`, `mapping.js` tones) stays in the repository with its unit tests, but nothing in those pages plays it. The Decode challenge is unchanged (its game relies on pitch = north).

**Sounds are recordings chosen by the real value: low / mid / high. The level follows the data; the recordings themselves are illustrative.** (Arabic: «الأصوات تسجيلات تُختار بالقيمة الحقيقية: منخفض / متوسط / مرتفع. المستوى يتبع البيانات؛ أما التسجيلات نفسها فتوضيحية.»)

- It is a categorical mapping to three levels, not a continuous one. Files: `{dust|rain|wind}-{low|mid|high}.mp3` in `web/assets/ambient/` (`manifest.json` lists every file with its SHA-256, original source and licence status, **all "TO VERIFY"**).
- Which level: from the REAL value of the snapshot under the cursor, the selected cell, or the scan position. At or below the low breakpoint is low, at or below the high breakpoint is mid, above it is high. A missing value gives silence and the text explanation. Rain below 0.1 mm/h counts as no measurable rain: silence, with the text "no measurable rain (< 0.1 mm/h)". Wind uses speed.
- Fixed breakpoints, computed once per phenomenon: the 33rd and 66th percentiles (linear interpolation) of every valid value across all 13 sampled dates (13,000 values each). For rain, only values at or above 0.1 mm/h are used. They are tested against the catalog in `tests/ambience.test.mjs` and kept as constants in `web/studio/ambience-core.js` for pages that do not load the whole package.

| Phenomenon | Unit | Low breakpoint (p33) | High breakpoint (p66) |
|---|---|---|---|
| Dust | unitless | 0.03822 | 0.1247 |
| Rainfall (values >= 0.1 mm/h) | mm per hour | 0.1637 | 0.3115 |
| Wind | m/s | 2.477 | 4.068 |

Rainfall note: only 1,074 of the 13,000 values are at or above 0.1 mm/h; the other 11,926 give silence. The breakpoints come from those 1,074 values.

- Hover (a cell under the cursor or the selection): the level loops (two overlapping sources, 0.5 s loop crossfade); a level change crossfades over 400 ms (60 ms with reduced motion); at most two recordings are alive and never two levels at full volume.
- Area scan, path, Region A/B fingerprints and Echo series: one slice per step, about 0.7 s with 80 ms fades, from the recording of that step's level, in order. The shared transport only keeps the clock (play, pause, stop, speed, active step); its plans carry markers without tones, and the active step triggers the slice, so the playhead and the sound stay in sync. A scan reads at most 130 cells (stride from the grid), at 0.3 s per step.
- Stereo pan follows longitude: west left, east right, never mirrored in Arabic.
- One volume (the settings volume) and one sound on/off button. The audio context is created and resumed inside the button's click; nothing plays before it. Guided Voice speech ducks the recordings to 35% and restores them smoothly; mute and sound-off fade everything out.
- Old stored sound settings are reset once (`earthpulse.sound.v2`).

## Meaning phrase (spoken in Guided Voice, shown as a badge in every mode)

A short **relative** phrase for the value under the cursor or selection. It uses the SAME level that chooses the recording (low / mid / high from the breakpoints above), so what is said matches what is heard. It is never a weather claim: "high" means high compared with this dataset (for rain, "high" starts at 0.31 mm/h, which is light rain meteorologically).

At or below the low breakpoint is the first word, at or below the high breakpoint the middle word, above it the last word (the breakpoints of the table above).

| | low | mid | high |
|---|---|---|---|
| Dust (EN) | Dust: low compared with this dataset | Dust: moderate compared with this dataset | Dust: high compared with this dataset |
| Rain (EN) | Rain: light compared with this dataset | Rain: moderate compared with this dataset | Rain: high compared with this dataset |
| Wind (EN) | Wind: low compared with this dataset | Wind: moderate compared with this dataset | Wind: high compared with this dataset |

- Rain below 0.1 mm/h: "Rain: no measurable rain". A missing value: "no data here".
- Arabic: «غبار منخفض / متوسط / مرتفع مقارنة ببقية البيانات» · «لا يوجد مطر يُقاس» / «مطر قليل / متوسط / مرتفع مقارنة ببقية البيانات» · «رياح ضعيفة / متوسطة / قوية مقارنة ببقية البيانات» · «لا توجد بيانات هنا».
- While exploring, the phrase is spoken the first time and again only when it changes (a new level or phenomenon); an explicit request (explain, Space, switching to Guided) always says it in full. The badge is always visible.
- Spoken order (after the movement settles, stale speech cancelled): the phrase, the value with its unit (dust and rain 2 decimals, wind 1), the place (latitude and longitude to 1 decimal), and the date only when it changed since the last spoken one.
- The badge appears in the selected-place card and in the hover tooltip in both modes. Pure Sonification never speaks it. The comparison (change) layer has no phrase.
