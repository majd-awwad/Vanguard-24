import { cellAt, cellRect, rectCells, samplePath } from "./field.js";
import { scanSteps, strideFor } from "./mapping.js";
import { clipToRegion } from "./view.js";

// Pure selection logic for the Earth Sound Studio (no DOM): what "Play visible area" reads, how a drawn route is
// sampled, and how a sound-direction filter is applied. The UI that calls these lives in studio.js.

export const PATH_STEP_KM = 130;
export const SPEEDS = [0.5, 1, 2, 4];
export const MAX_PATH_POINTS = 40;

/** Steps of a path: equal-distance samples, each the nearest cell's real value. */
export function pathSteps(points, values, grid, options = {}) {
  return samplePath(points, { stepKm: PATH_STEP_KM, ...options }).map((sample) => {
    const cell = cellAt(grid, sample.lon, sample.lat);
    return cell ? { ...cell, lon: sample.lon, lat: sample.lat, distanceKm: sample.distanceKm, value: values[cell.index] ?? null } : { row: 0, col: 0, index: -1, lon: sample.lon, lat: sample.lat, distanceKm: sample.distanceKm, value: null, outside: true };
  });
}

/** Rectangle between two points, ordered. */
export const rectBetween = (a, b) => ({ west: Math.min(a.lon, b.lon), east: Math.max(a.lon, b.lon), south: Math.min(a.lat, b.lat), north: Math.max(a.lat, b.lat) });

/** Geographic footprint of a set of cells: the union of their real cell rectangles. */
export function cellsFrame(grid, cells) {
  if (!cells.length) return null;
  let frame = null;
  for (const { row, col } of cells) {
    const r = cellRect(grid, row, col);
    frame = frame ? { west: Math.min(frame.west, r.west), east: Math.max(frame.east, r.east), south: Math.min(frame.south, r.south), north: Math.max(frame.north, r.north) } : { ...r };
  }
  return frame;
}

/**
 * What a scan of `area` reads: only the cells whose centres are inside the part of `area` that overlaps the grid.
 * `area` is a geographic window (for "Play visible area": what the map shows right now, not hidden by any panel).
 * Returns null when no cell centre is inside. Nothing outside the window is ever read.
 */
export function areaScan(grid, area, values) {
  const rect = area ? clipToRegion(area, grid.bounds) : null;
  if (!rect) return null;
  const cells = rectCells(grid, rect);
  if (!cells.length) return null;
  const stride = strideFor(cells.length);
  const steps = scanSteps(cells, values, stride);
  return { rect, cells, stride, steps, frame: cellsFrame(grid, cells) };
}

/** At most `max` vertices, keeping the first and last: evenly spaced picks along a freehand stroke. */
export function thinPath(points, max = MAX_PATH_POINTS) {
  if (points.length <= max) return points.map((p) => ({ ...p }));
  const out = [];
  for (let i = 0; i < max; i++) out.push({ ...points[Math.round((i * (points.length - 1)) / (max - 1))] });
  return out;
}

/**
 * Sound-direction filter for the change layer: "increase" keeps only increases audible, "decrease" only decreases.
 * Filtered steps keep their time slot (silence), so the scan position still matches the map. Dust plans are untouched.
 */
export function filterDirection(plan, kind, direction = "both") {
  if (kind !== "change" || direction === "both") return plan;
  const keep = (value) => typeof value === "number" && (direction === "increase" ? value > 0 : value < 0);
  return { ...plan, events: plan.events.map((event) => (keep(event.evidence?.value) ? event : { ...event, tone: null })) };
}
