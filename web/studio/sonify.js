import { continuousVoice } from "../audio/voices.js";
import { normalizer, PHENOMENA } from "./datasets.js";
import { lonPan, missingTone, TONE_GAIN } from "./mapping.js";

// Sonification "earthmap-v1" (docs/earth-map/SONIFICATION_MAPPING.md). Pure: value -> normalised 0..1 on the fixed scale
// of the phenomenon -> voice parameters. web/audio/transport.js owns all audio nodes and clocks. Loudness never carries
// the value: gain is constant, and the meaning lives in pulse rate, pitch or brightness (which have a text explanation).

export const MAPPING_VERSION = "earthmap-v1";
export const HOVER_EVENT_S = 0.9;
export const MAX_PULSES = 24;
export const CALM_MPS = 0.3;
export const DRY_MM = 0.002;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const pulseOffsets = (rate, eventS) => {
  const count = clamp(Math.floor(rate * eventS), 1, MAX_PULSES);
  return Array.from({ length: count }, (_, k) => Number((k / rate).toFixed(4))).filter((t) => t < eventS);
};
const shaped = (frequencyHz, pan, waveform, durationS, attackS, releaseS, extra = {}) =>
  ({ ...continuousVoice({ frequencyHz, gain: TONE_GAIN, pan, waveform }), durationS, attackS, releaseS, ...extra });

/** Numbers behind the sound of one cell (also shown in the info panel). null `value` is missing. */
export function soundParams(phenomenon, info) {
  const spec = PHENOMENA[phenomenon];
  const value = info.value;
  if (value === null || value === undefined) return { missing: true };
  const n = normalizer(spec)(value);
  if (phenomenon === "rainfall") return value <= DRY_MM ? { n, silent: true } : { n, rate: 1.5 + 12.5 * n, frequencyHz: 520, waveform: "triangle" };
  if (phenomenon === "dust") return { n, rate: 3 + 21 * n, frequencyHz: 900 * 2 ** (1.5 * n), waveform: n < 1 / 3 ? "triangle" : n < 2 / 3 ? "square" : "sawtooth" };
  // wind: speed -> pulse/tremolo rate; east-west component of the flow -> pan; calm is centred.
  const calm = value < CALM_MPS || info.direction === null || info.direction === undefined || !Number.isFinite(info.u) || !Number.isFinite(info.v);
  const east = calm ? 0 : clamp(info.u / Math.max(1e-9, Math.hypot(info.u, info.v)), -1, 1);
  return { n, rate: 2 + 14 * n, frequencyHz: 180, waveform: "triangle", pan: east, calm };
}

/** Tones for one cell: [{ offsetS, tone }]. Rainfall with no rain is silent; missing is a soft click. */
export function valueTones(phenomenon, info, { pan = 0, eventS = HOVER_EVENT_S } = {}) {
  const p = soundParams(phenomenon, info);
  if (p.missing) return [{ offsetS: 0, tone: missingTone(pan) }];
  if (p.silent) return [];
  const where = p.pan ?? pan;
  const offsets = pulseOffsets(p.rate, eventS);
  const pulseS = phenomenon === "rainfall" ? 0.035 : phenomenon === "dust" ? 0.022 : 0.07;
  return [{ offsetS: 0, tone: shaped(p.frequencyHz, where, p.waveform, pulseS, 0.004, Math.min(0.02, pulseS / 2), { voice: "pulse", pulses: offsets }) }];
}

/** The info a cell contributes to its sound: the measure value, plus wind components when the phenomenon is wind. */
export function cellInfo(phenomenon, snapshot, index) {
  const m = snapshot.measures;
  const info = { value: snapshot.values[index] ?? null };
  if (phenomenon === "wind") { info.u = m.uMps?.[index] ?? null; info.v = m.vMps?.[index] ?? null; info.direction = m.directionFromDegrees?.[index] ?? null; }
  return info;
}

/** A one-event plan for hovering or reading a cell. */
export function hoverPlan(phenomenon, snapshot, cell, grid, cellLon, { eventS = HOVER_EVENT_S } = {}) {
  const tones = valueTones(phenomenon, cellInfo(phenomenon, snapshot, cell.index), { pan: lonPan(grid, cellLon), eventS });
  const events = tones.map(({ offsetS, tone }, i) => ({ id: `ev-${i}`, onsetS: offsetS, row: cell.row, col: cell.col, step: 0, tone, evidence: { mappingVersion: MAPPING_VERSION, index: cell.index } }));
  return { caseId: "earthmap", level: "earthmap", mappingVersion: MAPPING_VERSION, mode: "hover", durationS: eventS + 0.05, events };
}

/** Per-step tones for scans, paths and fingerprints (shorter events so a scan stays quick). */
export function stepTones(phenomenon, snapshot, step, pan, eventS) {
  return valueTones(phenomenon, cellInfo(phenomenon, snapshot, step.index), { pan, eventS });
}
