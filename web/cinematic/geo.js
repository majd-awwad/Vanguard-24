import { Matrix4, Quaternion, Vector3 } from "../vendor/three/three.module.min.js";

// Pure geometry for the cinematic globe. Nothing here touches the DOM, WebGL or session data.
//
// The Earth is a unit sphere. The challenge region unrolls onto the plane tangent to the sphere at the
// region centre, in plate carree (x = longitude, y = latitude, in radians), which is the projection the
// Decode contract promises. At full unroll the camera looks straight down that plane through an off-axis
// frustum that is exactly the region, so every cell lands on the same rectangle as the interactive grid.

export const DEG = Math.PI / 180;
export const NEAR = 0.05;
export const FAR = 30;
export const PLANE_DISTANCE = 2.2;
export const OVERVIEW_DISTANCE = 4.4;
export const OVERVIEW_FOV = 30;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const ease = (p) => {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
};
/** How far the surface has unrolled from sphere (0) to tangent plane (1) at fly-to progress p. */
export const unroll = (p) => {
  const x = clamp01((ease(p) - 0.3) / 0.65);
  return x * x * (3 - 2 * x);
};

export function spherePoint(lon, lat, out = new Vector3(), spin = 0) {
  const lo = (lon + spin) * DEG;
  const la = lat * DEG;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

function checkBounds(bounds) {
  const { west, east, south, north } = bounds ?? {};
  if (![west, east, south, north].every(Number.isFinite) || !(west < east) || !(south < north) ||
      south < -90 || north > 90 || west < -180 || east > 180) {
    throw new RangeError("Decode bounds must be ordered, finite and non-wrapping.");
  }
  return { west, east, south, north };
}

export function createFrame(bounds) {
  const box = checkBounds(bounds);
  const lon0 = (box.west + box.east) / 2;
  const lat0 = (box.north + box.south) / 2;
  const lo = lon0 * DEG;
  const la = lat0 * DEG;
  return Object.freeze({
    bounds: Object.freeze(box),
    lon0,
    lat0,
    lonSpan: box.east - box.west,
    latSpan: box.north - box.south,
    normal: spherePoint(lon0, lat0),
    east: new Vector3(Math.cos(lo), 0, -Math.sin(lo)),
    north: new Vector3(-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)),
  });
}

export function flatPoint(frame, lon, lat, out = new Vector3()) {
  return out.copy(frame.normal)
    .addScaledVector(frame.east, (lon - frame.lon0) * DEG)
    .addScaledVector(frame.north, (lat - frame.lat0) * DEG);
}

const sphereTemp = new Vector3();
const flatTemp = new Vector3();
const normalTemp = new Vector3();

/**
 * A point on the unrolling surface, lifted along its normal so overlays clear the texture. `spin` (degrees of
 * longitude) turns only the sphere; the flat map is never spun, so it must be 0 by the time t reaches 1.
 */
export function surfacePoint(frame, lon, lat, t, lift = 0, out = new Vector3(), spin = 0) {
  spherePoint(lon, lat, sphereTemp, spin);
  flatPoint(frame, lon, lat, flatTemp);
  out.lerpVectors(sphereTemp, flatTemp, t);
  normalTemp.lerpVectors(sphereTemp, frame.normal, t).normalize();
  return out.addScaledVector(normalTemp, lift);
}

export const HERO_DISTANCE = 3.5;
export const HERO_SHIFT = 0.42;
const HERO_LON = 8;
const HERO_LAT = 18;

/** Longitude spin (degrees) left on the sphere at fly-to progress p: it unwinds to 0 before the unroll. */
export function flightSpin(spinStart, p) {
  const x = clamp01(ease(p) / 0.6);
  return spinStart * (1 - x * x * (3 - 2 * x));
}

/**
 * Off-axis frustum, at the near plane, that maps the region rectangle (seen flat from PLANE_DISTANCE) exactly onto
 * a pixel rectangle of the canvas. With no rect it is the whole canvas.
 */
