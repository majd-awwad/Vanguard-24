export const WORLD_BOUNDS = Object.freeze({ west: -180, south: -90, east: 180, north: 90 });
export const BASELINE_YEAR = 2012;
export const COMPARISON_YEAR = 2023;
export const REFERENCE_SOURCE_ID = "NASA-SVS-5276";

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

function rgbToHsv(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  let hue = 0;
  if (chroma > 0) {
    if (max === r) hue = 60 * (((g - b) / chroma) % 6);
    else if (max === g) hue = 60 * ((b - r) / chroma + 2);
    else hue = 60 * ((r - g) / chroma + 4);
  }
  if (hue < 0) hue += 360;
  return { hue, saturation: max === 0 ? 0 : chroma / max, value: max };
}

/**
 * Classify a pixel from the published NASA SVS rendering. This is deliberately
 * a visual classification: it never returns radiance or calls RGB a measurement.
 */
export function classifyReferencePixel({ r, g, b, a = 255 }, layer = "change") {
  const { hue, saturation, value } = rgbToHsv(r, g, b);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const visible = a > 8 && value >= 0.105;
  if (!visible) {
    return { changeDirection: "no-signal", visualMagnitude: 0, renderedBrightness: luminance };
  }

  if (layer !== "change") {
    const renderedBrightness = clamp((luminance - 0.075) / 0.925);
    return {
      changeDirection: "annual-brightness",
      visualMagnitude: renderedBrightness,
      renderedBrightness,
    };
  }

  const isPurple = saturation >= 0.14 && hue >= 248 && hue <= 338;
  const isOrange = saturation >= 0.16 && hue >= 8 && hue <= 64;
  if (isPurple) {
    return {
      changeDirection: "increase",
      visualMagnitude: clamp((saturation - 0.12) / 0.66 * (0.38 + value)),
      renderedBrightness: luminance,
    };
  }
  if (isOrange) {
    return {
      changeDirection: "decrease",
      visualMagnitude: clamp((saturation - 0.14) / 0.68 * (0.38 + value)),
      renderedBrightness: luminance,
    };
  }
  if (saturation < 0.13 && luminance >= 0.42) {
    return {
      changeDirection: "stable",
      visualMagnitude: clamp((luminance - 0.42) / 0.58),
      renderedBrightness: luminance,
    };
  }
  return { changeDirection: "no-signal", visualMagnitude: 0, renderedBrightness: luminance };
}

export function referenceSample({ longitude, latitude, pixel, layer = "change" }) {
  const visual = classifyReferencePixel(pixel, layer);
  return Object.freeze({
    longitude,
    latitude,
    baselineYear: BASELINE_YEAR,
    comparisonYear: COMPARISON_YEAR,
    baselineRadiance: null,
    comparisonRadiance: null,
    deltaRadiance: null,
    normalizedMagnitude: null,
    changeDirection: visual.changeDirection,
    quality: "reference-only",
    sourceId: REFERENCE_SOURCE_ID,
    quantitative: false,
    layer,
    renderedBrightness: visual.renderedBrightness,
    visualMagnitude: visual.visualMagnitude,
    referencePixel: Object.freeze({ r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a ?? 255 }),
  });
}

function distance(a, b) {
  const meanLat = (a.latitude + b.latitude) * Math.PI / 360;
  const dx = (b.longitude - a.longitude) * Math.cos(meanLat);
  const dy = b.latitude - a.latitude;
  return Math.hypot(dx, dy);
}

/** Resample a drawn geographic polyline to a deterministic, bounded sequence. */
export function resamplePath(points, count = 120) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length === 1 || count <= 1) return [{ ...points[0] }];
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths.at(-1) + distance(points[index - 1], points[index]));
  }
  const total = lengths.at(-1);
  if (total === 0) return [{ ...points[0] }];
  const bounded = Math.max(2, Math.min(240, Math.round(count)));
  const result = [];
  let segment = 1;
  for (let index = 0; index < bounded; index++) {
    const target = total * index / (bounded - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const low = points[segment - 1];
    const high = points[segment];
    const span = lengths[segment] - lengths[segment - 1];
    const ratio = span === 0 ? 0 : (target - lengths[segment - 1]) / span;
    result.push({
      longitude: low.longitude + (high.longitude - low.longitude) * ratio,
      latitude: low.latitude + (high.latitude - low.latitude) * ratio,
    });
  }
  return result;
}

export function serpentinePath(bounds, columns = 22, rows = 10) {
  const result = [];
  const safeColumns = Math.max(2, Math.min(48, columns));
  const safeRows = Math.max(2, Math.min(24, rows));
  for (let row = 0; row < safeRows; row++) {
    const latitude = bounds.north - (bounds.north - bounds.south) * (row + 0.5) / safeRows;
    const forward = row % 2 === 0;
    for (let column = 0; column < safeColumns; column++) {
      const offset = forward ? column : safeColumns - 1 - column;
      const longitude = bounds.west + (bounds.east - bounds.west) * (offset + 0.5) / safeColumns;
      result.push({ longitude, latitude });
    }
  }
  return result;
}

export async function loadStudioManifest(url = new URL("../assets/studio/manifest.json", import.meta.url)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Studio manifest failed: ${response.status}`);
  const manifest = await response.json();
  if (manifest.schema !== "earthpulse-studio-reference-v1" || manifest.quantitative !== false) {
    throw new Error("Unsupported or misleading studio manifest.");
  }
  return Object.freeze(manifest);
}
