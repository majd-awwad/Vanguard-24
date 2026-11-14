import { Vector3 } from "../vendor/three/three.module.min.js";
import { surfacePoint } from "./geo.js";

// The sound guide drawn on the Earth. It is driven only by snapshot.playMode and the transport state
// (status and positionS), never by a timer of its own, so it stays in step with the audio and with pause,
// replay and seek.
//
// Assumption, from the shared legend plan: six one-second calibration tones in three pairs.
//   0-2 s  left then right        -> a meridian sweeps west to east
//   2-4 s  low then high pitch    -> a latitude ring rises south to north
//   4-6 s  quiet then loud        -> the rim glow grows
export const LEGEND_SECONDS = 6;
const WINDOWS = [["sweep", 0, 2], ["pitch", 2, 4], ["loudness", 4, 6]];
const smooth = (edge0, edge1, x) => {
  const v = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return v * v * (3 - 2 * v);
};

/** What the guide should show for this snapshot, or null when the legend is not audible/visible. */
export function guideState(snapshot) {
  const transport = snapshot?.transport;
  if (snapshot?.playMode !== "legend" || !transport) return null;
  if (!["playing", "paused", "starting"].includes(transport.status)) return null;
  const position = transport.positionS;
  if (!Number.isFinite(position) || position <= 0 || position >= LEGEND_SECONDS) return null;
  const [step, from, to] = WINDOWS.find(([, start, end]) => position >= start && position < end);
  const amount = (position - from) / (to - from);
  return { step, amount, opacity: smooth(0, 0.06, amount) * smooth(0, 0.06, 1 - amount), positionS: position };
}

const temp = new Vector3();

function strip(frame, corners, { t, lift, spin }) {
  const positions = [];
  const push = ([lon, lat]) => surfacePoint(frame, lon, lat, t, lift, temp.clone(), spin).toArray(positions, positions.length);
  for (const [a, b, c, d] of corners) { push(a); push(b); push(c); push(b); push(d); push(c); }
  return new Float32Array(positions);
}

/** A thin band along one meridian between two latitudes, subdivided so it follows the unrolling surface. */
export function meridianStrip(frame, lon, latFrom, latTo, { t, lift = 0, spin = 0, halfWidthDeg = 0.35, segments = 48 }) {
  const corners = [];
  for (let k = 0; k < segments; k++) {
    const a = latFrom + ((latTo - latFrom) * k) / segments;
    const b = latFrom + ((latTo - latFrom) * (k + 1)) / segments;
    corners.push([[lon - halfWidthDeg, a], [lon + halfWidthDeg, a], [lon - halfWidthDeg, b], [lon + halfWidthDeg, b]]);
  }
  return strip(frame, corners, { t, lift, spin });
}

/** A thin band along one parallel between two longitudes. */
export function parallelStrip(frame, lat, lonFrom, lonTo, { t, lift = 0, spin = 0, halfWidthDeg = 0.35, segments = 96 }) {
  const corners = [];
  for (let k = 0; k < segments; k++) {
    const a = lonFrom + ((lonTo - lonFrom) * k) / segments;
    const b = lonFrom + ((lonTo - lonFrom) * (k + 1)) / segments;
    corners.push([[a, lat - halfWidthDeg], [b, lat - halfWidthDeg], [a, lat + halfWidthDeg], [b, lat + halfWidthDeg]]);
  }
  return strip(frame, corners, { t, lift, spin });
}