export function fitFrustum(frame, rect = null, canvas = { width: 1, height: 1 }) {
  const { width, height } = canvas;
  const box = rect ?? { x0: 0, y0: 0, x1: width, y1: height };
  const ndcLeft = (2 * box.x0) / width - 1;
  const ndcRight = (2 * box.x1) / width - 1;
  const ndcTop = 1 - (2 * box.y0) / height;
  const ndcBottom = 1 - (2 * box.y1) / height;
  const scale = NEAR / PLANE_DISTANCE;
  const w = (4 * (frame.lonSpan / 2) * DEG * scale) / (ndcRight - ndcLeft);
  const h = (4 * (frame.latSpan / 2) * DEG * scale) / (ndcTop - ndcBottom);
  const sumX = (-(ndcLeft + ndcRight) * w) / 2;
  const sumY = (-(ndcTop + ndcBottom) * h) / 2;
  return { left: (sumX - w) / 2, right: (sumX + w) / 2, top: (sumY + h) / 2, bottom: (sumY - h) / 2 };
}

/**
 * World-to-camera and projection matrices at fly-to progress p. At p = 0 the camera holds the hero pose: the globe
 * is shifted to one side by `hero.shift` (NDC; negative mirrors the layout) at `hero.distance`. At p = 1 it looks
 * straight down the unrolled region through fitFrustum(rect). Without `hero` it starts from the plain overview.
 */
export function cameraMatrices(frame, p, aspect, { rect = null, canvas = null, hero = null } = {}) {
  const e = ease(p);
  const overview = hero
    ? spherePoint(HERO_LON, HERO_LAT)
    : spherePoint(frame.lon0 - 55, Math.min(60, frame.lat0 * 0.5 + 12));
  const direction = overview.clone().applyQuaternion(
    new Quaternion().slerp(new Quaternion().setFromUnitVectors(overview, frame.normal), e));
  const startDistance = hero?.distance ?? OVERVIEW_DISTANCE;
  const radius = startDistance + (1 + PLANE_DISTANCE - startDistance) * e;
  const eye = direction.multiplyScalar(radius);
  const target = frame.normal.clone().multiplyScalar(e);
  const up = new Vector3(0, 1, 0).lerp(frame.north, e).normalize();
  const world = new Matrix4().lookAt(eye, target, up).setPosition(eye);

  const tanHalf = Math.tan((OVERVIEW_FOV * DEG) / 2);
  const halfH = NEAR * tanHalf;
  const halfW = halfH * aspect;
  const shift = hero?.shift ?? 0;
  const symmetric = { left: -halfW * (1 + shift), right: halfW * (1 - shift), top: halfH, bottom: -halfH };
  const fit = fitFrustum(frame, rect, canvas ?? { width: aspect, height: 1 });
  const mix = (a, b) => a + (b - a) * e;
  return {
    view: world.clone().invert(),
    world,
    projection: new Matrix4().makePerspective(
      mix(symmetric.left, fit.left), mix(symmetric.right, fit.right),
      mix(symmetric.top, fit.top), mix(symmetric.bottom, fit.bottom), NEAR, FAR),
  };
}

export function projectToNdc({ view, projection }, point) {
  return point.clone().applyMatrix4(view).applyMatrix4(projection);
}

/** Longitude/latitude edges of one grid cell. Row 0 is north and column 0 is west. */
export function cellRect(bounds, rows, cols, row, col) {
  const dLon = (bounds.east - bounds.west) / cols;
  const dLat = (bounds.north - bounds.south) / rows;
  return {
    west: bounds.west + col * dLon,
    east: bounds.west + (col + 1) * dLon,
    north: bounds.north - row * dLat,
    south: bounds.north - (row + 1) * dLat,
  };
}

const at = (rect, u, v) => [rect.west + u * (rect.east - rect.west), rect.north - v * (rect.north - rect.south)];

/** Filled cells as triangles with 0..1 texture coordinates per cell. */
export function fillTriangles(frame, rects, { t, lift = 0, subdiv = 4 }) {
  const positions = [];
  const uvs = [];
  const corner = (rect, i, j) => {
    const [lon, lat] = at(rect, i / subdiv, j / subdiv);
    surfacePoint(frame, lon, lat, t, lift, flatTemp.clone()).toArray(positions, positions.length);
    uvs.push(i / subdiv, 1 - j / subdiv);
  };
  for (const rect of rects) {
    for (let j = 0; j < subdiv; j++) {
      for (let i = 0; i < subdiv; i++) {
        corner(rect, i, j); corner(rect, i + 1, j); corner(rect, i, j + 1);
        corner(rect, i + 1, j); corner(rect, i + 1, j + 1); corner(rect, i, j + 1);
      }
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs) };
}

