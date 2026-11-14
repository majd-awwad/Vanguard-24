# EarthPulse spatial sound mapping

Owner: Andreh. Mapping version: **`decode-spatial-v1`**. Input schema:
**`earthpulse.decode/2`**. Output follows `SpatialPlan` in
[`web/contracts/decode.d.ts`](../web/contracts/decode.d.ts).
The engine creates parameters; `createTransport` owns Web Audio nodes and clocks.
No external audio dependencies, UI, dataset loading, or application integration
are introduced.

## Coordinates and mapping

Quick is 3 rows by 4 columns; Advanced is 6 by 8. Row 0 is north, column 0 is
west. Pitch encodes latitude position, never the scientific value. Stereo pan
encodes longitude position, independently of intensity:

```text
pan = 2 * col / (cols - 1) - 1
frequencyHz = 220 * 2 ** (2 * (1 - row / (rows - 1)))
```

West is full left (-1), east is full right (+1); intermediate columns are evenly
spaced. North is 880 Hz, south is 220 Hz; rows follow a logarithmic scale over
two octaves. Equal row positions within a level always have equal pitch.

## Intensity and calibration dependency

The current shared v2 contract and official synthetic fixtures **do not contain
a documented valid scientific data range**. The audio module cannot infer a
product's valid range or units from its phenomenon name. Until the data owner
supplies that calibration, this implementation uses the finite non-missing
values' minimum and maximum across the **whole selected level**, including
below-threshold values, as a provisional sample extent. It never recalibrates
against only the selected row, cell, or contrast pair.

An optional `decodeCase.levels[level].validRange = [min, max]` takes precedence.
This is a local forward-compatible extension, **not yet a field in the shared
v2 type**. Bounds must be finite, nonnegative and ordered. Majd and the data
owner should agree on documented per-product, per-level bounds and formalize
the metadata before making claims of fixed scientific amplitude calibration.
No shared type, validator or fixture has been changed here.

```text
n = clamp((value - min) / (max - min), 0, 1)
gain = 0.22 * sqrt(n)
```

The square-root curve expands quieter differences. The per-voice linear gain
ceiling is **0.22**, before the existing transport master volume (default 0.72).
For a zero-width range, positive measured values map to full normalized intensity,
and zero maps to silence. All-missing grids use `[0, 0]` and remain silent.
Values outside a supplied range saturate; evidence retains the original value.
Negative or nonfinite measurements are rejected rather than converted to sound.
Finite equal values at the lower bound normalize to silence even when measured;
silence alone is therefore not evidence of missing data.

This fallback is stable across listening modes for the same case and level,
but does not promise comparable loudness across cases, changing datasets or
Quick/Advanced aggregation. Fixed valid ranges are required for that comparison.

## Timing and voices

Every actual-data event occupies a 0.8-second slot. A sweep processes columns
in ascending order (west to east), with rows ascending (north to south) inside
each column. Valid Quick and Advanced sweeps contain exactly 12 and 48 events,
including silent events. Events carry stable unique IDs and onset times; their
evidence copies every supplied cell field, plus the original unit and mapping
version. Input data is never mutated.

Continuous phenomena use `voice: 'tone'`, a 0.56-second sustained oscillator,
25 ms linear attack and 90 ms release. The default waveform is sine. Sine,
triangle, square and sawtooth are accepted; changing waveform changes only
timbre, without changing scientific evidence, pitch mapping, gain or timing.

Intermittent phenomena use `voice: 'crackle'`: short pitched transients, each
28 ms long with 3 ms attack and 16 ms release. They are deterministic oscillator
pulses, not random noise samples. The number of pulses is `min(eventCount, 12)`.
Counts must be nonnegative safe integers; explicit zero counts are silent.
If eventCount is absent, four pulses are used. Counts above 12 saturate to bound
scheduling cost and preserve separable transients; the full count stays in evidence.

For `N` pulses, pulse zero starts at offset 0. For pulse index `i > 0`:

```text
offsetS(i) = (i + (i is odd ? 0.15 : 0.35)) * 0.5 / N
```

These stratified offsets alternate within their slots, remain ordered, never
overlap, and finish within the continuous voice's 0.56-second window. No random
generator, seed, time, global state or `Math.random` is used. `tone.durationS`
means duration **per pulse** when `pulses` is present, matching the existing
temporal rain convention. The overall plan includes its final quiet slot tail.

## Legend

`legend` lasts exactly six seconds, with six events at 0, 1, 2, 3, 4 and 5 seconds:

1. West, then east: identical pitch and normalized intensity 0.64.
2. South/low, then north/high: identical pan and normalized intensity 0.64.
3. Quiet, then loud: identical pan and pitch, normalized intensity 0.04 then 0.81.

Non-varying coordinates use the lower-index middle row/column for the chosen
grid. The same pitch, pan, square-root curve, ceiling and selected behavior are
used as for data. Intermittent legend notes all have four pulses so loudness
comparison does not also change pulse count. The legend requires only case
schema, ID, unit and behavior; grid values and NASA datasets are not required.

