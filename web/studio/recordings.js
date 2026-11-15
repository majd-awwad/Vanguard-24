import { fileFor } from "./ambience-core.js";

// The Studio's sound: the user's recordings, chosen by the REAL value (low / mid / high), never synthesized tones.
//  - hold(): one level loops under the cursor (two overlapping sources, 0.5 s loop crossfade), level changes crossfade
//    over 400 ms, at most two levels are ever alive and never two at full volume.
//  - slice(): one short piece (about 0.7 s, 80 ms fades) for a step of an area scan, a path or an Echo series.
//  - Stereo pan follows longitude (west left, east right). One volume. Starts only after unlock() in a user gesture.

export const CROSSFADE_S = 0.5;
export const LEVEL_FADE_S = 0.4;
export const SLICE_S = 0.7;
export const SLICE_FADE_S = 0.08;
export const SLICE_GAIN = 0.6;
export const SPEECH_DUCK = 0.35;
const SETTLE_MS = 140; // quick pointer movement does not flap between recordings

export function createRecordings({
  baseUrl, createContext = () => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(), fetchImpl = (...a) => fetch(...a),
  reduced = () => false, setTimer = (f, ms) => setTimeout(f, ms), clearTimer = (id) => clearTimeout(id), setTick = (f, ms) => setInterval(f, ms), clearTick = (id) => clearInterval(id),
} = {}) {
  let context = null;
  let master = null;
  let analyser = null;
  let volume = 0.72;
  let duck = 1;
  let current = null; // { key, loop }
  let fading = null;
  let wanted = null; // { phenomenon, level, pan }
  let settle = null;
  let previewTimer = null;
  const buffers = new Map();
  const slices = new Set();

  const level = () => volume * duck;
  const applyLevel = () => { if (master && context) { master.gain.cancelScheduledValues(context.currentTime); master.gain.setTargetAtTime(level(), context.currentTime, 0.05); } };
  const fadeTime = () => (reduced() ? 0.06 : LEVEL_FADE_S);

  function ensureContext() {
    if (context) return context;
    context = createContext();
    master = context.createGain();
    master.gain.value = level();
    analyser = context.createAnalyser?.() ?? null;
    if (analyser) { analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.55; master.connect(analyser); analyser.connect(context.destination); } else master.connect(context.destination);
    return context;
  }

  async function bufferFor(file) {
    if (!buffers.has(file)) {
      buffers.set(file, (async () => {
        const response = await fetchImpl(new URL(file, baseUrl));
        if (!response.ok) throw new Error("Could not load " + file + " (" + response.status + ")");
        return context.decodeAudioData(await response.arrayBuffer());
      })().catch((error) => { buffers.delete(file); throw error; }));
    }
    return buffers.get(file);
  }

  function pannerFor(pan) {
    const node = context.createStereoPanner?.();
    if (node) node.pan.value = Math.max(-1, Math.min(1, pan ?? 0));
    return node;
  }

  /** One looping recording: instances start every (duration - crossfade) and fade in and out across the overlap. */
  async function startLoop(file, pan) {
    const buffer = await bufferFor(file);
    const node = context.createGain();
    node.gain.value = 0;
    const panner = pannerFor(pan);
    if (panner) { node.connect(panner); panner.connect(master); } else node.connect(master);
    const xf = Math.min(CROSSFADE_S, buffer.duration / 3);
    const sources = new Set();
    let nextStart = context.currentTime + 0.05;
    let stopped = false;
    const schedule = () => {
      while (!stopped && nextStart - context.currentTime < 1.2) {
        const source = context.createBufferSource();
        const instance = context.createGain();
        source.buffer = buffer;
        source.connect(instance);
        instance.connect(node);
        instance.gain.setValueAtTime(0, nextStart);
        instance.gain.linearRampToValueAtTime(1, nextStart + xf);
        instance.gain.setValueAtTime(1, nextStart + buffer.duration - xf);
        instance.gain.linearRampToValueAtTime(0, nextStart + buffer.duration);
        source.start(nextStart);
        source.stop(nextStart + buffer.duration + 0.05);
        sources.add(source);
        source.onended = () => { sources.delete(source); source.disconnect(); instance.disconnect(); };
        nextStart += buffer.duration - xf;
      }
    };
    schedule();
    const tick = setTick(schedule, 250);
    return {
      node, panner,
      stop() { stopped = true; clearTick(tick); for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } } node.disconnect(); panner?.disconnect(); },
    };
  }

  async function apply() {
    const target = wanted;
    const key = target ? `${target.phenomenon}-${target.level}` : null;
    if (!target && !context) return;
    if ((current?.key ?? null) === key) {
      if (target && current?.loop.panner) current.loop.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, target.pan ?? 0)), context.currentTime, 0.08);
      return;
    }
    ensureContext();
    if (context.state === "suspended") await context.resume?.();
    const now = context.currentTime;
    const seconds = fadeTime();
    if (fading) { fading.loop.stop(); clearTimer(fading.timer); fading = null; } // at most two recordings alive
    const old = current;
    current = null;
    if (old) {
      old.loop.node.gain.cancelScheduledValues(now);
      old.loop.node.gain.setValueAtTime(old.loop.node.gain.value, now);
      old.loop.node.gain.linearRampToValueAtTime(0, now + seconds);
      fading = { loop: old.loop, timer: setTimer(() => { old.loop.stop(); if (fading?.loop === old.loop) fading = null; }, seconds * 1000 + 80) };
    }
    if (!target) return;
    try {
      const loop = await startLoop(fileFor(target.phenomenon, target.level), target.pan);
      if (wanted?.phenomenon !== target.phenomenon || wanted?.level !== target.level) { loop.stop(); return; } // changed again while loading
      const at = context.currentTime;
      loop.node.gain.setValueAtTime(0, at);
      loop.node.gain.linearRampToValueAtTime(1, at + seconds);
      current = { key, loop };
    } catch (error) {
      console.warn("Recording unavailable", error);
    }
  }

  const api = {
    /** Call inside the sound button's click: creates and resumes the audio context, loads nothing yet. */
    async unlock() { ensureContext(); if (context.state === "suspended") await context.resume?.(); return context.state; },
    get state() { return context?.state ?? "none"; },
    get analyser() { return analyser; },
    /** The level that loops now (null = silence). Safe to call on every cursor move. */
    hold(phenomenon, levelName, pan = 0) {
      clearTimer(previewTimer);
      wanted = phenomenon && levelName ? { phenomenon, level: levelName, pan } : null;
      clearTimer(settle);
      if (!wanted) { apply(); return; }
      settle = setTimer(apply, SETTLE_MS);
    },
    silence() { api.hold(null, null); },
    /** Explicit "play this": the level loops for a moment, then fades out. */
    preview(phenomenon, levelName, pan = 0, seconds = 1.8) {
      if (!phenomenon || !levelName) return;
      clearTimer(settle);
      wanted = { phenomenon, level: levelName, pan };
      apply();
      clearTimer(previewTimer);
      previewTimer = setTimer(() => { wanted = null; apply(); }, seconds * 1000);
    },
    /** One short slice for a step: about 0.7 s with 80 ms fades, from the matching recording. */
    async slice(phenomenon, levelName, { pan = 0, durationS = SLICE_S, fadeS = SLICE_FADE_S, offsetS = 0 } = {}) {
      if (!phenomenon || !levelName) return;
      try {
        ensureContext();
        if (context.state === "suspended") await context.resume?.();
        const buffer = await bufferFor(fileFor(phenomenon, levelName));
        const length = Math.min(durationS, buffer.duration);
        const start = context.currentTime + 0.005;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.connect(gain);
        const panner = pannerFor(pan);
        if (panner) { gain.connect(panner); panner.connect(master); } else gain.connect(master);
        const f = Math.min(fadeS, length / 3);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(SLICE_GAIN, start + f);
        gain.gain.setValueAtTime(SLICE_GAIN, start + length - f);
        gain.gain.linearRampToValueAtTime(0, start + length);
        const offset = buffer.duration > length ? Math.abs(offsetS) % (buffer.duration - length) : 0;
        source.start(start, offset, length + 0.02);
        const entry = { source, gain, panner };
        slices.add(entry);
        source.onended = () => { slices.delete(entry); source.disconnect(); gain.disconnect(); panner?.disconnect(); };
      } catch (error) {
        console.warn("Recording unavailable", error);
      }
    },
    stopSlices(fadeS = SLICE_FADE_S) {
      if (!context) return;
      for (const { source, gain } of slices) { gain.gain.cancelScheduledValues(context.currentTime); gain.gain.setValueAtTime(gain.gain.value, context.currentTime); gain.gain.linearRampToValueAtTime(0, context.currentTime + fadeS); try { source.stop(context.currentTime + fadeS + 0.01); } catch { /* ended */ } }
    },
    setVolume(value) { volume = value; applyLevel(); },
    setDuck(on) { duck = on ? SPEECH_DUCK : 1; applyLevel(); },
    /** Mute or sound off: everything fades out and is released. */
    stop() { clearTimer(previewTimer); api.silence(); api.stopSlices(); },
    get active() { return current?.key ?? null; },
    get gain() { return level(); },
    get alive() { return (current ? 1 : 0) + (fading ? 1 : 0); },
    get slicing() { return slices.size; },
  };
  return api;
}
