import { CALM_MPS } from "./sonify.js";

// Dry dates: a date with almost no signal (rain below 0.1 mm/h, or calm wind) is explained, and the wettest real dates
// are suggested. Pure functions over the real values; nothing here is invented or smoothed.

/** The smallest value that counts as signal, and the share of cells that must reach it for a date to count as having any. */
export const SIGNAL = Object.freeze({
  rainfall: Object.freeze({ floor: 0.1, minShare: 0.1 }),
  wind: Object.freeze({ floor: CALM_MPS, minShare: 0.1 }),
});

/** Share of valid cells at or above the floor. */
export function signalShare(values, floor) {
  let valid = 0;
  let count = 0;
  for (const v of values) { if (typeof v === "number" && Number.isFinite(v)) { valid += 1; if (v >= floor) count += 1; } }
  return { count, valid, share: valid ? count / valid : 0 };
}

/**
 * Null when the selected date has enough signal (or the phenomenon has no floor); otherwise the share and up to `n`
 * suggested dates, the ones with the most cells at or above the floor, each better than the selected date.
 */
export function dryNotice({ phenomenon, list, currentId, exclude = [], n = 3 }) {
  const rule = SIGNAL[phenomenon];
  if (!rule) return null;
  const current = list.find((s) => s.id === currentId);
  if (!current) return null;
  const now = signalShare(current.values, rule.floor);
  if (now.share >= rule.minShare) return null;
  const suggestions = list
    .filter((s) => s.id !== currentId && !exclude.includes(s.date))
    .map((s) => ({ id: s.id, date: s.date, ...signalShare(s.values, rule.floor) }))
    .filter((s) => s.share > now.share)
    .sort((a, b) => b.share - a.share || a.date.localeCompare(b.date))
    .slice(0, n);
  return { share: now.share, count: now.count, floor: rule.floor, suggestions };
}

/** True when a single cell is below the signal floor (a dry cell). Missing values are not "dry". */
export function isDryValue(phenomenon, value) {
  const rule = SIGNAL[phenomenon];
  return Boolean(rule) && typeof value === "number" && Number.isFinite(value) && value < rule.floor;
}
