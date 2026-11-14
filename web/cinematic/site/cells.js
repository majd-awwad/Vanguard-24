// Pure helpers shared by every site page. Nothing here touches the DOM, and nothing is hardcoded to one case:
// cell names, bounds and sizes are always computed from a case's bounds and grid.
// Naming: the letter is the row counted from the north (A = northernmost); the number is the column counted from
// the west (1 = westernmost). This holds in Arabic too: geography never mirrors.

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const cellId = (row, col) => LETTERS[row] + String(col + 1);

export function parseCellId(id) {
  const match = /^([A-Z])(\d+)$/.exec(String(id));
  if (!match) return null;
  return { row: LETTERS.indexOf(match[1]), col: Number(match[2]) - 1 };
}

/** Bounds of one cell. Row 0 is the northernmost, column 0 the westernmost. */
export function cellBounds(bounds, { rows, cols }, row, col) {
  const dLat = (bounds.north - bounds.south) / rows;
  const dLon = (bounds.east - bounds.west) / cols;
  return {
    north: bounds.north - row * dLat,
    south: bounds.north - (row + 1) * dLat,
    west: bounds.west + col * dLon,
    east: bounds.west + (col + 1) * dLon,
  };
}

export function cellSize(bounds, { rows, cols }) {
  return { lat: (bounds.north - bounds.south) / rows, lon: (bounds.east - bounds.west) / cols };
}

/** 5 -> "5", 8.75 -> "8.75", 0.1+0.2 -> "0.3": no trailing zeros, no float noise. */
export const trimNumber = (value, digits = 4) => String(Number(value.toFixed(digits)));

export const formatLat = (lat) => trimNumber(Math.abs(lat)) + "°" + (lat < 0 ? "S" : "N");
export const formatLon = (lon) => trimNumber(Math.abs(lon)) + "°" + (lon < 0 ? "W" : "E");

/** "2025-08-19T18:00:00Z" -> "18:00 UTC" */
export function formatUtcTime(iso) {
  const date = new Date(iso);
  return String(date.getUTCHours()).padStart(2, "0") + ":" + String(date.getUTCMinutes()).padStart(2, "0") + " UTC";
}

export function formatUtcDate(iso, language = "en") {
  const locale = language === "ar" ? "ar-u-nu-latn" : "en-US";
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", dateStyle: "long" }).format(new Date(iso));
}

/** Midpoint and length of a time window, both derived from the case's own start and end. */
export function windowStats({ start, end }) {
  const a = Date.parse(start);
  const b = Date.parse(end);
  return { hours: (b - a) / 3_600_000, centre: new Date((a + b) / 2).toISOString() };
}

/** Fraction of the beam that survives a vertical path through a column of optical depth `tau`. */
export const transmission = (tau) => Math.exp(-tau);

/**
 * CSS background sizing that crops an equirectangular (plate carrée) world texture to `bounds`, so the crop is
 * geographically exact. Percentages are what `background-size`/`background-position` expect.
 */
export function textureCrop(bounds) {
  const wFrac = (bounds.east - bounds.west) / 360;
  const hFrac = (bounds.north - bounds.south) / 180;
  const xFrac = (bounds.west + 180) / 360;
  const yFrac = (90 - bounds.north) / 180;
  return {
    sizeX: 100 / wFrac,
    sizeY: 100 / hFrac,
    posX: wFrac >= 1 ? 0 : (xFrac / (1 - wFrac)) * 100,
    posY: hFrac >= 1 ? 0 : (yFrac / (1 - hFrac)) * 100,
    aspect: (bounds.east - bounds.west) / (bounds.north - bounds.south),
  };
}

export function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (key in values ? String(values[key]) : "{" + key + "}"));
}

/** Like fill(), but in Arabic isolates each value left-to-right so numbers and Latin codes keep their order. */
export function fillIso(template, values, language) {
  const out = {};
  for (const [key, value] of Object.entries(values)) out[key] = language === "ar" && typeof value !== "object" ? "\u2066" + value + "\u2069" : value;
  return fill(template, out);
}
