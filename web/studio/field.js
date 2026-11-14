// Dust field maths for the Earth Sound Studio: fixed scales, colour ramps, cell lookup, smooth display sampling,
// rectangle/path statistics. Pure functions. Real values always come from cells; smoothing is display-only.

// ---- Fixed scales (the same for every date, so dates are comparable). See docs/sound-studio.md.
export const VALUE_MIN = 0.001;
export const VALUE_MAX = 2.5;
export const DIFF_MAX = 1.5;
export const NEAR_ZERO = 0.02;

const LOG_SPAN = Math.log(VALUE_MAX / VALUE_MIN);
/** Position of a value on the fixed log scale, 0..1. Colour and pitch both use it, so what you see is what you hear. */
export const valueT = (value) => Math.min(1, Math.max(0, Math.log(Math.max(value, VALUE_MIN) / VALUE_MIN) / LOG_SPAN));
export const tToValue = (t) => VALUE_MIN * Math.exp(t * LOG_SPAN);

/** Signed position of a change on the fixed scale, -1..1; |change| below NEAR_ZERO is exactly 0 (neutral). */
export function diffS(change) {
  const magnitude = Math.abs(change);
  if (magnitude < NEAR_ZERO) return 0;
  return Math.sign(change) * Math.min(1, Math.log1p(magnitude / NEAR_ZERO) / Math.log1p(DIFF_MAX / NEAR_ZERO));
}
/** Inverse of diffS for magnitudes (0..1 -> change). */
export const diffInverse = (s) => (s <= 0 ? 0 : NEAR_ZERO * Math.expm1(Math.min(1, s) * Math.log1p(DIFF_MAX / NEAR_ZERO)));

const hex = (value) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];
const VALUE_STOPS = [[0, hex(0x0f3b66)], [0.22, hex(0x1f9fb5)], [0.45, hex(0xe9d66b)], [0.7, hex(0xf29a2e)], [0.88, hex(0xd4451b)], [1, hex(0x7a1410)]];
const mix = (a, b, t) => a.map((component, i) => Math.round(component + (b[i] - component) * t));

function ramp(stops, t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return stops.at(-1)[1];
}

export const NEUTRAL = hex(0x8a97a6);
export const INCREASE = hex(0x9b5de5); // purple
export const DECREASE = hex(0xf28c28); // orange
export const MISSING = hex(0x6b7480);

/** [r, g, b] for a value on the dust scale. */
export const valueColor = (value) => ramp(VALUE_STOPS, valueT(value));

/** [r, g, b] for a change: purple increase, orange decrease, neutral inside the near-zero band. */
export function diffColor(change) {
  const s = diffS(change);
  if (s === 0) return NEUTRAL;
  return mix(NEUTRAL, s > 0 ? INCREASE : DECREASE, Math.min(1, 0.35 + 0.65 * Math.abs(s)));
}

/** 256-entry RGBA lookup table for the shader (single source of truth for CPU and GPU colours). */
export function rampTable(kind) {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const rgb = kind === "diff" ? diffColor(Math.sign(t - 0.5) * diffInverse(Math.abs(t - 0.5) * 2)) : valueColor(tToValue(t));
    data.set([...rgb, 255], i * 4);
  }
  return data;
}

// ---- Grid lookup (row 0 is north, column 0 is west; geometry computed from the grid's own bounds).
export function cellAt(grid, lon, lat) {
  const { bounds, rows, cols } = grid;
  if (!(lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north)) return null;
  const col = Math.min(cols - 1, Math.floor(((lon - bounds.west) / (bounds.east - bounds.west)) * cols));
  const row = Math.min(rows - 1, Math.floor(((bounds.north - lat) / (bounds.north - bounds.south)) * rows));
  return { row, col, index: row * cols + col };
}

export function cellRect(grid, row, col) {
  const { bounds, rows, cols } = grid;
  const dLat = (bounds.north - bounds.south) / rows;
  const dLon = (bounds.east - bounds.west) / cols;
  return { north: bounds.north - row * dLat, south: bounds.north - (row + 1) * dLat, west: bounds.west + col * dLon, east: bounds.west + (col + 1) * dLon };
}