Legend evidence is explicitly marked `synthetic: true`, with a calibration label
and unit `synthetic calibration (normalized)`. Its placeholder lat/lon and values
are calibration parameters, **never Earth observations**. Integration must label
the legend accordingly and must not display it as scientific evidence.

## Silence and listening feedback

`missing` and `below_threshold` cells always produce `tone: null`. Their events,
original values (including null versus measured zero), statuses, coordinates,
event counts and extra evidence remain present. The audio layer trusts the
data owner's threshold status; it does not recompute or change scientific truth.
Zero normalized intensity and intermittent zero counts also produce null tones.

`heardClass(data, level, row, col)` returns only `silent`, `low`, `mid`, or `high`.
It uses the same normalization and silence rules as the planner. For audible
cells let `a = sqrt(n)`, the gain as a fraction of the ceiling:

| Class | Boundary |
| --- | --- |
| silent | Null/suppressed tone or `n <= 0` |
| low | `0 < a < 1/3` |
| mid | `1/3 <= a < 2/3` |
| high | `2/3 <= a <= 1` |

Equivalently the numeric intensity boundaries are `n = 1/9` and `n = 4/9`.
The function returns a label, never scientific values or numeric categories.
Invalid coordinates throw `RangeError`; invalid schema/cell data throw
`TypeError`. Callers should handle validation errors without revealing hidden
scientific values during Discovery Mode.

## API and integration for Majd and Yaman

```javascript
import { makeSpatialPlan, heardClass } from './audio/spatial-plan.js';
import { createTransport } from './audio/transport.js';

const options = { level: 'quick', mode: 'sweep', waveform: 'sine' };
const plan = makeSpatialPlan(decodeCase, options);
const transport = createTransport();
transport.load(plan);
// Invoke inside the application's user-initiated play handler:
await transport.play();
const feedback = heardClass(decodeCase, 'quick', 1, 2);
```

Supported options (cell coordinates are `[row, col]` tuples):

| Mode | Required selection | Order |
| --- | --- | --- |
| sweep | None | Columns west to east, rows north to south |
| row | `row: 0` (or another valid row) | Columns west to east |
| cell | `cells: [[1, 2]]` | One selected cell |
| contrast | `cells: [[1, 2], [0, 3]]` | Two sequential cells in supplied order |
| legend | None | Six calibration steps above |

Level defaults to Quick, mode to sweep, waveform to sine. Unknown levels/modes,
unsupported waveforms, out-of-bounds/fractional coordinates, wrong selection
counts, incomplete grids, duplicate cells and malformed cells reject explicitly.
Grid storage order is not assumed. Contrast may repeat a cell; event IDs remain
unique within the plan.

Yaman can pass `makeSpatialPlan` as `makePlan` and `heardClass` into the session
factory specified in the shared contract. Majd owns connecting imports and UI
handlers. Their files have not been edited. The transport already accepts the v2
plan and returns its event IDs in snapshots. All legacy pulse/envelope behavior,
volume/mute controls, playback clocks, silent playback, revision handling and
cancellation remain in place. No Decode page has been integrated by this change.

`voices.js` also exports `continuousVoice(parameters)` and
`crackleVoice({ ...parameters, eventCount })` for reuse. Parameters are
`frequencyHz`, `gain`, optional `pan` and optional `waveform`. Helpers bound gain
and pan and reject invalid inputs; they do not allocate browser audio resources.

## Accessibility, playback and limitations

Use stereo headphones to learn west/east cues, and offer volume control and mute.
The transport uses StereoPannerNode when available, otherwise safe mono playback;
mono cannot communicate horizontal position. Pitch discrimination, hearing loss,
channel balance and device output affect interpretation. Square/sawtooth timbres
may sound louder perceptually despite identical linear gain. The 0.22 ceiling
and non-overlapping notes leave headroom; they do not set a physical listening
level or guarantee loudness across devices.

Provide text/table alternatives and optional evidence in the surrounding session.
Do not expose plan evidence as public Discovery Mode feedback: use `heardClass`.
Silence cannot distinguish missing data from measured quiet/threshold suppression;
status should be available when the experience permits evidence access. The
legend needs accompanying instructions naming each comparison. This module
does not create UI, screen-reader announcements or automatic narration.

AudioContext is created lazily. The transport resumes it in response to play,
supports the prefixed constructor fallback, and reports `audioUnavailable` with
silent synchronized playback on unavailable/refused audio. Call play directly
from a user gesture. Nodes disconnect after ending and stereo routing falls back
to mono if node construction fails. Resume/seek retain the existing convention:
only onsets at or after the current position are rescheduled, so a sustained note
already in progress is not reconstructed. Pulse count saturation sacrifices exact
auditory counting above 12; the evidence remains exact.

Tests use the official repository's synthetic fixtures and clearly synthetic
test-local calibration cases. Node tests verify plans and mock AudioContext
scheduling; physical headphone perception, browser output and assistive technology
still require manual review. No synthetic values are presented as NASA measurements.

```sh
node --test tests/spatial-sound.test.mjs
npm test
```
