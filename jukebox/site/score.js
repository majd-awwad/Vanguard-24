import { shareOf } from "./science.js";

export const slot = 0.53;
export const soundingSlot = slot - 0.04;
export const edgeFor = duration => Math.min(0.047, duration / 3);
export const scale = 0.24;
export const ceiling = 0.17;
export const voices = Object.freeze({
  bright: { hz: 392, pan: 0.38, overtone: 0.09 },
  dim: { hz: 261.626, pan: -0.38, overtone: 0.17 },
});

export const gainFor = share => ceiling * Math.sqrt(Math.max(0, Math.min(1, share / scale)));

export function envelopeAt(elapsed, duration) {
  const edge = edgeFor(duration);
  if (elapsed < 0 || elapsed >= duration) return 0;
  if (elapsed < edge) return elapsed / edge;
  if (elapsed >= duration - edge) return 0.8 * (duration - elapsed) / edge;
  return 1 - 0.2 * (elapsed - edge) / (duration - 2 * edge);
}

export function makeScore(regions) {
  const events = [];
  for (const region of regions) {
    for (const [index, counts] of region.bands.entries()) {
      const signals = Object.fromEntries(Object.keys(voices).map(key => {
        const fraction = shareOf(counts, key);
        return [key, { ...voices[key], fraction, gain: gainFor(fraction) }];
      }));
      events.push({ index, region, counts, signals });
    }
  }
  return events;
}
