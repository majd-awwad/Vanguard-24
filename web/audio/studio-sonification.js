const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

export const STUDIO_MAPPING_VERSION = "studio-reference-v1";

export function mapStudioSample(sample, { pan = 0, mode = "both" } = {}) {
  const magnitude = clamp(sample?.visualMagnitude ?? 0);
  const direction = sample?.changeDirection ?? "no-signal";
  const excluded = (mode === "increase" && direction !== "increase") ||
    (mode === "decrease" && direction !== "decrease");
  if (excluded || direction === "no-signal") {
    return Object.freeze({ audible: false, direction, gain: 0, frequencyHz: null, pan: clamp(pan, -0.42, 0.42), mappingVersion: STUDIO_MAPPING_VERSION });
  }
  if (direction === "annual-brightness") {
    return Object.freeze({
      audible: magnitude > 0.015,
      direction,
      frequencyHz: 196 * 2 ** (1.85 * magnitude),
      gain: magnitude > 0.015 ? 0.028 + 0.13 * Math.sqrt(magnitude) : 0,
      harmonicGain: 0.18,
      filterHz: 900 + 3300 * magnitude,
      pan: clamp(pan, -0.42, 0.42),
      mappingVersion: STUDIO_MAPPING_VERSION,
    });
  }
  if (direction === "stable") {
    return Object.freeze({
      audible: magnitude > 0.28,
      direction,
      frequencyHz: 261.626,
      gain: magnitude > 0.28 ? 0.018 + 0.025 * magnitude : 0,
      harmonicGain: 0.08,
      filterHz: 1250,
      pan: clamp(pan, -0.42, 0.42),
      mappingVersion: STUDIO_MAPPING_VERSION,
    });
  }
  const increase = direction === "increase";
  return Object.freeze({
    audible: magnitude > 0.025,
    direction,
    frequencyHz: increase ? 349.228 * 2 ** (0.92 * magnitude) : 196 * 2 ** (-0.5 * magnitude),
    gain: magnitude > 0.025 ? 0.028 + 0.15 * Math.sqrt(magnitude) : 0,
    harmonicGain: increase ? 0.34 : 0.22,
    filterHz: increase ? 1600 + 3200 * magnitude : 900 - 420 * magnitude,
    pan: clamp(pan, -0.42, 0.42),
    mappingVersion: STUDIO_MAPPING_VERSION,
  });
}

function defaultContext() {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Context) throw new Error("Web Audio unavailable");
  return new Context();
}

export function createStudioSonifier({ createContext = defaultContext } = {}) {
  let context;
  let master;
  let panner;
  let filter;
  let fundamental;
  let harmonic;
  let fundamentalGain;
  let harmonicGain;
  let enabled = false;
  let volume = 0.72;
  let mode = "both";

  function target(parameter, value, time = 0.032) {
    parameter.cancelScheduledValues(context.currentTime);
    parameter.setTargetAtTime(value, context.currentTime, time);
  }

  async function enable() {
    if (!context) {
      context = createContext();
      master = context.createGain();
      panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
      filter = context.createBiquadFilter();
      fundamental = context.createOscillator();
      harmonic = context.createOscillator();
      fundamentalGain = context.createGain();
      harmonicGain = context.createGain();
      fundamental.type = "triangle";
      harmonic.type = "sine";
      fundamentalGain.gain.value = 0;
      harmonicGain.gain.value = 0;
      filter.type = "lowpass";
      filter.Q.value = 0.72;
      fundamental.connect(fundamentalGain);
      harmonic.connect(harmonicGain);
      fundamentalGain.connect(filter);
      harmonicGain.connect(filter);
      if (panner) {
        filter.connect(panner);
        panner.connect(master);
      } else filter.connect(master);
      master.connect(context.destination);
      master.gain.value = volume;
      fundamental.start();
      harmonic.start();
    }
    if (context.state !== "running") await context.resume();
    enabled = context.state === "running";
    if (!enabled) throw new Error("Audio context did not start");
  }

  function update(sample, options = {}) {
    if (!enabled || !context) return mapStudioSample(sample, { ...options, mode });
    const mapped = mapStudioSample(sample, { ...options, mode });
    if (!mapped.audible) {
      target(fundamentalGain.gain, 0, 0.024);
      target(harmonicGain.gain, 0, 0.024);
      return mapped;
    }
    fundamental.type = mapped.direction === "decrease" ? "sawtooth" : "triangle";
    target(fundamental.frequency, mapped.frequencyHz, 0.028);
    target(harmonic.frequency, mapped.frequencyHz * 2, 0.028);
    target(fundamentalGain.gain, mapped.gain, 0.024);
    target(harmonicGain.gain, mapped.gain * mapped.harmonicGain, 0.024);
    target(filter.frequency, mapped.filterHz, 0.04);
    if (panner) target(panner.pan, mapped.pan, 0.035);
    return mapped;
  }

  function stop() {
    if (!context) return;
    target(fundamentalGain.gain, 0, 0.018);
    target(harmonicGain.gain, 0, 0.018);
  }

  function setVolume(next) {
    if (!Number.isFinite(next)) return;
    volume = clamp(next);
    if (master) target(master.gain, volume, 0.02);
  }

  function setMode(next) {
    if (!["both", "increase", "decrease"].includes(next)) return;
    mode = next;
  }

  async function dispose() {
    if (!context) return;
    stop();
    fundamental.stop(context.currentTime + 0.08);
    harmonic.stop(context.currentTime + 0.08);
    await context.close();
    context = undefined;
    enabled = false;
  }

  return { enable, update, stop, setMode, setVolume, dispose, get enabled() { return enabled; } };
}
