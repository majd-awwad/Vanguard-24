const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

export function createStudioPlayback({
  now = () => performance.now() / 1000,
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (key) => cancelAnimationFrame(key),
  onStep = () => {},
  onState = () => {},
} = {}) {
  let samples = [];
  let status = "idle";
  let position = 0;
  let origin = 0;
  let speed = 1;
  let slotSeconds = 0.18;
  let repeat = false;
  let frame;
  let emittedIndex = -1;
  let label = "";

  const duration = () => samples.length * slotSeconds;
  function snapshot() {
    const current = status === "playing" ? Math.min(duration(), position + (now() - origin) * speed) : position;
    const index = samples.length ? Math.min(samples.length - 1, Math.floor(current / slotSeconds)) : -1;
    return { status, position: current, duration: duration(), progress: duration() ? current / duration() : 0, index, speed, repeat, label, count: samples.length };
  }
  function emit(force = false) {
    const state = snapshot();
    if (state.index >= 0 && (force || state.index !== emittedIndex)) {
      emittedIndex = state.index;
      onStep(samples[state.index], state.index, state);
    }
    onState(state);
    return state;
  }
  function notify() {
    const state = snapshot();
    onState(state);
    return state;
  }
  function clear() {
    if (frame !== undefined) cancelFrame(frame);
    frame = undefined;
  }
  function tick() {
    if (status !== "playing") return;
    const state = emit();
    if (state.position >= state.duration) {
      if (repeat && samples.length) {
        position = 0;
        origin = now();
        emittedIndex = -1;
      } else {
        position = state.duration;
        status = "ended";
        frame = undefined;
        emit();
        return;
      }
    }
    frame = requestFrame(tick);
  }
  return {
    snapshot,
    load(next, options = {}) {
      clear();
      samples = Array.isArray(next) ? [...next] : [];
      slotSeconds = Number.isFinite(options.slotSeconds) ? Math.max(0.08, options.slotSeconds) : 0.18;
      label = options.label ?? "";
      position = 0;
      emittedIndex = -1;
      status = samples.length ? "ready" : "idle";
      notify();
    },
    play() {
      if (!samples.length || status === "playing") return;
      if (status === "ended") position = 0;
      origin = now();
      status = "playing";
      emittedIndex = -1;
      tick();
    },
    pause() {
      if (status !== "playing") return;
      position = snapshot().position;
      clear();
      status = "paused";
      emit();
    },
    restart() {
      clear();
      position = 0;
      status = samples.length ? "ready" : "idle";
      emittedIndex = -1;
      notify();
    },
    stop() {
      clear();
      position = 0;
      status = "idle";
      emittedIndex = -1;
      notify();
    },
    seek(progress) {
      const running = status === "playing";
      position = clamp(progress) * duration();
      emittedIndex = -1;
      if (running) origin = now();
      emit(true);
    },
    setSpeed(next) {
      if (!Number.isFinite(next) || next <= 0 || next === speed) return;
      const running = status === "playing";
      position = snapshot().position;
      speed = next;
      if (running) origin = now();
      emit();
    },
    setRepeat(next) { repeat = Boolean(next); emit(); },
    dispose() { clear(); samples = []; status = "idle"; },
  };
}
