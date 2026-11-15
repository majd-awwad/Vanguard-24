import { createTransport } from "../audio/transport.js";

// The Studio's clock. The shared transport (web/audio/transport.js) runs the area scans, paths, comparisons and Echo
// series: it counts time, handles play, pause, stop and speed, and reports the active step. It synthesizes nothing here:
// the plans carry markers only (no tones), and each time a step becomes active the Studio plays a slice of the user's
// recording for it (web/studio/recordings.js). Sound starts only after an explicit user gesture.

export function createStudioAudio({ volume = 0.72 } = {}) {
  const transport = createTransport();
  let enabled = false;
  let speed = 1;
  let baseVolume = volume;
  let duck = 1;
  let plan = null;
  let revision = -1;
  let last = null;

  transport.subscribe((snap) => {
    if (snap.planRevision !== revision) { revision = snap.planRevision; last = null; }
    if (snap.status === "playing" && snap.activeEventId && snap.activeEventId !== last) {
      last = snap.activeEventId;
      const event = plan?.events.find((e) => e.id === last);
      if (event) api.onEvent?.(event, plan);
    }
    if (snap.status === "paused" || snap.status === "idle") api.onHalt?.(snap.status);
  });

  async function start(next) {
    transport.pause();
    plan = next;
    transport.load(next);
    await transport.play();
  }

  const api = {
    transport,
    onEvent: null,
    onHalt: null,
    get enabled() { return enabled; },
    get unavailable() { return transport.snapshot().audioUnavailable; },
    /** Must be called from a user gesture (click or key press). */
    async enable() { enabled = true; return enabled; },
    disable() { enabled = false; transport.pause(); },
    setVolume(value) { baseVolume = value; },
    get volume() { return baseVolume; },
    setDuck(on) { duck = on ? 0.35 : 1; },
    get duck() { return duck; },
    setSpeed(value) { speed = value; transport.setSpeed(value); },
    get speed() { return speed; },
    /** Runs a marker plan on the clock (explicit actions: area, path, comparisons, Echo). */
    play(next) { transport.setSpeed(speed); return start(next); },
    stop() { transport.pause(); },
  };
  return api;
}
