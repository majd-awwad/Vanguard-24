import { continuousVoice } from "../../audio/voices.js";
import { atmosphereFor } from "../../audio/atmosphere.js";

export const bandIds = ["north", "middle", "south"];

// This reference shares the production granule and extent with the Quick grid.
// Its 25 × 40 partition is separate, so select the cell containing the Quick
// cell's centre. Keep links disabled for fixtures and other sources.
export function observatoryReference(data, cell) {
  if (data.fixture || data.id !== "dust-geos-fp-20250819-1930-north-africa-med" ||
      data.source.time.start !== "2025-08-19T18:00:00Z" ||
      data.source.time.end !== "2025-08-19T21:00:00Z") return null;
  const { north, south, west, east } = data.bounds;
  if (north !== 45 || south !== 15 || west !== -20 || east !== 50 ||
      !Number.isFinite(cell.lat) || !Number.isFinite(cell.lon) ||
      cell.lat > north || cell.lat <= south || cell.lon < west || cell.lon >= east) return null;
  return {
    first: "geos-fp-dust-20250819-1930",
    row: Math.floor((north - cell.lat) / ((north - south) / 25)),
    col: Math.floor((cell.lon - west) / ((east - west) / 40)),
  };
}
const slotS = 1.5;
const noteSpacingS = 0.37;

// One Quick row per band. Equal weight per available Quick cell, including
// below-threshold values and zero. This is a comparison of grid-cell means.
export function compareDustBands({ levels: { quick } }) {
  const bands = bandIds.map((id, row) => {
    const values = quick.cells.filter(cell => cell.row === row && cell.status !== "missing")
      .map(cell => cell.value);
    return { id, count: values.length,
      mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      notes: 0 };
  });
  const ranked = bands.filter(band => band.mean !== null).sort((a, b) => a.mean - b.mean);
  let groupMean = -Infinity;
  let rank = 0;
  for (const band of ranked) {
    if (band.mean - groupMean > 1e-12) {
      rank += 1;
      groupMean = band.mean;
    }
    band.notes = rank;
  }
  return { bands, strongest: ranked.filter(band => band.notes === rank).map(band => band.id) };
}

export function buildBandPlayback(bands, { caseId, example = false, texture = false }) {
  const events = bands.flatMap(({ id, notes }, index) => {
    const row = example ? index : bandIds.indexOf(id);
    return Array.from({ length: notes || 1 }, (_, note) => ({
      id: `band-${index}-${note}`, row, col: 0, onsetS: index * slotS + note * noteSpacingS,
      tone: notes ? {
        ...continuousVoice({ frequencyHz: 440, gain: 0.14 }),
        durationS: 0.24, attackS: 0.015, releaseS: 0.045,
      } : null,
    }));
  });
  const plan = { caseId, level: "quick", mode: "contrast", mappingVersion: "dust-band-rank-v2",
    durationS: bands.length * slotS, events };
  if (texture && !example) {
    plan.texture = atmosphereFor("dust", bands.map(({ mean }, index) => ({
      onsetS: index * slotS, evidence: { value: mean },
    })), slotS);
  }
  return plan;
}

// Use the transport's position, rather than a second timer, to make the visual
// and readable cues follow the same scheduled onsets as the audio. A band is
// described when its slot is complete. Pause or reset never reveals later cues.
export function completedBandCount(bandCount, positionS) {
  return Math.min(bandCount, Math.floor(Math.max(0, positionS) / slotS));
}