export function cellCenter(grid, row, col) {
  const r = cellRect(grid, row, col);
  return { lon: (r.west + r.east) / 2, lat: (r.north + r.south) / 2 };
}

/**
 * Per-cell position on the colour scale (0..1; for changes 0.5 is no change) and a missing mask. Missing cells borrow
 * the mean of their valid neighbours here so the smooth field never bleeds toward zero; the mask hides them.
 */
export function layerT(values, grid, mode) {
  const { rows, cols } = grid;
  const t = new Float32Array(rows * cols);
  const mask = new Uint8Array(rows * cols);
  const convert = mode === "diff" ? (v) => 0.5 + 0.5 * diffS(v) : valueT;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null || values[i] === undefined) mask[i] = 255; else t[i] = convert(values[i]);
  }
  for (let i = 0; i < values.length; i++) {
    if (!mask[i]) continue;
    const row = Math.floor(i / cols);
    const col = i % cols;
    let sum = 0;
    let count = 0;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= rows || c >= cols || mask[r * cols + c]) continue;
      sum += t[r * cols + c];
      count++;
    }
    t[i] = count ? sum / count : mode === "diff" ? 0.5 : 0;
  }
  return { t, mask };
}

/** Uniform cubic B-spline weights for fraction x in [0, 1). Smooth, no overshoot, no visible cell edges. */
export const splineWeights = (x) => [(1 - x) ** 3 / 6, (3 * x ** 3 - 6 * x * x + 4) / 6, (-3 * x ** 3 + 3 * x * x + 3 * x + 1) / 6, x ** 3 / 6];

/** Display-only smooth value of the colour-scale position at a point (the CPU twin of the shader). */
export function smoothT(t, grid, lon, lat) {
  const { bounds, rows, cols } = grid;
  const gx = ((lon - bounds.west) / (bounds.east - bounds.west)) * cols - 0.5;
  const gy = ((bounds.north - lat) / (bounds.north - bounds.south)) * rows - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const wx = splineWeights(gx - x0);
  const wy = splineWeights(gy - y0);
  let sum = 0;
  for (let j = 0; j < 4; j++) {
    const row = Math.min(rows - 1, Math.max(0, y0 - 1 + j));
    for (let i = 0; j >= 0 && i < 4; i++) sum += t[row * cols + Math.min(cols - 1, Math.max(0, x0 - 1 + i))] * wx[i] * wy[j];
  }
  return sum;
}

/** Cells whose centres fall inside a rectangle. */
export function rectCells(grid, rect) {
  const cells = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const c = cellCenter(grid, row, col);
      if (c.lon >= rect.west && c.lon <= rect.east && c.lat >= rect.south && c.lat <= rect.north) cells.push({ row, col, index: row * grid.cols + col });
    }
  }
  return cells;
}

/** min/max/mean of the real values of `cells` and the number missing. Missing values are counted, never averaged. */
export function summarize(values, cells) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let valid = 0;
  let missing = 0;
  for (const { index } of cells) {
    const value = values[index];
    if (value === null || value === undefined || !Number.isFinite(value)) { missing++; continue; }
    valid++;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { count: cells.length, valid, missing, min: valid ? min : null, max: valid ? max : null, mean: valid ? sum / valid : null };
}

// ---- Paths
const RAD = Math.PI / 180;
/** Great-circle distance in kilometres. */
export function distanceKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Samples a polyline at equal distance (linear in lon/lat between vertices), at most `maxSamples` points. */
export function samplePath(points, { stepKm = 130, maxSamples = 160 } = {}) {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], distanceKm: 0 }];
  const legs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) { const length = distanceKm(points[i - 1], points[i]); legs.push(length); total += length; }
  const count = Math.max(2, Math.min(maxSamples, Math.round(total / stepKm) + 1));
  const samples = [];
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    let walked = 0;
    let leg = 0;
    while (leg < legs.length - 1 && walked + legs[leg] < target) { walked += legs[leg]; leg++; }
    const t = legs[leg] === 0 ? 0 : Math.min(1, (target - walked) / legs[leg]);
    samples.push({ lon: points[leg].lon + (points[leg + 1].lon - points[leg].lon) * t, lat: points[leg].lat + (points[leg + 1].lat - points[leg].lat) * t, distanceKm: target });
  }
  return samples;
}
