import { rectCells, summarize } from "./field.js";
import { scanSteps, sequencePlan, strideFor } from "./mapping.js";

// Comparison logic (no DOM): compare two dates (published comparison, or computed only inside one model-build group,
// otherwise unavailable with the catalog's reason) and compare two places by their sound fingerprints.
// The UI that calls these lives in studio.js.

export const DEFAULT_REASON = "Different literal model build labels; numerical build equivalence unverified.";
export const FINGERPRINT_CELLS = 24;

const groupOf = (catalog, id) => catalog.compatibilityGroups.find((g) => g.snapshotIds.includes(id))?.modelSource ?? null;

/**
 * What may be shown for a pair of dates. Earlier date first. Never invents a comparison across model builds.
 * Returns { status: "same" | "published" | "computed" | "unavailable", first, second, id?, reason? }.
 */
export function resolveComparison(catalog, idA, idB) {
  if (idA === idB) return { status: "same" };
  const dates = Object.fromEntries(catalog.snapshots.map((s) => [s.id, s.date]));
  const [first, second] = dates[idA] <= dates[idB] ? [idA, idB] : [idB, idA];
  const published = catalog.comparisons.find((p) => p.first === first && p.second === second);
  if (published) return { status: "published", first, second, id: published.id };
  if (groupOf(catalog, first) && groupOf(catalog, first) === groupOf(catalog, second)) return { status: "computed", first, second };
  const known = catalog.unavailableComparisons.find((p) => p.first === first && p.second === second);
  return { status: "unavailable", first, second, reason: known?.reason ?? DEFAULT_REASON };
}

/** A place is one cell or one rectangle; its summary uses the real values of the current layer. */
export function placeSummary(place, values, grid) {
  if (!place) return null;
  if (place.type === "cell") return { ...summarize(values, [place.cell]), kind: "cell" };
  return { ...summarize(values, rectCells(grid, place.rect)), kind: "area" };
}

/** The cells a place's fingerprint plays: a cell three times, an area up to 24 of its cells west to east. */
export function fingerprintSteps(place, values, grid) {
  if (place.type === "cell") {
    const step = { row: place.cell.row, col: place.cell.col, index: place.cell.index, value: values[place.cell.index] ?? null };
    return [step, step, step];
  }
  const cells = rectCells(grid, place.rect);
  return scanSteps(cells, values, strideFor(cells.length, FINGERPRINT_CELLS));
}

/** Sound fingerprint of a place: a cell repeats its tone three times; an area plays up to 24 of its cells west to east. */
export function fingerprintPlan(place, values, kind, grid) {
  const steps = fingerprintSteps(place, values, grid);
  return place.type === "cell"
    ? sequencePlan(kind, steps, grid, { slotS: 0.24, tag: "fingerprint", compact: false })
    : sequencePlan(kind, steps, grid, { slotS: 0.1, tag: "fingerprint" });
}
