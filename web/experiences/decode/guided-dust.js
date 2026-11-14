import { continuousVoice } from "../../audio/voices.js";

export const bandIds = ["north", "middle", "south"];
const slotS = 1.35;

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

export function buildBandPlayback(bands, { caseId, example = false }) {
  const events = bands.flatMap(({ id, notes }, index) => {
    const row = example ? index : bandIds.indexOf(id);
    return Array.from({ length: notes || 1 }, (_, note) => ({
      id: `band-${index}-${note}`, row, col: 0, onsetS: index * slotS + note * 0.34,
      tone: notes ? {
        ...continuousVoice({ frequencyHz: 440, gain: 0.14 }),
        durationS: 0.24, attackS: 0.015, releaseS: 0.045,
      } : null,
    }));
  });
  return { caseId, level: "quick", mode: "contrast", mappingVersion: "dust-band-rank-v1",
    durationS: bands.length * slotS, events };
}
