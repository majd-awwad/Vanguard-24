import { createTransport } from "../audio/transport.js";
import { createAudioTap } from "../cinematic/audio-tap.js";
import { MAPPING_VERSION, TONE_GAIN } from "./mapping.js";
import { continuousVoice } from "../audio/voices.js";

// Audio for the Studio: the shared transport (web/audio/transport.js) with the analyser tap used elsewhere on the
// site, so the waveform shows the real output. Sound starts only after an explicit user gesture.

export const HOVER_INTERVAL_MS = 90;

/** A short "sound is on" note, so enabling sound is itself audible. */
export function confirmationPlan() {
  const tone = { ...continuousVoice({ frequencyHz: 440, gain: TONE_GAIN, pan: 0 }), durationS: 0.16, attackS: 0.01, releaseS: 0.05 };
  return { caseId: "studio", level: "studio", mappingVersion: MAPPING_VERSION, mode: "confirm", durationS: 0.2, events: [{ id: "ev-0", onsetS: 0, row: 0, col: 0, step: 0, tone, evidence: { mappingVersion: MAPPING_VERSION } }] };
}

export function createStudioAudio({ volume = 0.72, now = () => performance.now(), setTimer = (f, ms) => setTimeout(f, ms), clearTimer = (id) => clearTimeout(id) } = {}) {
  const tap = createAudioTap();
  const transport = createTransport({ createContext: () => tap.createContext() });
  transport.setVolume(volume);
  let enabled = false;
  let lastKey = null;
  let lastAt = -Infinity;
  let timer = null;
  let pending = null;
  let speed = 1;

  async function start(plan) {
    transport.pause();
    transport.load(plan);
    await transport.play();
  }

  const api = {
    transport, tap,
    get enabled() { return enabled; },
    get unavailable() { return transport.snapshot().audioUnavailable; },
    /** Must be called from a user gesture (click or key press). */
    async enable() { enabled = true; lastKey = null; await start(confirmationPlan()); return enabled; },
    disable() { enabled = false; clearTimer(timer); timer = null; pending = null; transport.pause(); },
    setVolume(value) { transport.setVolume(value); },
    setSpeed(value) { speed = value; transport.setSpeed(value); },
    get speed() { return speed; },
    /** Immediate play of a plan (explicit actions: Space, area, path, fingerprints). */
    play(plan) { lastKey = null; transport.setSpeed(speed); return start(plan); },
    stop() { clearTimer(timer); timer = null; pending = null; transport.pause(); },
    /**
     * Hover/cursor tone: deterministic (same key -> same plan), skipped when the key has not changed, and throttled
     * so quick pointer movement never stutters (the last position always plays, after the interval).
     */
    hover(key, makePlan) {
      if (!enabled || key === lastKey) return;
      const wait = HOVER_INTERVAL_MS - (now() - lastAt);
      const fire = () => { timer = null; const job = pending; pending = null; if (!job || !enabled) return; lastKey = job.key; lastAt = now(); transport.setSpeed(1); start(job.makePlan()); };
      pending = { key, makePlan };
      if (wait <= 0) { clearTimer(timer); fire(); } else if (timer === null) timer = setTimer(fire, wait);
    },
    resetHover() { lastKey = null; },
  };
  return api;
}
