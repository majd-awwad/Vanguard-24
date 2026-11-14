const profiles = {
  dust: {
    loudnessExponent: 0.35,
    bands: [
      { type: "lowpass", baseHz: 265, sweepHz: 620, gain: [0.22, 0.48] },
      { type: "bandpass", baseHz: 750, sweepHz: 1020, gain: [0.06, 0.24] },
    ],
  },
  rain: {
    loudnessExponent: 0.5,
    bands: [
      { type: "highpass", baseHz: 1600, sweepHz: 1100, gain: [0.045, 0.20] },
      { type: "bandpass", baseHz: 2300, sweepHz: 1000, gain: [0.050, 0.23] },
    ],
  },
};

export const atmosphereVersion = "earthpulse-atmosphere-v2";
const clamp = value => Math.max(0, Math.min(1, value));
const cycleS = 8;
const tau = 2 * Math.PI;
const maxNoiseSample = 0.65;

/**
 * Frames share the sonification plan clock. An inactive frame stays present
 * so that the texture fades out before its interval instead of bridging it.
 */
export function atmosphereFor(kind, events, slotSeconds, quality = () => true) {
  if (!Object.hasOwn(profiles, kind)) throw new RangeError("Unknown atmosphere.");
  if (!Number.isFinite(slotSeconds) || slotSeconds <= 0) throw new RangeError("Invalid atmosphere slot.");
  const cap = kind === "dust" ? 2.5 : 60;
  const frames = events.map(({ onsetS, evidence }) => ({
    onsetS,
    intensity: quality(evidence) && Number.isFinite(evidence.value) && evidence.value > 0
      ? clamp(evidence.value / cap) : 0,
  }));
  if (kind === "dust") {
    for (const [index, event] of events.entries()) {
      if (Number.isFinite(event.tone?.pan)) frames[index].pan = Math.max(-0.72, Math.min(0.72, event.tone.pan * 0.72));
    }
  }
  return { kind, mappingVersion: atmosphereVersion, slotSeconds, frames };
}

function pseudorandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
}

/** Procedural color and motion. The loop edges are windowed at a quiet point. */
export function noiseLoop(kind, sampleRate) {
  const dust = kind === "dust";
  const samples = new Float32Array(sampleRate * cycleS);
  const random = pseudorandom(dust ? 1279157275 : 2197293027);
  const fine = Math.exp(-tau * (dust ? 850 : 4300) / sampleRate);
  const coarse = Math.exp(-tau * (dust ? 470 : 2300) / sampleRate);
  const impactDecay = 0.987 ** (48000 / sampleRate);
  const pressureRate = 1 - Math.exp(-tau * 106 / sampleRate);
  const fadeSamples = 0.035 * sampleRate;
  let smooth = 0;
  let slow = 0;
  let impact = 0;
  let pressure = 0;
  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate;
    const noise = random();
    slow = coarse * slow + (1 - coarse) * noise;
    smooth = fine * smooth + (1 - fine) * noise;
    const edge = Math.min(1, index / fadeSamples, (samples.length - 1 - index) / fadeSamples);
    let value;
    if (dust) {
      // A continuously evolving low air bed and a quieter, dry upper edge.
      // Their modulation is artistic; no gust direction or speed is inferred.
      pressure += pressureRate * (noise - pressure);
      const gust = 0.71 + 0.22 * Math.sin(tau * time * 3 / cycleS + .4) + .13 * Math.sin(tau * time * 5 / cycleS);
      const eddy = 0.48 + .29 * Math.sin(tau * time * 9 / cycleS + 1.3);
      value = gust * (3.65 * pressure + 1.05 * (slow - pressure) + 1.05 * eddy * (smooth - slow));
    } else {
      // Overlapping, damped grains give rain a distinct wet texture. Their
      // spacing is synthesis, independent of estimated precipitation timing.
      impact *= impactDecay;
      if (noise > 1 - 410 / sampleRate) impact = Math.min(0.8, impact + 0.35);
      value = 1.65 * (0.08 + impact) * (noise - slow);
    }
    samples[index] = Math.max(-maxNoiseSample, Math.min(maxNoiseSample, value)) * edge;
  }
  return samples;
}

function ramp(parameter, from, to, start, end) {
  parameter.setValueAtTime(from, start);
  parameter.linearRampToValueAtTime(to, end);
}

