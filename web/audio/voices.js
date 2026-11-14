// Pure voice parameters; audio node creation and scheduling belong to transport.
export const GAIN_CEILING = 0.22;
export const MAX_PULSES = 12;
export const CRACKLE_DURATION_S = 0.028;

function base({ frequencyHz, gain, pan = 0, waveform = "sine" }) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0 || !Number.isFinite(gain) ||
      !Number.isFinite(pan) || !["sine", "triangle", "square", "sawtooth"].includes(waveform)) {
    throw new TypeError("Invalid voice parameters.");
  }
  return { frequencyHz, gain: Math.max(0, Math.min(GAIN_CEILING, gain)),
    waveform, pan: Math.max(-1, Math.min(1, pan)) };
}

export function continuousVoice(parameters) {
  return { ...base(parameters), durationS: 0.56, attackS: 0.025, releaseS: 0.09, voice: "tone" };
}

export function crackleVoice({ eventCount = 4, ...parameters }) {
  if (!Number.isSafeInteger(eventCount) || eventCount < 0) throw new RangeError("Invalid eventCount.");
  const count = Math.min(MAX_PULSES, eventCount);
  // Stratified deterministic timing: first pulse at zero; subsequent pulses
  // alternate 0.15 / 0.35 of their slot. No random generator or mutable seed.
  const pulses = Array.from({ length: count }, (_, index) =>
    index === 0 ? 0 : (index + (index % 2 ? 0.15 : 0.35)) * 0.5 / count);
  return { ...base(parameters), durationS: CRACKLE_DURATION_S,
    attackS: 0.003, releaseS: 0.016, voice: "crackle", pulses };
}
