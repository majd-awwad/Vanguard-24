export const mappingVersion = "gedi-relative-return-v1";
export const tone = Object.freeze({
  frequencyHz: 440, durationS: 0.095, attackS: 0.009, releaseS: 0.026,
});

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

export function bandEvidence(data, observation, band) {
  const first = data.edges.indexOf(band[0]);
  const end = data.edges.indexOf(band[1]);
  if (first < 0 || end <= first) throw new RangeError("Invalid GEDI height band.");
  const samples = observation.profile.slice(first, end);
  const missing = samples.includes(null);
  const total = missing ? null : Math.min(1, round(samples.reduce((sum, value) => sum + value, 0), 10));
  const detected = observation.positive.some((index) => index >= first && index < end);
  return {
    caseId: data.id, observationId: observation.id, band, value: total, unit: "fraction",
    evidenceClass: "DERIVED",
    observationStatus: missing ? "missing" : detected ? "measured" : "below_threshold",
  };
}

export function makePlan(data, selection) {
  const { axis, shotId, bandM } = selection;
  const observation = data.footprints.find((row) => row.id === shotId);
  if (!observation || !["vertical", "horizontal"].includes(axis)) throw new RangeError("Invalid GEDI selection.");
  const event = (row, band, onsetS) => {
    const evidence = bandEvidence(data, row, band);
    return {
      id: `${row.id}:${band.join(":")}`, onsetS: round(onsetS, 9), evidence,
      tone: evidence.observationStatus === "measured"
        ? { ...tone, gain: round(0.32 * Math.sqrt(evidence.value), 9) } : null,
    };
  };
  const events = axis === "horizontal"
    ? data.footprints.map((row) => event(row, bandM, row.distance / 65))
    : data.edges.slice(0, -1).map((height, index) =>
      event(observation, [height, data.edges[index + 1]], index * 0.13));
  const last = events.at(-1);
  return {
    caseId: data.id, axis, mappingVersion, events,
    durationS: last.onsetS + (last.tone?.durationS ?? 0),
  };
}