// Insets are in degrees, so a ring has the same pixel width on all four sides of a cell that is wider than it
// is tall. They are capped so a ring never swallows a small (Advanced) cell.
function loop(rect, insetDeg, segments) {
  const points = [];
  const total = segments * 4;
  const insetU = Math.min(insetDeg / (rect.east - rect.west), 0.3);
  const insetV = Math.min(insetDeg / (rect.north - rect.south), 0.3);
  for (let k = 0; k <= total; k++) {
    const side = Math.min(3, Math.floor(k / segments));
    const f = (k - side * segments) / segments;
    const [u, v] = [[f, 0], [1, f], [1 - f, 1], [0, 1 - f]][side];
    points.push(at(rect, insetU + u * (1 - 2 * insetU), insetV + v * (1 - 2 * insetV)));
  }
  return points;
}

/** A hollow rectangle per cell: a strip between two inset loops. insetDeg and thicknessDeg are in degrees. */
export function ringTriangles(frame, rects, { t, lift = 0, insetDeg = 0.4, thicknessDeg = 0.5, segments = 6 }) {
  const positions = [];
  const push = ([lon, lat]) => surfacePoint(frame, lon, lat, t, lift, flatTemp.clone()).toArray(positions, positions.length);
  for (const rect of rects) {
    const outer = loop(rect, insetDeg, segments);
    const inner = loop(rect, insetDeg + thicknessDeg, segments);
    for (let k = 0; k < outer.length - 1; k++) {
      push(outer[k]); push(outer[k + 1]); push(inner[k]);
      push(outer[k + 1]); push(inner[k + 1]); push(inner[k]);
    }
  }
  return new Float32Array(positions);
}

/** Cell boundaries as line segment pairs, subdivided so they follow the surface while it unrolls. */
export function gridLines(frame, rows, cols, { t, lift = 0, segments = 24 }) {
  const positions = [];
  const { west, east, north, south } = frame.bounds;
  const push = (lon, lat) => surfacePoint(frame, lon, lat, t, lift, flatTemp.clone()).toArray(positions, positions.length);
  for (let row = 0; row <= rows; row++) {
    const lat = north - (row * (north - south)) / rows;
    for (let k = 0; k < segments; k++) {
      push(west + ((east - west) * k) / segments, lat);
      push(west + ((east - west) * (k + 1)) / segments, lat);
    }
  }
  for (let col = 0; col <= cols; col++) {
    const lon = west + (col * (east - west)) / cols;
    for (let k = 0; k < segments; k++) {
      push(lon, north - ((north - south) * k) / segments);
      push(lon, north - ((north - south) * (k + 1)) / segments);
    }
  }
  return new Float32Array(positions);
}

/**
 * Four L-shaped corner brackets per cell (two thin quads each), for selections. Sizes are in degrees so the arms
 * have the same pixel width on every side. `arm` is the arm length as a fraction of the shorter cell edge.
 */
export function bracketTriangles(frame, rects, { t, lift = 0, insetDeg = 0.7, thicknessDeg = 0.4, arm = 0.28, spin = 0 }) {
  const positions = [];
  const push = (lon, lat) => surfacePoint(frame, lon, lat, t, lift, flatTemp.clone(), spin).toArray(positions, positions.length);
  const quad = (lonA, latA, lonB, latB) => {
    push(lonA, latA); push(lonB, latA); push(lonA, latB);
    push(lonB, latA); push(lonB, latB); push(lonA, latB);
  };
  for (const rect of rects) {
    const width = rect.east - rect.west;
    const height = rect.north - rect.south;
    const inset = Math.min(insetDeg, width * 0.25, height * 0.25);
    const thick = Math.min(thicknessDeg, width * 0.1, height * 0.1);
    const length = arm * Math.min(width, height);
    // [corner longitude, inward longitude direction] and [corner latitude, inward latitude direction]
    for (const [lon, inLon] of [[rect.west + inset, 1], [rect.east - inset, -1]]) {
      for (const [lat, inLat] of [[rect.north - inset, -1], [rect.south + inset, 1]]) {
        quad(lon, lat, lon + inLon * length, lat + inLat * thick); // arm along the top or bottom edge
        quad(lon, lat, lon + inLon * thick, lat + inLat * length); // arm along the west or east edge
      }
    }
  }
  return new Float32Array(positions);
}