/** One looping source per active plan, with automation scaled by playback speed. */
export function createAtmosphere(context, destination) {
  if (typeof context.createBufferSource !== "function" || typeof context.createBiquadFilter !== "function"
      || typeof context.createBuffer !== "function") return null;
  const buffers = new Map();
  const layer = context.createGain();
  layer.connect(destination);
  let active;

  function bufferFor(kind) {
    if (!buffers.has(kind)) {
      const samples = noiseLoop(kind, context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      buffers.set(kind, buffer);
    }
    return buffers.get(kind);
  }

  function stop() {
    if (!active) return;
    const { source, output } = active;
    active = null;
    const time = context.currentTime;
    // Isolate each run so a pause or replacement cannot change a later plan.
    output.gain.cancelScheduledValues(time);
    output.gain.setTargetAtTime(0, time, 0.006);
    source.stop(time + 0.028);
  }

  return {
    setVolume(value, immediate = false) {
      if (immediate) layer.gain.value = value;
      else layer.gain.setTargetAtTime(value, context.currentTime, 0.018);
    },
    start(texture, { origin, position, limit, speed }) {
      stop();
      const profile = profiles[texture.kind];
      const frames = texture.frames.filter(({ onsetS }) => onsetS < limit && onsetS + texture.slotSeconds > position);
      if (!profile || !frames.some(frame => frame.intensity > 0)) return;
      const source = context.createBufferSource();
      source.buffer = bufferFor(texture.kind);
      source.loop = true;
      const output = context.createGain();
      const nodes = [source, output];
      output.gain.value = 1;
      if (texture.kind === "dust" && frames.some(frame => Number.isFinite(frame.pan)) && typeof context.createStereoPanner === "function") {
        const spatial = context.createStereoPanner();
        output.connect(spatial);
        spatial.connect(layer);
        nodes.push(spatial);
        let previous = 0;
        for (const { onsetS, intensity, pan = 0 } of frames) {
          if (intensity === 0) continue;
          const start = origin + (Math.max(position, onsetS) - position) / speed;
          const end = origin + (Math.min(limit, onsetS + texture.slotSeconds) - position) / speed;
          ramp(spatial.pan, previous, pan, start, start + Math.min(0.17, (end - start) * 0.33));
          previous = pan;
        }
      } else output.connect(layer);
      for (const { type, baseHz, sweepHz, gain } of profile.bands) {
        const filter = context.createBiquadFilter();
        const envelope = context.createGain();
        filter.type = type;
        filter.Q.value = type === "bandpass" ? 0.64 : 0.30;
        source.connect(filter);
        filter.connect(envelope);
        envelope.connect(output);
        nodes.push(filter, envelope);

        envelope.gain.setValueAtTime(0, origin);
        filter.frequency.setValueAtTime(baseHz, origin);
        let lastGain = 0;
        let lastFrequency = baseHz;
        for (const [index, { onsetS, intensity }] of frames.entries()) {
          if (intensity === 0) continue;
          const startS = Math.max(position, onsetS);
          const endS = Math.min(limit, onsetS + texture.slotSeconds);
          const start = origin + (startS - position) / speed;
          const end = origin + (endS - position) / speed;
          const crossfade = Math.min(0.17, (end - start) * 0.33);
          const targetGain = intensity ** profile.loudnessExponent * (gain[0] + (gain[1] - gain[0]) * intensity);
          const targetFrequency = baseHz + intensity * sweepHz;
          ramp(envelope.gain, lastGain, targetGain, start, start + crossfade);
          ramp(filter.frequency, lastFrequency, targetFrequency, start, start + crossfade);
          const next = frames[index + 1];
          const adjacentReading = next?.intensity > 0 && Math.abs(next.onsetS - endS) < 1e-7;
          lastGain = adjacentReading ? targetGain : 0;
          lastFrequency = targetFrequency;
          if (!adjacentReading) ramp(envelope.gain, targetGain, 0, end - crossfade, end);
        }
      }
      const current = { source, output };
      source.onended = () => {
        if (active === current) active = null;
        for (const node of nodes) node.disconnect();
      };
      active = current;
      source.start(origin, position % cycleS);
      source.stop(origin + (limit - position) / speed);
    },
    stop,
    dispose() {
      stop();
      layer.disconnect();
      buffers.clear();
    },
  };
}
