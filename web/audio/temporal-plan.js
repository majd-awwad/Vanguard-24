import { regionDetections } from "../sources/fires.js";

export const slotSeconds = 0.9;
const clamp = (value) => Math.max(0, Math.min(1, value));

export function makeTemporalPlan(data, site, waveform = "sine") {
  if (data.kind === "windowed-events") return makeFirePlan(data, site, waveform);
  const cell = data.cells.find(({ lat, lon }) => lat === site.lat && lon === site.lon);
  if (!cell) throw new RangeError("A sampled location is required.");
  const rain = data.id === "rain";
  const mappingVersion = rain ? "imerg-rain-pulse-v1" : "mur-sst-pitch-v1";
  const events = data.times.map((time, index) => {
    const sample = cell.samples[index];
    const measured = sample.value !== null;
    const pulses = rain && measured && sample.value > 0 ? Math.ceil(6 * clamp(sample.value / 60)) : 0;
    const tone = measured && (!rain || pulses) ? {
      frequencyHz: rain ? 440 : 220 * 2 ** (2 * clamp((sample.value - 12) / 20)),
      durationS: rain ? 0.07 : 0.52, attackS: 0.012, releaseS: rain ? 0.026 : 0.11,
      gain: 0.14, waveform,
      ...(rain ? { pulses: Array.from({ length: pulses }, (_, i) => 0.68 * i / pulses) } : {}),
    } : null;
    return {
      id: `${data.id}:${site.id}:${time.start}`, onsetS: index * slotSeconds, index, tone,
      evidence: { ...sample, time, site, unit: data.unit, mappingVersion },
    };
  });
  return { events, durationS: events.length * slotSeconds, mappingVersion };
}

function makeFirePlan(data, site, waveform) {
  const mappingVersion = "viirs-window-peak-frp-v1";
  const events = data.times.map((time, index) => {
    const detections = regionDetections(data, site, index);
    const peak = detections.reduce((best, row) => best === null || row.frpMW > best.frpMW ? row : best, null);
    const value = peak?.frpMW ?? null;
    const tone = peak === null ? null : {
      frequencyHz: 185, durationS: 0.16, attackS: 0.007, releaseS: 0.12,
      gain: 0.19 * Math.sqrt(clamp(value / 300)), waveform,
    };
    return {
      id: `${data.id}:${site.id}:${time.start}`, onsetS: index * slotSeconds, index, tone,
      evidence: { time, site, value, unit: "MW", peak, count: detections.length, mappingVersion },
    };
  });
  return { events, durationS: events.length * slotSeconds, mappingVersion };
}
