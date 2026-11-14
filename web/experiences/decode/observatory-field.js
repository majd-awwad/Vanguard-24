import { continuousVoice } from "../../audio/voices.js";

export const opticalDepthLimit = 2.5;
const levelColors = ["#20304b", "#405786", "#5e80ab", "#7c9ea3", "#c6b575", "#ffdb97"];
const changeColors = ["#71b8f4", "#436799", "#314763", "#2e3c49", "#6d4a36", "#af6945", "#f0ae77"];

export function compatibleDates(entries, first) {
  return entries.filter(entry => entry.id !== first.id && entry.modelSource === first.modelSource);
}

// Asset validation happens before this projection. Keep failed fetches separate
// from null cells; null is an actual, verified missing reading.
export function cellHistory(entries, loaded, { modelSource, index }) {
  return entries.map(entry => {
    const snapshot = loaded.get(entry.id);
    return {
      entry,
      value: snapshot?.values[index] ?? null,
      available: Boolean(snapshot),
      comparable: entry.modelSource === modelSource,
    };
  });
}

// Dots are placed at the actual UTC interval centers, without connecting lines.
// Keep the time domain even for failed, missing, or incompatible snapshots.
export function historyPlot(samples) {
  const times = samples.map(({ entry }) => Date.parse(entry.time.center));
  const start = Math.min(...times);
  const end = Math.max(...times);
  const points = samples.filter(sample => sample.comparable && sample.available && sample.value !== null);
  const max = Math.max(opticalDepthLimit, Math.ceil(Math.max(...points.map(({ value }) => value)) * 2) / 2);
  return {
    start, end, max,
    points: points.map(sample => ({
      ...sample,
      x: start === end ? .5 : (Date.parse(sample.entry.time.center) - start) / (end - start),
      y: sample.value / max,
    })),
  };
}

export function fieldColor(value, difference) {
  if (value === null) return null;
  const colors = difference ? changeColors : levelColors;
  const scaled = Math.sign(value) * Math.sqrt(Math.min(Math.abs(value) / opticalDepthLimit, 1));
  const fraction = difference ? (scaled + 1) / 2 : scaled;
  const bin = Math.min(colors.length - 1, Math.max(0, Math.floor(fraction * colors.length)));
  return colors[bin];
}

export function fieldPalette(difference) {
  return [...(difference ? changeColors : levelColors)];
}

export function moveCell({ row, col }, key, { rows, cols }) {
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (key === "Home") return { row, col: 0 };
  if (key === "End") return { row, col: cols - 1 };
  const [dy, dx] = moves[key] ?? [0, 0];
  return {
    row: Math.max(0, Math.min(rows - 1, row + dy)),
    col: Math.max(0, Math.min(cols - 1, col + dx)),
  };
}

export function cellSound({ value, row, col }, difference) {
  if (value === null) return [];
  const bounded = Math.min(Math.abs(value) / opticalDepthLimit, 1);
  const voice = frequencyHz => ({
    ...continuousVoice({ frequencyHz, gain: 0.14 }),
    durationS: .35, attackS: .025, releaseS: .07,
  });
  // Level: one tone starting at 180 Hz. Change: a fixed reference followed
  // by a directional interval from 440 Hz. The offset makes small nonzero
  // differences distinguishable from zero without encoding the amount in Hz.
  const pitches = difference
    ? [440, 440 * 2 ** (Math.sign(value) * (0.16 + bounded * 0.84))]
    : [180 * 2 ** (2 * bounded)];
  return pitches.map((frequencyHz, index) => ({
    id: `observatory-note-${index}`, row, col, onsetS: index * .48, tone: voice(frequencyHz),
  }));
}
