import { continuousVoice, crackleVoice } from "../audio/voices.js";
import { cellCenter, diffS, valueT } from "./field.js";

// Sound mapping "studio-v1" (documented in docs/sound-studio.md). Pure: it builds voice parameters and SpatialPlan-
// shaped plans; web/audio/transport.js owns every audio node and clock. Same place + same settings = identical sound.

export const MAPPING_VERSION = "studio-v1";
export const PITCH_LOW_HZ = 220;
export const PITCH_OCTAVES = 3; // 220 Hz .. 1760 Hz across the fixed value scale
export const TONE_GAIN = 0.16;
export const HOVER_S = 0.18;
export const CHANGE_BASE_HZ = 440;
export const MAX_SCAN_CELLS = 130; // one recording slice per step: at most about 130 steps (every 3rd cell of the whole grid, 126 cells, about 38 s)
export const SLOT = Object.freeze({ dust: 0.07, change: 0.12, path: 0.12 });

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Pitch of a dust value: log scale, fixed for the whole catalog. */
export const valueHz = (value) => PITCH_LOW_HZ * 2 ** (PITCH_OCTAVES * valueT(value));
export const HIGH_HZ = PITCH_LOW_HZ * 2 ** PITCH_OCTAVES;

/** Stereo position from longitude: west is -1 (left), east is +1 (right). Never mirrored in Arabic. */
export const lonPan = (grid, lon) => clamp((2 * (lon - grid.bounds.west)) / (grid.bounds.east - grid.bounds.west) - 1, -1, 1);

const shaped = (voice, durationS, attackS, releaseS) => ({ ...voice, durationS, attackS, releaseS });

/** A value tone: pitch carries the value, pan carries longitude, gain is constant. */
export function valueTone(value, pan, durationS = HOVER_S) {
  return shaped(continuousVoice({ frequencyHz: valueHz(value), gain: TONE_GAIN, pan }), durationS, 0.012, Math.min(0.05, durationS / 3));
}

/** A missing value is a soft click, never silence that could be mistaken for zero. */
export const missingTone = (pan) => crackleVoice({ eventCount: 1, frequencyHz: 700, gain: 0.07, pan });

/** Semitone step for a change: 1 to 12 semitones, larger change = wider step. */
export const changeSemitones = (change, norm = diffS) => 1 + Math.round(11 * Math.abs(norm(change)));

/**
 * Tones for a change between two dates: a rising two-note step for an increase, a falling step for a decrease, one
 * steady note near zero, a click for missing. Returns [{ offsetS, tone }].
 */
export function changeTones(change, pan, noteS = HOVER_S / 2, norm = diffS) {
  if (change === null || change === undefined) return [{ offsetS: 0, tone: missingTone(pan) }];
  const note = (hz, offsetS) => ({ offsetS, tone: shaped(continuousVoice({ frequencyHz: hz, gain: TONE_GAIN, pan }), noteS, 0.008, Math.min(0.03, noteS / 3)) });
  const s = norm(change);
  if (s === 0) return [note(CHANGE_BASE_HZ, 0)];
  const top = CHANGE_BASE_HZ * 2 ** (changeSemitones(change, norm) / 12);
  return s > 0 ? [note(CHANGE_BASE_HZ, 0), note(top, noteS)] : [note(top, 0), note(CHANGE_BASE_HZ, noteS)];
}

/** Tones for one cell of the current layer. */
export function cellTones(kind, value, pan, { compact = false, norm } = {}) {
  if (kind === "change") return changeTones(value, pan, compact ? 0.05 : HOVER_S / 2, norm);
  if (value === null || value === undefined) return [{ offsetS: 0, tone: missingTone(pan) }];
  return [{ offsetS: 0, tone: valueTone(value, pan, compact ? SLOT.dust * 0.9 : HOVER_S) }];
}

const planOf = (events, durationS, tag) => ({ caseId: "studio", level: "studio", mappingVersion: MAPPING_VERSION, mode: tag, durationS, events });

/** Plan for a sequence of cells (area scan, path, fingerprint). Each step is `slotS` long; `onset` offsets add a gap. */
export function sequencePlan(kind, steps, grid, { slotS, tag = "scan", startS = 0, compact = true, tonesFor = null } = {}) {
  const events = [];
  steps.forEach((step, i) => {
    const pan = lonPan(grid, step.lon ?? cellCenter(grid, step.row, step.col).lon);
    (tonesFor ? tonesFor(step, pan, { kind, slotS, compact }) : cellTones(kind, step.value, pan, { compact })).forEach(({ offsetS, tone }, j) => {
      events.push({ id: `ev-${events.length}`, onsetS: startS + i * slotS + offsetS, row: step.row, col: step.col, step: i, tone, pan, evidence: { value: step.value, mappingVersion: MAPPING_VERSION, part: j } });
    });
  });
  return planOf(events, startS + steps.length * slotS + 0.05, tag);
}

/** One-tone plan for hovering/reading a single cell. */
export function hoverPlan(kind, cell, value, grid, norm) {
  const pan = lonPan(grid, cellCenter(grid, cell.row, cell.col).lon);
  const events = cellTones(kind, value, pan, { norm }).map(({ offsetS, tone }, i) => ({ id: `ev-${i}`, onsetS: offsetS, row: cell.row, col: cell.col, step: 0, tone, evidence: { value, mappingVersion: MAPPING_VERSION } }));
  return planOf(events, events.length ? events.at(-1).onsetS + events.at(-1).tone.durationS + 0.02 : 0.1, "hover");
}

/** Stride so an area scan reads at most `max` cells: every k-th cell in both directions. */
export const strideFor = (count, max = MAX_SCAN_CELLS) => (count <= max ? 1 : Math.ceil(Math.sqrt(count / max)));

/** Scan order: west to east along each row, rows from north to south, keeping every k-th row and column. */
export function scanSteps(cells, values, k = 1) {
  if (!cells.length) return [];
  const minRow = Math.min(...cells.map((c) => c.row));
  const minCol = Math.min(...cells.map((c) => c.col));
  return cells
    .filter((c) => (c.row - minRow) % k === 0 && (c.col - minCol) % k === 0)
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((c) => ({ row: c.row, col: c.col, index: c.index, value: values[c.index] ?? null }));
}

/** Joins two plans back to back with a gap; events keep their order and are tagged with the place they belong to. */
export function joinPlans(a, b, gapS = 0.35) {
  const offset = a.durationS + gapS;
  const events = [
    ...a.events.map((e) => ({ ...e, place: "a" })),
    ...b.events.map((e) => ({ ...e, place: "b", onsetS: e.onsetS + offset, step: e.step + (a.events.at(-1)?.step ?? 0) + 1 })),
  ].map((e, i) => ({ ...e, id: `ev-${i}` }));
  return { ...a, mode: "places", events, durationS: offset + b.durationS };
}
